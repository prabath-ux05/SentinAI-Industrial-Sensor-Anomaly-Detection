"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertOctagon,
  CheckCircle,
  XCircle,
  ActivitySquare,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  RadioTower,
  Zap,
  Filter,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnomalySummary {
  total_today: number;
  critical: number;
  high: number;
  resolved: number;
}

interface AnomalyItem {
  id: number;
  sensor_id: number;
  sensor_code: string;
  equipment_name: string;
  anomaly_score: number;
  anomaly_type: string;
  severity: string;
  health_score: number;
  detected_at: string;
  recommended_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

interface AnomaliesResponse {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  items: AnomalyItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const ITEMS_PER_PAGE = 10;

// ─── Pattern config (icon + label + colour) ───────────────────────────────────

const PATTERN_META: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  DRIFT:          { label: "Drift",          cls: "bg-purple-500/15 text-purple-300 border-purple-500/30", Icon: TrendingDown },
  SPIKE:          { label: "Spike",          cls: "bg-pink-500/15 text-pink-300 border-pink-500/30",       Icon: TrendingUp   },
  FLATLINE:       { label: "Flatline",       cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", Icon: Minus        },
  NOISE:          { label: "Noise",          cls: "bg-slate-500/15 text-slate-300 border-slate-500/30",    Icon: RadioTower   },
  GENERAL_ANOMALY:{ label: "General Anomaly",cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",       Icon: Zap          },
};

const SEVERITY_META: Record<string, { cls: string; dotCls: string; ringCls: string }> = {
  CRITICAL: { cls: "bg-red-500/15 text-red-300 border-red-500/40",     dotCls: "bg-red-400",    ringCls: "border-l-red-500"    },
  HIGH:     { cls: "bg-orange-500/15 text-orange-300 border-orange-500/40", dotCls: "bg-orange-400", ringCls: "border-l-orange-500" },
  MEDIUM:   { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",  dotCls: "bg-amber-400",  ringCls: "border-l-amber-500"  },
  LOW:      { cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",dotCls: "bg-yellow-400", ringCls: "border-l-yellow-400" },
  NORMAL:   { cls: "bg-green-500/15 text-green-300 border-green-500/40",  dotCls: "bg-green-400",  ringCls: "border-l-green-500"  },
};

// ─── Helper components ────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.NORMAL;
  const Icon = severity === "CRITICAL" ? AlertOctagon : severity === "HIGH" ? AlertTriangle : Activity;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap ${meta.cls}`}>
      <Icon size={11} />
      {severity}
    </span>
  );
}

function PatternBadge({ pattern }: { pattern: string }) {
  const meta = PATTERN_META[pattern];
  if (!meta) return <span className="text-xs text-slate-500">{pattern}</span>;
  const { label, cls, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border whitespace-nowrap ${cls}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-teal-400" : score >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor = score >= 75 ? "text-teal-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-navy-900 rounded-full h-1.5 flex-shrink-0">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={`font-mono text-xs font-semibold ${textColor}`}>{score.toFixed(0)}%</span>
    </div>
  );
}

function StatusBadge({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border bg-teal-500/15 text-teal-300 border-teal-500/30 whitespace-nowrap">
      <CheckCircle size={11} /> Resolved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/30 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Active
    </span>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-navy-700/50">
          <td className="px-5 py-3.5"><div className="h-4 bg-navy-700 rounded w-24" /></td>
          <td className="px-5 py-3.5"><div className="h-4 bg-navy-700 rounded w-36" /></td>
          <td className="px-5 py-3.5"><div className="h-5 bg-navy-700 rounded-full w-20" /></td>
          <td className="px-5 py-3.5"><div className="h-5 bg-navy-700 rounded-full w-24" /></td>
          <td className="px-5 py-3.5 text-right"><div className="h-4 bg-navy-700 rounded w-14 ml-auto" /></td>
          <td className="px-5 py-3.5"><div className="h-3 bg-navy-700 rounded-full w-20" /></td>
          <td className="px-5 py-3.5"><div className="h-5 bg-navy-700 rounded-full w-20" /></td>
          <td className="px-5 py-3.5"><div className="h-4 bg-navy-700 rounded w-32" /></td>
          <td className="px-5 py-3.5 text-center"><div className="h-7 bg-navy-700 rounded w-20 mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 bg-navy-700 rounded w-28" />
        <div className="h-5 w-5 bg-navy-700 rounded" />
      </div>
      <div className="h-9 bg-navy-700 rounded w-16" />
      <div className="h-2 bg-navy-700 rounded-full w-full mt-4" />
    </div>
  );
}

// ─── Tooltip wrapper ──────────────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-navy-900 border border-navy-600 rounded-lg text-xs text-slate-300 shadow-xl whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy-600" />
      </div>
    </div>
  );
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  current,
  order,
  onSort,
}: {
  label: string;
  field: string;
  current: string;
  order: string;
  onSort: (f: string) => void;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 uppercase tracking-wider text-xs font-semibold whitespace-nowrap transition-colors ${
        active ? "text-teal-400" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
      <ArrowUpDown
        size={11}
        className={`${active ? "text-teal-400" : "text-slate-600"} ${active && order === "asc" ? "rotate-180" : ""} transition-transform`}
      />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnomaliesPage() {
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [patternFilter, setPatternFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("detected_at");
  const [order, setOrder] = useState("desc");

  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const buildParams = useCallback((overridePage?: number) => {
    const p = new URLSearchParams({
      page: (overridePage ?? page).toString(),
      page_size: ITEMS_PER_PAGE.toString(),
      sort_by: sortBy,
      order,
    });
    if (search) p.append("search", search);
    if (severityFilter !== "ALL") p.append("severity", severityFilter);
    if (patternFilter !== "ALL") p.append("pattern", patternFilter);
    if (statusFilter !== "ALL") p.append("status", statusFilter);
    return p;
  }, [page, search, severityFilter, patternFilter, statusFilter, sortBy, order]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/anomalies?${buildParams()}`);
      if (!res.ok) throw new Error("Failed to fetch anomalies");
      const data: AnomaliesResponse = await res.json();
      setAnomalies(data.items);
      setTotalItems(data.total_records);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${API}/anomalies/summary`);
      if (res.ok) setSummary(await res.json());
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Debounced data fetch
  useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Summary fetched once on mount (KPI cards don't need to refetch on every filter)
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleFilterChange(setter: React.Dispatch<React.SetStateAction<any>>, value: any) {
    setter(value);
    setPage(1);
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setOrder(o => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setOrder("desc");
    }
    setPage(1);
  }

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const params = buildParams(1);
      // Remove pagination-only params for export
      params.delete("page");
      params.delete("page_size");
      const res = await fetch(`${API}/anomalies/export/csv?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anomalies_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("CSV export failed. Please try again.");
    } finally {
      setExportingCsv(false);
    }
  }

  // ─── Mark Resolved ──────────────────────────────────────────────────────────

  async function handleResolve(id: number) {
    setResolvingId(id);
    try {
      const res = await fetch(`${API}/anomalies/${id}/resolve`, { method: "PATCH" });
      if (!res.ok) throw new Error("Resolve failed");
      // Optimistic update
      setAnomalies(prev =>
        prev.map(a => (a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a))
      );
      // Refresh summary counts
      fetchSummary();
    } catch {
      alert("Failed to mark as resolved. Please try again.");
    } finally {
      setResolvingId(null);
    }
  }

  // ─── KPI Cards ──────────────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: "Total Anomalies (Today)",
      value: summary?.total_today,
      icon: ActivitySquare,
      iconCls: "text-teal-400",
      valueCls: "text-white",
      borderCls: "border-t-2 border-t-teal-500/50",
      tooltip: "Anomaly events detected in the last 24 hours",
    },
    {
      label: "Critical",
      value: summary?.critical,
      icon: AlertOctagon,
      iconCls: "text-red-400",
      valueCls: "text-red-400",
      borderCls: "border-t-2 border-t-red-500/50",
      tooltip: "Unresolved CRITICAL severity anomalies",
    },
    {
      label: "High",
      value: summary?.high,
      icon: AlertTriangle,
      iconCls: "text-orange-400",
      valueCls: "text-orange-400",
      borderCls: "border-t-2 border-t-orange-500/50",
      tooltip: "Unresolved HIGH severity anomalies",
    },
    {
      label: "Resolved",
      value: summary?.resolved,
      icon: CheckCircle,
      iconCls: "text-teal-400",
      valueCls: "text-teal-400",
      borderCls: "border-t-2 border-t-teal-500/30",
      tooltip: "All-time resolved anomaly events",
    },
  ];

  // ─── Pagination window ───────────────────────────────────────────────────────

  function pageWindow(): number[] {
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      range.push(i);
    }
    return range;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10 min-h-screen">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Anomaly Detection</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Industrial fault monitoring console — real-time anomaly events and sensor health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Refresh data">
            <button
              onClick={() => { fetchData(); fetchSummary(); }}
              disabled={loading}
              className="p-2 rounded-lg bg-navy-800 border border-navy-700 text-slate-400 hover:text-white hover:bg-navy-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </Tooltip>
          <Tooltip content="Export current filter results as CSV">
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Download size={14} className={exportingCsv ? "animate-bounce" : ""} />
              {exportingCsv ? "Exporting…" : "Export CSV"}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          : kpiCards.map(({ label, value, icon: Icon, iconCls, valueCls, borderCls, tooltip }) => (
              <Tooltip key={label} content={tooltip}>
                <div className={`bg-navy-800 rounded-xl p-5 border border-navy-700 hover:border-navy-600 transition-all w-full cursor-default group ${borderCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-medium leading-tight">{label}</span>
                    <Icon size={16} className={`${iconCls} opacity-70 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <div className={`mt-3 text-4xl font-bold tabular-nums ${valueCls}`}>
                    {value ?? "—"}
                  </div>
                </div>
              </Tooltip>
            ))}
      </div>

      {/* ── Main Table Panel ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 shadow-xl overflow-hidden">

        {/* ── Controls Bar ── */}
        <div className="px-5 py-4 border-b border-navy-700 bg-navy-900/40">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by Sensor ID or Equipment name…"
                className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors placeholder:text-slate-600"
                value={search}
                onChange={e => handleFilterChange(setSearch, e.target.value)}
              />
              {search && (
                <button
                  onClick={() => handleFilterChange(setSearch, "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>

            {/* Filter selects */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                <Filter size={13} /> Filters:
              </div>

              <select
                className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
                value={severityFilter}
                onChange={e => handleFilterChange(setSeverityFilter, e.target.value)}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
              </select>

              <select
                className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
                value={patternFilter}
                onChange={e => handleFilterChange(setPatternFilter, e.target.value)}
              >
                <option value="ALL">All Patterns</option>
                <option value="DRIFT">Drift</option>
                <option value="SPIKE">Spike</option>
                <option value="FLATLINE">Flatline</option>
                <option value="NOISE">Noise</option>
                <option value="GENERAL_ANOMALY">General Anomaly</option>
              </select>

              <select
                className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
                value={statusFilter}
                onChange={e => handleFilterChange(setStatusFilter, e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              {(search || severityFilter !== "ALL" || patternFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearch(""); setSeverityFilter("ALL"); setPatternFilter("ALL"); setStatusFilter("ALL"); setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-400 transition-colors underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Active filter summary pill */}
          {(search || severityFilter !== "ALL" || patternFilter !== "ALL" || statusFilter !== "ALL") && (
            <p className="text-xs text-slate-500 mt-2">
              Showing{" "}
              <span className="text-teal-400 font-semibold">{totalItems}</span>{" "}
              filtered result{totalItems !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-navy-900/60 text-slate-500 border-b border-navy-700">
              <tr>
                <th className="px-5 py-3.5 font-medium">
                  <SortableHeader label="Sensor ID" field="sensor_code" current={sortBy} order={order} onSort={handleSort} />
                </th>
                <th className="px-5 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Equipment</th>
                <th className="px-5 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Severity</th>
                <th className="px-5 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Pattern</th>
                <th className="px-5 py-3.5 font-medium text-right">
                  <SortableHeader label="Anom. Score" field="anomaly_score" current={sortBy} order={order} onSort={handleSort} />
                </th>
                <th className="px-5 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Health</th>
                <th className="px-5 py-3.5 font-medium text-slate-400 text-xs uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 font-medium">
                  <SortableHeader label="Detected At" field="detected_at" current={sortBy} order={order} onSort={handleSort} />
                </th>
                <th className="px-5 py-3.5 font-medium text-center text-slate-400 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-navy-700/60">
              {error ? (
                /* ── Error state ── */
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <XCircle size={40} className="text-red-400/60" />
                      <div>
                        <p className="text-white font-medium text-sm mb-1">Failed to load anomalies</p>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">{error}</p>
                      </div>
                      <button
                        onClick={fetchData}
                        className="mt-1 px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-white text-xs transition-colors border border-navy-600"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <TableSkeleton />
              ) : anomalies.length === 0 ? (
                /* ── Empty state ── */
                <tr>
                  <td colSpan={9} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <div className="w-14 h-14 rounded-full bg-navy-700 flex items-center justify-center mb-2">
                        <CheckCircle size={28} className="text-slate-600" />
                      </div>
                      <p className="text-white font-medium text-sm">No anomalies found</p>
                      <p className="text-xs text-slate-600">
                        {search || severityFilter !== "ALL" || patternFilter !== "ALL" || statusFilter !== "ALL"
                          ? "No results match your current filters. Try clearing some filters."
                          : "The system has not detected any anomaly events yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* ── Data rows ── */
                anomalies.map(anomaly => {
                  const sevMeta = SEVERITY_META[anomaly.severity] ?? SEVERITY_META.NORMAL;
                  const isCritical = anomaly.severity === "CRITICAL" && !anomaly.resolved;
                  return (
                    <tr
                      key={anomaly.id}
                      className={`transition-colors hover:bg-navy-900/40 border-l-2 ${isCritical ? "border-l-red-500/70 bg-red-900/5" : "border-l-transparent"}`}
                    >
                      {/* Sensor ID */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-teal-400 text-xs">{anomaly.sensor_code}</span>
                      </td>

                      {/* Equipment */}
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-200 text-sm">{anomaly.equipment_name}</span>
                      </td>

                      {/* Severity */}
                      <td className="px-5 py-3.5">
                        <SeverityBadge severity={anomaly.severity} />
                      </td>

                      {/* Pattern */}
                      <td className="px-5 py-3.5">
                        <PatternBadge pattern={anomaly.anomaly_type} />
                      </td>

                      {/* Anomaly Score */}
                      <td className="px-5 py-3.5 text-right">
                        <Tooltip content={`Raw anomaly score: ${anomaly.anomaly_score}`}>
                          <span className={`font-mono font-bold text-sm tabular-nums ${anomaly.anomaly_score > 0.7 ? "text-red-400" : anomaly.anomaly_score > 0.4 ? "text-amber-400" : "text-teal-400"}`}>
                            {anomaly.anomaly_score.toFixed(3)}
                          </span>
                        </Tooltip>
                      </td>

                      {/* Health Score */}
                      <td className="px-5 py-3.5">
                        <HealthBar score={anomaly.health_score} />
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <StatusBadge resolved={anomaly.resolved} />
                      </td>

                      {/* Detection Time */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs whitespace-nowrap">
                          <Clock size={12} className="text-slate-600 flex-shrink-0" />
                          {new Date(anomaly.detected_at).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/anomalies/${anomaly.id}`}
                            className="px-3 py-1.5 bg-navy-700 hover:bg-teal-600/20 hover:border-teal-500/40 hover:text-teal-300 text-white text-xs font-medium rounded-lg transition-all border border-navy-600 whitespace-nowrap"
                          >
                            View Details
                          </Link>
                          {!anomaly.resolved && (
                            <Tooltip content="Mark this anomaly as resolved">
                              <button
                                onClick={() => handleResolve(anomaly.id)}
                                disabled={resolvingId === anomaly.id}
                                className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 text-xs font-medium rounded-lg transition-all border border-teal-500/30 whitespace-nowrap disabled:opacity-50"
                              >
                                {resolvingId === anomaly.id ? "Resolving…" : "Resolve"}
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!error && (
          <div className="px-5 py-4 border-t border-navy-700 bg-navy-900/30 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-slate-500">
              {totalItems === 0 ? (
                "No results"
              ) : (
                <>
                  Showing{" "}
                  <span className="text-white font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span>
                  {" – "}
                  <span className="text-white font-medium">{Math.min(page * ITEMS_PER_PAGE, totalItems)}</span>
                  {" of "}
                  <span className="text-white font-medium">{totalItems}</span>{" "}
                  result{totalItems !== 1 ? "s" : ""}
                </>
              )}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              {page > 3 && totalPages > 5 && (
                <>
                  <button
                    onClick={() => setPage(1)}
                    className="w-8 h-8 rounded-lg text-xs border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white transition-colors"
                  >
                    1
                  </button>
                  {page > 4 && <span className="text-slate-600 text-xs px-1">…</span>}
                </>
              )}

              {pageWindow().map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  disabled={loading}
                  className={`w-8 h-8 rounded-lg text-xs border transition-colors ${
                    page === n
                      ? "bg-teal-500/20 text-teal-400 border-teal-500/40 font-bold"
                      : "bg-navy-800 text-slate-400 border-navy-700 hover:bg-navy-700 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}

              {page < totalPages - 2 && totalPages > 5 && (
                <>
                  {page < totalPages - 3 && <span className="text-slate-600 text-xs px-1">…</span>}
                  <button
                    onClick={() => setPage(totalPages)}
                    className="w-8 h-8 rounded-lg text-xs border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading || totalItems === 0}
                className="p-1.5 rounded-lg border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
