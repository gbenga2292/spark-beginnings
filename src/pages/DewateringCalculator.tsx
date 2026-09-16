import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, XCircle, ChevronRight,
  Copy, Printer, RotateCcw, ArrowRight, FileText, X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import {
  DewateringInput,
  DewateringCalculationResult,
  calculateDewatering,
  DEFAULT_DEWATERING_INPUT,
  EMPTY_DEWATERING_INPUT,
} from '@/src/utils/dewateringCalculator';
import {
  ElevationLevel,
  HoseData,
  ArrowData,
  AreaData,
  LineData,
  PlacedComponent,
} from '@/src/utils/simulationLogic';
import { toast } from 'sonner';

interface FieldProps {
  id: string;
  label: string;
  unit: string;
  tooltip?: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  warning?: boolean;
}

function NumericField({ id, label, unit, tooltip, value, min, step = 0.1, onChange, disabled, warning }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={cn('flex flex-col gap-1', disabled && 'opacity-40 pointer-events-none')}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {tooltip && (
          <span
            className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-400 flex items-center justify-center cursor-help text-[9px] font-bold leading-none"
            title={tooltip}
          >i</span>
        )}
      </label>
      <div className={cn(
        'flex items-center rounded-md border overflow-hidden transition-colors',
        focused ? 'border-slate-400 dark:border-slate-500' :
        warning ? 'border-orange-400 dark:border-orange-600' :
        'border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900',
      )}>
        <input
          id={id}
          type="number"
          min={min ?? 0}
          step={step}
          value={value === 0 ? '' : value}
          placeholder="0.0"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(0);
            } else {
              const v = parseFloat(raw);
              if (!isNaN(v)) onChange(v);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 px-3 py-1.5 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="px-2.5 py-1.5 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 select-none whitespace-nowrap">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ToggleField({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1',
          value ? 'bg-slate-700 dark:bg-slate-300' : 'bg-slate-200 dark:bg-slate-700',
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          value ? 'translate-x-4' : 'translate-x-0',
        )} />
      </button>
    </div>
  );
}

function StatusBar({ result }: { result: DewateringCalculationResult | null }) {
  if (!result) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
        Enter dimensions above to calculate wellpoint sizing and bill of quantities.
      </div>
    );
  }

  if (result.status === 'ERROR') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60">
        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">Input Error</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{result.errorMessage}</p>
        </div>
      </div>
    );
  }

  if (result.status === 'NOT_REQUIRED') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Dewatering not required</p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            Water level at {result.effectiveWaterLevel.toFixed(2)}m — below the {result.targetDepth.toFixed(2)}m target.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Dewatering required — offset <strong className="text-slate-800 dark:text-slate-200">{result.designOffset.toFixed(2)}m</strong>, perimeter <strong className="text-slate-800 dark:text-slate-200">{result.loopPerimeter.toFixed(1)}m</strong>
        </p>
      </div>
      {result.warningMessage && (
        <div className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-600/90 dark:text-orange-400/90">{result.warningMessage}</p>
        </div>
      )}
    </div>
  );
}

function SiteSchematic({ inputs, result }: { inputs: DewateringInput; result: DewateringCalculationResult | null }) {
  const W = 320;
  const H = 220;
  const PAD = 20;

  const ll = inputs.landLength;
  const lw = inputs.landWidth;

  if (!ll || !lw) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
        <p className="text-xs text-slate-400">Enter site & excavation dimensions to view schematic</p>
      </div>
    );
  }

  const scale = Math.min((W - PAD * 2) / ll, (H - PAD * 2) / lw);

  const landW = ll * scale;
  const landH = lw * scale;
  const landX = (W - landW) / 2;
  const landY = (H - landH) / 2;

  const show = result && result.status === 'REQUIRED';

  const exW = show ? inputs.excavationLength * scale : 0;
  const exH = show ? inputs.excavationWidth * scale : 0;
  const exX = show ? landX + (landW - exW) / 2 : 0;
  const exY = show ? landY + (landH - exH) / 2 : 0;

  const offset = show ? result!.designOffset * scale : 0;
  const ringX = exX - offset;
  const ringY = exY - offset;
  const ringW = exW + offset * 2;
  const ringH = exH + offset * 2;

  // Ingress gap on bottom edge, centered
  const ingressPx = show && inputs.ingressRequired
    ? Math.min(inputs.ingressWidth * scale, ringW * 0.7)
    : 0;
  const ingressL = ringX + ringW / 2 - ingressPx / 2;
  const ingressR = ringX + ringW / 2 + ingressPx / 2;
  const ingressY = ringY + ringH;

  // Build ring-main as 4 separate segments (bottom edge split when ingress is on)
  const ringSegments: { x1: number; y1: number; x2: number; y2: number }[] = show ? [
    // top
    { x1: ringX, y1: ringY, x2: ringX + ringW, y2: ringY },
    // right
    { x1: ringX + ringW, y1: ringY, x2: ringX + ringW, y2: ingressY },
    // left
    { x1: ringX, y1: ringY, x2: ringX, y2: ingressY },
    // bottom-left (up to ingress gap)
    ...(ingressPx > 0 ? [{ x1: ringX, y1: ingressY, x2: ingressL, y2: ingressY }] : [{ x1: ringX, y1: ingressY, x2: ringX + ringW, y2: ingressY }]),
    // bottom-right (after ingress gap)
    ...(ingressPx > 0 ? [{ x1: ingressR, y1: ingressY, x2: ringX + ringW, y2: ingressY }] : []),
  ] : [];

  // Filter points follow the segmented ring (skip the ingress gap area)
  const filterPoints: { x: number; y: number }[] = [];
  if (show && result!.loopPerimeter > 0 && ringSegments.length > 0) {
    const lengths = ringSegments.map(s => Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2));
    const totalPx = lengths.reduce((a, b) => a + b, 0);
    const spacingPx = totalPx / result!.filters;
    let segIdx = 0, segTraveled = 0;
    for (let i = 0; i < result!.filters; i++) {
      const target = i * spacingPx;
      while (segIdx < ringSegments.length - 1 && segTraveled + lengths[segIdx] < target) {
        segTraveled += lengths[segIdx]; segIdx++;
      }
      const t = Math.min(1, (target - segTraveled) / (lengths[segIdx] || 1));
      const seg = ringSegments[Math.min(segIdx, ringSegments.length - 1)];
      filterPoints.push({ x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t });
    }
  }

  // Pump points distributed across ring segments
  const pumpPoints: { x: number; y: number }[] = [];
  if (show && result!.pumps > 0 && ringSegments.length > 0) {
    const lengths = ringSegments.map(s => Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2));
    const totalPx = lengths.reduce((a, b) => a + b, 0);
    const spacingPx = totalPx / result!.pumps;
    for (let i = 0; i < result!.pumps; i++) {
      const target = i * spacingPx + spacingPx / 2;
      let segIdx = 0, segTraveled = 0;
      while (segIdx < ringSegments.length - 1 && segTraveled + lengths[segIdx] < target) {
        segTraveled += lengths[segIdx]; segIdx++;
      }
      const t = Math.min(1, (target - segTraveled) / (lengths[segIdx] || 1));
      const seg = ringSegments[Math.min(segIdx, ringSegments.length - 1)];
      pumpPoints.push({ x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t });
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ fontFamily: 'inherit' }} aria-label="Site plan schematic">
      <rect x="0" y="0" width={W} height={H} fill="transparent" />

      {/* Land boundary */}
      <rect x={landX} y={landY} width={landW} height={landH}
        fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="5 3" />
      <text x={landX + 3} y={landY - 4} fontSize="7" fill="#94a3b8" letterSpacing="0.5">SITE BOUNDARY</text>

      {show && (
        <>
          {/* Ring-main fill */}
          <rect x={ringX} y={ringY} width={ringW} height={ringH} fill="rgba(217,119,6,0.04)" stroke="none" />

          {/* Ring-main segments (with gap if ingress) */}
          {ringSegments.map((seg, i) => (
            <line key={i}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke="#d97706" strokeWidth="1.5" strokeLinecap="square"
            />
          ))}

          {/* Ingress gap — hatch fill + width label */}
          {ingressPx > 0 && (
            <>
              {/* Arrow spanning the gap */}
              <line x1={ingressL} y1={ingressY} x2={ingressR} y2={ingressY}
                stroke="#64748b" strokeWidth="1" strokeDasharray="2 1.5" />
              {/* Vertical tick marks at gap edges */}
              <line x1={ingressL} y1={ingressY - 5} x2={ingressL} y2={ingressY + 5} stroke="#64748b" strokeWidth="1" />
              <line x1={ingressR} y1={ingressY - 5} x2={ingressR} y2={ingressY + 5} stroke="#64748b" strokeWidth="1" />
              {/* Width label */}
              <text
                x={(ingressL + ingressR) / 2} y={ingressY + 12}
                textAnchor="middle" fontSize="6.5" fill="#64748b" fontWeight="600"
              >
                {inputs.ingressWidth.toFixed(1)}m ingress
              </text>
              {/* Access arrow pointing inward */}
              <line
                x1={(ingressL + ingressR) / 2} y1={ingressY + 20}
                x2={(ingressL + ingressR) / 2} y2={ingressY + 6}
                stroke="#475569" strokeWidth="1"
                markerEnd="url(#arrowIn)"
              />
            </>
          )}

          {/* Pit */}
          <rect x={exX} y={exY} width={exW} height={exH}
            fill="rgba(51,65,85,0.08)" stroke="#475569" strokeWidth="1.5" />
          <text x={exX + exW / 2} y={exY + exH / 2 + 3} textAnchor="middle" fontSize="7.5" fill="#64748b" fontWeight="600" letterSpacing="0.5">PIT</text>

          {/* Offset annotation */}
          {result!.designOffset > 0 && (
            <>
              <line x1={exX} y1={exY - 7} x2={ringX} y2={exY - 7} stroke="#d97706" strokeWidth="0.8" />
              <text x={(exX + ringX) / 2} y={exY - 10} textAnchor="middle" fontSize="6" fill="#b45309">{result!.designOffset.toFixed(2)}m</text>
            </>
          )}

          {/* Filter dots */}
          {filterPoints.slice(0, 120).map((pt, i) => (
            <circle key={`f${i}`} cx={pt.x} cy={pt.y} r="2" fill="#10b981" />
          ))}

          {/* Pump markers */}
          {pumpPoints.map((pt, i) => (
            <g key={`p${i}`}>
              <rect x={pt.x - 4.5} y={pt.y - 4.5} width="9" height="9" fill="#1e40af" rx="1.5" />
              <text x={pt.x} y={pt.y + 3} textAnchor="middle" fontSize="5.5" fill="white" fontWeight="700">P</text>
            </g>
          ))}
        </>
      )}

      <defs>
        <marker id="arrowIn" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="#475569" />
        </marker>
      </defs>
    </svg>
  );
}

function Row({ label, value, unit, subtle }: { label: string; value: number | string; unit?: string; subtle?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0',
      subtle && 'opacity-60',
    )}>
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3">{children}</p>;
}

export default function DewateringCalculator() {
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [inputs, setInputs] = useState<DewateringInput>(DEFAULT_DEWATERING_INPUT);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const result = useMemo(() => calculateDewatering(inputs), [inputs]);

  const setField = useCallback(<K extends keyof DewateringInput>(key: K, value: DewateringInput[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(EMPTY_DEWATERING_INPUT);
    toast.info('All inputs cleared');
  }, []);

  const handleCopySummary = useCallback(() => {
    if (!result) return;
    const lines = ['WELLPOINT DEWATERING SIZING', ''];
    lines.push(`Status: ${result.status === 'REQUIRED' ? 'Required' : result.status === 'NOT_REQUIRED' ? 'Not required' : 'Error'}`);
    if (result.status === 'REQUIRED') {
      lines.push(
        `Design offset: ${result.designOffset.toFixed(2)} m`,
        `Loop perimeter: ${result.loopPerimeter.toFixed(2)} m`,
        '',
        'Bill of Quantities',
        `Wellpoint filters (1.0m c/c): ${result.filters}`,
        `Vacuum pumps (100 m3/hr): ${result.pumps}`,
        `Header pipes 6m: ${result.headers6m} pcs`,
        `Header pipes 3m: ${result.headers3m} pcs`,
        `90 deg elbows: ${result.elbows90} pcs`,
        `Tee connectors (pump tie-ins): ${result.tees} pcs`,
        ...(result.endCaps > 0 ? [`End blanking caps: ${result.endCaps} pcs`] : []),
        '',
        result.autoSummary,
      );
    } else {
      lines.push('', result.autoSummary);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast.success('Copied to clipboard'));
  }, [result]);

  const handlePrint = useCallback(() => {
    setShowPrintPreview(true);
  }, []);

  const handleSendToSimulator = useCallback(() => {
    if (!result || result.status !== 'REQUIRED') {
      navigate('/operations/simulator');
      return;
    }

    const SCALE = 10; // 10 px per meter, matching Simulator PIXELS_PER_METER
    const centerX = 550;
    const centerY = 380;

    const L = inputs.excavationLength;
    const W = inputs.excavationWidth;
    const depth = inputs.excavationDepth;
    const offset = result.designOffset;

    // Excavation Pit Box
    const pitW = L * SCALE;
    const pitH = W * SCALE;
    const pitX = Math.round(centerX - pitW / 2);
    const pitY = Math.round(centerY - pitH / 2);

    // 1. Elevation Levels
    const glLevel: ElevationLevel = {
      id: 'level-gl',
      name: 'Ground Level (GL 0.0m)',
      depthFromGL: 0,
      wellpointDepth: Math.max(6, Math.ceil(depth + 1.5)),
    };
    const pitLevel: ElevationLevel = {
      id: 'level-pit',
      name: `Pit Formation Level (-${depth.toFixed(1)}m)`,
      depthFromGL: depth,
      wellpointDepth: Math.max(6, Math.ceil(depth + 1.5)),
    };

    const pitArea: AreaData = {
      id: `pit-${Date.now()}`,
      x: pitX,
      y: pitY,
      width: pitW,
      height: pitH,
      kind: 'excavation',
      levelId: pitLevel.id,
      layerId: 'layer-0',
    };

    // 2. Perimeter Header Ring-main
    const ringX = Math.round(pitX - offset * SCALE);
    const ringY = Math.round(pitY - offset * SCALE);
    const ringW = Math.round(pitW + offset * 2 * SCALE);
    const ringH = Math.round(pitH + offset * 2 * SCALE);
    const botY = ringY + ringH;

    let ringPoints: { x: number; y: number }[] = [];
    const arrows: ArrowData[] = [];
    const texts: any[] = [];
    const placedComponents: PlacedComponent[] = [];
    const hoses: HoseData[] = [];
    const areas: AreaData[] = [pitArea];

    if (inputs.ingressRequired) {
      const ingressPx = Math.min(inputs.ingressWidth * SCALE, ringW * 0.7);
      const gapL = Math.round(ringX + ringW / 2 - ingressPx / 2);
      const gapR = Math.round(ringX + ringW / 2 + ingressPx / 2);

      ringPoints = [
        { x: gapR, y: botY },
        { x: ringX + ringW, y: botY },
        { x: ringX + ringW, y: ringY },
        { x: ringX, y: ringY },
        { x: ringX, y: botY },
        { x: gapL, y: botY },
      ];

      // Visual Ingress Direction Arrow
      arrows.push({
        id: `arrow-ingress-${Date.now()}`,
        start: { x: Math.round(ringX + ringW / 2), y: botY + 60 },
        end: { x: Math.round(ringX + ringW / 2), y: botY - 15 },
        text: 'VEHICLE INGRESS',
        layerId: 'layer-0',
      });

      // Clear Ingress Access Annotation
      texts.push({
        id: `txt-ingress-${Date.now()}`,
        x: Math.round(ringX + ringW / 2) - 60,
        y: botY + 68,
        text: `VEHICLE INGRESS (${inputs.ingressWidth.toFixed(1)}m)`,
        fontSize: 11,
        color: '#0284c7',
        layerId: 'layer-0',
      });
    } else {
      ringPoints = [
        { x: ringX, y: ringY },
        { x: ringX + ringW, y: ringY },
        { x: ringX + ringW, y: ringY + ringH },
        { x: ringX, y: ringY + ringH },
        { x: ringX, y: ringY },
      ];
    }

    const headerLine: LineData = {
      id: `header-ring-${Date.now()}`,
      points: ringPoints,
      depthFromGL: 0,
      levelId: glLevel.id,
      wellpointSide: 'left',
      layerId: 'layer-0',
    };

    // 3. Vacuum Pumps, Header Tie-In Tees, Suction & Discharge Hoses
    // Set pumps back ~45px outside the top header ring
    const pumpY = ringY - 45;
    const numPumps = Math.max(1, result.pumps);
    const pumpCoords: { x: number; y: number }[] = [];

    if (numPumps === 1) {
      pumpCoords.push({ x: Math.round(ringX + ringW / 2), y: pumpY });
    } else {
      for (let i = 0; i < numPumps; i++) {
        const fraction = (i + 1) / (numPumps + 1);
        pumpCoords.push({ x: Math.round(ringX + ringW * fraction), y: pumpY });
      }
    }

    // Site Discharge Basin (Settlement Area) placed outside the perimeter
    const dischargeBasinX = Math.round(ringX + ringW + 25);
    const dischargeBasinY = ringY - 60;
    const dischargeBasin: AreaData = {
      id: `discharge-basin-${Date.now()}`,
      x: dischargeBasinX,
      y: dischargeBasinY,
      width: 70, // 7m
      height: 50, // 5m
      kind: 'discharge',
      levelId: glLevel.id,
      layerId: 'layer-0',
    };
    areas.push(dischargeBasin);

    pumpCoords.forEach((pCoord, idx) => {
      const pId = `pump-${Date.now()}-${idx + 1}`;
      
      // Placed Pump
      placedComponents.push({
        id: pId,
        type: 'pump',
        x: pCoord.x,
        y: pCoord.y,
        levelId: glLevel.id,
        layerId: 'layer-0',
      });

      // Header Tie-in Tee (rotation 180 points branch upward directly to pump suction port)
      placedComponents.push({
        id: `tee-${pId}`,
        type: 'tee',
        x: pCoord.x - 20,
        y: ringY,
        rotation: 180,
        levelId: glLevel.id,
        layerId: 'layer-0',
      });

      // Flexible Suction Pipe (yellow armored hose from header tee to pump suction inlet)
      hoses.push({
        id: `suction-hose-${idx + 1}-${Date.now()}`,
        kind: 'suction',
        points: [
          { x: pCoord.x - 20, y: ringY },
          { x: pCoord.x - 20, y: pCoord.y },
        ],
        layerId: 'layer-0',
      });

      // Layflat Discharge Pipe (orange hose from pump discharge outlet to discharge basin)
      hoses.push({
        id: `discharge-hose-${idx + 1}-${Date.now()}`,
        kind: 'discharge',
        points: [
          { x: pCoord.x + 20, y: pCoord.y },
          { x: pCoord.x + 60, y: pCoord.y - 25 },
          { x: dischargeBasinX + 15, y: dischargeBasinY + 25 },
        ],
        layerId: 'layer-0',
      });
    });

    // 4. De-cluttered annotations (clean pit title only, avoid overlapping boundary badges)
    texts.push({
      id: `txt-pit-${Date.now()}`,
      x: pitX + 15,
      y: pitY + 22,
      text: `EXCAVATION PIT (-${depth.toFixed(1)}m)`,
      fontSize: 12,
      color: '#475569',
      layerId: 'layer-0',
    });

    const layoutPayload = {
      name: `Dewatering - ${L}x${W}m Pit`,
      lines: [headerLine],
      areas,
      components: placedComponents,
      hoses,
      arrows,
      dimensions: [], // Omit manual dimensions so native Konva area labels don't collide
      texts,
      levels: [glLevel, pitLevel],
      activeLevelId: pitLevel.id,
      targetDepth: depth,
    };

    try {
      sessionStorage.setItem('dewatering_calculator_import', JSON.stringify(layoutPayload));
    } catch {
      // ignore
    }

    navigate('/operations/simulator', {
      state: {
        fromCalculator: true,
        layoutData: layoutPayload,
      },
    });
    toast.success('Layout sent to Simulator');
  }, [navigate, result, inputs]);

  const showResults = result?.status === 'REQUIRED';

  const headerButtons = useMemo(() => (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs h-8 print:hidden">
        <RotateCcw className="h-3 w-3" />
        Reset
      </Button>
      {showResults && (
        <>
          <Button variant="outline" size="sm" onClick={handleCopySummary} className="gap-1.5 text-xs h-8 print:hidden">
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8 print:hidden">
            <Printer className="h-3 w-3" />
            Print
          </Button>
          <Button size="sm" onClick={handleSendToSimulator} className="gap-1.5 text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white border-0 print:hidden">
            <ArrowRight className="h-3 w-3" />
            Send to Simulator
          </Button>
        </>
      )}
    </div>
  ), [showResults, handleReset, handleCopySummary, handlePrint, handleSendToSimulator]);

  useSetPageTitle(
    'Dewatering Calculator',
    'Perimeter ring-main sizing & bill of quantities',
    headerButtons,
    [showResults],
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 print:bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Left: Inputs */}
        <div className="flex flex-col gap-4">

          {/* Dimensions */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <SectionLabel>Site & Excavation</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <NumericField id="landLength" label="Land Length" unit="m"
                tooltip="Total land parcel length."
                value={inputs.landLength} min={0.1}
                onChange={v => setField('landLength', v)}
                warning={inputs.landLength <= inputs.excavationLength} />
              <NumericField id="landWidth" label="Land Width" unit="m"
                tooltip="Total land parcel width."
                value={inputs.landWidth} min={0.1}
                onChange={v => setField('landWidth', v)}
                warning={inputs.landWidth <= inputs.excavationWidth} />
              <NumericField id="excavationLength" label="Pit Length" unit="m"
                tooltip="Excavation length. Must be less than land length."
                value={inputs.excavationLength} min={0.1}
                onChange={v => setField('excavationLength', v)} />
              <NumericField id="excavationWidth" label="Pit Width" unit="m"
                tooltip="Excavation width. Must be less than land width."
                value={inputs.excavationWidth} min={0.1}
                onChange={v => setField('excavationWidth', v)} />
              <div className="col-span-2">
                <NumericField id="excavationDepth" label="Depth" unit="m"
                  tooltip="Formation level depth below existing ground."
                  value={inputs.excavationDepth} min={0.1}
                  onChange={v => setField('excavationDepth', v)} />
              </div>
            </div>
          </div>

          {/* Groundwater */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <SectionLabel>Groundwater</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <NumericField id="waterTableDepth" label="Water Table" unit="m b.g.l."
                tooltip="Static water table depth below existing ground level."
                value={inputs.waterTableDepth} min={0}
                onChange={v => setField('waterTableDepth', v)} />
              <NumericField id="requiredDrawdown" label="Drawdown" unit="m below pit"
                tooltip="Required drawdown below the formation level."
                value={inputs.requiredDrawdown} min={0}
                onChange={v => setField('requiredDrawdown', v)} />
            </div>
          </div>

          {/* Ingress */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <SectionLabel>Ingress</SectionLabel>
            <div className="flex flex-col gap-3">
              <ToggleField id="ingressRequired" label="Vehicle ramp / ingress required"
                value={inputs.ingressRequired} onChange={v => setField('ingressRequired', v)} />
              <NumericField id="ingressWidth" label="Opening width" unit="m"
                tooltip="Break in ring-main for vehicle access. Minimum 6.0m."
                value={inputs.ingressWidth} min={6.0}
                onChange={v => setField('ingressWidth', Math.max(6.0, v))}
                disabled={!inputs.ingressRequired} />
              {inputs.ingressRequired && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Ingress creates an open perimeter (3 elbows) and requires 2 end blanking caps to seal the ramp break.
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <StatusBar result={result} />
        </div>

        {/* Right: Results */}
        <div className="flex flex-col gap-4">

          {/* Schematic */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Site Plan</SectionLabel>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Filter</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block" />Pump</span>
                <span className="flex items-center gap-1"><span className="w-5 h-px bg-amber-400 inline-block" />Ring-main</span>
              </div>
            </div>
            <div className="h-[220px]">
              <SiteSchematic inputs={inputs} result={result} />
            </div>
          </div>

          {/* BOQ */}
          {showResults && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4" ref={summaryRef}>
              <SectionLabel>Bill of Quantities</SectionLabel>
              <Row label="Loop perimeter" value={result.loopPerimeter.toFixed(2)} unit="m" />
              <Row label="Wellpoint filters (1.0m c/c)" value={result.filters} />
              <Row label="Vacuum pumps (100 m3/hr, max 60m)" value={result.pumps} />
              <Row label="Header pipes, 6m" value={result.headers6m} unit="pcs" />
              <Row label="Header pipes, 3m" value={result.headers3m} unit="pcs" subtle={result.headers3m === 0} />
              <Row label="90 deg elbows" value={result.elbows90} unit="pcs" />
              <Row label="Tee connectors (pump tie-ins)" value={result.tees} unit="pcs" />
              {result.endCaps > 0 && (
                <Row label="End blanking caps" value={result.endCaps} unit="pcs" />
              )}
              {inputs.ingressRequired && (
                <Row label="Ingress opening" value={inputs.ingressWidth.toFixed(2)} unit="m" />
              )}

              <details className="mt-3 group">
                <summary className="text-[11px] text-slate-400 cursor-pointer select-none flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Calculation steps
                </summary>
                <div className="mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-md font-mono text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 leading-relaxed">
                  <p>Target depth = D + 0.5 = {(inputs.excavationDepth + 0.5).toFixed(2)}m</p>
                  <p>Effective water level = WT - Rd = {result.effectiveWaterLevel.toFixed(2)}m</p>
                  <p>Offset L = (LL - L) / 2 = {result.offsetL.toFixed(2)}m</p>
                  <p>Offset W = (LW - W) / 2 = {result.offsetW.toFixed(2)}m</p>
                  <p>Design offset = min(1.0, {result.offsetL.toFixed(2)}, {result.offsetW.toFixed(2)}) = {result.designOffset.toFixed(2)}m</p>
                  <p>Eff. L = L + 2 * offset = {result.effL.toFixed(2)}m</p>
                  <p>Eff. W = W + 2 * offset = {result.effW.toFixed(2)}m</p>
                  <p>P = 2 * (effL + effW) = {result.loopPerimeter.toFixed(2)}m</p>
                  <p>Filters = ceil(P / 1.0) = {result.filters}</p>
                  <p>Pumps = max(1, ceil(P / 60)) = {result.pumps}</p>
                  <p>Base header = P + pumps * 2 = {result.baseHeaderLength.toFixed(2)}m</p>
                  <p>Final header = ceil(base * 1.10) = {result.finalHeaderLength}m</p>
                </div>
              </details>
            </div>
          )}

          {/* Summary note */}
          {result && result.status !== 'ERROR' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{result.autoSummary}</p>
                {showResults && (
                  <button onClick={handleCopySummary} className="shrink-0 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors">
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Not required state */}
          {result?.status === 'NOT_REQUIRED' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-5 py-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No dewatering required</p>
                <p className="text-xs text-slate-400 mt-1">Water table is naturally below the target level for this configuration.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block px-8 py-4 border-b">
        <p className="text-lg font-semibold">Wellpoint Dewatering Sizing</p>
        <p className="text-xs text-gray-400">{new Date().toLocaleString()}</p>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        open={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        inputs={inputs}
        result={result}
      />
    </div>
  );
}

function PrintPreviewModal({
  open,
  onClose,
  inputs,
  result,
}: {
  open: boolean;
  onClose: () => void;
  inputs: DewateringInput;
  result: DewateringCalculationResult | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm print:bg-white print:static print:z-auto">
      <style>{`
        @media print {
          @page {
            margin: 12mm;
            size: A4 portrait;
          }
          body {
            background: #fff !important;
          }
          body * {
            visibility: hidden;
          }
          #dewatering-print-preview-sheet, #dewatering-print-preview-sheet * {
            visibility: visible;
          }
          #dewatering-print-preview-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Top action bar - hidden when printed */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 text-white border-b border-slate-800 print:hidden shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Print Preview</h2>
            <p className="text-[11px] text-slate-400">Formal A4 Engineering Bill of Quantities & Site Plan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Close Preview
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Document
          </Button>
        </div>
      </div>

      {/* Printable Sheet Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
        <div
          id="dewatering-print-preview-sheet"
          className="w-full max-w-[800px] bg-white text-slate-900 p-8 sm:p-10 rounded-lg shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none"
        >
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">DCEL Engineering Operations</p>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-0.5">
                  Wellpoint Dewatering Sizing & BOQ Specification
                </h1>
              </div>
              <div className="text-right">
                <span className={cn(
                  "inline-block px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider",
                  result?.status === 'REQUIRED' ? "bg-amber-100 text-amber-900 border border-amber-300" :
                  result?.status === 'NOT_REQUIRED' ? "bg-emerald-100 text-emerald-900 border border-emerald-300" :
                  "bg-slate-100 text-slate-700 border border-slate-300"
                )}>
                  {result?.status === 'REQUIRED' ? 'Dewatering Required' : result?.status === 'NOT_REQUIRED' ? 'Dewatering Not Required' : 'Draft Specification'}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Site Geometry & Water Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
              1. Site & Groundwater Parameters
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Land Boundary</span>
                <strong className="text-slate-900 font-semibold">{inputs.landLength}m × {inputs.landWidth}m</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Excavation Pit</span>
                <strong className="text-slate-900 font-semibold">{inputs.excavationLength}m × {inputs.excavationWidth}m</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Excavation Depth</span>
                <strong className="text-slate-900 font-semibold">{inputs.excavationDepth} m</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Static Water Table</span>
                <strong className="text-slate-900 font-semibold">{inputs.waterTableDepth} m b.g.l.</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Required Drawdown</span>
                <strong className="text-slate-900 font-semibold">{inputs.requiredDrawdown} m below pit</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Site Ingress Ramp</span>
                <strong className="text-slate-900 font-semibold">
                  {inputs.ingressRequired ? `Yes (${inputs.ingressWidth}m opening)` : 'No (Closed perimeter)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 2: Schematic Vector Plan */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
              2. Schematic Layout Plan
            </h3>
            <div className="h-[200px] border border-slate-200 rounded p-2 bg-slate-50/50 flex items-center justify-center">
              <SiteSchematic inputs={inputs} result={result} />
            </div>
          </div>

          {/* Section 3: Bill of Quantities */}
          {result && result.status === 'REQUIRED' && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                3. Bill of Quantities (BOQ) & Equipment Sizing
              </h3>
              <table className="w-full text-left text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold">
                    <th className="p-2 border border-slate-200">Item Description</th>
                    <th className="p-2 border border-slate-200 text-right">Quantity</th>
                    <th className="p-2 border border-slate-200">Unit</th>
                    <th className="p-2 border border-slate-200">Engineering Application</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">Header Ring Perimeter</td>
                    <td className="p-2 border border-slate-200 text-right font-mono">{result.loopPerimeter.toFixed(2)}</td>
                    <td className="p-2 border border-slate-200">m</td>
                    <td className="p-2 border border-slate-200 text-slate-500">Centerline perimeter at {result.designOffset.toFixed(2)}m setback offset</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">Wellpoint Filters</td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.filters}</td>
                    <td className="p-2 border border-slate-200">units</td>
                    <td className="p-2 border border-slate-200 text-slate-500">Self-jetting wellpoints spaced at 1.0m c/c along header</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">Vacuum Pumps</td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.pumps}</td>
                    <td className="p-2 border border-slate-200">units</td>
                    <td className="p-2 border border-slate-200 text-slate-500">100 m³/hr capacity vacuum dewatering units (max 60m header each)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">Header Pipes, 6m Standard</td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.headers6m}</td>
                    <td className="p-2 border border-slate-200">pcs</td>
                    <td className="p-2 border border-slate-200 text-slate-500">6" quick-coupling vacuum header pipe sections</td>
                  </tr>
                  {result.headers3m > 0 && (
                    <tr>
                      <td className="p-2 border border-slate-200 font-medium">Header Pipes, 3m Compensation</td>
                      <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.headers3m}</td>
                      <td className="p-2 border border-slate-200">pcs</td>
                      <td className="p-2 border border-slate-200 text-slate-500">3" modular compensation piece for exact closure</td>
                    </tr>
                  )}
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">90° Corner Elbows</td>
                    <td className="p-2 border border-slate-200 text-right font-mono">{result.elbows90}</td>
                    <td className="p-2 border border-slate-200">pcs</td>
                    <td className="p-2 border border-slate-200 text-slate-500">{inputs.ingressRequired ? '3 corner bends (ingress ramp open edge)' : '4 corner perimeter bends'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 font-medium">Tee Connectors</td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.tees}</td>
                    <td className="p-2 border border-slate-200">pcs</td>
                    <td className="p-2 border border-slate-200 text-slate-500">In-line pump suction tie-ins (1 per operating vacuum pump)</td>
                  </tr>
                  {result.endCaps > 0 && (
                    <tr>
                      <td className="p-2 border border-slate-200 font-medium">End Blanking Caps</td>
                      <td className="p-2 border border-slate-200 text-right font-mono font-bold">{result.endCaps}</td>
                      <td className="p-2 border border-slate-200">pcs</td>
                      <td className="p-2 border border-slate-200 text-slate-500">Vacuum-tight blanking plugs to seal the header break at vehicle ramp</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 4: Engineering Calculation Audit */}
          {result && result.status === 'REQUIRED' && (
            <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-800 uppercase text-[10px] mb-1 font-sans">Calculation Audit:</p>
              <p>Target dry depth = Excavation Depth ({inputs.excavationDepth}m) + 0.5m = {(inputs.excavationDepth + 0.5).toFixed(2)}m b.g.l.</p>
              <p>Effective water table = WT ({inputs.waterTableDepth}m) - Rd ({inputs.requiredDrawdown}m) = {result.effectiveWaterLevel.toFixed(2)}m b.g.l.</p>
              <p>Setback offset = min(1.0m, {result.offsetL.toFixed(2)}m, {result.offsetW.toFixed(2)}m) = {result.designOffset.toFixed(2)}m</p>
              <p>Perimeter = 2 × (Eff. L {result.effL.toFixed(2)}m + Eff. W {result.effW.toFixed(2)}m) = {result.loopPerimeter.toFixed(2)}m</p>
              <p>Header required = ({result.loopPerimeter.toFixed(2)}m + {result.pumps}×2m) × 1.10 = {result.finalHeaderLength}m</p>
            </div>
          )}

          {/* Section 5: Engineering Remarks */}
          <div className="mb-8 text-xs text-slate-600 leading-relaxed border-l-2 border-amber-400 pl-3">
            <strong className="text-slate-800 block text-[11px] uppercase tracking-wide">Installation Notes:</strong>
            {result?.autoSummary}
          </div>

          {/* Sign-off Footer */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-[11px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Prepared By:</p>
              <div className="mt-4 border-b border-slate-300 w-32" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Verified & Checked:</p>
              <div className="mt-4 border-b border-slate-300 w-32" />
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-700">Site Clearance Stamp</p>
              <div className="mt-2 text-[10px] text-slate-400">DCEL Operations Suite</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
