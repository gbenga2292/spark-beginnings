import React, { useMemo } from 'react';
import {
  Layers, Droplet, ArrowDown, Shield, Gauge, Sliders, CheckCircle2,
  AlertTriangle, Ruler, Compass
} from 'lucide-react';
import {
  DewateringInput,
  DewateringCalculationResult,
  calculateDewatering
} from '../../utils/dewateringCalculator';
import { useTheme } from '../../hooks/useTheme';

export interface DewateringSectionViewProps {
  inputs: DewateringInput;
  result?: DewateringCalculationResult | null;
  onUpdateInputs?: (updates: Partial<DewateringInput>) => void;
  readOnly?: boolean;
  className?: string;
  theme?: 'dark' | 'light' | 'print';
  hideControls?: boolean;
  hideMetrics?: boolean;
}

export const DewateringSectionView: React.FC<DewateringSectionViewProps> = ({
  inputs,
  result: externalResult,
  onUpdateInputs,
  readOnly = false,
  className = '',
  theme: propTheme,
  hideControls = false,
  hideMetrics = false,
}) => {
  const { isDark } = useTheme();
  const theme = propTheme || (isDark ? 'dark' : 'light');
  const result = useMemo(() => {
    return externalResult || calculateDewatering(inputs);
  }, [externalResult, inputs]);

  const depth = inputs.excavationDepth || 4.0;
  const wt = inputs.waterTableDepth || 1.0;
  const target = result?.targetDepth || (depth + 0.5);
  const offset = result?.designOffset || 1.0;

  const filterPipeLength = inputs.filterPipeLength && inputs.filterPipeLength > 0
    ? inputs.filterPipeLength
    : (result?.filterPipeLength || 6.0);
  const slottedLength = 1.0; // hardcoded 1.0m from tip up
  const tipDepth = filterPipeLength;
  const slottedTopDepth = Math.max(0, tipDepth - slottedLength);
  const maxScaleDepth = Math.max(tipDepth + 1.5, depth + 2.5, 8.0);

  // SVG Dimension Constants
  const W = 880;
  const H = 480;
  const yGL = 85;
  const availH = H - yGL - 45;
  const scaleY = availH / maxScaleDepth;

  const getY = (d: number) => yGL + d * scaleY;

  const yPit = getY(depth);
  const yWT = getY(wt);
  const yTarget = getY(target);
  const yTip = getY(tipDepth);
  const ySlottedTop = getY(slottedTopDepth);

  const cx = W / 2;
  const pitHalfW = 160;
  const pitLeft = cx - pitHalfW;
  const pitRight = cx + pitHalfW;

  const batter = 36;
  const crestLeft = pitLeft - batter;
  const crestRight = pitRight + batter;

  const offsetPx = Math.max(36, Math.min(80, offset * 36));
  const wpLeft = crestLeft - offsetPx;
  const wpRight = crestRight + offsetPx;

  const layout = result?.layoutType || inputs.layoutType || 'ring';
  const showRightWp = layout !== 'single_line';

  // Smooth drawdown curve (Cone of depression)
  const drawdownPath = showRightWp
    ? `M 25 ${yWT} 
       C ${wpLeft - 35} ${yWT}, ${wpLeft - 18} ${yTarget + 8}, ${wpLeft} ${yTarget + 3}
       C ${(wpLeft + cx) / 2} ${yTarget}, ${cx - 30} ${yTarget}, ${cx} ${yTarget}
       C ${cx + 30} ${yTarget}, ${(wpRight + cx) / 2} ${yTarget}, ${wpRight} ${yTarget + 3}
       C ${wpRight + 18} ${yTarget + 8}, ${wpRight + 35} ${yWT}, ${W - 25} ${yWT}
       L ${W - 25} ${H - 20} L 25 ${H - 20} Z`
    : `M 25 ${yWT} 
       C ${wpLeft - 35} ${yWT}, ${wpLeft - 18} ${yTarget + 8}, ${wpLeft} ${yTarget + 3}
       C ${cx} ${yTarget}, ${crestRight + 25} ${yTarget + 24}, ${W - 25} ${yWT}
       L ${W - 25} ${H - 20} L 25 ${H - 20} Z`;

  const isLight = theme === 'light' || theme === 'print';
  const isPrint = theme === 'print';

  return (
    <div className={`flex flex-col h-full w-full select-none overflow-hidden ${
      isPrint ? 'bg-white text-slate-900' : isLight ? 'bg-slate-50 text-slate-800' : 'bg-slate-900 text-slate-100'
    } ${className}`}>
      {/* Top Engineering Controls Bar */}
      {!readOnly && !hideControls && onUpdateInputs && (
        <div className={`flex-shrink-0 px-4 py-2 flex items-center justify-between gap-4 text-xs flex-wrap z-10 ${
          isLight ? 'bg-slate-100/90 border-b border-slate-200' : 'bg-slate-800/90 border-b border-slate-700/80'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold ${
              isLight ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
            }`}>
              <Layers size={13} />
            </div>
            <span className={`font-bold tracking-wide uppercase text-[11px] ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              Section Parameters
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Excavation Depth:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.2"
                  min="0.5"
                  value={depth}
                  onChange={e => onUpdateInputs({ excavationDepth: parseFloat(e.target.value) || 1 })}
                  className={`w-16 px-2 py-0.5 font-mono text-xs font-bold rounded text-right outline-none ${
                    isLight 
                      ? 'bg-white border border-slate-300 text-slate-900 focus:border-blue-500' 
                      : 'bg-slate-950 border border-slate-700 text-slate-100 focus:border-blue-500'
                  }`}
                />
                <span className={`ml-1 text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>m</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Static Water Table:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={wt}
                  onChange={e => onUpdateInputs({ waterTableDepth: parseFloat(e.target.value) || 0 })}
                  className={`w-16 px-2 py-0.5 font-mono text-xs font-bold rounded text-right outline-none ${
                    isLight 
                      ? 'bg-white border border-slate-300 text-sky-700 focus:border-blue-500' 
                      : 'bg-slate-950 border border-slate-700 text-sky-400 focus:border-blue-500'
                  }`}
                />
                <span className={`ml-1 text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>m</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Required Drawdown:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={inputs.requiredDrawdown || 0.5}
                  onChange={e => onUpdateInputs({ requiredDrawdown: parseFloat(e.target.value) || 0.5 })}
                  className={`w-16 px-2 py-0.5 font-mono text-xs font-bold rounded text-right outline-none ${
                    isLight 
                      ? 'bg-white border border-slate-300 text-emerald-700 focus:border-blue-500' 
                      : 'bg-slate-950 border border-slate-700 text-emerald-400 focus:border-blue-500'
                  }`}
                />
                <span className={`ml-1 text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>m</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Filter Length:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={filterPipeLength}
                  onChange={e => onUpdateInputs({ filterPipeLength: parseFloat(e.target.value) || 1 })}
                  className={`w-16 px-2 py-0.5 font-mono text-xs font-bold rounded text-right outline-none ${
                    isLight 
                      ? 'bg-white border border-slate-300 text-teal-700 focus:border-blue-500' 
                      : 'bg-slate-950 border border-slate-700 text-teal-400 focus:border-blue-500'
                  }`}
                />
                <span className={`ml-1 text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>m</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Offset:</span>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                isLight 
                  ? 'text-amber-800 bg-amber-50 border-amber-300' 
                  : 'text-amber-400 bg-slate-950 border-slate-700'
              }`}>
                {offset.toFixed(2)} m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main SVG Cross-Section Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full max-h-[70vh] object-contain font-mono select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Drawdown water table gradient */}
            <linearGradient id="drawdownGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity={isLight ? "0.18" : "0.25"} />
              <stop offset="100%" stopColor="#0369a1" stopOpacity={isLight ? "0.45" : "0.65"} />
            </linearGradient>

            {/* Subsoil pattern */}
            <pattern id="soilHatch" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="20" stroke={isLight ? "#94a3b8" : "#334155"} strokeWidth="0.8" opacity={isLight ? "0.2" : "0.35"} />
            </pattern>

            {/* Excavation Pit Floor Gradient */}
            <linearGradient id="pitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isLight ? "#f8fafc" : "#1e293b"} stopOpacity={isLight ? "0.9" : "0.8"} />
              <stop offset="100%" stopColor={isLight ? "#f1f5f9" : "#0f172a"} stopOpacity={isLight ? "0.98" : "0.95"} />
            </linearGradient>
          </defs>

          {/* Subsoil Background */}
          <rect x="25" y={yGL} width={W - 50} height={H - yGL - 20} fill="url(#soilHatch)" />

          {/* Depressed Drawdown Hydraulic Water Surface Fill */}
          <path d={drawdownPath} fill="url(#drawdownGradient)" stroke="#0284c7" strokeWidth="2" />

          {/* Excavation Cut Polygon (Fill inside pit cut) */}
          <polygon
            points={`
              ${crestLeft},${yGL} 
              ${pitLeft},${yPit} 
              ${pitRight},${yPit} 
              ${crestRight},${yGL}
            `}
            fill="url(#pitGradient)"
            stroke={isLight ? "#cbd5e1" : "none"}
            strokeWidth="1"
          />

          {/* Ground Surface Lines & Pit Slopes */}
          <line x1="25" y1={yGL} x2={crestLeft} y2={yGL} stroke={isLight ? "#0f172a" : "#94a3b8"} strokeWidth="2.5" />
          <line x1={crestLeft} y1={yGL} x2={pitLeft} y2={yPit} stroke={isLight ? "#475569" : "#64748b"} strokeWidth="2.5" strokeDasharray="6 2" />
          <line x1={pitLeft} y1={yPit} x2={pitRight} y2={yPit} stroke={isLight ? "#0284c7" : "#38bdf8"} strokeWidth="3" />
          <line x1={pitRight} y1={yPit} x2={crestRight} y2={yGL} stroke={isLight ? "#475569" : "#64748b"} strokeWidth="2.5" strokeDasharray="6 2" />
          <line x1={crestRight} y1={yGL} x2={W - 25} y2={yGL} stroke={isLight ? "#0f172a" : "#94a3b8"} strokeWidth="2.5" />

          {/* Ground Level Hatches (Standard CAD ground symbol) */}
          {[-120, -80, -40, 40, 80, 120].map((dx, i) => (
            <g key={i}>
              <line x1={wpLeft + dx - 8} y1={yGL} x2={wpLeft + dx - 16} y2={yGL + 8} stroke={isLight ? "#94a3b8" : "#475569"} strokeWidth="1" />
              <line x1={wpRight + dx - 8} y1={yGL} x2={wpRight + dx - 16} y2={yGL + 8} stroke={isLight ? "#94a3b8" : "#475569"} strokeWidth="1" />
            </g>
          ))}

          {/* Static Water Table (b.g.l.) Line */}
          <line x1="25" y1={yWT} x2={W - 25} y2={yWT} stroke="#0284c7" strokeWidth="1.8" strokeDasharray="8 4" />
          <g transform={`translate(35, ${yWT - 8})`}>
            {/* Water level symbol ▼ */}
            <polygon points="0,0 8,0 4,7" fill="#0284c7" />
            <text x="14" y="5" fontSize="9.5" fill={isLight ? "#0369a1" : "#38bdf8"} fontWeight="bold">
              STATIC WATER TABLE (-{wt.toFixed(2)}m b.g.l.)
            </text>
          </g>

          {/* Target Drawdown Water Level */}
          <line x1={pitLeft - 20} y1={yTarget} x2={pitRight + 20} y2={yTarget} stroke="#059669" strokeWidth="1.6" strokeDasharray="4 3" />
          <g transform={`translate(${cx}, ${yTarget + 14})`}>
            <polygon points="-4,-14 4,-14 0,-7" fill="#059669" />
            <text x="0" y="0" textAnchor="middle" fontSize="10" fill={isLight ? "#065f46" : "#34d399"} fontWeight="bold">
              TARGET WATER LEVEL (-{target.toFixed(2)}m) • DRAWDOWN {result?.drawdownAmount.toFixed(2)}m
            </text>
          </g>

          {/* Excavation Pit Formation Level Label */}
          <g transform={`translate(${cx}, ${yPit - 10})`}>
            <text x="0" y="0" textAnchor="middle" fontSize="10.5" fill={isLight ? "#0f172a" : "#f8fafc"} fontWeight="bold">
              EXCAVATION FORMATION LEVEL (-{depth.toFixed(2)}m)
            </text>
            <text x="0" y="14" textAnchor="middle" fontSize="9" fill={isLight ? "#64748b" : "#94a3b8"}>
              Pit Width: {inputs.excavationWidth || 12}m
            </text>
          </g>

          {/* Ground Level Tag */}
          <g transform={`translate(35, ${yGL - 10})`}>
            <text x="0" y="0" fontSize="10" fill={isLight ? "#334155" : "#cbd5e1"} fontWeight="bold">
              GROUND LEVEL ±0.00m
            </text>
          </g>

          {/* Setback Offset Dimensions */}
          <g>
            {/* Left Setback line */}
            <line x1={crestLeft} y1={yGL - 18} x2={wpLeft} y2={yGL - 18} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
            <line x1={crestLeft} y1={yGL - 24} x2={crestLeft} y2={yGL - 12} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
            <line x1={wpLeft} y1={yGL - 24} x2={wpLeft} y2={yGL - 12} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
            <text x={(crestLeft + wpLeft) / 2} y={yGL - 22} textAnchor="middle" fontSize="8.5" fill={isLight ? "#b45309" : "#fbbf24"} fontWeight="bold">
              OFFSET {offset.toFixed(2)}m
            </text>

            {/* Right Setback line */}
            {showRightWp && (
              <>
                <line x1={crestRight} y1={yGL - 18} x2={wpRight} y2={yGL - 18} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
                <line x1={crestRight} y1={yGL - 24} x2={crestRight} y2={yGL - 12} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
                <line x1={wpRight} y1={yGL - 24} x2={wpRight} y2={yGL - 12} stroke={isLight ? "#d97706" : "#f59e0b"} strokeWidth="1.2" />
                <text x={(crestRight + wpRight) / 2} y={yGL - 22} textAnchor="middle" fontSize="8.5" fill={isLight ? "#b45309" : "#fbbf24"} fontWeight="bold">
                  OFFSET {offset.toFixed(2)}m
                </text>
              </>
            )}
          </g>

          {/* Left Wellpoint Installation */}
          <g>
            {/* Header Pipe circle on surface */}
            <circle cx={wpLeft} cy={yGL} r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
            <text x={wpLeft} y={yGL + 16} textAnchor="middle" fontSize="8" fill={isLight ? "#b45309" : "#f59e0b"} fontWeight="bold">
              HEADER
            </text>

            {/* Solid Riser Pipe from surface down to top of slotted screen */}
            <line x1={wpLeft} y1={yGL} x2={wpLeft} y2={ySlottedTop} stroke={isLight ? "#64748b" : "#94a3b8"} strokeWidth="2.5" />

            {/* 1.0m Slotted Filter Screen from tip up */}
            <line x1={wpLeft} y1={ySlottedTop} x2={wpLeft} y2={yTip} stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" />
            {/* Perforation slot marks */}
            {[0.2, 0.4, 0.6, 0.8].map(ratio => {
              const ySlot = ySlottedTop + (yTip - ySlottedTop) * ratio;
              return (
                <line
                  key={ratio}
                  x1={wpLeft - 4}
                  y1={ySlot}
                  x2={wpLeft + 4}
                  y2={ySlot}
                  stroke={isLight ? "#047857" : "#064e3b"}
                  strokeWidth="1.2"
                />
              );
            })}
            {/* Conical jetting tip shoe */}
            <polygon points={`${wpLeft - 3},${yTip} ${wpLeft + 3},${yTip} ${wpLeft},${yTip + 5}`} fill="#10b981" />

            <g transform={`translate(${wpLeft - 8}, ${yTip})`}>
              <text x="0" y="-8" textAnchor="end" fontSize="9" fill={isLight ? "#047857" : "#34d399"} fontWeight="bold">
                FILTER TIP -{tipDepth.toFixed(2)}m
              </text>
              <text x="0" y="3" textAnchor="end" fontSize="7.5" fill={isLight ? "#059669" : "#10b981"} fontWeight="600">
                (1.0m SLOTTED SCREEN)
              </text>
            </g>

            {/* Surface Vacuum Pump Unit */}
            <g transform={`translate(${wpLeft - 36}, ${yGL - 28})`}>
              <rect width="28" height="20" rx="3" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1.2" />
              <text x="14" y="13" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">
                PUMP
              </text>
              {/* Suction Flexible Hose */}
              <line x1="28" y1="12" x2="36" y2="28" stroke="#eab308" strokeWidth="2" strokeDasharray="3 1" />
              {/* Layflat Discharge Line */}
              <path d="M 0 10 L -45 10" stroke="#ea580c" strokeWidth="2.2" strokeDasharray="4 2" />
              <text x="-48" y="7" textAnchor="end" fontSize="8" fill={isLight ? "#c2410c" : "#fb923c"} fontWeight="bold">
                DISCHARGE ➜
              </text>
            </g>
          </g>

          {/* Right Wellpoint Installation */}
          {showRightWp && (
            <g>
              {/* Header Pipe circle on surface */}
              <circle cx={wpRight} cy={yGL} r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
              <text x={wpRight} y={yGL + 16} textAnchor="middle" fontSize="8" fill={isLight ? "#b45309" : "#f59e0b"} fontWeight="bold">
                HEADER
              </text>

              {/* Solid Riser Pipe */}
              <line x1={wpRight} y1={yGL} x2={wpRight} y2={ySlottedTop} stroke={isLight ? "#64748b" : "#94a3b8"} strokeWidth="2.5" />

              {/* 1.0m Slotted Filter Screen */}
              <line x1={wpRight} y1={ySlottedTop} x2={wpRight} y2={yTip} stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" />
              {/* Perforation slot marks */}
              {[0.2, 0.4, 0.6, 0.8].map(ratio => {
                const ySlot = ySlottedTop + (yTip - ySlottedTop) * ratio;
                return (
                  <line
                    key={ratio}
                    x1={wpRight - 4}
                    y1={ySlot}
                    x2={wpRight + 4}
                    y2={ySlot}
                    stroke={isLight ? "#047857" : "#064e3b"}
                    strokeWidth="1.2"
                  />
                );
              })}
              {/* Conical jetting tip shoe */}
              <polygon points={`${wpRight - 3},${yTip} ${wpRight + 3},${yTip} ${wpRight},${yTip + 5}`} fill="#10b981" />

              <g transform={`translate(${wpRight + 8}, ${yTip})`}>
                <text x="0" y="-8" textAnchor="start" fontSize="9" fill={isLight ? "#047857" : "#34d399"} fontWeight="bold">
                  FILTER TIP -{tipDepth.toFixed(2)}m
                </text>
                <text x="0" y="3" textAnchor="start" fontSize="7.5" fill={isLight ? "#059669" : "#10b981"} fontWeight="600">
                  (1.0m SLOTTED SCREEN)
                </text>
              </g>
            </g>
          )}

          {/* Depth Elevation Datum Axis (Right Margin) */}
          <g transform={`translate(${W - 35}, ${yGL})`}>
            <line x1="0" y1="0" x2="0" y2={yTip - yGL + 20} stroke={isLight ? "#94a3b8" : "#475569"} strokeWidth="1.2" />
            {Array.from({ length: Math.ceil(maxScaleDepth) + 1 }, (_, i) => i)
              .filter(m => getY(m) <= H - 20)
              .map(m => (
                <g key={m} transform={`translate(0, ${m * scaleY})`}>
                  <line x1="-4" y1="0" x2="4" y2="0" stroke={isLight ? "#64748b" : "#64748b"} strokeWidth="1" />
                  <text x="8" y="3.5" fontSize="8" fill={isLight ? "#475569" : "#94a3b8"} fontWeight="bold">
                    -{m}m
                  </text>
                </g>
              ))}
          </g>
        </svg>
      </div>

      {/* Bottom Engineering Summary Readout Strip */}
      {!hideMetrics && (
        <div className={`flex-shrink-0 px-6 py-2.5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs ${
          isLight ? 'bg-slate-50 border-t border-slate-200' : 'bg-slate-950/80 border-t border-slate-800'
        }`}>
          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Formation Depth</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>-{depth.toFixed(2)} m</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Excavation Base</span>
          </div>

          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Static Water Table</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>-{wt.toFixed(2)} m</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Natural Aquifer</span>
          </div>

          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Target Drawdown</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{result?.drawdownAmount.toFixed(2)} m</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Formation Level -{target.toFixed(2)}m</span>
          </div>

          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Wellpoint Screen</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>-{tipDepth.toFixed(2)} m</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filterPipeLength.toFixed(1)}m Filter (1.0m Slotted)</span>
          </div>

          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Total Filters</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>{result?.filters || 0} pts</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filterPipeLength.toFixed(0)}m Pipes @ 1.0m c/c</span>
          </div>

          <div className="space-y-0.5">
            <span className={`text-[10px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Vacuum Pumps</span>
            <p className={`font-mono text-sm font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{result?.pumps || 1} units</p>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{(result?.pumps || 1) * 150} m³/h Flow Cap</span>
          </div>
        </div>
      )}
    </div>
  );
};
