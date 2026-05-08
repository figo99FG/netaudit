"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DeviceType } from "@/lib/api";
import { analyzeConfig, analyzeFile, liveScan } from "@/lib/api";

type Tab = "paste" | "file" | "live";

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

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm px-4 py-3 rounded" style={{ background: "#ff444411", color: "#ff6666", border: "1px solid #ff444433" }}>
              {error}
            </p>
          )}

          {/* Submit */}
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
        </div>
      </div>
    </main>
  );
}
