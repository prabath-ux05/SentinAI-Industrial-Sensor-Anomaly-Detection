"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  Activity,
  RefreshCw,
  Filter,
  ChevronRight,
  AlertTriangle,
  Cpu,
  BarChart2,
  Database,
  ShieldCheck,
  Settings2,
  X,
  AlertOctagon,
  Loader2,
  Play,
  Thermometer,
  Gauge,
  Droplets,
  TrendingUp,
  TrendingDown,
  Clock,
  Hash,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportStats {
  total_sensors: number;
  total_telemetry_records: number;
  total_anomalies: number;
  avg_system_health: number;
  active_anomalies: number;
  resolved_anomalies: number;
  total_equipment: number;
}

interface SensorRow {
  sensor_id: number;
  sensor_code: string;
  sensor_type: string;
  equipment_name: string;
  location: string | null;
  health_score: number;
  status: string | null;
  first_reading: string | null;
  last_reading: string | null;
  total_readings: number;
  avg_temperature: number | null;
  min_temperature: number | null;
  max_temperature: number | null;
  avg_pressure: number | null;
  min_pressure: number | null;
  max_pressure: number | null;
  avg_flow: number | null;
  min_flow: number | null;
  max_flow: number | null;
  anomaly_count: number;
}

interface SensorReport {
  generated_at: string;
  total_sensors: number;
  filters_applied: Record<string, string | number>;
  rows: SensorRow[];
}

interface FaultRow {
  event_id: number;
  sensor_code: string;
  equipment_name: string;
  anomaly_type: string;
  severity: string;
  anomaly_score: number;
  detected_at: string;
  recommended_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

interface FaultReport {
  generated_at: string;
  total_faults: number;
  filters_applied: Record<string, string | number>;
  rows: FaultRow[];
}

interface EquipmentOption { id: number; name: string; equipment_code: string; }
interface SensorOption { id: number; sensor_code: string; sensor_type: string; }

interface Filters {
  date_from: string;
  date_to: string;
  equipment_id: string;
  sensor_id: string;
  severity: string;
  pattern: string;
  resolved: string;
}

type SensorSortKey = keyof SensorRow;
type FaultSortKey = keyof FaultRow;
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const SEVERITY_OPTIONS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const PATTERN_OPTIONS = ["ALL", "DRIFT", "SPIKE", "FLATLINE", "NOISE", "GENERAL_ANOMALY"];
const DEFAULT_FILTERS: Filters = {
  date_from: "", date_to: "", equipment_id: "", sensor_id: "",
  severity: "ALL", pattern: "ALL", resolved: "ALL",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthColor(s: number) {
  return s >= 80 ? "text-teal-400" : s >= 50 ? "text-amber-400" : s >= 25 ? "text-orange-400" : "text-red-400";
}
function healthBarColor(s: number) {
  return s >= 80 ? "from-teal-500 to-emerald-400" : s >= 50 ? "from-amber-500 to-yellow-400"
    : s >= 25 ? "from-orange-500 to-red-400" : "from-red-600 to-rose-500";
}
function severityColor(sev: string) {
  const s = sev.toUpperCase();
  if (s === "CRITICAL") return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s === "HIGH") return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  if (s === "MEDIUM") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (s === "LOW") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-slate-400 bg-slate-500/10 border-slate-500/20";
}
function fmtNum(v: number | null, digits = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(digits);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}
function bigNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function buildParams(filters: Filters, extra?: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.date_from) p.set("date_from", filters.date_from);
  if (filters.date_to) p.set("date_to", filters.date_to);
  if (filters.equipment_id) p.set("equipment_id", filters.equipment_id);
  if (filters.sensor_id) p.set("sensor_id", filters.sensor_id);
  if (filters.pattern && filters.pattern !== "ALL") p.set("pattern", filters.pattern);
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v && v !== "ALL") p.set(k, v); });
  return p;
}
function activeCount(f: Filters): number {
  return [f.date_from, f.date_to, f.equipment_id, f.sensor_id,
    f.severity !== "ALL" ? f.severity : "",
    f.pattern !== "ALL" ? f.pattern : "",
    f.resolved !== "ALL" ? f.resolved : ""].filter(Boolean).length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-navy-700 rounded-xl ${className}`} />
);

function StatCard({ icon: Icon, label, value, sub, valueClass = "text-white", iconClass = "text-slate-400", iconBg = "bg-navy-700" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  valueClass?: string; iconClass?: string; iconBg?: string;
}) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-navy-600 ${iconBg}`}>
        <Icon size={20} className={iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">{label}</p>
        <p className={`text-2xl font-bold tabular-nums leading-none ${valueClass}`}>{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="text-teal-400/60 hover:text-red-400 transition-colors" title="Remove filter">
        <X size={11} />
      </button>
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-slate-600" />;
  return sortDir === "asc" ? <ChevronUp size={11} className="text-teal-400" /> : <ChevronDown size={11} className="text-teal-400" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [sensors, setSensors] = useState<SensorOption[]>([]);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Active view
  const [activeView, setActiveView] = useState<"sensor" | "fault" | null>(null);

  // Sensor report state
  const [sensorReport, setSensorReport] = useState<SensorReport | null>(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [sensorSortKey, setSensorSortKey] = useState<SensorSortKey>("sensor_code");
  const [sensorSortDir, setSensorSortDir] = useState<SortDir>("asc");

  // Fault report state
  const [faultReport, setFaultReport] = useState<FaultReport | null>(null);
  const [faultLoading, setFaultLoading] = useState(false);
  const [faultError, setFaultError] = useState<string | null>(null);
  const [faultSortKey, setFaultSortKey] = useState<FaultSortKey>("detected_at");
  const [faultSortDir, setFaultSortDir] = useState<SortDir>("desc");

  // Per-report downloading states
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  
  // Toast notifications
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const today = new Date().toISOString().split("T")[0];

  // ── Fetch stats ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`${API}/reports/stats`);
      if (!res.ok) throw new Error("Failed to load report statistics");
      setStats(await res.json());
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Load dropdown options ────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    fetch(`${API}/equipment?page_size=200&sort_by=name&order=asc`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEquipment(d.items.map((e: any) => ({ id: e.id, name: e.name, equipment_code: e.equipment_code }))))
      .catch(() => {});
    fetch(`${API}/sensors?limit=200`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSensors(d.map((s: any) => ({ id: s.id, sensor_code: s.sensor_code, sensor_type: s.sensor_type }))))
      .catch(() => {});
  }, [fetchStats]);

  // ── Generate reports ────────────────────────────────────────────────────────

  const generateSensorReport = useCallback(async () => {
    setActiveView("sensor");
    setSensorLoading(true);
    setSensorError(null);
    setSensorReport(null);
    try {
      const p = buildParams(filters);
      const res = await fetch(`${API}/reports/sensor-performance?${p}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const data: SensorReport = await res.json();
      setSensorReport(data);
    } catch (err) {
      setSensorError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSensorLoading(false);
    }
  }, [filters]);

  const generateFaultReport = useCallback(async () => {
    setActiveView("fault");
    setFaultLoading(true);
    setFaultError(null);
    setFaultReport(null);
    try {
      const p = buildParams(filters, {
        severity: filters.severity,
        resolved: filters.resolved !== "ALL" ? (filters.resolved === "YES" ? "true" : "false") : "",
      });
      const res = await fetch(`${API}/reports/faults?${p}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const data: FaultReport = await res.json();
      setFaultReport(data);
    } catch (err) {
      setFaultError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setFaultLoading(false);
    }
  }, [filters]);

  // ── CSV download ─────────────────────────────────────────────────────────────

  async function handleDownload(key: string, url: string) {
    setDownloading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename=([^;]+)/);
      const filename = match ? match[1].replace(/"/g, "") : `${key}.csv`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setToast({ msg: "Report downloaded successfully", type: "success" });
    } catch (err) {
      console.error("Download error:", err);
      setToast({ msg: "Failed to download report", type: "error" });
    } finally {
      setDownloading(prev => ({ ...prev, [key]: false }));
    }
  }

  // ── Filter helpers ───────────────────────────────────────────────────────────

  function setFilter(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }
  function resetFilters() { setFilters(DEFAULT_FILTERS); }
  const numActiveFilters = activeCount(filters);

  // ── Sorting ──────────────────────────────────────────────────────────────────

  function handleSensorSort(col: SensorSortKey) {
    if (col === sensorSortKey) setSensorSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSensorSortKey(col); setSensorSortDir("asc"); }
  }

  const sortedSensorRows = sensorReport?.rows ? [...sensorReport.rows].sort((a, b) => {
    const av = a[sensorSortKey], bv = b[sensorSortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sensorSortDir === "asc" ? cmp : -cmp;
  }) : [];

  function handleFaultSort(col: FaultSortKey) {
    if (col === faultSortKey) setFaultSortDir(d => d === "asc" ? "desc" : "asc");
    else { setFaultSortKey(col); setFaultSortDir("asc"); }
  }

  const sortedFaultRows = faultReport?.rows ? [...faultReport.rows].sort((a, b) => {
    const av = a[faultSortKey], bv = b[faultSortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return faultSortDir === "asc" ? cmp : -cmp;
  }) : [];

  // ── URL builders ─────────────────────────────────────────────────────────────

  const sensorCsvUrl = `${API}/reports/sensor-performance/csv?${buildParams(filters)}`;
  const faultCsvUrl = `${API}/reports/faults/csv?${buildParams(filters, {
    severity: filters.severity,
    resolved: filters.resolved !== "ALL" ? (filters.resolved === "YES" ? "true" : "false") : "",
  })}`;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12 min-h-screen">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Operational Reports</h2>
          <p className="text-slate-400 mt-1.5 text-sm">
            Generate, inspect, and export sensor performance and fault reports.
          </p>
        </div>
        <button onClick={fetchStats} disabled={statsLoading} title="Refresh statistics"
          className="p-2 rounded-lg bg-navy-800 border border-navy-700 text-slate-400 hover:text-white hover:bg-navy-700 transition-colors disabled:opacity-40">
          <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <section>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart2 size={13} className="text-teal-400" /> System Overview
        </p>
        {statsError ? (
          <div className="bg-navy-800 border border-red-500/20 rounded-xl p-5 flex items-center gap-4">
            <AlertOctagon size={18} className="text-red-400 shrink-0" />
            <div className="flex-1"><p className="text-white font-medium text-sm">{statsError}</p></div>
            <button onClick={fetchStats} className="text-xs text-teal-400 font-medium">Retry</button>
          </div>
        ) : statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Cpu} label="Total Sensors" value={bigNum(stats.total_sensors)}
              sub={`${stats.total_equipment} equipment assets`} iconClass="text-teal-400" iconBg="bg-teal-500/10" />
            <StatCard icon={Database} label="Telemetry Records" value={bigNum(stats.total_telemetry_records)}
              sub="All-time readings" iconClass="text-blue-400" iconBg="bg-blue-500/10" />
            <StatCard icon={AlertTriangle} label="Total Anomalies" value={bigNum(stats.total_anomalies)}
              sub={`${stats.active_anomalies} active · ${stats.resolved_anomalies} resolved`}
              valueClass={stats.active_anomalies > 0 ? "text-amber-400" : "text-white"}
              iconClass="text-amber-400" iconBg="bg-amber-500/10" />
            <StatCard icon={ShieldCheck} label="Avg System Health" value={`${stats.avg_system_health.toFixed(1)}%`}
              sub="Across all sensors" valueClass={healthColor(stats.avg_system_health)}
              iconClass={healthColor(stats.avg_system_health)}
              iconBg={stats.avg_system_health >= 75 ? "bg-teal-500/10" : stats.avg_system_health >= 50 ? "bg-amber-500/10" : "bg-red-500/10"} />
          </div>
        ) : null}
      </section>

      {/* ── Filters Panel ── */}
      <section>
        <div className="flex items-center justify-between mb-4 cursor-pointer select-none"
          onClick={() => setFiltersOpen(o => !o)}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Filter size={13} className="text-teal-400" /> Report Filters
            {numActiveFilters > 0 && (
              <span className="bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {numActiveFilters} active
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {numActiveFilters > 0 && (
              <button onClick={e => { e.stopPropagation(); resetFilters(); }}
                className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors">
                <X size={11} /> Clear all
              </button>
            )}
            <ChevronRight size={15} className={`text-slate-500 transition-transform ${filtersOpen ? "rotate-90" : ""}`} />
          </div>
        </div>

        {filtersOpen && (
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Date From</label>
                <input id="filter-date-from" type="date" value={filters.date_from} max={filters.date_to || today}
                  onChange={e => setFilter("date_from", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 [color-scheme:dark]" />
              </div>
              {/* Date To */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Date To</label>
                <input id="filter-date-to" type="date" value={filters.date_to} max={today}
                  onChange={e => setFilter("date_to", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 [color-scheme:dark]" />
              </div>
              {/* Equipment */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Equipment</label>
                <select id="filter-equipment" value={filters.equipment_id} onChange={e => setFilter("equipment_id", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 cursor-pointer">
                  <option value="">All Equipment</option>
                  {equipment.map(e => <option key={e.id} value={String(e.id)}>{e.name} ({e.equipment_code})</option>)}
                </select>
              </div>
              {/* Sensor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Sensor</label>
                <select id="filter-sensor" value={filters.sensor_id} onChange={e => setFilter("sensor_id", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 cursor-pointer">
                  <option value="">All Sensors</option>
                  {sensors.map(s => <option key={s.id} value={String(s.id)}>{s.sensor_code} ({s.sensor_type})</option>)}
                </select>
              </div>
              {/* Severity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Severity <span className="normal-case text-slate-600">(Fault)</span></label>
                <select id="filter-severity" value={filters.severity} onChange={e => setFilter("severity", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 cursor-pointer">
                  {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s === "ALL" ? "All Severities" : s}</option>)}
                </select>
              </div>
              {/* Pattern */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Pattern <span className="normal-case text-slate-600">(Fault)</span></label>
                <select id="filter-pattern" value={filters.pattern} onChange={e => setFilter("pattern", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 cursor-pointer">
                  {PATTERN_OPTIONS.map(p => <option key={p} value={p}>{p === "ALL" ? "All Patterns" : p}</option>)}
                </select>
              </div>
              {/* Resolved */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-medium">Status <span className="normal-case text-slate-600">(Fault)</span></label>
                <select id="filter-resolved" value={filters.resolved} onChange={e => setFilter("resolved", e.target.value)}
                  className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 cursor-pointer">
                  <option value="ALL">All Statuses</option>
                  <option value="NO">Active Only</option>
                  <option value="YES">Resolved Only</option>
                </select>
              </div>
            </div>

            {/* Active filter chips */}
            {numActiveFilters > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-navy-700">
                {filters.date_from && <FilterChip label={`From: ${filters.date_from}`} onRemove={() => setFilter("date_from", "")} />}
                {filters.date_to && <FilterChip label={`To: ${filters.date_to}`} onRemove={() => setFilter("date_to", "")} />}
                {filters.equipment_id && (
                  <FilterChip label={`Equipment: ${equipment.find(e => String(e.id) === filters.equipment_id)?.name || filters.equipment_id}`}
                    onRemove={() => setFilter("equipment_id", "")} />
                )}
                {filters.sensor_id && (
                  <FilterChip label={`Sensor: ${sensors.find(s => String(s.id) === filters.sensor_id)?.sensor_code || filters.sensor_id}`}
                    onRemove={() => setFilter("sensor_id", "")} />
                )}
                {filters.severity !== "ALL" && <FilterChip label={`Severity: ${filters.severity}`} onRemove={() => setFilter("severity", "ALL")} />}
                {filters.pattern !== "ALL" && <FilterChip label={`Pattern: ${filters.pattern}`} onRemove={() => setFilter("pattern", "ALL")} />}
                {filters.resolved !== "ALL" && (
                  <FilterChip label={`Status: ${filters.resolved === "YES" ? "Resolved" : "Active"}`} onRemove={() => setFilter("resolved", "ALL")} />
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Report Cards ── */}
      <section>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <FileText size={13} className="text-teal-400" /> Available Reports
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Sensor Performance Report Card ── */}
          <div className={`bg-navy-800 border rounded-xl overflow-hidden flex flex-col transition-colors ${activeView === "sensor" ? "border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] ring-1 ring-teal-500/50" : "border-teal-500/20 hover:border-teal-500/40"}`}>
            <div className="p-6 border-b border-navy-700 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-navy-600 flex items-center justify-center shrink-0">
                <Activity size={24} className="text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sensor Performance Report</h3>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Aggregated sensor data including operating period, avg/min/max for temperature,
                  pressure &amp; flow, anomaly counts, and current health scores.
                </p>
              </div>
            </div>
            <div className="px-6 py-3 bg-navy-900/40 border-b border-navy-700">
              <p className="text-xs text-slate-500 flex items-start gap-2">
                <Filter size={11} className="mt-0.5 text-teal-400 shrink-0" />
                <span>{numActiveFilters > 0
                  ? [filters.date_from && `From: ${filters.date_from}`, filters.date_to && `To: ${filters.date_to}`,
                    filters.equipment_id && equipment.find(e => String(e.id) === filters.equipment_id)?.name,
                    filters.sensor_id && sensors.find(s => String(s.id) === filters.sensor_id)?.sensor_code,
                  ].filter(Boolean).join(" · ") || "Filters applied"
                  : "All sensors · All dates"}
                </span>
              </p>
            </div>
            <div className="p-6 flex flex-col gap-3 mt-auto">
              <div className="flex gap-2">
                <Link href="/equipment" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-navy-700 text-slate-300 hover:bg-navy-600 border border-navy-600 transition-colors font-medium">
                  <Settings2 size={11} /> Equipment
                </Link>
                <Link href="/anomalies" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-navy-700 text-slate-300 hover:bg-navy-600 border border-navy-600 transition-colors font-medium">
                  <AlertTriangle size={11} /> Anomalies
                </Link>
              </div>
              <div className="flex gap-2">
                <button id="generate-sensor-report" onClick={generateSensorReport} disabled={sensorLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 active:scale-[0.99] ${activeView === "sensor" ? "bg-teal-500 text-white shadow-lg shadow-teal-900/30" : "bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30"}`}>
                  {sensorLoading ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Play size={15} /> Generate Report</>}
                </button>
                <button id="download-sensor-csv" onClick={() => handleDownload("sensor", sensorCsvUrl)} disabled={downloading["sensor"]}
                  title="Download CSV"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-navy-700 hover:bg-navy-600 text-slate-300 border border-navy-600 transition-all disabled:opacity-60">
                  {downloading["sensor"] ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* ── Fault & Anomaly Report Card ── */}
          <div className={`bg-navy-800 border rounded-xl overflow-hidden flex flex-col transition-colors ${activeView === "fault" ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/50" : "border-red-500/20 hover:border-red-500/40"}`}>
            <div className="p-6 border-b border-navy-700 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-navy-600 flex items-center justify-center shrink-0">
                <AlertOctagon size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Fault &amp; Anomaly Report</h3>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Complete log of all anomaly events with severity, pattern type (Spike, Drift, Flatline,
                  Noise), AI-recommended actions, and resolution status.
                </p>
              </div>
            </div>
            <div className="px-6 py-3 bg-navy-900/40 border-b border-navy-700">
              <p className="text-xs text-slate-500 flex items-start gap-2">
                <Filter size={11} className="mt-0.5 text-teal-400 shrink-0" />
                <span>{numActiveFilters > 0
                  ? [filters.date_from && `From: ${filters.date_from}`, filters.date_to && `To: ${filters.date_to}`,
                    filters.severity !== "ALL" && `Severity: ${filters.severity}`,
                    filters.pattern !== "ALL" && `Pattern: ${filters.pattern}`,
                    filters.resolved !== "ALL" && (filters.resolved === "YES" ? "Resolved only" : "Active only"),
                  ].filter(Boolean).join(" · ") || "Filters applied"
                  : "All anomalies · All dates"}
                </span>
              </p>
            </div>
            <div className="p-6 flex flex-col gap-3 mt-auto">
              <div className="flex gap-2">
                <Link href="/anomalies" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-navy-700 text-slate-300 hover:bg-navy-600 border border-navy-600 transition-colors font-medium">
                  <AlertTriangle size={11} /> Anomalies
                </Link>
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-navy-700 text-slate-300 hover:bg-navy-600 border border-navy-600 transition-colors font-medium">
                  <BarChart2 size={11} /> Dashboard
                </Link>
              </div>
              <div className="flex gap-2">
                <button id="generate-fault-report" onClick={generateFaultReport} disabled={faultLoading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 active:scale-[0.99] ${activeView === "fault" ? "bg-red-500 text-white shadow-lg shadow-red-900/30" : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30"}`}>
                  {faultLoading ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Play size={15} /> Generate Report</>}
                </button>
                <button id="download-fault-csv" onClick={() => handleDownload("fault", faultCsvUrl)} disabled={downloading["fault"]}
                  title="Download CSV"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-navy-700 hover:bg-navy-600 text-slate-300 border border-navy-600 transition-all disabled:opacity-60">
                  {downloading["fault"] ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sensor Performance Report Table ── */}
      {activeView === "sensor" && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={13} className="text-teal-400" /> Sensor Performance Results
              {sensorReport && (
                <span className="text-teal-400 font-mono normal-case text-[11px] bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                  {sensorReport.total_sensors} sensors
                </span>
              )}
            </p>
            {sensorReport && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-600 flex items-center gap-1">
                  <Clock size={10} /> Generated {fmtDate(sensorReport.generated_at)}
                </span>
                <button onClick={() => handleDownload("sensor", sensorCsvUrl)} disabled={downloading["sensor"]}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 hover:bg-teal-600/30 transition-colors font-medium">
                  {downloading["sensor"] ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Export CSV
                </button>
              </div>
            )}
          </div>

          {sensorLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : sensorError ? (
            <div className="bg-navy-800 border border-red-500/20 rounded-xl p-10 flex flex-col items-center gap-3">
              <AlertOctagon size={28} className="text-red-400" />
              <p className="text-white font-medium">Failed to generate report</p>
              <p className="text-slate-400 text-sm">{sensorError}</p>
              <button onClick={generateSensorReport} className="mt-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm border border-navy-600 transition-colors flex items-center gap-2">
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          ) : sensorReport && sortedSensorRows.length === 0 ? (
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-16 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-navy-900 rounded-full flex items-center justify-center border border-navy-700 mb-2">
                <Database size={24} className="text-slate-600" />
              </div>
              <p className="text-white font-medium">No sensor data found</p>
              <p className="text-slate-400 text-sm">Try adjusting your filters to broaden the search.</p>
              <button onClick={resetFilters} className="mt-2 text-xs text-teal-400 hover:text-teal-300 underline-offset-2 hover:underline">
                Clear filters
              </button>
            </div>
          ) : sensorReport ? (
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-lg shadow-teal-900/10 border-teal-500/30">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-900/60 border-b border-navy-700">
                    <tr>
                      {([
                        { key: "sensor_code", label: "Sensor ID" },
                        { key: "sensor_type", label: "Type" },
                        { key: "equipment_name", label: "Equipment" },
                        { key: "first_reading", label: "Operating Period" },
                        { key: "avg_temperature", label: "Temp (°C)", icon: Thermometer, color: "text-amber-400" },
                        { key: "avg_pressure", label: "Pressure (bar)", icon: Gauge, color: "text-teal-400" },
                        { key: "avg_flow", label: "Flow (L/min)", icon: Droplets, color: "text-sky-400" },
                        { key: "anomaly_count", label: "Anomalies" },
                        { key: "health_score", label: "Health" },
                        { key: "status", label: "Status" },
                      ] as { key: SensorSortKey; label: string; icon?: React.ElementType; color?: string }[]).map(({ key, label, icon: Ic, color }) => (
                        <th key={key}
                          onClick={() => handleSensorSort(key)}
                          className="px-3 py-3 text-left font-medium text-[10px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-white transition-colors whitespace-nowrap select-none">
                          <div className="flex items-center gap-1.5">
                            {Ic && <Ic size={10} className={color || "text-slate-500"} />}
                            {label}
                            <SortIcon col={key} sortKey={sensorSortKey} sortDir={sensorSortDir} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {sortedSensorRows.map(row => {
                      const SensorIcon = row.sensor_type === "temperature" ? Thermometer
                        : row.sensor_type === "pressure" ? Gauge : row.sensor_type === "flow" ? Droplets : Cpu;
                      const sensorColor = row.sensor_type === "temperature" ? "text-amber-400"
                        : row.sensor_type === "pressure" ? "text-teal-400" : row.sensor_type === "flow" ? "text-sky-400" : "text-slate-400";
                      return (
                        <tr key={row.sensor_id} className="hover:bg-navy-900/30 transition-colors group">
                          {/* Sensor ID */}
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/15">
                              {row.sensor_code}
                            </span>
                          </td>
                          {/* Type */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <SensorIcon size={12} className={sensorColor} />
                              <span className="capitalize text-slate-300 text-xs">{row.sensor_type}</span>
                            </div>
                          </td>
                          {/* Equipment */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5 max-w-[160px]">
                              <Building2 size={11} className="text-slate-600 shrink-0" />
                              <span className="text-slate-300 text-xs truncate" title={row.equipment_name}>{row.equipment_name}</span>
                            </div>
                          </td>
                          {/* Operating Period */}
                          <td className="px-3 py-3">
                            <div className="text-xs text-slate-400 whitespace-nowrap">
                              <p className="flex items-center gap-1"><TrendingUp size={9} className="text-green-500" /> {fmtShortDate(row.first_reading)}</p>
                              <p className="flex items-center gap-1 text-slate-600"><TrendingDown size={9} /> {fmtShortDate(row.last_reading)}</p>
                              <p className="text-slate-600 text-[10px] mt-0.5 tabular-nums">{row.total_readings.toLocaleString()} readings</p>
                            </div>
                          </td>
                          {/* Temperature */}
                          <MetricCell avg={row.avg_temperature} min={row.min_temperature} max={row.max_temperature} unit="°C" color="text-amber-500" />
                          {/* Pressure */}
                          <MetricCell avg={row.avg_pressure} min={row.min_pressure} max={row.max_pressure} unit="bar" color="text-teal-400" />
                          {/* Flow */}
                          <MetricCell avg={row.avg_flow} min={row.min_flow} max={row.max_flow} unit="L/min" color="text-sky-400" />
                          {/* Anomaly Count */}
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold tabular-nums text-sm ${row.anomaly_count > 0 ? "text-amber-400" : "text-slate-500"}`}>
                              {row.anomaly_count}
                            </span>
                          </td>
                          {/* Health Score */}
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1 min-w-[64px]">
                              <span className={`font-bold text-xs tabular-nums ${healthColor(row.health_score)}`}>
                                {row.health_score.toFixed(1)}%
                              </span>
                              <div className="h-1.5 bg-navy-900 rounded-full overflow-hidden w-14">
                                <div className={`h-full rounded-full bg-gradient-to-r ${healthBarColor(row.health_score)} transition-all`}
                                  style={{ width: `${Math.max(0, Math.min(100, row.health_score))}%` }} />
                              </div>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                row.status?.toLowerCase() === "active" || row.status?.toLowerCase() === "healthy"
                                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                                  : row.status?.toLowerCase() === "warning" || row.status?.toLowerCase() === "monitor"
                                  ? "bg-yellow-400"
                                  : row.status?.toLowerCase() === "critical"
                                  ? "bg-red-500 animate-pulse"
                                  : "bg-slate-500"
                              }`} />
                              <span className="text-slate-400 text-xs">{row.status || "—"}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-navy-700 bg-navy-900/30 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Showing <span className="text-white font-medium">{sortedSensorRows.length}</span> sensor{sortedSensorRows.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* ── Fault & Anomaly Report Table ── */}
      {activeView === "fault" && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <AlertOctagon size={13} className="text-red-400" /> Fault &amp; Anomaly Results
              {faultReport && (
                <span className="text-red-400 font-mono normal-case text-[11px] bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                  {faultReport.total_faults} events
                </span>
              )}
            </p>
            {faultReport && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-600 flex items-center gap-1">
                  <Clock size={10} /> Generated {fmtDate(faultReport.generated_at)}
                </span>
                <button onClick={() => handleDownload("fault", faultCsvUrl)} disabled={downloading["fault"]}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition-colors font-medium">
                  {downloading["fault"] ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Export CSV
                </button>
              </div>
            )}
          </div>

          {faultLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : faultError ? (
            <div className="bg-navy-800 border border-red-500/20 rounded-xl p-10 flex flex-col items-center gap-3">
              <AlertOctagon size={28} className="text-red-400" />
              <p className="text-white font-medium">Failed to generate report</p>
              <p className="text-slate-400 text-sm">{faultError}</p>
              <button onClick={generateFaultReport} className="mt-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm border border-navy-600 transition-colors flex items-center gap-2">
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          ) : faultReport && sortedFaultRows.length === 0 ? (
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-16 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-navy-900 rounded-full flex items-center justify-center border border-navy-700 mb-2">
                <ShieldCheck size={24} className="text-slate-600" />
              </div>
              <p className="text-white font-medium">No faults found</p>
              <p className="text-slate-400 text-sm">Try adjusting your filters or checking a different date range.</p>
              <button onClick={resetFilters} className="mt-2 text-xs text-teal-400 hover:text-teal-300 underline-offset-2 hover:underline">
                Clear filters
              </button>
            </div>
          ) : faultReport ? (
            <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-lg shadow-red-900/10 border-red-500/30">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-900/60 border-b border-navy-700">
                    <tr>
                      {([
                        { key: "event_id", label: "Event ID" },
                        { key: "detected_at", label: "Detection Time" },
                        { key: "sensor_code", label: "Sensor" },
                        { key: "equipment_name", label: "Equipment" },
                        { key: "severity", label: "Severity" },
                        { key: "anomaly_type", label: "Pattern" },
                        { key: "anomaly_score", label: "Score" },
                        { key: "resolved", label: "Status" },
                        { key: "recommended_action", label: "Action" },
                      ] as { key: FaultSortKey; label: string }[]).map(({ key, label }) => (
                        <th key={key}
                          onClick={() => handleFaultSort(key)}
                          className="px-4 py-3 text-left font-medium text-[10px] uppercase tracking-wider text-slate-500 cursor-pointer hover:text-white transition-colors whitespace-nowrap select-none">
                          <div className="flex items-center gap-1.5">
                            {label}
                            <SortIcon col={key} sortKey={faultSortKey} sortDir={faultSortDir} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {sortedFaultRows.map(row => (
                      <tr key={row.event_id} className="hover:bg-navy-900/30 transition-colors group">
                        {/* Event ID */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-400">#{row.event_id}</span>
                        </td>
                        {/* Detection Time */}
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs tabular-nums">{fmtDate(row.detected_at)}</span>
                        </td>
                        {/* Sensor */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/15">
                            {row.sensor_code}
                          </span>
                        </td>
                        {/* Equipment */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 max-w-[160px]">
                            <Building2 size={11} className="text-slate-600 shrink-0" />
                            <span className="text-slate-300 text-xs truncate" title={row.equipment_name}>{row.equipment_name}</span>
                          </div>
                        </td>
                        {/* Severity */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${severityColor(row.severity)}`}>
                            {row.severity}
                          </span>
                        </td>
                        {/* Pattern */}
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs uppercase tracking-wider font-medium">{row.anomaly_type.replace("_", " ")}</span>
                        </td>
                        {/* Score */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs tabular-nums text-amber-400">{row.anomaly_score.toFixed(4)}</span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          {row.resolved ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                              <CheckCircle2 size={13} />
                              <span>Resolved</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-500 text-xs">
                              <AlertTriangle size={13} />
                              <span>Active</span>
                            </div>
                          )}
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs line-clamp-2 max-w-[200px]" title={row.recommended_action || "—"}>
                            {row.recommended_action || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-navy-700 bg-navy-900/30 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Showing <span className="text-white font-medium">{sortedFaultRows.length}</span> event{sortedFaultRows.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50 ${
          toast.type === "success" 
            ? "bg-teal-950/90 border-teal-500/30 text-teal-300" 
            : "bg-red-950/90 border-red-500/30 text-red-300"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={18} className="text-teal-400" /> : <XCircle size={18} className="text-red-400" />}
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}

// ─── Metric Cell ──────────────────────────────────────────────────────────────

function MetricCell({ avg, min, max, unit, color }: {
  avg: number | null; min: number | null; max: number | null; unit: string; color: string;
}) {
  if (avg === null) return <td className="px-3 py-3 text-center text-slate-600 text-xs">—</td>;
  return (
    <td className="px-3 py-3">
      <div className="flex flex-col gap-0.5 min-w-[78px]">
        <span className={`font-mono font-bold text-xs tabular-nums ${color}`}>{avg?.toFixed(2)}</span>
        <span className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap">
          {min?.toFixed(1)} – {max?.toFixed(1)} {unit}
        </span>
      </div>
    </td>
  );
}
