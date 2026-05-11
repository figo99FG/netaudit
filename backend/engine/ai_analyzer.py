"""
AI-powered config analysis.

Supports:
  - Anthropic (Claude)  — key starts with sk-ant-
  - OpenAI (GPT-4o)     — key starts with sk- (not sk-ant-)

Falls back gracefully (returns empty findings) if no key or SDK not installed.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from models import Finding, Severity


SYSTEM_PROMPT = """\
You are a senior network security engineer auditing device configurations.
Given a raw config file, identify every security vulnerability or misconfiguration.

Rules:
- Only report real, actionable security issues — no speculation.
- For each finding assign severity: critical | high | medium | low | info
- critical = remote exploit / cleartext credential exposure
- high     = significant weakening of security posture
- medium   = defence-in-depth issue
- low      = hardening best-practice
- info     = informational (version, hostname)

Return ONLY valid JSON — no markdown, no explanation outside the JSON — in this exact shape:
{
  "device_type": "ios" | "asa" | "home_router" | "generic",
  "hostname": "<string or null>",
  "findings": [
    {
      "rule_id": "AI-001",
      "severity": "critical",
      "title": "Short title",
      "description": "What the issue is and why it matters.",
      "affected_line": "the exact config line (or null)",
      "remediation": "How to fix it in plain English.",
      "remediation_snippet": "config commands (or null)"
    }
  ]
}
"""


def _call_anthropic(config_text: str, api_key: str) -> dict:
    from anthropic import Anthropic  # type: ignore
    client = Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Audit this config:\n\n```\n{config_text[:12000]}\n```"}],
    )
    raw = msg.content[0].text.strip()
    # Strip accidental markdown fences
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def _call_openai(config_text: str, api_key: str) -> dict:
    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Audit this config:\n\n```\n{config_text[:12000]}\n```"},
        ],
        max_tokens=4096,
    )
    return json.loads(resp.choices[0].message.content)


def analyze_with_ai(config_text: str, api_key: str) -> dict:
    """
    Returns {"device_type": str, "hostname": str|None, "findings": [Finding, ...]}
    or raises on failure.
    """
    if api_key.startswith("sk-ant-"):
        raw = _call_anthropic(config_text, api_key)
    else:
        raw = _call_openai(config_text, api_key)

    findings: list[Finding] = []
    for i, f in enumerate(raw.get("findings", [])):
        try:
            sev_str = f.get("severity", "info").lower()
            sev = Severity(sev_str) if sev_str in Severity._value2member_map_ else Severity.INFO
            findings.append(Finding(
                rule_id=f.get("rule_id", f"AI-{i+1:03d}"),
                severity=sev,
                title=f.get("title", "AI finding"),
                description=f.get("description", ""),
                affected_line=f.get("affected_line"),
                remediation=f.get("remediation", ""),
                remediation_snippet=f.get("remediation_snippet") or None,
            ))
        except Exception:
            continue

    return {
        "device_type": raw.get("device_type", "generic"),
        "hostname":    raw.get("hostname"),
        "findings":    findings,
    }


def enrich_result(config_text: str, result, api_key: str) -> "ScanEnrichment":
    """
    Takes an existing ScanResult and returns a ScanEnrichment with:
    - executive_summary  — plain English, specific to this device
    - action_plan        — prioritised list of what to fix and why
    - tailored_remediations — per-finding remediation using actual config details
    """
    from models import ScanEnrichment, ActionItem

    findings_text = "\n".join(
        f"[{f.severity.upper()}] {f.rule_id} — {f.title}: {f.description}"
        for f in result.findings
    ) or "No findings."

    prompt = f"""You are a network security expert reviewing automated scan results.

DEVICE: {result.device_type} | Hostname: {result.hostname or "unknown"} | Score: {result.score}/100 (Grade {result.grade})

CONFIG (first 5000 chars):
```
{config_text[:5000]}
```

FINDINGS FROM RULE ENGINE:
{findings_text}

Your tasks:
1. Write a 2–3 sentence executive_summary in plain English. Lead with the single biggest risk and what it means in practice. Be specific to this device — use the hostname and device type.
2. Create an action_plan of up to 5 items ordered by impact. For each: what to do, why it matters most on this device, and how hard it is (low/medium/high effort).
3. For each finding rule_id, write a tailored_remediation — use the actual hostname, interface names, IOS version if present. Make it copy-paste ready where possible.

Return ONLY valid JSON, no markdown fences:
{{
  "executive_summary": "...",
  "action_plan": [
    {{"priority": 1, "title": "...", "why": "...", "effort": "low"}}
  ],
  "tailored_remediations": {{
    "RULE-ID": "exact config commands or steps tailored to this device"
  }}
}}"""

    if api_key.startswith("sk-ant-"):
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
    else:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
        )
        raw = resp.choices[0].message.content.strip()

    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    data = json.loads(raw)

    action_plan = [
        ActionItem(
            priority=item.get("priority", i + 1),
            title=item.get("title", ""),
            why=item.get("why", ""),
            effort=item.get("effort", "medium"),
        )
        for i, item in enumerate(data.get("action_plan", []))
    ]

    return ScanEnrichment(
        executive_summary=data.get("executive_summary", ""),
        action_plan=action_plan,
        tailored_remediations=data.get("tailored_remediations", {}),
    )


def chat_with_config(
    config_text: str,
    findings_summary: str,
    message: str,
    history: list[dict],
    api_key: str,
) -> str:
    """Single-turn chat. history = [{"role": "user"|"assistant", "content": str}, ...]"""

    system = f"""\
You are a network security assistant. The user has just scanned a device config.

CONFIG (truncated to 6000 chars):
```
{config_text[:6000]}
```

FINDINGS SUMMARY:
{findings_summary}

Answer the user's questions about this config. Be concise and practical.
If they ask "why is my score low?" or similar, explain in plain English based on the findings above.
If they ask how to fix something, give the exact config commands.
"""
    messages = history[-10:] + [{"role": "user", "content": message}]

    if api_key.startswith("sk-ant-"):
        from anthropic import Anthropic  # type: ignore
        client = Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return resp.content[0].text.strip()
    else:
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=1024,
        )
        return resp.choices[0].message.content.strip()
