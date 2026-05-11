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
    HOME_ROUTER = "home_router"
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


class ActionItem(BaseModel):
    priority: int
    title: str
    why: str
    effort: str = "medium"   # low | medium | high


class ScanEnrichment(BaseModel):
    executive_summary: str
    action_plan: list[ActionItem] = []
    tailored_remediations: dict[str, str] = {}   # rule_id → tailored text


class ScanResult(BaseModel):
    scan_id: str
    device_type: DeviceType
    hostname: Optional[str] = None
    ios_version: Optional[str] = None
    score: int
    grade: str
    summary: ScanSummary
    findings: list[Finding]
    enrichment: Optional[ScanEnrichment] = None


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


class NetworkScanRequest(BaseModel):
    subnet: str          # e.g. "192.168.0.0/24" or "192.168.0.1-50"
    username: str = "admin"
    password: str
    ssh_port: int = 22


class NetworkHostResult(BaseModel):
    ip: str
    hostname: Optional[str] = None
    device_type: Optional[str] = None
    open_ports: list[int] = []
    score: Optional[int] = None
    grade: Optional[str] = None
    summary: Optional[ScanSummary] = None
    findings: list[Finding] = []
    scan_id: Optional[str] = None
    error: Optional[str] = None
    method: Optional[str] = None


class NetworkScanResult(BaseModel):
    network_scan_id: str
    subnet: str
    hosts_found: int
    hosts_scanned: int
    avg_score: float
    total_critical: int
    total_high: int
    hosts: list[NetworkHostResult]
