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
  if (score == null) return "var(--text-dim)";
  if (score >= 90)   return "#00ff88";
  if (score >= 75)   return "#44dd88";
  if (score >= 60)   return "#ffaa00";
  if (score >= 40)   return "#ff7700";
  return "#ff4444";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
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

      {/* Nav */}
      <nav className="nav-glass border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ borderColor: "var(--border)" }}>
        <a href="/" className="font-bold text-lg tracking-widest hover:opacity-80"
          style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}>
          NET<span style={{ color: "var(--text)" }}>AUDIT</span>
        </a>
        <a href="/scan" className="text-xs px-3 py-2 rounded font-bold hover:opacity-90"
          style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
          + New Scan
        </a>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-xs font-bold tracking-widest mb-2"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          SCAN HISTORY
        </p>
        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: "var(--font-heading)" }}>
          Past scans
        </h1>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        )}

        {agentDown && (
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="font-semibold mb-1" style={{ color: "var(--critical)", fontFamily: "var(--font-heading)" }}>
              Agent not running
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>
              History is stored locally by the agent. Start the NetAudit Agent, then reload this page.
            </p>
            <a href="/scan"
              className="inline-block text-xs px-4 py-2 rounded font-bold hover:opacity-90"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
              Back to scan →
            </a>
          </div>
        )}

        {!loading && !agentDown && entries.length === 0 && (
          <div className="p-10 rounded-xl text-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>No scans yet.</p>
            <a href="/scan" className="text-sm font-semibold hover:opacity-80"
              style={{ color: "var(--green)" }}>
              Run your first scan →
            </a>
          </div>
        )}

        {!loading && !agentDown && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map(e => {
              const href  = e.type === "network" ? `/network/${e.scan_id}` : `/results/${e.scan_id}`;
              const label = e.type === "network"
                ? (e.subnet ?? "Network scan")
                : (e.hostname ?? e.device_type ?? "Config scan");
              const gc = gradeColor(e.score);

              return (
                <a key={e.scan_id} href={href}
                  className="card-hover flex items-center gap-5 p-4 rounded-xl no-underline"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", display: "flex", textDecoration: "none" }}>

                  {/* Score badge */}
                  <div className="text-center shrink-0" style={{ minWidth: 52 }}>
                    {e.score != null ? (
                      <>
                        <div className="text-xl font-bold" style={{ color: gc, fontFamily: "var(--font-heading)" }}>
                          {e.score}
                        </div>
                        {e.grade && (
                          <div className="text-xs font-bold" style={{ color: gc, fontFamily: "var(--font-mono)" }}>
                            {e.grade}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm" style={{ color: "var(--text-dim)" }}>—</div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 shrink-0" style={{ background: "var(--border)" }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate mb-1"
                      style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
                      {label}
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-md"
                        style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                        {e.type === "network" ? `${e.hosts_found ?? "?"} hosts` : (e.device_type ?? "config")}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {timeAgo(e.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>→</div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
