"use client";
import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface HistoryEntry {
  scan_id: string;
  created_at: string;
  type: "single" | "network";
  hostname?: string;
  subnet?: string;
  score?: number;
  grade?: string;
  device_type?: string;
  hosts_found?: number;
}

function gradeColor(score?: number) {
  if (score == null) return "#555";
  if (score >= 90) return "#00ff88";
  if (score >= 75) return "#00cc66";
  if (score >= 60) return "#ffaa00";
  if (score >= 40) return "#ff7700";
  return "#ff4444";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentDown, setAgentDown] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/history`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => { setAgentDown(true); setLoading(false); });
  }, []);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
        <a href="/" className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </a>
        <div className="flex gap-3">
          <a href="/scan" className="text-xs px-3 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
            + New scan
          </a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: "#555" }}>SCAN HISTORY</div>
        <h1 className="text-2xl font-bold mb-6">Past scans</h1>

        {loading && (
          <p className="text-sm" style={{ color: "#718096" }}>Loading…</p>
        )}

        {agentDown && (
          <div className="p-4 rounded-lg" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <p className="text-sm font-bold mb-1" style={{ color: "#ff6666" }}>Agent not running</p>
            <p className="text-xs" style={{ color: "#718096" }}>
              History is stored locally by the agent. Start the NetAudit Agent, then reload this page.
            </p>
            <a href="/scan" className="inline-block mt-3 text-xs px-3 py-1.5 rounded font-bold"
              style={{ background: "var(--green)", color: "#000" }}>
              Back to scan →
            </a>
          </div>
        )}

        {!loading && !agentDown && entries.length === 0 && (
          <div className="p-4 rounded-lg text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <p className="text-sm mb-1" style={{ color: "#718096" }}>No scans yet.</p>
            <a href="/scan" className="text-xs" style={{ color: "var(--green)" }}>Run your first scan →</a>
          </div>
        )}

        {!loading && !agentDown && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map(e => {
              const href = e.type === "network"
                ? `/network/${e.scan_id}`
                : `/results/${e.scan_id}`;
              const label = e.type === "network"
                ? (e.subnet ?? "Network scan")
                : (e.hostname ?? e.device_type ?? "Config scan");

              return (
                <a
                  key={e.scan_id}
                  href={href}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg transition-colors hover:border-gray-600"
                  style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", display: "flex", textDecoration: "none" }}
                >
                  {/* Score badge */}
                  <div className="text-center shrink-0" style={{ minWidth: 48 }}>
                    {e.score != null ? (
                      <>
                        <div className="text-xl font-bold" style={{ color: gradeColor(e.score) }}>{e.score}</div>
                        {e.grade && <div className="text-xs font-bold" style={{ color: gradeColor(e.score) }}>{e.grade}</div>}
                      </>
                    ) : (
                      <div className="text-xs" style={{ color: "#555" }}>—</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: "#e2e8f0" }}>{label}</div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#888" }}>
                        {e.type === "network" ? `${e.hosts_found ?? "?"} hosts` : (e.device_type ?? "config")}
                      </span>
                      <span className="text-xs" style={{ color: "#4a5568" }}>{timeAgo(e.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-xs shrink-0" style={{ color: "#555" }}>→</div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
