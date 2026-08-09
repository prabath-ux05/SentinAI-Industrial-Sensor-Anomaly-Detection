"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  ExternalLink,
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

interface HealthDistribution {
  Healthy: number;
  "Stable / Monitor": number;
  "Attention Required": number;
  Critical: number;
}

interface DashboardSummary {
  system_health: number;
  total_sensors: number;
  healthy_sensors: number;
  anomalous_sensors: number;
  critical_alerts: number;
  health_distribution: HealthDistribution;
}

interface Alert {
  id: number;
  sensor_code: string;
  equipment_name: string;
  anomaly_score: number;
  severity: string;
  anomaly_type: string;
  detected_at: string;
  recommended_action: string;
}

interface TelemetryPoint {
  timestamp: string;
  temperature: number | null;
  pressure: number | null;
  flow: number | null;
  timeLabel: string;
}

interface LiveTableRow {
  timestamp: string;
  temperature: number | null;
  pressure: number | null;
  flow: number | null;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-slate-400">{label}</p>
        <p className="text-white font-bold">
          {payload[0].value?.toFixed(2)} {unit}
        </p>
      </div>
    );
  }
  return null;
};

// ─── Severity badge helper ─────────────────────────────────────────────────────

const SeverityBadge = ({ severity }: { severity: string }) => {
  const cls =
    severity === "CRITICAL"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : severity === "HIGH"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
      : severity === "MEDIUM"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${cls}`}
    >
      {severity}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const MAX_CHART_POINTS = 100;
const POLL_INTERVAL_MS = 5000;
const DASHBOARD_ALERTS_LIMIT = 5;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accumulated telemetry ring buffer (never replaced on poll)
  const telemetryRef = useRef<TelemetryPoint[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);

  // Track which timestamps we have already ingested so we don't duplicate
  const seenTimestamps = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, alertsRes, telemetryRes] = await Promise.all([
        fetch("http://localhost:8000/api/dashboard/summary"),
        fetch(`http://localhost:8000/api/dashboard/alerts?limit=${DASHBOARD_ALERTS_LIMIT}`),
        fetch("http://localhost:8000/api/dashboard/telemetry?limit=100"),
      ]);

      if (!summaryRes.ok || !alertsRes.ok || !telemetryRes.ok) {
        throw new Error("Failed to fetch from backend API");
      }

      setSummary(await summaryRes.json());
      setAlerts(await alertsRes.json());

      const rawTelemetry: Omit<TelemetryPoint, "timeLabel">[] =
        await telemetryRes.json();

      // Only append new readings (de-duplicate by timestamp)
      const newPoints: TelemetryPoint[] = [];
      for (const t of rawTelemetry) {
        if (!seenTimestamps.current.has(t.timestamp)) {
          seenTimestamps.current.add(t.timestamp);
          newPoints.push({
            ...t,
            timeLabel: t.timestamp
              ? new Date(t.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "",
          });
        }
      }

      if (newPoints.length > 0) {
        telemetryRef.current = [
          ...telemetryRef.current,
          ...newPoints,
        ].slice(-MAX_CHART_POINTS);
        setTelemetry([...telemetryRef.current]);
      }

      setError(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(
        "Unable to retrieve live system telemetry. Please check the backend connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── States ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-300 font-medium">
          Initializing Industrial Dashboard…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <AlertOctagon className="text-red-400 mb-4" size={48} />
        <h2 className="text-xl font-bold text-white mb-2">Connection Lost</h2>
        <p className="text-slate-400 text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!summary || (summary.total_sensors === 0 && telemetry.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Activity className="text-slate-600 mb-4" size={48} />
        <h2 className="text-xl font-bold text-white mb-2">
          No telemetry data available.
        </h2>
        <p className="text-slate-400">
          Start the sensor simulator to begin monitoring.
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const healthPct = summary.system_health ?? 0;
  const healthColor =
    healthPct >= 85
      ? "text-teal-400"
      : healthPct >= 60
      ? "text-amber-400"
      : "text-red-400";

  // Latest 10 readings for the live table (most recent first)
  const liveTableRows: LiveTableRow[] = [...telemetry]
    .reverse()
    .slice(0, 10)
    .map((t) => ({
      timestamp: t.timeLabel,
      temperature: t.temperature,
      pressure: t.pressure,
      flow: t.flow,
    }));

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            System Dashboard
          </h2>
          <p className="text-slate-400 mt-1">
            Real-time overview of industrial asset health.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          Auto-refreshes every {POLL_INTERVAL_MS / 1000}s
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">
              System Health
            </span>
            <Activity className="text-teal-400" size={18} />
          </div>
          <div className={`mt-3 text-4xl font-bold ${healthColor}`}>
            {healthPct}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Overall operating efficiency
          </div>
        </div>

        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">
              Healthy Sensors
            </span>
            <CheckCircle className="text-teal-400" size={18} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {summary.healthy_sensors}
            </span>
            <span className="text-slate-500 text-sm">
              / {summary.total_sensors}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Currently stable</div>
        </div>

        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">
              Anomalous
            </span>
            <AlertTriangle className="text-amber-400" size={18} />
          </div>
          <div className="mt-3 text-4xl font-bold text-amber-400">
            {summary.anomalous_sensors}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Requiring inspection
          </div>
        </div>

        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">
              Critical Alerts
            </span>
            <XCircle className="text-red-400" size={18} />
          </div>
          <div className="mt-3 text-4xl font-bold text-red-400">
            {summary.critical_alerts}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Immediate action needed
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Telemetry Charts ── */}
        <div className="lg:col-span-2 bg-navy-800 rounded-xl p-6 border border-navy-700">
          <h3 className="text-base font-bold text-white mb-5">
            Live Telemetry Trends
          </h3>

          {telemetry.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-sm">
              <Activity size={32} className="mb-2 opacity-30" />
              Waiting for telemetry…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Temperature */}
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">
                  Temperature · °C
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={telemetry}
                      margin={{ top: 4, right: 16, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e3a5f"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        tickMargin={6}
                        minTickGap={40}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        domain={([min, max]: [number, number]) => [
                          Math.floor(min * 0.98),
                          Math.ceil(max * 1.02),
                        ]}
                        width={40}
                      />
                      <Tooltip
                        content={<ChartTooltip unit="°C" />}
                        cursor={{ stroke: "#f59e0b33", strokeWidth: 1 }}
                      />
                      <Line
                        type="monotoneX"
                        dataKey="temperature"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pressure */}
              <div>
                <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">
                  Pressure · bar
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={telemetry}
                      margin={{ top: 4, right: 16, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e3a5f"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        tickMargin={6}
                        minTickGap={40}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        domain={([min, max]: [number, number]) => [
                          Math.floor(min * 0.98),
                          Math.ceil(max * 1.02),
                        ]}
                        width={40}
                      />
                      <Tooltip
                        content={<ChartTooltip unit="bar" />}
                        cursor={{ stroke: "#2dd4bf33", strokeWidth: 1 }}
                      />
                      <Line
                        type="monotoneX"
                        dataKey="pressure"
                        stroke="#2dd4bf"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Flow */}
              <div>
                <p className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2">
                  Flow · L/min
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={telemetry}
                      margin={{ top: 4, right: 16, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e3a5f"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        tickMargin={6}
                        minTickGap={40}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={10}
                        tick={{ fill: "#64748b" }}
                        domain={([min, max]: [number, number]) => [
                          Math.floor(min * 0.98),
                          Math.ceil(max * 1.02),
                        ]}
                        width={40}
                      />
                      <Tooltip
                        content={<ChartTooltip unit="L/min" />}
                        cursor={{ stroke: "#38bdf833", strokeWidth: 1 }}
                      />
                      <Line
                        type="monotoneX"
                        dataKey="flow"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div className="flex flex-col gap-6">
          {/* Health Distribution */}
          <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
            <h3 className="text-base font-bold text-white mb-4">
              Health Distribution
            </h3>
            <div className="space-y-3">
              {(
                [
                  ["Healthy", "bg-teal-400"],
                  ["Stable / Monitor", "bg-blue-400"],
                  ["Attention Required", "bg-amber-400"],
                  ["Critical", "bg-red-500"],
                ] as [keyof HealthDistribution, string][]
              ).map(([category, barClass]) => {
                const count = summary.health_distribution[category] ?? 0;
                const pct =
                  summary.total_sensors > 0
                    ? (count / summary.total_sensors) * 100
                    : 0;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{category}</span>
                      <span className="text-slate-400 font-semibold">
                        {count}
                      </span>
                    </div>
                    <div className="w-full bg-navy-900 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${barClass} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Alerts — fixed height, scrollable */}
          <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Recent Alerts</h3>
              <Link
                href="/anomalies"
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                View All <ExternalLink size={12} />
              </Link>
            </div>

            {/* Fixed height container with internal scroll */}
            <div className="overflow-y-auto max-h-80 space-y-3 pr-1">
              {alerts.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">
                  No recent alerts.
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg bg-navy-900 border border-navy-700"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-sm font-semibold text-teal-400">
                          {alert.sensor_code}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {alert.equipment_name}
                        </span>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      <span className="font-medium text-slate-300">
                        {alert.anomaly_type.replace(/_/g, " ")}
                      </span>
                      &nbsp;· score {alert.anomaly_score?.toFixed(2)}
                    </div>
                    <div className="text-xs text-amber-400/80 mt-1 leading-relaxed">
                      {alert.recommended_action}
                    </div>
                    <div className="text-xs text-slate-600 mt-1.5 text-right">
                      {new Date(alert.detected_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Readings Table ── */}
      <div className="bg-navy-800 rounded-xl p-6 border border-navy-700">
        <h3 className="text-base font-bold text-white mb-4">
          Live Sensor Readings
        </h3>

        {liveTableRows.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">
            No readings yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-navy-700">
                  <th className="pb-3 text-left font-semibold">Timestamp</th>
                  <th className="pb-3 text-right font-semibold">
                    Temperature (°C)
                  </th>
                  <th className="pb-3 text-right font-semibold">
                    Pressure (bar)
                  </th>
                  <th className="pb-3 text-right font-semibold">
                    Flow (L/min)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {liveTableRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`${
                      i === 0
                        ? "text-white"
                        : "text-slate-300"
                    } hover:bg-navy-700/30 transition-colors`}
                  >
                    <td className="py-2.5 text-left font-mono text-xs text-slate-400">
                      {row.timestamp}
                    </td>
                    <td className="py-2.5 text-right font-mono text-amber-400">
                      {row.temperature != null
                        ? row.temperature.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-teal-400">
                      {row.pressure != null
                        ? row.pressure.toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right font-mono text-sky-400">
                      {row.flow != null ? row.flow.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
