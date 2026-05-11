"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DeviceType } from "@/lib/api";
import { analyzeConfig, analyzeConfigAI, analyzeFile, liveScan, networkScan, pingBackend, getSettings } from "@/lib/api";
import SettingsModal from "@/components/SettingsModal";

type Tab = "paste" | "file" | "live" | "network" | "checklist";

const NET_STEPS = [
  { label: "Discovering hosts",           detail: "nmap ping sweep across subnet",         dur: 30  },
  { label: "Port scanning & fingerprint", detail: "TCP scan per host, detect device type", dur: 60  },
  { label: "Pulling configs & analysing", detail: "SSH / HTTP per host, rule engine run",  dur: 999 },
];

const CHECKLIST_QUESTIONS = [
  { id: "default_password", severity: "critical", weight: 20, question: "Is your router still using its default admin password?",              yes_bad: true,  detail: "Default passwords are publicly listed. Anyone on your network can log in." },
  { id: "wep",              severity: "critical", weight: 20, question: "Is your WiFi using WEP encryption?",                                  yes_bad: true,  detail: "WEP was cracked in 2001. An attacker nearby can break in within seconds." },
  { id: "remote_mgmt",      severity: "critical", weight: 15, question: "Is remote management (WAN access to admin panel) enabled?",           yes_bad: true,  detail: "This exposes your router login page to the entire internet." },
  { id: "wps",              severity: "high",     weight: 10, question: "Is WPS (WiFi Protected Setup) enabled?",                             yes_bad: true,  detail: "WPS PIN has a known flaw — attackers can recover your WiFi password in hours." },
  { id: "upnp",             severity: "high",     weight: 8,  question: "Is UPnP enabled?",                                                    yes_bad: true,  detail: "UPnP lets apps silently open ports to the internet. Malware abuses this." },
  { id: "firewall",         severity: "high",     weight: 10, question: "Is the router firewall disabled?",                                    yes_bad: true,  detail: "Without a firewall, all inbound internet traffic reaches your devices directly." },
  { id: "tkip",             severity: "high",     weight: 8,  question: "Is your WiFi using TKIP encryption (not AES)?",                      yes_bad: true,  detail: "TKIP is deprecated and has known weaknesses. Use AES/CCMP instead." },
  { id: "default_ssid",     severity: "medium",   weight: 5,  question: "Is your WiFi name (SSID) still the default (e.g. SKY12345, NETGEAR)?", yes_bad: true, detail: "Default SSIDs reveal your router model, helping attackers target known vulnerabilities." },
  { id: "guest_isolation",  severity: "medium",   weight: 5,  question: "Do you have a guest network WITHOUT client isolation enabled?",       yes_bad: true,  detail: "Without isolation, guest devices can reach your main network." },
  { id: "http_admin",       severity: "medium",   weight: 5,  question: "Can you access the admin panel over HTTP (not HTTPS)?",              yes_bad: true,  detail: "HTTP admin means your password is sent unencrypted on your local network." },
  { id: "auto_update",      severity: "medium",   weight: 5,  question: "Are automatic firmware updates disabled?",                            yes_bad: true,  detail: "Unpatched firmware contains known security vulnerabilities." },
  { id: "ping_wan",         severity: "low",      weight: 3,  question: "Does your router respond to ping from the internet?",                yes_bad: true,  detail: "Responding to WAN ping confirms your IP is active to attackers." },
  { id: "dns_privacy",      severity: "low",      weight: 3,  question: "Are you using your ISP's default DNS servers?",                      yes_bad: true,  detail: "Your ISP can log every domain you visit. Use 1.1.1.1 or 9.9.9.9 for privacy." },
  { id: "wpa3",             severity: "info",     weight: 2,  question: "Does your router NOT support WPA3?",                                  yes_bad: true,  detail: "WPA3 offers stronger protection against password guessing attacks." },
];

const SEV_COLORS: Record<string, string> = {
  critical: "#ff4444", high: "#ff7700", medium: "#ffaa00", low: "#4488ff", info: "#888",
};

const REMEDIATIONS: Record<string, string> = {
  default_password: "Change your admin password: Router admin panel → Administration → Set Password. Use 12+ characters.",
  wep:              "Switch to WPA2-AES or WPA3: Wireless → Security → Security Mode.",
  remote_mgmt:      "Disable remote management: Advanced → Remote Management → Disabled.",
  wps:              "Disable WPS: Wireless → WPS → Disabled.",
  upnp:             "Disable UPnP: Advanced → UPnP → Disabled.",
  firewall:         "Enable the firewall: Security → Firewall → Enabled.",
  tkip:             "Switch to AES encryption: Wireless → Security → Encryption: AES.",
  default_ssid:     "Change your WiFi name to something custom that doesn't reveal your router brand.",
  guest_isolation:  "Enable AP isolation on guest network: Wireless → Guest Network → AP Isolation: On.",
  http_admin:       "Enable HTTPS admin and disable HTTP: Administration → Management → HTTPS: Enabled.",
  auto_update:      "Enable automatic firmware updates: Administration → Firmware Update → Auto Update: On.",
  ping_wan:         "Block WAN ping: Security → WAN Ping → Block WAN Requests: Enabled.",
  dns_privacy:      "Set DNS to 1.1.1.1 (primary) and 9.9.9.9 (secondary) in your router's WAN/Internet settings.",
  wpa3:             "Consider upgrading your router to one that supports WPA3 (most routers made after 2019 do).",
};

const SAMPLE_CONFIG = `hostname Router1
version 15.4
!
enable password cisco123
!
username admin password letmein
!
line vty 0 4
 transport input telnet
!
ip http server
snmp-server community public RO
`;

/* ── Shared input styles ──────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-mid)",
  color: "var(--text)",
  borderRadius: 6,
  fontSize: 13,
  outline: "none",
  width: "100%",
  padding: "9px 12px",
  fontFamily: "var(--font-body)",
  transition: "border-color 160ms ease",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 6,
  letterSpacing: "0.1em",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
};

export default function ScanPage() {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>("checklist");
  const [configText, setConfigText] = useState("");
  const [deviceHint, setDeviceHint] = useState<DeviceType>("auto");
  const [dragOver, setDragOver]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiMode, setAiMode]         = useState(false);
  const [hasApiKey, setHasApiKey]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean | null>>({});
  const [checklistDone, setChecklistDone]       = useState(false);

  const [liveHost, setLiveHost]         = useState("");
  const [livePort, setLivePort]         = useState(22);
  const [liveUser, setLiveUser]         = useState("");
  const [livePass, setLivePass]         = useState("");
  const [liveDevType, setLiveDevType]   = useState<DeviceType>("ios");
  const [runNmap, setRunNmap]           = useState(false);

  const [netSubnet, setNetSubnet]       = useState("192.168.0.0/24");
  const [netUser, setNetUser]           = useState("admin");
  const [netPass, setNetPass]           = useState("");
  const [netSshPort, setNetSshPort]     = useState(22);
  const [netLocalUrl, setNetLocalUrl]   = useState("http://localhost:8000");
  const [netPingStatus, setNetPingStatus] = useState<"idle"|"checking"|"ok"|"fail">("idle");
  const [netShowSetup, setNetShowSetup] = useState(false);

  const [netScanning, setNetScanning]   = useState(false);
  const [netElapsed, setNetElapsed]     = useState(0);
  const [netStep, setNetStep]           = useState(0);
  const [netActiveSubnet, setNetActiveSubnet] = useState("");

  useEffect(() => {
    if (!netScanning) return;
    setNetElapsed(0); setNetStep(0);
    const tick = setInterval(() => {
      setNetElapsed(s => {
        const next = s + 1;
        if (next >= NET_STEPS[0].dur + NET_STEPS[1].dur) setNetStep(2);
        else if (next >= NET_STEPS[0].dur) setNetStep(1);
        else setNetStep(0);
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [netScanning]);

  useEffect(() => {
    getSettings().then(s => setHasApiKey(s.has_api_key)).catch(() => {});
  }, [showSettings]);

  useEffect(() => {
    if (tab !== "network") return;
    const check = async () => {
      if (netScanning) return;
      const ok = await pingBackend(netLocalUrl);
      setNetPingStatus(ok ? "ok" : "fail");
    };
    check();
    const poll = setInterval(check, 8000);
    return () => clearInterval(poll);
  }, [tab, netLocalUrl, netScanning]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (tab === "paste") {
        if (!configText.trim()) throw new Error("Paste a config first.");
        const result = aiMode
          ? await analyzeConfigAI(configText, deviceHint)
          : await analyzeConfig(configText, deviceHint);
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "file") {
        if (!file) throw new Error("Select a file first.");
        const result = await analyzeFile(file, deviceHint);
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "live") {
        if (!liveHost || !liveUser || !livePass) throw new Error("Host, username, and password are required.");
        const result = await liveScan({ host: liveHost, port: livePort, username: liveUser, password: livePass, device_type: liveDevType, run_nmap: runNmap });
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "network") {
        if (!netSubnet || !netPass) throw new Error("Subnet and password are required.");
        if (netPingStatus !== "ok") throw new Error("Local backend not reachable. Click 'Test connection' first.");
        setNetActiveSubnet(netSubnet);
        setNetScanning(true);
        const netResult = await networkScan({ subnet: netSubnet, username: netUser, password: netPass, ssh_port: netSshPort, localUrl: netLocalUrl });
        setNetScanning(false);
        try { localStorage.setItem(`net_${netResult.network_scan_id}`, JSON.stringify(netResult)); } catch { /* ignore */ }
        router.push(`/network/${netResult.network_scan_id}`);
        return;
      }
    } catch (err: unknown) {
      setNetScanning(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Network scanning progress screen ─────────────────────────────── */
  if (netScanning) {
    const mm  = String(Math.floor(netElapsed / 60)).padStart(2, "0");
    const ss  = String(netElapsed % 60).padStart(2, "0");
    const pct = Math.min(98, Math.round((netElapsed / 150) * 100));

    return (
      <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <nav className="nav-glass border-b px-6 py-4 flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}>
          <span className="font-bold text-lg tracking-widest"
            style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}>
            NET<span style={{ color: "var(--text)" }}>AUDIT</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {mm}:{ss} elapsed
          </span>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-10">
          <div className="text-center">
            <div className="text-xs font-bold tracking-widest mb-2"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              NETWORK SCAN IN PROGRESS
            </div>
            <h1 className="text-3xl font-bold mb-1"
              style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}>
              {netActiveSubnet}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>~2–3 min for a /24 · do not close this tab</p>
          </div>

          <div className="w-full max-w-lg">
            <div className="flex justify-between text-xs mb-2"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              <span>Progress</span><span>{pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00cc66,#00ff88)" }} />
            </div>
          </div>

          <div className="w-full max-w-lg space-y-3">
            {NET_STEPS.map((step, i) => {
              const isDone = i < netStep, isActive = i === netStep, isPending = i > netStep;
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: isActive ? "rgba(0,255,136,0.04)" : "var(--bg-surface)",
                    border: `1px solid ${isActive ? "rgba(0,255,136,0.25)" : isDone ? "rgba(0,255,136,0.12)" : "var(--border)"}`,
                  }}>
                  <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isDone ? "rgba(0,255,136,0.15)" : isActive ? "rgba(0,255,136,0.1)" : "var(--bg-card)",
                      color: isDone || isActive ? "var(--green)" : "var(--text-dim)",
                      border: `1px solid ${isDone || isActive ? "rgba(0,255,136,0.3)" : "var(--border)"}`,
                      fontFamily: "var(--font-mono)",
                    }}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold"
                        style={{ fontFamily: "var(--font-heading)", color: isDone ? "var(--green)" : isActive ? "var(--text)" : "var(--text-dim)" }}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="flex gap-1">
                          {[0,1,2].map(d => (
                            <span key={d} className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ background: "var(--green)", animation: `pulse-dot 1.2s ease-in-out ${d*0.2}s infinite` }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5"
                      style={{ color: isPending ? "var(--text-dim)" : "var(--text-2)", fontFamily: "var(--font-mono)" }}>
                      {step.detail}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-bold"
                    style={{ color: isDone ? "var(--green)" : isActive ? "#ffaa00" : "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {isDone ? "DONE" : isActive ? "RUNNING" : "WAIT"}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Results will load automatically when the scan completes
          </p>
        </div>
      </main>
    );
  }

  /* ── Main scan page ─────────────────────────────────────────────────── */
  const tabs = [
    { id: "checklist", label: "Quick Checklist",  sub: "No tech needed" },
    { id: "paste",     label: "Paste Config",     sub: "running-config" },
    { id: "file",      label: "Upload File",      sub: ".cfg · .txt" },
    { id: "network",   label: "Network Scan",     sub: "Whole subnet" },
    { id: "live",      label: "Live SSH",         sub: "Direct connect" },
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <nav className="nav-glass border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ borderColor: "var(--border)" }}>
        <a href="/" className="font-bold text-lg tracking-widest hover:opacity-80"
          style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}>
          NET<span style={{ color: "var(--text)" }}>AUDIT</span>
        </a>
        <a href="/history" className="text-xs px-3 py-2 rounded hover:opacity-80"
          style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          History
        </a>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
          Scan Your Network
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
          Choose the method that fits you best. Not sure?{" "}
          <button onClick={() => setTab("checklist")}
            className="font-semibold hover:opacity-80"
            style={{ color: "var(--green)", background: "none", border: "none", cursor: "pointer" }}>
            Quick Checklist
          </button>
          {" "}— no technical knowledge required.
        </p>

        {/* Context banner */}
        {(tab === "paste" || tab === "file") && (
          <div className="mb-5 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>Have a Cisco device?</p>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>
                Run <code className="px-1 py-0.5 rounded text-xs" style={{ background: "var(--bg-input)", color: "var(--green)", fontFamily: "var(--font-mono)" }}>show running-config</code> and paste the output, or upload the .cfg file.
              </p>
            </div>
            <button className="shrink-0 px-4 py-2 rounded font-bold text-xs tracking-widest hover:opacity-90"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}
              onClick={() => { setTab("paste"); setConfigText(SAMPLE_CONFIG); }}>
              TRY SAMPLE →
            </button>
          </div>
        )}
        {tab === "checklist" && (
          <div className="mb-5 p-4 rounded-xl"
            style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>No tech knowledge needed</p>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>Answer a few simple yes/no questions about your router settings. We&apos;ll score your security and tell you exactly what to fix.</p>
          </div>
        )}
        {tab === "network" && (
          <div className="mb-5 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>Scan every device on your network</p>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>Download and run the NetAudit Agent — it discovers and audits all devices automatically.</p>
            </div>
            <a href="https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe" download
              className="shrink-0 px-4 py-2 rounded font-bold text-xs tracking-widest hover:opacity-90"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
              ↓ DOWNLOAD AGENT
            </a>
          </div>
        )}
        {tab === "live" && (
          <div className="mb-5 p-4 rounded-xl"
            style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>Connect directly via SSH</p>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>SSH into a Cisco device, pull the running config, and audit it live. Credentials are never stored.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className="flex flex-col items-start px-4 py-3 text-left transition-all shrink-0"
              style={{
                background: tab === t.id ? "var(--bg-surface)" : "transparent",
                borderBottom: tab === t.id ? "2px solid var(--green)" : "2px solid transparent",
                color: tab === t.id ? "var(--green)" : "var(--text-muted)",
                marginBottom: -1,
              }}>
              <span className="text-xs font-bold" style={{ fontFamily: "var(--font-heading)" }}>{t.label}</span>
              <span className="text-xs mt-0.5" style={{ color: tab === t.id ? "var(--text-muted)" : "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{t.sub}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="rounded-b-xl rounded-tr-xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderTop: "none" }}>

          {/* Device hint (paste / file) */}
          {(tab === "paste" || tab === "file") && (
            <div className="mb-5">
              <label style={labelStyle}>DEVICE TYPE</label>
              <select value={deviceHint} onChange={e => setDeviceHint(e.target.value as DeviceType)}
                style={{ ...inputStyle, maxWidth: 260 }}>
                <option value="auto">Auto-detect</option>
                <option value="home_router">Home Router (TP-Link / ASUS / Netgear / Sky…)</option>
                <option value="ios">Cisco IOS / IOS-XE</option>
                <option value="asa">Cisco ASA</option>
                <option value="generic">Generic</option>
              </select>
            </div>
          )}

          {/* PASTE TAB */}
          {tab === "paste" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label style={labelStyle}>RUNNING-CONFIG</label>
                <button className="text-xs px-2.5 py-1 rounded hover:opacity-80"
                  style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}
                  onClick={() => setConfigText(SAMPLE_CONFIG)}>
                  Load sample
                </button>
              </div>
              <textarea
                className="w-full rounded-lg p-4 text-xs resize-none"
                style={{ ...inputStyle, height: 340, fontFamily: "var(--font-mono)", lineHeight: 1.7 }}
                placeholder="Paste your Cisco running-config here…"
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* FILE TAB */}
          {tab === "file" && (
            <div
              className="rounded-lg flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
              style={{
                height: 280,
                border: `2px dashed ${dragOver ? "var(--green)" : "var(--border-mid)"}`,
                background: dragOver ? "rgba(0,255,136,0.04)" : "var(--bg-input)",
              }}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".txt,.cfg,.conf,.log" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <div style={{ fontSize: 40, color: "var(--text-muted)" }}>⇪</div>
              {file ? (
                <p className="text-sm font-semibold" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>{file.name}</p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--text-2)" }}>Drop your config file here or click to browse</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>.txt · .cfg · .conf</p>
                </>
              )}
            </div>
          )}

          {/* LIVE TAB */}
          {tab === "live" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>HOST / IP</label>
                  <input style={inputStyle} placeholder="192.168.1.1" value={liveHost} onChange={e => setLiveHost(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>SSH PORT</label>
                  <input type="number" style={inputStyle} value={livePort} onChange={e => setLivePort(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>USERNAME</label>
                  <input style={inputStyle} placeholder="admin" value={liveUser} onChange={e => setLiveUser(e.target.value)} autoComplete="off" />
                </div>
                <div>
                  <label style={labelStyle}>PASSWORD</label>
                  <input type="password" style={inputStyle} placeholder="••••••••" value={livePass} onChange={e => setLivePass(e.target.value)} autoComplete="new-password" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>DEVICE TYPE</label>
                  <select value={liveDevType} onChange={e => setLiveDevType(e.target.value as DeviceType)} style={inputStyle}>
                    <option value="ios">Cisco IOS / IOS-XE</option>
                    <option value="asa">Cisco ASA</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={runNmap} onChange={e => setRunNmap(e.target.checked)}
                      className="w-4 h-4" style={{ accentColor: "var(--green)" }} />
                    <span className="text-sm" style={{ color: "var(--text-2)" }}>Also run nmap port scan</span>
                  </label>
                </div>
              </div>
              <p className="text-xs p-3 rounded-lg" style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                Credentials are used only for this SSH session and are never stored. Only use against devices you own or have written authorisation to test.
              </p>
            </div>
          )}

          {/* NETWORK SCAN TAB */}
          {tab === "network" && (
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-5 rounded-xl" style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                <div className="mb-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded mr-2"
                    style={{ background: "rgba(0,255,136,0.1)", color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                    STEP 1
                  </span>
                  <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Download &amp; run the NetAudit Agent</span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 p-4 rounded-xl"
                  style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-0.5" style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}>NetAudit Agent for Windows</p>
                    <p className="text-xs" style={{ color: "var(--text-2)" }}>Download and double-click — single exe, no install, no zip to extract.</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>~70 MB · Free · Windows 10/11</p>
                  </div>
                  <a href="https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe" download
                    className="shrink-0 px-5 py-2.5 rounded font-bold text-xs tracking-widest hover:opacity-90"
                    style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
                    ↓ Download Agent
                  </a>
                </div>

                <div className="flex items-start gap-2 text-xs mb-3" style={{ color: "var(--text-2)" }}>
                  <span style={{ color: "var(--green)" }}>›</span>
                  <span>The Agent needs to run on the <strong style={{ color: "var(--text)" }}>same computer connected to your network</strong> — that&apos;s how it can reach your routers and devices.</span>
                </div>

                <div className="flex items-start gap-2 text-xs mb-4 p-3 rounded-lg"
                  style={{ background: "rgba(255,170,0,0.05)", border: "1px solid rgba(255,170,0,0.18)" }}>
                  <span style={{ color: "#ffaa00" }}>!</span>
                  <span style={{ color: "var(--text-2)" }}>
                    <strong style={{ color: "#ffaa00" }}>Windows SmartScreen warning?</strong>{" "}
                    Click <strong style={{ color: "var(--text)" }}>&quot;More info&quot;</strong> →{" "}
                    <strong style={{ color: "var(--text)" }}>&quot;Run anyway&quot;</strong>.{" "}
                    Source code is <a href="https://github.com/figo99FG/netaudit" target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--green)" }}>open on GitHub</a>.
                  </span>
                </div>

                <button className="text-xs mb-3 hover:opacity-80"
                  style={{ color: "var(--text-muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-mono)" }}
                  onClick={() => setNetShowSetup(s => !s)}>
                  {netShowSetup ? "▲ Hide advanced options" : "▼ Already running? Advanced options"}
                </button>

                {netShowSetup && (
                  <div className="mb-4 space-y-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <div className="text-xs mb-1.5 font-bold" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>DOCKER</div>
                      <div className="flex items-center gap-2">
                        <pre className="flex-1 text-xs px-3 py-2 rounded-lg font-mono overflow-x-auto"
                          style={{ background: "var(--bg-card)", color: "var(--green)", border: "1px solid var(--border)" }}>
                          docker run -p 8000:8000 figo7799/netaudit-agent
                        </pre>
                        <button className="shrink-0 text-xs px-3 py-2 rounded hover:opacity-80"
                          style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          onClick={() => navigator.clipboard.writeText("docker run -p 8000:8000 figo7799/netaudit-agent")}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1.5 font-bold" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>PYTHON (FROM SOURCE)</div>
                      <div className="space-y-1">
                        {["cd netaudit/backend", "pip install -r requirements.txt", "uvicorn main:app --reload"].map((cmd, i) => (
                          <pre key={i} className="text-xs px-3 py-1.5 rounded font-mono"
                            style={{ background: "var(--bg-card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                            {cmd}
                          </pre>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 items-center">
                  <input className="flex-1 text-sm px-3 py-2 rounded-lg"
                    style={{ ...inputStyle, fontFamily: "var(--font-mono)", borderColor: netPingStatus === "ok" ? "rgba(0,255,136,0.4)" : netPingStatus === "fail" ? "rgba(255,68,68,0.4)" : "var(--border-mid)" }}
                    value={netLocalUrl}
                    onChange={e => { setNetLocalUrl(e.target.value); setNetPingStatus("idle"); }}
                    placeholder="http://localhost:8000" />
                  <button className="shrink-0 px-4 py-2 rounded text-xs font-bold hover:opacity-80"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 130, fontFamily: "var(--font-heading)" }}
                    onClick={async () => { setNetPingStatus("checking"); const ok = await pingBackend(netLocalUrl); setNetPingStatus(ok ? "ok" : "fail"); }}>
                    {netPingStatus === "checking" ? "Checking…" : "Test connection"}
                  </button>
                </div>

                {netPingStatus === "ok" && (
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                    ✓ Connected — local backend is running
                  </p>
                )}
                {netPingStatus === "fail" && (
                  <p className="text-xs mt-2" style={{ color: "#ff6666", fontFamily: "var(--font-mono)" }}>
                    ✗ Agent not running — download and run the Agent above, then click Test connection
                  </p>
                )}
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-xl"
                style={{ background: "var(--bg-input)", border: `1px solid ${netPingStatus === "ok" ? "var(--border)" : "var(--border-dim)"}`, opacity: netPingStatus === "ok" ? 1 : 0.45 }}>
                <div className="mb-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded mr-2"
                    style={{ background: "rgba(0,255,136,0.1)", color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                    STEP 2
                  </span>
                  <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Configure scan</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label style={labelStyle}>SUBNET / RANGE</label>
                    <input className="w-full" style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                      placeholder="192.168.0.0/24" value={netSubnet}
                      onChange={e => setNetSubnet(e.target.value)} disabled={netPingStatus !== "ok"} />
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      CIDR (192.168.0.0/24) · range (192.168.0.1-50) · single IP
                    </p>
                  </div>
                  <div>
                    <label style={labelStyle}>USERNAME</label>
                    <input style={inputStyle} placeholder="admin" value={netUser}
                      onChange={e => setNetUser(e.target.value)} disabled={netPingStatus !== "ok"} autoComplete="off" />
                  </div>
                  <div>
                    <label style={labelStyle}>PASSWORD</label>
                    <input type="password" style={inputStyle} placeholder="••••••••" value={netPass}
                      onChange={e => setNetPass(e.target.value)} disabled={netPingStatus !== "ok"} autoComplete="new-password" />
                  </div>
                  <div>
                    <label style={labelStyle}>SSH PORT</label>
                    <input type="number" style={inputStyle} value={netSshPort}
                      onChange={e => setNetSshPort(Number(e.target.value))} disabled={netPingStatus !== "ok"} />
                  </div>
                </div>
              </div>

              <p className="text-xs px-1" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                Only use against networks you own or have written authorisation to test.
              </p>
            </div>
          )}

          {/* CHECKLIST TAB */}
          {tab === "checklist" && (() => {
            const answered = Object.keys(checklistAnswers).filter(k => checklistAnswers[k] !== null).length;

            if (checklistDone) {
              let deductions = 0;
              const findings = CHECKLIST_QUESTIONS.filter(q => {
                const ans = checklistAnswers[q.id];
                return q.yes_bad ? ans === true : ans === false;
              });
              findings.forEach(q => { deductions += q.weight; });
              const score = Math.max(0, 100 - deductions);
              const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
              const gc    = score >= 75 ? "#00ff88" : score >= 50 ? "#ffaa00" : "#ff4444";

              return (
                <div>
                  <div className="flex items-center gap-6 mb-6 p-5 rounded-xl"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                    <div className="text-center">
                      <div className="text-4xl font-bold" style={{ color: gc, fontFamily: "var(--font-heading)" }}>{score}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/100</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold mb-0.5" style={{ color: gc, fontFamily: "var(--font-heading)" }}>Grade {grade}</div>
                      <div className="text-sm" style={{ color: "var(--text-2)" }}>{findings.length} issue{findings.length !== 1 ? "s" : ""} found</div>
                    </div>
                  </div>

                  {findings.length === 0 ? (
                    <p className="text-sm p-4 rounded-xl"
                      style={{ background: "rgba(0,255,136,0.06)", color: "var(--green)", border: "1px solid rgba(0,255,136,0.2)" }}>
                      Your router looks well configured. Keep firmware updated and check back periodically.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {findings.map(q => (
                        <div key={q.id} className="p-4 rounded-xl"
                          style={{ background: "var(--bg-input)", borderLeft: `3px solid ${SEV_COLORS[q.severity]}`, border: `1px solid ${SEV_COLORS[q.severity]}28`, borderRadius: "0 10px 10px 0" }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded tracking-widest"
                              style={{ background: `${SEV_COLORS[q.severity]}14`, color: SEV_COLORS[q.severity], fontFamily: "var(--font-mono)" }}>
                              {q.severity.toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}>{q.question}</span>
                          </div>
                          <p className="text-xs mb-2" style={{ color: "var(--text-2)" }}>{q.detail}</p>
                          <p className="text-xs p-2.5 rounded-lg" style={{ background: "var(--bg-card)", color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                            Fix: {REMEDIATIONS[q.id]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="mt-5 text-xs px-3 py-2 rounded hover:opacity-80"
                    style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    onClick={() => { setChecklistAnswers({}); setChecklistDone(false); }}>
                    ← Retake checklist
                  </button>
                </div>
              );
            }

            return (
              <div>
                <p className="text-sm mb-3" style={{ color: "var(--text-2)" }}>
                  Answer these questions about your router settings. No config file needed — works with any router.
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {answered}/{CHECKLIST_QUESTIONS.length} answered
                </p>
                <div className="space-y-2.5">
                  {CHECKLIST_QUESTIONS.map(q => (
                    <div key={q.id} className="p-4 rounded-xl"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-bold tracking-widest"
                          style={{ color: SEV_COLORS[q.severity], fontFamily: "var(--font-mono)", minWidth: 56 }}>
                          {q.severity.toUpperCase()}
                        </span>
                        <span className="text-sm" style={{ color: "var(--text)" }}>{q.question}</span>
                      </div>
                      <div className="flex gap-2">
                        {(["yes", "no", "unsure"] as const).map(opt => {
                          const val = opt === "yes" ? true : opt === "no" ? false : null;
                          const sel = checklistAnswers[q.id] === val;
                          return (
                            <button key={opt}
                              className="px-3 py-1.5 rounded text-xs font-bold"
                              style={{
                                background: sel ? (opt === "yes" ? "rgba(255,68,68,0.12)" : opt === "no" ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.06)") : "var(--bg-card)",
                                color: sel ? (opt === "yes" ? "#ff4444" : opt === "no" ? "#00ff88" : "#888") : "var(--text-muted)",
                                border: `1px solid ${sel ? (opt === "yes" ? "#ff444455" : opt === "no" ? "#00ff8855" : "#555") : "var(--border)"}`,
                                fontFamily: "var(--font-heading)",
                                transition: "all 150ms ease",
                              }}
                              onClick={() => setChecklistAnswers(prev => ({ ...prev, [q.id]: val }))}>
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setChecklistDone(true)} disabled={answered < 5}
                    className="px-8 py-3 rounded font-bold text-sm tracking-wide disabled:opacity-40 hover:opacity-90"
                    style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
                    SEE MY SCORE →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3"
              style={{ background: "rgba(255,68,68,0.06)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.2)" }}>
              <span className="shrink-0 font-bold">!</span>
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>Scan failed</div>
                <div className="text-xs" style={{ color: "#ff9999", fontFamily: "var(--font-mono)" }}>{error}</div>
              </div>
            </div>
          )}

          {/* Submit */}
          {tab !== "checklist" && (
            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
              {(tab === "paste" || tab === "file") && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { if (!hasApiKey) { setShowSettings(true); return; } setAiMode(m => !m); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold"
                    style={{ background: aiMode ? "rgba(0,255,136,0.06)" : "var(--bg-card)", border: `1px solid ${aiMode ? "rgba(0,255,136,0.35)" : "var(--border)"}`, color: aiMode ? "var(--green)" : "var(--text-muted)", fontFamily: "var(--font-heading)" }}>
                    <span>◆</span>
                    {aiMode ? "AI mode ON" : "AI mode"}
                  </button>
                  <button onClick={() => setShowSettings(true)}
                    className="px-2 py-1.5 rounded text-xs hover:opacity-80"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                    title="AI Settings">⚙</button>
                </div>
              )}

              <div className="flex items-center gap-3 ml-auto">
                {tab === "network" && netPingStatus !== "ok" && (
                  <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    Connect to local backend first
                  </span>
                )}
                <button onClick={submit}
                  disabled={loading || (tab === "network" && netPingStatus !== "ok")}
                  className="px-8 py-3 rounded font-bold text-sm tracking-wide disabled:opacity-40 hover:opacity-90"
                  style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
                  {loading
                    ? (tab === "network" ? "SCANNING…" : aiMode ? "AI SCANNING…" : "SCANNING…")
                    : (tab === "network" ? "SCAN NETWORK" : aiMode ? "AI ANALYZE" : "ANALYZE")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onSaved={() => setHasApiKey(true)} />
    </main>
  );
}
