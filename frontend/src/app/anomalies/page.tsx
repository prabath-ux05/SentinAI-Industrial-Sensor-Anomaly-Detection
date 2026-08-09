"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Clock, CheckSquare } from "lucide-react";

interface Alert {
  id: number;
  sensor_code: string;
  severity: string;
  anomaly_type: string;
  detected_at: string;
  recommended_action: string;
  anomaly_score: number;
  resolved: boolean;
}

export default function AnomaliesPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/dashboard/alerts?limit=50");
        if (res.ok) {
          const data = await res.json();
          setAlerts(data);
        }
      } catch (error) {
        console.error("Failed to fetch alerts", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-teal-400">Loading anomalies...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Anomaly Detection</h2>
        <p className="text-slate-400 mt-1">Detailed view of detected sensor anomalies and system alerts.</p>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-navy-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Recent Anomaly Events</h3>
          <span className="text-sm text-slate-400">{alerts.length} events logged</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-navy-900 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Sensor ID</th>
                <th className="px-6 py-4 font-medium">Severity</th>
                <th className="px-6 py-4 font-medium">Pattern / Type</th>
                <th className="px-6 py-4 font-medium">Score</th>
                <th className="px-6 py-4 font-medium">Detection Time</th>
                <th className="px-6 py-4 font-medium">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No anomalies detected recently. System operating normally.
                  </td>
                </tr>
              ) : (
                alerts.map(alert => (
                  <tr key={alert.id} className="hover:bg-navy-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-teal-400">{alert.sensor_code}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-alert-red border border-red-500/30' :
                        alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        alert.severity === 'MEDIUM' ? 'bg-amber-500/20 text-alert-amber border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {alert.severity === 'CRITICAL' ? <AlertTriangle size={12} /> : <Info size={12} />}
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize">{alert.anomaly_type.replace('_', ' ')}</td>
                    <td className="px-6 py-4">{alert.anomaly_score.toFixed(2)}</td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <Clock size={14} className="text-slate-500" />
                      {new Date(alert.detected_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {alert.recommended_action || "Inspect sensor."}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
