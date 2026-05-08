import type { ScanResult, Finding, Severity } from "./api";

const SEV_COLORS: Record<Severity, [number, number, number]> = {
  critical: [220, 53, 53],
  high:     [220, 120, 0],
  medium:   [200, 160, 0],
  low:      [60, 130, 220],
  info:     [120, 130, 150],
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function scoreColor(score: number): [number, number, number] {
  if (score >= 90) return [0, 200, 100];
  if (score >= 75) return [0, 180, 90];
  if (score >= 60) return [200, 150, 0];
  if (score >= 40) return [220, 100, 0];
  return [220, 50, 50];
}

export async function exportPDF(result: ScanResult): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 15;
  const col = scoreColor(result.score);

  // ── HEADER BAR ──────────────────────────────────────────────────────────
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, W, 22, "F");

  doc.setTextColor(0, 255, 136);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NETAUDIT", margin, 14);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Network Config Security Report", margin + 35, 14);

  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(`Generated: ${now}`, W - margin, 14, { align: "right" });

  // ── DEVICE INFO ──────────────────────────────────────────────────────────
  let y = 32;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(result.hostname ?? "Unknown Device", margin, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const tags = [
    result.device_type.toUpperCase(),
    result.ios_version ? `IOS ${result.ios_version}` : null,
    `Scan ID: ${result.scan_id.slice(0, 8)}`,
  ].filter(Boolean).join("   ·   ");
  doc.text(tags, margin, y);

  // ── SCORE CIRCLE ─────────────────────────────────────────────────────────
  y += 14;
  const cx = W - margin - 18;
  const cy = y - 6;

  doc.setDrawColor(...col);
  doc.setLineWidth(3);
  doc.circle(cx, cy, 14);

  doc.setTextColor(...col);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(String(result.score), cx, cy + 2, { align: "center" });

  doc.setFontSize(7);
  doc.text("/100", cx, cy + 7, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Grade ${result.grade}`, cx, cy + 18, { align: "center" });

  // ── SUMMARY BAR ──────────────────────────────────────────────────────────
  y += 12;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let sx = margin;
  for (const sev of SEV_ORDER) {
    const count = result.summary[sev];
    if (count === 0) continue;
    const c = SEV_COLORS[sev];
    doc.setTextColor(...c);
    doc.text(`${sev.toUpperCase()}  ${count}`, sx, y);
    sx += 38;
  }

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── FINDINGS TABLE ───────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Findings", margin, y);
  y += 4;

  const rows = result.findings.map((f: Finding) => [
    f.severity.toUpperCase(),
    f.rule_id,
    f.title,
    f.line_number ? `Line ${f.line_number}` : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Severity", "Rule ID", "Finding", "Location"]],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: [13, 13, 13], textColor: [0, 255, 136], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 28, textColor: [120, 120, 120] },
      2: { cellWidth: 110 },
      3: { cellWidth: 20, textColor: [120, 120, 120] },
    },
    didParseCell: (data) => {
      if (data.column.index === 0 && data.section === "body") {
        const sev = (data.cell.raw as string).toLowerCase() as Severity;
        const c = SEV_COLORS[sev] ?? [100, 100, 100];
        data.cell.styles.textColor = c;
      }
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  // ── REMEDIATION DETAILS ──────────────────────────────────────────────────
  const critical_high = result.findings.filter(
    f => f.severity === "critical" || f.severity === "high"
  );

  if (critical_high.length > 0) {
    y = (doc as any).lastAutoTable.finalY + 12;

    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Critical & High — Remediation", margin, y);
    y += 6;

    for (const f of critical_high) {
      if (y > 255) { doc.addPage(); y = 20; }

      const c = SEV_COLORS[f.severity];
      doc.setFillColor(...c);
      doc.rect(margin, y, 2, 8, "F");

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(f.title, margin + 5, y + 5.5);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      y += 10;

      const descLines = doc.splitTextToSize(f.description, W - margin * 2 - 5);
      doc.text(descLines, margin + 5, y);
      y += descLines.length * 4 + 2;

      if (f.remediation_snippet) {
        doc.setFillColor(240, 240, 240);
        const snippetLines = f.remediation_snippet.split("\n");
        const snippetH = snippetLines.length * 4.5 + 4;
        doc.rect(margin + 5, y, W - margin * 2 - 5, snippetH, "F");
        doc.setTextColor(20, 120, 60);
        doc.setFontSize(7);
        doc.setFont("courier", "normal");
        snippetLines.forEach((line, i) => {
          doc.text(line, margin + 8, y + 4 + i * 4.5);
        });
        y += snippetH + 4;
      }
      y += 4;
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(13, 13, 13);
    doc.rect(0, 292, W, 8, "F");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("NetAudit — for authorised security testing only", margin, 297);
    doc.text(`Page ${i} of ${pages}`, W - margin, 297, { align: "right" });
  }

  const filename = `netaudit-${(result.hostname ?? "scan").toLowerCase().replace(/\s+/g, "-")}-${result.scan_id.slice(0, 8)}.pdf`;
  doc.save(filename);
}
