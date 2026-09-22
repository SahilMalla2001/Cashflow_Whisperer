"use client";
import { type ReactNode, useState, useRef, useEffect } from "react";
import { Bot, Send } from "lucide-react";

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

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function AdvisorMarkdown({ content }: { content: string }) {
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listType || !listItems.length) return;
    const Tag = listType;
    nodes.push(
      <Tag key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  content.split("\n").forEach((line) => {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    const bulletItem = line.match(/^[-*]\s+(.+)$/);

    if (heading) {
      flushList();
      nodes.push(<h4 key={`heading-${nodes.length}`}><InlineMarkdown text={heading[1]} /></h4>);
    } else if (orderedItem || bulletItem) {
      const nextType = orderedItem ? "ol" : "ul";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((orderedItem ?? bulletItem)![1]);
    } else if (!line.trim()) {
      flushList();
    } else {
      flushList();
      nodes.push(<p key={`paragraph-${nodes.length}`}><InlineMarkdown text={line} /></p>);
    }
  });
  flushList();
  return <div className="advisor-markdown">{nodes}</div>;
}

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
          <p>Ask anything about your money — powered by Groq + Qwen</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--positive)", display: "inline-block" }} />
          Groq · qwen/qwen3.8-27b
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
              {m.role === "assistant" ? (
                <AdvisorMarkdown content={m.content} />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              )}
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
