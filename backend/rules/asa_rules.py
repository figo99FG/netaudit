"""
Cisco ASA security rule checks.
"""
import re
from models import Finding, Severity


def _any_line(lines, pattern):
    return any(re.search(pattern, l, re.IGNORECASE) for l in lines)


def _find_line(lines, pattern):
    for i, line in enumerate(lines, 1):
        if re.search(pattern, line, re.IGNORECASE):
            return i, line.strip()
    return None


def check_asa_permit_any(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.search(r"permit\s+any\s+any", stripped, re.IGNORECASE):
            return Finding(
                rule_id="ASA-CRIT-001",
                severity=Severity.CRITICAL,
                title="ACL permits any-to-any traffic",
                description="An 'any any permit' rule allows all traffic through the firewall, negating its purpose entirely.",
                affected_line=stripped,
                line_number=i,
                remediation="Replace with specific source/destination rules. Apply least-privilege.",
                remediation_snippet="access-list OUTSIDE_IN extended permit tcp any host <web-server> eq 443\naccess-list OUTSIDE_IN extended deny ip any any log",
            )


def check_asa_ssh_mgmt(lines):
    if not _any_line(lines, r"^ssh\s+\d+\.\d+\.\d+\.\d+"):
        return Finding(
            rule_id="ASA-HIGH-001",
            severity=Severity.HIGH,
            title="SSH management not restricted by source IP",
            description="Without an 'ssh' ACL entry, SSH access to the ASA is unrestricted to all addresses.",
            remediation="Restrict SSH access to management subnets only.",
            remediation_snippet="ssh 192.168.1.0 255.255.255.0 management\nssh timeout 5\nssh version 2",
        )


def check_asa_logging(lines):
    if not _any_line(lines, r"^logging enable"):
        return Finding(
            rule_id="ASA-HIGH-002",
            severity=Severity.HIGH,
            title="ASA logging not enabled",
            description="Without logging, there is no audit trail of traffic, denied connections, or management access.",
            remediation="Enable logging and send to a syslog server.",
            remediation_snippet="logging enable\nlogging timestamp\nlogging trap informational\nlogging host management 192.168.1.100",
        )


def check_asa_weak_crypto(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.search(r"encryption\s+(des|3des)\b", stripped, re.IGNORECASE):
            return Finding(
                rule_id="ASA-MED-001",
                severity=Severity.MEDIUM,
                title="Weak VPN encryption (DES/3DES)",
                description="DES is broken and 3DES is deprecated. Modern VPN tunnels should use AES-256.",
                affected_line=stripped,
                line_number=i,
                remediation="Update crypto maps / IKE policies to use AES-256.",
                remediation_snippet="crypto ikev2 policy 10\n encryption aes-256\n integrity sha512\n group 21",
            )


def check_asa_banner(lines):
    if not _any_line(lines, r"^banner (login|motd|asdm)"):
        return Finding(
            rule_id="ASA-MED-002",
            severity=Severity.MEDIUM,
            title="No login banner configured",
            description="No authorised-use warning banner is present on the ASA.",
            remediation="Configure a legal warning banner.",
            remediation_snippet="banner login UNAUTHORISED ACCESS IS PROHIBITED. Authorised users only.",
        )


ALL_RULES = [
    check_asa_permit_any,
    check_asa_ssh_mgmt,
    check_asa_logging,
    check_asa_weak_crypto,
    check_asa_banner,
]
