import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# Load .env if present (local dev)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

import uuid
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import db
from models import AnalyzeRequest, LiveScanRequest, NetworkScanRequest, ScanResult, NetworkScanResult, DeviceType
from parser.detector import detect_device_type, extract_hostname, extract_ios_version
from parser import ios_parser, asa_parser, generic_parser, home_router_parser
from rules import ios_rules, asa_rules, generic_rules, home_router_rules
from engine.scorer import calculate_score

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title="NetAudit API", version="1.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Private Network Access — lets public HTTPS pages (netaudit-blue.vercel.app)
# reach this local agent over http://localhost:8000.
# Chrome 94+ blocks such requests unless the server opts in via this header.
# Using raw ASGI middleware (not BaseHTTPMiddleware) to avoid the mutable-headers bug.
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import MutableHeaders

class PrivateNetworkAccessMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            method = scope.get("method", "")

            # Handle PNA preflight directly — return 204 without touching the app
            if (method == "OPTIONS" and
                    b"access-control-request-private-network" in headers):
                origin = headers.get(b"origin", b"*").decode()
                response_headers = [
                    (b"access-control-allow-private-network", b"true"),
                    (b"access-control-allow-origin", origin.encode()),
                    (b"access-control-allow-methods", b"*"),
                    (b"access-control-allow-headers", b"*"),
                    (b"content-length", b"0"),
                ]
                await send({"type": "http.response.start", "status": 204, "headers": response_headers})
                await send({"type": "http.response.body", "body": b""})
                return

            # For all other requests: inject the PNA header into the response
            async def send_with_pna(message):
                if message["type"] == "http.response.start":
                    raw = list(message.get("headers", []))
                    raw.append((b"access-control-allow-private-network", b"true"))
                    message = {**message, "headers": raw}
                await send(message)

            await self.app(scope, receive, send_with_pna)
        else:
            await self.app(scope, receive, send)

app.add_middleware(PrivateNetworkAccessMiddleware)


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/api/analyze", response_model=ScanResult)
@limiter.limit("20/minute")
async def analyze_config(request: Request, body: AnalyzeRequest):
    if not body.config_text.strip():
        raise HTTPException(status_code=400, detail="config_text is empty")
    result = _run_analysis(body.config_text, body.device_hint)
    db.save(result.scan_id, result.model_dump())
    return result


@app.post("/api/analyze/upload", response_model=ScanResult)
@limiter.limit("20/minute")
async def analyze_upload(request: Request, file: UploadFile = File(...), device_hint: str = "auto"):
    content = await file.read()
    config_text = content.decode("utf-8", errors="replace")
    hint = DeviceType(device_hint) if device_hint in DeviceType._value2member_map_ else DeviceType.AUTO
    result = _run_analysis(config_text, hint)
    db.save(result.scan_id, result.model_dump())
    return result


@app.get("/api/results/{scan_id}", response_model=ScanResult)
@limiter.limit("60/minute")
async def get_result(request: Request, scan_id: str):
    data = db.load(scan_id)
    if not data:
        raise HTTPException(status_code=404, detail="Scan not found")
    return data


@app.post("/api/scan/live", response_model=ScanResult)
@limiter.limit("5/minute")
async def live_scan(request: Request, body: LiveScanRequest):
    from engine.live_scanner import ssh_pull_config, nmap_scan
    try:
        config_text = ssh_pull_config(
            body.host, body.port, body.username, body.password, body.device_type
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SSH connection failed: {e}")

    result = _run_analysis(config_text, body.device_type)

    if body.run_nmap:
        try:
            extra = nmap_scan(body.host)
            result.findings.extend(extra)
            result.score, result.grade, result.summary = calculate_score(result.findings)
        except Exception:
            pass

    db.save(result.scan_id, result.model_dump())
    return result


@app.post("/api/scan/network", response_model=NetworkScanResult)
@limiter.limit("3/minute")
async def network_scan(request: Request, body: NetworkScanRequest):
    from engine.network_scanner import scan_network
    import asyncio, functools

    loop = asyncio.get_event_loop()
    result_dict = await loop.run_in_executor(
        None,
        functools.partial(
            scan_network,
            body.subnet, body.username, body.password,
            body.ssh_port, _run_analysis,
        )
    )
    db.save(result_dict["network_scan_id"], result_dict)
    return result_dict


@app.get("/api/scan/network/{network_scan_id}", response_model=NetworkScanResult)
@limiter.limit("30/minute")
async def get_network_result(request: Request, network_scan_id: str):
    data = db.load(network_scan_id)
    if not data:
        raise HTTPException(status_code=404, detail="Network scan not found")
    return data


@app.get("/api/health")
async def health():
    supabase_ok = db._client() is not None
    return {"status": "ok", "storage": "supabase" if supabase_ok else "memory"}
