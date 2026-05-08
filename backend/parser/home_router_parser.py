"""
Home router config parser.
Handles nvram-dump (DD-WRT/Tomato/ASUS/TP-Link), OpenWrt UCI,
and plain key=value formats exported from consumer routers.
"""
import re


def parse(config_text: str) -> list[str]:
    return [line.rstrip() for line in config_text.splitlines()]


def extract_nvram(config_text: str) -> dict[str, str]:
    """Parse key=value nvram dump into a flat dict."""
    result = {}
    for line in config_text.splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            key, _, val = line.partition("=")
            result[key.strip()] = val.strip()
    return result


def extract_hostname(config_text: str) -> str | None:
    for pattern in [
        r"^router\.name\s*=\s*(\S+)",
        r"^sys\.hostname\s*=\s*(\S+)",
        r"^hostname\s*=\s*(\S+)",
        r"option hostname '([^']+)'",
        r"<DeviceName>([^<]+)</DeviceName>",
        r"device_name\s*=\s*(.+)",
    ]:
        m = re.search(pattern, config_text, re.MULTILINE | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return "Home Router"
