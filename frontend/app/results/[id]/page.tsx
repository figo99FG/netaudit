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
  high:     "#ff7700",
  medium:   "#ffaa00",
  low:      "#4da6ff",
  info:     "#718096",
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [filter, setFilter]       = useState<Severity | "all">("all");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showChat, setShowChat]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enrichment, setEnrichment]     = useState<ScanEnrichment | null>(null);
  const [enriching, setEnriching]       = useState(false);

  useEffect(() => {
    const raw = searchParams.get("data");
    if (raw) {
      try {
        setResult(JSON.parse(decodeURIComponent(raw)));
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }
    getResult(id)
      .then(r => {
        setResult(r);
        setLoading(false);
        if (r.enrichment) setEnrichment(r.enrichment);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, searchParams]);

  useEffect(() => {
    if (!result || enrichment) return;
    setEnriching(true);
    enrichScan(result)
      .then(e => { setEnrichment(e); setEnriching(false); })
      .catch(() => setEnriching(false));
  }, [result, enrichment]);

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
      <div className="text-center space-y-3">
        <div className="text-sm font-bold tracking-widest animate-pulse"
          style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>
          SCANNING…
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fetching results</p>
      </div>
    </div>
  );

  if (error || !result) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
      <p style={{ color: "var(--critical)" }}>{error || "Result not found"}</p>
      <Link href="/scan" className="text-sm hover:opacity-80" style={{ color: "var(--green)" }}>← New scan</Link>
    </div>
  );

  const filtered = filter === "all"
    ? result.findings
    : result.findings.filter(f => f.severity === filter);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Nav */}
      <nav className="nav-glass border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ borderColor: "var(--border)" }}>
        <a href="/" className="font-bold text-lg tracking-widest hover:opacity-80"
          style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}>
          NET<span style={{ color: "var(--text)" }}>AUDIT</span>
        </a>
        <div className="flex items-center gap-2">
          <button onClick={exportPdf}
            className="text-xs px-3 py-2 rounded font-bold hover:opacity-90"
            style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
            Export PDF
          </button>
          <button onClick={exportJson}
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            Export JSON
          </button>
          <Link href="/history"
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            History
          </Link>
          <Link href="/scan"
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            + New Scan
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header: gauge + summary */}
        <div className="flex flex-wrap items-start gap-8 mb-10 p-6 rounded-2xl"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <ScoreGauge score={result.score} grade={result.grade} size={180} />
          <div className="flex-1 min-w-60 py-2">
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              {result.hostname ?? "Unknown Device"}
            </h1>
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                result.device_type.toUpperCase(),
                ...(result.ios_version ? [`IOS ${result.ios_version}`] : []),
                `${result.findings.length} findings`,
              ].map(label => (
                <span key={label} className="text-xs px-2.5 py-1 rounded-md"
                  style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="space-y-2.5">
              {SEV_ORDER.map(sev => {
                const count = result.summary[sev];
                if (count === 0) return null;
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="text-xs w-16 font-bold uppercase tracking-widest"
                      style={{ color: SEV_COLORS[sev], fontFamily: "var(--font-mono)" }}>
                      {sev}
                    </span>
                    <div className="flex-1 rounded-full h-1.5" style={{ background: "var(--bg-card)" }}>
                      <div className="h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (count / result.findings.length) * 100)}%`, background: SEV_COLORS[sev], transition: "width 0.8s ease" }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right"
                      style={{ color: SEV_COLORS[sev], fontFamily: "var(--font-mono)" }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI enrichment — loading */}
        {enriching && !enrichment && (
          <div className="mb-6 px-4 py-3 rounded-lg flex items-center gap-3 text-sm"
            style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.14)", color: "var(--text-muted)" }}>
            <span className="animate-pulse" style={{ color: "var(--green)" }}>◆</span>
            AI is analysing your results…
          </div>
        )}

        {/* AI enrichment — output */}
        {enrichment && (
          <div className="mb-8 space-y-4">
            <div className="p-5 rounded-xl glow-green"
              style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.18)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: "var(--green)" }}>◆</span>
                <span className="text-xs font-bold tracking-widest"
                  style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                  AI SUMMARY
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {enrichment.executive_summary}
              </p>
            </div>

            {enrichment.action_plan.length > 0 && (
              <div className="p-5 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-5">
                  <span style={{ color: "var(--green)" }}>◆</span>
                  <span className="text-xs font-bold tracking-widest"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    ACTION PLAN — fix in this order
                  </span>
                </div>
                <div className="space-y-4">
                  {enrichment.action_plan.map(item => (
                    <div key={item.priority} className="flex gap-4 items-start">
                      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "var(--bg-card)", color: "var(--green)", border: "1px solid var(--border-mid)", fontFamily: "var(--font-mono)" }}>
                        {item.priority}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold"
                            style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
                            {item.title}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md"
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              background: item.effort === "low" ? "rgba(0,255,136,0.08)" : item.effort === "high" ? "rgba(255,68,68,0.08)" : "rgba(255,170,0,0.08)",
                              color: item.effort === "low" ? "#00ff88" : item.effort === "high" ? "#ff6666" : "#ffaa00",
                            }}>
                            {item.effort} effort
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{item.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(["all", ...SEV_ORDER] as const).map(sev => {
            const count = sev === "all" ? result.findings.length : result.summary[sev];
            if (sev !== "all" && count === 0) return null;
            const active = filter === sev;
            const col = sev === "all" ? "var(--green)" : SEV_COLORS[sev];
            return (
              <button key={sev} onClick={() => setFilter(sev)}
                className="text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-widest"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: active ? `${col === "var(--green)" ? "rgba(0,255,136" : col.replace(")", "")}${col.startsWith("var") ? ",0.1)" : ",0.08)"}` : "var(--bg-card)",
                  color: active ? col : "var(--text-muted)",
                  border: `1px solid ${active ? (col.startsWith("var") ? "rgba(0,255,136,0.4)" : col + "44") : "var(--border)"}`,
                  transition: "all 160ms ease",
                }}>
                {sev} ({count})
              </button>
            );
          })}
        </div>

        {/* Findings */}
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: "var(--text-muted)" }}>
              No findings at this severity.
            </p>
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
        <div className="mt-12">
          <button onClick={() => setShowChat(c => !c)}
            className="flex items-center gap-2 text-sm font-semibold mb-5 hover:opacity-80"
            style={{ color: showChat ? "var(--green)" : "var(--text-muted)", fontFamily: "var(--font-heading)" }}>
            <span style={{ color: "var(--green)" }}>◆</span>
            {showChat ? "Hide AI chat" : "Chat with your config"}
            <span className="text-xs px-2 py-0.5 rounded ml-1"
              style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
              AI
            </span>
          </button>
          {showChat && (
            <ConfigChat
              scanId={id}
              hostname={result.hostname}
              deviceType={result.device_type}
              score={result.score}
              grade={result.grade}
              findings={result.findings}
            />
          )}
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onSaved={() => {}} />
    </main>
  );
}
