#!/usr/bin/env python3
"""
NetAudit Home Router Scanner
=============================
Logs into your home router admin panel, scrapes security settings,
and sends them to NetAudit for analysis.

Works with: Sky, BT, Virgin, TP-Link, Netgear, ASUS, D-Link, Linksys

Requirements:
    pip install requests beautifulsoup4

Usage:
    python netaudit-home-scan.py
    python netaudit-home-scan.py --ip 192.168.1.1 --user admin --password admin
"""

import argparse
import ipaddress
import json
import re
import socket
import sys
import webbrowser
import urllib.parse

API_URL = "https://netaudit-production.up.railway.app"
RESULTS_URL = "https://frontend-cyan-gamma-73.vercel.app/results"

COMMON_ROUTER_IPS = ["192.168.0.1", "192.168.1.1", "192.168.2.1", "10.0.0.1", "10.0.0.138"]

ROUTER_PROFILES = {
    "sky": {
        "login_url": "/sky/login.sky",
        "login_data": lambda u, p: {"username": u, "password": p},
        "pages": ["/wifi", "/security", "/advanced/upnp", "/advanced/wan_setup"],
    },
    "tplink": {
        "login_url": "/",
        "login_data": lambda u, p: {"username": u, "password": p, "logon": "Login"},
        "pages": ["/userRpm/WlanSecurityRpm.htm", "/userRpm/AccessCtrlAccessRulesRpm.htm"],
    },
    "netgear": {
        "login_url": "/start.htm",
        "login_data": lambda u, p: {"loginN": u, "loginP": p},
        "pages": ["/WLG_wireless.htm", "/WAN_setup.htm", "/UPnP.htm"],
    },
    "asus": {
        "login_url": "/login.cgi",
        "login_data": lambda u, p: {"login_authorization": __import__("base64").b64encode(f"{u}:{p}".encode()).decode()},
        "pages": ["/apply.cgi?current_page=Advanced_Wireless_Content.asp"],
    },
    "generic": {
        "login_url": "/",
        "login_data": lambda u, p: {"username": u, "password": p},
        "pages": ["/", "/wifi.html", "/wireless.html", "/security.html", "/advanced.html"],
    },
}


def check_deps():
    missing = []
    for pkg in ["requests", "bs4"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append("beautifulsoup4" if pkg == "bs4" else pkg)
    if missing:
        print(f"[!] Missing packages: {', '.join(missing)}")
        print(f"    Run: pip install {' '.join(missing)}")
        sys.exit(1)


def get_gateway() -> str:
    """Get the default gateway IP."""
    try:
        import subprocess
        result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            if "Default Gateway" in line:
                ip = line.split(":")[-1].strip()
                if ip and ip != "":
                    try:
                        ipaddress.ip_address(ip)
                        return ip
                    except ValueError:
                        continue
    except Exception:
        pass
    # Fallback: try connecting to internet and check source IP prefix
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        parts = local_ip.rsplit(".", 1)
        return f"{parts[0]}.1"
    except Exception:
        return "192.168.0.1"


def detect_router_brand(html: str) -> str:
    html_lower = html.lower()
    if "sky" in html_lower:
        return "sky"
    if "tp-link" in html_lower or "tplink" in html_lower:
        return "tplink"
    if "netgear" in html_lower:
        return "netgear"
    if "asus" in html_lower:
        return "asus"
    if "d-link" in html_lower or "dlink" in html_lower:
        return "dlink"
    if "linksys" in html_lower:
        return "linksys"
    if "bt hub" in html_lower or "bthub" in html_lower:
        return "bt"
    return "generic"


def scrape_settings(session, base_url: str, pages: list[str]) -> str:
    """Scrape settings pages and extract key=value pairs."""
    from bs4 import BeautifulSoup
    collected = {}

    for page in pages:
        try:
            r = session.get(f"{base_url}{page}", timeout=8)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")

            # Extract from input fields
            for inp in soup.find_all("input"):
                name = inp.get("name", "").lower()
                val = inp.get("value", "") or ""
                checked = inp.get("checked")
                if name:
                    if inp.get("type") == "checkbox":
                        collected[name] = "1" if checked else "0"
                    elif inp.get("type") not in ("submit", "button", "image", "hidden"):
                        collected[name] = val

            # Extract from select dropdowns
            for sel in soup.find_all("select"):
                name = sel.get("name", "").lower()
                selected = sel.find("option", selected=True)
                if name and selected:
                    collected[name] = selected.get("value", selected.get_text()).lower()

            # Extract visible text for keyword matching
            text = soup.get_text(" ", strip=True).lower()
            # WPS detection
            if "wps" in text:
                if re.search(r"wps.*?enabled|wps.*?on", text):
                    collected["wps_enable"] = "1"
                elif re.search(r"wps.*?disabled|wps.*?off", text):
                    collected["wps_enable"] = "0"
            # UPnP detection
            if "upnp" in text:
                if re.search(r"upnp.*?enabled|upnp.*?on", text):
                    collected["upnp_enable"] = "1"
                elif re.search(r"upnp.*?disabled|upnp.*?off", text):
                    collected["upnp_enable"] = "0"
            # Remote management
            if "remote management" in text or "remote access" in text:
                if re.search(r"remote.*(management|access).*?(enabled|on)", text):
                    collected["remote_management"] = "1"
            # Firewall
            if "firewall" in text:
                if re.search(r"firewall.*?(disabled|off)", text):
                    collected["fw_enable"] = "0"
                elif re.search(r"firewall.*?(enabled|on)", text):
                    collected["fw_enable"] = "1"
            # Encryption
            for enc in ["wep", "wpa3", "wpa2", "wpa", "tkip", "aes"]:
                if re.search(rf"\b{enc}\b.*?(enabled|selected|active)", text):
                    collected["wl_crypto"] = enc

        except Exception:
            continue

    # Build nvram-style config string
    lines = [f"# NetAudit scraped config from {base_url}"]
    for k, v in collected.items():
        lines.append(f"{k}={v}")
    return "\n".join(lines)


def try_login(session, base_url: str, username: str, password: str) -> bool:
    """Try to login to the router admin panel."""
    import requests

    # First, try HTTP basic auth
    try:
        r = session.get(base_url, auth=(username, password), timeout=8)
        if r.status_code == 200 and "login" not in r.url.lower():
            return True
    except Exception:
        pass

    # Try common login form endpoints
    login_endpoints = ["/", "/login", "/admin", "/cgi-bin/login", "/login.htm", "/login.cgi"]
    login_fields = [
        {"username": username, "password": password},
        {"user": username, "pass": password},
        {"admin_username": username, "admin_password": password},
        {"loginN": username, "loginP": password},
    ]

    for endpoint in login_endpoints:
        for fields in login_fields:
            try:
                r = session.post(f"{base_url}{endpoint}", data=fields, timeout=8, allow_redirects=True)
                if r.status_code in (200, 302) and "incorrect" not in r.text.lower() and "invalid" not in r.text.lower():
                    return True
            except Exception:
                continue

    return True  # Optimistically continue even if login uncertain


def analyze_config(config_text: str) -> dict | None:
    import requests
    try:
        r = requests.post(
            f"{API_URL}/api/analyze",
            json={"config_text": config_text, "device_hint": "home_router"},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[!] API error: {e}")
        return None


def print_result(result: dict, router_ip: str):
    score = result.get("score", "?")
    grade = result.get("grade", "?")
    scan_id = result.get("scan_id", "")
    summary = result.get("summary", {})
    findings = result.get("findings", [])

    data_param = urllib.parse.quote(json.dumps(result))
    url = f"{RESULTS_URL}/{scan_id}?data={data_param}"

    print(f"\n  {'='*60}")
    print(f"  Router: {router_ip}")
    print(f"  Security Score: {score}/100   Grade: {grade}")
    print(f"  Critical: {summary.get('critical',0)}  High: {summary.get('high',0)}  "
          f"Medium: {summary.get('medium',0)}  Low: {summary.get('low',0)}")
    print(f"\n  Top findings:")
    for f in findings[:5]:
        sev = f.get("severity", "").upper()
        title = f.get("title", "")
        print(f"    [{sev}] {title}")
    if len(findings) > 5:
        print(f"    ... and {len(findings)-5} more")
    print(f"\n  Full report: {url}")
    print(f"  {'='*60}\n")
    return url


def main():
    check_deps()
    import requests

    parser = argparse.ArgumentParser(description="NetAudit Home Router Scanner")
    parser.add_argument("--ip",       help="Router IP (default: auto-detect)")
    parser.add_argument("--user",     default="admin", help="Admin username (default: admin)")
    parser.add_argument("--password", help="Admin password")
    parser.add_argument("--no-open",  action="store_true", help="Don't open results in browser")
    args = parser.parse_args()

    print("\n  NetAudit Home Router Scanner")
    print("  For use on your own network only\n")

    # Detect router IP
    router_ip = args.ip
    if not router_ip:
        detected = get_gateway()
        response = input(f"[?] Detected router at {detected}. Press Enter to use it or type another: ").strip()
        router_ip = response if response else detected

    base_url = f"http://{router_ip}"
    print(f"[*] Connecting to {base_url}...")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (NetAudit Scanner)"})

    # Get login page to detect brand
    brand = "generic"
    try:
        r = session.get(base_url, timeout=8)
        brand = detect_router_brand(r.text)
        print(f"[+] Detected router brand: {brand.upper()}")
    except Exception as e:
        print(f"[!] Could not reach {base_url}: {e}")
        print("    Make sure you're connected to your home WiFi.")
        sys.exit(1)

    # Get credentials
    username = args.user
    password = args.password or __import__("getpass").getpass(f"[?] Router admin password (username: {username}): ")

    print(f"[*] Logging in...")
    try_login(session, base_url, username, password)

    # Scrape settings
    print(f"[*] Scraping router settings...")
    profile = ROUTER_PROFILES.get(brand, ROUTER_PROFILES["generic"])
    pages = profile["pages"] + ["/wifi", "/security", "/advanced", "/status"]
    config_text = scrape_settings(session, base_url, pages)

    if len(config_text.splitlines()) < 3:
        print("[!] Could not scrape settings — the router may require a different login method.")
        print("    Try the manual checklist at: https://frontend-cyan-gamma-73.vercel.app/scan")
        sys.exit(1)

    print(f"[+] Scraped {len(config_text.splitlines())} settings")
    print(f"[*] Analysing with NetAudit...")

    result = analyze_config(config_text)
    if not result:
        sys.exit(1)

    url = print_result(result, router_ip)

    if not args.no_open:
        open_b = input("[?] Open full report in browser? [Y/n]: ").strip().lower()
        if open_b != "n":
            webbrowser.open(url)


if __name__ == "__main__":
    main()
