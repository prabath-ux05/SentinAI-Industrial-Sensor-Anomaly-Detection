"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  XCircle,
  RefreshCw,
  Plus,
  Cpu,
  Calendar,
  ArrowRight,
  Activity,
  AlertTriangle,
  BarChart2,
  Factory,
  Thermometer,
  Gauge,
  Droplets,
  Settings2,
  AlertOctagon,
  CheckCircle,
} from "lucide-react";
import AddEquipmentModal from "@/components/equipment/AddEquipmentModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EquipmentItem {
  id: number;
  equipment_code: string;
  name: string;
  model: string | null;
  manufacturer: string | null;
  description: string | null;
  status: string | null;
  health_score: number;
  created_at: string;
  image_url: string | null;
  installation_date: string | null;
  sensor_count: number;
}

interface PaginatedEquipment {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  items: EquipmentItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const ITEMS_PER_PAGE = 12;

// ─── Health helpers ───────────────────────────────────────────────────────────

type HealthTier = { label: string; badge: string; dot: string; bar: string; border: string };

function healthTier(score: number): HealthTier {
  if (score >= 80) return {
    label: "Healthy",
    badge: "bg-green-500/15 text-green-400 border-green-500/30",
    dot: "bg-green-400",
    bar: "from-green-500 to-emerald-400",
    border: "border-green-500/20",
  };
  if (score >= 50) return {
    label: "Monitor",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    dot: "bg-yellow-400",
    bar: "from-yellow-500 to-amber-400",
    border: "border-yellow-500/20",
  };
  if (score >= 25) return {
    label: "Attention",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dot: "bg-orange-500 animate-pulse",
    bar: "from-orange-500 to-red-400",
    border: "border-orange-500/20",
  };
  return {
    label: "Critical",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    dot: "bg-red-500 animate-pulse",
    bar: "from-red-600 to-rose-500",
    border: "border-red-500/30",
  };
}

// ─── Placeholder icon by sensor pattern in name ───────────────────────────────

function EquipmentPlaceholder({ name, score }: { name: string; score: number }) {
  const tier = healthTier(score);
  const n = name.toLowerCase();
  const Icon =
    n.includes("pump") || n.includes("flow") ? Droplets
    : n.includes("compress") || n.includes("pressure") ? Gauge
    : n.includes("heat") || n.includes("temp") || n.includes("furnace") ? Thermometer
    : n.includes("motor") || n.includes("engine") ? Settings2
    : Factory;

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy-950 to-navy-900`}>
      {/* Glowing ring */}
      <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 ${tier.border} bg-navy-800/80 shadow-lg`}>
        <Icon size={26} className="text-slate-400 opacity-70" />
        <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-navy-900 ${tier.dot}`} />
      </div>
      <span className="text-xs font-medium text-slate-600 tracking-wide">No Image</span>
    </div>
  );
}

// ─── Health Status Badge ──────────────────────────────────────────────────────

function HealthBadge({ score }: { score: number }) {
  const t = healthTier(score);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border backdrop-blur-sm ${t.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

// ─── Gradient Health Bar ──────────────────────────────────────────────────────

function HealthBar({ score }: { score: number }) {
  const t = healthTier(score);
  const pct = Math.max(0, Math.min(100, score));
  const textCls = score >= 75 ? "text-teal-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500">Health Score</span>
        <span className={`font-bold tabular-nums ${textCls}`}>{score.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-navy-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${t.bar} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Sensor type icon ─────────────────────────────────────────────────────────

function SensorTypeChip({ type }: { type: string | null }) {
  const t = (type || "").toLowerCase();
  const Icon = t === "temperature" ? Thermometer : t === "pressure" ? Gauge : t === "flow" ? Droplets : Cpu;
  const cls = t === "temperature" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : t === "pressure" ? "text-teal-400 bg-teal-500/10 border-teal-500/20"
    : t === "flow" ? "text-sky-400 bg-sky-500/10 border-sky-500/20"
    : "text-slate-400 bg-slate-500/10 border-slate-500/20";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>
      <Icon size={9} /> {type || "—"}
    </span>
  );
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden animate-pulse flex flex-col">
      <div className="h-44 bg-gradient-to-br from-navy-700/50 to-navy-900/50" />
      <div className="p-5 space-y-4 flex-1">
        <div className="flex justify-between gap-2">
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-navy-700 rounded w-3/4" />
            <div className="h-3 bg-navy-700 rounded w-1/2" />
          </div>
          <div className="h-6 bg-navy-700 rounded-full w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 bg-navy-700 rounded-lg" />
          <div className="h-10 bg-navy-700 rounded-lg" />
          <div className="h-10 bg-navy-700 rounded-lg" />
          <div className="h-10 bg-navy-700 rounded-lg" />
        </div>
        <div className="h-4 bg-navy-700 rounded-full" />
        <div className="h-9 bg-navy-700 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [manufacturerFilter, setManufacturerFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("health_score");
  const [order, setOrder] = useState("asc");

  // Dynamic filter options
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ page: page.toString(), page_size: ITEMS_PER_PAGE.toString(), sort_by: sortBy, order });
    if (search) p.append("search", search);
    if (statusFilter !== "ALL") p.append("status", statusFilter);
    if (healthFilter !== "ALL") p.append("health", healthFilter);
    if (manufacturerFilter !== "ALL") p.append("manufacturer", manufacturerFilter);
    return p;
  }, [page, search, statusFilter, healthFilter, manufacturerFilter, sortBy, order]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/equipment?${buildParams()}`);
      if (!res.ok) throw new Error("Failed to fetch equipment");
      const data: PaginatedEquipment = await res.json();
      setEquipmentList(data.items);
      setTotalItems(data.total_records);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    fetch(`${API}/equipment?page_size=1000`).then(r => r.ok && r.json()).then((d: PaginatedEquipment) => {
      if (!d) return;
      setManufacturers(Array.from(new Set(d.items.map(i => i.manufacturer).filter(Boolean) as string[])).sort());
      setStatuses(Array.from(new Set(d.items.map(i => i.status).filter(Boolean) as string[])).sort());
    }).catch(() => {});
  }, []);

  function resetFilters() {
    setSearch(""); setStatusFilter("ALL"); setHealthFilter("ALL"); setManufacturerFilter("ALL"); setPage(1);
  }

  const hasActiveFilters = search || statusFilter !== "ALL" || healthFilter !== "ALL" || manufacturerFilter !== "ALL";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12 min-h-screen">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Equipment Management</h2>
          <p className="text-slate-400 mt-1 text-sm">Industrial asset inventory, health monitoring &amp; fault tracking.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick links */}
          <Link
            href="/anomalies"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 transition-colors text-xs font-semibold"
            title="View all anomaly alerts"
          >
            <AlertTriangle size={13} /> Anomalies
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-colors text-xs font-semibold"
            title="View reports dashboard"
          >
            <BarChart2 size={13} /> Reports
          </Link>
          <div className="w-px h-6 bg-navy-700 hidden sm:block" />
          <button
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh equipment list"
            className="p-2 rounded-lg bg-navy-800 border border-navy-700 text-slate-400 hover:text-white hover:bg-navy-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm shadow-sm"
            title="Add a new equipment asset"
          >
            <Plus size={15} /> Add Equipment
          </button>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            id="equipment-search"
            type="text"
            placeholder="Search name, ID or manufacturer…"
            className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              title="Clear search"
            >
              <XCircle size={13} />
            </button>
          )}
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mr-0.5">
            <Filter size={12} /> Filters:
          </span>

          <select
            id="filter-status"
            title="Filter by operational status"
            className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Status</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            id="filter-health"
            title="Filter by health bracket"
            className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
            value={healthFilter}
            onChange={e => { setHealthFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Health</option>
            <option value="HEALTHY">🟢 Healthy (≥80%)</option>
            <option value="MONITOR">🟡 Monitor (50–79%)</option>
            <option value="ATTENTION">🟠 Attention (25–49%)</option>
            <option value="CRITICAL">🔴 Critical (&lt;25%)</option>
          </select>

          <select
            id="filter-manufacturer"
            title="Filter by manufacturer"
            className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer max-w-[130px]"
            value={manufacturerFilter}
            onChange={e => { setManufacturerFilter(e.target.value); setPage(1); }}
          >
            <option value="ALL">All Manufacturers</option>
            {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div className="w-px h-5 bg-navy-700 hidden sm:block" />

          <select
            id="sort-by"
            title="Sort order"
            className="bg-navy-900 border border-navy-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
            value={`${sortBy}-${order}`}
            onChange={e => {
              const [s, o] = e.target.value.split("-");
              setSortBy(s); setOrder(o); setPage(1);
            }}
          >
            <option value="health_score-asc">↑ Health Score</option>
            <option value="health_score-desc">↓ Health Score</option>
            <option value="name-asc">A–Z Name</option>
            <option value="name-desc">Z–A Name</option>
            <option value="installation_date-desc">Newest Install</option>
            <option value="installation_date-asc">Oldest Install</option>
          </select>
        </div>
      </div>

      {/* ── Active Filters Strip ── */}
      {hasActiveFilters && (
        <div className="flex items-center gap-3 text-xs animate-fade-in">
          <span className="text-slate-500">
            Showing <span className="text-teal-400 font-bold">{totalItems}</span> result{totalItems !== 1 ? "s" : ""}
          </span>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors"
          >
            <XCircle size={11} /> Clear filters
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {error ? (
        /* Error State */
        <div className="bg-navy-800 rounded-xl border border-red-500/20 p-12 text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertOctagon size={28} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Failed to load equipment</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm border border-navy-600 transition-colors"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : equipmentList.length === 0 ? (
        /* Empty State */
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-16 text-center">
          <div className="w-16 h-16 bg-navy-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-700">
            <Factory size={28} className="text-slate-600" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">No equipment found</h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            {hasActiveFilters ? "No assets match your current filters. Try adjusting them." : "Start by registering your first industrial asset."}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-5 px-4 py-2 text-xs bg-navy-700 hover:bg-navy-600 text-slate-300 rounded-lg border border-navy-600 transition-colors">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {equipmentList.map(eq => {
            const tier = healthTier(eq.health_score);
            return (
              <div
                key={eq.id}
                className={`bg-navy-800 rounded-xl border overflow-hidden flex flex-col group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                  eq.health_score < 25
                    ? "border-red-500/30 hover:border-red-400/60 hover:shadow-red-900/20"
                    : "border-navy-700 hover:border-navy-500 hover:shadow-navy-900/40"
                }`}
              >
                {/* Image / Placeholder */}
                <div className="h-44 relative border-b border-navy-700 overflow-hidden flex-shrink-0">
                  {eq.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={eq.image_url}
                      alt={eq.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <EquipmentPlaceholder name={eq.name} score={eq.health_score} />
                  )}

                  {/* Health badge overlay */}
                  <div className="absolute top-3 right-3">
                    <HealthBadge score={eq.health_score} />
                  </div>

                  {/* Equipment code chip */}
                  <div className="absolute bottom-3 left-3">
                    <span className="font-mono text-[10px] font-bold text-teal-300 bg-navy-900/80 backdrop-blur-sm px-2 py-0.5 rounded border border-teal-500/20">
                      {eq.equipment_code}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col gap-4">
                  {/* Name & Mfg */}
                  <div>
                    <h3
                      className="text-base font-bold text-white truncate leading-snug"
                      title={eq.name}
                    >
                      {eq.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5" title={eq.manufacturer || ""}>
                      {eq.manufacturer || "Unknown Manufacturer"}
                      {eq.model && <> &middot; <span className="text-slate-500">{eq.model}</span></>}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-navy-900/60 rounded-lg p-2.5 border border-navy-700/60" title="Operational status">
                      <p className="text-slate-600 text-[10px] uppercase tracking-wider font-medium mb-0.5">Status</p>
                      <p className="text-slate-200 text-xs font-semibold truncate">{eq.status || "—"}</p>
                    </div>
                    <div className="bg-navy-900/60 rounded-lg p-2.5 border border-navy-700/60" title="Number of linked sensors">
                      <p className="text-slate-600 text-[10px] uppercase tracking-wider font-medium mb-0.5 flex items-center gap-1">
                        <Cpu size={9} /> Sensors
                      </p>
                      <p className="text-slate-200 text-xs font-semibold">{eq.sensor_count}</p>
                    </div>
                    <div className="col-span-2 bg-navy-900/60 rounded-lg p-2.5 border border-navy-700/60" title="Date this equipment was installed">
                      <p className="text-slate-600 text-[10px] uppercase tracking-wider font-medium mb-0.5 flex items-center gap-1">
                        <Calendar size={9} /> Installed
                      </p>
                      <p className="text-slate-200 text-xs font-semibold">
                        {eq.installation_date ? new Date(eq.installation_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Health Bar */}
                  <HealthBar score={eq.health_score} />

                  {/* Action */}
                  <Link
                    href={`/equipment/${eq.id}`}
                    className={`mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                      tier.label === "Critical"
                        ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                        : "bg-navy-700/40 border-navy-600 text-slate-300 hover:bg-teal-600/15 hover:text-teal-300 hover:border-teal-500/40"
                    }`}
                  >
                    {tier.label === "Critical" ? <AlertOctagon size={13} /> : null}
                    View Details <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!error && !loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-navy-700/60">
          <p className="text-xs text-slate-500">
            Page <span className="text-white font-medium">{page}</span> of{" "}
            <span className="text-white font-medium">{totalPages}</span>
            <span className="text-slate-600 ml-1">· {totalItems} total assets</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              title="Previous page"
              className="p-2 rounded-lg border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = page <= 3 ? i + 1 : i + page - 2;
              if (n < 1 || n > totalPages) return null;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    n === page
                      ? "bg-teal-600 text-white border border-teal-500"
                      : "bg-navy-800 text-slate-400 border border-navy-700 hover:bg-navy-700 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              title="Next page"
              className="p-2 rounded-lg border border-navy-700 bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals & Notifications ── */}
      <AddEquipmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          setSuccessMsg("Equipment added successfully!");
          setTimeout(() => setSuccessMsg(null), 3000);
          fetchData();
        }}
      />
      {successMsg && (
        <div className="fixed bottom-6 right-6 bg-teal-500/10 border border-teal-500/30 text-teal-400 px-4 py-3 rounded-lg shadow-lg font-bold flex items-center gap-2 z-50 backdrop-blur-sm">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}
    </div>
  );
}
