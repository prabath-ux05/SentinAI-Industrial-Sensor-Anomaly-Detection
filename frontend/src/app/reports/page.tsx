"use client";

import { Download, FileText, Activity } from "lucide-react";

export default function ReportsPage() {
  const downloadReport = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Operational Reports</h2>
        <p className="text-slate-400 mt-1">Download telemetry, fault, and maintenance reports in CSV format.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-navy-800 rounded-xl p-6 border border-navy-700 shadow-lg flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Activity size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Sensor Performance Report</h3>
            <p className="text-sm text-slate-400 mt-2">Comprehensive data on all active sensors, including operating status, health scores, and basic telemetry bounds.</p>
          </div>
          <button 
            onClick={() => downloadReport("http://localhost:8000/api/reports/sensor-performance/csv")}
            className="mt-auto w-full bg-navy-700 hover:bg-navy-600 text-white font-medium px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-navy-600"
          >
            <Download size={18} />
            Download CSV
          </button>
        </div>

        <div className="bg-navy-800 rounded-xl p-6 border border-navy-700 shadow-lg flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-alert-red/20 text-alert-red flex items-center justify-center">
            <FileText size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Fault & Anomaly Report</h3>
            <p className="text-sm text-slate-400 mt-2">Detailed log of all detected anomaly events, critical alerts, severities, and AI-recommended actions.</p>
          </div>
          <button 
             onClick={() => downloadReport("http://localhost:8000/api/reports/faults/csv")}
            className="mt-auto w-full bg-navy-700 hover:bg-navy-600 text-white font-medium px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-navy-600"
          >
            <Download size={18} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
