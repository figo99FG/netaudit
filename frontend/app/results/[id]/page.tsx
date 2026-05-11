"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ScanResult, Severity, ScanEnrichment } from "@/lib/api";
import { getResult, enrichScan } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import FindingCard from "@/components/FindingCard";
import ConfigChat from "@/components/ConfigChat";
import SettingsModal from "@/components/SettingsModal";

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
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enrichment, setEnrichment] = useState<ScanEnrichment | null>(null);
  const [enriching, setEnriching] = useState(false);

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
      .then(r => {
        setResult(r);
        setLoading(false);
        // Use cached enrichment if stored with the result
        if (r.enrichment) setEnrichment(r.enrichment);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, searchParams]);

  // Auto-fetch enrichment once result is loaded
  useEffect(() => {
    if (!result || enrichment) return;
    setEnriching(true);
    enrichScan(id)
      .then(e => { setEnrichment(e); setEnriching(false); })
      .catch(() => setEnriching(false)); // silently fail — no API key or agent down
  }, [result, id, enrichment]);

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
          <Link href="/history" className="text-xs px-3 py-2 rounded" style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}>
            History
          </Link>
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

        {/* AI Enrichment */}
        {enriching && !enrichment && (
          <div className="mb-6 px-4 py-3 rounded-lg flex items-center gap-2 text-xs"
            style={{ background: "#0a1a0a", border: "1px solid #00ff8822", color: "#718096" }}>
            <span className="animate-pulse" style={{ color: "var(--green)" }}>◆</span>
            AI is analysing your results…
          </div>
        )}

        {enrichment && (
          <div className="mb-8 space-y-4">
            {/* Executive summary */}
            <div className="p-5 rounded-xl" style={{ background: "#0a1a0a", border: "1px solid #00ff8833" }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: "var(--green)" }}>◆</span>
                <span className="text-xs font-bold tracking-widest" style={{ color: "var(--green)" }}>AI SUMMARY</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>{enrichment.executive_summary}</p>
            </div>

            {/* Action plan */}
            {enrichment.action_plan.length > 0 && (
              <div className="p-5 rounded-xl" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span style={{ color: "var(--green)" }}>◆</span>
                  <span className="text-xs font-bold tracking-widest" style={{ color: "#718096" }}>ACTION PLAN — fix in this order</span>
                </div>
                <div className="space-y-3">
                  {enrichment.action_plan.map(item => (
                    <div key={item.priority} className="flex gap-4 items-start">
                      <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "#1a1a1a", color: "var(--green)", border: "1px solid #2a2a2a" }}>
                        {item.priority}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{item.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded" style={{
                            background: item.effort === "low" ? "#0a1a0a" : item.effort === "high" ? "#1a0a0a" : "#1a1a0a",
                            color: item.effort === "low" ? "#00ff88" : item.effort === "high" ? "#ff6666" : "#ffaa00",
                          }}>
                            {item.effort} effort
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "#718096" }}>{item.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
            filtered.map((f, i) => (
              <FindingCard
                key={f.rule_id + i}
                finding={f}
                index={i}
                tailoredRemediation={enrichment?.tailored_remediations?.[f.rule_id]}
              />
            ))
          )}
        </div>

        {/* Chat */}
        <div className="mt-10">
          <button
            onClick={() => setShowChat(c => !c)}
            className="flex items-center gap-2 text-sm font-bold mb-4 transition-opacity hover:opacity-80"
            style={{ color: showChat ? "var(--green)" : "#555" }}
          >
            <span style={{ color: "var(--green)" }}>◆</span>
            {showChat ? "Hide AI chat" : "Chat with your config"}
            <span className="text-xs px-2 py-0.5 rounded ml-1" style={{ background: "#1a1a1a", color: "#555" }}>AI</span>
          </button>

          {showChat && (
            <div className="space-y-3">
              <ConfigChat scanId={id} />
              <p className="text-xs" style={{ color: "#4a5568" }}>
                No API key?{" "}
                <button onClick={() => setShowSettings(true)} style={{ color: "var(--green)" }}>
                  Add one in Settings →
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </main>
  );
}
