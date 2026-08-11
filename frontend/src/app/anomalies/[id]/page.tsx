"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Activity,
  CheckCircle,
  Cpu,
  Wrench,
  Clock,
  AlertOctagon,
  Zap,
  Thermometer,
  Gauge,
  Droplets,
  ChevronRight,
  BarChart2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnomalyDetail {
  id: number;
  anomaly_score: number;
  anomaly_type: string;
  severity: string;
  detected_at: string | null;
  recommended_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
  sensor_id: number;
  sensor_code: string;
  sensor_type: string | null;
  sensor_location: string | null;
  sensor_status: string | null;
  sensor_health_score: number;
  equipment_id: number | null;
  equipment_code: string | null;
  equipment_name: string;
  equipment_model: string | null;
  equipment_manufacturer: string | null;
  equipment_status: string | null;
  equipment_health_score: number | null;
  equipment_installation_date: string | null;
}

interface TelemetryPoint {
  timestamp: string;
  temperature: number | null;
  pressure: number | null;
  flow: number | null;
  anomaly_score: number;
  is_anomaly: boolean;
  severity: string | null;
  timeLabel: string;
}

interface PreviousAnomaly {
  id: number;
  anomaly_score: number;
  anomaly_type: string;
  severity: string;
  detected_at: string | null;
  recommended_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

interface MaintenanceRecord {
  id: number;
  issue: string | null;
  action_taken: string | null;
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

interface PaginatedResponse<T> {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  items: T[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ─── Pattern config ───────────────────────────────────────────────────────────

const PATTERN_META: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  DRIFT:          { label: "Drift",          cls: "bg-purple-500/15 text-purple-300 border-purple-500/30", Icon: TrendingDown },
  SPIKE:          { label: "Spike",          cls: "bg-pink-500/15 text-pink-300 border-pink-500/30",       Icon: TrendingUp   },
  FLATLINE:       { label: "Flatline",       cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", Icon: Minus        },
  NOISE:          { label: "Noise",          cls: "bg-slate-500/15 text-slate-300 border-slate-500/30",    Icon: RadioTower   },
  GENERAL_ANOMALY:{ label: "General Anomaly",cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",       Icon: Zap          },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBg(s: string) {
  if (s === "CRITICAL") return "bg-red-900/30 border-red-500/40 text-red-200";
  if (s === "HIGH")     return "bg-orange-900/30 border-orange-500/40 text-orange-200";
  if (s === "MEDIUM")   return "bg-amber-900/30 border-amber-500/40 text-amber-200";
  if (s === "LOW")      return "bg-yellow-900/20 border-yellow-500/30 text-yellow-200";
  return "bg-green-900/20 border-green-500/30 text-green-200";
}

function severityDot(s: string) {
  if (s === "CRITICAL") return "bg-red-400";
  if (s === "HIGH")     return "bg-orange-400";
  if (s === "MEDIUM")   return "bg-amber-400";
  if (s === "LOW")      return "bg-yellow-400";
  return "bg-green-400";
}

function healthColor(score: number)    { return score >= 75 ? "text-teal-400" : score >= 50 ? "text-amber-400" : "text-red-400"; }
function healthBarColor(score: number) { return score >= 75 ? "bg-teal-400" : score >= 50 ? "bg-amber-400" : "bg-red-400"; }

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function HealthBar({ score }: { score: number }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-2">
        <span className="text-slate-500 text-xs">Health Score</span>
        <span className={`font-bold text-lg ${healthColor(score)}`}>{score.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-navy-900 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${healthBarColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-navy-700 rounded ${className}`} />
);

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

const ChartTip = ({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  unit: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-white font-bold">{p.value?.toFixed(3)} {unit}</p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnomalyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [detail, setDetail] = useState<AnomalyDetail | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [previous, setPrevious] = useState<PreviousAnomaly[]>([]);
  const [previousTotal, setPreviousTotal] = useState(0);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [maintenanceTotal, setMaintenanceTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, telRes, prevRes, mntRes] = await Promise.all([
        fetch(`${API}/anomalies/${id}`),
        fetch(`${API}/anomalies/${id}/sensor-telemetry?limit=150`),
        fetch(`${API}/anomalies/${id}/previous?page=1&page_size=10`),
        fetch(`${API}/anomalies/${id}/maintenance?page=1&page_size=10`),
      ]);

      if (!detailRes.ok) {
        throw new Error(detailRes.status === 404 ? "Anomaly not found." : "Failed to load anomaly.");
      }

      const d: AnomalyDetail = await detailRes.json();
      setDetail(d);

      if (telRes.ok) {
        const raw: Omit<TelemetryPoint, "timeLabel">[] = await telRes.json();
        setTelemetry(
          raw.map(r => ({
            ...r,
            timeLabel: r.timestamp
              ? new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "",
          }))
        );
      }

      if (prevRes.ok) {
        const prevData: PaginatedResponse<PreviousAnomaly> = await prevRes.json();
        setPrevious(prevData.items);
        setPreviousTotal(prevData.total_records);
      }

      if (mntRes.ok) {
        const mntData: PaginatedResponse<MaintenanceRecord> = await mntRes.json();
        setMaintenance(mntData.items);
        setMaintenanceTotal(mntData.total_records);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Resolve handler ────────────────────────────────────────────────────────

  async function handleResolve() {
    if (!detail || detail.resolved) return;
    setResolving(true);
    try {
      const res = await fetch(`${API}/anomalies/${id}/resolve`, { method: "PATCH" });
      if (!res.ok) throw new Error("Resolve failed");
      const data = await res.json();
      setDetail(prev => prev ? { ...prev, resolved: true, resolved_at: data.resolved_at } : prev);
    } catch {
      alert("Failed to mark as resolved. Please try again.");
    } finally {
      setResolving(false);
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-7 w-36" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-96" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-5">
          <AlertOctagon className="text-red-400" size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Unable to Load Anomaly</h2>
        <p className="text-slate-400 text-center max-w-sm mb-6 text-sm">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm border border-navy-600 transition-colors"
          >
            ← Go Back
          </button>
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const detectionISO = detail.detected_at ? new Date(detail.detected_at).toISOString() : null;
  const recentTelemetry = telemetry.slice(-50);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12 min-h-screen">

      {/* ── Breadcrumb / Back ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Anomaly List
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-slate-500 text-sm font-mono">#{detail.id}</span>
      </div>

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 flex-wrap">
            <span className="font-mono text-teal-400">{detail.sensor_code}</span>
            <span className="text-slate-500 text-xl font-normal">· Anomaly #{detail.id}</span>
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            {detail.equipment_name}
            {detail.sensor_location && <> · <span className="text-slate-500">{detail.sensor_location}</span></>}
            &nbsp;·&nbsp; Detected {fmt(detail.detected_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={detail.severity} />
          <PatternBadge pattern={detail.anomaly_type} />
          {detail.resolved ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
              <ShieldCheck size={13} /> Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Active
            </span>
          )}
          {!detail.resolved && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {resolving ? (
                <><RefreshCw size={12} className="animate-spin" /> Resolving…</>
              ) : (
                <><CheckCircle size={12} /> Mark Resolved</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Info Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sensor Information */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Cpu size={14} className="text-teal-400" /> Sensor Information
          </h3>
          <dl className="space-y-3">
            {[
              { label: "Sensor ID",    value: <span className="font-mono font-bold text-teal-400">{detail.sensor_code}</span> },
              { label: "Type",         value: <span className="capitalize">{detail.sensor_type || "—"}</span> },
              { label: "Location",     value: detail.sensor_location || "—" },
              { label: "Status",       value: detail.sensor_status || "—" },
              { label: "Equipment",    value: <span className="font-medium">{detail.equipment_name}</span> },
              ...(detail.equipment_model ? [{ label: "Model", value: detail.equipment_model }] : []),
              ...(detail.equipment_manufacturer ? [{ label: "Manufacturer", value: detail.equipment_manufacturer }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-baseline text-sm gap-2">
                <dt className="text-slate-500 shrink-0">{label}</dt>
                <dd className="text-white text-right">{value}</dd>
              </div>
            ))}
            <div className="pt-3 border-t border-navy-700">
              <HealthBar score={detail.sensor_health_score} />
            </div>
          </dl>
        </div>

        {/* Detection Information */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" /> Detection Information
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between items-center text-sm gap-2">
              <dt className="text-slate-500">Pattern</dt>
              <dd><PatternBadge pattern={detail.anomaly_type} /></dd>
            </div>
            <div className="flex justify-between items-center text-sm gap-2">
              <dt className="text-slate-500">Severity</dt>
              <dd><SeverityBadge severity={detail.severity} /></dd>
            </div>
            <div className="flex justify-between items-baseline text-sm gap-2">
              <dt className="text-slate-500">Anomaly Score</dt>
              <dd className={`font-mono font-bold text-xl tabular-nums ${detail.anomaly_score > 0.7 ? "text-red-400" : detail.anomaly_score > 0.4 ? "text-amber-400" : "text-teal-400"}`}>
                {detail.anomaly_score.toFixed(4)}
              </dd>
            </div>
            <div className="flex justify-between items-baseline text-sm gap-2">
              <dt className="text-slate-500">Detected At</dt>
              <dd className="text-white text-right text-xs">{fmt(detail.detected_at)}</dd>
            </div>
            <div className="flex justify-between items-center text-sm gap-2">
              <dt className="text-slate-500">Status</dt>
              <dd>
                {detail.resolved ? (
                  <span className="text-teal-400 font-medium text-xs">Resolved</span>
                ) : (
                  <span className="text-amber-400 font-medium text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Active
                  </span>
                )}
              </dd>
            </div>
            {detail.resolved && detail.resolved_at && (
              <div className="flex justify-between items-baseline text-sm gap-2">
                <dt className="text-slate-500">Resolved At</dt>
                <dd className="text-white text-right text-xs">{fmt(detail.resolved_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Recommended Action + Equipment Health */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" /> Recommended Action
          </h3>

          {detail.recommended_action ? (
            <div className={`rounded-lg border p-4 text-sm leading-relaxed ${severityBg(detail.severity)}`}>
              {detail.recommended_action}
            </div>
          ) : (
            <p className="text-slate-600 text-sm italic">No action recommendation available for this event.</p>
          )}

          {detail.equipment_health_score !== null && (
            <div className="pt-3 border-t border-navy-700 space-y-2">
              <HealthBar score={detail.equipment_health_score!} />
              <p className="text-xs text-slate-600 flex items-center gap-1">
                Equipment: <span className="text-slate-400 ml-1">{detail.equipment_name}</span>
              </p>
              {detail.equipment_installation_date && (
                <p className="text-xs text-slate-600">
                  Installed {new Date(detail.equipment_installation_date).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Telemetry Charts ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 size={17} className="text-teal-400" />
            Sensor Telemetry Trends
          </h3>
          <span className="text-xs text-slate-500 bg-navy-900 px-2.5 py-1 rounded-full border border-navy-700">
            {telemetry.length} readings · last 50 shown
          </span>
        </div>

        {telemetry.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
            <Activity size={32} className="opacity-30" />
            <p className="text-sm">No telemetry data available for this sensor.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <ChartPanel label="Temperature" unit="°C"    color="#f59e0b" data={recentTelemetry} dataKey="temperature" detectionTime={detectionISO} />
            <ChartPanel label="Pressure"    unit="bar"   color="#2dd4bf" data={recentTelemetry} dataKey="pressure"    detectionTime={detectionISO} />
            <ChartPanel label="Flow"        unit="L/min" color="#38bdf8" data={recentTelemetry} dataKey="flow"        detectionTime={detectionISO} />
          </div>
        )}
      </div>

      {/* ── Historical Telemetry ── */}
      {telemetry.length > 50 && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={17} className="text-purple-400" />
              Historical Telemetry
            </h3>
            <span className="text-xs text-slate-500 bg-navy-900 px-2.5 py-1 rounded-full border border-navy-700">
              {telemetry.length} readings (full window)
            </span>
          </div>
          <div className="space-y-8">
            <ChartPanel label="Temperature" unit="°C"    color="#f59e0b" data={telemetry} dataKey="temperature" detectionTime={detectionISO} />
            <ChartPanel label="Pressure"    unit="bar"   color="#2dd4bf" data={telemetry} dataKey="pressure"    detectionTime={detectionISO} />
            <ChartPanel label="Flow"        unit="L/min" color="#38bdf8" data={telemetry} dataKey="flow"        detectionTime={detectionISO} />
          </div>
        </div>
      )}

      {/* ── Bottom Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Previous Anomalies */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-700 flex items-center gap-2">
            <AlertOctagon size={14} className="text-amber-400" />
            <h3 className="font-bold text-white text-sm">Previous Anomalies — Same Sensor</h3>
            {previousTotal > 0 && (
              <span className="ml-auto text-xs bg-navy-900 border border-navy-700 text-slate-400 px-2 py-0.5 rounded-full">
                {previousTotal} total
              </span>
            )}
          </div>
          {previous.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
              <ShieldCheck size={28} className="opacity-30" />
              <p className="text-sm">No prior anomalies on record for this sensor.</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-700/60">
              {previous.map(p => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/anomalies/${p.id}`)}
                  className="px-5 py-3.5 hover:bg-navy-900/50 cursor-pointer transition-colors flex items-center gap-3 group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot(p.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <PatternBadge pattern={p.anomaly_type} />
                      <SeverityBadge severity={p.severity} />
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={10} className="text-slate-600" />
                      {fmt(p.detected_at)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`font-mono text-sm font-bold tabular-nums ${p.anomaly_score > 0.7 ? "text-red-400" : "text-amber-400"}`}>
                      {p.anomaly_score.toFixed(3)}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{p.resolved ? "Resolved" : "Active"}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                </div>
              ))}
              {previousTotal > 10 && (
                <p className="px-5 py-3 text-xs text-slate-600 text-center">
                  Showing 10 of {previousTotal} events
                </p>
              )}
            </div>
          )}
        </div>

        {/* Maintenance History */}
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-700 flex items-center gap-2">
            <Wrench size={14} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">Maintenance History</h3>
            {maintenanceTotal > 0 && (
              <span className="ml-auto text-xs bg-navy-900 border border-navy-700 text-slate-400 px-2 py-0.5 rounded-full">
                {detail.equipment_name}
              </span>
            )}
          </div>
          {maintenance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
              <Wrench size={28} className="opacity-30" />
              <p className="text-sm">No maintenance records found for this equipment.</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-700/60">
              {maintenance.map(m => (
                <div key={m.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{m.issue || "Maintenance performed"}</p>
                      {m.action_taken && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{m.action_taken}</p>
                      )}
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {fmt(m.created_at)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        m.status?.toLowerCase() === "resolved"
                          ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                          : m.status?.toLowerCase().includes("progress")
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                      }`}>
                        {m.status || "Open"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {maintenanceTotal > 10 && (
                <p className="px-5 py-3 text-xs text-slate-600 text-center">
                  Showing 10 of {maintenanceTotal} records
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────

function ChartPanel({
  label, unit, color, data, dataKey, detectionTime,
}: {
  label: string;
  unit: string;
  color: string;
  data: TelemetryPoint[];
  dataKey: "temperature" | "pressure" | "flow";
  detectionTime: string | null;
}) {
  const hasData = data.some(d => d[dataKey] !== null);
  if (!hasData) return null;

  let refLabel: string | undefined;
  if (detectionTime) {
    const detMs = new Date(detectionTime).getTime();
    let closest: TelemetryPoint | null = null;
    let minDiff = Infinity;
    for (const pt of data) {
      if (!pt.timestamp) continue;
      const diff = Math.abs(new Date(pt.timestamp).getTime() - detMs);
      if (diff < minDiff) { minDiff = diff; closest = pt; }
    }
    if (closest && minDiff < 5 * 60 * 1000) refLabel = closest.timeLabel;
  }

  const iconMap = { temperature: Thermometer, pressure: Gauge, flow: Droplets };
  const colorMap = { temperature: "text-amber-400", pressure: "text-teal-400", flow: "text-sky-400" };
  const Icon = iconMap[dataKey];

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5 ${colorMap[dataKey]}`}>
        <Icon size={12} /> {label} <span className="text-slate-600 normal-case font-normal">({unit})</span>
      </p>
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
              domain={([min, max]: readonly [number, number]) => [
                Math.floor(min * 0.97),
                Math.ceil(max * 1.03),
              ] as [number, number]}
              width={44}
            />
            <Tooltip content={<ChartTip unit={unit} />} cursor={{ stroke: `${color}33`, strokeWidth: 1 }} />
            {refLabel && (
              <ReferenceLine
                x={refLabel}
                stroke="#f43f5e"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{ value: "Detection", position: "insideTopLeft", fontSize: 9, fill: "#f43f5e" }}
              />
            )}
            <Line
              type="monotoneX"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
