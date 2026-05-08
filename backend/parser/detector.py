import re
from models import DeviceType


def detect_device_type(config_text: str) -> DeviceType:
    if re.search(r"^ASA Version", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.ASA
    if re.search(r"^version \d+\.\d+", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.IOS
    if re.search(r"^hostname\s+\S+", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.IOS
    # Home router: nvram-style key=value dumps or common home router patterns
    if _is_home_router(config_text):
        return DeviceType.HOME_ROUTER
    return DeviceType.GENERIC


def _is_home_router(config_text: str) -> bool:
    home_patterns = [
        r"wl_ssid\s*=",
        r"wl0_ssid\s*=",
        r"wps_enable\s*=",
        r"upnp_enable\s*=",
        r"http_passwd\s*=",
        r"wan_proto\s*=",
        r"wl_security_mode\s*=",
        r"lan_ipaddr\s*=",
        r"option\s+wifi-iface",
        r"config\s+wireless",
        r"<DeviceName>",
        r"remote_management\s*=",
        r"wl_wep\s*=",
        r"fw_enable\s*=",
    ]
    matches = sum(1 for p in home_patterns if re.search(p, config_text, re.IGNORECASE))
    return matches >= 2


def extract_hostname(config_text: str) -> str | None:
    for pattern in [
        r"^hostname\s+(\S+)",
        r"^router\.name\s*=\s*(\S+)",
        r"^sys\.hostname\s*=\s*(\S+)",
        r"option hostname '([^']+)'",
        r"<DeviceName>([^<]+)</DeviceName>",
        r"device_name\s*=\s*(.+)",
    ]:
        m = re.search(pattern, config_text, re.MULTILINE | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def extract_ios_version(config_text: str) -> str | None:
    m = re.search(r"^version\s+([\d.()A-Za-z]+)", config_text, re.MULTILINE | re.IGNORECASE)
    return m.group(1) if m else None
