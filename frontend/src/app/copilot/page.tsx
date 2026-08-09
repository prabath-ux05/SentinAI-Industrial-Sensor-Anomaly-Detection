"use client";

import { useState } from "react";
import { Send, MessageSquare, Bot } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Hello Admin, I am SentinAI Copilot. How can I assist you with maintenance and monitoring today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    
    const newMessages = [...messages, { id: Date.now(), role: "user", content: userMsg } as Message];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/copilot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: userMsg })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: "Error connecting to backend services." }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: "Failed to communicate with AI Copilot." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Bot className="text-teal-400" size={32} />
          Maintenance Copilot
        </h2>
        <p className="text-slate-400 mt-1">Ask questions about asset health, anomalies, and maintenance history.</p>
      </div>

      <div className="flex-1 bg-navy-800 rounded-xl border border-navy-700 shadow-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-teal-500 text-charcoal' : 'bg-navy-900 border border-teal-500 text-teal-400'}`}>
                  {msg.role === 'user' ? <MessageSquare size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-teal-500 text-charcoal rounded-tr-none' : 'bg-navy-900 border border-navy-700 text-slate-200 rounded-tl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-navy-900 border border-teal-500 text-teal-400 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-xl bg-navy-900 border border-navy-700 text-slate-400 rounded-tl-none flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-navy-900/50 border-t border-navy-700">
          <form onSubmit={sendMessage} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about P-104 status, recent anomalies, or equipment health..."
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2 text-slate-400 hover:text-teal-400 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setInput("Which sensors are currently unhealthy?")} className="text-xs bg-navy-700 hover:bg-navy-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">Which sensors are unhealthy?</button>
            <button type="button" onClick={() => setInput("Why was P-104 flagged?")} className="text-xs bg-navy-700 hover:bg-navy-600 text-slate-300 px-3 py-1.5 rounded-full transition-colors">Why was P-104 flagged?</button>
          </div>
        </div>
      </div>
    </div>
  );
}
