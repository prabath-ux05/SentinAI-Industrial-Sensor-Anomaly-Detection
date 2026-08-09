"use client";

import { MapPin, Star, ExternalLink, Search } from "lucide-react";

export default function SuppliersPage() {
  const suppliers = [
    {
      id: 1,
      name: "Industrial Tech Supply Co.",
      rating: 4.8,
      address: "124 Manufacturing Blvd, Sector 9",
      distance: "2.4 miles",
      status: "Open Now",
    },
    {
      id: 2,
      name: "Apex Sensor & Valve Solutions",
      rating: 4.5,
      address: "89 Automation Way",
      distance: "5.1 miles",
      status: "Closed (Opens 8 AM)",
    },
    {
      id: 3,
      name: "Global Pipeline Parts",
      rating: 4.2,
      address: "333 Heavy Industry Rd",
      distance: "8.7 miles",
      status: "Open Now",
    }
  ];

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Industrial Suppliers</h2>
        <p className="text-slate-400 mt-1">Locate nearby suppliers for replacement parts and maintenance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 bg-navy-800 rounded-xl border border-navy-700 shadow-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-navy-700">
             <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search for pressure valves, flow meters..." 
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {suppliers.map(sup => (
              <div key={sup.id} className="p-4 rounded-lg bg-navy-900 border border-navy-700 hover:border-teal-500/50 transition-colors cursor-pointer">
                <h4 className="font-bold text-white">{sup.name}</h4>
                <div className="flex items-center gap-1 mt-1 text-sm text-amber-400">
                  <Star size={14} fill="currentColor" />
                  <span>{sup.rating}</span>
                  <span className="text-slate-500 mx-1">•</span>
                  <span className="text-slate-400">{sup.distance}</span>
                </div>
                <p className="text-sm text-slate-400 mt-2">{sup.address}</p>
                <div className="flex justify-between items-center mt-3">
                  <span className={`text-xs font-medium ${sup.status.includes('Open') ? 'text-green-400' : 'text-alert-red'}`}>
                    {sup.status}
                  </span>
                  <button className="text-teal-400 hover:text-teal-300 text-sm flex items-center gap-1">
                    Directions <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="lg:col-span-2 bg-navy-800 rounded-xl border border-navy-700 shadow-lg overflow-hidden flex items-center justify-center bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=industrial&zoom=13&size=800x600&maptype=roadmap&style=feature:all|element:labels.text.fill|color:0x8ec3b9&style=feature:all|element:labels.text.stroke|color:0x1a3646&style=feature:landscape|element:geometry|color:0x2c5a71&style=feature:poi|element:geometry|color:0x406d80&style=feature:road|element:geometry|color:0x29768a&style=feature:road|element:geometry.stroke|color:0x1a3646&style=feature:transit|element:geometry|color:0x406d80&style=feature:water|element:geometry|color:0x0e1626')] bg-cover bg-center">
            {/* Fallback mock map if actual API key isn't provided */}
            <div className="bg-navy-900/80 backdrop-blur-sm p-6 rounded-xl border border-navy-700 text-center max-w-sm">
                <MapPin className="mx-auto text-teal-400 mb-3" size={32} />
                <h3 className="text-lg font-bold text-white">Google Maps Integration</h3>
                <p className="text-sm text-slate-400 mt-2">Map view is simulated. Add GOOGLE_MAPS_API_KEY to .env to enable real interactive maps.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
