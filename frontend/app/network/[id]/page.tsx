"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getNetworkResult, type NetworkScanResult, type NetworkHostResult } from "@/lib/api";

const SEV_COLOR: Record<string, string> = {
  critical: "#ff4444", high: "#ff7700", medium: "#ffaa00", low: "#4da6ff", info: "#718096",
};

function gradeColor(score?: number) {
  if (score == null) return "var(--text-dim)";
  if (score >= 75) return "#00ff88";
  if (score >= 50) return "#ffaa00";
  return "#ff4444";
}

function exportJSON(result: NetworkScanResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `netaudit-network-${result.network_scan_id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(result: NetworkScanResult) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(0, 255, 136);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NETAUDIT", 14, 12);
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Network Security Audit Report", 14, 19);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Network: ${result.subnet}`, 14, 38);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(113, 128, 150);
  doc.text(`${result.hosts_found} hosts discovered · ${result.hosts_scanned} scanned`, 14, 45);

  const stats = [
    { label: "AVG SCORE", value: String(result.avg_score) },
    { label: "HOSTS FOUND", value: String(result.hosts_found) },
    { label: "CRITICAL", value: String(result.total_critical) },
    { label: "HIGH", value: String(result.total_high) },
  ];
  const boxW = (pageW - 28) / 4;
  stats.forEach((s, i) => {
    const x = 14 + i * boxW;
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(x, 50, boxW - 3, 16, 2, 2, "F");
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + (boxW - 3) / 2, 59, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 85, 85);
    doc.text(s.label, x + (boxW - 3) / 2, 63, { align: "center" });
  });

  const rows = result.hosts.map(h => [
    h.ip,
    h.hostname || "—",
    h.device_type || "—",
    h.method === "nmap_only" ? "No config" : (h.score != null ? `${h.score} (${h.grade})` : "—"),
    h.open_ports.length > 0 ? h.open_ports.join(", ") : "—",
    `${h.findings.filter(f => f.severity === "critical").length}C  ${h.findings.filter(f => f.severity === "high").length}H  ${h.findings.filter(f => f.severity === "medium").length}M`,
    h.error ? "Error" : "OK",
  ]);

  autoTable(doc, {
    startY: 72,
    head: [["IP", "Hostname", "Type", "Score", "Ports", "Findings", "Status"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [20, 20, 20], textColor: [0, 255, 136], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fillColor: [13, 13, 13], textColor: [226, 232, 240], fontSize: 8 },
    alternateRowStyles: { fillColor: [18, 18, 18] },
    margin: { left: 14, right: 14 },
  });

  result.hosts.forEach(h => {
    if (h.findings.length === 0) return;
    const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 72;
    const startY = lastY + 8;
    if (startY > 260) doc.addPage();

    const y = startY > 260 ? 20 : startY;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(226, 232, 240);
    doc.text(`${h.ip}${h.hostname ? " — " + h.hostname : ""}`, 14, y);

    const findingRows = h.findings.map(f => [
      f.severity.toUpperCase(),
      f.title,
      f.description.slice(0, 80) + (f.description.length > 80 ? "…" : ""),
      f.remediation.slice(0, 60) + (f.remediation.length > 60 ? "…" : ""),
    ]);

    autoTable(doc, {
      startY: y + 4,
      head: [["Severity", "Issue", "Description", "Remediation"]],
      body: findingRows,
      theme: "grid",
      headStyles: { fillColor: [20, 20, 20], textColor: [113, 128, 150], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fillColor: [13, 13, 13], textColor: [226, 232, 240], fontSize: 7 },
      alternateRowStyles: { fillColor: [18, 18, 18] },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 35 } },
      margin: { left: 14, right: 14 },
    });
  });

  doc.save(`netaudit-network-${result.network_scan_id.slice(0, 8)}.pdf`);
}

function HostCard({ host }: { host: NetworkHostResult }) {
  const [open, setOpen] = useState(false);
  const isNmapOnly = host.method === "nmap_only";
  const gc = isNmapOnly ? "var(--text-dim)" : gradeColor(host.score);

  return (
    <div
      className="card-hover rounded-xl cursor-pointer"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${open ? "var(--border-mid)" : "var(--border)"}`,
        transition: "border-color 160ms ease, background-color 160ms ease",
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Score badge */}
        <div className="text-center shrink-0" style={{ minWidth: 52 }}>
          {isNmapOnly ? (
            <div className="text-xs font-bold leading-tight text-center"
              style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              END<br />DEV
            </div>
          ) : host.score != null ? (
            <>
              <div className="text-xl font-bold" style={{ color: gc, fontFamily: "var(--font-heading)" }}>
                {host.score}
              </div>
              <div className="text-xs font-bold" style={{ color: gc, fontFamily: "var(--font-mono)" }}>
                {host.grade}
              </div>
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
            {host.hostname || host.ip}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            {host.hostname && host.hostname !== host.ip && (
              <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {host.ip}
              </span>
            )}
            {host.device_type && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                {host.device_type}
              </span>
            )}
            {host.method && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: "rgba(0,255,136,0.06)", color: "rgba(0,255,136,0.6)", border: "1px solid rgba(0,255,136,0.12)", fontFamily: "var(--font-mono)" }}>
                {host.method}
              </span>
            )}
            {host.open_ports.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                ports: {host.open_ports.join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Severity chips preview */}
        <div className="hidden sm:flex gap-1.5 flex-wrap justify-end shrink-0" style={{ maxWidth: 200 }}>
          {isNmapOnly ? (
            <span className="text-xs px-2 py-0.5 rounded-md"
              style={{ background: "var(--bg-card)", color: "var(--text-dim)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
              port scan only
            </span>
          ) : (
            <>
              {host.findings.slice(0, 3).map((f, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-md font-bold"
                  style={{ background: `${SEV_COLOR[f.severity]}18`, color: SEV_COLOR[f.severity], fontFamily: "var(--font-mono)" }}>
                  {f.severity.toUpperCase()}
                </span>
              ))}
              {host.findings.length > 3 && (
                <span className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: "var(--bg-card)", color: "var(--text-dim)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
                  +{host.findings.length - 3}
                </span>
              )}
            </>
          )}
          {host.error && (
            <span className="text-xs px-2 py-0.5 rounded-md font-bold"
              style={{ background: "rgba(255,68,68,0.1)", color: "#ff6666", fontFamily: "var(--font-mono)" }}>
              ERR
            </span>
          )}
        </div>

        {/* Chevron */}
        <div className="text-xs shrink-0 ml-1" style={{ color: "var(--text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}>
          ▼
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 border-t space-y-2.5 pt-4" style={{ borderColor: "var(--border)" }}
          onClick={e => e.stopPropagation()}>

          {isNmapOnly && (
            <div className="p-3 rounded-lg text-xs leading-relaxed"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>End device</span>
              {" "}— phone, laptop, TV or printer. No SSH or admin panel found, so no config could be pulled.
              {host.open_ports.length === 0
                ? " No risky ports open."
                : ` Open ports: ${host.open_ports.join(", ")}.`}
            </div>
          )}

          {host.error && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6666" }}>
              {host.error}
            </div>
          )}

          {!isNmapOnly && host.findings.length === 0 && !host.error && (
            <p className="text-xs py-2" style={{ color: "var(--text-dim)" }}>No issues found.</p>
          )}

          {host.findings.map((f, i) => (
            <div key={i} className="p-3 rounded-lg"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${SEV_COLOR[f.severity]}28`,
                borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
                borderRadius: "0 8px 8px 0",
              }}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: `${SEV_COLOR[f.severity]}18`, color: SEV_COLOR[f.severity], fontFamily: "var(--font-mono)" }}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
                  {f.title}
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-2)" }}>
                {f.description}
              </p>
              {f.remediation_snippet && (
                <pre className="text-xs p-3 rounded-lg overflow-x-auto"
                  style={{ background: "var(--bg-input)", color: "var(--green)", margin: 0, fontFamily: "var(--font-mono)", lineHeight: 1.7 }}>
                  {f.remediation_snippet}
                </pre>
              )}
            </div>
          ))}

          {host.scan_id && (
            <a
              href={`/results/${host.scan_id}`}
              className="inline-block text-xs mt-1 px-3 py-1.5 rounded-lg font-semibold hover:opacity-80"
              style={{ background: "var(--bg-card)", color: "var(--green)", border: "1px solid var(--border-mid)", fontFamily: "var(--font-mono)" }}
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
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(`net_${id}`);
      if (cached) { setResult(JSON.parse(cached)); return; }
    } catch { /* ignore */ }
    getNetworkResult(id)
      .then(setResult)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-3">
        <p className="font-semibold" style={{ color: "var(--critical)", fontFamily: "var(--font-heading)" }}>{error}</p>
        <a href="/scan" className="text-sm hover:opacity-80" style={{ color: "var(--green)" }}>← New scan</a>
      </div>
    </main>
  );

  if (!result) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center space-y-3">
        <div className="text-sm font-bold tracking-widest animate-pulse"
          style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>
          LOADING…
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fetching scan results</p>
      </div>
    </main>
  );

  const gc = gradeColor(result.avg_score);

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
          <button
            onClick={async () => { setPdfLoading(true); await exportPDF(result); setPdfLoading(false); }}
            disabled={pdfLoading}
            className="text-xs px-3 py-2 rounded font-bold hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}>
            {pdfLoading ? "Generating…" : "Export PDF"}
          </button>
          <button
            onClick={() => exportJSON(result)}
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            Export JSON
          </button>
          <a href="/history"
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            History
          </a>
          <a href="/scan"
            className="text-xs px-3 py-2 rounded hover:opacity-80"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }}>
            + New Scan
          </a>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <p className="text-xs font-bold tracking-widest mb-2"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          NETWORK SCAN
        </p>
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            {result.subnet}
          </h1>
        </div>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {result.hosts_found} host{result.hosts_found !== 1 ? "s" : ""} discovered
          &nbsp;·&nbsp;
          {result.hosts_scanned} scanned
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "AVG SCORE",   value: result.avg_score,      color: gc },
            { label: "HOSTS FOUND", value: result.hosts_found,    color: "var(--text)" },
            { label: "CRITICAL",    value: result.total_critical, color: result.total_critical > 0 ? "#ff4444" : "var(--text-dim)" },
            { label: "HIGH",        value: result.total_high,     color: result.total_high > 0 ? "#ff7700" : "var(--text-dim)" },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="text-3xl font-bold mb-1" style={{ color: stat.color, fontFamily: "var(--font-heading)" }}>
                {stat.value}
              </div>
              <div className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Host list */}
        <p className="text-xs font-bold tracking-widest mb-3"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          HOSTS — {result.hosts.length} device{result.hosts.length !== 1 ? "s" : ""}
        </p>
        <div className="space-y-2.5">
          {result.hosts.map(host => (
            <HostCard key={host.ip} host={host} />
          ))}
        </div>
      </div>
    </main>
  );
}
