"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ScanResult, Severity } from "@/lib/api";
import { getResult } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import FindingCard from "@/components/FindingCard";

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEV_COLORS: Record<Severity, string> = {
  critical: "#ff4444",
  high: "#ff7700",
  medium: "#ffaa00",
  low: "#4da6ff",
  info: "#718096",
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = searchParams.get("data");
    if (raw) {
      try {
        setResult(JSON.parse(decodeURIComponent(raw)));
        setLoading(false);
        return;
      } catch { /* fall through to fetch */ }
    }
    getResult(id)
      .then(r => { setResult(r); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, searchParams]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `netaudit-${result.hostname ?? id}.json`;
    a.click();
  };

  const exportPdf = async () => {
    if (!result) return;
    const { exportPDF } = await import("@/lib/pdf");
    await exportPDF(result);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-sm" style={{ color: "var(--green)" }}>Scanning...</p>
    </div>
  );

  if (error || !result) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
      <p style={{ color: "#ff4444" }}>{error || "Result not found"}</p>
      <Link href="/scan" className="text-sm" style={{ color: "var(--green)" }}>← New scan</Link>
    </div>
  );

  const filtered = filter === "all" ? result.findings : result.findings.filter(f => f.severity === filter);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#2a2a2a" }}>
        <a href="/" className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </a>
        <div className="flex items-center gap-3">
          <button onClick={exportPdf} className="text-xs px-3 py-2 rounded font-bold transition-all" style={{ background: "var(--green)", color: "#000" }}>
            Export PDF
          </button>
          <button onClick={exportJson} className="text-xs px-3 py-2 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
            Export JSON
          </button>
          <Link href="/scan" className="text-xs px-3 py-2 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
            New Scan
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex flex-wrap items-start gap-6 mb-10">
          <ScoreGauge score={result.score} grade={result.grade} size={180} />
          <div className="flex-1 min-w-60">
            <h1 className="text-2xl font-bold mb-1">
              {result.hostname ?? "Unknown Device"}
            </h1>
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
                {result.device_type.toUpperCase()}
              </span>
              {result.ios_version && (
                <span className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
                  IOS {result.ios_version}
                </span>
              )}
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
                {result.findings.length} findings
              </span>
            </div>

            {/* Summary bars */}
            <div className="space-y-2">
              {SEV_ORDER.map(sev => {
                const count = result.summary[sev];
                if (count === 0) return null;
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="text-xs w-16 font-bold uppercase" style={{ color: SEV_COLORS[sev] }}>{sev}</span>
                    <div className="flex-1 rounded-full h-2" style={{ background: "#2a2a2a" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / result.findings.length) * 100)}%`, background: SEV_COLORS[sev] }}
                      />
                    </div>
                    <span className="text-xs font-bold w-6 text-right" style={{ color: SEV_COLORS[sev] }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", ...SEV_ORDER] as const).map(sev => {
            const count = sev === "all" ? result.findings.length : result.summary[sev];
            if (sev !== "all" && count === 0) return null;
            return (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className="text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all"
                style={{
                  background: filter === sev ? (sev === "all" ? "var(--green)" : SEV_COLORS[sev]) + "22" : "#1a1a1a",
                  color: filter === sev ? (sev === "all" ? "var(--green)" : SEV_COLORS[sev]) : "#718096",
                  border: `1px solid ${filter === sev ? (sev === "all" ? "var(--green)" : SEV_COLORS[sev]) : "#2a2a2a"}`,
                }}
              >
                {sev} ({count})
              </button>
            );
          })}
        </div>

        {/* Findings */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "#718096" }}>No findings at this severity.</p>
          ) : (
            filtered.map((f, i) => <FindingCard key={f.rule_id + i} finding={f} index={i} />)
          )}
        </div>
      </div>
    </main>
  );
}
