import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  Layers,
  Edit3,
  Settings,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Bookmark,
  Save,
  Trash2,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { DewateringSimulationResult } from '../../utils/simulationLogic';
import { DewateringSectionView } from './DewateringSectionView';
import { DewateringInput, DewateringCalculationResult, DEFAULT_DEWATERING_INPUT } from '../../utils/dewateringCalculator';

export interface ExportOptions {
  layoutFormat: 'combined' | 'multi-view' | 'tri-view-a1' | 'plan-section' | 'pure-section' | 'pure-2d' | 'pure-3d';
  includeSitePlan: boolean;
  includeSectionView: boolean;
  include3DView: boolean;
  includeBOM: boolean;
  includeLegend: boolean;
  includeBlueprint: boolean;
  includeTitleBlock: boolean;
  colorMode: 'color' | 'bw';
}

export interface SheetDetails {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  regNumber: string;
  layoutName: string;
  dateStr: string;
  sheetNo: string;
  scale: string;
  revNo: string;
  logoWidth?: number;
  companyWidth?: number;
  metaWidth?: number;
  marginSize?: string;
}

export interface TitleBlockPreset {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  regNumber: string;
  logoWidth?: number;
  companyWidth?: number;
  metaWidth?: number;
  scale?: string;
  revNo?: string;
}

const DEFAULT_PRESETS: TitleBlockPreset[] = [
  {
    id: 'default-dewatering',
    name: 'Standard Dewatering Ltd',
    companyName: 'Dewatering Construction Ltd',
    companyAddress: '7 Musiliu Smith Street, Yaba, Lagos, Nigeria',
    companyPhone: '+234 903 000 2182',
    companyEmail: 'info@dewaterconstruct.com',
    regNumber: 'RC-141299',
    logoWidth: 110,
    companyWidth: 250,
    metaWidth: 170,
  },
  {
    id: 'compact-layout',
    name: 'Compact Information',
    companyName: 'Dewatering Construction',
    companyAddress: 'Lagos, Nigeria',
    companyPhone: '+234 903 000 2182',
    companyEmail: 'info@dewaterconstruct.com',
    regNumber: 'RC-141299',
    logoWidth: 90,
    companyWidth: 200,
    metaWidth: 150,
  },
];

const PRESET_STORAGE_KEY = 'spark_title_block_presets';

function getStoredPresets(): TitleBlockPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return DEFAULT_PRESETS;
}

function savePresetsToStorage(presets: TitleBlockPreset[]) {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch (_) {}
}

interface DrawingSheetPreviewProps {
  onClose: () => void;
  layoutName: string;
  companyInfo: {
    name: string;
    regNumber: string;
    address: string;
    email: string;
    phone: string;
  };
  logoSrc: string;
  sitePlanDataUrl: string | null;
  perspectiveDataUrl: string | null;
  bomResults: DewateringSimulationResult;
  dateStr: string;
  exportOptions: ExportOptions;
  onExportOptionsChange?: (options: ExportOptions) => void;
  activeLegendItems?: string[];
  sheetDetails?: SheetDetails;
  onWidthsChange?: (widths: { logoWidth?: number; companyWidth?: number; metaWidth?: number }) => void;
  calculatorInputs?: DewateringInput | null;
  calculationResult?: DewateringCalculationResult | null;
}

interface LegendDef {
  key: string;
  label: string;
  sub: string;
  renderIcon: (size?: number) => React.ReactNode;
}

const CAD_LEGEND_DEFS: LegendDef[] = [
  {
    key: 'HEADER PIPES',
    label: 'Header Pipes (6m)',
    sub: 'DN150 Bauer Quick-Coupled',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="1" y1="6" x2="19" y2="6" stroke="#0284c7" strokeWidth="4.5" strokeLinecap="square" />
        <line x1="2" y1="6" x2="18" y2="6" stroke="#38bdf8" strokeWidth="2" strokeLinecap="square" />
        <rect x="0" y="2" width="2.5" height="8" fill="#0369a1" rx="0.5" />
        <rect x="17.5" y="2" width="2.5" height="8" fill="#0369a1" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'WELL POINTS',
    label: 'Wellpoint Risers',
    sub: '1.0m c/c Vacuum Filters',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="10" y1="1" x2="10" y2="11" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="10" cy="3.5" r="3" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="1" />
        <circle cx="10" cy="3.5" r="1.2" fill="#0369a1" />
        <line x1="8" y1="9" x2="12" y2="9" stroke="#0ea5e9" strokeWidth="1" />
        <line x1="8" y1="11" x2="12" y2="11" stroke="#0ea5e9" strokeWidth="1" />
      </svg>
    ),
  },
  {
    key: 'DEWATERING PUMPS',
    label: 'Dewatering Pump',
    sub: '150 m³/h Centrifugal Unit',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <rect x="2" y="1" width="16" height="10" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1" rx="1.5" />
        <rect x="6" y="3" width="8" height="6" fill="#bae6fd" />
        <rect x="0" y="4" width="2" height="4" fill="#f59e0b" />
        <rect x="18" y="4" width="2" height="4" fill="#1d4ed8" />
        <circle cx="10" cy="6" r="1.5" fill="#0369a1" />
      </svg>
    ),
  },
  {
    key: 'ELBOW CONNECTORS',
    label: 'Elbow Connector',
    sub: '90° Bauer Directional Bend',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <path d="M 4 11 L 4 3 L 16 3" fill="none" stroke="#0284c7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 4 11 L 4 3 L 16 3" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="1" y="9" width="4.5" height="2" fill="#f59e0b" />
        <rect x="14" y="1" width="2" height="4.5" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    key: 'TEE CONNECTORS',
    label: 'Tee Connector',
    sub: '3-Way Header Branch',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="2" y1="4" x2="18" y2="4" stroke="#0284c7" strokeWidth="3" />
        <line x1="10" y1="4" x2="10" y2="11" stroke="#0284c7" strokeWidth="3" />
        <line x1="3" y1="4" x2="17" y2="4" stroke="#38bdf8" strokeWidth="1.2" />
        <line x1="10" y1="4" x2="10" y2="10" stroke="#38bdf8" strokeWidth="1.2" />
        <circle cx="10" cy="4" r="1.5" fill="#10b981" />
      </svg>
    ),
  },
  {
    key: 'SUCTION HOSES',
    label: 'Suction Hose',
    sub: 'Corrugated Flexible Conduit',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="2" y1="6" x2="18" y2="6" stroke="#eab308" strokeWidth="3" strokeDasharray="2.5 1.5" strokeLinecap="round" />
        <line x1="1" y1="3" x2="1" y2="9" stroke="#a16207" strokeWidth="1.5" />
        <line x1="19" y1="3" x2="19" y2="9" stroke="#a16207" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'DISCHARGE HOSES',
    label: 'Discharge Hose',
    sub: 'Layflat Reinforced Runoff',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="2" y1="6" x2="18" y2="6" stroke="#f97316" strokeWidth="3" strokeLinecap="square" />
        <line x1="3" y1="6" x2="17" y2="6" stroke="#ffedd5" strokeWidth="1" strokeDasharray="3 2" />
        <polyline points="13,4 17,6 13,8" fill="none" stroke="#c2410c" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    key: 'EXCAVATION AREA',
    label: 'Excavation Pit',
    sub: 'Formation Boundary & Slope',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <rect x="1" y="1" width="18" height="10" fill="rgba(239, 68, 68, 0.12)" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 2" />
        <line x1="4" y1="11" x2="8" y2="1" stroke="#ef4444" strokeWidth="0.8" opacity="0.6" />
        <line x1="11" y1="11" x2="15" y2="1" stroke="#ef4444" strokeWidth="0.8" opacity="0.6" />
      </svg>
    ),
  },
  {
    key: 'SITE BOUNDARY',
    label: 'Site Boundary',
    sub: 'Perimeter Project Limits',
    renderIcon: (size = 18) => (
      <svg width={size} height={size * 0.6} viewBox="0 0 20 12" className="flex-shrink-0">
        <line x1="1" y1="6" x2="19" y2="6" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 1.5 1 1.5" />
        <rect x="0.5" y="3" width="2" height="6" fill="#16a34a" />
        <rect x="17.5" y="3" width="2" height="6" fill="#16a34a" />
      </svg>
    ),
  },
];

const LegendPanel: React.FC<{ compact?: boolean; activeLegendItems?: string[] }> = ({ compact = false, activeLegendItems }) => {
  const matched = activeLegendItems && activeLegendItems.length > 0
    ? CAD_LEGEND_DEFS.filter(item => 
        activeLegendItems.some(k => k.toUpperCase().includes(item.key) || item.key.includes(k.toUpperCase()))
      )
    : CAD_LEGEND_DEFS;
  const items = matched.length > 0 ? matched : CAD_LEGEND_DEFS;
  const useTwoCols = items.length > 4;

  return (
    <div className="flex flex-col bg-white border border-slate-400 rounded-xs shadow-xs overflow-hidden max-w-[290px]">
      {/* Precision Minimalist CAD Header */}
      <div className="bg-slate-900 text-white px-2 py-0.5 flex items-center justify-between border-b border-slate-700 select-none">
        <span className="text-[8px] font-mono font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-sky-400 inline-block" />
          Drawing Legend
        </span>
        <span className="text-[6.5px] text-slate-400 font-mono tracking-tighter">BS 8004 / ISO 128</span>
      </div>

      {/* Symbols List / Grid */}
      <div className={`p-1.5 ${useTwoCols ? 'grid grid-cols-2 gap-x-2 gap-y-1' : 'space-y-1'}`}>
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-1.5 min-w-0 py-0.5">
            <div className="w-4 h-3 flex items-center justify-center flex-shrink-0">
              {item.renderIcon(16)}
            </div>
            <div className="min-w-0 flex-1 leading-none">
              <div className="text-[7.5px] font-bold text-slate-900 truncate tracking-tight">
                {item.label}
              </div>
              <div className="text-[6px] text-slate-500 font-mono truncate mt-0.5">
                {item.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Bill of Materials Table
───────────────────────────────────────────────────────── */
const BOMTable: React.FC<{ bomResults: DewateringSimulationResult; compact?: boolean }> = ({ bomResults, compact = false }) => {
  const rows: { label: string; qty: string | number; unit: string }[] = [
    { label: 'Header Pipes (6m)', qty: bomResults.headers6m, unit: 'No.' },
    { label: 'Header Pipes (3m)', qty: bomResults.headers3m, unit: 'No.' },
    { label: 'Vacuum Pump Units', qty: bomResults.pumps, unit: 'No.' },
    { label: `${bomResults.wellpointLength || 6}m Filter Pipes`, qty: bomResults.wellpoints, unit: 'No.' },
    { label: 'Swing Joints', qty: bomResults.swingJoints, unit: 'No.' },
    { label: 'Elbow Connectors', qty: bomResults.elbows, unit: 'No.' },
    { label: 'Tee Connectors', qty: bomResults.tees, unit: 'No.' },
    { label: 'End Caps', qty: bomResults.endCaps, unit: 'No.' },
    { label: 'Bauer Couplings', qty: bomResults.couplings, unit: 'No.' },
    { label: 'Suction Hoses', qty: bomResults.suctionHoses, unit: 'No.' },
    { label: 'Discharge Hose', qty: `${bomResults.dischargeHoseMeters.toFixed(1)}`, unit: 'm' },
    { label: 'Total Header Length', qty: `${bomResults.totalLengthMeters.toFixed(1)}`, unit: 'm' },
  ].filter(r => Number(r.qty) !== 0 || typeof r.qty === 'string');

  const cellPx = compact ? 'text-[7px]' : 'text-[9px]';
  const headerPx = compact ? 'text-[7.5px]' : 'text-[10px]';

  return (
    <div className="flex flex-col bg-white border border-slate-400 rounded-xs shadow-xs overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white px-2 py-0.5 flex items-center justify-between border-b border-slate-700 select-none">
        <span className={`${headerPx} font-mono font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5`}>
          <span className="w-1.5 h-1.5 bg-amber-400 inline-block" />
          Bill of Materials
        </span>
        <span className="text-[6.5px] text-slate-400 font-mono tracking-tighter">BS EN ISO 4157</span>
      </div>
      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-300">
            <th className={`${cellPx} font-bold text-slate-700 text-left px-1.5 py-0.5 border-r border-slate-300`}>Item</th>
            <th className={`${cellPx} font-bold text-slate-700 text-center px-1.5 py-0.5 border-r border-slate-300 w-10`}>Qty</th>
            <th className={`${cellPx} font-bold text-slate-700 text-center px-1.5 py-0.5 w-8`}>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className={`${cellPx} text-slate-800 px-1.5 py-0.5 border-r border-slate-200 leading-tight`}>{row.label}</td>
              <td className={`${cellPx} font-bold text-slate-900 text-center px-1.5 py-0.5 border-r border-slate-200 tabular-nums`}>{row.qty}</td>
              <td className={`${cellPx} text-slate-500 text-center px-1.5 py-0.5 font-mono`}>{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   ISO Title Block (shared across all sheets)
───────────────────────────────────────────────────────── */
interface TitleBlockProps {
  companyInfo: DrawingSheetPreviewProps['companyInfo'];
  logoSrc: string;
  layoutName: string;
  dateStr: string;
  sheetNo: string;
  drawingType: string;
  scale: string;
  revNo?: string;
  sheetDetails?: SheetDetails;
  onWidthsChange?: (widths: { logoWidth?: number; companyWidth?: number; metaWidth?: number }) => void;
}

const TitleBlock: React.FC<TitleBlockProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  dateStr,
  sheetNo,
  drawingType,
  scale,
  revNo = '00',
  sheetDetails,
  onWidthsChange,
}) => {
  const compName = sheetDetails?.companyName ?? companyInfo.name;
  const compAddress = sheetDetails?.companyAddress ?? companyInfo.address;
  const compPhone = sheetDetails?.companyPhone ?? companyInfo.phone;
  const compEmail = sheetDetails?.companyEmail ?? companyInfo.email;
  const regNum = sheetDetails?.regNumber ?? companyInfo.regNumber;
  const title = sheetDetails?.layoutName ?? layoutName;
  const date = sheetDetails?.dateStr ?? dateStr;
  const sheetNum = sheetDetails?.sheetNo ?? sheetNo;
  const scaleVal = sheetDetails?.scale ?? scale;
  const rev = sheetDetails?.revNo ?? revNo;

  const logoWidth = sheetDetails?.logoWidth ?? 110;
  const companyWidth = sheetDetails?.companyWidth ?? 250;
  const metaWidth = sheetDetails?.metaWidth ?? 170;

  const [draggingDivider, setDraggingDivider] = useState<'logo' | 'company' | 'meta' | null>(null);
  const dragStartX = React.useRef<number>(0);
  const dragStartWidth = React.useRef<number>(0);

  const startDrag = (divider: 'logo' | 'company' | 'meta', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingDivider(divider);
    dragStartX.current = e.clientX;
    if (divider === 'logo') dragStartWidth.current = logoWidth;
    if (divider === 'company') dragStartWidth.current = companyWidth;
    if (divider === 'meta') dragStartWidth.current = metaWidth;
  };

  React.useEffect(() => {
    if (!draggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      if (draggingDivider === 'logo') {
        const newW = Math.max(70, Math.min(250, dragStartWidth.current + deltaX));
        onWidthsChange?.({ logoWidth: newW });
      } else if (draggingDivider === 'company') {
        const newW = Math.max(140, Math.min(450, dragStartWidth.current + deltaX));
        onWidthsChange?.({ companyWidth: newW });
      } else if (draggingDivider === 'meta') {
        const newW = Math.max(120, Math.min(320, dragStartWidth.current - deltaX));
        onWidthsChange?.({ metaWidth: newW });
      }
    };

    const handleMouseUp = () => {
      setDraggingDivider(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingDivider, logoWidth, companyWidth, metaWidth, onWidthsChange]);

  return (
    <div className="h-[90px] flex border-t-[2px] border-black bg-white text-black flex-shrink-0 relative select-none box-border">
      {/* 1. Logo Column */}
      <div
        className="flex items-center justify-center p-1.5 flex-shrink-0 relative overflow-hidden border-r-[2px] border-black box-border"
        style={{ width: `${logoWidth}px` }}
      >
        {logoSrc ? (
          <img src={logoSrc} alt="Company Logo" className="max-h-[72px] max-w-full object-contain" />
        ) : (
          <div className="text-[10px] font-black uppercase text-center leading-tight opacity-60">
            <Layers size={22} className="mx-auto mb-0.5 opacity-50" />
            {compName.split(' ').slice(0, 2).join('\n')}
          </div>
        )}

        {/* Resizer Handle 1 (Logo <-> Company Info) */}
        <div
          className="absolute inset-y-0 -right-2 w-4 z-30 cursor-col-resize group print:hidden flex items-center justify-center"
          onMouseDown={(e) => startDrag('logo', e)}
          title="Click and drag to expand/reduce Logo column"
        >
          <div className="w-1 h-6 bg-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>

      {/* 2. Company Info Column */}
      <div
        className="px-2 py-1 flex flex-col justify-center flex-shrink-0 min-w-0 relative overflow-hidden border-r-[2px] border-black box-border"
        style={{ width: `${companyWidth}px` }}
      >
        <div className="font-bold text-[10.5px] uppercase leading-tight mb-0.5 line-clamp-2">{compName}</div>
        <div className="text-[8.5px] text-gray-600 line-clamp-2 leading-tight">{compAddress}</div>
        <div className="text-[8.5px] text-gray-600 truncate leading-tight mt-0.5">
          {compPhone} {compEmail ? `· ${compEmail}` : ''}
        </div>
        <div className="text-[8px] text-gray-400 mt-auto">{regNum}</div>

        {/* Resizer Handle 2 (Company Info <-> Drawing Title) */}
        <div
          className="absolute inset-y-0 -right-2 w-4 z-30 cursor-col-resize group print:hidden flex items-center justify-center"
          onMouseDown={(e) => startDrag('company', e)}
          title="Click and drag to expand/reduce Company Details column"
        >
          <div className="w-1 h-6 bg-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>

      {/* 3. Title & Drawing Type Column */}
      <div className="flex-1 px-3 py-1 flex flex-col justify-center min-w-0 border-r-[2px] border-black relative box-border">
        <div className="text-[9px] font-bold uppercase text-gray-500 tracking-widest truncate">{drawingType}</div>
        <div className="font-black text-[13.5px] uppercase leading-tight mt-0.5 truncate">
          {title || 'Dewatering System Layout'}
        </div>
        <div className="text-[9px] text-gray-500 mt-auto">Dewatering Construction Drawing</div>

        {/* Resizer Handle 3 (Drawing Title <-> Metadata) */}
        <div
          className="absolute inset-y-0 -right-2 w-4 z-30 cursor-col-resize group print:hidden flex items-center justify-center"
          onMouseDown={(e) => startDrag('meta', e)}
          title="Click and drag to expand/reduce Metadata column"
        >
          <div className="w-1 h-6 bg-indigo-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>

      {/* 4. Metadata Cells Column */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden box-border"
        style={{ width: `${metaWidth}px` }}
      >
        <div className="flex flex-1 border-b-[2px] border-black">
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0 border-r-[2px] border-black">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Date</span>
            <span className="text-[9px] font-bold leading-tight truncate">{date}</span>
          </div>
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0 border-r-[2px] border-black">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Scale</span>
            <span className="text-[9px] font-bold leading-tight truncate">{scaleVal}</span>
          </div>
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Rev.</span>
            <span className="text-[9px] font-bold leading-tight truncate">{rev}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <span className="text-[7.5px] font-bold uppercase text-gray-500">Sheet No.</span>
          <span className="text-[15px] font-black leading-tight truncate">{sheetNum}</span>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-100: Combined (Site Plan + 3D + BOM + Legend)
───────────────────────────────────────────────────────── */
const CombinedSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  perspectiveDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;
  const hasRightColumn = !!perspectiveDataUrl || showBOM || showLegend;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area */}
      <div className="flex-1 flex border-b-0 min-h-0">
        {/* Site Plan */}
        {sitePlanDataUrl && (
          <div className={`${hasRightColumn ? 'flex-[3] border-r-[2px] border-black' : 'flex-1'} relative flex flex-col bg-white overflow-hidden items-center justify-center`}>
            <div className="absolute top-1.5 left-2 z-10 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">Site Plan — Plan View</span>
            </div>
            <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain p-1" />
          </div>
        )}

        {/* Right column: 3D + BOM + Legend (rendered ONLY if at least one item exists) */}
        {hasRightColumn && (
          <div className="flex-1 flex flex-col divide-y-[2px] divide-black min-w-0">
            {/* 3D Perspective */}
            {perspectiveDataUrl && (
              <div className="flex-[3] relative bg-slate-900 flex flex-col overflow-hidden">
                <div className="absolute top-1.5 left-2 z-10 bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">3D Perspective</span>
                </div>
                <img src={perspectiveDataUrl} alt="3D View" className="w-full h-full object-cover" />
              </div>
            )}

            {/* BOM */}
            {showBOM && (
              <div className="flex-[2] p-2 overflow-auto">
                <BOMTable bomResults={bomResults} compact />
              </div>
            )}

            {/* Legend */}
            {showLegend && (
              <div className="flex-[2] p-2 overflow-auto">
                <LegendPanel compact activeLegendItems={activeLegendItems} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-100"
          drawingType="Combined Site Plan + 3D Perspective"
          scale="NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-101: Pure 2D Floor Plan (full-width CAD blueprint)
───────────────────────────────────────────────────────── */
const Pure2DSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area */}
      <div className="flex-1 flex border-b-0 min-h-0">
        {/* Main 2D plan — takes most of the space */}
        {sitePlanDataUrl && (
          <div className="flex-1 relative flex flex-col bg-white">
            {/* Blueprint grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />

            {/* Drawing labels */}
            <div className="absolute top-2 left-3 z-10 flex flex-col gap-1">
              <div className="bg-white/90 border border-gray-300 px-2 py-0.5 inline-block">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">
                  Floor Plan — Dewatering Layout
                </span>
              </div>
              <div className="bg-white/90 border border-gray-200 px-2 py-0.5 inline-block">
                <span className="text-[8px] text-gray-500 font-mono">
                  DRAWING No: {sheetDetails?.sheetNo || (layoutName ? layoutName.substring(0, 12).toUpperCase() : 'DW-001')} · SCALE: {sheetDetails?.scale || 'NTS'} ·
                  ALL DIM IN METRES
                </span>
              </div>
            </div>

            <img
              src={sitePlanDataUrl}
              alt="2D Floor Plan"
              className="w-full h-full object-contain"
              style={{ filter: 'contrast(1.05) saturate(1.1)' }}
            />

            {/* North arrow */}
            <div className="absolute bottom-2 left-3 z-10 bg-white/90 border border-gray-300 p-1.5 flex flex-col items-center shadow-sm">
              <svg width="24" height="32" viewBox="0 0 24 32">
                <polygon points="12,0 4,24 12,20 20,24" fill="black" />
                <polygon points="12,0 20,24 12,20" fill="white" />
                <text x="12" y="30" textAnchor="middle" fontSize="8" fontWeight="bold">N</text>
              </svg>
            </div>
            
            {/* BOM and Legend floating container */}
            {(showBOM || showLegend) && (
              <div className="absolute bottom-2 right-3 z-10 flex flex-col gap-2 max-h-[90%] overflow-hidden">
                {showBOM && (
                  <div className="bg-white/95 backdrop-blur-sm border border-gray-400 p-2 shadow-md rounded-sm overflow-auto">
                    <BOMTable bomResults={bomResults} compact />
                  </div>
                )}
                {showLegend && (
                  <LegendPanel compact activeLegendItems={activeLegendItems} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-101"
          drawingType="Construction Floor Plan — Dewatering System"
          scale="NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-102: Pure 3D Perspective (full-bleed 3D rendering)
───────────────────────────────────────────────────────── */
const Pure3DSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  perspectiveDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area — full-bleed 3D */}
      <div className="flex-1 flex border-b-0 min-h-0 relative bg-slate-900">
        {perspectiveDataUrl ? (
          <>
            <img
              src={perspectiveDataUrl}
              alt="3D Perspective"
              className="w-full h-full object-cover"
              style={{ filter: 'contrast(1.05) brightness(1.02)' }}
            />

            {/* Floating labels */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 border border-white/20 rounded-sm">
                <span className="text-[11px] font-black uppercase tracking-widest text-white">
                  3D Perspective — Dewatering System
                </span>
              </div>
              <div className="bg-black/40 backdrop-blur-sm px-2.5 py-0.5 border border-white/10 rounded-sm">
                <span className="text-[8px] text-white/70 font-mono uppercase">
                  Isometric Projection · High-Fidelity Render
                </span>
              </div>
            </div>

            {/* Floating BOM in 3D sheet corner */}
            {showBOM && (
              <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-sm border border-gray-300 p-2 w-[170px] shadow-xl rounded-sm">
                <BOMTable bomResults={bomResults} compact />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-white/40 text-sm">No 3D capture available. Enable 3D view before exporting.</span>
          </div>
        )}
      </div>

      {/* Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-102"
          drawingType="3D Perspective Presentation — Dewatering System"
          scale="3D / NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-103: Multi-View Master (Plan + Section + 3D + BOM + Legend)
───────────────────────────────────────────────────────── */
const MultiViewSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  perspectiveDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
  calculatorInputs,
  calculationResult,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;
  const showSection = exportOptions.includeSectionView !== false;

  const effectiveInputs = calculatorInputs || DEFAULT_DEWATERING_INPUT;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Drawing Grid: Left Column (Plan + Section) | Right Column (3D + BOM + Legend) */}
      <div className="flex-1 flex border-b-0 min-h-0">
        {/* Left Side: 2D Plan View + Section Profile stacked */}
        <div className="flex-[3] flex flex-col divide-y-[2px] divide-black border-r-[2px] border-black min-w-0">
          {/* Upper: 2D Plan View */}
          <div className="flex-1 relative bg-white flex flex-col items-center justify-center overflow-hidden min-h-0">
            <div className="absolute top-1.5 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-800">
                1. Plan View — Dewatering Wellpoint Grid
              </span>
            </div>
            {sitePlanDataUrl ? (
              <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain p-0.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No 2D Plan Available
              </div>
            )}
          </div>

          {/* Lower: Hydraulic Section Profile */}
          {showSection && (
            <div className="flex-1 relative bg-white flex flex-col overflow-hidden min-h-0">
              <div className="absolute top-1.5 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-0.5 border border-gray-300 rounded-sm">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-800">
                  2. Section Profile — Formation Level & Drawdown Cone
                </span>
              </div>
              <div className="w-full h-full p-1 flex items-center justify-center overflow-hidden">
                <DewateringSectionView
                  inputs={effectiveInputs}
                  result={calculationResult}
                  theme="print"
                  hideControls={true}
                  hideMetrics={true}
                  readOnly={true}
                  className="scale-90 origin-center"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: 3D Perspective + BOM + Legend */}
        <div className="flex-1 flex flex-col divide-y-[2px] divide-black min-w-0 bg-white">
          {perspectiveDataUrl && exportOptions.include3DView !== false ? (
            <div className="flex-[2] relative bg-slate-900 flex flex-col overflow-hidden min-h-0">
              <div className="absolute top-1.5 left-2 z-10 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/90">3. 3D Isometric View</span>
              </div>
              <img src={perspectiveDataUrl} alt="3D View" className="w-full h-full object-cover" />
            </div>
          ) : null}

          {showBOM && (
            <div className="flex-[2] p-1.5 overflow-auto">
              <BOMTable bomResults={bomResults} compact />
            </div>
          )}

          {showLegend && (
            <div className="flex-[2] p-1.5 overflow-auto">
              <LegendPanel compact activeLegendItems={activeLegendItems} />
            </div>
          )}
        </div>
      </div>

      {/* ISO Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-103"
          drawingType="Multi-View Master: Plan + Section Profile + 3D Isometric"
          scale="NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Tri-View Legend Component (Civil Engineering Blueprint Style)
───────────────────────────────────────────────────────── */
const TriViewLegend: React.FC = () => {
  const legendItems = [
    {
      label: 'Site boundary',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <line x1="2" y1="6" x2="22" y2="6" stroke="#16a34a" strokeWidth="2.5" />
          <rect x="1" y="4" width="3" height="4" fill="#16a34a" />
          <rect x="20" y="4" width="3" height="4" fill="#16a34a" />
        </svg>
      ),
    },
    {
      label: 'Excavation area',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <rect x="2" y="2" width="20" height="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      ),
    },
    {
      label: 'Header pipe (HDPE)',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <line x1="2" y1="6" x2="22" y2="6" stroke="#0284c7" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: 'Wellpoint',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <circle cx="12" cy="6" r="4.5" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      label: 'Header joint / bend',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <circle cx="12" cy="6" r="4.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      label: 'Dewatering pump',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <rect x="4" y="2" width="14" height="8" rx="1.5" fill="#0284c7" />
          <rect x="18" y="4" width="3" height="4" fill="#0369a1" />
        </svg>
      ),
    },
    {
      label: 'Suction hose',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <line x1="2" y1="6" x2="22" y2="6" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: 'Discharge hose',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <line x1="2" y1="6" x2="18" y2="6" stroke="#f97316" strokeWidth="2.5" />
          <polygon points="17,3 22,6 17,9" fill="#f97316" />
        </svg>
      ),
    },
    {
      label: 'Groundwater level',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <line x1="2" y1="6" x2="22" y2="6" stroke="#0284c7" strokeWidth="2" strokeDasharray="4 2" />
        </svg>
      ),
    },
    {
      label: 'Drawdown curve',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <path d="M2,3 Q12,10 22,7" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3 1 1 1" />
        </svg>
      ),
    },
    {
      label: 'Soil / backfill',
      icon: (
        <svg width="22" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
          <rect x="2" y="2" width="20" height="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
          <circle cx="6" cy="5" r="0.8" fill="#94a3b8" />
          <circle cx="11" cy="7" r="0.8" fill="#94a3b8" />
          <circle cx="16" cy="4" r="0.8" fill="#94a3b8" />
          <circle cx="18" cy="8" r="0.8" fill="#94a3b8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white select-none">
      <div className="bg-[#0b2447] text-white px-2 py-0.5 border-b-[2px] border-black flex items-center justify-between">
        <span className="text-[8.5px] font-black uppercase tracking-wider">LEGEND</span>
        <span className="text-[6.5px] text-blue-200 font-mono">BS 8004</span>
      </div>
      <div className="flex-1 p-1 flex flex-col justify-around text-slate-800">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 py-0.5 min-w-0">
            <div className="w-5 flex items-center justify-center flex-shrink-0">{item.icon}</div>
            <span className="text-[7.5px] font-bold text-slate-900 truncate leading-none">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A1: Civil Engineering Tri-View (Plan + 3D + Section + Tech Data)
───────────────────────────────────────────────────────── */
const TriViewA1Sheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  perspectiveDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  sheetDetails,
  onWidthsChange,
  calculatorInputs,
  calculationResult,
}) => {
  const showTitleBlock = exportOptions.includeTitleBlock !== false;
  const effectiveInputs = calculatorInputs || DEFAULT_DEWATERING_INPUT;
  const L = effectiveInputs.excavationLength || 6.0;
  const W = effectiveInputs.excavationWidth || 6.0;
  const D = effectiveInputs.excavationDepth || 4.0;
  const gwLevel = effectiveInputs.waterTableDepth ?? 2.0;
  const drawdown = effectiveInputs.requiredDrawdown ?? 1.0;
  const spacing = 1.5;
  const totalWp = bomResults?.wellpoints || Math.ceil(((L + W) * 2) / spacing);
  const pumpQty = bomResults?.pumps || 1;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* ── Tier 1: Top Row (2D Plan + 3D Isometric + Legend) ── */}
      <div className="flex-[4.8] flex border-b-[2px] border-black min-h-0">
        {/* 01: DEWATERING PLAN VIEW (2D) */}
        <div className="flex-[4.6] flex flex-col border-r-[2px] border-black min-w-0 relative bg-white">
          <div className="bg-[#0b2447] text-white px-2 py-0.5 flex items-center border-b-[2px] border-black select-none">
            <span className="text-[8.5px] font-black uppercase tracking-wider">
              01 &nbsp; DEWATERING PLAN VIEW (2D)
            </span>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-1 overflow-hidden min-h-0">
            {/* North Arrow Symbol */}
            <div className="absolute top-1.5 left-2 z-10 flex flex-col items-center pointer-events-none select-none">
              <div className="w-5 h-5 rounded-full border border-blue-900 flex items-center justify-center bg-white/90 shadow-xs">
                <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[8px] border-b-blue-900 mb-0.5" />
              </div>
              <span className="text-[7px] font-black text-blue-900 leading-none mt-0.5">N</span>
            </div>
            {sitePlanDataUrl ? (
              <img src={sitePlanDataUrl} alt="2D Site Plan" className="w-full h-full object-contain" />
            ) : (
              <div className="text-gray-400 text-xs font-mono">2D Site Plan Not Available</div>
            )}
          </div>
        </div>

        {/* 02: ISOMETRIC INSTALLATION VIEW (3D) */}
        <div className="flex-[4.2] flex flex-col border-r-[2px] border-black min-w-0 relative bg-white">
          <div className="bg-[#0b2447] text-white px-2 py-0.5 flex items-center border-b-[2px] border-black select-none">
            <span className="text-[8.5px] font-black uppercase tracking-wider">
              02 &nbsp; ISOMETRIC INSTALLATION VIEW (3D)
            </span>
          </div>
          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 bg-white">
            {perspectiveDataUrl ? (
              <img src={perspectiveDataUrl} alt="3D Isometric View" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-mono">
                3D Perspective Not Captured
              </div>
            )}
          </div>
        </div>

        {/* LEGEND */}
        <div className="flex-[2.0] flex flex-col min-w-0 bg-white">
          <TriViewLegend />
        </div>
      </div>

      {/* ── Tier 2: Middle Row (03 SECTION A-A — Full Width) ── */}
      <div className="flex-[5.5] flex flex-col border-b-[2px] border-black min-h-0 relative bg-white">
        <div className="bg-[#0b2447] text-white px-2 py-0.5 flex items-center border-b-[2px] border-black select-none">
          <span className="text-[8.5px] font-black uppercase tracking-wider">
            03 &nbsp; SECTION A-A — GROUND PROFILE &amp; DRAWDOWN
          </span>
        </div>
        <div className="flex-1 w-full h-full p-1 flex items-center justify-center overflow-hidden min-h-0">
          <DewateringSectionView
            inputs={effectiveInputs}
            result={calculationResult}
            theme="print"
            hideControls={true}
            hideMetrics={true}
            readOnly={true}
            className="w-full h-full scale-[0.98] origin-center"
          />
        </div>
      </div>

      {/* ── Tier 3: Technical Data Ribbon ── */}
      <div className="border-b-[2px] border-black bg-white flex items-stretch select-none flex-shrink-0">
        <div className="bg-[#0b2447] text-white px-3 py-1 flex items-center justify-center flex-shrink-0 border-r-[2px] border-black">
          <span className="text-[8px] font-black tracking-widest uppercase">TECHNICAL DATA</span>
        </div>
        <div className="flex-1 grid grid-cols-8 divide-x-[1.5px] divide-black text-center py-0.5 bg-slate-50">
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">EXCAVATION DIMENSIONS</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              {L.toFixed(2)}m × {W.toFixed(2)}m × {D.toFixed(2)}m
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">FORMATION LEVEL</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              -{D.toFixed(2)} m (approx.)
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">GROUNDWATER LEVEL</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              -{gwLevel.toFixed(2)} m (approx.)
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">TARGET DRAWDOWN</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              -{drawdown.toFixed(2)} m
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">WELLPOINT SPACING</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              {spacing.toFixed(2)} m (typ.)
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">TOTAL WELLPOINTS</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              {totalWp} pcs (approx)
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">PUMP QUANTITY</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none">
              {pumpQty} units
            </span>
          </div>
          <div className="px-1 py-0.5 flex flex-col justify-center">
            <span className="text-[6.5px] font-black uppercase text-gray-600 tracking-tight">DISCHARGE POINT</span>
            <span className="text-[7.5px] font-black text-gray-900 mt-0.5 leading-none truncate">
              Safe outlet / drainage
            </span>
          </div>
        </div>
      </div>

      {/* ── Tier 4: ISO Title Block ── */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={sheetDetails?.layoutName || layoutName || "MULTI-VIEW MASTER PLAN + SECTION PROFILE"}
          dateStr={dateStr}
          sheetNo="A1"
          drawingType="DEWATERING SYSTEM LAYOUT"
          scale="NTS"
          revNo="00"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-104: Plan + Section Profile Sheet
───────────────────────────────────────────────────────── */
const PlanSectionSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
  calculatorInputs,
  calculationResult,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  const effectiveInputs = calculatorInputs || DEFAULT_DEWATERING_INPUT;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Drawing Area: Left Plan + Section | Right BOM + Legend */}
      <div className="flex-1 flex border-b-0 min-h-0">
        <div className="flex-[3] flex flex-col divide-y-[2px] divide-black border-r-[2px] border-black min-w-0">
          {/* Plan View */}
          <div className="flex-1 relative bg-white flex flex-col items-center justify-center overflow-hidden min-h-0">
            <div className="absolute top-1.5 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-800">
                Site Plan — 2D Wellpoint Grid Layout
              </span>
            </div>
            {sitePlanDataUrl ? (
              <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain p-0.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No Plan Available
              </div>
            )}
          </div>

          {/* Section Profile */}
          <div className="flex-1 relative bg-white flex flex-col overflow-hidden min-h-0">
            <div className="absolute top-1.5 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-800">
                Hydraulic Section Profile — Drawdown Cone & Filter Tips
              </span>
            </div>
            <div className="w-full h-full p-1.5 flex items-center justify-center overflow-hidden">
              <DewateringSectionView
                inputs={effectiveInputs}
                result={calculationResult}
                theme="print"
                hideControls={true}
                hideMetrics={true}
                readOnly={true}
                className="scale-95 origin-center"
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar: BOM & Legend */}
        <div className="flex-1 flex flex-col divide-y-[2px] divide-black min-w-0 bg-white">
          {showBOM && (
            <div className="flex-1 p-2 overflow-auto">
              <BOMTable bomResults={bomResults} compact />
            </div>
          )}
          {showLegend && (
            <div className="flex-1 p-2 overflow-auto">
              <LegendPanel compact activeLegendItems={activeLegendItems} />
            </div>
          )}
        </div>
      </div>

      {/* Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-104"
          drawingType="Construction Drawings: Site Plan & Cross-Section Profile"
          scale="NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-105: Cross-Section Blueprint (Full Width Section Profile)
───────────────────────────────────────────────────────── */
const PureSectionSheet: React.FC<DrawingSheetPreviewProps> = ({
  companyInfo,
  logoSrc,
  layoutName,
  bomResults,
  dateStr,
  exportOptions,
  activeLegendItems,
  sheetDetails,
  onWidthsChange,
  calculatorInputs,
  calculationResult,
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  const effectiveInputs = calculatorInputs || DEFAULT_DEWATERING_INPUT;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Drawing area */}
      <div className="flex-1 flex border-b-0 min-h-0 relative">
        <div className="flex-1 relative flex flex-col bg-white overflow-hidden">
          {/* Blueprint header info */}
          <div className="absolute top-2 left-3 z-10 flex flex-col gap-1">
            <div className="bg-white/90 border border-gray-300 px-2 py-0.5 inline-block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">
                Section Profile — Dewatering Hydraulic Cross-Section
              </span>
            </div>
            <div className="bg-white/90 border border-gray-200 px-2 py-0.5 inline-block">
              <span className="text-[8px] text-gray-500 font-mono">
                FORMATION LEVEL: -{effectiveInputs.excavationDepth.toFixed(2)}m · STATIC WT: -{effectiveInputs.waterTableDepth.toFixed(2)}m · ALL DIM IN METRES
              </span>
            </div>
          </div>

          {/* Section View */}
          <div className="w-full h-full p-4 flex items-center justify-center overflow-hidden">
            <DewateringSectionView
              inputs={effectiveInputs}
              result={calculationResult}
              theme="print"
              hideControls={true}
              readOnly={true}
              className="w-full h-full"
            />
          </div>

          {/* Floating BOM and Legend */}
          {(showBOM || showLegend) && (
            <div className="absolute bottom-2 right-3 z-10 flex flex-col gap-2 max-h-[85%] overflow-hidden">
              {showBOM && (
                <div className="bg-white/95 backdrop-blur-sm border border-gray-400 p-2 shadow-md rounded-sm overflow-auto max-w-[200px]">
                  <BOMTable bomResults={bomResults} compact />
                </div>
              )}
              {showLegend && (
                <LegendPanel compact activeLegendItems={activeLegendItems} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title Block */}
      {showTitleBlock && (
        <TitleBlock
          companyInfo={companyInfo}
          logoSrc={logoSrc}
          layoutName={layoutName}
          dateStr={dateStr}
          sheetNo="A-105"
          drawingType="Civil Cross-Section: Aquifer Drawdown & Wellpoint Profile"
          scale="NTS"
          sheetDetails={sheetDetails}
          onWidthsChange={onWidthsChange}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Root Component
───────────────────────────────────────────────────────── */
export const DrawingSheetPreview: React.FC<DrawingSheetPreviewProps> = (props) => {
  const { onClose, exportOptions, onExportOptionsChange } = props;
  const { layoutFormat } = exportOptions;

  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [presets, setPresets] = useState<TitleBlockPreset[]>(() => getStoredPresets());

  const [zoomScale, setZoomScale] = useState<number>(0.85);
  const [isAutoFit, setIsAutoFit] = useState(true);

  const calculateFitScale = () => {
    const availableWidth = window.innerWidth - 40;
    const availableHeight = window.innerHeight - 110;
    const sheetWidthPx = 1122.5;
    const sheetHeightPx = 793.7;

    const scaleX = availableWidth / sheetWidthPx;
    const scaleY = availableHeight / sheetHeightPx;
    const fit = Math.min(scaleX, scaleY);
    return Math.max(0.35, Math.min(1.3, Number(fit.toFixed(2))));
  };

  useEffect(() => {
    const fit = calculateFitScale();
    setZoomScale(fit);

    const handleResize = () => {
      if (isAutoFit) {
        setZoomScale(calculateFitScale());
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoFit]);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))));
    setIsAutoFit(false);
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.3, Number((prev - 0.1).toFixed(2))));
    setIsAutoFit(false);
  };

  const handleZoomFit = () => {
    const fit = calculateFitScale();
    setZoomScale(fit);
    setIsAutoFit(true);
  };

  const applyPreset = (preset: TitleBlockPreset) => {
    setSheetDetails((prev) => ({
      ...prev,
      companyName: preset.companyName,
      companyAddress: preset.companyAddress,
      companyPhone: preset.companyPhone,
      companyEmail: preset.companyEmail,
      regNumber: preset.regNumber,
      logoWidth: preset.logoWidth ?? prev.logoWidth,
      companyWidth: preset.companyWidth ?? prev.companyWidth,
      metaWidth: preset.metaWidth ?? prev.metaWidth,
      scale: preset.scale ?? prev.scale,
      revNo: preset.revNo ?? prev.revNo,
    }));
    setShowPresetDropdown(false);
  };

  const saveCurrentAsPreset = (name: string) => {
    const newPreset: TitleBlockPreset = {
      id: `preset-${Date.now()}`,
      name,
      companyName: sheetDetails.companyName,
      companyAddress: sheetDetails.companyAddress,
      companyPhone: sheetDetails.companyPhone,
      companyEmail: sheetDetails.companyEmail,
      regNumber: sheetDetails.regNumber,
      logoWidth: sheetDetails.logoWidth,
      companyWidth: sheetDetails.companyWidth,
      metaWidth: sheetDetails.metaWidth,
      scale: sheetDetails.scale,
      revNo: sheetDetails.revNo,
    };
    const nextPresets = [...presets, newPreset];
    setPresets(nextPresets);
    savePresetsToStorage(nextPresets);
  };

  const deletePreset = (id: string) => {
    const nextPresets = presets.filter((p) => p.id !== id);
    setPresets(nextPresets);
    savePresetsToStorage(nextPresets);
  };

  const [sheetDetails, setSheetDetails] = useState<SheetDetails>({
    companyName: props.companyInfo?.name || 'Dewatering Construction Ltd',
    companyAddress: props.companyInfo?.address || 'Lagos, Nigeria',
    companyPhone: props.companyInfo?.phone || '+234 903 000 2182',
    companyEmail: props.companyInfo?.email || 'info@dewaterconstruct.com',
    regNumber: props.companyInfo?.regNumber || 'RC-141299',
    layoutName: props.layoutName || 'Dewatering System Layout',
    dateStr: props.dateStr || new Date().toLocaleDateString(),
    sheetNo: layoutFormat === 'tri-view-a1' ? 'A1'
      : layoutFormat === 'combined' ? 'A-100'
      : layoutFormat === 'pure-2d' ? 'A-101'
      : layoutFormat === 'pure-3d' ? 'A-102'
      : layoutFormat === 'multi-view' ? 'A-103'
      : layoutFormat === 'plan-section' ? 'A-104'
      : 'A-105',
    scale: 'NTS',
    revNo: '00',
    marginSize: '3mm',
  });

  const sheetLabel =
    layoutFormat === 'tri-view-a1' ? 'A1 — Civil Engineering Tri-View (Plan + 3D + Section)'
    : layoutFormat === 'combined' ? 'A-100 — Combined Sheet'
    : layoutFormat === 'pure-2d' ? 'A-101 — 2D Floor Plan'
    : layoutFormat === 'pure-3d' ? 'A-102 — 3D Perspective'
    : layoutFormat === 'multi-view' ? 'A-103 — Multi-View (Plan + Section + 3D)'
    : layoutFormat === 'plan-section' ? 'A-104 — Plan + Section Profile'
    : 'A-105 — Cross-Section Blueprint';

  const handlePrint = () => window.print();

  const toggleOption = (key: keyof ExportOptions) => {
    if (onExportOptionsChange) {
      if (key === 'colorMode') {
        onExportOptionsChange({
          ...exportOptions,
          colorMode: exportOptions.colorMode === 'bw' ? 'color' : 'bw',
        });
      } else {
        onExportOptionsChange({
          ...exportOptions,
          [key]: !exportOptions[key],
        });
      }
    }
  };

  const handleTitleBlockWidthsChange = (widths: { logoWidth?: number; companyWidth?: number; metaWidth?: number }) => {
    setSheetDetails(prev => ({
      ...prev,
      ...widths,
    }));
  };

  const updatedProps = {
    ...props,
    sheetDetails,
    onWidthsChange: handleTitleBlockWidthsChange,
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-600/95 overflow-auto print:bg-white print:overflow-visible flex flex-col items-center justify-center p-6 print:p-0 print-area-modal">
      {/* Non-print interactive toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl px-4 py-2 border border-gray-200 print:hidden z-[120] max-w-[98vw]">
        {/* Layout Format Selector */}
        <select
          value={layoutFormat}
          onChange={(e) => {
            const nextFmt = e.target.value as ExportOptions['layoutFormat'];
            if (onExportOptionsChange) {
              onExportOptionsChange({ ...exportOptions, layoutFormat: nextFmt });
            }
            setSheetDetails(prev => ({
              ...prev,
              sheetNo: nextFmt === 'tri-view-a1' ? 'A1'
                : nextFmt === 'combined' ? 'A-100'
                : nextFmt === 'pure-2d' ? 'A-101'
                : nextFmt === 'pure-3d' ? 'A-102'
                : nextFmt === 'multi-view' ? 'A-103'
                : nextFmt === 'plan-section' ? 'A-104'
                : 'A-105'
            }));
          }}
          className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
        >
          <option value="tri-view-a1">A1: Civil Engineering Tri-View (2D + 3D + Section)</option>
          <option value="multi-view">A-103: Multi-View (Plan + Section + 3D)</option>
          <option value="plan-section">A-104: Plan + Section Profile</option>
          <option value="pure-section">A-105: Cross-Section Blueprint</option>
          <option value="combined">A-100: Combined Sheet</option>
          <option value="pure-2d">A-101: 2D Floor Plan</option>
          <option value="pure-3d">A-102: 3D Perspective</option>
        </select>

        <div className="w-px h-5 bg-gray-300" />
        
        {/* View Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDisplayOptions(!showDisplayOptions)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
            title="Toggle Sheet View Options"
          >
            <Eye size={13} className="text-blue-600" /> View Options
          </button>

          {showDisplayOptions && (
            <div className="absolute top-full mt-2.5 left-0 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 p-2.5 z-[150] text-xs space-y-1">
              <div className="font-bold text-[10px] uppercase text-gray-500 px-1 pb-1 flex items-center justify-between border-b mb-1">
                <span>Sheet Elements</span>
                <button onClick={() => setShowDisplayOptions(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              </div>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>Section Profile</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeSectionView !== false}
                  onChange={() => toggleOption('includeSectionView')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>BOM Table</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeBOM !== false}
                  onChange={() => toggleOption('includeBOM')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>Legend Panel</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeLegend !== false}
                  onChange={() => toggleOption('includeLegend')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-blue-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>ISO Title Block</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeTitleBlock !== false}
                  onChange={() => toggleOption('includeTitleBlock')}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer text-xs font-medium text-gray-700 select-none border-t pt-1.5 mt-1">
                <span>Black & White Mode</span>
                <input
                  type="checkbox"
                  checked={exportOptions.colorMode === 'bw'}
                  onChange={() => toggleOption('colorMode')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          )}
        </div>

          {/* Margin selector */}
          <div className="flex items-center gap-1 text-xs font-medium bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <span className="text-gray-500 font-semibold text-[11px]">Margin:</span>
            <select
              value={sheetDetails.marginSize || '3mm'}
              onChange={(e) => setSheetDetails({ ...sheetDetails, marginSize: e.target.value })}
              className="bg-transparent font-bold text-gray-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value="1mm">1mm (Ultra-Narrow)</option>
              <option value="3mm">3mm (Narrow)</option>
              <option value="5mm">5mm (Compact)</option>
              <option value="8mm">8mm (Medium)</option>
              <option value="10mm">10mm (Standard ISO)</option>
            </select>
          </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 text-xs font-semibold">
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-white rounded text-gray-700 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={handleZoomFit}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${isAutoFit ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-white text-gray-700 font-semibold'}`}
            title="Click to Zoom to Fit Screen"
          >
            {Math.round(zoomScale * 100)}% {isAutoFit ? '(Fit)' : ''}
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-white rounded text-gray-700 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={handleZoomFit}
            className="p-1 hover:bg-white rounded text-gray-700 transition-colors ml-0.5"
            title="Reset Zoom to Fit Screen"
          >
            <Maximize2 size={12} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresetDropdown(!showPresetDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
            title="Load or Save Title Block Presets"
          >
            <Bookmark size={13} className="text-indigo-600" /> Presets
          </button>

          {showPresetDropdown && (
            <div className="absolute top-full mt-2.5 right-0 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[150] text-xs">
              <div className="font-bold text-[10px] uppercase text-gray-500 px-1 pb-1.5 flex items-center justify-between border-b">
                <span className="flex items-center gap-1 text-indigo-700">
                  <Bookmark size={12} /> Title Block Presets
                </span>
                <button onClick={() => setShowPresetDropdown(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto my-2 pr-0.5">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 group cursor-pointer border border-gray-100 hover:border-indigo-200 transition-colors"
                    onClick={() => applyPreset(preset)}
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="font-bold text-gray-800 truncate text-[11.5px]">{preset.name}</div>
                      <div className="text-[9.5px] text-gray-500 truncate">{preset.companyName}</div>
                    </div>
                    {!preset.id.startsWith('default-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(preset.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                        title="Delete Preset"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 mt-1">
                <button
                  onClick={() => {
                    const name = prompt('Enter a name for this Title Block preset:');
                    if (name && name.trim()) {
                      saveCurrentAsPreset(name.trim());
                    }
                  }}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Save size={13} /> Save Current as Preset
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Edit details button */}
        <button
          onClick={() => setShowEditDrawer(!showEditDrawer)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
            showEditDrawer ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Edit3 size={13} /> Edit Title Block
        </button>

        <div className="w-px h-5 bg-gray-300" />

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
        >
          <Printer size={13} /> Print / Save PDF
        </button>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-xs font-semibold rounded-md border border-gray-300 hover:bg-gray-100 transition-colors whitespace-nowrap"
        >
          <X size={13} /> Close
        </button>
      </div>

      {/* Edit Title Block Drawer/Modal */}
      {showEditDrawer && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[420px] max-w-[95vw] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 print:hidden space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Settings size={14} className="text-indigo-600" /> Customize Sheet Details
            </h4>
            <button onClick={() => setShowEditDrawer(false)} className="text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          </div>

          {/* Quick Presets Selector in Edit Drawer */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                <Bookmark size={12} className="text-indigo-600" /> Presets
              </span>
              <button
                onClick={() => {
                  const name = prompt('Enter a name for this Title Block preset:');
                  if (name && name.trim()) {
                    saveCurrentAsPreset(name.trim());
                  }
                }}
                className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5"
              >
                <Save size={10} /> Save Current
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="px-2 py-0.5 bg-white border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-800 text-[10.5px] font-semibold rounded transition-colors text-left truncate max-w-[170px]"
                  title={`Apply ${p.name}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Drawing Title</label>
              <input
                type="text"
                value={sheetDetails.layoutName}
                onChange={(e) => setSheetDetails({ ...sheetDetails, layoutName: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Company Name</label>
              <input
                type="text"
                value={sheetDetails.companyName}
                onChange={(e) => setSheetDetails({ ...sheetDetails, companyName: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Company Address</label>
              <input
                type="text"
                value={sheetDetails.companyAddress}
                onChange={(e) => setSheetDetails({ ...sheetDetails, companyAddress: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Phone</label>
              <input
                type="text"
                value={sheetDetails.companyPhone}
                onChange={(e) => setSheetDetails({ ...sheetDetails, companyPhone: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Email</label>
              <input
                type="text"
                value={sheetDetails.companyEmail}
                onChange={(e) => setSheetDetails({ ...sheetDetails, companyEmail: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Sheet Number</label>
              <input
                type="text"
                value={sheetDetails.sheetNo}
                onChange={(e) => setSheetDetails({ ...sheetDetails, sheetNo: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Revision</label>
              <input
                type="text"
                value={sheetDetails.revNo}
                onChange={(e) => setSheetDetails({ ...sheetDetails, revNo: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Scale</label>
              <input
                type="text"
                value={sheetDetails.scale}
                onChange={(e) => setSheetDetails({ ...sheetDetails, scale: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">Date</label>
              <input
                type="text"
                value={sheetDetails.dateStr}
                onChange={(e) => setSheetDetails({ ...sheetDetails, dateStr: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-indigo-700 uppercase">Page Margin (Outer Border)</label>
              <select
                value={sheetDetails.marginSize || '3mm'}
                onChange={(e) => setSheetDetails({ ...sheetDetails, marginSize: e.target.value })}
                className="w-full border rounded px-2 py-1 mt-0.5 focus:ring-1 focus:ring-indigo-500 text-xs font-medium bg-white"
              >
                <option value="3mm">Narrow (3mm) — Maximum Drawing Area</option>
                <option value="5mm">Compact (5mm)</option>
                <option value="10mm">Standard ISO (10mm)</option>
                <option value="1mm">Ultra-Narrow (1mm)</option>
              </select>
            </div>

            {/* Section Widths Adjuster */}
            <div className="col-span-2 border-t pt-2.5 mt-1">
              <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">
                Column Widths (px) — Or drag divider lines directly
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] font-semibold text-gray-500">Logo Width</span>
                  <input
                    type="number"
                    value={sheetDetails.logoWidth ?? 110}
                    onChange={(e) => setSheetDetails({ ...sheetDetails, logoWidth: Number(e.target.value) })}
                    className="w-full border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-gray-500">Company Info</span>
                  <input
                    type="number"
                    value={sheetDetails.companyWidth ?? 250}
                    onChange={(e) => setSheetDetails({ ...sheetDetails, companyWidth: Number(e.target.value) })}
                    className="w-full border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-gray-500">Metadata</span>
                  <input
                    type="number"
                    value={sheetDetails.metaWidth ?? 170}
                    onChange={(e) => setSheetDetails({ ...sheetDetails, metaWidth: Number(e.target.value) })}
                    className="w-full border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEditDrawer(false)}
            className="w-full mt-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1 transition-colors"
          >
            <Check size={14} /> Apply Edits to Sheet
          </button>
        </div>
      )}

      {/* Scaled sheet container for Zoom to Fit & Manual Zoom */}
      <div
        className="transition-transform duration-150 ease-out origin-center flex flex-col items-center justify-center my-auto print-sheet-wrapper"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'center center',
          marginTop: '36px',
        }}
      >
        <div
          className={`bg-white shadow-2xl print:shadow-none print:m-0 relative flex flex-col ${exportOptions.colorMode === 'bw' ? 'grayscale' : ''} print-sheet-paper`}
          style={{
            width: '297mm',
            minWidth: '297mm',
            height: '210mm',
            minHeight: '210mm',
            aspectRatio: '1.414 / 1',
            border: '1px solid #ccc',
          }}
        >
          {/* Outer ISO border — customizable margin (default narrow 3mm) */}
          <div
            className="absolute border-[2px] border-black pointer-events-none z-20 transition-all duration-150"
            style={{ inset: sheetDetails.marginSize || '3mm' }}
          />

          {/* Inner sheet content with margin matching border */}
          <div
            className="absolute flex flex-col bg-white transition-all duration-150"
            style={{ inset: sheetDetails.marginSize || '3mm' }}
          >
            {layoutFormat === 'tri-view-a1' && <TriViewA1Sheet {...updatedProps} />}
            {layoutFormat === 'combined' && <CombinedSheet {...updatedProps} />}
            {layoutFormat === 'pure-2d' && <Pure2DSheet {...updatedProps} />}
            {layoutFormat === 'pure-3d' && <Pure3DSheet {...updatedProps} />}
            {layoutFormat === 'multi-view' && <MultiViewSheet {...updatedProps} />}
            {layoutFormat === 'plan-section' && <PlanSectionSheet {...updatedProps} />}
            {layoutFormat === 'pure-section' && <PureSectionSheet {...updatedProps} />}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .print-area-modal,
          .print-area-modal * {
            visibility: visible;
          }
          .print-area-modal {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 9999999 !important;
            overflow: hidden !important;
            display: flex !important;
          }
          .print-sheet-wrapper {
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            display: flex !important;
          }
          .print-sheet-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
          }
          .print\:hidden,
          .print\:hidden * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
};
