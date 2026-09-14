"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "How can I reduce my quick commerce spending?",
  "Should I prepay my personal loan or invest in SIPs?",
  "Where is most of my money going?",
  "What's my savings rate vs last month?",
  "Create a budget plan for next month",
  "Am I on track to build a 6-month emergency fund?",
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your personal financial advisor. I have access to all your transaction data. Ask me anything — from spending patterns to investment strategies. 💬",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;

    const updated: Message[] = [...messages, { role: "user", content: q }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>AI Financial Advisor</h1>
          <p>Ask anything about your money — powered by Groq + Llama 3</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--positive)", display: "inline-block" }} />
          Groq · llama3-70b-8192
        </div>
      </div>

      <div className="chat-container">
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.role === "assistant" && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", opacity: 0.6 }}>
                  <Bot size={12} />
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Advisor
                  </span>
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble ai">
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", opacity: 0.6 }}>
                <Bot size={12} />
                <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Advisor
                </span>
              </div>
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts (only when no user message yet) */}
        {messages.length === 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                className="btn btn-sm"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Ask about your finances… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{ alignSelf: "flex-end", height: "42px", width: "42px" }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
