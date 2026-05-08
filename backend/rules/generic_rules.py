"""
Vendor-agnostic security checks applicable to any config file.
"""
import re
from models import Finding, Severity


def _find_line(lines, pattern):
    for i, line in enumerate(lines, 1):
        if re.search(pattern, line, re.IGNORECASE):
            return i, line.strip()
    return None


def check_blank_password(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.search(r"password\s*[\"']?\s*[\"']?\s*$", stripped, re.IGNORECASE):
            if not re.search(r"no\s+\S+\s+password", stripped, re.IGNORECASE):
                return Finding(
                    rule_id="GEN-CRIT-001",
                    severity=Severity.CRITICAL,
                    title="Blank or empty password detected",
                    description="A password directive with no value means authentication can be bypassed with an empty string.",
                    affected_line=stripped,
                    line_number=i,
                    remediation="Set a strong password on all authentication entries.",
                )


def check_password_type0(lines):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.search(r"password\s+0\s+\S+", stripped, re.IGNORECASE):
            return Finding(
                rule_id="GEN-CRIT-002",
                severity=Severity.CRITICAL,
                title="Type-0 (cleartext) password in config",
                description="Type-0 passwords are stored as plaintext. Any user with read access to the config can retrieve credentials directly.",
                affected_line=stripped,
                line_number=i,
                remediation="Replace type-0 passwords with type-9 (scrypt) or type-8 (PBKDF2) secrets.",
                remediation_snippet="! Use 'secret 9' or 'secret 8' instead of 'password 0'",
            )


def check_default_snmp(lines):
    for i, line in enumerate(lines, 1):
        m = re.search(r"community\s+(public|private|cisco)\b", line, re.IGNORECASE)
        if m:
            return Finding(
                rule_id="GEN-CRIT-003",
                severity=Severity.CRITICAL,
                title=f"Default SNMP community string '{m.group(1)}'",
                description=f"'{m.group(1)}' is a well-known default SNMP community. Attackers routinely try these for MIB enumeration.",
                affected_line=line.strip(),
                line_number=i,
                remediation="Change to a strong random community string or upgrade to SNMPv3.",
            )


ALL_RULES = [
    check_blank_password,
    check_password_type0,
    check_default_snmp,
]
