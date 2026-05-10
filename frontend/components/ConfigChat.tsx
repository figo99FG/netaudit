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
}

const SUGGESTIONS = [
  "Why is my score low?",
  "What's the most critical issue?",
  "How do I fix the telnet finding?",
  "Generate a hardened config for me",
  "Explain this in simple terms",
];

export default function ConfigChat({ scanId, configText = "" }: Props) {
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
      const reply = await chatWithConfig({
        scan_id: scanId,
        config_text: configText,
        message: msg,
        history: messages,
      });
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Chat failed";
      setError(err.includes("API key") ? "Add your API key in Settings to use chat." : err);
      setMessages(newMessages.slice(0, -1)); // remove the user message on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1a1a1a" }}>
        <span style={{ color: "var(--green)" }}>◆</span>
        <span className="text-sm font-bold">Chat with your config</span>
        <span className="text-xs ml-auto px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#555" }}>AI</span>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-3 min-h-[120px] max-h-[400px] overflow-y-auto">
        {messages.length === 0 && (
          <div>
            <p className="text-xs mb-3" style={{ color: "#4a5568" }}>Ask anything about this scan result:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                  style={{ background: "#141414", color: "#718096", border: "1px solid #2a2a2a" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap"
              style={m.role === "user"
                ? { background: "#1a2a1a", color: "#e2e8f0", borderBottomRightRadius: 4 }
                : { background: "#141414", color: "#e2e8f0", border: "1px solid #1a1a1a", borderBottomLeftRadius: 4 }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "#141414", color: "#555", border: "1px solid #1a1a1a" }}>
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs px-3 py-2 rounded" style={{ background: "#ff444411", color: "#ff6666" }}>{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: "#1a1a1a" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about this scan…"
          disabled={loading}
          className="flex-1 px-3 py-2 rounded text-sm"
          style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#e2e8f0", outline: "none" }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded text-sm font-bold disabled:opacity-40 transition-opacity hover:opacity-80"
          style={{ background: "var(--green)", color: "#000" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
