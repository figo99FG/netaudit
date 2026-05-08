"""
Live scanner: SSH into a device via netmiko, pull running-config,
optionally run an nmap port scan for extra findings.
"""
import re
from models import Finding, Severity, DeviceType

NETMIKO_DEVICE_MAP = {
    DeviceType.IOS: "cisco_ios",
    DeviceType.ASA: "cisco_asa",
    DeviceType.GENERIC: "cisco_ios",
}

RISKY_PORTS = {
    23:  ("IOS-LIVE-001", "Telnet (port 23) open", Severity.CRITICAL,
          "Telnet is open on this device. Disable Telnet and use SSH only.",
          "line vty 0 4\n transport input ssh"),
    21:  ("IOS-LIVE-002", "FTP (port 21) open", Severity.HIGH,
          "FTP transmits files and credentials in cleartext.",
          "no ftp-server enable"),
    80:  ("IOS-LIVE-003", "HTTP (port 80) open", Severity.HIGH,
          "HTTP management is enabled. Use HTTPS only.",
          "no ip http server\nip http secure-server"),
    161: ("IOS-LIVE-004", "SNMP (port 161/UDP) open", Severity.MEDIUM,
          "SNMP is accessible. Ensure strong community strings or SNMPv3.",
          "snmp-server group MGMT v3 priv"),
    69:  ("IOS-LIVE-005", "TFTP (port 69) open", Severity.MEDIUM,
          "TFTP has no authentication. Config files can be read/written.",
          "no tftp-server"),
}


def ssh_pull_config(host: str, port: int, username: str, password: str, device_type: DeviceType) -> str:
    from netmiko import ConnectHandler
    conn = ConnectHandler(
        device_type=NETMIKO_DEVICE_MAP.get(device_type, "cisco_ios"),
        host=host,
        port=port,
        username=username,
        password=password,
    )
    output = conn.send_command("show running-config")
    conn.disconnect()
    return output


def nmap_scan(host: str) -> list[Finding]:
    import nmap
    nm = nmap.PortScanner()
    nm.scan(host, arguments="-sV -p 21,22,23,69,80,161,443 --open -T4")
    findings = []
    for proto in nm[host].all_protocols():
        for port in nm[host][proto]:
            if port in RISKY_PORTS and nm[host][proto][port]["state"] == "open":
                rule_id, title, severity, description, snippet = RISKY_PORTS[port]
                findings.append(Finding(
                    rule_id=rule_id,
                    severity=severity,
                    title=title,
                    description=description,
                    remediation=f"Close or restrict port {port}.",
                    remediation_snippet=snippet,
                ))
    return findings
