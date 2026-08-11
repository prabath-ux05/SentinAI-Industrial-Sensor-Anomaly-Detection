import { useState } from "react";
import { X, Save, AlertCircle } from "lucide-react";

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function AddEquipmentModal({ isOpen, onClose, onSuccess }: AddEquipmentModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    equipment_code: "",
    manufacturer: "",
    model: "",
    description: "",
    installation_date: "",
    status: "Active",
    image_url: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.name.trim()) throw new Error("Equipment name is required");
      if (!formData.equipment_code.trim()) throw new Error("Equipment code is required");
      if (formData.installation_date) {
        const d = new Date(formData.installation_date);
        if (isNaN(d.getTime())) throw new Error("Invalid installation date");
      }

      // Convert payload date to ISO or leave undefined if empty
      const payload = {
        ...formData,
        installation_date: formData.installation_date ? new Date(formData.installation_date).toISOString() : null,
        image_url: formData.image_url || null,
        description: formData.description || null,
        manufacturer: formData.manufacturer || null,
        model: formData.model || null,
      };

      const res = await fetch(`${API}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create equipment");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-2xl shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700/60">
          <h2 className="text-xl font-bold text-white tracking-tight">Add New Equipment</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-navy-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Equipment Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
                placeholder="e.g. Primary Cooling Pump"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Equipment Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.equipment_code}
                onChange={e => setFormData({ ...formData, equipment_code: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
                placeholder="e.g. PMP-001"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
                placeholder="e.g. Siemens"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
                placeholder="e.g. X-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Installation Date</label>
              <input
                type="date"
                value={formData.installation_date}
                onChange={e => setFormData({ ...formData, installation_date: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">Image URL (optional)</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-600 resize-none"
                placeholder="Brief description of the equipment..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-navy-800 border border-transparent hover:border-navy-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-teal-500 hover:bg-teal-400 text-navy-950 flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <span className="animate-spin border-2 border-navy-950/20 border-t-navy-950 rounded-full w-4 h-4" />
              ) : (
                <Save size={16} />
              )}
              {loading ? "Saving..." : "Save Equipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
