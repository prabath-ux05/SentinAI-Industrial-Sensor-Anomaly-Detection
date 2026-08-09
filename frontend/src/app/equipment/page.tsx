"use client";

import { useEffect, useState } from "react";
import { Wrench, Settings, Search, Plus } from "lucide-react";

interface Equipment {
  id: number;
  equipment_code: string;
  name: string;
  model: string;
  manufacturer: string;
  status: string;
  health_score: number;
  created_at: string;
}

export default function EquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/equipment");
        if (res.ok) {
          const data = await res.json();
          setEquipmentList(data);
        }
      } catch (error) {
        console.error("Failed to fetch equipment", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipment();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Equipment Management</h2>
          <p className="text-slate-400 mt-1">Manage and monitor industrial assets.</p>
        </div>
        <button className="bg-teal-500 hover:bg-teal-600 text-charcoal font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Plus size={18} />
          Add Equipment
        </button>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 shadow-lg overflow-hidden">
        <div className="p-4 border-b border-navy-700 flex justify-between items-center bg-navy-900/50">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search equipment..." 
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-teal-400">Loading equipment data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-navy-900 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Asset ID</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Manufacturer</th>
                  <th className="px-6 py-4 font-medium">Health Score</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {equipmentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No equipment registered in the system.
                    </td>
                  </tr>
                ) : (
                  equipmentList.map(eq => (
                    <tr key={eq.id} className="hover:bg-navy-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-teal-400">{eq.equipment_code}</td>
                      <td className="px-6 py-4 font-medium text-white">{eq.name}</td>
                      <td className="px-6 py-4 text-slate-400">{eq.manufacturer}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-navy-700 rounded-full h-2 max-w-[100px]">
                            <div 
                              className={`h-2 rounded-full ${eq.health_score > 80 ? 'bg-green-500' : eq.health_score > 50 ? 'bg-alert-amber' : 'bg-alert-red'}`} 
                              style={{ width: `${eq.health_score}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{eq.health_score.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          {eq.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-teal-400 transition-colors p-1">
                          <Settings size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
