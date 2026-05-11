"use client";
import { useState } from "react";
import type { Finding } from "@/lib/api";
import RemediationSnippet from "./RemediationSnippet";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "#ff444411", text: "#ff6666", border: "#ff4444", label: "CRITICAL" },
  high:     { bg: "#ff770011", text: "#ff9944", border: "#ff7700", label: "HIGH" },
  medium:   { bg: "#ffaa0011", text: "#ffcc44", border: "#ffaa00", label: "MEDIUM" },
  low:      { bg: "#4da6ff11", text: "#4da6ff", border: "#4da6ff", label: "LOW" },
  info:     { bg: "#71809611", text: "#718096", border: "#4a5568", label: "INFO" },
};

export default function FindingCard({ finding, index, tailoredRemediation }: {
  finding: Finding;
  index: number;
  tailoredRemediation?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.info;

  return (
    <div
      className="rounded p-4 cursor-pointer transition-all"
      style={{ background: s.bg, border: `1px solid ${s.border}33` }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          className="text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5"
          style={{ background: `${s.border}22`, color: s.text, border: `1px solid ${s.border}44` }}
        >
          {s.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm" style={{ color: s.text }}>{finding.title}</p>
            <span className="text-xs shrink-0" style={{ color: "#4a5568" }}>
              {expanded ? "▲" : "▼"}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "#718096" }}>
            {finding.rule_id}
            {finding.line_number && (
              <span className="ml-3 font-mono" style={{ color: "#4a5568" }}>
                line {finding.line_number}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-3 pl-1">
          {finding.affected_line && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: "#4a5568" }}>AFFECTED LINE</p>
              <code
                className="block text-xs px-3 py-2 rounded"
                style={{ background: "#0a0a0a", color: "#e2e8f0", border: "1px solid #2a2a2a" }}
              >
                {finding.affected_line}
              </code>
            </div>
          )}
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: "#4a5568" }}>ISSUE</p>
            <p className="text-sm" style={{ color: "#a0aec0" }}>{finding.description}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: "#4a5568" }}>REMEDIATION</p>
            {tailoredRemediation ? (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span style={{ color: "var(--green)", fontSize: 10 }}>◆</span>
                  <span className="text-xs font-bold" style={{ color: "var(--green)" }}>AI — tailored to your config</span>
                </div>
                <p className="text-sm" style={{ color: "#a0aec0" }}>{tailoredRemediation}</p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#a0aec0" }}>{finding.remediation}</p>
            )}
          </div>
          {finding.remediation_snippet && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: "#4a5568" }}>FIX</p>
              <RemediationSnippet snippet={finding.remediation_snippet} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
