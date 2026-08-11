"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin, Star, ExternalLink, Search, Phone, Globe,
  Navigation, Filter, X, Loader2, Building2, AlertTriangle,
  SlidersHorizontal, RefreshCw, Copy, Check, Map,
  ChevronDown, ChevronUp, Zap, Info, Factory,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Supplier {
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

interface ApiResponse {
  api_enabled: boolean;
  results: Supplier[];
  total: number;
  fallback_message: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const EQUIPMENT_PRESETS = [
  { label: "All Industrial",       value: "industrial supplier",          icon: Factory },
  { label: "Pressure Valves",      value: "pressure valve supplier",      icon: Zap },
  { label: "Flow Meters",          value: "flow meter industrial",        icon: Zap },
  { label: "Pump Maintenance",     value: "pump repair maintenance",      icon: Zap },
  { label: "Sensors & Instruments",value: "industrial sensor supplier",   icon: Zap },
  { label: "Pipe & Fittings",      value: "industrial pipe fitting",      icon: Zap },
  { label: "Electrical & Controls",value: "industrial electrical controls",icon: Zap },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Deterministic color from a string – gives each supplier a unique avatar hue */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name
    .split(/[\s&\-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Animated skeleton that mimics the new SupplierCard proportions */
function SkeletonCard() {
  return (
    <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 animate-pulse space-y-4">
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="w-11 h-11 rounded-xl bg-navy-700 shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 bg-navy-700 rounded w-4/5" />
          <div className="h-3 bg-navy-700 rounded w-1/2" />
        </div>
        <div className="h-5 w-14 bg-navy-700 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-navy-700 rounded w-full" />
        <div className="h-3 bg-navy-700 rounded w-3/4" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-9 bg-navy-700 rounded-lg flex-1" />
        <div className="h-9 bg-navy-700 rounded-lg w-28" />
        <div className="h-9 bg-navy-700 rounded-lg w-9" />
      </div>
    </div>
  );
}

/** Star row with half-star support */
function StarRating({ rating, total }: { rating: number | null; total: number | null }) {
  if (rating === null)
    return <span className="text-[11px] text-slate-600 italic">No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={11}
            className={
              i < full
                ? "text-amber-400 fill-amber-400"
                : i === full && half
                ? "text-amber-400 fill-amber-400/50"
                : "text-slate-700"
            }
          />
        ))}
      </div>
      <span className="text-xs font-bold text-amber-300 tabular-nums">{rating.toFixed(1)}</span>
      {total != null && (
        <span className="text-[10px] text-slate-600">({total.toLocaleString()})</span>
      )}
    </div>
  );
}

/** Copy-to-clipboard button with check feedback */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handle}
      title="Copy address"
      className="p-1.5 rounded-md text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all"
    >
      {copied ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
    </button>
  );
}

/** Open/Closed status pill */
function OpenBadge({ open_now }: { open_now: boolean | null }) {
  if (open_now === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
        open_now
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-slate-500/10 text-slate-500 border-slate-600/30"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${open_now ? "bg-green-400 animate-pulse" : "bg-slate-600"}`}
      />
      {open_now ? "Open" : "Closed"}
    </span>
  );
}

/** Supplier logo — coloured initials avatar */
function SupplierAvatar({ name }: { name: string }) {
  const hue = nameToHue(name);
  const initials = getInitials(name);
  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm border select-none"
      style={{
        background: `hsl(${hue},30%,18%)`,
        borderColor: `hsl(${hue},40%,30%)`,
        color: `hsl(${hue},70%,70%)`,
      }}
    >
      {initials || <Building2 size={16} />}
    </div>
  );
}

/** Full supplier card — the main UI unit */
function SupplierCard({
  supplier: s,
  selected,
  onClick,
  rank,
}: {
  supplier: Supplier;
  selected: boolean;
  onClick: () => void;
  rank: number;
}) {
  const address = s.vicinity || s.address;
  const hostname = (() => {
    try { return new URL(s.website ?? "").hostname.replace(/^www\./, ""); }
    catch { return s.website; }
  })();

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden ${
        selected
          ? "bg-teal-900/15 border-teal-500/40 shadow-[0_0_0_1px_rgba(13,148,136,0.2),0_4px_24px_rgba(13,148,136,0.08)]"
          : "bg-navy-900 border-navy-700/70 hover:border-navy-600 hover:bg-navy-800/80 hover:shadow-lg"
      }`}
    >
      {/* Rank stripe */}
      <div
        className={`h-0.5 w-full transition-all ${
          selected ? "bg-gradient-to-r from-teal-500 to-cyan-400" : "bg-navy-700 group-hover:bg-navy-600"
        }`}
      />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* ── Row 1: Avatar + Name + Badge ── */}
        <div className="flex items-start gap-3">
          <SupplierAvatar name={s.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4
                className={`font-bold text-sm leading-snug transition-colors ${
                  selected ? "text-teal-100" : "text-white group-hover:text-slate-100"
                }`}
              >
                {s.name}
              </h4>
              <OpenBadge open_now={s.open_now} />
            </div>
            {s.distance_text && (
              <span className="inline-flex items-center gap-1 text-[10px] text-teal-400/80 mt-0.5">
                <Navigation size={9} />
                {s.distance_text} away
              </span>
            )}
          </div>
        </div>

        {/* ── Row 2: Rating ── */}
        <StarRating rating={s.rating} total={s.total_ratings} />

        {/* ── Row 3: Address ── */}
        <div className="flex items-start gap-1.5">
          <MapPin size={12} className="text-slate-600 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed flex-1 min-w-0">{address}</p>
          <CopyButton text={address} />
        </div>

        {/* ── Row 4: Phone & Website ── */}
        {(s.phone || s.website) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {s.phone && (
              <a
                href={`tel:${s.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-teal-300 transition-colors"
              >
                <Phone size={11} className="text-slate-600" />
                {s.phone}
              </a>
            )}
            {s.website && (
              <a
                href={s.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] text-teal-400/70 hover:text-teal-300 transition-colors truncate max-w-[160px]"
              >
                <Globe size={11} className="text-slate-600 shrink-0" />
                {hostname}
              </a>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="border-t border-navy-700/60" />

        {/* ── Row 5: Action buttons ── */}
        <div className="flex gap-2">
          <a
            href={s.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600/80 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-teal-500/20"
          >
            <Map size={12} />
            Open in Maps
          </a>
          <a
            href={s.directions_url || s.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-navy-700/80 hover:bg-navy-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors border border-navy-600/50 hover:border-navy-500"
          >
            <Navigation size={12} />
            Directions
          </a>
          {s.website && (
            <a
              href={s.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Visit website"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-700/80 hover:bg-navy-700 text-slate-400 hover:text-teal-400 border border-navy-600/50 hover:border-teal-500/30 transition-all"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* ── Disclaimer ── */}
        <p className="text-[9px] text-slate-700 leading-relaxed">
          Nearby industrial supplier — parts availability &amp; inventory not confirmed. Contact supplier directly.
        </p>
      </div>
    </div>
  );
}

// ── Map / Preview Panel ────────────────────────────────────────────────────────

function MapPanel({ selected, apiEnabled }: { selected: Supplier | null; apiEnabled: boolean }) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapUrl =
    selected?.lat && selected?.lng && mapsKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${selected.lat},${selected.lng}&zoom=15&size=800x600&maptype=roadmap` +
        `&markers=color:0x14b8a6%7C${selected.lat},${selected.lng}` +
        `&style=feature:all|element:labels.text.fill|color:0x8ec3b9` +
        `&style=feature:landscape|element:geometry|color:0x0f1c2e` +
        `&style=feature:road|element:geometry|color:0x1e3a5f` +
        `&style=feature:water|element:geometry|color:0x0a1628` +
        `&style=feature:poi|visibility:off` +
        `&key=${mapsKey}`
      : null;

  return (
    <div className="h-full flex flex-col bg-navy-900">
      {mapUrl ? (
        <div className="flex-1 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapUrl} alt="Supplier location map" className="w-full h-full object-cover" />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-navy-900 via-navy-900/70 to-transparent" />
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 bg-navy-900/95 backdrop-blur-sm p-4 rounded-xl border border-navy-700 shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                <SupplierAvatar name={selected.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selected.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{selected.vicinity || selected.address}</p>
                </div>
              </div>
              {selected.distance_text && (
                <p className="text-xs text-teal-400 flex items-center gap-1 mb-3">
                  <Navigation size={10} /> {selected.distance_text} away
                </p>
              )}
              <a
                href={selected.directions_url || selected.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Navigation size={12} /> Get Directions in Google Maps
              </a>
            </div>
          )}
        </div>
      ) : (
        /* No static map available */
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 p-10">
          {/* Decorative map grid */}
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-2xl border border-navy-700 bg-navy-800/50" />
            {/* Grid lines */}
            {[30, 60, 90].map((p) => (
              <div key={p} className="absolute inset-x-0 border-t border-navy-700/50" style={{ top: `${p}%` }} />
            ))}
            {[33, 66].map((p) => (
              <div key={p} className="absolute inset-y-0 border-l border-navy-700/50" style={{ left: `${p}%` }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <MapPin size={20} className="text-teal-500/60" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-teal-500 rounded-full border-2 border-navy-900 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            {selected ? (
              <>
                <p className="text-base font-bold text-white mb-1">{selected.name}</p>
                <p className="text-sm text-slate-400 mb-1">{selected.vicinity || selected.address}</p>
                {selected.distance_text && (
                  <p className="text-xs text-teal-400 flex items-center justify-center gap-1 mb-3">
                    <Navigation size={10} /> {selected.distance_text} away
                  </p>
                )}
                <a
                  href={selected.directions_url || selected.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600/90 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Navigation size={13} /> Get Directions
                </a>
              </>
            ) : apiEnabled ? (
              <>
                <p className="text-sm font-semibold text-slate-300">Map Preview</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Select a supplier from the list to preview its location and get directions.
                </p>
                <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
                  Add <code className="text-teal-400 bg-navy-800 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
                  <code className="text-teal-400 bg-navy-800 px-1 py-0.5 rounded font-mono">frontend/.env.local</code> to enable static map previews.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-300">Maps Unavailable</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Add <code className="text-teal-400 bg-navy-800 px-1 py-0.5 rounded font-mono">GOOGLE_MAPS_API_KEY</code> to{" "}
                  <code className="text-teal-400 bg-navy-800 px-1 py-0.5 rounded font-mono">backend/.env</code> to enable live supplier search.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ message, sub, action }: { message: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center px-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center">
          <Building2 size={26} className="text-slate-600" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-navy-800 rounded-full border border-navy-700 flex items-center justify-center">
          <Search size={11} className="text-slate-600" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-300">{message}</p>
        {sub && <p className="text-xs text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Error State ────────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertTriangle size={24} className="text-red-400/80" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-300">Something went wrong</p>
        <p className="text-xs text-slate-500 mt-1.5 max-w-[220px] leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-lg transition-all hover:bg-teal-500/15"
      >
        <RefreshCw size={11} /> Retry
      </button>
    </div>
  );
}

// ── API Missing State ──────────────────────────────────────────────────────────

function ApiMissingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-400/5 border border-amber-400/15 flex items-center justify-center">
        <Info size={22} className="text-amber-400/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-300">Configuration Required</p>
        <p className="text-xs text-slate-500 mt-1.5 max-w-[240px] leading-relaxed">{message}</p>
      </div>
      <div className="w-full bg-navy-900/80 border border-navy-700 rounded-xl p-4 text-left font-mono text-xs space-y-1.5">
        <p className="text-slate-600"># Add to <span className="text-teal-400">backend/.env</span></p>
        <p className="text-slate-300">
          GOOGLE_MAPS_API_KEY=<span className="text-amber-300">your_key_here</span>
        </p>
        <p className="text-slate-600 mt-2"># Add to <span className="text-teal-400">frontend/.env.local</span></p>
        <p className="text-slate-300">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<span className="text-amber-300">your_key_here</span>
        </p>
      </div>
    </div>
  );
}

// ── Prompt to Search ───────────────────────────────────────────────────────────

function SearchPrompt() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center">
          <MapPin size={26} className="text-teal-500/40" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500/20 rounded-full border border-teal-500/30 flex items-center justify-center">
          <Search size={10} className="text-teal-400" />
        </div>
      </div>
      <p className="text-sm text-slate-400 max-w-[200px] leading-relaxed">
        Select a category above or enter a search term to find nearby industrial suppliers.
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiEnabled, setApiEnabled] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Geolocation
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Search & filter state
  const [query, setQuery] = useState("industrial supplier");
  const [location, setLocation] = useState("");
  const [equipmentType, setEquipmentType] = useState("industrial supplier");
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Search functions ──────────────────────────────────────────────────────

  const searchNearby = useCallback(async (
    coords: { lat: number; lng: number },
    kw: string,
    rating: number,
    open: boolean,
  ) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setHasSearched(true);
    try {
      const p = new URLSearchParams({
        lat: String(coords.lat),
        lng: String(coords.lng),
        query: kw,
        min_rating: String(rating),
        open_now: String(open),
      });
      const res = await fetch(`${API}/suppliers/nearby?${p}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ApiResponse = await res.json();
      setApiEnabled(data.api_enabled);
      setSuppliers(data.results);
      setFallbackMessage(data.fallback_message ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Failed to fetch")
          ? "Cannot reach the SentinAI backend. Please ensure the API server is running."
          : "Failed to load nearby suppliers. Please try again.",
      );
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setGeoLoading(false);
        searchNearby(coords, equipmentType || query, minRating, openNow);
      },
      () => {
        setGeoLoading(false);
        setGeoError("Location access denied. Please search by city instead.");
      },
      { timeout: 8000 },
    );
  }, [equipmentType, query, minRating, openNow, searchNearby]);

  const searchSuppliers = useCallback(
    async (params?: { q?: string; loc?: string; eq?: string; rating?: number; open?: boolean }) => {
      const q = params?.q ?? query;
      const loc = params?.loc ?? location;
      const eq = params?.eq ?? equipmentType;
      const rating = params?.rating ?? minRating;
      const open = params?.open ?? openNow;

      if (userCoords && !loc) return searchNearby(userCoords, eq || q, rating, open);

      setLoading(true);
      setError(null);
      setSelected(null);
      setHasSearched(true);
      try {
        const sp = new URLSearchParams({
          query: eq || q,
          min_rating: String(rating),
          open_now: String(open),
        });
        if (loc) sp.set("location", loc);
        if (userCoords) {
          sp.set("user_lat", String(userCoords.lat));
          sp.set("user_lng", String(userCoords.lng));
        }
        const res = await fetch(`${API}/suppliers?${sp}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data: ApiResponse = await res.json();
        setApiEnabled(data.api_enabled);
        setSuppliers(data.results);
        setFallbackMessage(data.fallback_message ?? null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        setError(
          msg.includes("Failed to fetch")
            ? "Cannot reach the SentinAI backend. Please ensure the API server is running."
            : "Failed to load suppliers. Please try again.",
        );
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    },
    [query, location, equipmentType, minRating, openNow, userCoords, searchNearby],
  );

  // Check API status on mount
  useEffect(() => {
    fetch(`${API}/suppliers/status`)
      .then((r) => r.json())
      .then((d) => {
        setApiEnabled(d.api_configured ?? false);
        if (!d.api_configured)
          setFallbackMessage(
            "Google Maps integration is not configured. Add GOOGLE_MAPS_API_KEY to backend/.env to enable live supplier search.",
          );
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchSuppliers();
  };

  const handleEquipmentPreset = (value: string) => {
    setEquipmentType(value);
    searchSuppliers({ eq: value });
  };

  const clearFilters = () => {
    setMinRating(0);
    setOpenNow(false);
    searchSuppliers({ rating: 0, open: false });
  };

  const hasActiveFilters = minRating > 0 || openNow;
  const openCount = suppliers.filter((s) => s.open_now === true).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-500/20 to-cyan-500/10 rounded-xl border border-teal-500/20 flex items-center justify-center">
            <Building2 size={22} className="text-teal-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Industrial Suppliers</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Locate nearby suppliers for parts, sensors &amp; maintenance services.
            </p>
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {!apiEnabled && (
            <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/15 px-3 py-1.5 rounded-lg">
              <AlertTriangle size={12} /> Maps API not configured
            </div>
          )}
          {hasSearched && !loading && suppliers.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-navy-800 border border-navy-700 px-3 py-1.5 rounded-lg">
                <Building2 size={11} className="text-teal-400" />
                <span className="font-semibold text-white">{suppliers.length}</span> suppliers
              </div>
              {openCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/5 border border-green-500/15 px-3 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  {openCount} open now
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Equipment Category Quick Picks ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-1">Category:</span>
        {EQUIPMENT_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handleEquipmentPreset(p.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
              equipmentType === p.value
                ? "bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_0_1px_rgba(13,148,136,0.1)]"
                : "bg-navy-800/60 border-navy-700 text-slate-400 hover:border-navy-600 hover:text-slate-200 hover:bg-navy-800"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Left: Search + Cards ── */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            {/* Query input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search suppliers..."
                className="w-full bg-navy-800 border border-navy-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:bg-navy-700/50 transition-all"
              />
            </div>
            {/* Location + GPS */}
            <div className="flex gap-2 flex-1 sm:flex-initial">
              <div className="relative flex-1">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City or area..."
                  className="w-full bg-navy-800 border border-navy-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 focus:bg-navy-700/50 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoLoading}
                title="Use my current location"
                className={`px-3 py-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 disabled:opacity-40 ${
                  userCoords
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                    : "bg-navy-800 border-navy-700 hover:border-teal-500/40 text-slate-400 hover:text-teal-400"
                }`}
              >
                {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || geoLoading}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40 shadow-sm hover:shadow-teal-500/20 shrink-0"
            >
              {loading && !geoLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </form>

          {/* Geo error */}
          {geoError && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/15 px-3 py-2 rounded-lg">
              <AlertTriangle size={12} className="shrink-0" /> {geoError}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                showFilters
                  ? "bg-navy-700 border-navy-600 text-white"
                  : "bg-navy-800 border-navy-700 text-slate-400 hover:text-white hover:border-navy-600"
              }`}
            >
              <SlidersHorizontal size={12} />
              Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 bg-teal-400 rounded-full ml-0.5" />}
              {showFilters ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={11} /> Clear
              </button>
            )}
            {suppliers.length > 0 && (
              <span className="ml-auto text-xs text-slate-500 tabular-nums">
                {suppliers.length} result{suppliers.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="bg-navy-800/80 border border-navy-700 rounded-xl p-4 space-y-4">
              {/* Min Rating */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  Minimum Rating
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    className="flex-1 accent-teal-500"
                  />
                  <div className="flex items-center gap-1 text-amber-400 min-w-[3rem] text-sm font-bold">
                    {minRating > 0 ? (
                      <>
                        <Star size={12} fill="currentColor" /> {minRating.toFixed(1)}
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs font-normal">Any</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Open Now toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setOpenNow((v) => !v)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${openNow ? "bg-teal-500" : "bg-navy-700"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${openNow ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </div>
                <span className="text-sm text-slate-300">Open Now Only</span>
              </label>

              <button
                onClick={() => searchSuppliers()}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Apply Filters
              </button>
            </div>
          )}

          {/* ── Results List ── */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-navy-700">
            {/* Loading skeletons */}
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

            {/* API not configured */}
            {!loading && fallbackMessage && !error && (
              <ApiMissingState message={fallbackMessage} />
            )}

            {/* Error */}
            {!loading && error && (
              <ErrorState message={error} onRetry={() => searchSuppliers()} />
            )}

            {/* Empty — searched but no results */}
            {!loading && !error && hasSearched && suppliers.length === 0 && !fallbackMessage && (
              <EmptyState
                message="No Suppliers Found"
                sub="Try broadening your search, adjusting filters, or entering a different city."
                action={
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <X size={10} /> Clear filters
                  </button>
                }
              />
            )}

            {/* Prompt to search */}
            {!loading && !hasSearched && !fallbackMessage && <SearchPrompt />}

            {/* Supplier cards */}
            {!loading &&
              suppliers.map((s, i) => (
                <SupplierCard
                  key={s.place_id}
                  supplier={s}
                  rank={i + 1}
                  selected={selected?.place_id === s.place_id}
                  onClick={() =>
                    setSelected((prev) => (prev?.place_id === s.place_id ? null : s))
                  }
                />
              ))}
          </div>
        </div>

        {/* ── Right: Map ── */}
        <div className="lg:col-span-3 bg-navy-800 border border-navy-700 rounded-xl overflow-hidden shadow-xl min-h-[400px] lg:min-h-0">
          <MapPanel selected={selected} apiEnabled={apiEnabled} />
        </div>
      </div>
    </div>
  );
}
