import re
from models import DeviceType


def detect_device_type(config_text: str) -> DeviceType:
    if re.search(r"^ASA Version", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.ASA
    if re.search(r"^version \d+\.\d+", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.IOS
    if re.search(r"^hostname\s+\S+", config_text, re.MULTILINE | re.IGNORECASE):
        return DeviceType.IOS
    return DeviceType.GENERIC


def extract_hostname(config_text: str) -> str | None:
    m = re.search(r"^hostname\s+(\S+)", config_text, re.MULTILINE | re.IGNORECASE)
    return m.group(1) if m else None


def extract_ios_version(config_text: str) -> str | None:
    m = re.search(r"^version\s+([\d.()A-Za-z]+)", config_text, re.MULTILINE | re.IGNORECASE)
    return m.group(1) if m else None
