"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DeviceType } from "@/lib/api";
import { analyzeConfig, analyzeFile, liveScan } from "@/lib/api";

type Tab = "paste" | "file" | "live" | "checklist";

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
  const [tab, setTab] = useState<Tab>("paste");
  const [configText, setConfigText] = useState("");
  const [deviceHint, setDeviceHint] = useState<DeviceType>("auto");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
        result = await analyzeConfig(configText, deviceHint);
      } else if (tab === "file") {
        if (!file) throw new Error("Select a file first.");
        result = await analyzeFile(file, deviceHint);
      } else {
        if (!liveHost || !liveUser || !livePass) throw new Error("Host, username, and password are required.");
        result = await liveScan({
          host: liveHost, port: livePort,
          username: liveUser, password: livePass,
          device_type: liveDevType, run_nmap: runNmap,
        });
      }
      router.push(`/results/${result.scan_id}?data=${encodeURIComponent(JSON.stringify(result))}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
        <a href="/" className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </a>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>SECURITY CONFIG ANALYZER</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2 tracking-wide">Analyze Config</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Paste a running-config, upload a file, or connect directly to a device.
        </p>

        {/* New user quickstart banner */}
        <div className="mb-6 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: "#0d1f14", border: "1px solid #00ff8830" }}>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--green)" }}>Never done this before?</p>
            <p className="text-xs" style={{ color: "#718096" }}>
              On a Cisco device, run <code className="px-1 py-0.5 rounded text-xs" style={{ background: "#0a0a0a", color: "#00ff88" }}>show running-config</code> and paste the output below.
              Or hit <strong style={{ color: "#e2e8f0" }}>Load sample</strong> to see what a scan looks like instantly.
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

        {/* Tabs */}
        <div className="flex gap-0 mb-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
          <button style={tabStyle("paste")} onClick={() => setTab("paste")}>PASTE CONFIG</button>
          <button style={tabStyle("file")} onClick={() => setTab("file")}>UPLOAD FILE</button>
          <button style={tabStyle("live")} onClick={() => setTab("live")}>LIVE SCAN (SSH)</button>
          <button style={tabStyle("checklist")} onClick={() => setTab("checklist")}>QUICK CHECKLIST</button>
        </div>

        {/* Panel */}
        <div className="rounded-b rounded-tr p-6" style={{ background: "var(--bg-card)", border: "1px solid #2a2a2a", borderTop: "none" }}>

          {/* Device hint (shared) */}
          {tab !== "live" && (
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
            <p className="mt-4 text-sm px-4 py-3 rounded" style={{ background: "#ff444411", color: "#ff6666", border: "1px solid #ff444433" }}>
              {error}
            </p>
          )}

          {/* Submit */}
          {tab !== "checklist" && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={submit}
                disabled={loading}
                className="px-8 py-3 rounded font-bold text-sm tracking-widest transition-all disabled:opacity-40"
                style={{ background: "var(--green)", color: "#000" }}
              >
                {loading ? "SCANNING..." : "ANALYZE"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
