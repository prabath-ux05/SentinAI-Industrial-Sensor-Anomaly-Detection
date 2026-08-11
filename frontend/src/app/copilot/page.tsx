"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, MessageSquare, Bot, Trash2, Sparkles, Wrench,
  Copy, Check, AlertCircle, ChevronRight, Zap, Clock
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  llm_powered?: boolean;
  tools_used?: string[];
  isError?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  id: 1,
  role: "assistant",
  timestamp: new Date(),
  content:
    "Hello Admin. I'm the **SentinAI Copilot**, connected directly to your operational database.\n\n" +
    "I can answer questions about sensor health, anomalies, equipment status, and maintenance history — " +
    "using live telemetry data, not assumptions.\n\n" +
    "What would you like to know?",
};

const SUGGESTED_QUESTIONS = [
  "Which sensors are currently unhealthy?",
  "Which equipment requires immediate attention?",
  "Why was P-104 flagged?",
  "Summarize today's system health.",
  "Which anomalies occurred today?",
  "What should I inspect for F-201?",
  "Which equipment has the lowest health score?",
  "Show active critical alerts.",
];

// Contextual follow-up suggestions based on what the Copilot just answered
const FOLLOWUP_MAP: Record<string, string[]> = {
  unhealthy: ["Why was P-104 flagged?", "Show active critical alerts.", "What should I inspect for F-201?"],
  flagged: ["Summarize today's system health.", "Which anomalies occurred today?", "Show active critical alerts."],
  anomal: ["Which equipment requires immediate attention?", "Why was P-104 flagged?", "What should I inspect for F-201?"],
  health: ["Which sensors are currently unhealthy?", "Show active critical alerts.", "Which anomalies occurred today?"],
  inspect: ["Which sensors are currently unhealthy?", "Summarize today's system health."],
  critical: ["Which equipment requires immediate attention?", "Which sensors are currently unhealthy?"],
};

function getFollowups(content: string): string[] {
  const lower = content.toLowerCase();
  for (const [key, suggestions] of Object.entries(FOLLOWUP_MAP)) {
    if (lower.includes(key)) return suggestions.slice(0, 3);
  }
  return SUGGESTED_QUESTIONS.slice(0, 3);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Render a line supporting **bold** markdown tokens */
function RichLine({ text, user }: { text: string; user: boolean }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className={user ? "text-white font-semibold" : "text-teal-300 font-semibold"}>
            {p.slice(2, -2)}
          </strong>
        ) : p
      )}
    </>
  );
}

/** Typing indicator dots */
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center h-5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 bg-teal-500/70 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

/** Copy-to-clipboard button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy response"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-500 hover:text-teal-400"
    >
      {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
    </button>
  );
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFollowups, setLastFollowups] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [input]);

  const clearConversation = useCallback(() => {
    setMessages([{ ...INITIAL_MESSAGE, id: Date.now(), timestamp: new Date() }]);
    setLastFollowups([]);
    setError(null);
  }, []);

  const handleSend = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || loading) return;
    setInput("");
    setError(null);
    setLastFollowups([]);

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: userMsg.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Backend error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const reply = data.reply ?? "No response from Copilot.";

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        llm_powered: data.llm_powered ?? false,
        tools_used: data.tools_used ?? [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastFollowups(getFollowups(reply));
    } catch (err: any) {
      console.error("Chat error:", err);
      const errMsg = err?.message?.includes("Failed to fetch")
        ? "Cannot reach the SentinAI backend. Please ensure the API server is running."
        : err?.message ?? "An unexpected error occurred.";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: errMsg,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const isEmptyChat = messages.length === 1;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto pb-6">

      {/* ── Page Header ── */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-teal-500/20 to-teal-500/5 p-3 rounded-xl border border-teal-500/20 shadow-lg shadow-teal-900/10">
            <Bot className="text-teal-400" size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Maintenance Copilot</h2>
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                <Zap size={8} className="fill-teal-400" /> Live
              </span>
            </div>
            <p className="text-slate-400 mt-0.5 text-sm">
              Ask about asset health, anomalies &amp; maintenance history — powered by real-time telemetry.
            </p>
          </div>
        </div>

        <button
          onClick={clearConversation}
          className="flex items-center gap-2 px-3 py-2 bg-navy-800 border border-navy-700 text-slate-400 rounded-lg hover:text-white hover:bg-navy-700 transition-all text-sm font-medium"
        >
          <Trash2 size={14} /> Clear Chat
        </button>
      </div>

      {/* ── Chat Window ── */}
      <div className="flex-1 bg-navy-800 rounded-2xl border border-navy-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Empty state */}
          {isEmptyChat && (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-3 opacity-60">
              <Bot size={36} className="text-teal-500/40" />
              <p className="text-slate-500 text-sm max-w-xs">
                No conversation yet. Ask a question or pick one of the suggestions below to get started.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex group ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-3 max-w-[84%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white shadow-md"
                    : msg.isError
                    ? "bg-red-900/60 border border-red-500/30 text-red-400"
                    : "bg-navy-900 border border-teal-500/40 text-teal-400 shadow-[0_0_10px_rgba(13,148,136,0.15)]"
                }`}>
                  {msg.role === "user" ? (
                    <MessageSquare size={13} />
                  ) : msg.isError ? (
                    <AlertCircle size={14} />
                  ) : (
                    <Bot size={15} />
                  )}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1">
                  <div className={`relative p-4 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-tr-none shadow-[0_4px_20px_rgba(13,148,136,0.25)]"
                      : msg.isError
                      ? "bg-red-950/50 border border-red-500/20 text-red-300 rounded-tl-none"
                      : "bg-navy-900/70 border border-navy-700/80 text-slate-300 rounded-tl-none backdrop-blur-sm"
                  }`}>

                    {/* Message text */}
                    <div className="text-sm leading-relaxed space-y-1.5">
                      {msg.content.split("\n").map((line, i) => (
                        <p key={i} className={`min-h-[1.25rem] ${!line.trim() ? "h-2" : ""}`}>
                          <RichLine text={line} user={msg.role === "user"} />
                        </p>
                      ))}
                    </div>

                    {/* Metadata footer — tools used + AI badge */}
                    {msg.role === "assistant" && !msg.isError && (msg.llm_powered || (msg.tools_used && msg.tools_used.length > 0)) && (
                      <div className="mt-3 pt-2.5 border-t border-navy-700/50 flex flex-wrap items-center gap-1.5">
                        {msg.llm_powered && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
                            <Sparkles size={8} /> AI Enhanced
                          </span>
                        )}
                        {msg.tools_used?.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-[10px] font-medium bg-navy-800 text-slate-500 border border-navy-700/60 px-2 py-0.5 rounded-full">
                            <Wrench size={8} /> {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Copy button — visible on hover for assistant */}
                    {msg.role === "assistant" && !msg.isError && (
                      <div className="absolute top-2 right-2">
                        <CopyButton text={msg.content} />
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className={`flex items-center gap-1 text-[10px] text-slate-600 px-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <Clock size={9} />
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 mt-1 rounded-full bg-navy-900 border border-teal-500/40 text-teal-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(13,148,136,0.15)]">
                  <Bot size={15} />
                </div>
                <div className="p-4 rounded-2xl bg-navy-900/70 border border-navy-700/80 rounded-tl-none backdrop-blur-sm">
                  <TypingDots />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Follow-up Suggestions ── */}
        {lastFollowups.length > 0 && !loading && (
          <div className="px-5 py-2 border-t border-navy-700/50 bg-navy-900/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">Suggested follow-ups</p>
            <div className="flex flex-wrap gap-2">
              {lastFollowups.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="flex items-center gap-1.5 text-xs text-teal-400/80 border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 hover:text-teal-300 px-3 py-1.5 rounded-lg transition-all"
                >
                  <ChevronRight size={11} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className="border-t border-navy-700 p-4 bg-navy-900/40">

          {/* Initial suggested prompts */}
          {messages.length <= 1 && !loading && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Suggested Prompts</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="text-xs bg-navy-800 border border-navy-700 hover:border-teal-500/30 hover:bg-navy-750 hover:text-teal-300 text-slate-400 px-3 py-2 rounded-lg transition-all shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text input form */}
          <form
            onSubmit={onSubmit}
            className="flex items-end gap-2 bg-navy-900 border border-navy-700 rounded-xl p-1.5 focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/15 transition-all"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Ask anything about asset health, anomalies, or maintenance history... (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent border-none resize-none min-h-[44px] max-h-32 py-3 pl-3 pr-1 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-0 leading-relaxed"
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-500 active:scale-95 text-white disabled:opacity-40 disabled:bg-navy-700 disabled:text-slate-500 transition-all shrink-0 shadow-md"
              title="Send message"
            >
              <Send size={16} />
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-600 mt-2.5 flex items-center justify-center gap-1.5">
            <Bot size={9} />
            Responses are generated from live database telemetry — not from an LLM trained on static data.
          </p>
        </div>
      </div>
    </div>
  );
}
