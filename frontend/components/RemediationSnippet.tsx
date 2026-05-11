"use client";
import { useState } from "react";

export default function RemediationSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="relative rounded-lg"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); copy(); }}
        className="absolute top-2.5 right-2.5 text-xs px-2.5 py-1 rounded font-medium"
        style={{
          background: copied ? "rgba(0,255,136,0.12)" : "var(--bg-card)",
          color: copied ? "var(--green)" : "var(--text-muted)",
          border: `1px solid ${copied ? "rgba(0,255,136,0.3)" : "var(--border)"}`,
          fontFamily: "var(--font-mono)",
          transition: "all 200ms ease",
        }}
        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <pre
        className="p-4 text-xs overflow-x-auto"
        style={{
          color: "var(--green)",
          margin: 0,
          fontFamily: "var(--font-mono)",
          lineHeight: 1.7,
        }}
      >
        {snippet}
      </pre>
    </div>
  );
}
