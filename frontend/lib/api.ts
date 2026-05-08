const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type DeviceType = "ios" | "asa" | "generic" | "auto";

export interface Finding {
  rule_id: string;
  severity: Severity;
  title: string;
  description: string;
  affected_line?: string;
  line_number?: number;
  remediation: string;
  remediation_snippet?: string;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ScanResult {
  scan_id: string;
  device_type: DeviceType;
  hostname?: string;
  ios_version?: string;
  score: number;
  grade: string;
  summary: ScanSummary;
  findings: Finding[];
}

export async function analyzeConfig(configText: string, deviceHint: DeviceType = "auto"): Promise<ScanResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config_text: configText, device_hint: deviceHint }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Analysis failed");
  }
  return res.json();
}

export async function analyzeFile(file: File, deviceHint: DeviceType = "auto"): Promise<ScanResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("device_hint", deviceHint);
  const res = await fetch(`${BASE}/api/analyze/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function liveScan(params: {
  host: string; port: number; username: string; password: string;
  device_type: DeviceType; run_nmap: boolean;
}): Promise<ScanResult> {
  const res = await fetch(`${BASE}/api/scan/live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Live scan failed");
  }
  return res.json();
}

export async function getResult(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${BASE}/api/results/${scanId}`);
  if (!res.ok) throw new Error("Result not found");
  return res.json();
}
