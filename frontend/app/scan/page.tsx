"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DeviceType } from "@/lib/api";
import { analyzeConfig, analyzeConfigAI, analyzeFile, liveScan, networkScan, pingBackend, getSettings } from "@/lib/api";
import SettingsModal from "@/components/SettingsModal";

type Tab = "paste" | "file" | "live" | "network" | "checklist";

const NET_STEPS = [
  { label: "Discovering hosts",          detail: "nmap ping sweep across subnet",          dur: 30  },
  { label: "Port scanning & fingerprint", detail: "TCP scan per host, detect device type",  dur: 60  },
  { label: "Pulling configs & analysing", detail: "SSH / HTTP per host, rule engine run",   dur: 999 },
];

const CHECKLIST_QUESTIONS = [
  { id: "default_password",    severity: "critical", weight: 20, question: "Is your router still using its default admin password?",              yes_bad: true,  detail: "Default passwords are publicly listed. Anyone on your network can log in." },
  { id: "wep",                 severity: "critical", weight: 20, question: "Is your WiFi using WEP encryption?",                                  yes_bad: true,  detail: "WEP was cracked in 2001. An attacker nearby can break in within seconds." },
  { id: "remote_mgmt",         severity: "critical", weight: 15, question: "Is remote management (WAN access to admin panel) enabled?",           yes_bad: true,  detail: "This exposes your router login page to the entire internet." },
  { id: "wps",                 severity: "high",     weight: 10, question: "Is WPS (WiFi Protected Setup) enabled?",                             yes_bad: true,  detail: "WPS PIN has a known flaw — attackers can recover your WiFi password in hours." },
  { id: "upnp",                severity: "high",     weight: 8,  question: "Is UPnP enabled?",                                                    yes_bad: true,  detail: "UPnP lets apps silently open ports to the internet. Malware abuses this." },
  { id: "firewall",            severity: "high",     weight: 10, question: "Is the router firewall disabled?",                                    yes_bad: true,  detail: "Without a firewall, all inbound internet traffic reaches your devices directly." },
  { id: "tkip",                severity: "high",     weight: 8,  question: "Is your WiFi using TKIP encryption (not AES)?",                      yes_bad: true,  detail: "TKIP is deprecated and has known weaknesses. Use AES/CCMP instead." },
  { id: "default_ssid",        severity: "medium",   weight: 5,  question: "Is your WiFi name (SSID) still the default (e.g. SKY12345, NETGEAR)?", yes_bad: true, detail: "Default SSIDs reveal your router model, helping attackers target known vulnerabilities." },
  { id: "guest_isolation",     severity: "medium",   weight: 5,  question: "Do you have a guest network WITHOUT client isolation enabled?",       yes_bad: true,  detail: "Without isolation, guest devices can reach your main network." },
  { id: "http_admin",          severity: "medium",   weight: 5,  question: "Can you access the admin panel over HTTP (not HTTPS)?",              yes_bad: true,  detail: "HTTP admin means your password is sent unencrypted on your local network." },
  { id: "auto_update",         severity: "medium",   weight: 5,  question: "Are automatic firmware updates disabled?",                            yes_bad: true,  detail: "Unpatched firmware contains known security vulnerabilities." },
  { id: "ping_wan",            severity: "low",      weight: 3,  question: "Does your router respond to ping from the internet?",                yes_bad: true,  detail: "Responding to WAN ping confirms your IP is active to attackers." },
  { id: "dns_privacy",         severity: "low",      weight: 3,  question: "Are you using your ISP's default DNS servers?",                      yes_bad: true,  detail: "Your ISP can log every domain you visit. Use 1.1.1.1 or 9.9.9.9 for privacy." },
  { id: "wpa3",                severity: "info",     weight: 2,  question: "Does your router NOT support WPA3?",                                  yes_bad: true,  detail: "WPA3 offers stronger protection against password guessing attacks." },
];

const SEV_COLORS: Record<string, string> = {
  critical: "#ff4444",
  high: "#ff7700",
  medium: "#ffaa00",
  low: "#4488ff",
  info: "#888",
};

const REMEDIATIONS: Record<string, string> = {
  default_password: "Change your admin password: Router admin panel → Administration → Set Password. Use 12+ characters.",
  wep:             "Switch to WPA2-AES or WPA3: Wireless → Security → Security Mode.",
  remote_mgmt:     "Disable remote management: Advanced → Remote Management → Disabled.",
  wps:             "Disable WPS: Wireless → WPS → Disabled.",
  upnp:            "Disable UPnP: Advanced → UPnP → Disabled.",
  firewall:        "Enable the firewall: Security → Firewall → Enabled.",
  tkip:            "Switch to AES encryption: Wireless → Security → Encryption: AES.",
  default_ssid:    "Change your WiFi name to something custom that doesn't reveal your router brand.",
  guest_isolation: "Enable AP isolation on guest network: Wireless → Guest Network → AP Isolation: On.",
  http_admin:      "Enable HTTPS admin and disable HTTP: Administration → Management → HTTPS: Enabled.",
  auto_update:     "Enable automatic firmware updates: Administration → Firmware Update → Auto Update: On.",
  ping_wan:        "Block WAN ping: Security → WAN Ping → Block WAN Requests: Enabled.",
  dns_privacy:     "Set DNS to 1.1.1.1 (primary) and 9.9.9.9 (secondary) in your router's WAN/Internet settings.",
  wpa3:            "Consider upgrading your router to one that supports WPA3 (most routers made after 2019 do).",
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

export default function ScanPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("checklist");
  const [configText, setConfigText] = useState("");
  const [deviceHint, setDeviceHint] = useState<DeviceType>("auto");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiMode, setAiMode] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Checklist state
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean | null>>({});
  const [checklistDone, setChecklistDone] = useState(false);

  // Live scan fields
  const [liveHost, setLiveHost] = useState("");
  const [livePort, setLivePort] = useState(22);
  const [liveUser, setLiveUser] = useState("");
  const [livePass, setLivePass] = useState("");
  const [liveDevType, setLiveDevType] = useState<DeviceType>("ios");
  const [runNmap, setRunNmap] = useState(false);

  // Network scan fields
  const [netSubnet, setNetSubnet] = useState("192.168.0.0/24");
  const [netUser, setNetUser] = useState("admin");
  const [netPass, setNetPass] = useState("");
  const [netSshPort, setNetSshPort] = useState(22);
  const [netLocalUrl, setNetLocalUrl] = useState("http://localhost:8000");
  const [netPingStatus, setNetPingStatus] = useState<"idle"|"checking"|"ok"|"fail">("idle");
  const [netShowSetup, setNetShowSetup] = useState(false);

  // Network scan progress
  const [netScanning, setNetScanning] = useState(false);
  const [netElapsed, setNetElapsed] = useState(0);
  const [netStep, setNetStep] = useState(0);
  const [netActiveSubnet, setNetActiveSubnet] = useState("");

  useEffect(() => {
    if (!netScanning) return;
    setNetElapsed(0);
    setNetStep(0);
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

  // Check if API key is configured
  useEffect(() => {
    getSettings().then(s => setHasApiKey(s.has_api_key)).catch(() => {});
  }, [showSettings]);

  // Auto-ping: fire immediately on tab switch + every 8s to keep status live
  useEffect(() => {
    if (tab !== "network") return;
    const check = async () => {
      if (netScanning) return;
      const ok = await pingBackend(netLocalUrl);
      setNetPingStatus(ok ? "ok" : "fail");
    };
    check(); // immediate check on tab switch
    const poll = setInterval(check, 8000);
    return () => clearInterval(poll);
  }, [tab, netLocalUrl, netScanning]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      let result;
      if (tab === "paste") {
        if (!configText.trim()) throw new Error("Paste a config first.");
        result = aiMode ? await analyzeConfigAI(configText, deviceHint) : await analyzeConfig(configText, deviceHint);
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "file") {
        if (!file) throw new Error("Select a file first.");
        result = await analyzeFile(file, deviceHint);
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "live") {
        if (!liveHost || !liveUser || !livePass) throw new Error("Host, username, and password are required.");
        result = await liveScan({
          host: liveHost, port: livePort,
          username: liveUser, password: livePass,
          device_type: liveDevType, run_nmap: runNmap,
        });
        router.push(`/results/${result.scan_id}`);
      } else if (tab === "network") {
        if (!netSubnet || !netPass) throw new Error("Subnet and password are required.");
        if (netPingStatus !== "ok") throw new Error("Local backend not reachable. Click 'Test connection' first.");
        setNetActiveSubnet(netSubnet);
        setNetScanning(true);
        const netResult = await networkScan({
          subnet: netSubnet, username: netUser,
          password: netPass, ssh_port: netSshPort,
          localUrl: netLocalUrl,
        });
        setNetScanning(false);
        // Cache result so the results page can show it even if Supabase write failed
        try {
          localStorage.setItem(`net_${netResult.network_scan_id}`, JSON.stringify(netResult));
        } catch { /* storage full — ignore */ }
        router.push(`/network/${netResult.network_scan_id}`);
        return;
      } else {
        return;
      }
    } catch (err: unknown) {
      setNetScanning(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // remove old catch-all redirect (handled per-tab above)
  const tabStyle = (t: Tab) => ({
    padding: "8px 20px",
    borderRadius: "6px 6px 0 0",
    border: "1px solid",
    borderBottom: tab === t ? "1px solid var(--bg-card)" : "1px solid #2a2a2a",
    background: tab === t ? "var(--bg-card)" : "transparent",
    color: tab === t ? "var(--green)" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.1em",
    borderColor: tab === t ? "#2a2a2a" : "#2a2a2a",
    marginBottom: tab === t ? "-1px" : "0",
  } as React.CSSProperties);

  // ── Network scanning progress screen ────────────────────────────────────────
  if (netScanning) {
    const mm = String(Math.floor(netElapsed / 60)).padStart(2, "0");
    const ss = String(netElapsed % 60).padStart(2, "0");
    const totalEst = 150; // ~2.5 min for /24
    const pct = Math.min(98, Math.round((netElapsed / totalEst) * 100));

    return (
      <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
          <span className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
            NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
          </span>
          <span className="text-xs font-mono" style={{ color: "#555" }}>{mm}:{ss} elapsed</span>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-10">
          {/* Header */}
          <div className="text-center">
            <div className="text-xs font-bold tracking-widest mb-2" style={{ color: "#555" }}>NETWORK SCAN IN PROGRESS</div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--green)" }}>{netActiveSubnet}</h1>
            <p className="text-sm" style={{ color: "#718096" }}>~2–3 min for a /24 · do not close this tab</p>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-lg">
            <div className="flex justify-between text-xs mb-2" style={{ color: "#555" }}>
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00cc66,#00ff88)" }}
              />
            </div>
          </div>

          {/* Step list */}
          <div className="w-full max-w-lg space-y-3">
            {NET_STEPS.map((step, i) => {
              const isDone    = i < netStep;
              const isActive  = i === netStep;
              const isPending = i > netStep;
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-lg transition-all"
                  style={{
                    background: isActive ? "#0d1f14" : "#0d0d0d",
                    border: `1px solid ${isActive ? "#00ff8840" : isDone ? "#00ff8820" : "#1a1a1a"}`,
                  }}>
                  {/* Icon */}
                  <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mt-0.5"
                    style={{
                      background: isDone ? "#00ff8833" : isActive ? "#00ff8822" : "#1a1a1a",
                      color: isDone ? "#00ff88" : isActive ? "#00ff88" : "#555",
                      border: `1px solid ${isDone ? "#00ff8855" : isActive ? "#00ff8844" : "#2a2a2a"}`,
                    }}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: isDone ? "#00ff88" : isActive ? "#e2e8f0" : "#555" }}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="flex gap-1">
                          {[0,1,2].map(d => (
                            <span key={d} className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{
                                background: "#00ff88",
                                animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                              }} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: isPending ? "#333" : "#718096" }}>{step.detail}</div>
                  </div>
                  {/* Status */}
                  <div className="shrink-0 text-xs font-bold"
                    style={{ color: isDone ? "#00ff88" : isActive ? "#ffaa00" : "#333" }}>
                    {isDone ? "DONE" : isActive ? "RUNNING" : "WAITING"}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center" style={{ color: "#333" }}>
            Results will load automatically when the scan completes
          </p>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50%       { opacity: 1;   transform: scale(1.2); }
          }
        `}</style>
      </main>
    );
  }
  // ── End scanning screen ───────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
        <a href="/" className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </a>
        <a href="/history" className="text-xs px-3 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
          History
        </a>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2 tracking-wide">Scan Your Network</h1>
        <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
          Choose the method that fits you best. Not sure? Start with <strong style={{ color: "var(--green)" }}>Quick Checklist</strong> — no technical knowledge required.
        </p>

        {/* Contextual banner — changes per tab */}
        {(tab === "paste" || tab === "file") && (
          <div className="mb-6 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: "#0d1f14", border: "1px solid #00ff8830" }}>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: "var(--green)" }}>Have a Cisco device?</p>
              <p className="text-xs" style={{ color: "#718096" }}>
                Run <code className="px-1 py-0.5 rounded text-xs" style={{ background: "#0a0a0a", color: "#00ff88" }}>show running-config</code> on the device and paste the output, or upload the .cfg file.
                Or hit <strong style={{ color: "#e2e8f0" }}>Load sample</strong> to try a demo instantly.
              </p>
            </div>
            <button
              className="shrink-0 px-4 py-2 rounded font-bold text-xs tracking-widest"
              style={{ background: "var(--green)", color: "#000" }}
              onClick={() => { setTab("paste"); setConfigText(SAMPLE_CONFIG); }}
            >
              TRY SAMPLE →
            </button>
          </div>
        )}
        {tab === "checklist" && (
          <div className="mb-6 p-4 rounded-lg" style={{ background: "#0d1f14", border: "1px solid #00ff8830" }}>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--green)" }}>No tech knowledge needed</p>
            <p className="text-xs" style={{ color: "#718096" }}>
              Answer a few simple yes/no questions about your router settings. We&apos;ll score your security and tell you exactly what to fix — in plain English.
            </p>
          </div>
        )}
        {tab === "network" && (
          <div className="mb-6 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: "#0d1f14", border: "1px solid #00ff8830" }}>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: "var(--green)" }}>Scan every device on your network</p>
              <p className="text-xs" style={{ color: "#718096" }}>
                Download and run the NetAudit Agent on your computer — it discovers and audits all devices on your network automatically.
              </p>
            </div>
            <a
              href="https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe"
              download
              className="shrink-0 px-4 py-2 rounded font-bold text-xs tracking-widest"
              style={{ background: "var(--green)", color: "#000" }}
            >
              ↓ DOWNLOAD AGENT
            </a>
          </div>
        )}
        {tab === "live" && (
          <div className="mb-6 p-4 rounded-lg" style={{ background: "#0d1f14", border: "1px solid #00ff8830" }}>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--green)" }}>Connect directly via SSH</p>
            <p className="text-xs" style={{ color: "#718096" }}>
              Enter the IP, username and password of a Cisco device. NetAudit will SSH in, pull the running config, and audit it live. Credentials are never stored.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mb-0 overflow-x-auto" style={{ borderBottom: "1px solid #2a2a2a", scrollbarWidth: "none" }}>
          {[
            { id: "checklist", icon: "✅", label: "Quick Checklist",    sub: "No tech knowledge needed" },
            { id: "paste",     icon: "📋", label: "Paste Config",       sub: "Have a running-config?" },
            { id: "file",      icon: "📁", label: "Upload File",        sub: ".cfg · .txt · .conf" },
            { id: "network",   icon: "🌐", label: "Network Scan",       sub: "Scan whole subnet" },
            { id: "live",      icon: "🔗", label: "Live SSH Scan",      sub: "Connect directly" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className="flex flex-col items-start px-4 py-3 text-left transition-all shrink-0"
              style={{
                background: tab === t.id ? "var(--bg-card)" : "transparent",
                borderBottom: tab === t.id ? "2px solid var(--green)" : "2px solid transparent",
                color: tab === t.id ? "var(--green)" : "#718096",
                marginBottom: -1,
              }}
            >
              <span className="text-xs font-bold flex items-center gap-1">{t.icon} {t.label}</span>
              <span className="text-xs mt-0.5" style={{ color: tab === t.id ? "#718096" : "#4a5568" }}>{t.sub}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="rounded-b rounded-tr p-6" style={{ background: "var(--bg-card)", border: "1px solid #2a2a2a", borderTop: "none" }}>

          {/* Device hint (shared) */}
          {tab !== "live" && tab !== "network" && tab !== "checklist" && (
            <div className="mb-4">
              <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>
                DEVICE TYPE
              </label>
              <select
                value={deviceHint}
                onChange={e => setDeviceHint(e.target.value as DeviceType)}
                className="text-sm px-3 py-2 rounded"
                style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0", minWidth: 200 }}
              >
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
                <label className="text-xs font-bold" style={{ color: "#718096", letterSpacing: "0.1em" }}>
                  RUNNING-CONFIG
                </label>
                <button
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}
                  onClick={() => setConfigText(SAMPLE_CONFIG)}
                >
                  Load sample
                </button>
              </div>
              <textarea
                className="w-full rounded p-4 text-xs font-mono resize-none"
                style={{
                  background: "#0a0a0a", border: "1px solid #2a2a2a",
                  color: "#e2e8f0", height: 340, outline: "none",
                }}
                placeholder="Paste your Cisco running-config here..."
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* FILE TAB */}
          {tab === "file" && (
            <div
              className="rounded flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
              style={{
                height: 280,
                border: `2px dashed ${dragOver ? "var(--green)" : "#2a2a2a"}`,
                background: dragOver ? "#00ff8808" : "#0a0a0a",
              }}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.cfg,.conf,.log"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-4xl">📁</div>
              {file ? (
                <p className="text-sm font-bold" style={{ color: "var(--green)" }}>{file.name}</p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "#718096" }}>Drop your config file here or click to browse</p>
                  <p className="text-xs" style={{ color: "#4a5568" }}>.txt · .cfg · .conf</p>
                </>
              )}
            </div>
          )}

          {/* LIVE TAB */}
          {tab === "live" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>HOST / IP</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded"
                    style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                    placeholder="192.168.1.1"
                    value={liveHost}
                    onChange={e => setLiveHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>SSH PORT</label>
                  <input
                    type="number"
                    className="w-full text-sm px-3 py-2 rounded"
                    style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                    value={livePort}
                    onChange={e => setLivePort(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>USERNAME</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded"
                    style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                    placeholder="admin"
                    value={liveUser}
                    onChange={e => setLiveUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>PASSWORD</label>
                  <input
                    type="password"
                    className="w-full text-sm px-3 py-2 rounded"
                    style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                    placeholder="••••••••"
                    value={livePass}
                    onChange={e => setLivePass(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>DEVICE TYPE</label>
                  <select
                    value={liveDevType}
                    onChange={e => setLiveDevType(e.target.value as DeviceType)}
                    className="w-full text-sm px-3 py-2 rounded"
                    style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                  >
                    <option value="ios">Cisco IOS / IOS-XE</option>
                    <option value="asa">Cisco ASA</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={runNmap}
                      onChange={e => setRunNmap(e.target.checked)}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--green)" }}
                    />
                    <span className="text-sm" style={{ color: "#a0aec0" }}>Also run nmap port scan</span>
                  </label>
                </div>
              </div>
              <p className="text-xs p-3 rounded" style={{ background: "#0a0a0a", color: "#718096", border: "1px solid #2a2a2a" }}>
                Credentials are used only for this SSH session and are never stored.
                Only use against devices you own or have written authorisation to test.
              </p>
            </div>
          )}

          {/* NETWORK SCAN TAB */}
          {tab === "network" && (
            <div className="space-y-4">

              {/* Step 1 — Download & run agent */}
              <div className="p-4 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
                <div className="mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded mr-2" style={{ background: "#00ff8822", color: "#00ff88" }}>STEP 1</span>
                  <span className="text-sm font-bold">Download &amp; run the NetAudit Agent</span>
                </div>

                {/* Main download CTA */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 p-3 rounded-lg"
                  style={{ background: "#0a1a0a", border: "1px solid #00ff8830" }}>
                  <div className="flex-1">
                    <p className="text-xs font-bold mb-0.5" style={{ color: "#e2e8f0" }}>NetAudit Agent for Windows</p>
                    <p className="text-xs" style={{ color: "#718096" }}>
                      Download and double-click — single exe, no install, no zip to extract.
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#4a5568" }}>~70 MB · Free · Windows 10/11</p>
                  </div>
                  <a
                    href="https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe"
                    download
                    className="shrink-0 px-5 py-2.5 rounded font-bold text-xs tracking-widest"
                    style={{ background: "var(--green)", color: "#000" }}
                  >
                    ↓ Download Agent
                  </a>
                </div>

                <div className="flex items-start gap-2 text-xs mb-3" style={{ color: "#718096" }}>
                  <span style={{ color: "#00ff88" }}>ℹ</span>
                  <span>
                    The Agent needs to run on the <strong style={{ color: "#e2e8f0" }}>same computer that&apos;s connected to your network</strong> —
                    that&apos;s how it can reach your routers and devices. It runs quietly in your system tray.
                  </span>
                </div>

                {/* SmartScreen notice */}
                <div className="flex items-start gap-2 text-xs mb-4 p-3 rounded" style={{ background: "#1a1a2e", border: "1px solid #2d2d4e" }}>
                  <span style={{ color: "#ffaa00" }}>⚠</span>
                  <span style={{ color: "#718096" }}>
                    <strong style={{ color: "#ffaa00" }}>Windows SmartScreen warning?</strong> That&apos;s normal for new apps without a paid certificate.
                    Click <strong style={{ color: "#e2e8f0" }}>&quot;More info&quot;</strong> → <strong style={{ color: "#e2e8f0" }}>&quot;Run anyway&quot;</strong> to proceed.
                    The source code is <a href="https://github.com/figo99FG/netaudit" target="_blank" rel="noopener noreferrer" style={{ color: "#00ff88" }}>open on GitHub</a> — you can verify it yourself.
                  </span>
                </div>

                {/* Advanced toggle */}
                <button
                  className="text-xs mb-3"
                  style={{ color: "#4a5568", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => setNetShowSetup(s => !s)}
                >
                  {netShowSetup ? "▲ Hide advanced options" : "▼ Already running? Advanced options"}
                </button>

                {netShowSetup && (
                  <div className="mb-4 space-y-3 pt-2 border-t" style={{ borderColor: "#1a1a1a" }}>
                    <div>
                      <div className="text-xs mb-1 font-bold" style={{ color: "#555" }}>Docker</div>
                      <div className="flex items-center gap-2">
                        <pre className="flex-1 text-xs px-3 py-2 rounded font-mono overflow-x-auto"
                          style={{ background: "#141414", color: "#00ff88", border: "1px solid #1a1a1a" }}>
                          docker run -p 8000:8000 figo7799/netaudit-agent
                        </pre>
                        <button
                          className="shrink-0 text-xs px-3 py-2 rounded font-bold"
                          style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}
                          onClick={() => navigator.clipboard.writeText("docker run -p 8000:8000 figo7799/netaudit-agent")}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1 font-bold" style={{ color: "#555" }}>Python (from source)</div>
                      <div className="space-y-1">
                        {["cd netaudit/backend", "pip install -r requirements.txt", "uvicorn main:app --reload"].map((cmd, i) => (
                          <pre key={i} className="text-xs px-3 py-1.5 rounded font-mono"
                            style={{ background: "#141414", color: "#a0aec0", border: "1px solid #1a1a1a" }}>
                            {cmd}
                          </pre>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 text-sm px-3 py-2 rounded font-mono"
                    style={{ background: "#141414", border: `1px solid ${netPingStatus === "ok" ? "#00ff8855" : netPingStatus === "fail" ? "#ff444455" : "#2a2a2a"}`, color: "#e2e8f0" }}
                    value={netLocalUrl}
                    onChange={e => { setNetLocalUrl(e.target.value); setNetPingStatus("idle"); }}
                    placeholder="http://localhost:8000"
                  />
                  <button
                    className="shrink-0 px-4 py-2 rounded text-xs font-bold"
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e2e8f0", minWidth: 120 }}
                    onClick={async () => {
                      setNetPingStatus("checking");
                      const ok = await pingBackend(netLocalUrl);
                      setNetPingStatus(ok ? "ok" : "fail");
                    }}
                  >
                    {netPingStatus === "checking" ? "Checking..." : "Test connection"}
                  </button>
                </div>

                {netPingStatus === "ok" && (
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#00ff88" }}>
                    <span>✓</span> Connected — local backend is running
                  </p>
                )}
                {netPingStatus === "fail" && (
                  <p className="text-xs mt-2" style={{ color: "#ff6666" }}>
                    ✗ Agent not running — download and run the NetAudit Agent above, then click Test connection
                  </p>
                )}
              </div>

              {/* Step 2 — Scan config */}
              <div className="p-4 rounded-lg" style={{ background: "#0a0a0a", border: `1px solid ${netPingStatus === "ok" ? "#2a2a2a" : "#1a1a1a"}`, opacity: netPingStatus === "ok" ? 1 : 0.45 }}>
                <div className="mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded mr-2" style={{ background: "#00ff8822", color: "#00ff88" }}>STEP 2</span>
                  <span className="text-sm font-bold">Configure scan</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>SUBNET / RANGE</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded font-mono"
                      style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                      placeholder="192.168.0.0/24"
                      value={netSubnet}
                      onChange={e => setNetSubnet(e.target.value)}
                      disabled={netPingStatus !== "ok"}
                    />
                    <p className="text-xs mt-1" style={{ color: "#4a5568" }}>CIDR (192.168.0.0/24) · range (192.168.0.1-50) · single IP</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>USERNAME</label>
                    <input
                      className="w-full text-sm px-3 py-2 rounded"
                      style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                      placeholder="admin"
                      value={netUser}
                      onChange={e => setNetUser(e.target.value)}
                      disabled={netPingStatus !== "ok"}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>PASSWORD</label>
                    <input
                      type="password"
                      className="w-full text-sm px-3 py-2 rounded"
                      style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                      placeholder="••••••••"
                      value={netPass}
                      onChange={e => setNetPass(e.target.value)}
                      disabled={netPingStatus !== "ok"}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: "#718096", letterSpacing: "0.1em" }}>SSH PORT</label>
                    <input
                      type="number"
                      className="w-full text-sm px-3 py-2 rounded"
                      style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#e2e8f0" }}
                      value={netSshPort}
                      onChange={e => setNetSshPort(Number(e.target.value))}
                      disabled={netPingStatus !== "ok"}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs px-1" style={{ color: "#4a5568" }}>
                Only use against networks you own or have written authorisation to test.
              </p>
            </div>
          )}

          {/* CHECKLIST TAB */}
          {tab === "checklist" && (() => {
            const answered = Object.keys(checklistAnswers).filter(k => checklistAnswers[k] !== null).length;
            const total = CHECKLIST_QUESTIONS.length;

            if (checklistDone) {
              // Calculate score from answers
              let deductions = 0;
              const findings = CHECKLIST_QUESTIONS.filter(q => {
                const ans = checklistAnswers[q.id];
                return q.yes_bad ? ans === true : ans === false;
              });
              findings.forEach(q => { deductions += q.weight; });
              const score = Math.max(0, 100 - deductions);
              const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
              const gradeColor = score >= 75 ? "#00ff88" : score >= 50 ? "#ffaa00" : "#ff4444";

              return (
                <div>
                  <div className="flex items-center gap-6 mb-6 p-4 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
                    <div className="text-center">
                      <div className="text-4xl font-bold" style={{ color: gradeColor }}>{score}</div>
                      <div className="text-xs" style={{ color: "#718096" }}>/100</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: gradeColor }}>Grade {grade}</div>
                      <div className="text-sm" style={{ color: "#718096" }}>{findings.length} issue{findings.length !== 1 ? "s" : ""} found</div>
                    </div>
                  </div>

                  {findings.length === 0 ? (
                    <p className="text-sm p-4 rounded" style={{ background: "#00ff8811", color: "#00ff88", border: "1px solid #00ff8833" }}>
                      Your router looks well configured. Keep firmware updated and check back periodically.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {findings.map(q => (
                        <div key={q.id} className="p-4 rounded-lg" style={{ background: "#0a0a0a", border: `1px solid ${SEV_COLORS[q.severity]}33` }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${SEV_COLORS[q.severity]}22`, color: SEV_COLORS[q.severity] }}>
                              {q.severity.toUpperCase()}
                            </span>
                            <span className="text-sm font-bold">{q.question}</span>
                          </div>
                          <p className="text-xs mb-2" style={{ color: "#718096" }}>{q.detail}</p>
                          <p className="text-xs p-2 rounded font-mono" style={{ background: "#141414", color: "#00ff88" }}>
                            Fix: {REMEDIATIONS[q.id]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="mt-4 text-xs px-3 py-2 rounded"
                    style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}
                    onClick={() => { setChecklistAnswers({}); setChecklistDone(false); }}
                  >
                    ← Retake checklist
                  </button>
                </div>
              );
            }

            return (
              <div>
                <p className="text-sm mb-4" style={{ color: "#718096" }}>
                  Answer these questions about your router settings. No config file needed — works with any router.
                </p>
                <div className="text-xs mb-4" style={{ color: "#4a5568" }}>{answered}/{total} answered</div>
                <div className="space-y-3">
                  {CHECKLIST_QUESTIONS.map(q => (
                    <div key={q.id} className="p-3 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold" style={{ color: SEV_COLORS[q.severity] }}>{q.severity.toUpperCase()}</span>
                        <span className="text-sm">{q.question}</span>
                      </div>
                      <div className="flex gap-2">
                        {(["yes", "no", "unsure"] as const).map(opt => {
                          const val = opt === "yes" ? true : opt === "no" ? false : null;
                          const isSelected = checklistAnswers[q.id] === val || (opt === "unsure" && !(q.id in checklistAnswers));
                          return (
                            <button
                              key={opt}
                              className="px-3 py-1 rounded text-xs font-bold transition-all"
                              style={{
                                background: checklistAnswers[q.id] === val ? (opt === "yes" ? "#ff444422" : opt === "no" ? "#00ff8822" : "#ffffff11") : "#1a1a1a",
                                color: checklistAnswers[q.id] === val ? (opt === "yes" ? "#ff4444" : opt === "no" ? "#00ff88" : "#888") : "#718096",
                                border: `1px solid ${checklistAnswers[q.id] === val ? (opt === "yes" ? "#ff444466" : opt === "no" ? "#00ff8866" : "#444") : "#2a2a2a"}`,
                              }}
                              onClick={() => setChecklistAnswers(prev => ({ ...prev, [q.id]: val }))}
                            >
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setChecklistDone(true)}
                    disabled={answered < 5}
                    className="px-8 py-3 rounded font-bold text-sm tracking-widest disabled:opacity-40"
                    style={{ background: "var(--green)", color: "#000" }}
                  >
                    SEE MY SCORE →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded flex items-start gap-3" style={{ background: "#1a0a0a", color: "#ff6666", border: "1px solid #ff444455" }}>
              <span className="text-lg shrink-0">⚠</span>
              <div>
                <div className="text-sm font-bold mb-0.5">Scan failed</div>
                <div className="text-xs" style={{ color: "#ff9999" }}>{error}</div>
              </div>
            </div>
          )}

          {/* Submit */}
          {tab !== "checklist" && (
            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
              {/* AI toggle — only on paste/file tabs */}
              {(tab === "paste" || tab === "file") && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!hasApiKey) { setShowSettings(true); return; }
                      setAiMode(m => !m);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all"
                    style={{
                      background: aiMode ? "#0a1a0a" : "#111",
                      border: `1px solid ${aiMode ? "var(--green)" : "#2a2a2a"}`,
                      color: aiMode ? "var(--green)" : "#555",
                    }}
                  >
                    <span>◆</span>
                    <span>{aiMode ? "AI mode ON" : "AI mode"}</span>
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-2 py-1.5 rounded text-xs transition-all"
                    style={{ background: "#111", border: "1px solid #2a2a2a", color: "#555" }}
                    title="AI Settings"
                  >
                    ⚙
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 ml-auto">
                {tab === "network" && netPingStatus !== "ok" && (
                  <span className="text-xs" style={{ color: "#555" }}>Connect to local backend first</span>
                )}
                <button
                  onClick={submit}
                  disabled={loading || (tab === "network" && netPingStatus !== "ok")}
                  className="px-8 py-3 rounded font-bold text-sm tracking-widest transition-all disabled:opacity-40"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  {loading
                    ? tab === "network" ? "SCANNING NETWORK..." : (aiMode ? "AI SCANNING..." : "SCANNING...")
                    : tab === "network" ? "SCAN NETWORK" : (aiMode ? "AI ANALYZE" : "ANALYZE")}
                </button>
              </div>
            </div>
          )}

          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
            onSaved={() => setHasApiKey(true)}
          />
        </div>
      </div>
    </main>
  );
}
