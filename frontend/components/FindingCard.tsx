"use client";
import { useState } from "react";
import type { Finding } from "@/lib/api";
import RemediationSnippet from "./RemediationSnippet";

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#ff4444", bg: "rgba(255,68,68,0.05)",   label: "CRITICAL" },
  high:     { color: "#ff7700", bg: "rgba(255,119,0,0.05)",   label: "HIGH"     },
  medium:   { color: "#ffaa00", bg: "rgba(255,170,0,0.05)",   label: "MEDIUM"   },
  low:      { color: "#4da6ff", bg: "rgba(77,166,255,0.05)",  label: "LOW"      },
  info:     { color: "#718096", bg: "rgba(113,128,150,0.05)", label: "INFO"     },
};

export default function FindingCard({ finding, index, tailoredRemediation }: {
  finding: Finding;
  index: number;
  tailoredRemediation?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEV[finding.severity] ?? SEV.info;

  return (
    <div
      className={`rounded-lg cursor-pointer sev-${finding.severity}`}
      style={{
        background: expanded ? cfg.bg : "var(--bg-card)",
        border: `1px solid ${expanded ? cfg.color + "28" : "var(--border)"}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: "0 8px 8px 0",
        transition: "background 200ms ease, border-color 200ms ease",
      }}
      onClick={() => setExpanded(!expanded)}
      role="button"
      aria-expanded={expanded}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 tracking-widest"
          style={{
            fontFamily: "var(--font-mono)",
            background: `${cfg.color}14`,
            color: cfg.color,
            border: `1px solid ${cfg.color}28`,
          }}
        >
          {cfg.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}
            >
              {finding.title}
            </p>
            <span
              className="text-xs shrink-0"
              style={{
                color: "var(--text-muted)",
                display: "inline-block",
                transition: "transform 220ms ease",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </div>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            {finding.rule_id}
            {finding.line_number != null && (
              <span className="ml-3" style={{ color: "var(--text-dim)" }}>
                line {finding.line_number}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: `1px solid ${cfg.color}18` }}
        >
          <div className="pt-3" />

          {/* Affected line */}
          {finding.affected_line && (
            <div>
              <p
                className="text-xs font-bold mb-1.5 tracking-widest uppercase"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Affected line
              </p>
              <code
                className="block text-xs px-3 py-2.5 rounded"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-input)",
                  color: cfg.color,
                  border: "1px solid var(--border)",
                }}
              >
                {finding.affected_line}
              </code>
            </div>
          )}

          {/* Description */}
          <div>
            <p
              className="text-xs font-bold mb-1.5 tracking-widest uppercase"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Issue
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {finding.description}
            </p>
          </div>

          {/* Remediation */}
          <div>
            <p
              className="text-xs font-bold mb-1.5 tracking-widest uppercase"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Remediation
            </p>
            {tailoredRemediation ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: "var(--green)", fontSize: 9 }}>◆</span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--green)" }}
                  >
                    AI — tailored to your config
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {tailoredRemediation}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {finding.remediation}
              </p>
            )}
          </div>

          {/* Fix snippet */}
          {finding.remediation_snippet && (
            <div>
              <p
                className="text-xs font-bold mb-1.5 tracking-widest uppercase"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Fix
              </p>
              <RemediationSnippet snippet={finding.remediation_snippet} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
