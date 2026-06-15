import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  X, MapPin, Truck, Wrench, Fuel, Users, Building2, Calculator,
  ChevronDown, ChevronUp, Route, Clock, DollarSign, Shield,
  Home, Gauge, SlidersHorizontal, ArrowLeftRight, BedDouble,
  Package, HardHat, Percent, TrendingUp, Zap
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import {
  LogisticsInputs, LogisticsEstimate,
  getDefaults, calculateLogistics
} from '@/src/hooks/useLogisticsCalculator';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore, Employee } from '@/src/store/appStore';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ── Leaflet (lazy) ─────────────────────────────────────────────
let L: typeof import('leaflet') | null = null;
let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let Popup: any = null;
let Polyline: any = null;
let useMap: any = null;

interface LogisticsEstimatorDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill site name from the invoice context */
  siteName?: string;
  clientName?: string;
}

// ── Format helpers ─────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toFixed(0)}`;
}

// ── Map FitBounds helper component ─────────────────────────────
function FitBounds({ warehouse, site }: { warehouse: [number, number]; site: [number, number] | null }) {
  const map = useMap?.();
  useEffect(() => {
    if (!map || !site) return;
    const bounds = [warehouse, site] as [number, number][];
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [map, warehouse, site]);
  return null;
}

// ── Haversine distance ─────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Section collapse wrapper ───────────────────────────────────
function Section({
  icon, title, children, defaultOpen = true, accentColor = 'indigo'
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  defaultOpen?: boolean; accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    violet: 'text-blue-500',
  };
  return (
    <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white/60">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={colorMap[accentColor] || 'text-indigo-500'}>{icon}</span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
}

// ── Field row ──────────────────────────────────────────────────
function Field({
  label, value, onChange, suffix, prefix, type = 'number', min, max, step, placeholder, disabled
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  suffix?: string; prefix?: string; type?: string;
  min?: number; max?: number; step?: number; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 font-medium w-[140px] shrink-0 truncate">{label}</label>
      <div className="relative flex-1">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{prefix}</span>}
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn("h-8 text-sm font-mono tabular-nums", prefix && "pl-7", suffix && "pr-10")}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Slider field ───────────────────────────────────────────────
function SliderField({
  label, value, onChange, min = 0, max = 30, step = 1, suffix = '%', icon
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs text-slate-500 font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold text-slate-700 tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-md
                   [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
      />
    </div>
  );
}

// ── Cost line in breakdown ─────────────────────────────────────
function CostLine({ label, value, bold, muted, indent }: {
  label: string; value: number; bold?: boolean; muted?: boolean; indent?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-1", indent && "pl-4")}>
      <span className={cn("text-xs", bold ? "font-bold text-slate-700" : muted ? "text-slate-400" : "text-slate-500")}>{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", bold ? "font-black text-slate-800" : muted ? "text-slate-400" : "text-slate-600 font-semibold")}>
        ₦{fmt(value)}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function LogisticsEstimatorDialog({ open, onClose, siteName, clientName }: LogisticsEstimatorDialogProps) {
  const employees = useAppStore(state => state.employees);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active' && e.staffType === 'FIELD'), [employees]);

  const getMonthlySalary = useCallback((emp: Employee) => {
    if (!emp.monthlySalaries) return 0;
    const currentMonthIdx = new Date().getMonth();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
    const monthKey = months[currentMonthIdx];
    return emp.monthlySalaries[monthKey] || 0;
  }, []);

  const [inputs, setInputs] = useState<LogisticsInputs>(getDefaults());
  const [sitePos, setSitePos] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState(siteName || '');
  const [searching, setSearching] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(true);
  const mapRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const [warehouse, setWarehouse] = useState<{lat: number, lng: number, label: string}>({
    lat: 6.5055, lng: 3.3745, label: '7 Musiliu Smith Street, Yaba, Lagos'
  });

  useEffect(() => {
    async function loadCompanyAddress() {
      try {
        const { data, error } = await supabase.from('app_settings').select('company_address').limit(1).single();
        if (data && data.company_address) {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.company_address)}&limit=1`);
          const geocodeData = await res.json();
          if (geocodeData && geocodeData.length > 0) {
            setWarehouse({
              lat: parseFloat(geocodeData[0].lat),
              lng: parseFloat(geocodeData[0].lon),
              label: data.company_address
            });
          }
        }
      } catch (err) {
        console.error('Failed to geocode company address:', err);
      }
    }
    if (open) loadCompanyAddress();
  }, [open]);

  // Form state

  // Load leaflet dynamically (avoid SSR issues)
  useEffect(() => {
    if (leafletLoaded) return;
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]).then(([leafletMod, rlMod]) => {
      L = leafletMod.default || leafletMod;
      MapContainer = rlMod.MapContainer;
      TileLayer = rlMod.TileLayer;
      Marker = rlMod.Marker;
      Popup = rlMod.Popup;
      Polyline = rlMod.Polyline;
      useMap = rlMod.useMap;

      // Fix default marker icons
      delete (L!.Icon.Default.prototype as any)._getIconUrl;
      L!.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
      });

      setLeafletLoaded(true);
    });
  }, [leafletLoaded]);

  // Update field helper
  const set = useCallback(<K extends keyof LogisticsInputs>(field: K, value: LogisticsInputs[K]) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const setNum = useCallback((field: keyof LogisticsInputs, raw: string) => {
    const v = parseFloat(raw);
    set(field, isNaN(v) ? 0 as any : v as any);
  }, [set]);

  // ── Geocode search ────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const pos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setSitePos(pos);
        // Calculate straight-line distance (multiply by 1.3 for road approximation)
        const straight = haversineKm(warehouse.lat, warehouse.lng, pos[0], pos[1]);
        const roadEstimate = straight * 1.3;
        set('distance', Math.round(roadEstimate * 10) / 10);
        // Estimate travel time
        const speed = inputs.travelSpeed || 50;
        set('travelTime', Math.round((roadEstimate / speed) * 100) / 100);
        // Try to fetch route from OSRM (free, no key needed)
        try {
          const routeRes = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${warehouse.lng},${warehouse.lat};${pos[1]},${pos[0]}?overview=full&geometries=geojson`
          );
          const routeData = await routeRes.json();
          if (routeData.routes?.[0]) {
            const r = routeData.routes[0];
            const coords = r.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
            setRouteCoords(coords);
            // Use OSRM distance/duration (more accurate)
            set('distance', Math.round((r.distance / 1000) * 10) / 10);
            set('travelTime', Math.round((r.duration / 3600) * 100) / 100);
          }
        } catch {
          // Fall back to straight-line + factor
          setRouteCoords([
            [warehouse.lat, warehouse.lng],
            pos
          ]);
        }
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, inputs.travelSpeed, set, warehouse]);

  // ── Map click → set site ─────────────────────────────────────
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    const pos: [number, number] = [lat, lng];
    setSitePos(pos);
    const straight = haversineKm(warehouse.lat, warehouse.lng, lat, lng);
    const roadEstimate = straight * 1.3;
    set('distance', Math.round(roadEstimate * 10) / 10);
    const speed = inputs.travelSpeed || 50;
    set('travelTime', Math.round((roadEstimate / speed) * 100) / 100);

    // Try OSRM route
    try {
      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${warehouse.lng},${warehouse.lat};${lng},${lat}?overview=full&geometries=geojson`
      );
      const routeData = await routeRes.json();
      if (routeData.routes?.[0]) {
        const r = routeData.routes[0];
        setRouteCoords(r.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
        set('distance', Math.round((r.distance / 1000) * 10) / 10);
        set('travelTime', Math.round((r.duration / 3600) * 100) / 100);
      }
    } catch {
      setRouteCoords([[warehouse.lat, warehouse.lng], pos]);
    }

    // Reverse geocode for display
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      if (data.display_name) {
        setSearchQuery(data.display_name.split(',').slice(0, 3).join(','));
      }
    } catch { /* ignore */ }
  }, [inputs.travelSpeed, set, warehouse]);

  // ── Live estimate ─────────────────────────────────────────────
  const estimate = useMemo(() => calculateLogistics(inputs), [inputs]);

  // Cost tier coloring
  const costTier = estimate.grandTotal < 100_000 ? 'emerald' :
    estimate.grandTotal < 500_000 ? 'amber' : 'rose';
  const costTierBg = { emerald: 'from-emerald-500 to-emerald-600', amber: 'from-amber-500 to-amber-600', rose: 'from-rose-500 to-rose-600' }[costTier];

  if (!open) return null;

  // ── Map click handler component ──────────────────────────────
  const MapClickHandler = leafletLoaded ? React.memo(function MapClickHandlerInner() {
    const map = useMap?.();
    useEffect(() => {
      if (!map) return;
      const handler = (e: any) => {
        handleMapClick(e.latlng.lat, e.latlng.lng);
      };
      map.on('click', handler);
      return () => { map.off('click', handler); };
    }, [map]);
    return null;
  }) : () => null;

  // Warehouse icon
  const warehouseIcon = useMemo(() => {
    return leafletLoaded && L ? new L.DivIcon({
      html: `<div style="background:linear-gradient(135deg,#4f46e5,#6366f1);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }) : undefined;
  }, [leafletLoaded]);

  // Site icon
  const siteIcon = useMemo(() => {
    return leafletLoaded && L ? new L.DivIcon({
      html: `<div style="background:linear-gradient(135deg,#ef4444,#f97316);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }) : undefined;
  }, [leafletLoaded]);

  // Memoize Map to prevent re-rendering on every input keystroke
  const mapElement = useMemo(() => {
    if (!leafletLoaded || !MapContainer) return null;
    return (
      <MapContainer
        center={[warehouse.lat, warehouse.lng]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          maxZoom={20}
        />
        {/* Warehouse marker */}
        <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
          <Popup>
            <div className="font-sans">
              <p className="font-bold text-sm text-indigo-700">{warehouse.label}</p>
              <p className="text-xs text-slate-500">Origin point</p>
            </div>
          </Popup>
        </Marker>
        {/* Site marker */}
        {sitePos && (
          <Marker position={sitePos} icon={siteIcon}>
            <Popup>
              <div className="font-sans">
                <p className="font-bold text-sm text-rose-600">Site Location</p>
                <p className="text-xs text-slate-500">Destination</p>
              </div>
            </Popup>
          </Marker>
        )}
        {/* Route line */}
        {routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: '#4f46e5',
              weight: 4,
              opacity: 0.8,
              dashArray: undefined,
            }}
          />
        )}
        <MapClickHandler />
        <FitBounds
          warehouse={[warehouse.lat, warehouse.lng]}
          site={sitePos}
        />
      </MapContainer>
    );
  }, [leafletLoaded, warehouse, sitePos, routeCoords, warehouseIcon, siteIcon, MapClickHandler]);

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">

        {/* ── Header ──────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-indigo-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Logistics Cost Estimator</h2>
              <p className="text-xs text-white/60 font-medium">
                Mobilisation + Installation cost calculator
                {clientName && <span className="text-indigo-300 ml-1">· {clientName}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Grand total badge */}
            <div className={cn("px-4 py-2 rounded-xl bg-gradient-to-r text-white", costTierBg)}>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Total Estimate</p>
              <p className="text-lg font-black tabular-nums leading-tight">₦{fmt(estimate.grandTotal)}</p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0 h-full">

            {/* ── LEFT: Map + Route Info ──────────────── */}
            <div className="flex flex-col border-r border-slate-200 overflow-y-auto">
              {/* Search bar & Map Toggle */}
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex gap-2 flex-1 min-w-0">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="Search site location or click on map..."
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all bg-white"
                    />
                  </div>
                  <Button size="sm" onClick={handleSearch} disabled={searching} className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0">
                    {searching ? 'Searching…' : 'Find'}
                  </Button>
                </div>
                <button 
                  onClick={() => setIsMapOpen(!isMapOpen)} 
                  className="lg:hidden h-9 px-3 flex items-center gap-1 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                >
                  Map {isMapOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Map */}
              <div className={cn("min-h-[350px] shrink-0 relative border-b border-slate-200", !isMapOpen && "hidden lg:block")}>
                {leafletLoaded && MapContainer ? (
                  <>
                    <MapContainer
                      center={[warehouse.lat, warehouse.lng]}
                      zoom={10}
                      style={{ width: '100%', height: '100%' }}
                      ref={mapRef}
                    >
                      <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        maxZoom={20}
                      />
                      {/* Warehouse marker */}
                      <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
                        <Popup>
                          <div className="font-sans">
                            <p className="font-bold text-sm text-indigo-700">{warehouse.label}</p>
                            <p className="text-xs text-slate-500">Origin point</p>
                          </div>
                        </Popup>
                      </Marker>
                      {/* Site marker */}
                      {sitePos && (
                        <Marker position={sitePos} icon={siteIcon}>
                          <Popup>
                            <div className="font-sans">
                              <p className="font-bold text-sm text-rose-600">Site Location</p>
                              <p className="text-xs text-slate-500">{searchQuery || 'Selected on map'}</p>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                      {/* Route line */}
                      {routeCoords.length > 0 && (
                        <Polyline
                          positions={routeCoords}
                          pathOptions={{
                            color: '#4f46e5',
                            weight: 4,
                            opacity: 0.8,
                            dashArray: undefined,
                          }}
                        />
                      )}
                      <MapClickHandler />
                      <FitBounds
                        warehouse={[warehouse.lat, warehouse.lng]}
                        site={sitePos}
                      />
                    </MapContainer>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-100">
                    <div className="text-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2 animate-pulse">
                        <MapPin className="h-5 w-5 text-indigo-500" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Loading map…</p>
                    </div>
                  </div>
                )}

                {/* Route info overlay */}
                {sitePos && (
                  <div className="absolute bottom-3 left-3 right-3 flex gap-2 z-[1000] pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md rounded-lg px-3 py-2 shadow-lg border border-slate-200/50 pointer-events-auto">
                      <div className="flex items-center gap-1.5">
                        <Route className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-700">{inputs.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                    <div className="bg-white/95 backdrop-blur-md rounded-lg px-3 py-2 shadow-lg border border-slate-200/50 pointer-events-auto">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-slate-700">
                          {inputs.travelTime >= 1
                            ? `${Math.floor(inputs.travelTime)}h ${Math.round((inputs.travelTime % 1) * 60)}m`
                            : `${Math.round(inputs.travelTime * 60)}m`
                          }
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-lg px-3 py-2 shadow-lg border pointer-events-auto",
                      costTier === 'emerald' ? 'bg-emerald-50/95 border-emerald-200/50' :
                        costTier === 'amber' ? 'bg-amber-50/95 border-amber-200/50' :
                          'bg-rose-50/95 border-rose-200/50'
                    )}>
                      <div className="flex items-center gap-1.5">
                        <Zap className={cn("h-3.5 w-3.5",
                          costTier === 'emerald' ? 'text-emerald-600' : costTier === 'amber' ? 'text-amber-600' : 'text-rose-600'
                        )} />
                        <span className={cn("text-xs font-black",
                          costTier === 'emerald' ? 'text-emerald-700' : costTier === 'amber' ? 'text-amber-700' : 'text-rose-700'
                        )}>{fmtShort(estimate.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Cost breakdown (below map on large screens) ─── */}
              <div className="bg-slate-50/50 p-4 space-y-1 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cost Breakdown</h3>
                </div>

                {/* Mobilisation */}
                <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Truck className="h-3 w-3 text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Mobilisation</span>
                  </div>
                  <CostLine label="Fuel / Diesel" value={inputs.tripType === 'full_lifecycle' ? estimate.fuelCost / 2 : estimate.fuelCost} indent />
                  <CostLine label="Driver Wages" value={inputs.tripType === 'full_lifecycle' ? estimate.driverCost / 2 : estimate.driverCost} indent />
                  <CostLine label="Maintenance & Wear" value={inputs.tripType === 'full_lifecycle' ? estimate.maintenanceCost / 2 : estimate.maintenanceCost} indent />
                  <CostLine label="Admin, Tolls & Security" value={inputs.tripType === 'full_lifecycle' ? estimate.tollsInsuranceAdmin / 2 : estimate.tollsInsuranceAdmin} indent />
                  <CostLine label="Handling & Loading" value={inputs.tripType === 'full_lifecycle' ? estimate.equipmentHandlingCost / 2 : estimate.equipmentHandlingCost} indent />
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <CostLine label="Mobilisation Subtotal" value={estimate.mobilisationSubtotal} bold />
                  </div>
                </div>

                {/* Installation */}
                <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-0.5 mt-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <HardHat className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Installation</span>
                    {estimate.installDays > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-200 text-amber-600 font-bold">
                        {estimate.installDays} day{estimate.installDays !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <CostLine label="Labor" value={estimate.laborCost} indent />
                  <CostLine label="Equipment Rental" value={estimate.equipmentCost} indent />
                  <CostLine label="Accommodation" value={estimate.accommodationCost} indent />
                  <CostLine label="Operation Fuel" value={estimate.installationFuelCost} indent />
                  <CostLine label="Other Expenses" value={estimate.installationOtherExpenses} indent />
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <CostLine label="Installation Subtotal" value={estimate.installationSubtotal} bold />
                  </div>
                </div>

                {/* Demobilisation (Only if Full Lifecycle) */}
                {inputs.tripType === 'full_lifecycle' && (
                  <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-0.5 mt-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowLeftRight className="h-3 w-3 text-rose-400" />
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Demobilisation</span>
                    </div>
                    <CostLine label="Fuel / Diesel" value={estimate.fuelCost / 2} indent />
                    <CostLine label="Driver Wages" value={estimate.driverCost / 2} indent />
                    <CostLine label="Maintenance & Wear" value={estimate.maintenanceCost / 2} indent />
                    <CostLine label="Admin, Tolls & Security" value={estimate.tollsInsuranceAdmin / 2} indent />
                    <CostLine label="Handling & Loading" value={estimate.equipmentHandlingCost / 2} indent />
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <CostLine label="Demobilisation Subtotal" value={estimate.demobilisationSubtotal} bold />
                    </div>
                  </div>
                )}

                {/* Contingency & Total */}
                <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-0.5">
                  <CostLine label={`Contingency (${inputs.contingencyPercent}%)`} value={estimate.contingencyAmount} muted />
                  {inputs.tripType === 'mobilisation_only' && <CostLine label="Mobilisation only (2 trips)" value={0} muted />}
                  {inputs.tripType === 'full_lifecycle' && <CostLine label="Full Lifecycle (4 trips)" value={0} muted />}
                  <div className="border-t border-indigo-100 mt-1 pt-1">
                    <div className="flex items-center justify-between py-1 bg-indigo-50 rounded-lg px-3 -mx-1">
                      <span className="text-sm font-black text-indigo-700">GRAND TOTAL</span>
                      <span className="font-black text-base text-indigo-700 font-mono tabular-nums">₦{fmt(estimate.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Input form ──────────────────── */}
            <div className="overflow-y-auto p-4 space-y-3 bg-slate-50/30">

              {/* Route info */}
              <Section icon={<Route className="h-4 w-4" />} title="Route & Distance" accentColor="indigo">
                <Field label="Distance" value={inputs.distance} onChange={v => setNum('distance', v)} suffix="km" />
                <Field label="Travel Time" value={inputs.travelTime} onChange={v => setNum('travelTime', v)} suffix="hrs" step={0.1} />
                <SliderField
                  label="Traffic Factor"
                  value={Math.round(inputs.trafficFactor * 100)}
                  onChange={v => set('trafficFactor', v / 100)}
                  min={0} max={50} step={5} suffix="%"
                  icon={<Gauge className="h-3 w-3 text-amber-400" />}
                />
                <div className="mt-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowLeftRight className="h-3 w-3" /> Trip Type
                  </label>
                  <select 
                    value={inputs.tripType}
                    onChange={e => set('tripType', e.target.value as any)}
                    className="w-full h-8 text-xs rounded-md border border-slate-200 bg-white px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="one_way">One Way (1 trip)</option>
                    <option value="mobilisation_only">Mobilisation Only (Drop-off & Return - 2 trips)</option>
                    <option value="full_lifecycle">Full Lifecycle (Mob + Demob - 4 trips)</option>
                  </select>
                </div>
              </Section>

              {/* Fuel */}
              <Section icon={<Fuel className="h-4 w-4" />} title="Fuel / Diesel" accentColor="amber">
                <Field label="Fuel Price" value={inputs.fuelPricePerLitre} onChange={v => setNum('fuelPricePerLitre', v)} prefix="₦" suffix="/litre" />
                <Field label="Fuel Efficiency" value={inputs.fuelEfficiency} onChange={v => setNum('fuelEfficiency', v)} suffix="km/l" />
                <div className="text-[10px] text-slate-400 font-medium mt-1">
                  Est. fuel needed: <span className="font-bold text-slate-600">{(inputs.distance / Math.max(0.1, inputs.fuelEfficiency * (1 - inputs.trafficFactor)) * Math.max(1, inputs.numberOfVehicles)).toFixed(1)}L</span>
                  {inputs.tripType !== 'one_way' && <span> × {inputs.tripType === 'full_lifecycle' ? '4' : '2'} trips</span>}
                </div>
              </Section>

              {/* Vehicles & Driver */}
              <Section icon={<Truck className="h-4 w-4" />} title="Vehicles & Driver" accentColor="sky">
                <Field label="Number of Vehicles" value={inputs.numberOfVehicles} onChange={v => setNum('numberOfVehicles', v)} min={1} />
                <Field label="Driver Wage /hr" value={inputs.driverWagePerHour} onChange={v => setNum('driverWagePerHour', v)} prefix="₦" />
                <Field label="Travel Speed" value={inputs.travelSpeed} onChange={v => setNum('travelSpeed', v)} suffix="km/h" />
              </Section>

              {/* Maintenance */}
              <Section icon={<Wrench className="h-4 w-4" />} title="Maintenance & Wear" accentColor="emerald" defaultOpen={false}>
                <Field label="Cost per km" value={inputs.maintenanceCostPerKm} onChange={v => setNum('maintenanceCostPerKm', v)} prefix="₦" suffix="/km" />
              </Section>

              {/* Admin, Security & Tolls */}
              <Section icon={<Shield className="h-4 w-4" />} title="Admin, Security & Tolls" accentColor="sky" defaultOpen={false}>
                <Field label="Tolls / Permits" value={inputs.tolls} onChange={v => setNum('tolls', v)} prefix="₦" />
                <Field label="Security Escorts" value={inputs.securityEscorts} onChange={v => setNum('securityEscorts', v)} prefix="₦" />
                <Field label="Community Levies" value={inputs.communityLevies} onChange={v => setNum('communityLevies', v)} prefix="₦" />
                <Field label="Insurance" value={inputs.insurance} onChange={v => setNum('insurance', v)} prefix="₦" />
              </Section>

              {/* Handling & Loading */}
              <Section icon={<Package className="h-4 w-4" />} title="Handling & Loading" accentColor="amber" defaultOpen={false}>
                <Field label="Crane / Forklift" value={inputs.equipmentHandlingCost} onChange={v => setNum('equipmentHandlingCost', v)} prefix="₦" />
              </Section>

              {/* Accommodation */}
              <Section icon={<BedDouble className="h-4 w-4" />} title="Accommodation" accentColor="rose">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="accomReq"
                    checked={inputs.accommodationRequired}
                    onChange={e => set('accommodationRequired', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="accomReq" className="text-xs text-slate-600 font-semibold cursor-pointer">
                    Accommodation required
                  </label>
                  {!inputs.accommodationRequired && (
                    <span className="text-[10px] text-slate-400 ml-auto">Cost = ₦0</span>
                  )}
                </div>
                <Field
                  label="Per Diem Rate"
                  value={inputs.perDiemRate}
                  onChange={v => setNum('perDiemRate', v)}
                  prefix="₦" suffix="/day"
                  disabled={!inputs.accommodationRequired}
                />
                <Field
                  label="Crew Size"
                  value={inputs.crewSize}
                  onChange={v => setNum('crewSize', v)}
                  disabled={!inputs.accommodationRequired}
                />
              </Section>

              {/* Installation */}
              <Section icon={<HardHat className="h-4 w-4" />} title="Installation" accentColor="amber">
                <Field label="Headers to Install" value={inputs.headersToInstall} onChange={v => setNum('headersToInstall', v)} />
                <Field label="Headers per Day" value={inputs.headersPerDay} onChange={v => setNum('headersPerDay', v)} suffix="/day" />
                {inputs.headersToInstall > 0 && (
                  <div className="text-[10px] text-amber-600 font-bold bg-amber-50 rounded-md px-2 py-1">
                    Installation Duration: {Math.ceil(inputs.headersToInstall / Math.max(1, inputs.headersPerDay))} day(s)
                  </div>
                )}
                <div className="mt-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-3 w-3" /> Select Technicians
                  </label>
                  <div className="border border-slate-200 rounded-md bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                    {activeEmployees.length === 0 ? (
                      <p className="text-xs text-slate-400 p-1">No active employees found.</p>
                    ) : (
                      activeEmployees.map(emp => {
                        const isSelected = inputs.selectedTechnicians.some(t => t.id === emp.id);
                        const salary = getMonthlySalary(emp);
                        const dailyRate = salary / 22;
                        return (
                          <label key={emp.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={isSelected}
                              onChange={(e) => {
                                let newTechs = [...inputs.selectedTechnicians];
                                if (e.target.checked) {
                                  newTechs.push({ id: emp.id, name: `${emp.firstname} ${emp.surname}`, dailyRate });
                                } else {
                                  newTechs = newTechs.filter(t => t.id !== emp.id);
                                }
                                set('selectedTechnicians', newTechs);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{emp.firstname} {emp.surname}</p>
                              <p className="text-[9px] text-slate-400 truncate">{emp.position}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-600">₦{fmt(dailyRate)}<span className="text-[9px] font-normal text-slate-400">/day</span></p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {inputs.selectedTechnicians.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 bg-amber-50 rounded text-[10px] font-bold text-amber-700">
                      <span>Total Daily Rate ({inputs.selectedTechnicians.length} tech)</span>
                      <span>₦{fmt(inputs.selectedTechnicians.reduce((sum, t) => sum + t.dailyRate, 0))}</span>
                    </div>
                  )}
                </div>
                <Field label="Installation Fuel" value={inputs.installationFuelCost} onChange={v => setNum('installationFuelCost', v)} prefix="₦" />
                <Field label="Other Expenses" value={inputs.installationOtherExpenses} onChange={v => setNum('installationOtherExpenses', v)} prefix="₦" />
              </Section>

              {/* Equipment */}
              <Section icon={<Package className="h-4 w-4" />} title="Equipment Rental" accentColor="emerald" defaultOpen={false}>
                <Field label="Rental Rate" value={inputs.equipmentRentalPerDay} onChange={v => setNum('equipmentRentalPerDay', v)} prefix="₦" suffix="/day" />
                <Field label="Rental Days" value={inputs.equipmentRentalDays} onChange={v => setNum('equipmentRentalDays', v)} suffix="days" />
              </Section>

              {/* Contingency */}
              <Section icon={<Percent className="h-4 w-4" />} title="Contingency Buffer" accentColor="rose" defaultOpen={true}>
                <SliderField
                  label="Contingency"
                  value={inputs.contingencyPercent}
                  onChange={v => set('contingencyPercent', v)}
                  min={0} max={30} step={1} suffix="%"
                  icon={<TrendingUp className="h-3 w-3 text-rose-400" />}
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Buffer: <span className="font-bold text-slate-600">₦{fmt(estimate.contingencyAmount)}</span>
                </div>
              </Section>

              {/* Reset button */}
              <div className="pt-2">
                <Button
                  variant="outline" size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setInputs(getDefaults());
                    setSitePos(null);
                    setRouteCoords([]);
                    setSearchQuery('');
                  }}
                >
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
