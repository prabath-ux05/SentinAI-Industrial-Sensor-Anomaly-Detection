"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  CheckCircle,
  Wrench,
  Clock,
  AlertOctagon,
  Thermometer,
  Gauge,
  Droplets,
  ChevronRight,
  BarChart2,
  AlertTriangle,
  Zap,
  TrendingDown,
  TrendingUp,
  Minus,
  RadioTower,
  RefreshCw,
  Cpu,
  Calendar,
  ShieldCheck,
  Info,
  Factory,
  Settings2,
  ExternalLink,
  Hash,
  Building2,
  Box,
  FileText,
  MapPin,
  Star,
  Phone,
  Globe,
  Navigation,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EquipmentDetail {
  id: number;
  equipment_code: string;
  name: string;
  model: string | null;
  manufacturer: string | null;
  description: string | null;
  status: string | null;
  health_score: number;
  image_url: string | null;
  installation_date: string | null;
  sensor_count: number;
  active_alert_count?: number;
}

interface SensorItem {
  id: number;
  sensor_code: string;
  sensor_type: string;
  location: string | null;
  status: string | null;
  health_score: number;
  latest_reading: number | null;
  latest_reading_time: string | null;
}

interface TelemetryPoint {
  timestamp: string;
  temperature: number | null;
  pressure: number | null;
  flow: number | null;
  sensor_code?: string;
  sensor_type?: string;
  timeLabel?: string;
}

interface AnomalyItem {
  id: number;
  sensor_id: number;
  sensor_code: string;
  anomaly_score: number;
  anomaly_type: string;
  severity: string;
  detected_at: string | null;
  recommended_action: string | null;
  resolved: boolean;
}

interface MaintenanceRecord {
  id: number;
  issue: string | null;
  action_taken: string | null;
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

interface SupplierResult {
  place_id: string;
  name: string;
  rating: number | null;
  total_ratings: number | null;
  address: string;
  vicinity: string | null;
  distance_km: number | null;
  distance_text: string | null;
  open_now: boolean | null;
  phone: string | null;
  website: string | null;
  maps_url: string;
  directions_url: string;
  lat: number | null;
  lng: number | null;
}

interface SuppliersResponse {
  api_enabled: boolean;
  results: SupplierResult[];
  total: number;
  fallback_message: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const PATTERN_META: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  DRIFT:           { label: "Drift",           cls: "bg-purple-500/15 text-purple-300 border-purple-500/30", Icon: TrendingDown },
  SPIKE:           { label: "Spike",           cls: "bg-pink-500/15 text-pink-300 border-pink-500/30",       Icon: TrendingUp   },
  FLATLINE:        { label: "Flatline",        cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", Icon: Minus        },
  NOISE:           { label: "Noise",           cls: "bg-slate-500/15 text-slate-300 border-slate-500/30",    Icon: RadioTower   },
  GENERAL_ANOMALY: { label: "General Anomaly", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",       Icon: Zap          },
};

// ─── Health helpers ───────────────────────────────────────────────────────────

type HealthTier = { label: string; badge: string; dot: string; bar: string; border: string; text: string };

function healthTier(score: number): HealthTier {
  if (score >= 80) return { label: "Healthy",   badge: "bg-green-500/15 text-green-400 border-green-500/30",   dot: "bg-green-400",              bar: "from-green-500 to-emerald-400",  border: "border-green-500/20", text: "text-green-400" };
  if (score >= 50) return { label: "Monitor",   badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400",             bar: "from-yellow-500 to-amber-400",   border: "border-yellow-500/20", text: "text-yellow-400" };
  if (score >= 25) return { label: "Attention", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-500 animate-pulse", bar: "from-orange-500 to-red-400",    border: "border-orange-500/20", text: "text-orange-400" };
  return                   { label: "Critical",  badge: "bg-red-500/15 text-red-400 border-red-500/30",         dot: "bg-red-500 animate-pulse",   bar: "from-red-600 to-rose-500",       border: "border-red-500/30", text: "text-red-400" };
}

function healthColor(s: number) { return s >= 75 ? "text-teal-400" : s >= 50 ? "text-amber-400" : "text-red-400"; }
function healthBarColor(s: number) { return s >= 75 ? "bg-teal-400" : s >= 50 ? "bg-amber-400" : "bg-red-400"; }

function severityBg(s: string) {
  if (s === "CRITICAL") return "bg-red-900/30 border-red-500/40 text-red-200";
  if (s === "HIGH")     return "bg-orange-900/30 border-orange-500/40 text-orange-200";
  if (s === "MEDIUM")   return "bg-amber-900/30 border-amber-500/40 text-amber-200";
  if (s === "LOW")      return "bg-yellow-900/20 border-yellow-500/30 text-yellow-200";
  return "bg-green-900/20 border-green-500/30 text-green-200";
}
function severityDot(s: string) {
  if (s === "CRITICAL") return "bg-red-400";
  if (s === "HIGH") return "bg-orange-400";
  if (s === "MEDIUM") return "bg-amber-400";
  if (s === "LOW") return "bg-yellow-400";
  return "bg-green-400";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sensorUnit(type: string) {
  if (type === "temperature") return "°C";
  if (type === "pressure") return "bar";
  if (type === "flow") return "L/min";
  return "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthBadge({ score }: { score: number }) {
  const t = healthTier(score);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border backdrop-blur-sm ${t.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const Icon = severity === "CRITICAL" ? AlertOctagon : severity === "HIGH" ? AlertTriangle : Activity;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${severityBg(severity)}`}>
      <Icon size={11} /> {severity}
    </span>
  );
}

function PatternBadge({ pattern }: { pattern: string }) {
  const meta = PATTERN_META[pattern];
  if (!meta) return <span className="text-xs text-slate-400 font-mono">{pattern}</span>;
  const { label, cls, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function EquipmentPlaceholder({ name, score }: { name: string; score: number }) {
  const tier = healthTier(score);
  const n = name.toLowerCase();
  const Icon = n.includes("pump") || n.includes("flow") ? Droplets
    : n.includes("compress") || n.includes("pressure") ? Gauge
    : n.includes("heat") || n.includes("temp") || n.includes("furnace") ? Thermometer
    : n.includes("motor") || n.includes("engine") ? Settings2
    : Factory;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy-950 to-navy-900">
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 ${tier.border} bg-navy-800/80 shadow-lg`}>
        <Icon size={32} className="text-slate-400 opacity-70" />
        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-navy-900 ${tier.dot}`} />
      </div>
      <span className="text-xs font-medium text-slate-600 tracking-wide">No Image Available</span>
    </div>
  );
}

function SensorTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const Icon = t === "temperature" ? Thermometer : t === "pressure" ? Gauge : t === "flow" ? Droplets : Cpu;
  const cls = t === "temperature" ? "text-amber-400" : t === "pressure" ? "text-teal-400" : t === "flow" ? "text-sky-400" : "text-slate-400";
  return <Icon size={13} className={cls} />;
}

function StatTile({ icon: Icon, label, value, color = "text-white", sub }: {
  icon: React.ElementType; label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div className="bg-navy-900/60 rounded-xl p-4 border border-navy-700/60 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center shrink-0 border border-navy-700">
        <Icon size={16} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-0.5">{label}</p>
        <p className={`text-sm font-bold truncate ${color}`} title={String(value)}>{value}</p>
        {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-navy-700 rounded ${className}`} />
);

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label, unit }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; unit: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900/95 border border-navy-600 rounded-lg px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-sm">
      <p className="text-slate-400 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-white font-bold tabular-nums">{p.value?.toFixed(2)} <span className="text-slate-400 font-normal">{unit}</span></p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EquipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [detail, setDetail] = useState<EquipmentDetail | null>(null);
  const [sensors, setSensors] = useState<SensorItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [alerts, setAlerts] = useState<AnomalyItem[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Nearby suppliers state ─────────────────────────────────────────────────
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierResult[]>([]);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [suppliersApiEnabled, setSuppliersApiEnabled] = useState(true);
  const [suppliersFallback, setSuppliersFallback] = useState<string | null>(null);
  const [suppliersSearched, setSuppliersSearched] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, sensorsRes, telRes, alertsRes, mntRes] = await Promise.all([
        fetch(`${API}/equipment/${id}`),
        fetch(`${API}/equipment/${id}/sensors`),
        fetch(`${API}/equipment/${id}/telemetry?limit=150`),
        fetch(`${API}/equipment/${id}/alerts`),
        fetch(`${API}/equipment/${id}/maintenance?page=1&page_size=20`),
      ]);

      if (!detailRes.ok) throw new Error(detailRes.status === 404 ? "Equipment not found." : "Failed to load equipment details.");

      setDetail(await detailRes.json());
      if (sensorsRes.ok) setSensors(await sensorsRes.json());
      if (telRes.ok) {
        const raw: Omit<TelemetryPoint, "timeLabel">[] = await telRes.json();
        setTelemetry(raw.map(r => ({
          ...r,
          timeLabel: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        })));
      }
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (mntRes.ok) { const d = await mntRes.json(); setMaintenance(d.items); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-7 w-36" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1"><Skeleton className="h-9 w-80" /><Skeleton className="h-4 w-52" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Skeleton className="h-[420px] xl:col-span-1 rounded-xl" />
          <Skeleton className="h-[420px] xl:col-span-2 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-5 border border-red-500/20">
          <AlertOctagon className="text-red-400" size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Unable to Load Asset</h2>
        <p className="text-slate-400 text-center max-w-sm mb-6 text-sm">{error}</p>
        <div className="flex gap-3">
          <Link href="/equipment" className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm border border-navy-600 transition-colors">
            ← Back to Equipment
          </Link>
          <button onClick={fetchAll} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm transition-colors">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const tier = healthTier(detail.health_score);
  const alertCount = detail.active_alert_count ?? alerts.length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12 min-h-screen">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/equipment" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Equipment
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-500 font-mono">#{detail.equipment_code}</span>
      </div>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 flex-wrap">
            {detail.name}
            <span className="font-mono text-teal-400 text-lg font-medium bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/15">
              {detail.equipment_code}
            </span>
          </h2>
          <p className="text-slate-400 mt-1.5 text-sm flex items-center gap-2 flex-wrap">
            {detail.manufacturer && <span className="flex items-center gap-1"><Building2 size={12} /> {detail.manufacturer}</span>}
            {detail.model && <><span className="text-slate-700">·</span> <span className="flex items-center gap-1"><Box size={12} /> {detail.model}</span></>}
            {detail.installation_date && <><span className="text-slate-700">·</span> <span className="flex items-center gap-1"><Calendar size={12} /> Installed {new Date(detail.installation_date).toLocaleDateString(undefined, { month: "short", year: "numeric", day: "numeric" })}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <HealthBadge score={detail.health_score} />
          {detail.status && (
            <span className="inline-flex items-center text-xs px-3 py-1.5 rounded-full font-medium bg-navy-800 text-slate-300 border border-navy-700">
              {detail.status}
            </span>
          )}
          {/* Quick links */}
          <div className="w-px h-5 bg-navy-700 hidden sm:block" />
          <Link
            href="/anomalies"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 transition-colors font-semibold"
            title="View all anomaly alerts"
          >
            <AlertTriangle size={11} /> Anomalies
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-colors font-semibold"
            title="View reports dashboard"
          >
            <BarChart2 size={11} /> Reports
          </Link>
          <button
            onClick={fetchAll}
            title="Refresh all equipment data"
            className="p-2 rounded-lg bg-navy-800 border border-navy-700 text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Summary Stat Tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={Activity}
          label="Health Score"
          value={`${detail.health_score.toFixed(1)}%`}
          color={tier.text}
        />
        <StatTile
          icon={Cpu}
          label="Sensors"
          value={detail.sensor_count}
          sub={`${sensors.filter(s => (s.health_score || 0) >= 75).length} healthy`}
        />
        <StatTile
          icon={AlertOctagon}
          label="Active Alerts"
          value={alertCount}
          color={alertCount > 0 ? "text-red-400" : "text-green-400"}
          sub={alertCount > 0 ? "Requires attention" : "All clear"}
        />
        <StatTile
          icon={Wrench}
          label="Maintenance"
          value={maintenance.length}
          sub={`${maintenance.filter(m => m.status?.toLowerCase() === "resolved").length} resolved`}
        />
      </div>

      {/* ── Top Row: Image & Info + Sensors ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Info & Image Card */}
        <div className={`bg-navy-800 rounded-xl border overflow-hidden flex flex-col xl:col-span-1 ${detail.health_score < 25 ? "border-red-500/30" : "border-navy-700"}`}>
          <div className="h-56 relative border-b border-navy-700 flex items-center justify-center overflow-hidden">
            {detail.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.image_url} alt={detail.name} className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
            ) : (
              <EquipmentPlaceholder name={detail.name} score={detail.health_score} />
            )}
            {/* Critical overlay pulse */}
            {detail.health_score < 25 && (
              <div className="absolute inset-0 border-2 border-red-500/30 rounded-none pointer-events-none animate-pulse" />
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Info size={13} className="text-teal-400" /> Equipment Profile
            </h3>
            <div className="space-y-3 mb-6">
              {[
                { icon: Hash, label: "Equipment ID", value: detail.equipment_code },
                { icon: Building2, label: "Manufacturer", value: detail.manufacturer || "—" },
                { icon: Box, label: "Model", value: detail.model || "—" },
                { icon: FileText, label: "Description", value: detail.description || "No description available" },
              ].map(({ icon: Ic, label, value }) => (
                <div key={label} className="flex items-start gap-3 text-sm">
                  <Ic size={13} className="text-slate-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 text-xs block mb-0.5">{label}</span>
                    <span className="text-white font-medium block truncate" title={value}>{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4 border-t border-navy-700 space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 text-xs">Overall Health</span>
                <span className={`font-bold text-lg tabular-nums ${tier.text}`}>{detail.health_score.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 bg-navy-900 rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${tier.bar} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, detail.health_score))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Sensors Table */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 flex flex-col xl:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-700 flex justify-between items-center bg-navy-900/30">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu size={15} className="text-teal-400" /> Associated Sensors
            </h3>
            <span className="text-xs text-slate-500 bg-navy-900 px-2.5 py-1 rounded-full border border-navy-700 font-medium">
              {sensors.length} Connected
            </span>
          </div>

          {sensors.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-600 gap-2">
              <div className="w-14 h-14 bg-navy-900 rounded-full flex items-center justify-center border border-navy-700 mb-2">
                <Cpu size={24} className="opacity-30" />
              </div>
              <p className="text-sm font-medium text-slate-400">No sensors linked</p>
              <p className="text-xs text-slate-600">This equipment has no associated sensors yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-navy-900/60 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium text-[10px] uppercase tracking-wider">Sensor ID</th>
                    <th className="px-5 py-3 font-medium text-[10px] uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3 font-medium text-[10px] uppercase tracking-wider">Health</th>
                    <th className="px-5 py-3 font-medium text-[10px] uppercase tracking-wider text-right">Latest Reading</th>
                    <th className="px-5 py-3 font-medium text-[10px] uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700/50">
                  {sensors.map(s => {
                    const unit = sensorUnit(s.sensor_type);
                    return (
                      <tr key={s.id} className="hover:bg-navy-900/40 transition-colors group/row">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/15">
                            {s.sensor_code}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <SensorTypeIcon type={s.sensor_type} />
                            <span className="capitalize text-slate-300">{s.sensor_type}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5" title={`${s.health_score.toFixed(1)}%`}>
                            <span className={`font-bold text-xs tabular-nums ${healthColor(s.health_score)}`}>{s.health_score.toFixed(0)}%</span>
                            <div className="w-14 bg-navy-900 rounded-full h-1.5 hidden sm:block">
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${healthBarColor(s.health_score)}`} style={{ width: `${Math.max(0, Math.min(100, s.health_score))}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {s.latest_reading !== null ? (
                            <div>
                              <span className="font-mono text-slate-200 font-medium tabular-nums">
                                {s.latest_reading.toFixed(2)}
                                <span className="text-slate-500 font-sans text-xs ml-1">{unit}</span>
                              </span>
                              {s.latest_reading_time && (
                                <p className="text-[10px] text-slate-600 mt-0.5">{new Date(s.latest_reading_time).toLocaleTimeString()}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">No data</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5" title={s.status || "Unknown"}>
                            <span className={`w-2 h-2 rounded-full ${
                              s.status?.toLowerCase() === "active" || s.status?.toLowerCase() === "healthy"
                                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                : s.status?.toLowerCase() === "warning" || s.status?.toLowerCase() === "monitor"
                                ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.4)]"
                                : s.status?.toLowerCase() === "critical"
                                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"
                                : "bg-slate-500"
                            }`} />
                            <span className="text-xs text-slate-400 hidden lg:inline">{s.status || "—"}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Live Telemetry ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={15} className="text-teal-400" /> Live Telemetry Overview
          </h3>
          <span className="text-xs text-slate-500 bg-navy-900 px-2.5 py-1 rounded-full border border-navy-700">
            {telemetry.length} readings
          </span>
        </div>

        {telemetry.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
            <div className="w-14 h-14 bg-navy-900 rounded-full flex items-center justify-center border border-navy-700 mb-2">
              <Activity size={24} className="opacity-30" />
            </div>
            <p className="text-sm font-medium text-slate-400">Awaiting telemetry data</p>
            <p className="text-xs text-slate-600">Not enough readings available to render charts yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <ChartPanel label="Temperature" unit="°C" color="#f59e0b" data={telemetry} dataKey="temperature" icon={Thermometer} />
            <ChartPanel label="Pressure" unit="bar" color="#2dd4bf" data={telemetry} dataKey="pressure" icon={Gauge} />
            <ChartPanel label="Flow" unit="L/min" color="#38bdf8" data={telemetry} dataKey="flow" icon={Droplets} />
          </div>
        )}
      </div>

      {/* ── Nearby Suppliers ── */}
      <NearbySuppliers
        equipmentName={detail.name}
        manufacturer={detail.manufacturer}
        open={suppliersOpen}
        onToggle={() => {
          setSuppliersOpen(prev => !prev);
          if (!suppliersSearched) {
            const query = [detail.name, detail.manufacturer, "parts service repair"]
              .filter(Boolean)
              .join(" ");
            setSuppliersLoading(true);
            setSuppliersError(null);
            setSuppliersSearched(true);
            fetch(`${API}/suppliers?query=${encodeURIComponent(query)}&max_results=10`)
              .then(async (r) => {
                if (!r.ok) throw new Error("Failed to fetch suppliers");
                const data: SuppliersResponse = await r.json();
                setSuppliersApiEnabled(data.api_enabled);
                setSuppliersFallback(data.fallback_message ?? null);
                setSuppliers(data.results);
              })
              .catch((e) => setSuppliersError(e instanceof Error ? e.message : "Unexpected error"))
              .finally(() => setSuppliersLoading(false));
          }
        }}
        loading={suppliersLoading}
        suppliers={suppliers}
        error={suppliersError}
        apiEnabled={suppliersApiEnabled}
        fallbackMessage={suppliersFallback}
      />

      {/* ── Bottom: Alerts & Maintenance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Active Alerts */}
        <div className={`bg-navy-800 rounded-xl border overflow-hidden ${alertCount > 0 ? "border-amber-500/25" : "border-navy-700"}`}>
          <div className="px-5 py-4 border-b border-navy-700 flex items-center gap-2 bg-navy-900/30">
            <AlertOctagon size={14} className="text-amber-400" />
            <h3 className="font-bold text-white text-sm">Active Alerts</h3>
            {alertCount > 0 && (
              <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse tabular-nums">
                {alertCount} Active
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-14 h-14 bg-green-500/5 rounded-full flex items-center justify-center border border-green-500/15 mb-2">
                <ShieldCheck size={24} className="text-green-500/40" />
              </div>
              <p className="text-sm font-medium text-slate-400">All Systems Normal</p>
              <p className="text-xs text-slate-600">No active anomalies for this equipment.</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-700/50 max-h-[420px] overflow-y-auto">
              {alerts.map(a => (
                <div key={a.id} className="px-5 py-4 hover:bg-navy-900/30 transition-colors flex items-start gap-3 border-l-2 border-l-transparent hover:border-l-amber-500">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot(a.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <PatternBadge pattern={a.anomaly_type} />
                      <SeverityBadge severity={a.severity} />
                      <span className="font-mono text-[10px] text-slate-400 bg-navy-900 px-1.5 py-0.5 rounded border border-navy-700 ml-auto">
                        {a.sensor_code}
                      </span>
                    </div>
                    {a.recommended_action && (
                      <p className="text-xs text-slate-300 mb-2 leading-relaxed bg-navy-900/50 p-2.5 rounded-lg border border-navy-700">
                        {a.recommended_action}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock size={10} className="text-slate-600" /> {fmt(a.detected_at)}
                      </p>
                      <Link
                        href={`/anomalies/${a.id}`}
                        className="text-teal-400 hover:text-teal-300 text-xs font-semibold flex items-center gap-1 group/link"
                      >
                        Investigate <ExternalLink size={10} className="group-hover/link:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Maintenance History */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-700 flex items-center gap-2 bg-navy-900/30">
            <Wrench size={14} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">Maintenance History</h3>
            {maintenance.length > 0 && (
              <span className="ml-auto text-[10px] text-slate-500 bg-navy-900 px-2 py-0.5 rounded-full border border-navy-700 font-medium tabular-nums">
                {maintenance.length} records
              </span>
            )}
          </div>
          {maintenance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-14 h-14 bg-navy-900 rounded-full flex items-center justify-center border border-navy-700 mb-2">
                <Wrench size={24} className="text-slate-600 opacity-40" />
              </div>
              <p className="text-sm font-medium text-slate-400">No maintenance history</p>
              <p className="text-xs text-slate-600">No service records found for this equipment.</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-700/50 max-h-[420px] overflow-y-auto">
              {maintenance.map(m => (
                <div key={m.id} className="px-5 py-4 hover:bg-navy-900/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-white leading-snug">{m.issue || "Maintenance performed"}</p>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                      m.status?.toLowerCase() === "resolved"
                        ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                        : m.status?.toLowerCase().includes("progress")
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    }`}>
                      {m.status || "Open"}
                    </span>
                  </div>
                  {m.action_taken && (
                    <p className="text-xs text-slate-400 mb-2 leading-relaxed">{m.action_taken}</p>
                  )}
                  <div className="flex gap-4 text-[11px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1" title="Created date">
                      <Calendar size={10} /> {m.created_at ? new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                    {m.resolved_at && (
                      <span className="flex items-center gap-1 text-teal-500" title="Resolved date">
                        <CheckCircle size={10} /> {new Date(m.resolved_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Nearby Suppliers Component ───────────────────────────────────────────────

function NearbySuppliers({
  equipmentName,
  manufacturer,
  open,
  onToggle,
  loading,
  suppliers,
  error,
  apiEnabled,
  fallbackMessage,
}: {
  equipmentName: string;
  manufacturer: string | null;
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  suppliers: SupplierResult[];
  error: string | null;
  apiEnabled: boolean;
  fallbackMessage: string | null;
}) {
  return (
    <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 border-b border-navy-700 flex items-center gap-3 bg-navy-900/30 hover:bg-navy-900/50 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
          <MapPin size={15} className="text-teal-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-white text-sm">Find Nearby Suppliers</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Suppliers suitable for servicing{equipmentName ? ` ${equipmentName}` : " this equipment"}
            {manufacturer ? ` · ${manufacturer}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!open && (
            <span className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium hidden sm:inline">
              Search
            </span>
          )}
          {open ? (
            <ChevronUp size={16} className="text-slate-400 group-hover:text-white transition-colors" />
          ) : (
            <ChevronDown size={16} className="text-slate-400 group-hover:text-white transition-colors" />
          )}
        </div>
      </button>

      {/* Collapsed: nothing shown */}
      {open && (
        <div className="p-5">
          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mb-5">
            <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300/80 leading-relaxed">
              <span className="font-semibold text-blue-300">Nearby suppliers suitable for servicing this equipment.</span>{" "}
              Availability and inventory are not confirmed. Contact suppliers directly to verify parts and service compatibility.
            </p>
          </div>

          {/* States */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Loader2 size={28} className="text-teal-400 animate-spin" />
              <p className="text-sm text-slate-400">Searching for nearby suppliers…</p>
            </div>
          )}

          {!loading && !apiEnabled && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-navy-900 flex items-center justify-center border border-navy-700">
                <MapPin size={24} className="text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-400">Maps integration unavailable</p>
              <p className="text-xs text-slate-600 text-center max-w-xs">
                {fallbackMessage ?? "Add GOOGLE_MAPS_API_KEY to your .env file to enable live supplier search."}
              </p>
            </div>
          )}

          {!loading && apiEnabled && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertOctagon size={24} className="text-red-400" />
              </div>
              <p className="text-sm font-medium text-slate-400">Search failed</p>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          )}

          {!loading && apiEnabled && !error && suppliers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-navy-900 flex items-center justify-center border border-navy-700">
                <Search size={24} className="text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-400">No suppliers found nearby</p>
              <p className="text-xs text-slate-600">Try broadening your search from the Suppliers page.</p>
            </div>
          )}

          {!loading && apiEnabled && !error && suppliers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map((s) => (
                <SupplierCard key={s.place_id} supplier={s} />
              ))}
            </div>
          )}

          {/* Link to full suppliers page */}
          {!loading && (
            <div className="mt-5 pt-4 border-t border-navy-700 flex justify-end">
              <a
                href="/suppliers"
                className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors"
              >
                Open full Suppliers search <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({ supplier: s }: { supplier: SupplierResult }) {
  return (
    <div className="bg-navy-900/60 rounded-xl border border-navy-700/60 p-4 flex flex-col gap-3 hover:border-teal-500/30 transition-colors group/card">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm leading-snug truncate" title={s.name}>{s.name}</p>
          {s.distance_text && (
            <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 mt-0.5">
              <Navigation size={9} /> {s.distance_text} away
            </span>
          )}
        </div>
        {s.open_now !== null && (
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            s.open_now
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-slate-500/10 text-slate-500 border-slate-500/20"
          }`}>
            {s.open_now ? "Open" : "Closed"}
          </span>
        )}
      </div>

      {/* Rating */}
      {s.rating !== null && (
        <div className="flex items-center gap-1.5">
          <Star size={11} className="text-amber-400 fill-amber-400" />
          <span className="text-xs font-bold text-amber-400">{s.rating.toFixed(1)}</span>
          {s.total_ratings && (
            <span className="text-[10px] text-slate-600">({s.total_ratings.toLocaleString()} reviews)</span>
          )}
        </div>
      )}

      {/* Address */}
      <div className="flex items-start gap-2 text-xs text-slate-400">
        <MapPin size={11} className="text-slate-600 mt-0.5 shrink-0" />
        <span className="leading-relaxed">{s.vicinity || s.address}</span>
      </div>

      {/* Contact */}
      {(s.phone || s.website) && (
        <div className="flex flex-wrap gap-2">
          {s.phone && (
            <a
              href={`tel:${s.phone}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white bg-navy-800 border border-navy-700 hover:border-navy-600 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Phone size={10} /> {s.phone}
            </a>
          )}
          {s.website && (
            <a
              href={s.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white bg-navy-800 border border-navy-700 hover:border-navy-600 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Globe size={10} /> Website
            </a>
          )}
        </div>
      )}

      {/* Action links */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-navy-700/60">
        <a
          href={s.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
        >
          <MapPin size={10} /> View on Maps
        </a>
        <a
          href={s.directions_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-navy-800 text-slate-300 border border-navy-700 hover:border-navy-600 hover:text-white transition-colors"
        >
          <Navigation size={10} /> Directions
        </a>
      </div>
    </div>
  );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────

function ChartPanel({
  label, unit, color, data, dataKey, icon: Icon,
}: {
  label: string; unit: string; color: string; data: TelemetryPoint[];
  dataKey: "temperature" | "pressure" | "flow"; icon: React.ElementType;
}) {
  const values = data.map(d => d[dataKey]).filter((v): v is number => v !== null);
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div>
      {/* Chart header with stats */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color }}>
          <Icon size={13} /> {label}
          <span className="text-slate-600 normal-case font-normal ml-1">({unit})</span>
        </p>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <span title={`Minimum ${label}`}>Min: <span className="text-slate-300 font-bold tabular-nums">{min.toFixed(1)}</span></span>
          <span title={`Average ${label}`}>Avg: <span className="text-slate-300 font-bold tabular-nums">{avg.toFixed(1)}</span></span>
          <span title={`Maximum ${label}`}>Max: <span className="text-slate-300 font-bold tabular-nums">{max.toFixed(1)}</span></span>
          <span className="w-px h-3 bg-navy-600" />
          <span title={`Latest ${label} reading`}>Latest: <span className="font-bold tabular-nums" style={{ color }}>{last.toFixed(2)}</span></span>
        </div>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
            <XAxis
              dataKey="timeLabel"
              stroke="#475569"
              fontSize={9}
              tick={{ fill: "#64748b" }}
              tickMargin={6}
              minTickGap={50}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#475569"
              fontSize={9}
              tick={{ fill: "#64748b" }}
              domain={([dMin, dMax]: readonly [number, number]) => [
                Math.floor(dMin * 0.97),
                Math.ceil(dMax * 1.03),
              ] as [number, number]}
              width={44}
            />
            <RechartsTooltip content={<ChartTip unit={unit} />} cursor={{ stroke: `${color}33`, strokeWidth: 1 }} />
            <ReferenceLine y={avg} stroke={`${color}40`} strokeDasharray="6 4" strokeWidth={1} />
            <Line type="monotoneX" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
