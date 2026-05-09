"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getNetworkResult, type NetworkScanResult, type NetworkHostResult } from "@/lib/api";

const SEV_COLOR: Record<string, string> = {
  critical: "#ff4444", high: "#ff7700", medium: "#ffaa00", low: "#4488ff", info: "#888",
};

function gradeColor(score?: number) {
  if (score == null) return "#555";
  if (score >= 75) return "#00ff88";
  if (score >= 50) return "#ffaa00";
  return "#ff4444";
}

function HostCard({ host }: { host: NetworkHostResult }) {
  const [open, setOpen] = useState(false);
  const gc = gradeColor(host.score);
  const topFindings = host.findings.slice(0, 3);

  return (
    <div
      className="rounded-lg p-4 cursor-pointer transition-all"
      style={{ background: "#0d0d0d", border: `1px solid ${open ? "#2a2a2a" : "#1a1a1a"}` }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Score */}
        <div className="text-center shrink-0" style={{ minWidth: 56 }}>
          {host.score != null ? (
            <>
              <div className="text-2xl font-bold" style={{ color: gc }}>{host.score}</div>
              <div className="text-xs font-bold" style={{ color: gc }}>{host.grade}</div>
            </>
          ) : (
            <div className="text-sm" style={{ color: "#555" }}>N/A</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{host.hostname || host.ip}</div>
          {host.hostname && host.hostname !== host.ip && (
            <div className="text-xs" style={{ color: "#718096" }}>{host.ip}</div>
          )}
          <div className="flex gap-2 mt-1 flex-wrap">
            {host.device_type && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#888" }}>
                {host.device_type}
              </span>
            )}
            {host.method && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#0a1a0a", color: "#00ff8888" }}>
                {host.method}
              </span>
            )}
            {host.open_ports.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#718096" }}>
                ports: {host.open_ports.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Top findings preview */}
        <div className="hidden sm:flex gap-1 flex-wrap justify-end shrink-0" style={{ maxWidth: 240 }}>
          {topFindings.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ background: `${SEV_COLOR[f.severity]}22`, color: SEV_COLOR[f.severity] }}>
              {f.severity.toUpperCase()}
            </span>
          ))}
          {host.findings.length > 3 && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#555" }}>
              +{host.findings.length - 3}
            </span>
          )}
          {host.error && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#ff444422", color: "#ff6666" }}>ERR</span>
          )}
        </div>

        <div className="text-xs shrink-0" style={{ color: "#555" }}>{open ? "▲" : "▼"}</div>
      </div>

      {/* Expanded findings */}
      {open && (
        <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "#1a1a1a" }}>
          {host.error && (
            <p className="text-xs p-2 rounded" style={{ background: "#ff444411", color: "#ff6666" }}>{host.error}</p>
          )}
          {host.findings.length === 0 && !host.error && (
            <p className="text-xs" style={{ color: "#4a5568" }}>No issues found.</p>
          )}
          {host.findings.map((f, i) => (
            <div key={i} className="p-3 rounded" style={{ background: "#141414", border: `1px solid ${SEV_COLOR[f.severity]}33` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: `${SEV_COLOR[f.severity]}22`, color: SEV_COLOR[f.severity] }}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-sm font-bold">{f.title}</span>
              </div>
              <p className="text-xs mb-2" style={{ color: "#718096" }}>{f.description}</p>
              {f.remediation_snippet && (
                <pre className="text-xs p-2 rounded font-mono overflow-x-auto"
                  style={{ background: "#0a0a0a", color: "#00ff88" }}>
                  {f.remediation_snippet}
                </pre>
              )}
            </div>
          ))}
          {host.scan_id && (
            <a
              href={`/results/${host.scan_id}`}
              className="inline-block text-xs mt-2 px-3 py-1 rounded"
              style={{ background: "#1a1a1a", color: "var(--green)", border: "1px solid #2a2a2a" }}
              onClick={e => e.stopPropagation()}
            >
              Full report for this device →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function NetworkResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<NetworkScanResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check sessionStorage first (local backend scans store result here)
    try {
      const cached = sessionStorage.getItem(`net_${id}`);
      if (cached) {
        setResult(JSON.parse(cached));
        return;
      }
    } catch { /* ignore */ }
    // Fall back to Railway API
    getNetworkResult(id)
      .then(setResult)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-red-400">{error}</p>
    </main>
  );

  if (!result) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-3">
        <div className="text-2xl" style={{ color: "var(--green)" }}>Scanning...</div>
        <p className="text-sm" style={{ color: "#718096" }}>Discovering and analysing hosts on the network</p>
      </div>
    </main>
  );

  const gc = gradeColor(result.avg_score);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
        <a href="/" className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </a>
        <a href="/scan" className="text-xs px-3 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
          + New scan
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: "#555" }}>NETWORK SCAN</div>
        <h1 className="text-2xl font-bold mb-1">{result.subnet}</h1>
        <p className="text-sm mb-8" style={{ color: "#718096" }}>
          {result.hosts_found} host{result.hosts_found !== 1 ? "s" : ""} discovered &middot; {result.hosts_scanned} scanned
        </p>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "AVG SCORE",      value: result.avg_score,      color: gc },
            { label: "HOSTS FOUND",    value: result.hosts_found,    color: "#e2e8f0" },
            { label: "CRITICAL",       value: result.total_critical,  color: result.total_critical > 0 ? "#ff4444" : "#555" },
            { label: "HIGH",           value: result.total_high,      color: result.total_high > 0 ? "#ff7700" : "#555" },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-lg text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <div className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs mt-1 font-bold tracking-widest" style={{ color: "#555" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Host list */}
        <div className="space-y-3">
          {result.hosts.map(host => (
            <HostCard key={host.ip} host={host} />
          ))}
        </div>
      </div>
    </main>
  );
}
