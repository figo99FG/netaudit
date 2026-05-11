"use client";
import { useState, useRef, useEffect } from "react";
import { chatWithConfig } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  scanId: string;
  configText?: string;
  hostname?: string;
  deviceType?: string;
  score?: number;
  grade?: string;
  findings?: { severity: string; rule_id: string; title: string; description: string }[];
}

const SUGGESTIONS = [
  "Why is my score low?",
  "What's the most critical issue?",
  "How do I fix the telnet finding?",
  "Generate a hardened config",
  "Explain this in simple terms",
];

export default function ConfigChat({
  scanId, configText = "", hostname, deviceType, score, grade, findings = [],
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setError("");

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const findingsSummary = findings
        .map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
        .join("\n");

      const reply = await chatWithConfig({
        message: msg,
        history: messages,
        findings_summary: findingsSummary,
        hostname,
        device_type: deviceType,
        score,
        grade,
      });
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Chat failed";
      setError(err.includes("not configured") ? "AI chat is not available right now." : err);
      setMessages(newMessages.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center gap-2"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <span style={{ color: "var(--green)" }}>◆</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
          Chat with your config
        </span>
        {hostname && (
          <span className="text-xs px-2 py-0.5 rounded-md ml-1"
            style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}>
            {hostname}
          </span>
        )}
        <span className="text-xs ml-auto px-2 py-0.5 rounded-md"
          style={{ background: "rgba(0,255,136,0.06)", color: "var(--green)", border: "1px solid rgba(0,255,136,0.15)", fontFamily: "var(--font-mono)" }}>
          AI
        </span>
      </div>

      {/* Messages */}
      <div className="px-5 py-4 space-y-3 min-h-[140px] max-h-[420px] overflow-y-auto">

        {/* Empty state + suggestions */}
        {messages.length === 0 && (
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              ASK ANYTHING ABOUT THIS SCAN
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-mid)",
                    fontFamily: "var(--font-mono)",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5"
                style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
                <span style={{ color: "var(--green)", fontSize: 9 }}>◆</span>
              </div>
            )}
            <div
              className="max-w-[82%] px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed"
              style={m.role === "user"
                ? {
                    background: "rgba(0,255,136,0.07)",
                    color: "var(--text)",
                    border: "1px solid rgba(0,255,136,0.14)",
                    borderRadius: "12px 12px 4px 12px",
                    fontFamily: "var(--font-body)",
                  }
                : {
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px 12px 12px 12px",
                    fontFamily: "var(--font-body)",
                  }
              }>
              {m.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <span style={{ color: "var(--green)", fontSize: 9 }}>◆</span>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "4px 12px 12px 12px" }}>
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "var(--green)",
                      animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3.5 py-2.5 rounded-lg text-xs"
            style={{ background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff6666" }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 py-3.5 border-t flex gap-2 items-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about this scan…"
          disabled={loading}
          className="flex-1 px-3.5 py-2.5 rounded-lg text-sm transition-colors"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-mid)",
            color: "var(--text)",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.35)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border-mid)"; }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
          style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)", minWidth: 64 }}>
          Send
        </button>
      </div>
    </div>
  );
}
