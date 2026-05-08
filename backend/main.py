import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from models import AnalyzeRequest, LiveScanRequest, ScanResult, DeviceType
from parser.detector import detect_device_type, extract_hostname, extract_ios_version
from parser import ios_parser, asa_parser, generic_parser, home_router_parser
from rules import ios_rules, asa_rules, generic_rules, home_router_rules
from engine.scorer import calculate_score

app = FastAPI(title="NetAudit API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_results: dict[str, ScanResult] = {}


def _run_analysis(config_text: str, device_hint: DeviceType) -> ScanResult:
    device_type = device_hint if device_hint != DeviceType.AUTO else detect_device_type(config_text)

    match device_type:
        case DeviceType.IOS:
            lines = ios_parser.parse(config_text)
            rules = ios_rules.ALL_RULES + generic_rules.ALL_RULES
        case DeviceType.ASA:
            lines = asa_parser.parse(config_text)
            rules = asa_rules.ALL_RULES + generic_rules.ALL_RULES
        case DeviceType.HOME_ROUTER:
            lines = home_router_parser.parse(config_text)
            rules = home_router_rules.ALL_RULES
        case _:
            lines = generic_parser.parse(config_text)
            rules = generic_rules.ALL_RULES

    seen_titles: set[str] = set()
    findings = []
    for rule in rules:
        f = rule(lines)
        if f is not None and f.title not in seen_titles:
            seen_titles.add(f.title)
            findings.append(f)
    score, grade, summary = calculate_score(findings)

    return ScanResult(
        scan_id=str(uuid.uuid4()),
        device_type=device_type,
        hostname=extract_hostname(config_text),
        ios_version=extract_ios_version(config_text) if device_type == DeviceType.IOS else None,
        score=score,
        grade=grade,
        summary=summary,
        findings=findings,
    )


@app.post("/api/analyze", response_model=ScanResult)
async def analyze_config(request: AnalyzeRequest):
    if not request.config_text.strip():
        raise HTTPException(status_code=400, detail="config_text is empty")
    result = _run_analysis(request.config_text, request.device_hint)
    _results[result.scan_id] = result
    return result


@app.post("/api/analyze/upload", response_model=ScanResult)
async def analyze_upload(file: UploadFile = File(...), device_hint: str = "auto"):
    content = await file.read()
    config_text = content.decode("utf-8", errors="replace")
    hint = DeviceType(device_hint) if device_hint in DeviceType._value2member_map_ else DeviceType.AUTO
    result = _run_analysis(config_text, hint)
    _results[result.scan_id] = result
    return result


@app.get("/api/results/{scan_id}", response_model=ScanResult)
async def get_result(scan_id: str):
    result = _results.get(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result


@app.post("/api/scan/live", response_model=ScanResult)
async def live_scan(request: LiveScanRequest):
    from engine.live_scanner import ssh_pull_config, nmap_scan
    try:
        config_text = ssh_pull_config(
            request.host, request.port, request.username, request.password, request.device_type
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SSH connection failed: {e}")

    result = _run_analysis(config_text, request.device_type)

    if request.run_nmap:
        try:
            extra = nmap_scan(request.host)
            result.findings.extend(extra)
            result.score, result.grade, result.summary = calculate_score(result.findings)
        except Exception:
            pass

    _results[result.scan_id] = result
    return result


@app.get("/api/health")
async def health():
    return {"status": "ok"}
