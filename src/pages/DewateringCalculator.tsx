import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2, XCircle, ChevronRight,
  Copy, Printer, RotateCcw, ArrowRight, FileText, X,
  Map, Eye, EyeOff, Sparkles, SlidersHorizontal, PanelLeftClose, PanelLeftOpen,
  Columns, ArrowLeft, RotateCw, Info,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import logoSrc from '../../logo/logo-2.png';
import {
  DewateringInput,
  DewateringCalculationResult,
  DewateringLayoutType,
  PipeStockOption,
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
import { useTheme } from '@/src/hooks/useTheme';

/* -------------------------------------------------------------------------
   Minimalist Form Controls
------------------------------------------------------------------------- */

function CompactNumber({
  label,
  value,
  unit,
  min = 0,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 text-xs">
      <span className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap mr-3">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={min}
          step={step}
          value={value === 0 ? '' : value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 text-right px-2 py-0.5 text-xs font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:border-amber-500 focus:outline-none text-slate-900 dark:text-white"
        />
        <span className="text-[11px] text-slate-400 text-left font-mono whitespace-nowrap min-w-[20px]">{unit}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Schematic Visualizer (2D Site Plan with Auto-Fit Framing)
------------------------------------------------------------------------- */

function SiteSchematic({
  inputs,
  result,
}: {
  inputs: DewateringInput;
  result: DewateringCalculationResult | null;
}) {
  const { isDark } = useTheme();
  const W = 660;
  const H = 400;
  const PAD = 36;

  const ll = inputs.landLength || 30;
  const lw = inputs.landWidth || 24;
  const pitL = inputs.excavationLength || 6;
  const pitW = inputs.excavationWidth || 6;
  const offset = result?.designOffset ?? 1.0;

  if (ll <= 0 || lw <= 0 || pitL <= 0 || pitW <= 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        Enter valid dimensions to view plan
      </div>
    );
  }

  const show = result && result.status === 'REQUIRED';
  const layout = result?.layoutType || inputs.layoutType || 'ring';

  // Ring bounding box in meters
  const ringL = pitL + 2 * offset;
  const ringW = pitW + 2 * offset;

  // Auto-fit frame — extra padding for run labels on all sides
  const frameL = Math.max(ringL + 8, 12);
  const frameW = Math.max(ringW + 8, 10);

  const scale = Math.min((W - PAD * 2) / frameL, (H - PAD * 2 - 36) / frameW);
  const cx = W / 2;
  const cy = (H - 36) / 2 + PAD / 2; // shift slightly up to leave legend space at bottom

  // Pit dimensions in px
  const exW = pitL * scale;
  const exH = pitW * scale;
  const exX = cx - exW / 2;
  const exY = cy - exH / 2;

  // Ring dimensions in px
  const offsetPx = offset * scale;
  const ringX = exX - offsetPx;
  const ringY = exY - offsetPx;
  const ringWidth = exW + offsetPx * 2;
  const ringHeight = exH + offsetPx * 2;
  const botY = ringY + ringHeight;

  // Boundary dimensions in px
  const landW = ll * scale;
  const landH = lw * scale;
  const landX = cx - landW / 2;
  const landY = cy - landH / 2;

  // Ingress break calculations
  const ingressSide = inputs.ingressSide || 'south';
  const ingressMeters = show && layout === 'ring' && inputs.ingressRequired ? inputs.ingressWidth : 0;
  const isHorizSide = ingressSide === 'north' || ingressSide === 'south';
  const ingressPx = ingressMeters > 0 ? Math.min(ingressMeters * scale, (isHorizSide ? ringWidth : ringHeight) * 0.75) : 0;
  const ingressL = ringX + ringWidth / 2 - ingressPx / 2;
  const ingressR = ringX + ringWidth / 2 + ingressPx / 2;
  const ingressT = ringY + ringHeight / 2 - ingressPx / 2;
  const ingressB = ringY + ringHeight / 2 + ingressPx / 2;

  // Segments for drawing header lines
  const ringSegments: { x1: number; y1: number; x2: number; y2: number; name: string; lengthM: number }[] = [];
  const endCaps: { x: number; y: number; isHoriz: boolean }[] = [];

  if (show) {
    if (layout === 'ring') {
      // North
      if (ingressPx > 0 && ingressSide === 'north') {
        ringSegments.push({ x1: ringX, y1: ringY, x2: ingressL, y2: ringY, name: 'North', lengthM: Math.max(0, (ringL - ingressMeters) / 2) });
        ringSegments.push({ x1: ingressR, y1: ringY, x2: ringX + ringWidth, y2: ringY, name: 'North', lengthM: Math.max(0, (ringL - ingressMeters) / 2) });
        endCaps.push({ x: ingressL, y: ringY, isHoriz: false });
        endCaps.push({ x: ingressR, y: ringY, isHoriz: false });
      } else {
        ringSegments.push({ x1: ringX, y1: ringY, x2: ringX + ringWidth, y2: ringY, name: 'North', lengthM: ringL });
      }

      // East
      if (ingressPx > 0 && ingressSide === 'east') {
        ringSegments.push({ x1: ringX + ringWidth, y1: ringY, x2: ringX + ringWidth, y2: ingressT, name: 'East', lengthM: Math.max(0, (ringW - ingressMeters) / 2) });
        ringSegments.push({ x1: ringX + ringWidth, y1: ingressB, x2: ringX + ringWidth, y2: botY, name: 'East', lengthM: Math.max(0, (ringW - ingressMeters) / 2) });
        endCaps.push({ x: ringX + ringWidth, y: ingressT, isHoriz: true });
        endCaps.push({ x: ringX + ringWidth, y: ingressB, isHoriz: true });
      } else {
        ringSegments.push({ x1: ringX + ringWidth, y1: ringY, x2: ringX + ringWidth, y2: botY, name: 'East', lengthM: ringW });
      }

      // South
      if (ingressPx > 0 && ingressSide === 'south') {
        ringSegments.push({ x1: ringX, y1: botY, x2: ingressL, y2: botY, name: 'South', lengthM: Math.max(0, (ringL - ingressMeters) / 2) });
        ringSegments.push({ x1: ingressR, y1: botY, x2: ringX + ringWidth, y2: botY, name: 'South', lengthM: Math.max(0, (ringL - ingressMeters) / 2) });
        endCaps.push({ x: ingressL, y: botY, isHoriz: false });
        endCaps.push({ x: ingressR, y: botY, isHoriz: false });
      } else {
        ringSegments.push({ x1: ringX, y1: botY, x2: ringX + ringWidth, y2: botY, name: 'South', lengthM: ringL });
      }

      // West
      if (ingressPx > 0 && ingressSide === 'west') {
        ringSegments.push({ x1: ringX, y1: ringY, x2: ringX, y2: ingressT, name: 'West', lengthM: Math.max(0, (ringW - ingressMeters) / 2) });
        ringSegments.push({ x1: ringX, y1: ingressB, x2: ringX, y2: botY, name: 'West', lengthM: Math.max(0, (ringW - ingressMeters) / 2) });
        endCaps.push({ x: ringX, y: ingressT, isHoriz: true });
        endCaps.push({ x: ringX, y: ingressB, isHoriz: true });
      } else {
        ringSegments.push({ x1: ringX, y1: ringY, x2: ringX, y2: botY, name: 'West', lengthM: ringW });
      }
    } else if (layout === 'u_shape') {
      ringSegments.push({ x1: ringX, y1: ringY, x2: ringX + ringWidth, y2: ringY, name: 'North', lengthM: ringL });
      ringSegments.push({ x1: ringX + ringWidth, y1: ringY, x2: ringX + ringWidth, y2: botY, name: 'East', lengthM: ringW });
      ringSegments.push({ x1: ringX, y1: ringY, x2: ringX, y2: botY, name: 'West', lengthM: ringW });
      endCaps.push({ x: ringX, y: botY, isHoriz: true });
      endCaps.push({ x: ringX + ringWidth, y: botY, isHoriz: true });
    } else if (layout === 'l_shape') {
      ringSegments.push({ x1: ringX, y1: ringY, x2: ringX + ringWidth, y2: ringY, name: 'North', lengthM: ringL });
      ringSegments.push({ x1: ringX, y1: ringY, x2: ringX, y2: botY, name: 'West', lengthM: ringW });
      endCaps.push({ x: ringX + ringWidth, y: ringY, isHoriz: false });
      endCaps.push({ x: ringX, y: botY, isHoriz: true });
    } else {
      // Single line
      ringSegments.push({ x1: ringX, y1: ringY, x2: ringX + ringWidth, y2: ringY, name: 'North', lengthM: ringL });
      endCaps.push({ x: ringX, y: ringY, isHoriz: false });
      endCaps.push({ x: ringX + ringWidth, y: ringY, isHoriz: false });
    }
  }

  // Wellpoint dots
  const filterPoints: { x: number; y: number }[] = [];
  if (show && result!.loopPerimeter > 0 && ringSegments.length > 0) {
    const lengths = ringSegments.map(s => Math.sqrt((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2));
    const totalPx = lengths.reduce((a, b) => a + b, 0);
    const spacingPx = totalPx / result!.filters;
    let segIdx = 0, segTraveled = 0;
    for (let i = 0; i < result!.filters; i++) {
      const target = i * spacingPx + spacingPx / 2;
      while (segIdx < ringSegments.length - 1 && segTraveled + lengths[segIdx] < target) {
        segTraveled += lengths[segIdx];
        segIdx++;
      }
      const t = Math.min(1, Math.max(0, (target - segTraveled) / (lengths[segIdx] || 1)));
      const seg = ringSegments[Math.min(segIdx, ringSegments.length - 1)];
      filterPoints.push({ x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t });
    }
  }

  // Optimal pump position — avoid ingress gap
  let pumpX = ringX + ringWidth / 2;
  let pumpY = ringY;
  if (layout === 'l_shape') {
    pumpX = ringX;
    pumpY = ringY;
  } else if (layout === 'ring' && ingressPx > 0 && ingressSide === 'north') {
    pumpX = ringX + ringWidth * 0.2;
  }

  // Get run summary info from result — only show if there are actual pipes
  const northRun = result?.runs.find(r => r.id === 'north');
  const eastRun = result?.runs.find(r => r.id === 'east');
  const southRun = result?.runs.find(r => r.id === 'south');
  const westRun = result?.runs.find(r => r.id === 'west');

  const formatRunLabel = (run?: typeof northRun) => {
    if (!run || run.length <= 0) return null;
    const parts = [];
    if (run.headers6m > 0) parts.push(`${run.headers6m}×6m`);
    if (run.headers3m > 0) parts.push(`${run.headers3m}×3m`);
    if (parts.length === 0) return null;
    return `${run.length.toFixed(1)}m  (${parts.join(' + ')})`;
  };

  const pitFloorFill = isDark ? '#1e293b' : '#f8fafc';
  const pitFloorStroke = isDark ? '#475569' : '#94a3b8';
  const pitTitleFill = isDark ? '#f8fafc' : '#0f172a';
  const pitSubtitleFill = isDark ? '#94a3b8' : '#475569';
  const boundaryTextColor = isDark ? '#94a3b8' : '#64748b';
  const boundaryStroke = isDark ? '#475569' : '#cbd5e1';
  const runTextColor = isDark ? '#f59e0b' : '#b45309';
  const compassBg = isDark ? '#1e293b' : '#ffffff';
  const compassBorder = isDark ? '#475569' : '#cbd5e1';
  const legendBg = isDark ? '#0f172a' : '#ffffff';
  const legendBorder = isDark ? '#334155' : '#e2e8f0';
  const legendText = isDark ? '#94a3b8' : '#64748b';

  // Label clearances (keep labels outside the ring bounds)
  const runLabelGap = 18;
  const northLabelY = Math.max(PAD - 2, ringY - runLabelGap);
  const southLabelY = Math.min(H - 50, botY + runLabelGap + 4);
  const eastLabelX = Math.min(W - 8, ringX + ringWidth + runLabelGap);
  const westLabelX = Math.max(8, ringX - runLabelGap);

  const nLabel = formatRunLabel(northRun);
  const eLabel = formatRunLabel(eastRun);
  const sLabel = formatRunLabel(southRun);
  const wLabel = formatRunLabel(westRun);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="select-none font-mono">
      <rect x="0" y="0" width={W} height={H} fill="transparent" />

      {/* Grid Pattern / Site Boundary */}
      <rect
        x={landX}
        y={landY}
        width={landW}
        height={landH}
        fill="none"
        stroke={boundaryStroke}
        strokeWidth="1"
        strokeDasharray="5 4"
        opacity={isDark ? 0.4 : 0.7}
      />
      <text x={Math.max(12, landX + 6)} y={Math.max(16, landY + 11)} fontSize="8.5" fill={boundaryTextColor} fontWeight="600">
        SITE BOUNDARY: {ll}m × {lw}m
      </text>

      {/* Compass Rose */}
      <g transform={`translate(${W - 32}, 26)`}>
        <circle cx="0" cy="0" r="13" fill={compassBg} stroke={compassBorder} strokeWidth="1" />
        <path d="M 0 -9 L 3.5 0 L -3.5 0 Z" fill="#ef4444" />
        <path d="M 0 9 L 3.5 0 L -3.5 0 Z" fill={isDark ? '#64748b' : '#94a3b8'} />
        <text x="0" y="-11" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#ef4444">N</text>
      </g>

      {show && (
        <>
          {/* Excavation Pit Floor */}
          <rect
            x={exX}
            y={exY}
            width={exW}
            height={exH}
            fill={pitFloorFill}
            stroke={pitFloorStroke}
            strokeWidth="1.8"
            rx="1"
          />

          {/* Pit Labels */}
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="10" fill={pitTitleFill} fontWeight="700">
            EXCAVATION PIT
          </text>
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize="9" fill={pitSubtitleFill} fontWeight="600">
            {pitL}m × {pitW}m  ·  Depth: {inputs.excavationDepth}m
          </text>

          {/* Setback callout line */}
          {result!.designOffset > 0 && (
            <g>
              <line x1={exX} y1={exY + exH / 2} x2={ringX} y2={exY + exH / 2} stroke="#d97706" strokeWidth="1" strokeDasharray="2 1" />
              <text x={(exX + ringX) / 2} y={exY + exH / 2 - 4} textAnchor="middle" fontSize="8" fill="#d97706" fontWeight="bold">
                {result!.designOffset.toFixed(2)}m
              </text>
            </g>
          )}

          {/* Header Lines */}
          {ringSegments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="#f59e0b"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          ))}

          {/* End Caps */}
          {endCaps.map((c, i) => (
            <line
              key={`cap-${i}`}
              x1={c.isHoriz ? c.x - 5 : c.x}
              y1={c.isHoriz ? c.y : c.y - 5}
              x2={c.isHoriz ? c.x + 5 : c.x}
              y2={c.isHoriz ? c.y : c.y + 5}
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="square"
            />
          ))}

          {/* Filter (Wellpoint) Dots */}
          {filterPoints.map((pt, i) => (
            <circle
              key={`f${i}`}
              cx={pt.x}
              cy={pt.y}
              r="2.2"
              fill="#10b981"
              stroke="#065f46"
              strokeWidth="0.6"
            />
          ))}

          {/* ── Run Dimension Labels ── kept outside ring box, skipped if no pipes ── */}
          {nLabel && (
            <text x={cx} y={northLabelY} textAnchor="middle" fontSize="8.5" fill={runTextColor} fontWeight="700">
              N: {nLabel}
            </text>
          )}
          {sLabel && (
            <text x={cx} y={southLabelY} textAnchor="middle" fontSize="8.5" fill={runTextColor} fontWeight="700">
              S: {sLabel}
            </text>
          )}
          {eLabel && (
            <text
              x={eastLabelX}
              y={cy}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize="8.5"
              fill={runTextColor}
              fontWeight="700"
            >
              E: {eLabel}
            </text>
          )}
          {wLabel && (
            <text
              x={westLabelX}
              y={cy}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="8.5"
              fill={runTextColor}
              fontWeight="700"
            >
              W: {wLabel}
            </text>
          )}

          {/* ── Ingress Opening ── simple callout placed beside the gap ── */}
          {ingressPx > 0 && (
            <g>
              {(ingressSide === 'south' || ingressSide === 'north') && (
                <>
                  <rect
                    x={ingressL}
                    y={ingressSide === 'south' ? botY - 5 : ringY - 5}
                    width={ingressPx}
                    height="10"
                    fill="#fef3c7"
                    stroke="#d97706"
                    strokeWidth="0.8"
                    strokeDasharray="3 2"
                    rx="1"
                  />
                  <text
                    x={ingressR + 6}
                    y={ingressSide === 'south' ? botY + 3 : ringY + 3}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize="8"
                    fill="#92400e"
                    fontWeight="700"
                  >
                    {`<< INGRESS ${ingressMeters}m`}
                  </text>
                </>
              )}
              {(ingressSide === 'east' || ingressSide === 'west') && (
                <>
                  <rect
                    x={ingressSide === 'east' ? ringX + ringWidth - 5 : ringX - 5}
                    y={ingressT}
                    width="10"
                    height={ingressPx}
                    fill="#fef3c7"
                    stroke="#d97706"
                    strokeWidth="0.8"
                    strokeDasharray="3 2"
                    rx="1"
                  />
                  <text
                    x={ingressSide === 'east' ? ringX + ringWidth + 10 : ringX - 10}
                    y={ingressT - 5}
                    textAnchor={ingressSide === 'east' ? 'start' : 'end'}
                    fontSize="8"
                    fill="#92400e"
                    fontWeight="700"
                  >
                    {`INGRESS ${ingressMeters}m >>`}
                  </text>
                </>
              )}
            </g>
          )}

          {/* ── Pump Unit ── wider box, legible label ── */}
          <g>
            <circle cx={pumpX} cy={pumpY} r="4" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
            <line x1={pumpX} y1={pumpY} x2={pumpX} y2={pumpY - 20} stroke="#ca8a04" strokeWidth="1.6" strokeDasharray="2 1" />
            <rect x={pumpX - 26} y={pumpY - 36} width="52" height="15" fill="#1d4ed8" rx="2.5" />
            <text x={pumpX} y={pumpY - 26} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">
              PUMP · 100 m³/h
            </text>
            <line x1={pumpX} y1={pumpY - 36} x2={pumpX} y2={Math.max(14, landY + 3)} stroke="#ea580c" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x={pumpX + 4} y={Math.max(20, landY + 13)} fontSize="6.5" fill="#c2410c" fontWeight="600">
              DISCHARGE
            </text>
          </g>
        </>
      )}

      {/* ── Legend Box — embedded inside SVG so it prints ── */}
      <g transform={`translate(10, ${H - 30})`}>
        <rect x="0" y="0" width="252" height="22" rx="3" fill={legendBg} stroke={legendBorder} strokeWidth="1" />
        <circle cx="12" cy="11" r="3.5" fill="#10b981" stroke="#065f46" strokeWidth="0.7" />
        <text x="20" y="11" dominantBaseline="middle" fontSize="8" fill={legendText} fontWeight="600">Wellpoint</text>
        <line x1="72" y1="11" x2="88" y2="11" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <text x="92" y="11" dominantBaseline="middle" fontSize="8" fill={legendText} fontWeight="600">Header Pipe</text>
        <line x1="152" y1="7" x2="152" y2="15" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="square" />
        <text x="158" y="11" dominantBaseline="middle" fontSize="8" fill={legendText} fontWeight="600">End Cap</text>
        <rect x="198" y="6" width="12" height="10" fill="#1d4ed8" rx="1.5" />
        <text x="214" y="11" dominantBaseline="middle" fontSize="8" fill={legendText} fontWeight="600">Pump</text>
      </g>
    </svg>
  );
}

function SiteCrossSection({
  inputs,
  result,
}: {
  inputs: DewateringInput;
  result: DewateringCalculationResult | null;
}) {
  const { isDark } = useTheme();
  const W = 620;
  const H = 330;

  const depth = inputs.excavationDepth || 4.0;
  const wt = inputs.waterTableDepth || 1.0;
  const target = result?.targetDepth || (depth + 0.5);
  const offset = result?.designOffset || 1.0;

  const tipDepth = Math.max(depth + 2.0, 6.0);
  const maxScaleDepth = Math.max(tipDepth + 1.2, 7.5);

  const yGL = 58;
  const availH = H - yGL - 35;
  const scaleY = availH / maxScaleDepth;

  const getY = (d: number) => yGL + d * scaleY;

  const yPit = getY(depth);
  const yWT = getY(wt);
  const yTarget = getY(target);
  const yTip = getY(tipDepth);

  const cx = W / 2;
  const pitHalfW = 110;
  const pitLeft = cx - pitHalfW;
  const pitRight = cx + pitHalfW;

  const batter = 24;
  const crestLeft = pitLeft - batter;
  const crestRight = pitRight + batter;

  const offsetPx = Math.max(24, Math.min(50, offset * 26));
  const wpLeft = crestLeft - offsetPx;
  const wpRight = crestRight + offsetPx;

  const layout = result?.layoutType || inputs.layoutType || 'ring';
  const showRightWp = layout !== 'single_line';

  const drawdownPath = showRightWp
    ? `M 15 ${yWT} 
       C ${wpLeft - 25} ${yWT}, ${wpLeft - 12} ${yTarget + 5}, ${wpLeft} ${yTarget + 2}
       C ${(wpLeft + cx) / 2} ${yTarget}, ${cx - 20} ${yTarget}, ${cx} ${yTarget}
       C ${cx + 20} ${yTarget}, ${(wpRight + cx) / 2} ${yTarget}, ${wpRight} ${yTarget + 2}
       C ${wpRight + 12} ${yTarget + 5}, ${wpRight + 25} ${yWT}, ${W - 15} ${yWT}
       L ${W - 15} ${H - 10} L 15 ${H - 10} Z`
    : `M 15 ${yWT} 
       C ${wpLeft - 25} ${yWT}, ${wpLeft - 12} ${yTarget + 5}, ${wpLeft} ${yTarget + 2}
       C ${cx} ${yTarget}, ${crestRight + 15} ${yTarget + 16}, ${W - 15} ${yWT}
       L ${W - 15} ${H - 10} L 15 ${H - 10} Z`;

  const groundStroke = isDark ? '#64748b' : '#475569';
  const groundText = isDark ? '#94a3b8' : '#64748b';
  const pitFloorStroke = isDark ? '#cbd5e1' : '#0f172a';
  const pitFloorText = isDark ? '#f8fafc' : '#0f172a';
  const staticWtStroke = isDark ? '#38bdf8' : '#0284c7';
  const targetText = isDark ? '#34d399' : '#059669';
  const drawdownFill = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="select-none font-mono">
      {/* Ground & Excavation Cut */}
      <line x1="15" y1={yGL} x2={crestLeft} y2={yGL} stroke={groundStroke} strokeWidth="2" />
      <line x1={crestLeft} y1={yGL} x2={pitLeft} y2={yPit} stroke={groundStroke} strokeWidth="2" />
      <line x1={pitLeft} y1={yPit} x2={pitRight} y2={yPit} stroke={pitFloorStroke} strokeWidth="2.8" />
      <line x1={pitRight} y1={yPit} x2={crestRight} y2={yGL} stroke={groundStroke} strokeWidth="2" />
      <line x1={crestRight} y1={yGL} x2={W - 15} y2={yGL} stroke={groundStroke} strokeWidth="2" />

      {/* Static Water Table */}
      <line x1="15" y1={yWT} x2={W - 15} y2={yWT} stroke={staticWtStroke} strokeWidth="1.2" strokeDasharray="5 3" />
      <text x="20" y={yWT - 6} fontSize="8.5" fill={staticWtStroke} fontWeight="700">
        STATIC WATER TABLE (-{wt.toFixed(1)}m b.g.l.)
      </text>

      {/* Depressed Drawdown Surface */}
      <path d={drawdownPath} fill={drawdownFill} stroke={staticWtStroke} strokeWidth="1.6" />

      {/* Target Water Level */}
      <line x1={pitLeft - 15} y1={yTarget} x2={pitRight + 15} y2={yTarget} stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 2" />
      <text x={cx} y={yTarget + 11} textAnchor="middle" fontSize="8.5" fill={targetText} fontWeight="700">
        TARGET WATER LEVEL (-{target.toFixed(2)}m) • DRAWDOWN {result?.drawdownAmount.toFixed(1)}m
      </text>

      {/* Pit Floor */}
      <text x={cx} y={yPit - 6} textAnchor="middle" fontSize="9" fill={pitFloorText} fontWeight="700">
        EXCAVATION FORMATION LEVEL (-{depth.toFixed(2)}m)
      </text>

      {/* Left Wellpoint & Pump */}
      <g>
        <circle cx={wpLeft} cy={yGL} r="3.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
        <line x1={wpLeft} y1={yGL} x2={wpLeft} y2={yTip} stroke="#64748b" strokeWidth="2" />
        <line x1={wpLeft} y1={yTip - 24} x2={wpLeft} y2={yTip} stroke="#10b981" strokeWidth="3.6" strokeLinecap="round" />

        {/* Pump on surface */}
        <rect x={wpLeft - 22} y={yGL - 16} width="16" height="13" fill="#1d4ed8" rx="2" />
        <text x={wpLeft - 14} y={yGL - 7} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">P</text>
        <line x1={wpLeft - 6} y1={yGL - 6} x2={wpLeft - 3.5} y2={yGL} stroke="#ca8a04" strokeWidth="1.4" />
        <line x1={wpLeft - 22} y1={yGL - 8} x2={15} y2={yGL - 8} stroke="#ea580c" strokeWidth="1.4" />

        <text x={wpLeft - 5} y={yTip - 6} textAnchor="end" fontSize="7.5" fill={targetText} fontWeight="700">
          FILTER TIP -{tipDepth.toFixed(1)}m
        </text>
      </g>

      {/* Right Wellpoint */}
      {showRightWp && (
        <g>
          <circle cx={wpRight} cy={yGL} r="3.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
          <line x1={wpRight} y1={yGL} x2={wpRight} y2={yTip} stroke="#64748b" strokeWidth="2" />
          <line x1={wpRight} y1={yTip - 24} x2={wpRight} y2={yTip} stroke="#10b981" strokeWidth="3.6" strokeLinecap="round" />
          <text x={wpRight + 5} y={yTip - 6} textAnchor="start" fontSize="7.5" fill={targetText} fontWeight="700">
            FILTER TIP -{tipDepth.toFixed(1)}m
          </text>
        </g>
      )}

      <text x="20" y={yGL - 6} fontSize="8.5" fill={groundText} fontWeight="700">
        GROUND LEVEL ±0.00m
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Minimalist Bill of Quantities Row
------------------------------------------------------------------------- */

function BoqRow({
  label,
  value,
  unit,
  subtle,
}: {
  label: string;
  value: number | string;
  unit?: string;
  subtle?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-1.5 text-xs border-b border-slate-100 dark:border-slate-800/60 last:border-0',
      subtle && 'text-slate-400 dark:text-slate-500',
    )}>
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-slate-400">{unit}</span>}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Main Component
------------------------------------------------------------------------- */

export default function DewateringCalculator() {
  const navigate = useNavigate();
  const location = useLocation();
  const [inputs, setInputs] = useState<DewateringInput>(DEFAULT_DEWATERING_INPUT);
  const [activeTab, setActiveTab] = useState<'calculator' | 'print'>('calculator');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showInputs, setShowInputs] = useState(true);
  const [showDrawings, setShowDrawings] = useState(true);
  const [viewMode, setViewMode] = useState<'both' | 'plan' | 'section'>('both');

  // Auto-import layout data sent back from DewaterCAD Simulator
  useEffect(() => {
    try {
      const stateInputs = (location.state as any)?.calculatorInputs;
      const sessionStr = sessionStorage.getItem('dewatering_simulator_export');
      const payloadInputs = stateInputs || (sessionStr ? JSON.parse(sessionStr) : null);
      if (payloadInputs) {
        sessionStorage.removeItem('dewatering_simulator_export');
        setInputs(prev => ({
          ...prev,
          ...payloadInputs,
        }));
        toast.success(`Loaded calculator with ${payloadInputs.excavationLength}×${payloadInputs.excavationWidth}m (${payloadInputs.excavationDepth}m depth) layout data from Simulator`);
      }
    } catch {
      // ignore
    }
  }, [location.state]);

  const result = useMemo(() => calculateDewatering(inputs), [inputs]);

  const setField = useCallback(<K extends keyof DewateringInput>(key: K, value: DewateringInput[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(EMPTY_DEWATERING_INPUT);
    toast.info('All inputs reset');
  }, []);

  const handleCopySummary = useCallback(() => {
    if (!result || result.status !== 'REQUIRED') return;
    const lines = [
      `WELLPOINT DEWATERING BOQ: ${result.layoutType.toUpperCase()}`,
      `Perimeter / Line: ${result.loopPerimeter.toFixed(2)} m | Offset: ${result.designOffset.toFixed(2)} m`,
      `Drawdown: ${result.drawdownAmount.toFixed(1)}m (Target: ${result.targetDepth.toFixed(2)}m b.g.l.)`,
      '',
      `Header pipes, 6m: ${result.headers6m} pcs`,
      ...(result.headers3m > 0 ? [`Header pipes, 3m: ${result.headers3m} pcs`] : []),
      `Wellpoint filters (1.0m c/c): ${result.filters}`,
      `Vacuum pumps (100 m3/hr, max 60m): ${result.pumps}`,
      `Elbows: ${result.elbows90} pcs`,
      `Tee connectors: ${result.tees} pcs`,
      ...(result.endCaps > 0 ? [`End blanking caps: ${result.endCaps} pcs`] : []),
      '',
      ...result.runs.map(r => `* ${r.name} (${r.length.toFixed(1)}m): ${r.headers6m}x6m + ${r.headers3m}x3m`),
    ];
    const text = lines.join('\n');
    const copyFallback = () => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        toast.success('BOQ copied to clipboard');
        return true;
      } catch (err) {
        console.error('Fallback copy failed', err);
        return false;
      }
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast.success('BOQ copied to clipboard'))
        .catch(() => copyFallback());
    } else {
      copyFallback();
    }
  }, [result]);

  const handleSendToSimulator = useCallback(() => {
    if (!result || result.status !== 'REQUIRED') {
      navigate('/operations/simulator');
      return;
    }

    const SCALE = 10;
    const centerX = 550;
    const centerY = 380;
    const L = inputs.excavationLength;
    const W = inputs.excavationWidth;
    const depth = inputs.excavationDepth;
    const offset = result.designOffset;

    const pitW = L * SCALE;
    const pitH = W * SCALE;
    const pitX = Math.round(centerX - pitW / 2);
    const pitY = Math.round(centerY - pitH / 2);

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
      layerId: 'layer-areas',
    };

    // Site boundary rectangle — land perimeter from landLength × landWidth inputs
    const landL = inputs.landLength || Math.max(30, L + 12);
    const landW = inputs.landWidth || Math.max(24, W + 12);
    const siteW = landL * SCALE;
    const siteH = landW * SCALE;
    const siteArea: AreaData = {
      id: `site-${Date.now()}`,
      x: Math.round(centerX - siteW / 2),
      y: Math.round(centerY - siteH / 2),
      width: siteW,
      height: siteH,
      kind: 'site',
      levelId: glLevel.id,
      layerId: 'layer-areas',
    };

    const ringX = Math.round(pitX - offset * SCALE);
    const ringY = Math.round(pitY - offset * SCALE);
    const ringW = Math.round(pitW + offset * 2 * SCALE);
    const ringH = Math.round(pitH + offset * 2 * SCALE);
    const botY = ringY + ringH;

    // Layout & Ingress break handling
    const layout = result.layoutType;
    const ingressRequired = inputs.ingressRequired;
    const ingressSide = inputs.ingressSide || 'south';
    const ingressMeters = inputs.ingressWidth || 6.0;
    const isHorizSide = ingressSide === 'north' || ingressSide === 'south';
    const ingressPx = Math.min(ingressMeters * SCALE, (isHorizSide ? ringW : ringH) * 0.75);
    const ingressL = Math.round(ringX + ringW / 2 - ingressPx / 2);
    const ingressR = Math.round(ringX + ringW / 2 + ingressPx / 2);
    const ingressT = Math.round(ringY + ringH / 2 - ingressPx / 2);
    const ingressB = Math.round(ringY + ringH / 2 + ingressPx / 2);

    let ringPoints: { x: number; y: number }[] = [];

    if (layout === 'ring') {
      if (ingressRequired && ingressMeters > 0) {
        if (ingressSide === 'south') {
          ringPoints = [
            { x: ingressR, y: botY },
            { x: ringX + ringW, y: botY },
            { x: ringX + ringW, y: ringY },
            { x: ringX, y: ringY },
            { x: ringX, y: botY },
            { x: ingressL, y: botY },
          ];
        } else if (ingressSide === 'north') {
          ringPoints = [
            { x: ingressR, y: ringY },
            { x: ringX + ringW, y: ringY },
            { x: ringX + ringW, y: botY },
            { x: ringX, y: botY },
            { x: ringX, y: ringY },
            { x: ingressL, y: ringY },
          ];
        } else if (ingressSide === 'east') {
          ringPoints = [
            { x: ringX + ringW, y: ingressT },
            { x: ringX + ringW, y: ringY },
            { x: ringX, y: ringY },
            { x: ringX, y: botY },
            { x: ringX + ringW, y: botY },
            { x: ringX + ringW, y: ingressB },
          ];
        } else {
          // west
          ringPoints = [
            { x: ringX, y: ingressB },
            { x: ringX, y: botY },
            { x: ringX + ringW, y: botY },
            { x: ringX + ringW, y: ringY },
            { x: ringX, y: ringY },
            { x: ringX, y: ingressT },
          ];
        }
      } else {
        ringPoints = [
          { x: ringX, y: ringY },
          { x: ringX + ringW, y: ringY },
          { x: ringX + ringW, y: botY },
          { x: ringX, y: botY },
          { x: ringX, y: ringY },
        ];
      }
    } else if (layout === 'u_shape') {
      ringPoints = [
        { x: ringX, y: botY },
        { x: ringX, y: ringY },
        { x: ringX + ringW, y: ringY },
        { x: ringX + ringW, y: botY },
      ];
    } else if (layout === 'l_shape') {
      ringPoints = [
        { x: ringX + ringW, y: ringY },
        { x: ringX, y: ringY },
        { x: ringX, y: botY },
      ];
    } else {
      ringPoints = [
        { x: ringX, y: ringY },
        { x: ringX + ringW, y: ringY },
      ];
    }

    const headerLine: LineData = {
      id: `header-line-${Date.now()}`,
      points: ringPoints,
      levelId: glLevel.id,
      layerId: 'layer-headers',
    };

    // 1. Suction Tee on Header line (North run)
    // If ingress is on North side, place Tee on the left solid run so it doesn't float in the ingress opening
    const isIngressNorth = layout === 'ring' && ingressRequired && ingressSide === 'north';
    const teeX = isIngressNorth ? Math.round((ringX + ingressL) / 2) : Math.round(ringX + ringW / 2);
    const teeY = ringY;
    const teeComponent: PlacedComponent = {
      id: `tee-${Date.now()}`,
      type: 'tee',
      x: teeX,
      y: teeY,
      rotation: 180, // mouth points North towards the pump
      levelId: glLevel.id,
      layerId: 'layer-components',
    };

    // 2. Vacuum Pump Unit placed North of the header line
    // Offset pumpX by +20px so its suction port (at comp.x - 20) aligns 100% vertically with the Tee at teeX
    const pumpX = teeX + 20;
    const pumpY = ringY - 45;
    const pumpComponent: PlacedComponent = {
      id: `pump-${Date.now()}`,
      type: 'pump',
      x: pumpX,
      y: pumpY,
      rotation: 0,
      levelId: glLevel.id,
      layerId: 'layer-components',
    };

    // 3. Heavy-Duty Suction Hose connecting Header Tee to Pump Suction port (port at pumpX - 20 === teeX)
    // Perfectly orthogonal 90-degree tie-in (dx = 0)
    const suctionHose: HoseData = {
      id: `suction-hose-${Date.now()}`,
      points: [
        { x: teeX, y: teeY },
        { x: teeX, y: pumpY },
      ],
      kind: 'suction',
      levelId: glLevel.id,
      layerId: 'layer-suction',
    };

    // 4. Layflat Discharge Line heading from Pump Discharge port (pumpX + 20) straight East
    // Perfectly orthogonal 0-degree horizontal line running outward to site perimeter
    const dischargeHose: HoseData = {
      id: `discharge-hose-${Date.now()}`,
      points: [
        { x: pumpX + 20, y: pumpY },
        { x: Math.max(pumpX + 200, ringX + ringW + 120), y: pumpY },
      ],
      kind: 'discharge',
      levelId: glLevel.id,
      layerId: 'layer-discharge',
    };

    const layoutPayload = {
      name: `Dewatering - ${result.layoutType.toUpperCase()} (${L}x${W}m Pit)`,
      lines: [headerLine],
      areas: [siteArea, pitArea],
      components: [pumpComponent, teeComponent],
      hoses: [suctionHose, dischargeHose],
      arrows: [],
      dimensions: [],
      texts: [],
      levels: [glLevel, pitLevel],
      activeLevelId: pitLevel.id,
      targetDepth: depth,
      calculatorInputs: inputs,
    };

    sessionStorage.setItem('dewatering_calculator_import', JSON.stringify(layoutPayload));
    navigate('/operations/simulator', {
      state: { fromCalculator: true, layoutData: layoutPayload },
    });
  }, [navigate, result, inputs]);

  const showResults = result?.status === 'REQUIRED';

  const headerActions = useMemo(() => {
    if (activeTab === 'print') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPrintOrientation('portrait')}
              className={cn(
                'p-1 text-xs font-medium rounded transition-all flex items-center justify-center cursor-pointer',
                printOrientation === 'portrait'
                  ? 'bg-amber-500 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              )}
              title="Portrait Orientation (210 × 297 mm)"
              aria-label="Portrait"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPrintOrientation('landscape')}
              className={cn(
                'p-1 text-xs font-medium rounded transition-all flex items-center justify-center cursor-pointer',
                printOrientation === 'landscape'
                  ? 'bg-amber-500 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              )}
              title="Landscape Orientation (297 × 210 mm)"
              aria-label="Landscape"
            >
              <Map className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block animate-pulse" />
              1 Page Fit
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-7 text-xs px-3 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors flex items-center cursor-pointer shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Now
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={handleReset}
          className="h-7 text-xs px-2.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center cursor-pointer"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </button>

        {showResults && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('print')}
              className="h-7 text-xs px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center cursor-pointer shadow-xs"
            >
              <Printer className="h-3 w-3 mr-1" /> Print
            </button>
            <button
              type="button"
              onClick={handleSendToSimulator}
              className="h-7 text-xs px-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors flex items-center cursor-pointer shadow-xs"
            >
              Simulator <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </>
        )}
      </div>
    );
  }, [activeTab, showResults, handleReset, handleCopySummary, handleSendToSimulator]);

  useSetPageTitle(
    activeTab === 'print' ? 'BOQ Specification Sheet' : 'Dewatering Sizing',
    activeTab === 'print' ? 'A4 Document Preview & Engineering Sign-Off' : 'Perimeter wellpoint installation & BOQ',
    headerActions,
    [headerActions, activeTab],
    activeTab === 'print' ? () => setActiveTab('calculator') : false
  );

  const activeLayout = inputs.layoutType || 'ring';
  const activeStock = inputs.pipeStock || 'all';

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 print:bg-white text-slate-900 dark:text-slate-100">
      <div className={cn(
        'mx-auto px-4 py-4 transition-all duration-200',
        activeTab === 'print' ? 'max-w-[1250px]' : showInputs ? 'max-w-7xl' : 'max-w-[1550px]',
      )}>
        {activeTab === 'print' ? (
          <PrintSpecificationView
            inputs={inputs}
            result={result}
            orientation={printOrientation}
          />
        ) : (
          <>
            {/* Quick Variables Pill Bar when Inputs are Hidden */}
            {!showInputs && (
              <div className="mb-4 px-4 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-xs flex-wrap">
            <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Active Configuration:
              </span>
              <span>Layout: <strong className="uppercase text-slate-900 dark:text-white">{result?.layoutType}</strong></span>
              <span>Pit: <strong>{inputs.excavationLength}×{inputs.excavationWidth}m</strong> (Depth: <strong>{inputs.excavationDepth}m</strong>)</span>
              <span>Water Table: <strong>{inputs.waterTableDepth}m</strong></span>
              <span>Header Stock: <strong>{result?.pipeStock === '6m_only' ? '6m Only' : '6m & 3m Mix'}</strong></span>
              <span>Setback: <strong>{result?.designOffset.toFixed(2)}m</strong></span>
              <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">Line: {result?.loopPerimeter.toFixed(1)}m</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInputs(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="h-3 w-3" /> Edit Variables
            </button>
          </div>
        )}

        <div className={cn(
          'grid gap-5 items-start transition-all',
          showInputs ? 'grid-cols-1 lg:grid-cols-[340px_1fr]' : 'grid-cols-1',
        )}>
          {/* =========================================================================
              LEFT COLUMN: Variable Inputs (Collapsible)
          ========================================================================== */}
          {showInputs && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" /> Input Variables
                </span>
                <button
                  type="button"
                  onClick={() => setShowInputs(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer"
                  title="Hide variables to view drawing full width"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" /> Hide
                </button>
              </div>

              {/* 1. System Layout (Minimalist Segmented Control) */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  System Layout
                </span>
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded">
                  {[
                    { id: 'ring', label: 'Ring' },
                    { id: 'u_shape', label: 'U-Shape' },
                    { id: 'l_shape', label: 'L-Shape' },
                    { id: 'single_line', label: 'Line' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setField('layoutType', t.id as DewateringLayoutType)}
                      className={cn(
                        'py-1 text-xs font-medium rounded transition-all text-center cursor-pointer',
                        activeLayout === t.id
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Pipe Stock Availability (Minimalist 2-Pill) */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Header Pipe Stock
                </span>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded">
                  <button
                    type="button"
                    onClick={() => setField('pipeStock', 'all')}
                    className={cn(
                      'py-1 text-xs font-medium rounded transition-all text-center cursor-pointer',
                      activeStock === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                    )}
                  >
                    6m & 3m Mix
                  </button>
                  <button
                    type="button"
                    onClick={() => setField('pipeStock', '6m_only')}
                    className={cn(
                      'py-1 text-xs font-medium rounded transition-all text-center cursor-pointer',
                      activeStock === '6m_only'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                    )}
                  >
                    6m Only
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* 3. Site & Excavation Dimensions */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                  Geometry & Levels
                </span>
                <div className="space-y-1">
                  <CompactNumber label="Land Length" value={inputs.landLength} unit="m"
                    onChange={v => setField('landLength', v)} />
                  <CompactNumber label="Land Width" value={inputs.landWidth} unit="m"
                    onChange={v => setField('landWidth', v)} />
                  <CompactNumber label="Pit Length" value={inputs.excavationLength} unit="m"
                    onChange={v => setField('excavationLength', v)} />
                  <CompactNumber label="Pit Width" value={inputs.excavationWidth} unit="m"
                    onChange={v => setField('excavationWidth', v)} />
                  <CompactNumber label="Pit Depth" value={inputs.excavationDepth} unit="m"
                    onChange={v => setField('excavationDepth', v)} />
                  <CompactNumber label="Water Table Depth" value={inputs.waterTableDepth} unit="m"
                    onChange={v => setField('waterTableDepth', v)} />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* 4. Drawdown & Offset */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                  Installation Setback & Drawdown
                </span>
                <div className="space-y-1">
                  <CompactNumber label="Target Drawdown" value={inputs.requiredDrawdown} unit="m below pit"
                    onChange={v => setField('requiredDrawdown', v)} />
                  <CompactNumber label="Setback Offset" value={inputs.manualOffset ?? 1.0} unit="m" step={0.05}
                    onChange={v => {
                      setField('offsetMode', 'manual');
                      setField('manualOffset', v);
                    }} />
                </div>

                {/* Smart Auto-Fit Quick Button */}
                {result?.recommendedOffset && result.recommendedOffset !== (inputs.manualOffset ?? 1.0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setField('offsetMode', 'manual');
                      setField('manualOffset', result.recommendedOffset);
                    }}
                    className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 w-full py-1 px-2 rounded border border-amber-200 dark:border-amber-800/60 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <Sparkles className="h-3 w-3" /> Auto-Fit: {result.recommendedOffset.toFixed(2)}m
                    </span>
                    <span className="font-semibold text-[10px] underline">Apply</span>
                  </button>
                )}
              </div>

              {/* 5. Ingress (Only when Ring is active) */}
              {activeLayout === 'ring' && (
                <div className="pt-1">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Ingress</span>
                      <span
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] font-serif cursor-help transition-colors border border-slate-200 dark:border-slate-700"
                        title="Vehicle ramp break: leaves an unpiped access opening along the selected run for excavators and site trucks"
                      >
                        i
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={inputs.ingressRequired}
                      onChange={e => setField('ingressRequired', e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                  </div>
                  {inputs.ingressRequired && (
                    <div className="mt-1.5 space-y-1">
                      {/* Side Selection with Cycle Switch Button */}
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Side</span>
                        <div className="flex items-center gap-1.5">
                          {/* Segmented [N][E][S][W] for direct select */}
                          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                            {(['north', 'east', 'south', 'west'] as const).map(s => {
                              const active = (inputs.ingressSide || 'south') === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setField('ingressSide', s)}
                                  className={cn(
                                    'px-1.5 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer uppercase',
                                    active
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                  )}
                                  title={`Place ingress opening on ${s.toUpperCase()} side`}
                                >
                                  {s[0]}
                                </button>
                              );
                            })}
                          </div>

                          {/* One-by-one Cycle Switch Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const current = inputs.ingressSide || 'south';
                              const order: ('north' | 'east' | 'south' | 'west')[] = ['north', 'east', 'south', 'west'];
                              const next = order[(order.indexOf(current) + 1) % order.length];
                              setField('ingressSide', next);
                            }}
                            className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-1 cursor-pointer"
                            title="Click to cycle side: North → East → South → West"
                          >
                            <span className="capitalize">{inputs.ingressSide || 'south'}</span>
                            <RotateCw className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                          </button>
                        </div>
                      </div>

                      <CompactNumber
                        label="Opening Width"
                        value={inputs.ingressWidth}
                        unit="m"
                        min={6}
                        onChange={v => setField('ingressWidth', Math.max(6, v))}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Status Badge */}
              {result && (
                <div className={cn(
                  'p-2 rounded text-xs leading-relaxed font-medium',
                  result.status === 'REQUIRED' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60' :
                  result.status === 'NOT_REQUIRED' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                  'bg-red-50 text-red-700 border border-red-200',
                )}>
                  {result.status === 'REQUIRED' && (
                    <p>
                      Line: <strong className="font-mono">{result.loopPerimeter.toFixed(1)}m</strong> • Drawdown: <strong className="font-mono">{result.drawdownAmount.toFixed(1)}m</strong>
                    </p>
                  )}
                  {result.status === 'NOT_REQUIRED' && <p>Dewatering not required (water table below pit)</p>}
                  {result.status === 'ERROR' && <p>{result.errorMessage}</p>}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              MAIN AREA: Prominent Drawing Visualizer + Bill of Quantities
          ========================================================================== */}
          <div className="space-y-4">
            {/* 1. Visualizer Container with Side-by-Side & Dedicated View Modes (Collapsible with Eye icon) */}
            {showDrawings ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                      <button
                        type="button"
                        onClick={() => setViewMode('both')}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 cursor-pointer',
                          viewMode === 'both'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                        )}
                      >
                        <Columns className="h-3.5 w-3.5 text-amber-500" />
                        Both Views (Side-by-Side)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('plan')}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 cursor-pointer',
                          viewMode === 'plan'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                        )}
                      >
                        <Map className="h-3.5 w-3.5" />
                        Site Plan (2D)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('section')}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 cursor-pointer',
                          viewMode === 'section'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Elevation Profile
                      </button>
                    </div>

                    {!showInputs && (
                      <button
                        type="button"
                        onClick={() => setShowInputs(true)}
                        className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <PanelLeftOpen className="h-3.5 w-3.5" /> Show Inputs
                      </button>
                    )}
                  </div>

                  {/* Minimalist Legend & Hide Control */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Wellpoints</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-blue-700 inline-block" />Pump</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" />Header Line</span>

                    <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                    <button
                      type="button"
                      onClick={() => setShowDrawings(false)}
                      className="px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Hide drawings to focus on BOQ"
                    >
                      <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                      <span>Hide</span>
                    </button>
                  </div>
                </div>

                {/* Drawing Canvases with Generous Dimensions */}
                {viewMode === 'both' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 flex flex-col justify-center items-center bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-[10px] font-bold text-slate-500 uppercase self-start mb-1 px-1">Plan View (2D)</span>
                      <div className="h-[360px] w-full flex items-center justify-center">
                        <SiteSchematic inputs={inputs} result={result} />
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2 flex flex-col justify-center items-center bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-[10px] font-bold text-slate-500 uppercase self-start mb-1 px-1">Elevation Cross Section</span>
                      <div className="h-[360px] w-full flex items-center justify-center">
                        <SiteCrossSection inputs={inputs} result={result} />
                      </div>
                    </div>
                  </div>
                ) : viewMode === 'plan' ? (
                  <div className="h-[420px] w-full pt-1 flex items-center justify-center">
                    <SiteSchematic inputs={inputs} result={result} />
                  </div>
                ) : (
                  <div className="h-[420px] w-full pt-1 flex items-center justify-center">
                    <SiteCrossSection inputs={inputs} result={result} />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <EyeOff className="h-4 w-4 text-slate-400" />
                  <span>Schematic Drawings Hidden</span>
                  <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                    ({viewMode === 'both' ? 'Both Views' : viewMode === 'plan' ? 'Site Plan' : 'Elevation Profile'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDrawings(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Unhide drawings"
                >
                  <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Unhide Drawings</span>
                </button>
              </div>
            )}

            {/* 2. Succinct Minimalist Bill of Quantities (Visible at the Same Time) */}
            {showResults && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Bill of Quantities
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {result.loopPerimeter.toFixed(1)}m line @ {result.designOffset.toFixed(2)}m offset
                  </span>
                </div>

                {/* Clean Single List with Original Naming */}
                <div className="space-y-0.5">
                  <BoqRow label="Loop perimeter" value={result.loopPerimeter.toFixed(2)} unit="m" />
                  <BoqRow label="Wellpoint filters (1.0m c/c)" value={result.filters} />
                  <BoqRow label="Vacuum pumps (100 m3/hr, max 60m)" value={result.pumps} />
                  <BoqRow label="Header pipes, 6m" value={result.headers6m} unit="pcs" />
                  <BoqRow label="Header pipes, 3m" value={result.headers3m} unit="pcs" subtle={result.headers3m === 0} />
                  <BoqRow label="Elbows" value={result.elbows90} unit="pcs" />
                  <BoqRow label="Tee connectors" value={result.tees} unit="pcs" />
                  {result.endCaps > 0 && (
                    <BoqRow label="End blanking caps" value={result.endCaps} unit="pcs" />
                  )}
                </div>

                {/* Per-Side Stick Breakdown (Collapsible & Compact) */}
                <details className="mt-3 group pt-2 border-t border-slate-100 dark:border-slate-800/80" open>
                  <summary className="text-[11px] text-amber-600 dark:text-amber-400 cursor-pointer font-medium hover:underline flex items-center gap-1 select-none">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Per-side modular stick breakdown ({result.runs.length} runs)
                  </summary>
                  <div className="mt-2 space-y-1 pl-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {result.runs.map(r => (
                      <div key={r.id} className="flex items-center justify-between py-0.5">
                        <span>{r.name} ({r.length.toFixed(1)}m):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.headers6m > 0 ? `${r.headers6m}× 6m` : ''}
                          {r.headers6m > 0 && r.headers3m > 0 ? ' + ' : ''}
                          {r.headers3m > 0 ? `${r.headers3m}× 3m` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Auto Summary line */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                  {result.autoSummary}
                </div>
              </div>
            )}
          </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   In-Page Print Specification View (Theme-Adaptive & Electron Compatible)
------------------------------------------------------------------------- */

function PrintSpecificationView({
  inputs,
  result,
  orientation,
}: {
  inputs: DewateringInput;
  result: DewateringCalculationResult | null;
  orientation: 'portrait' | 'landscape';
}) {
  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* High-Fidelity Print CSS: Hides surrounding app chrome and centers exact A4 sheet */}
      <style>{`
        @media print {
          @page {
            size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .print-a4-sheet,
          .print-a4-sheet * {
            visibility: visible;
          }
          .print-a4-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${orientation === 'landscape' ? '297mm' : '210mm'} !important;
            height: ${orientation === 'landscape' ? '210mm' : '297mm'} !important;
            margin: 0 !important;
            padding: 8mm 10mm !important;
            background: white !important;
            z-index: 9999999 !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Document Sheet Canvas Area (Theme-Adaptive Outer Frame) */}
      <div className="p-4 md:p-8 bg-slate-200/60 dark:bg-slate-950/60 rounded-xl border border-slate-300/80 dark:border-slate-800 flex justify-center print:p-0 print:m-0 print:border-none print:bg-white print:w-auto">
        <div
          className={cn(
            'print-a4-sheet bg-white text-slate-900 p-8 shadow-md relative border border-slate-300 rounded transition-all duration-200 select-text',
            'print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:rounded-none',
            orientation === 'portrait'
              ? 'w-full max-w-[794px] min-h-[1123px]'
              : 'w-full max-w-[1123px] min-h-[794px]',
          )}
        >
          {/* Centered Watermark Logo */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
            <img
              src={logoSrc}
              alt="Watermark"
              className={cn(
                'object-contain -rotate-12 opacity-[0.045] print:opacity-[0.05] filter grayscale contrast-125',
                orientation === 'portrait' ? 'w-[440px] max-w-[65%]' : 'w-[500px] max-w-[60%]',
              )}
            />
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              {/* Document Header with Logo & Meta */}
              <div className="flex items-start justify-between pb-3 mb-3 border-b-2 border-slate-800">
                <div className="flex items-center gap-3.5">
                  <img src={logoSrc} alt="DCEL Logo" className="h-10 w-auto object-contain" />
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">DCEL Engineering & Equipment</div>
                    <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">Wellpoint Dewatering BOQ Specification</h1>
                    <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5 font-medium">
                      <span>Layout: <strong className="uppercase text-slate-900">{result.layoutType}</strong></span>
                      <span>•</span>
                      <span>Offset: <strong className="text-slate-900">{result.designOffset.toFixed(2)}m</strong></span>
                      <span>•</span>
                      <span>Stock: <strong className="text-slate-900">{result.pipeStock === '6m_only' ? '6m Only' : '6m & 3m Mix'}</strong></span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-[10.5px] text-slate-600 leading-tight">
                  <div className="font-bold text-slate-900">BOQ SPECIFICATION SHEET</div>
                  <div>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">REF: DW-{result.layoutType.slice(0, 3).toUpperCase()}-{Math.round(result.loopPerimeter)}M</div>
                  <div className="text-[10px] font-semibold text-emerald-700 mt-1">Page 1 of 1</div>
                </div>
              </div>

              {/* Parameter Overview Strip */}
              <div className="grid grid-cols-5 gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] mb-4">
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">Excavation Pit</span>
                  <span className="font-bold text-slate-800 font-mono">{inputs.excavationLength} × {inputs.excavationWidth} m</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">Pit Depth</span>
                  <span className="font-bold text-slate-800 font-mono">{inputs.excavationDepth} m</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">Water Table</span>
                  <span className="font-bold text-slate-800 font-mono">{inputs.waterTableDepth} m b.g.l.</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">Target Drawdown</span>
                  <span className="font-bold text-slate-800 font-mono">{result.drawdownAmount.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">Header Line</span>
                  <span className="font-bold text-amber-700 font-mono">{result.loopPerimeter.toFixed(1)} m</span>
                </div>
              </div>

              {/* Layout Depending on Orientation */}
              {orientation === 'portrait' ? (
                /* PORTRAIT ARRANGEMENT */
                <div className="space-y-4">
                  {/* Drawings Side-by-Side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">Site Plan (2D Overview)</span>
                        <span className="text-[9.5px] font-mono text-slate-500">{result.runs.length} runs</span>
                      </div>
                      <div className="h-[145px] w-full flex items-center justify-center">
                        <SiteSchematic inputs={inputs} result={result} />
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">Cross Section (Elevation Profile)</span>
                        <span className="text-[9.5px] font-mono text-slate-500">Drawdown: -{result.targetDepth.toFixed(1)}m</span>
                      </div>
                      <div className="h-[145px] w-full flex items-center justify-center">
                        <SiteCrossSection inputs={inputs} result={result} />
                      </div>
                    </div>
                  </div>

                  {/* BOQ Specification Table */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 uppercase">Itemized Bill of Quantities</span>
                      <span className="text-[10px] text-slate-500 font-mono">Standard Rig Setup</span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-left border-b border-slate-200 text-[10.5px]">
                          <th className="py-1 px-3 font-semibold">Item Description</th>
                          <th className="py-1 px-3 font-semibold">Specification</th>
                          <th className="py-1 px-3 text-right font-semibold">Qty</th>
                          <th className="py-1 px-3 text-center font-semibold">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Loop perimeter</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px] font-mono">{result.layoutType.toUpperCase()} loop @ {result.designOffset.toFixed(2)}m setback</td>
                          <td className="py-1 px-3 text-right font-mono font-bold">{result.loopPerimeter.toFixed(2)}</td>
                          <td className="py-1 px-3 text-center text-slate-500">m</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Wellpoint filters (1.0m c/c)</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px]">Self-jetting 1.0m spaced wellpoints</td>
                          <td className="py-1 px-3 text-right font-mono font-bold text-amber-600">{result.filters}</td>
                          <td className="py-1 px-3 text-center text-slate-500">units</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Vacuum pumps (100 m3/hr, max 60m)</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px]">Automatic priming rotary dewatering pump</td>
                          <td className="py-1 px-3 text-right font-mono font-bold text-amber-600">{result.pumps}</td>
                          <td className="py-1 px-3 text-center text-slate-500">units</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Header pipes, 6m</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px]">6-inch quick-release suction headers</td>
                          <td className="py-1 px-3 text-right font-mono font-bold">{result.headers6m}</td>
                          <td className="py-1 px-3 text-center text-slate-500">pcs</td>
                        </tr>
                        {result.headers3m > 0 && (
                          <tr>
                            <td className="py-1 px-3 font-medium text-slate-900">Header pipes, 3m</td>
                            <td className="py-1 px-3 text-slate-500 text-[10px]">Short suction header segments</td>
                            <td className="py-1 px-3 text-right font-mono font-bold">{result.headers3m}</td>
                            <td className="py-1 px-3 text-center text-slate-500">pcs</td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Elbows</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px]">90-degree quick-release corner bends</td>
                          <td className="py-1 px-3 text-right font-mono font-bold">{result.elbows90}</td>
                          <td className="py-1 px-3 text-center text-slate-500">pcs</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-3 font-medium text-slate-900">Tee connectors</td>
                          <td className="py-1 px-3 text-slate-500 text-[10px]">Suction manifold branch tee connector</td>
                          <td className="py-1 px-3 text-right font-mono font-bold">{result.tees}</td>
                          <td className="py-1 px-3 text-center text-slate-500">pcs</td>
                        </tr>
                        {result.endCaps > 0 && (
                          <tr>
                            <td className="py-1 px-3 font-medium text-slate-900">End blanking caps</td>
                            <td className="py-1 px-3 text-slate-500 text-[10px]">Header line terminal vacuum seal cap</td>
                            <td className="py-1 px-3 text-right font-mono font-bold">{result.endCaps}</td>
                            <td className="py-1 px-3 text-center text-slate-500">pcs</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modular Per-Side Run Breakdown Table */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">Modular Header Run Breakdown</span>
                      <span className="text-[9.5px] text-slate-500 font-mono">Total {result.runs.length} Runs</span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-left border-b border-slate-200 text-[10px]">
                          <th className="py-1 px-3 font-semibold">Side Run</th>
                          <th className="py-1 px-3 font-semibold">Target Length</th>
                          <th className="py-1 px-3 font-semibold">Modular Composition</th>
                          <th className="py-1 px-3 text-right font-semibold">Assembled Length</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[10.5px]">
                        {result.runs.map(r => (
                          <tr key={r.id}>
                            <td className="py-1 px-3 font-medium text-slate-800">{r.name}</td>
                            <td className="py-1 px-3 font-mono text-slate-600">{r.length.toFixed(1)} m</td>
                            <td className="py-1 px-3 font-mono font-semibold text-amber-700">
                              {r.headers6m > 0 ? `${r.headers6m}×6m` : ''}
                              {r.headers6m > 0 && r.headers3m > 0 ? ' + ' : ''}
                              {r.headers3m > 0 ? `${r.headers3m}×3m` : ''}
                            </td>
                            <td className="py-1 px-3 text-right font-mono font-bold text-slate-800">
                              {(r.headers6m * 6 + r.headers3m * 3).toFixed(1)} m
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks Box */}
                  <div className="p-2.5 rounded bg-slate-50 border-l-3 border-amber-500 text-[10.5px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-800 font-semibold block mb-0.5">Engineering Calculation Summary:</strong>
                    {result.autoSummary}
                  </div>
                </div>
              ) : (
                /* LANDSCAPE ARRANGEMENT */
                <div className="grid grid-cols-2 gap-5">
                  {/* Left Column: Drawings */}
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">Site Plan (2D Overview)</span>
                        <span className="text-[9.5px] font-mono text-slate-500">{result.runs.length} runs</span>
                      </div>
                      <div className="h-[190px] w-full flex items-center justify-center">
                        <SiteSchematic inputs={inputs} result={result} />
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">Cross Section (Elevation Profile)</span>
                        <span className="text-[9.5px] font-mono text-slate-500">Drawdown: -{result.targetDepth.toFixed(1)}m</span>
                      </div>
                      <div className="h-[155px] w-full flex items-center justify-center">
                        <SiteCrossSection inputs={inputs} result={result} />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: BOQ & Run Details */}
                  <div className="space-y-3">
                    {/* BOQ Table */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-slate-800 uppercase">Bill of Quantities</span>
                        <span className="text-[9.5px] text-slate-500 font-mono">Specification</span>
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 text-left border-b border-slate-200 text-[10px]">
                            <th className="py-1 px-2.5 font-semibold">Item Description</th>
                            <th className="py-1 px-2.5 text-right font-semibold">Qty</th>
                            <th className="py-1 px-2 text-center font-semibold">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[10.5px]">
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Loop perimeter</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.loopPerimeter.toFixed(2)}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">m</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Wellpoint filters (1.0m c/c)</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold text-amber-600">{result.filters}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">units</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Vacuum pumps (100 m3/hr, max 60m)</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold text-amber-600">{result.pumps}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">units</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Header pipes, 6m</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.headers6m}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">pcs</td>
                          </tr>
                          {result.headers3m > 0 && (
                            <tr>
                              <td className="py-0.5 px-2.5 font-medium text-slate-900">Header pipes, 3m</td>
                              <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.headers3m}</td>
                              <td className="py-0.5 px-2 text-center text-slate-500">pcs</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Elbows</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.elbows90}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">pcs</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 px-2.5 font-medium text-slate-900">Tee connectors</td>
                            <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.tees}</td>
                            <td className="py-0.5 px-2 text-center text-slate-500">pcs</td>
                          </tr>
                          {result.endCaps > 0 && (
                            <tr>
                              <td className="py-0.5 px-2.5 font-medium text-slate-900">End blanking caps</td>
                              <td className="py-0.5 px-2.5 text-right font-mono font-bold">{result.endCaps}</td>
                              <td className="py-0.5 px-2 text-center text-slate-500">pcs</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Modular Run Breakdown */}
                    <div className="border border-slate-200 rounded p-2 bg-slate-50/70 text-[10px]">
                      <span className="font-bold text-slate-800 uppercase block mb-1">Modular Run Breakdown:</span>
                      <div className="space-y-0.5 font-mono">
                        {result.runs.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-slate-700">
                            <span>{r.name} ({r.length.toFixed(1)}m):</span>
                            <span className="font-bold text-amber-700">
                              {r.headers6m > 0 ? `${r.headers6m}×6m` : ''}
                              {r.headers6m > 0 && r.headers3m > 0 ? ' + ' : ''}
                              {r.headers3m > 0 ? `${r.headers3m}×3m` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary Remarks */}
                    <div className="p-2 rounded bg-slate-50 border-l-2 border-amber-500 text-[10px] text-slate-600 leading-tight">
                      <strong className="text-slate-800 font-semibold block mb-0.5">Remarks:</strong>
                      {result.autoSummary}
                    </div>
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
