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
    <div className="relative mt-2 rounded" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded transition-colors"
        style={{
          background: copied ? "#00ff8822" : "#1a1a1a",
          color: copied ? "#00ff88" : "#718096",
          border: "1px solid #2a2a2a",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="p-4 text-xs overflow-x-auto" style={{ color: "#00ff88", margin: 0 }}>
        {snippet}
      </pre>
    </div>
  );
}
