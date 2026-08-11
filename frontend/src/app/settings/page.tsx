"use client";

import { useState, useEffect } from "react";
import {
  User, Settings as SettingsIcon, Bell, Database,
  Brain, Cpu, MapPin, Info, Check, X, Shield,
  RefreshCw, CheckCircle2, AlertTriangle, Monitor,
  Mail, Settings2, Moon
} from "lucide-react";

// ── Status Types ─────────────────────────────────────────────────────────────

type StatusState = "loading" | "ok" | "error" | "unconfigured";

interface ApiStatus {
  db: StatusState;
  ml: StatusState;
  llm: StatusState;
  llmProvider: string | null;
  maps: StatusState;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── Components ───────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-lg mb-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-navy-700/60 bg-navy-800/50">
        <Icon size={18} className="text-teal-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function StatusIndicator({ label, status, detail, icon: Icon }: { label: string, status: StatusState, detail?: string, icon: any }) {
  const isOk = status === "ok";
  const isErr = status === "error";
  const isUnconf = status === "unconfigured";
  const isLoading = status === "loading";

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border bg-navy-900 border-navy-700/60 transition-colors hover:border-navy-600">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
          isOk ? "bg-teal-500/10 border-teal-500/20 text-teal-400" :
          isErr ? "bg-red-500/10 border-red-500/20 text-red-400" :
          isUnconf ? "bg-amber-400/10 border-amber-400/20 text-amber-400" :
          "bg-navy-700/50 border-navy-600 text-slate-500"
        }`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-200">{label}</p>
          {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isLoading && <RefreshCw size={14} className="text-slate-500 animate-spin" />}
        {isOk && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md"><CheckCircle2 size={12} /> Connected</span>}
        {isErr && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"><AlertTriangle size={12} /> Offline</span>}
        {isUnconf && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md"><AlertTriangle size={12} /> Unconfigured</span>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [status, setStatus] = useState<ApiStatus>({
    db: "loading",
    ml: "loading",
    llm: "loading",
    llmProvider: null,
    maps: "loading"
  });

  // Local state for UI mock forms
  const [profile, setProfile] = useState({ name: "Admin User", email: "admin@sentinai.com" });
  const [sysSettings, setSysSettings] = useState({ refresh: "30s", dateRange: "7d", threshold: 75, theme: "dark" });
  const [notifications, setNotifications] = useState({ critical: true, email: false });

  // ── Fetch Statuses ─────────────────────────────────────────────────────────

  const checkStatus = async () => {
    setStatus({ db: "loading", ml: "loading", llm: "loading", llmProvider: null, maps: "loading" });
    
    // DB & ML Engine (both bound to the backend health right now)
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) {
        setStatus(s => ({ ...s, db: "ok", ml: "ok" }));
      } else {
        setStatus(s => ({ ...s, db: "error", ml: "error" }));
      }
    } catch {
      setStatus(s => ({ ...s, db: "error", ml: "error" }));
    }

    // Copilot / LLM Provider
    try {
      const res = await fetch(`${API}/copilot/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.llm_configured) {
          setStatus(s => ({ ...s, llm: "ok", llmProvider: data.provider }));
        } else {
          setStatus(s => ({ ...s, llm: "unconfigured" }));
        }
      } else {
        setStatus(s => ({ ...s, llm: "error" }));
      }
    } catch {
      setStatus(s => ({ ...s, llm: "error" }));
    }

    // Google Maps
    try {
      const res = await fetch(`${API}/suppliers/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(s => ({ ...s, maps: data.api_configured ? "ok" : "unconfigured" }));
      } else {
        setStatus(s => ({ ...s, maps: "error" }));
      }
    } catch {
      setStatus(s => ({ ...s, maps: "error" }));
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-xl border border-teal-500/20 flex items-center justify-center">
            <SettingsIcon size={22} className="text-teal-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Manage system configuration, preferences, and check API connectivity.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── Left Column ── */}
        <div className="space-y-6">
          
          {/* Profile */}
          <SectionCard title="Profile" icon={User}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  value={profile.name} 
                  onChange={e => setProfile({...profile, name: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 focus:bg-navy-700/50 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  value={profile.email} 
                  onChange={e => setProfile({...profile, email: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 focus:bg-navy-700/50 transition-all"
                />
              </div>
              <div className="pt-2">
                <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-navy-900 hover:bg-navy-700 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-all border border-navy-700 hover:border-navy-600">
                  <Shield size={14} /> Change Password
                </button>
              </div>
            </div>
          </SectionCard>

          {/* System Settings */}
          <SectionCard title="System Settings" icon={Settings2}>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Dashboard Refresh Interval</label>
                <select 
                  value={sysSettings.refresh}
                  onChange={e => setSysSettings({...sysSettings, refresh: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 appearance-none"
                >
                  <option value="10s">10 Seconds (Live)</option>
                  <option value="30s">30 Seconds</option>
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1.5">Default Date Range</label>
                <select 
                  value={sysSettings.dateRange}
                  onChange={e => setSysSettings({...sysSettings, dateRange: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500/50 appearance-none"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Alert Threshold (Health %)</label>
                  <span className="text-xs font-bold text-teal-400">{sysSettings.threshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={sysSettings.threshold}
                  onChange={e => setSysSettings({...sysSettings, threshold: parseInt(e.target.value)})}
                  className="w-full accent-teal-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Equipment with health below this value will be flagged.</p>
              </div>
              <div className="pt-2 border-t border-navy-700/60">
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-2 mt-2">Interface Theme</label>
                <div className="flex gap-2">
                  <button onClick={() => setSysSettings({...sysSettings, theme: "dark"})} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${sysSettings.theme === "dark" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-navy-900 border-navy-700 text-slate-400 hover:border-navy-600"}`}>Dark</button>
                  <button onClick={() => setSysSettings({...sysSettings, theme: "light"})} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${sysSettings.theme === "light" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-navy-900 border-navy-700 text-slate-400 hover:border-navy-600"}`}>Light</button>
                  <button onClick={() => setSysSettings({...sysSettings, theme: "system"})} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${sysSettings.theme === "system" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-navy-900 border-navy-700 text-slate-400 hover:border-navy-600"}`}>System</button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">
          
          {/* Notification Settings */}
          <SectionCard title="Notifications" icon={Bell}>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-xl border bg-navy-900 border-navy-700/60 cursor-pointer hover:border-navy-600 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle size={14} className="text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-200">Critical Alerts</p>
                    <p className="text-xs text-slate-500 mt-0.5">Receive immediate notifications for critical faults</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${notifications.critical ? "bg-teal-500" : "bg-navy-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.critical ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <input type="checkbox" className="hidden" checked={notifications.critical} onChange={e => setNotifications({...notifications, critical: e.target.checked})} />
              </label>

              <label className="flex items-center justify-between p-4 rounded-xl border bg-navy-900 border-navy-700/60 cursor-pointer hover:border-navy-600 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <Mail size={14} className="text-teal-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-200">Email Reports</p>
                    <p className="text-xs text-slate-500 mt-0.5">Receive weekly PDF summary reports via email</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${notifications.email ? "bg-teal-500" : "bg-navy-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.email ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <input type="checkbox" className="hidden" checked={notifications.email} onChange={e => setNotifications({...notifications, email: e.target.checked})} />
              </label>
            </div>
          </SectionCard>

          {/* API Status */}
          <SectionCard title="API Status" icon={Cpu}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-slate-400">Live connection status to backend services.</p>
              <button 
                onClick={checkStatus}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors bg-teal-500/10 px-2 py-1 rounded"
              >
                <RefreshCw size={10} /> REFRESH
              </button>
            </div>
            <div className="space-y-3">
              <StatusIndicator 
                label="Database Connection" 
                detail="PostgreSQL operational data"
                status={status.db} 
                icon={Database} 
              />
              <StatusIndicator 
                label="Anomaly Detection Engine" 
                detail="Time-series telemetry analysis"
                status={status.ml} 
                icon={Brain} 
              />
              <StatusIndicator 
                label="Maintenance Copilot" 
                detail={status.llmProvider ? `Powered by ${status.llmProvider}` : "LLM API Key missing"}
                status={status.llm} 
                icon={Monitor} 
              />
              <StatusIndicator 
                label="Google Maps API" 
                detail="Supplier location and distances"
                status={status.maps} 
                icon={MapPin} 
              />
            </div>
          </SectionCard>

          {/* About */}
          <SectionCard title="About SentinAI" icon={Info}>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-2 border-b border-navy-700/50">
                <span className="text-sm text-slate-400">Project Name</span>
                <span className="text-sm font-semibold text-white">SentinAI – Industrial Monitoring</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-navy-700/50">
                <span className="text-sm text-slate-400">Version</span>
                <span className="text-sm font-mono text-teal-400">1.0.0</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-navy-700/50">
                <span className="text-sm text-slate-400">Technology Stack</span>
                <span className="text-sm font-semibold text-white">Next.js 14, FastAPI, PostgreSQL, Tailwind</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-400">Build Date</span>
                <span className="text-sm font-semibold text-white">August 2026</span>
              </div>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
