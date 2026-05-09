"""
Network-wide scanner: ping-sweep a subnet, fingerprint each live host,
pull configs via SSH (Cisco) or HTTP (home routers), analyse, aggregate.
"""
import uuid
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Callable

from models import Finding, Severity, DeviceType


# ─── helpers ──────────────────────────────────────────────────────────────────

def _empty_host(ip: str) -> dict:
    return {
        "ip": ip, "hostname": None, "device_type": None,
        "open_ports": [], "score": None, "grade": None,
        "summary": None, "findings": [], "scan_id": None,
        "error": None, "method": None,
    }


# ─── nmap ─────────────────────────────────────────────────────────────────────

def _ping_sweep(subnet: str) -> list[str]:
    import nmap
    nm = nmap.PortScanner()
    nm.scan(hosts=subnet, arguments="-sn -T4 --host-timeout 10s")
    return [h for h in nm.all_hosts() if nm[h].state() == "up"]


def _port_scan(ip: str) -> list[int]:
    import nmap
    nm = nmap.PortScanner()
    nm.scan(ip, arguments="-p 22,23,80,443,8080,8443,161 -T4 --host-timeout 15s")
    open_ports: list[int] = []
    try:
        for proto in nm[ip].all_protocols():
            for port, data in nm[ip][proto].items():
                if data["state"] == "open":
                    open_ports.append(int(port))
    except Exception:
        pass
    return open_ports


RISKY_PORTS: dict[int, tuple] = {
    23:  ("NET-001", "Telnet open (port 23)",       Severity.CRITICAL,
          "Telnet transmits all data including passwords in plaintext.",
          "Disable Telnet — use SSH only.", "line vty 0 4\n transport input ssh"),
    21:  ("NET-002", "FTP open (port 21)",           Severity.HIGH,
          "FTP has no encryption. Credentials travel in cleartext.",
          "Disable FTP.", "no ftp-server enable"),
    80:  ("NET-003", "HTTP admin panel open",        Severity.HIGH,
          "Admin panel served over HTTP — password unencrypted on the LAN.",
          "Enable HTTPS and disable HTTP.", "ip http secure-server\nno ip http server"),
    161: ("NET-004", "SNMP open (port 161)",         Severity.MEDIUM,
          "SNMP is accessible. Ensure SNMPv3 with strong auth/priv.",
          "Migrate to SNMPv3.", "snmp-server group MGMT v3 priv"),
    69:  ("NET-005", "TFTP open (port 69)",          Severity.MEDIUM,
          "TFTP has no authentication — configs can be read or overwritten.",
          "Disable TFTP.", "no tftp-server"),
    8080: ("NET-006", "Alt-HTTP admin open (8080)",  Severity.MEDIUM,
           "An unencrypted admin panel on port 8080 is open.",
           "Restrict or disable port 8080 access.", ""),
}


def _nmap_findings(open_ports: list[int]) -> list[Finding]:
    findings = []
    for port in open_ports:
        if port in RISKY_PORTS:
            rid, title, sev, desc, rem, snip = RISKY_PORTS[port]
            findings.append(Finding(
                rule_id=rid, severity=sev, title=title,
                description=desc, remediation=rem,
                remediation_snippet=snip or None,
            ))
    return findings


# ─── SSH (Cisco) ──────────────────────────────────────────────────────────────

def _try_ssh(ip: str, port: int, username: str, password: str) -> Optional[str]:
    from netmiko import ConnectHandler
    for dtype in ("cisco_ios", "cisco_asa"):
        try:
            conn = ConnectHandler(
                device_type=dtype, host=ip, port=port,
                username=username, password=password,
                conn_timeout=10, auth_timeout=10,
                banner_timeout=15,
            )
            config = conn.send_command("show running-config")
            conn.disconnect()
            if "Current configuration" in config or "hostname" in config:
                return config
        except Exception:
            pass
    return None


# ─── HTTP home-router scrape ──────────────────────────────────────────────────

_SKY_PAGES = [
    "sky_index.html", "sky_wireless_settings.html",
    "sky_logs.html", "sky_router_status.html",
]

def _extract_sky(html: str) -> dict:
    raw: dict[str, str] = {}
    for m in re.finditer(r"var\s+(\w+)\s*=\s*'([^']*)'", html):
        raw[m.group(1)] = m.group(2)
    for m in re.finditer(r'var\s+(\w+)\s*=\s*"([^"]*)"', html):
        raw[m.group(1)] = m.group(2)
    s: dict[str, str] = {}
    if raw.get("sky_WirelessAllSSIDs"): s["wl_ssid"] = raw["sky_WirelessAllSSIDs"]
    if raw.get("sky_wlAuthMode"):       s["wl_security_mode"] = raw["sky_wlAuthMode"]
    if raw.get("sky_wlIsolation") is not None: s["wifi_isolation"] = raw["sky_wlIsolation"]
    if raw.get("WscMode") == "enabled" or raw.get("sky_actualUserWPSState") == "1":
        s["wps_enable"] = "1"
    elif raw.get("WscMode") == "disabled":
        s["wps_enable"] = "0"
    if raw.get("sky_firmware_version"): s["firmware_version"] = raw["sky_firmware_version"]
    s["http_enable"] = "1"
    if raw.get("pingenbl") == "enable": s["wan_ping"] = "enabled"
    return s


def _try_http_router(ip: str, password: str) -> Optional[tuple[str, str]]:
    """Returns (config_text, brand) or None."""
    import requests as _req
    from requests.auth import HTTPDigestAuth

    base = f"http://{ip}"
    brand = "generic"
    settings: dict[str, str] = {}

    # Detect brand
    try:
        r = _req.get(base, timeout=5)
        html_lower = r.text.lower()
        if "sky" in html_lower:
            brand = "sky"
        elif "tp-link" in html_lower:
            brand = "tplink"
        elif "netgear" in html_lower:
            brand = "netgear"
        elif "asus" in html_lower:
            brand = "asus"
    except Exception:
        return None

    if brand == "sky":
        auth = HTTPDigestAuth("admin", password)
        for page in _SKY_PAGES:
            try:
                r = _req.get(f"{base}/{page}", auth=auth, timeout=6)
                if r.ok:
                    settings.update(_extract_sky(r.text))
            except Exception:
                pass
    else:
        # Generic: mark HTTP admin open, try basic auth on common paths
        settings["http_enable"] = "1"
        for path in ["/", "/admin", "/cgi-bin/luci"]:
            try:
                r = _req.get(f"{base}{path}", auth=("admin", password), timeout=5)
                if r.ok and len(r.text) > 200:
                    settings["http_auth_ok"] = "1"
                    break
            except Exception:
                pass

    if not settings:
        return None

    lines = [f"# NetAudit scraped", f"# brand={brand}", ""]
    for k, v in settings.items():
        lines.append(f"{k}={v}")
    return "\n".join(lines), brand


# ─── per-host ─────────────────────────────────────────────────────────────────

def scan_host(ip: str, username: str, password: str,
              ssh_port: int, run_analysis: Callable) -> dict:
    from engine.scorer import calculate_score

    host = _empty_host(ip)
    try:
        open_ports = _port_scan(ip)
        host["open_ports"] = open_ports

        config_text: Optional[str] = None
        device_hint = DeviceType.AUTO

        # 1. Try SSH (Cisco)
        if 22 in open_ports or ssh_port in open_ports:
            config_text = _try_ssh(ip, ssh_port, username, password)
            if config_text:
                host["method"] = "ssh"

        # 2. Try HTTP home router
        if config_text is None and any(p in open_ports for p in (80, 443, 8080, 8443)):
            result_http = _try_http_router(ip, password)
            if result_http:
                config_text, brand = result_http
                host["method"] = f"http_{brand}"
                device_hint = DeviceType.HOME_ROUTER

        if config_text:
            result = run_analysis(config_text, device_hint)
            # merge nmap findings — skip port 80 for home routers (already covered by home_router_rules)
            home_router = device_hint == DeviceType.HOME_ROUTER
            skip_ports = {80} if home_router else set()
            filtered_ports = [p for p in open_ports if p not in skip_ports]
            existing_titles = {f.title for f in result.findings}
            for f in _nmap_findings(filtered_ports):
                if f.title not in existing_titles:
                    result.findings.append(f)
            result.score, result.grade, result.summary = calculate_score(result.findings)

            host.update({
                "hostname":    result.hostname or ip,
                "device_type": result.device_type.value,
                "score":       result.score,
                "grade":       result.grade,
                "summary":     result.summary.model_dump(),
                "findings":    [f.model_dump() for f in result.findings],
                "scan_id":     result.scan_id,
            })
        else:
            # nmap-only
            host["method"] = "nmap_only"
            host["hostname"] = ip
            host["device_type"] = "generic"
            findings = _nmap_findings(open_ports)
            score, grade, summary = calculate_score(findings)
            host.update({
                "score":    score,
                "grade":    grade,
                "summary":  summary.model_dump(),
                "findings": [f.model_dump() for f in findings],
                "scan_id":  str(uuid.uuid4()),
            })

    except Exception as exc:
        host["error"] = str(exc)

    return host


# ─── main ─────────────────────────────────────────────────────────────────────

def scan_network(subnet: str, username: str, password: str,
                 ssh_port: int, run_analysis: Callable) -> dict:
    live_hosts = _ping_sweep(subnet)
    results: list[dict] = []

    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {
            pool.submit(scan_host, ip, username, password, ssh_port, run_analysis): ip
            for ip in live_hosts
        }
        for future in as_completed(futures, timeout=300):
            ip = futures[future]
            try:
                results.append(future.result(timeout=60))
            except Exception as exc:
                h = _empty_host(ip)
                h["error"] = str(exc)
                results.append(h)

    # worst first
    results.sort(key=lambda h: h.get("score") if h.get("score") is not None else 100)

    scored = [h for h in results if h.get("score") is not None]
    avg_score = round(sum(h["score"] for h in scored) / len(scored), 1) if scored else 0.0
    total_critical = sum((h.get("summary") or {}).get("critical", 0) for h in results)
    total_high     = sum((h.get("summary") or {}).get("high", 0)     for h in results)

    return {
        "network_scan_id": str(uuid.uuid4()),
        "subnet":          subnet,
        "hosts_found":     len(live_hosts),
        "hosts_scanned":   len([h for h in results if not h.get("error")]),
        "avg_score":       avg_score,
        "total_critical":  total_critical,
        "total_high":      total_high,
        "hosts":           results,
    }
