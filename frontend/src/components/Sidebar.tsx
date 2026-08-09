import Link from 'next/link';
import { Activity, LayoutDashboard, Wrench, MessageSquare, MapPin, FileText, Settings, LogOut, User } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-navy-900 border-r border-navy-700 flex flex-col text-slate-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-teal-400">SentinAI</h1>
        <p className="text-xs text-slate-500 mt-1">Intelligent Industrial Monitoring</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link href="/anomalies" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <Activity size={20} />
          Anomaly Detection
        </Link>
        <Link href="/equipment" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <Wrench size={20} />
          Equipment
        </Link>
        <Link href="/copilot" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <MessageSquare size={20} />
          Maintenance Copilot
        </Link>
        <Link href="/suppliers" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <MapPin size={20} />
          Suppliers
        </Link>
        <Link href="/reports" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <FileText size={20} />
          Reports
        </Link>
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 hover:text-white transition-colors">
          <Settings size={20} />
          Settings
        </Link>
      </nav>

      <div className="p-4 border-t border-navy-700 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 text-sm">
          <User size={18} />
          Admin Profile
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-alert-red hover:bg-navy-800 rounded-md cursor-pointer transition-colors">
          <LogOut size={18} />
          Logout
        </div>
      </div>
    </div>
  );
}
