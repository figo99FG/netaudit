"""
Cisco IOS / IOS-XE security rule checks.
Each rule receives the full list of config lines and returns a Finding or None.
"""
import re
from models import Finding, Severity


def _find_line(lines: list[str], pattern: str, flags=re.IGNORECASE) -> tuple[int, str] | None:
    for i, line in enumerate(lines, 1):
        if re.search(pattern, line, flags):
            return i, line.strip()
    return None


def _any_line(lines: list[str], pattern: str) -> bool:
    return any(re.search(pattern, l, re.IGNORECASE) for l in lines)


# ── CRITICAL ──────────────────────────────────────────────────────────────────

def check_enable_password(lines):
    hit = _find_line(lines, r"^enable password\s+")
    if hit:
        return Finding(
            rule_id="IOS-CRIT-001",
            severity=Severity.CRITICAL,
            title="Cleartext enable password",
            description="'enable password' stores the password in reversible cleartext in the config. Anyone with config access can read it.",
            affected_line=hit[1],
            line_number=hit[0],
            remediation="Replace with 'enable secret' (MD5/SHA256 hash) and run 'service password-encryption'.",
            remediation_snippet="no enable password\nenable secret <strong-password>\nservice password-encryption",
        )


def check_telnet_vty(lines):
    in_vty = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^line vty", stripped, re.IGNORECASE):
            in_vty = True
        elif re.match(r"^line ", stripped, re.IGNORECASE):
            in_vty = False
        if in_vty and re.search(r"transport input\s+(telnet|all)", stripped, re.IGNORECASE):
            return Finding(
                rule_id="IOS-CRIT-002",
                severity=Severity.CRITICAL,
                title="Telnet enabled on VTY lines",
                description="Telnet transmits all data including credentials in cleartext. An attacker on the same network can capture login sessions.",
                affected_line=stripped,
                line_number=i,
                remediation="Restrict VTY transport to SSH only.",
                remediation_snippet="line vty 0 4\n transport input ssh",
            )


def check_snmp_default_community(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        m = re.match(r"^snmp-server community\s+(\S+)", stripped, re.IGNORECASE)
        if m and m.group(1).lower() in ("public", "private", "cisco"):
            return Finding(
                rule_id="IOS-CRIT-003",
                severity=Severity.CRITICAL,
                title=f"Default SNMP community string '{m.group(1)}'",
                description=f"The community string '{m.group(1)}' is universally known. SNMP v1/v2c community strings are sent in cleartext and can expose full device state.",
                affected_line=stripped,
                line_number=i,
                remediation="Use a strong random community string and migrate to SNMPv3 with authentication + privacy.",
                remediation_snippet=f"no snmp-server community {m.group(1)}\nsnmp-server group MGMT v3 priv\nsnmp-server user NETOPS MGMT v3 auth sha <authpass> priv aes 128 <privpass>",
            )


def check_service_password_encryption_disabled(lines):
    hit = _find_line(lines, r"^no service password-encryption")
    if hit:
        return Finding(
            rule_id="IOS-CRIT-004",
            severity=Severity.CRITICAL,
            title="Password encryption explicitly disabled",
            description="'no service password-encryption' means all type-7 passwords are stored in plaintext. This exposes VTY, console, and user passwords.",
            affected_line=hit[1],
            line_number=hit[0],
            remediation="Enable password encryption.",
            remediation_snippet="service password-encryption",
        )


def check_username_cleartext_password(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        m = re.match(r"^username\s+\S+\s+password\s+", stripped, re.IGNORECASE)
        if m:
            return Finding(
                rule_id="IOS-CRIT-005",
                severity=Severity.CRITICAL,
                title="Username with cleartext password",
                description="'username ... password' stores credentials as reversible type-7 (easily decoded). Use 'secret' for hashed storage.",
                affected_line=stripped,
                line_number=i,
                remediation="Replace 'password' with 'secret' for all local user accounts.",
                remediation_snippet="username admin privilege 15 secret <strong-password>",
            )


# ── HIGH ──────────────────────────────────────────────────────────────────────

def check_ssh_version(lines):
    if not _any_line(lines, r"^ip ssh version 2"):
        return Finding(
            rule_id="IOS-HIGH-001",
            severity=Severity.HIGH,
            title="SSH version 2 not enforced",
            description="Without 'ip ssh version 2', the device may fall back to SSHv1 which has known cryptographic weaknesses.",
            remediation="Enforce SSHv2 only.",
            remediation_snippet="ip ssh version 2\nip ssh time-out 60\nip ssh authentication-retries 3",
        )


def check_http_server(lines):
    hit = _find_line(lines, r"^ip http server$")
    if hit:
        return Finding(
            rule_id="IOS-HIGH-002",
            severity=Severity.HIGH,
            title="HTTP server enabled (unencrypted)",
            description="The IOS HTTP server serves management pages over cleartext HTTP. Credentials and session tokens are exposed.",
            affected_line=hit[1],
            line_number=hit[0],
            remediation="Disable HTTP and use HTTPS only.",
            remediation_snippet="no ip http server\nip http secure-server",
        )


def check_vty_access_class(lines):
    in_vty = False
    has_access_class = False
    vty_line_num = None
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^line vty", stripped, re.IGNORECASE):
            in_vty = True
            vty_line_num = i
            has_access_class = False
        elif re.match(r"^line ", stripped, re.IGNORECASE) and in_vty:
            if not has_access_class:
                return Finding(
                    rule_id="IOS-HIGH-003",
                    severity=Severity.HIGH,
                    title="VTY lines have no access-class ACL",
                    description="Without an inbound access-class on VTY lines, any IP address can attempt management access.",
                    line_number=vty_line_num,
                    remediation="Apply a numbered or named ACL to restrict management access to trusted hosts.",
                    remediation_snippet="ip access-list standard MGMT-ACL\n permit 192.168.1.0 0.0.0.255\n deny   any log\n!\nline vty 0 4\n access-class MGMT-ACL in",
                )
            in_vty = False
        if in_vty and re.search(r"access-class", stripped, re.IGNORECASE):
            has_access_class = True
    if in_vty and not has_access_class:
        return Finding(
            rule_id="IOS-HIGH-003",
            severity=Severity.HIGH,
            title="VTY lines have no access-class ACL",
            description="Without an inbound access-class on VTY lines, any IP address can attempt management access.",
            line_number=vty_line_num,
            remediation="Apply a numbered or named ACL to restrict management access to trusted hosts.",
            remediation_snippet="ip access-list standard MGMT-ACL\n permit 192.168.1.0 0.0.0.255\n deny   any log\n!\nline vty 0 4\n access-class MGMT-ACL in",
        )


def check_exec_timeout(lines):
    in_vty = False
    has_timeout = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^line vty", stripped, re.IGNORECASE):
            in_vty = True
            has_timeout = False
        elif re.match(r"^line ", stripped, re.IGNORECASE) and in_vty:
            if not has_timeout:
                return Finding(
                    rule_id="IOS-HIGH-004",
                    severity=Severity.HIGH,
                    title="No exec-timeout on VTY lines",
                    description="Without exec-timeout, idle management sessions stay open indefinitely — a hijacking risk.",
                    line_number=i,
                    remediation="Set a session idle timeout on all VTY and console lines.",
                    remediation_snippet="line vty 0 4\n exec-timeout 5 0\nline con 0\n exec-timeout 5 0",
                )
            in_vty = False
        if in_vty and re.search(r"exec-timeout", stripped, re.IGNORECASE):
            has_timeout = True
    if in_vty and not has_timeout:
        return Finding(
            rule_id="IOS-HIGH-004",
            severity=Severity.HIGH,
            title="No exec-timeout on VTY lines",
            description="Without exec-timeout, idle management sessions stay open indefinitely — a hijacking risk.",
            remediation="Set a session idle timeout on all VTY and console lines.",
            remediation_snippet="line vty 0 4\n exec-timeout 5 0\nline con 0\n exec-timeout 5 0",
        )


def check_service_password_encryption_missing(lines):
    if not _any_line(lines, r"^service password-encryption") and not _any_line(lines, r"^no service password-encryption"):
        return Finding(
            rule_id="IOS-HIGH-005",
            severity=Severity.HIGH,
            title="service password-encryption not enabled",
            description="Type-7 passwords (line passwords, CHAP, etc.) will be stored in cleartext without this service.",
            remediation="Enable global password encryption.",
            remediation_snippet="service password-encryption",
        )


def check_aaa(lines):
    if not _any_line(lines, r"^aaa new-model"):
        return Finding(
            rule_id="IOS-HIGH-006",
            severity=Severity.HIGH,
            title="AAA not configured",
            description="Without AAA, there is no centralised authentication, authorisation, or accounting for management access. Local fallback is the only control.",
            remediation="Enable AAA with RADIUS/TACACS+ and define a local fallback.",
            remediation_snippet="aaa new-model\naaa authentication login default group tacacs+ local\naaa authorization exec default group tacacs+ local\naaa accounting exec default start-stop group tacacs+",
        )


# ── MEDIUM ────────────────────────────────────────────────────────────────────

def check_banner(lines):
    if not _any_line(lines, r"^banner (login|motd)"):
        return Finding(
            rule_id="IOS-MED-001",
            severity=Severity.MEDIUM,
            title="No login/MOTD banner configured",
            description="A legal warning banner is required to support prosecution of unauthorised access. Without it, consent to access may be implied.",
            remediation="Add a login or MOTD banner with an authorised-use warning.",
            remediation_snippet='banner login ^C\nUNAUTHORISED ACCESS IS PROHIBITED.\nThis system is for authorised users only. All activity may be monitored and reported.\n^C',
        )


def check_cdp(lines):
    if not _any_line(lines, r"^no cdp run"):
        return Finding(
            rule_id="IOS-MED-002",
            severity=Severity.MEDIUM,
            title="CDP globally enabled",
            description="CDP (Cisco Discovery Protocol) broadcasts device model, IOS version, and IP addresses to all directly connected neighbours. Useful internally but a reconnaissance aid for attackers with switch access.",
            remediation="Disable CDP globally or per interface facing untrusted networks.",
            remediation_snippet="no cdp run\n! Or per-interface:\ninterface GigabitEthernet0/0\n no cdp enable",
        )


def check_logging(lines):
    if not _any_line(lines, r"^logging\s+\d+\.\d+\.\d+\.\d+") and not _any_line(lines, r"^logging host"):
        return Finding(
            rule_id="IOS-MED-003",
            severity=Severity.MEDIUM,
            title="No remote syslog destination configured",
            description="Without a remote syslog server, log entries only exist in the local buffer and are lost on reload. Forensic evidence of incidents cannot be preserved.",
            remediation="Configure a remote syslog destination.",
            remediation_snippet="logging host 192.168.1.100\nlogging trap informational\nlogging source-interface Loopback0",
        )


def check_ip_finger(lines):
    hit = _find_line(lines, r"^ip finger")
    if hit:
        return Finding(
            rule_id="IOS-MED-004",
            severity=Severity.MEDIUM,
            title="IP Finger service enabled",
            description="The finger service exposes active user sessions and system info. It should be disabled on all managed devices.",
            affected_line=hit[1],
            line_number=hit[0],
            remediation="Disable the IP finger service.",
            remediation_snippet="no ip finger",
        )


def check_ip_bootp_server(lines):
    if not _any_line(lines, r"^no ip bootp server"):
        return Finding(
            rule_id="IOS-MED-005",
            severity=Severity.MEDIUM,
            title="BOOTP server not explicitly disabled",
            description="The IOS BOOTP server is enabled by default. It can be abused to leak network topology or provide rogue DHCP responses.",
            remediation="Explicitly disable the BOOTP server.",
            remediation_snippet="no ip bootp server",
        )


def check_ip_source_route(lines):
    if not _any_line(lines, r"^no ip source-route"):
        return Finding(
            rule_id="IOS-MED-006",
            severity=Severity.MEDIUM,
            title="IP source routing not disabled",
            description="IP source routing allows senders to dictate the packet path. This can be used to bypass ACLs and conduct man-in-the-middle attacks.",
            remediation="Disable IP source routing.",
            remediation_snippet="no ip source-route",
        )


# ── LOW ───────────────────────────────────────────────────────────────────────

def check_tcp_small_servers(lines):
    if not _any_line(lines, r"^no service tcp-small-servers"):
        return Finding(
            rule_id="IOS-LOW-001",
            severity=Severity.LOW,
            title="TCP small servers not disabled",
            description="Services like echo, chargen, and daytime can be used in amplification or DoS attacks.",
            remediation="Disable TCP small servers.",
            remediation_snippet="no service tcp-small-servers",
        )


def check_udp_small_servers(lines):
    if not _any_line(lines, r"^no service udp-small-servers"):
        return Finding(
            rule_id="IOS-LOW-002",
            severity=Severity.LOW,
            title="UDP small servers not disabled",
            description="UDP echo/chargen can be exploited for amplification attacks.",
            remediation="Disable UDP small servers.",
            remediation_snippet="no service udp-small-servers",
        )


def check_proxy_arp(lines):
    in_interface = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^interface\s+\S+", stripped, re.IGNORECASE):
            in_interface = True
        elif not stripped.startswith(" ") and not stripped.startswith("!") and stripped:
            in_interface = False
        if in_interface and re.search(r"no ip proxy-arp", stripped, re.IGNORECASE):
            return None
    return Finding(
        rule_id="IOS-LOW-003",
        severity=Severity.LOW,
        title="Proxy ARP not disabled on interfaces",
        description="Proxy ARP allows the router to respond to ARP requests on behalf of hosts in other subnets. This can enable ARP-based MITM attacks.",
        remediation="Disable proxy ARP on all routed interfaces unless explicitly required.",
        remediation_snippet="interface GigabitEthernet0/0\n no ip proxy-arp",
    )


# ── INFO ──────────────────────────────────────────────────────────────────────

def check_ios_version_info(lines):
    for i, line in enumerate(lines, 1):
        m = re.match(r"^version\s+([\d.()A-Za-z]+)", line.strip(), re.IGNORECASE)
        if m:
            return Finding(
                rule_id="IOS-INFO-001",
                severity=Severity.INFO,
                title=f"IOS version detected: {m.group(1)}",
                description=f"Running IOS version {m.group(1)}. Cross-reference with Cisco PSIRT (https://sec.cloudapps.cisco.com/security/center/publicationListing.x) for known CVEs.",
                affected_line=line.strip(),
                line_number=i,
                remediation="Keep IOS up to date. Check Cisco Security Advisories for this version.",
            )


ALL_RULES = [
    check_enable_password,
    check_telnet_vty,
    check_snmp_default_community,
    check_service_password_encryption_disabled,
    check_username_cleartext_password,
    check_ssh_version,
    check_http_server,
    check_vty_access_class,
    check_exec_timeout,
    check_service_password_encryption_missing,
    check_aaa,
    check_banner,
    check_cdp,
    check_logging,
    check_ip_finger,
    check_ip_bootp_server,
    check_ip_source_route,
    check_tcp_small_servers,
    check_udp_small_servers,
    check_proxy_arp,
    check_ios_version_info,
]
