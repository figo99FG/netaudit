from enum import Enum
from typing import Optional
from pydantic import BaseModel


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class DeviceType(str, Enum):
    IOS = "ios"
    ASA = "asa"
    GENERIC = "generic"
    AUTO = "auto"


class Finding(BaseModel):
    rule_id: str
    severity: Severity
    title: str
    description: str
    affected_line: Optional[str] = None
    line_number: Optional[int] = None
    remediation: str
    remediation_snippet: Optional[str] = None


class ScanSummary(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0


class ScanResult(BaseModel):
    scan_id: str
    device_type: DeviceType
    hostname: Optional[str] = None
    ios_version: Optional[str] = None
    score: int
    grade: str
    summary: ScanSummary
    findings: list[Finding]


class AnalyzeRequest(BaseModel):
    config_text: str
    device_hint: DeviceType = DeviceType.AUTO


class LiveScanRequest(BaseModel):
    host: str
    port: int = 22
    username: str
    password: str
    device_type: DeviceType
    run_nmap: bool = False
