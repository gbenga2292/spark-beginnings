import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  X, MapPin, Truck, Wrench, Fuel, Users, Building2, Calculator,
  ChevronDown, ChevronUp, Route, Clock, DollarSign, Shield,
  Home, Gauge, SlidersHorizontal, ArrowLeftRight, BedDouble,
  Package, HardHat, Percent, TrendingUp, Zap, PanelLeftClose, PanelLeftOpen,
  RotateCcw, Copy, Check
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast } from 'sonner';
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
  open?: boolean;
  onClose?: () => void;
  /** Pre-fill site name from the invoice context */
  siteName?: string;
  clientName?: string;
  isDialog?: boolean;
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
  icon, title, children, defaultOpen = true, accentColor = 'blue'
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  defaultOpen?: boolean; accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-500 dark:text-amber-400',
    emerald: 'text-emerald-500 dark:text-emerald-400',
    rose: 'text-rose-500 dark:text-rose-400',
    sky: 'text-sky-500 dark:text-sky-400',
  };
  return (
    <div className="border border-slate-200/80 dark:border-slate-800 rounded-lg overflow-hidden bg-white/70 dark:bg-slate-900/60 shadow-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <span className={colorMap[accentColor] || 'text-blue-600'}>{icon}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-3.5 py-3 space-y-2.5">{children}</div>}
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
      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium w-[130px] shrink-0 truncate">{label}</label>
      <div className="relative flex-1">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{prefix}</span>}
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            "h-8 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100",
            prefix && "pl-6",
            suffix && "pr-9"
          )}
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
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{label}</span>
        </div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-600
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md
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
    <div className={cn("flex items-center justify-between py-1", indent && "pl-3")}>
      <span className={cn("text-xs", bold ? "font-bold text-slate-800 dark:text-slate-100" : muted ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-400")}>
        {label}
      </span>
      <span className={cn("font-mono text-xs tabular-nums", bold ? "font-black text-slate-900 dark:text-white" : muted ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300 font-semibold")}>
        ₦{fmt(value)}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function LogisticsEstimatorDialog({
  open = true,
  onClose,
  siteName,
  clientName,
  isDialog = false
}: LogisticsEstimatorDialogProps) {
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
  const [showInputs, setShowInputs] = useState(true);
  const mapRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const [warehouse, setWarehouse] = useState<{lat: number, lng: number, label: string}>({
    lat: 6.5055, lng: 3.3745, label: '7 Musiliu Smith Street, Yaba, Lagos'
  });
  const [originQuery, setOriginQuery] = useState(warehouse.label);
  const [searchingOrigin, setSearchingOrigin] = useState(false);

  useEffect(() => {
    async function loadCompanyAddress() {
      try {
        const { data } = await supabase.from('app_settings').select('company_address').limit(1).single();
        if (data && data.company_address) {
          setOriginQuery(data.company_address);
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

  // Update field helper
  const set = useCallback(<K extends keyof LogisticsInputs>(field: K, value: LogisticsInputs[K]) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const setNum = useCallback((field: keyof LogisticsInputs, raw: string) => {
    const v = parseFloat(raw);
    set(field, isNaN(v) ? 0 as any : v as any);
  }, [set]);

  // Geocode Origin location
  const handleOriginSearch = useCallback(async (queryToSearch?: string) => {
    const query = queryToSearch !== undefined ? queryToSearch : originQuery;
    if (!query.trim()) return;
    setSearchingOrigin(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const newWarehouse = {
          lat: parseFloat(lat),
          lng: parseFloat(lon),
          label: query
        };
        setWarehouse(newWarehouse);

        if (sitePos) {
          const straight = haversineKm(newWarehouse.lat, newWarehouse.lng, sitePos[0], sitePos[1]);
          const roadEstimate = straight * 1.3;
          set('distance', Math.round(roadEstimate * 10) / 10);
          const speed = inputs.travelSpeed || 50;
          set('travelTime', Math.round((roadEstimate / speed) * 100) / 100);

          try {
            const routeRes = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${newWarehouse.lng},${newWarehouse.lat};${sitePos[1]},${sitePos[0]}?overview=full&geometries=geojson`
            );
            const routeData = await routeRes.json();
            if (routeData.routes?.[0]) {
              const r = routeData.routes[0];
              setRouteCoords(r.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
              set('distance', Math.round((r.distance / 1000) * 10) / 10);
              set('travelTime', Math.round((r.duration / 3600) * 100) / 100);
            }
          } catch {
            setRouteCoords([[newWarehouse.lat, newWarehouse.lng], sitePos]);
          }
        }
      }
    } catch (err) {
      console.error('Origin geocoding failed:', err);
    } finally {
      setSearchingOrigin(false);
    }
  }, [originQuery, sitePos, inputs.travelSpeed, set]);

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
            set('distance', Math.round((r.distance / 1000) * 10) / 10);
            set('travelTime', Math.round((r.duration / 3600) * 100) / 100);
          }
        } catch {
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
  const costTierBg = costTier === 'emerald' ? 'bg-emerald-600' : costTier === 'amber' ? 'bg-amber-600' : 'bg-rose-600';

  // ── Copy summary to clipboard ─────────────────────────────────
  const handleCopySummary = useCallback(() => {
    const lines = [
      `LOGISTICS COST ESTIMATE`,
      `Origin: ${warehouse.label}`,
      `Site: ${searchQuery || (sitePos ? `${sitePos[0].toFixed(4)}, ${sitePos[1].toFixed(4)}` : 'Not specified')}`,
      `Distance: ${inputs.distance.toFixed(1)} km`,
      `Travel Time: ${inputs.travelTime.toFixed(1)} hrs`,
      `Trip Type: ${inputs.tripType.replace(/_/g, ' ')} (${inputs.numberOfTrips ?? 2} trips)`,
      `Vehicles: ${inputs.numberOfVehicles}`,
      `----------------------------------------`,
      `Mobilisation Subtotal: ₦${fmt(estimate.mobilisationSubtotal)}`,
      `Installation Subtotal: ₦${fmt(estimate.installationSubtotal)}`,
      ...(inputs.tripType === 'full_lifecycle' ? [`Demobilisation Subtotal: ₦${fmt(estimate.demobilisationSubtotal)}`] : []),
      `Contingency (${inputs.contingencyPercent}%): ₦${fmt(estimate.contingencyAmount)}`,
      `----------------------------------------`,
      `GRAND TOTAL: ₦${fmt(estimate.grandTotal)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Logistics estimate copied to clipboard');
  }, [warehouse.label, searchQuery, sitePos, inputs, estimate]);

  // ── Reset handler ─────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setInputs(getDefaults());
    setSitePos(null);
    setRouteCoords([]);
    setSearchQuery('');
    setOriginQuery(warehouse.label);
    toast.info('Estimator reset to default values');
  }, [warehouse.label]);

  // ── In-page Header integration (via useSetPageTitle) ──────────
  const headerActions = useMemo(() => {
    if (isDialog) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Total Estimate pill badge */}
        <div className={cn("px-2.5 py-1 rounded-md text-white flex items-center gap-1.5 shadow-xs font-mono", costTierBg)}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Estimate:</span>
          <span className="text-xs sm:text-sm font-black tabular-nums">₦{fmt(estimate.grandTotal)}</span>
        </div>

        {/* Copy summary button */}
        <button
          type="button"
          onClick={handleCopySummary}
          className="h-7 text-xs px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center cursor-pointer shadow-xs font-medium"
          title="Copy summary breakdown to clipboard"
        >
          <Copy className="h-3 w-3 mr-1" /> Copy Summary
        </button>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleReset}
          className="h-7 text-xs px-2.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center cursor-pointer"
          title="Reset parameters to default"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </button>
      </div>
    );
  }, [isDialog, costTierBg, estimate.grandTotal, handleCopySummary, handleReset]);

  useSetPageTitle(
    isDialog ? null : 'Logistics Cost Estimator',
    isDialog ? null : (clientName ? `Mobilisation + Installation calculator · ${clientName}` : 'Mobilisation + Installation cost calculator'),
    headerActions,
    [headerActions, isDialog, clientName]
  );

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
      html: `<div style="background:#2563eb;width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
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
      html: `<div style="background:#dc2626;width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
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
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          maxZoom={20}
        />
        {/* Warehouse marker */}
        <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
          <Popup>
            <div className="font-sans">
              <p className="font-bold text-sm text-blue-700">{warehouse.label}</p>
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
              color: '#2563eb',
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
  }, [leafletLoaded, warehouse, sitePos, routeCoords, warehouseIcon, siteIcon, MapClickHandler, searchQuery]);

  if (!open) return null;

  // ── Render Input Variable Sections (used in left column) ──────
  const renderInputForm = () => (
    <div className="space-y-3">
      {/* Route & Distance */}
      <Section icon={<Route className="h-4 w-4" />} title="Route & Distance" accentColor="blue">
        {/* Home / Origin location field */}
        <div className="space-y-1.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Home className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Home / Origin Location
            </label>
            <button
              type="button"
              onClick={() => handleOriginSearch()}
              disabled={searchingOrigin}
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-50 cursor-pointer"
            >
              {searchingOrigin ? 'Updating…' : 'Set Origin'}
            </button>
          </div>
          <Input
            type="text"
            value={originQuery}
            onChange={e => setOriginQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOriginSearch()}
            placeholder="Home / Origin address..."
            className="h-8 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 focus:border-blue-400"
          />
          <p className="text-[9px] text-slate-400 truncate">
            Active: <span className="font-semibold text-slate-600 dark:text-slate-300">{warehouse.label}</span>
          </p>
        </div>

        <Field label="Distance" value={inputs.distance} onChange={v => setNum('distance', v)} suffix="km" />
        <Field label="Travel Time" value={inputs.travelTime} onChange={v => setNum('travelTime', v)} suffix="hrs" step={0.1} />
        <SliderField
          label="Traffic Factor"
          value={Math.round(inputs.trafficFactor * 100)}
          onChange={v => set('trafficFactor', v / 100)}
          min={0} max={50} step={5} suffix="%"
          icon={<Gauge className="h-3 w-3 text-amber-500" />}
        />
        <div className="mt-2 space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3 text-blue-500" /> Trip Type Preset
            </label>
          </div>
          <select 
            value={inputs.tripType}
            onChange={e => {
              const tType = e.target.value as any;
              let nTrips = inputs.numberOfTrips || 2;
              if (tType === 'one_way') nTrips = 1;
              else if (tType === 'mobilisation_only') nTrips = 2;
              else if (tType === 'full_lifecycle') nTrips = 4;
              setInputs(prev => ({ ...prev, tripType: tType, numberOfTrips: nTrips }));
            }}
            className="w-full h-8 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="one_way">One Way (1 trip)</option>
            <option value="mobilisation_only">Mobilisation Only (Drop-off & Return - 2 trips)</option>
            <option value="full_lifecycle">Full Lifecycle (Mob + Demob - 4 trips)</option>
            <option value="custom">Custom Trip Count</option>
          </select>

          <Field
            label="Number of Trips"
            value={inputs.numberOfTrips ?? 2}
            onChange={v => {
              const num = Math.max(1, parseInt(v, 10) || 1);
              let tType: any = 'custom';
              if (num === 1) tType = 'one_way';
              else if (num === 2) tType = 'mobilisation_only';
              else if (num === 4) tType = 'full_lifecycle';
              setInputs(prev => ({ ...prev, numberOfTrips: num, tripType: tType }));
            }}
            min={1}
            suffix="trips"
          />
        </div>
      </Section>

      {/* Fuel / Diesel */}
      <Section icon={<Fuel className="h-4 w-4" />} title="Fuel / Diesel" accentColor="amber">
        <Field label="Fuel Price" value={inputs.fuelPricePerLitre} onChange={v => setNum('fuelPricePerLitre', v)} prefix="₦" suffix="/litre" />
        <Field label="Fuel Efficiency" value={inputs.fuelEfficiency} onChange={v => setNum('fuelEfficiency', v)} suffix="km/l" />
        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
          Est. fuel needed: <span className="font-bold text-slate-700 dark:text-slate-300">{(inputs.distance / Math.max(0.1, inputs.fuelEfficiency * (1 - inputs.trafficFactor)) * Math.max(1, inputs.numberOfVehicles)).toFixed(1)}L</span>
          <span> × {estimate.tripMultiplier} trip{estimate.tripMultiplier !== 1 ? 's' : ''}</span>
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
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="accomReq" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
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
          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 rounded-md px-2 py-1 border border-amber-200 dark:border-amber-900/60">
            Installation Duration: {Math.ceil(inputs.headersToInstall / Math.max(1, inputs.headersPerDay))} day(s)
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="h-3 w-3 text-amber-600" /> Select Technicians
          </label>
          <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 p-2 max-h-32 overflow-y-auto space-y-1">
            {activeEmployees.length === 0 ? (
              <p className="text-xs text-slate-400 p-1">No active employees found.</p>
            ) : (
              activeEmployees.map(emp => {
                const isSelected = inputs.selectedTechnicians.some(t => t.id === emp.id);
                const salary = getMonthlySalary(emp);
                const dailyRate = salary / 22;
                return (
                  <label key={emp.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
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
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{emp.firstname} {emp.surname}</p>
                      <p className="text-[9px] text-slate-400 truncate">{emp.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">₦{fmt(dailyRate)}<span className="text-[9px] font-normal text-slate-400">/day</span></p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {inputs.selectedTechnicians.length > 0 && (
            <div className="flex items-center justify-between px-2 py-1 bg-amber-50 dark:bg-amber-950/40 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
              <span>Total Daily Rate ({inputs.selectedTechnicians.length} tech)</span>
              <span>₦{fmt(inputs.selectedTechnicians.reduce((sum, t) => sum + t.dailyRate, 0))}</span>
            </div>
          )}
        </div>
        <Field label="Installation Fuel" value={inputs.installationFuelCost} onChange={v => setNum('installationFuelCost', v)} prefix="₦" />
        <Field label="Other Expenses" value={inputs.installationOtherExpenses} onChange={v => setNum('installationOtherExpenses', v)} prefix="₦" />
      </Section>

      {/* Equipment Rental */}
      <Section icon={<Package className="h-4 w-4" />} title="Equipment Rental" accentColor="emerald" defaultOpen={false}>
        <Field label="Rental Rate" value={inputs.equipmentRentalPerDay} onChange={v => setNum('equipmentRentalPerDay', v)} prefix="₦" suffix="/day" />
        <Field label="Rental Days" value={inputs.equipmentRentalDays} onChange={v => setNum('equipmentRentalDays', v)} suffix="days" />
      </Section>

      {/* Contingency Buffer */}
      <Section icon={<Percent className="h-4 w-4" />} title="Contingency Buffer" accentColor="rose" defaultOpen={true}>
        <SliderField
          label="Contingency"
          value={inputs.contingencyPercent}
          onChange={v => set('contingencyPercent', v)}
          min={0} max={30} step={1} suffix="%"
          icon={<TrendingUp className="h-3 w-3 text-rose-500" />}
        />
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          Buffer: <span className="font-bold text-slate-700 dark:text-slate-300">₦{fmt(estimate.contingencyAmount)}</span>
        </div>
      </Section>

      {/* Reset button inside drawer */}
      <div className="pt-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3 mr-1.5" /> Reset to Defaults
        </Button>
      </div>
    </div>
  );

  // ── Render Map & Cost Breakdown ───────────────────────────────
  const renderMainContent = () => (
    <div className="space-y-4 min-w-0">
      {/* ── Search Bar & Map View Card ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Search controls strip */}
        <div className="px-3 sm:px-4 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-w-0">
            {/* Origin / Home location */}
            <div className="flex gap-1.5 flex-1 min-w-0">
              <div className="relative flex-1">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <input
                  value={originQuery}
                  onChange={e => setOriginQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOriginSearch()}
                  placeholder="Home / Origin location..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  title="Home / Origin location"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOriginSearch()}
                disabled={searchingOrigin}
                className="h-9 px-3 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 hover:bg-blue-100 text-xs font-bold shrink-0 cursor-pointer"
              >
                {searchingOrigin ? 'Setting…' : 'Set Origin'}
              </Button>
            </div>

            {/* Destination / Site location */}
            <div className="flex gap-1.5 flex-1 min-w-0">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-500" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search site location or click on map..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  title="Destination site location"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={searching}
                className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                {searching ? 'Searching…' : 'Find Site'}
              </Button>
            </div>
          </div>

          {/* Toggle Map View button */}
          <button 
            type="button"
            onClick={() => setIsMapOpen(!isMapOpen)} 
            className="h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 shadow-2xs cursor-pointer"
            title={isMapOpen ? "Hide Map View" : "Show Map View"}
          >
            <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isMapOpen ? 'Hide Map' : 'Show Map'}</span>
            {isMapOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </button>
        </div>

        {/* Leaflet Map container */}
        {isMapOpen && (
          <div className="h-[380px] w-full shrink-0 relative bg-slate-100 dark:bg-slate-950">
            <style>{`.leaflet-control-attribution { display: none !important; }`}</style>
            {leafletLoaded && MapContainer ? (
              mapElement
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-2 animate-pulse">
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Loading interactive route map…</p>
                </div>
              </div>
            )}

            {/* Route stats overlay on map */}
            {sitePos && (
              <div className="absolute bottom-3 left-3 right-3 flex gap-2 z-[1000] pointer-events-none flex-wrap">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg px-3 py-1.5 shadow-md border border-slate-200/60 dark:border-slate-800 pointer-events-auto flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{inputs.distance.toFixed(1)} km</span>
                </div>
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg px-3 py-1.5 shadow-md border border-slate-200/60 dark:border-slate-800 pointer-events-auto flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {inputs.travelTime >= 1
                      ? `${Math.floor(inputs.travelTime)}h ${Math.round((inputs.travelTime % 1) * 60)}m`
                      : `${Math.round(inputs.travelTime * 60)}m`
                    }
                  </span>
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-1.5 shadow-md border pointer-events-auto flex items-center gap-1.5",
                  costTier === 'emerald' ? 'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800' :
                    costTier === 'amber' ? 'bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800' :
                      'bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800'
                )}>
                  <Zap className={cn("h-3.5 w-3.5",
                    costTier === 'emerald' ? 'text-emerald-600' : costTier === 'amber' ? 'text-amber-600' : 'text-rose-600'
                  )} />
                  <span className={cn("text-xs font-black",
                    costTier === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : costTier === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'
                  )}>{fmtShort(estimate.grandTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cost Breakdown Card (sticky so it stays visible while scrolling inputs) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Cost Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Trip Multiplier: <strong className="text-slate-800 dark:text-slate-200">{estimate.tripMultiplier}×</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
          {/* Mobilisation Subtotal Card */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 space-y-0.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Truck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Mobilisation</span>
            </div>
            <CostLine label="Fuel / Diesel" value={inputs.tripType === 'full_lifecycle' ? estimate.fuelCost / 2 : estimate.fuelCost} indent />
            <CostLine label="Driver Wages" value={inputs.tripType === 'full_lifecycle' ? estimate.driverCost / 2 : estimate.driverCost} indent />
            <CostLine label="Maintenance & Wear" value={inputs.tripType === 'full_lifecycle' ? estimate.maintenanceCost / 2 : estimate.maintenanceCost} indent />
            <CostLine label="Admin, Tolls & Security" value={inputs.tripType === 'full_lifecycle' ? estimate.tollsInsuranceAdmin / 2 : estimate.tollsInsuranceAdmin} indent />
            <CostLine label="Handling & Loading" value={inputs.tripType === 'full_lifecycle' ? estimate.equipmentHandlingCost / 2 : estimate.equipmentHandlingCost} indent />
            <div className="border-t border-slate-200 dark:border-slate-700/60 mt-1.5 pt-1.5">
              <CostLine label="Mobilisation Subtotal" value={estimate.mobilisationSubtotal} bold />
            </div>
          </div>

          {/* Installation Subtotal Card */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 space-y-0.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Installation</span>
              </div>
              {estimate.installDays > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold">
                  {estimate.installDays} day{estimate.installDays !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <CostLine label="Labor" value={estimate.laborCost} indent />
            <CostLine label="Equipment Rental" value={estimate.equipmentCost} indent />
            <CostLine label="Accommodation" value={estimate.accommodationCost} indent />
            <CostLine label="Operation Fuel" value={estimate.installationFuelCost} indent />
            <CostLine label="Other Expenses" value={estimate.installationOtherExpenses} indent />
            <div className="border-t border-slate-200 dark:border-slate-700/60 mt-1.5 pt-1.5">
              <CostLine label="Installation Subtotal" value={estimate.installationSubtotal} bold />
            </div>
          </div>
        </div>

        {/* Demobilisation (Only if Full Lifecycle) */}
        {inputs.tripType === 'full_lifecycle' && (
          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 space-y-0.5 mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Demobilisation</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <CostLine label="Fuel / Diesel" value={estimate.fuelCost / 2} indent />
              <CostLine label="Driver Wages" value={estimate.driverCost / 2} indent />
              <CostLine label="Maintenance & Wear" value={estimate.maintenanceCost / 2} indent />
              <CostLine label="Admin, Tolls & Security" value={estimate.tollsInsuranceAdmin / 2} indent />
              <CostLine label="Handling & Loading" value={estimate.equipmentHandlingCost / 2} indent />
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700/60 mt-1.5 pt-1.5">
              <CostLine label="Demobilisation Subtotal" value={estimate.demobilisationSubtotal} bold />
            </div>
          </div>
        )}

        {/* Contingency Buffer & Grand Total Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 py-0.5">
            <span>Contingency Buffer ({inputs.contingencyPercent}%)</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">₦{fmt(estimate.contingencyAmount)}</span>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900/60 mt-2">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span className="text-xs sm:text-sm font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">Grand Total Estimate</span>
            </div>
            <span className="font-black text-base sm:text-lg text-blue-800 dark:text-blue-300 font-mono tabular-nums">
              ₦{fmt(estimate.grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // IN-PAGE VIEW (Default: standard layout like Dewatering)
  // ══════════════════════════════════════════════════════════════
  if (!isDialog) {
    return (
      <div className="bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className={cn(
          'mx-auto px-4 py-4 transition-all duration-200',
          showInputs ? 'max-w-7xl' : 'max-w-[1550px]'
        )}>
          {/* Quick Variables Pill Bar when Inputs are Hidden */}
          {!showInputs && (
            <div className="mb-4 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-xs flex-wrap animate-in fade-in duration-150">
              <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Active Configuration:
                </span>
                <span>Origin: <strong className="text-slate-800 dark:text-slate-200">{warehouse.label.split(',')[0]}</strong></span>
                <span>Site: <strong className="text-slate-800 dark:text-slate-200">{searchQuery ? searchQuery.split(',')[0] : 'Click map / Search'}</strong></span>
                <span>Distance: <strong>{inputs.distance.toFixed(1)} km</strong></span>
                <span>Trips: <strong>{inputs.numberOfTrips ?? 2}</strong></span>
                <span>Vehicles: <strong>{inputs.numberOfVehicles}</strong></span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">Total: ₦{fmt(estimate.grandTotal)}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInputs(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="h-3 w-3" /> Edit Variables
              </button>
            </div>
          )}

          {/* Two-Column Responsive Layout */}
          <div className={cn(
            'grid gap-5 items-start transition-all',
            showInputs ? 'grid-cols-1 lg:grid-cols-[380px_1fr]' : 'grid-cols-1'
          )}>
            {/* LEFT COLUMN: Input Variables (Collapsible) */}
            {showInputs && (
              <div className="sticky top-0 max-h-[calc(100vh-7rem)] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Input Variables
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInputs(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Hide variables to view map and cost full width"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" /> Hide
                  </button>
                </div>

                {renderInputForm()}
              </div>
            )}

            {/* RIGHT COLUMN (OR EXPANDED FULL WIDTH): Map + Cost Breakdown */}
            <div className="min-w-0">
              {!showInputs && (
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setShowInputs(true)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <PanelLeftOpen className="h-3.5 w-3.5" /> Show Inputs
                  </button>
                </div>
              )}
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DIALOG / MODAL POPUP VIEW (When opened as modal)
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="flex flex-col h-[92vh] max-h-[950px] w-full max-w-6xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
              <Calculator className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white tracking-tight truncate">
                Logistics Cost Estimator
              </h2>
              <p className="text-xs text-white/60 font-medium truncate">
                Mobilisation + Installation cost calculator
                {clientName && <span className="text-blue-300 ml-1">· {clientName}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("px-3 py-1 rounded-md text-white font-mono", costTierBg)}>
              <p className="text-[8px] font-bold uppercase tracking-wider opacity-80">Total Estimate</p>
              <p className="text-sm font-black tabular-nums leading-tight">₦{fmt(estimate.grandTotal)}</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0 text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60 dark:bg-slate-950">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 shadow-xs">
              <div className="pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" /> Input Variables
                </span>
              </div>
              {renderInputForm()}
            </div>
            {renderMainContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
