"""
Home router security rules.
Covers consumer routers: TP-Link, Netgear, ASUS, Sky, BT,
DD-WRT, Tomato, OpenWrt, and generic nvram-dump formats.
"""
import re
from rules.base import Finding, Severity


def _lines(lines: list[str]) -> str:
    return "\n".join(lines)


def _nvram(lines: list[str]) -> dict[str, str]:
    result = {}
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            result[k.strip().lower()] = v.strip().lower()
    return result


# ── CRITICAL ────────────────────────────────────────────────────────────────

def check_default_admin_password(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    default_passwords = ["admin", "password", "1234", "12345", "123456", "0000", ""]
    pw_val = nv.get("http_passwd") or nv.get("admin_password") or nv.get("pw") or nv.get("password")
    if pw_val is not None and pw_val in default_passwords:
        return Finding(
            rule_id="HR-CRIT-001",
            severity=Severity.CRITICAL,
            title="Default or blank admin password",
            description="The router admin password is set to a well-known default. Any device on your network can take full control of the router.",
            affected_line=f"http_passwd={pw_val or '(blank)'}",
            remediation="Set a strong, unique admin password immediately via the router web interface.",
            remediation_snippet="Router admin panel → Administration → Set Password\nUse a password of 12+ characters with mixed case, numbers, and symbols.",
        )
    # Fallback: look for cleartext default patterns in the raw text
    for pattern in [r'password\s*=\s*"?(admin|password|1234|)\b']:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return Finding(
                rule_id="HR-CRIT-001",
                severity=Severity.CRITICAL,
                title="Default or blank admin password",
                description="The router admin password appears to be set to a well-known default value.",
                affected_line=m.group(0),
                remediation="Set a strong, unique admin password immediately via the router web interface.",
                remediation_snippet="Router admin panel → Administration → Set Password",
            )
    return None


def check_wep_encryption(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    wep_found = (
        nv.get("wl_wep") in ("enabled", "1", "on") or
        nv.get("wl0_wep") in ("enabled", "1", "on") or
        nv.get("wl_crypto") == "wep" or
        re.search(r"wep.*=.*enable|security_type.*=.*wep|AuthType.*WEP", text, re.IGNORECASE)
    )
    if wep_found:
        return Finding(
            rule_id="HR-CRIT-002",
            severity=Severity.CRITICAL,
            title="WEP WiFi encryption in use",
            description="WEP was broken in 2001. An attacker nearby can crack the WiFi password in under 60 seconds and join your network.",
            remediation="Switch to WPA3 (preferred) or WPA2-AES immediately.",
            remediation_snippet="Router admin panel → Wireless → Security\nSet Security Mode: WPA3-Personal or WPA2-PSK (AES only)",
        )
    return None


def check_remote_management(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    remote_on = (
        nv.get("remote_management") in ("1", "on", "enabled") or
        nv.get("remote_mgt") in ("1", "on", "enabled") or
        nv.get("http_wanport") not in (None, "0", "") or
        re.search(r"remote.management.*=.*(1|on|enable|true)|wan_access.*=.*(1|enable)", text, re.IGNORECASE)
    )
    if remote_on:
        return Finding(
            rule_id="HR-CRIT-003",
            severity=Severity.CRITICAL,
            title="Remote management (WAN access) enabled",
            description="The router admin panel is accessible from the internet. Anyone can attempt to log in from anywhere in the world.",
            remediation="Disable remote management unless you specifically need it.",
            remediation_snippet="Router admin panel → Advanced → Remote Management\nSet Remote Management: Disabled",
        )
    return None


def check_telnet_enabled(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    telnet_on = (
        nv.get("telnetd_enable") in ("1", "on", "enabled") or
        nv.get("telnet_enable") in ("1", "on", "enabled") or
        re.search(r"telnet.*=.*(1|on|enable|true)", text, re.IGNORECASE)
    )
    if telnet_on:
        return Finding(
            rule_id="HR-CRIT-004",
            severity=Severity.CRITICAL,
            title="Telnet service enabled",
            description="Telnet transmits everything including passwords in cleartext. Anyone on your network can capture your admin credentials.",
            remediation="Disable Telnet. Use SSH if remote CLI access is needed.",
            remediation_snippet="Router admin panel → Administration → Services\nDisable Telnet",
        )
    return None


# ── HIGH ─────────────────────────────────────────────────────────────────────

def check_wps_enabled(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    wps_on = (
        nv.get("wps_enable") in ("1", "on", "enabled") or
        nv.get("wl_wps_mode") in ("enabled", "1") or
        nv.get("wps_mode_x") == "1" or
        re.search(r"wps.*=.*(1|on|enable|true)|wps_enabled.*=.*1", text, re.IGNORECASE)
    )
    if wps_on:
        return Finding(
            rule_id="HR-HIGH-001",
            severity=Severity.HIGH,
            title="WPS (WiFi Protected Setup) enabled",
            description="WPS PIN mode has a known brute-force vulnerability (Reaver attack). An attacker within WiFi range can recover your WPA2 password in hours.",
            remediation="Disable WPS on your router.",
            remediation_snippet="Router admin panel → Wireless → WPS\nSet WPS: Disabled",
        )
    return None


def check_upnp_enabled(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    upnp_on = (
        nv.get("upnp_enable") in ("1", "on", "enabled") or
        nv.get("upnp_turn_on") == "1" or
        re.search(r"upnp.*=.*(1|on|enable|true)", text, re.IGNORECASE)
    )
    if upnp_on:
        return Finding(
            rule_id="HR-HIGH-002",
            severity=Severity.HIGH,
            title="UPnP enabled",
            description="UPnP allows devices on your network to automatically open ports to the internet without your knowledge. Malware commonly abuses this.",
            remediation="Disable UPnP unless you specifically need it for gaming or media servers.",
            remediation_snippet="Router admin panel → Advanced → UPnP\nSet UPnP: Disabled",
        )
    return None


def check_weak_wifi_encryption(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    tkip_found = (
        nv.get("wl_crypto") == "tkip" or
        nv.get("wl0_crypto") == "tkip" or
        nv.get("wpa_encrypt") == "tkip" or
        re.search(r"crypto.*=.*tkip|encrypt.*=.*tkip|wpa_type.*=.*tkip", text, re.IGNORECASE)
    )
    if tkip_found:
        return Finding(
            rule_id="HR-HIGH-003",
            severity=Severity.HIGH,
            title="TKIP encryption in use (weak)",
            description="TKIP is a deprecated encryption algorithm with known weaknesses. AES/CCMP should be used instead.",
            remediation="Switch to WPA2-AES or WPA3.",
            remediation_snippet="Router admin panel → Wireless → Security\nSet Encryption: AES (not TKIP or TKIP+AES)",
        )
    return None


def check_default_ssid(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    ssid = nv.get("wl_ssid") or nv.get("wl0_ssid") or nv.get("ssid") or ""
    default_ssids = ["linksys", "netgear", "default", "dlink", "tplink", "tp-link",
                     "asus", "belkin", "sky", "bthub", "virginmedia", "ee-brightbox",
                     "plusnet", "talktalk", "home", "wireless"]
    if ssid and any(d in ssid.lower() for d in default_ssids):
        return Finding(
            rule_id="HR-HIGH-004",
            severity=Severity.HIGH,
            title=f"Default SSID in use: '{ssid}'",
            description="A default SSID reveals your router brand/model to attackers, making it easier to target known vulnerabilities for that device.",
            affected_line=f"ssid={ssid}",
            remediation="Change your WiFi network name to something that doesn't identify your router brand.",
            remediation_snippet="Router admin panel → Wireless → Basic Settings\nChange SSID to a custom name",
        )
    # Also check for patterns in raw text
    m = re.search(r'ssid\s*=\s*"?(NETGEAR|linksys|dlink|TP-LINK|ASUS|BThub|Sky\d*)[^"]*"?', text, re.IGNORECASE)
    if m:
        return Finding(
            rule_id="HR-HIGH-004",
            severity=Severity.HIGH,
            title=f"Default SSID in use: '{m.group(0)}'",
            description="A default SSID reveals your router brand/model to attackers.",
            affected_line=m.group(0),
            remediation="Change your WiFi SSID to a custom name that doesn't identify your router model.",
            remediation_snippet="Router admin panel → Wireless → Basic Settings → SSID",
        )
    return None


def check_firewall_disabled(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    fw_off = (
        nv.get("fw_enable") in ("0", "off", "disabled") or
        nv.get("firewall_enable") in ("0", "off", "disabled") or
        nv.get("nf_enabled") == "0" or
        re.search(r"firewall.*=.*(0|off|disable|false)", text, re.IGNORECASE)
    )
    if fw_off:
        return Finding(
            rule_id="HR-HIGH-005",
            severity=Severity.HIGH,
            title="Firewall disabled",
            description="The router firewall is turned off. All inbound traffic from the internet reaches your devices directly.",
            remediation="Enable the firewall immediately.",
            remediation_snippet="Router admin panel → Security → Firewall\nSet Firewall: Enabled / SPI Firewall: On",
        )
    return None


# ── MEDIUM ────────────────────────────────────────────────────────────────────

def check_default_dns(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    isp_dns = (
        nv.get("wan_dns") in ("", "0.0.0.0") or
        nv.get("dns1_x") in ("", "0.0.0.0") or
        re.search(r"dns.*=.*(0\.0\.0\.0|auto)", text, re.IGNORECASE)
    )
    if isp_dns:
        return Finding(
            rule_id="HR-MED-001",
            severity=Severity.MEDIUM,
            title="Using ISP default DNS (no privacy)",
            description="Your ISP can see every domain name you visit. Using a privacy-focused DNS prevents this logging.",
            remediation="Set DNS to a privacy-respecting resolver.",
            remediation_snippet="Router admin panel → Internet → DNS\nPrimary DNS:   1.1.1.1  (Cloudflare)\nSecondary DNS: 8.8.8.8  (Google)\nOr use 9.9.9.9 (Quad9) for malware blocking",
        )
    return None


def check_guest_network_isolation(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    guest_on = (
        nv.get("wl_guest_enable") in ("1", "on") or
        nv.get("wl0.1_bss_enabled") == "1" or
        re.search(r"guest.*network.*=.*(1|on|enable)|guest.*ssid", text, re.IGNORECASE)
    )
    isolated = (
        nv.get("wl_ap_isolate") in ("1", "on") or
        nv.get("guest_lan_isolate") == "1" or
        re.search(r"ap.isolat.*=.*(1|on|enable)|guest.*isolat.*=.*(1|on)", text, re.IGNORECASE)
    )
    if guest_on and not isolated:
        return Finding(
            rule_id="HR-MED-002",
            severity=Severity.MEDIUM,
            title="Guest network not isolated from main network",
            description="Guest WiFi users can reach devices on your main network (NAS, PCs, smart home). Client isolation should be enabled.",
            remediation="Enable AP/client isolation on the guest network.",
            remediation_snippet="Router admin panel → Wireless → Guest Network\nEnable: AP Isolation / Client Isolation",
        )
    return None


def check_http_admin(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    https_only = (
        nv.get("https_enable") in ("1", "on") or
        nv.get("http_enable") in ("0", "off") or
        re.search(r"https.*=.*(1|on|enable)|http_only.*=.*0", text, re.IGNORECASE)
    )
    http_on = (
        nv.get("http_enable") in ("1", "on", "") or
        nv.get("web_http") == "1"
    )
    if http_on and not https_only:
        return Finding(
            rule_id="HR-MED-003",
            severity=Severity.MEDIUM,
            title="Admin panel accessible over HTTP (unencrypted)",
            description="The router admin panel is served over HTTP. Anyone on your network can intercept your admin password.",
            remediation="Enable HTTPS for the admin panel and disable HTTP.",
            remediation_snippet="Router admin panel → Administration → Management\nEnable HTTPS: Yes\nHTTP Access: Disabled",
        )
    return None


def check_old_wifi_standard(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    wpa_version = nv.get("wl_akm") or nv.get("wl_auth_mode") or nv.get("security_mode") or ""
    if "wpa3" not in wpa_version.lower() and re.search(
        r"wl_akm\s*=\s*psk\b|security_mode\s*=\s*wpa-psk\b|auth_mode\s*=\s*psk\b",
        text, re.IGNORECASE
    ):
        return Finding(
            rule_id="HR-MED-004",
            severity=Severity.MEDIUM,
            title="WPA2 only — WPA3 not enabled",
            description="WPA2 is still secure but WPA3 offers better protection against offline dictionary attacks. Upgrade if your router supports it.",
            remediation="Enable WPA3 or WPA2/WPA3 mixed mode.",
            remediation_snippet="Router admin panel → Wireless → Security\nSet Security Mode: WPA3-Personal or WPA2/WPA3 Mixed",
        )
    return None


# ── LOW ──────────────────────────────────────────────────────────────────────

def check_ping_wan(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    ping_on = (
        nv.get("block_wan") in ("0", "off", "disabled") or
        nv.get("wan_ping") in ("1", "on", "enabled") or
        re.search(r"block.wan.ping.*=.*(0|off|disable)|respond.ping.*=.*(1|on|enable)", text, re.IGNORECASE)
    )
    if ping_on:
        return Finding(
            rule_id="HR-LOW-001",
            severity=Severity.LOW,
            title="Router responds to WAN ping",
            description="Your router's WAN IP responds to ICMP ping, making it easier for attackers to confirm the IP is active.",
            remediation="Block WAN ping responses.",
            remediation_snippet="Router admin panel → Security → WAN Ping\nBlock WAN Requests: Enabled",
        )
    return None


def check_ssid_broadcast(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    hidden = (
        nv.get("wl_closed") in ("1", "on") or
        nv.get("wl_ssid_broadcast") in ("0", "off") or
        re.search(r"ssid.broadcast.*=.*(0|off|disable)|closed.*=.*1", text, re.IGNORECASE)
    )
    # Only flag if we can confirm it's broadcasting AND security is weak
    # This is info-level — broadcasting is normal, not inherently bad
    return None  # skip — broadcasting SSID is not a security issue worth flagging


def check_ntp_not_set(lines: list[str]) -> Finding | None:
    text = _lines(lines)
    nv = _nvram(lines)
    has_ntp = (
        nv.get("ntp_server") or
        nv.get("ntp_server0") or
        re.search(r"ntp.*=\s*\S+|option ntp_server", text, re.IGNORECASE)
    )
    if not has_ntp:
        return Finding(
            rule_id="HR-LOW-002",
            severity=Severity.LOW,
            title="NTP server not configured",
            description="Without NTP, the router clock may drift. Incorrect time breaks TLS certificate validation and log timestamps.",
            remediation="Set an NTP server.",
            remediation_snippet="Router admin panel → Administration → Time\nNTP Server: pool.ntp.org",
        )
    return None


ALL_RULES = [
    check_default_admin_password,
    check_wep_encryption,
    check_remote_management,
    check_telnet_enabled,
    check_wps_enabled,
    check_upnp_enabled,
    check_weak_wifi_encryption,
    check_default_ssid,
    check_firewall_disabled,
    check_default_dns,
    check_guest_network_isolation,
    check_http_admin,
    check_old_wifi_standard,
    check_ping_wan,
    check_ntp_not_set,
]
