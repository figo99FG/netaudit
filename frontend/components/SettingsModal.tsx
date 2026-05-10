"use client";
import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SettingsModal({ open, onClose, onSaved }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [hint, setHint]     = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError("");
    getSettings()
      .then(s => { if (s.api_key_hint) setHint(s.api_key_hint); })
      .catch(() => setError("Agent not running — start the agent first."));
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      await saveSettings({ api_key: apiKey.trim(), ai_enabled: true });
      setSaved(true);
      setApiKey("");
      setHint(apiKey.trim().slice(0, 8) + "…");
      onSaved?.();
    } catch {
      setError("Failed to save. Is the agent running?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">AI Settings</h2>
          <button onClick={onClose} style={{ color: "#555" }}>✕</button>
        </div>

        <p className="text-xs mb-4" style={{ color: "#718096" }}>
          Enter your <strong style={{ color: "#e2e8f0" }}>Anthropic</strong> or <strong style={{ color: "#e2e8f0" }}>OpenAI</strong> API key to enable AI-powered analysis and chat.
          The key is stored locally on your machine — never sent to our servers.
        </p>

        {hint && (
          <p className="text-xs mb-3 px-3 py-2 rounded" style={{ background: "#0a1a0a", color: "#00ff88" }}>
            Current key: <code>{hint}</code>
          </p>
        )}

        <div className="mb-4">
          <label className="text-xs font-bold mb-1 block" style={{ color: "#718096" }}>
            API KEY
          </label>
          <input
            type="password"
            placeholder="sk-ant-… or sk-…"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            className="w-full px-3 py-2 rounded text-sm font-mono"
            style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e2e8f0", outline: "none" }}
          />
        </div>

        {error && <p className="text-xs mb-3" style={{ color: "#ff6666" }}>{error}</p>}
        {saved && <p className="text-xs mb-3" style={{ color: "#00ff88" }}>✓ Saved — AI features unlocked</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="flex-1 py-2 rounded font-bold text-sm disabled:opacity-40"
            style={{ background: "var(--green)", color: "#000" }}
          >
            {saving ? "Saving…" : "Save key"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm"
            style={{ background: "#1a1a1a", color: "#718096", border: "1px solid #2a2a2a" }}
          >
            Cancel
          </button>
        </div>

        <p className="text-xs mt-4" style={{ color: "#4a5568" }}>
          Get a key: <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: "#00ff88" }}>console.anthropic.com</a>
          {" "}or <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "#00ff88" }}>platform.openai.com</a>
        </p>
      </div>
    </div>
  );
}
