const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type DeviceType = "ios" | "asa" | "generic" | "home_router" | "auto";

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

export interface NetworkHostResult {
  ip: string;
  hostname?: string;
  device_type?: string;
  open_ports: number[];
  score?: number;
  grade?: string;
  summary?: ScanSummary;
  findings: Finding[];
  scan_id?: string;
  error?: string;
  method?: string;
}

export interface NetworkScanResult {
  network_scan_id: string;
  subnet: string;
  hosts_found: number;
  hosts_scanned: number;
  avg_score: number;
  total_critical: number;
  total_high: number;
  hosts: NetworkHostResult[];
}

export async function networkScan(params: {
  subnet: string; username: string; password: string; ssh_port: number;
  localUrl?: string;
}): Promise<NetworkScanResult> {
  const base = params.localUrl?.replace(/\/$/, "") || BASE;
  const { localUrl: _, ...body } = params;
  const res = await fetch(`${base}/api/scan/network`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Network scan failed");
  }
  return res.json();
}

export async function pingBackend(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getSettings(): Promise<{ has_api_key: boolean; api_key_hint: string; ai_enabled: boolean }> {
  const res = await fetch(`${BASE}/api/settings`);
  if (!res.ok) throw new Error("Could not fetch settings");
  return res.json();
}

export async function saveSettings(settings: { api_key?: string; ai_enabled?: boolean }): Promise<void> {
  await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function analyzeConfigAI(configText: string, deviceHint: DeviceType = "auto"): Promise<ScanResult> {
  const res = await fetch(`${BASE}/api/analyze/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config_text: configText, device_hint: deviceHint }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "AI analysis failed");
  }
  return res.json();
}

export async function chatWithConfig(params: {
  scan_id: string;
  config_text: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Chat failed");
  }
  const data = await res.json();
  return data.reply;
}

export async function getNetworkResult(id: string): Promise<NetworkScanResult> {
  const res = await fetch(`${BASE}/api/scan/network/${id}`);
  if (!res.ok) throw new Error("Network scan not found");
  return res.json();
}
