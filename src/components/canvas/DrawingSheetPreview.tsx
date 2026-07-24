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

export interface ExportOptions {
  layoutFormat: 'combined' | 'pure-2d' | 'pure-3d';
  includeSitePlan: boolean;
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
}

const LEGEND_ITEMS = [
  { color: '#0369a1', label: 'Header Pipe (6m)' },
  { color: '#38bdf8', label: 'Wellpoint Riser' },
  { color: '#0ea5e9', label: 'Dewatering Pump' },
  { color: '#f59e0b', label: 'Elbow Connector' },
  { color: '#10b981', label: 'Tee Connector' },
  { color: '#eab308', label: 'Suction Hose' },
  { color: '#2563eb', label: 'Discharge Hose' },
  { color: '#fca5a5', label: 'Excavation Area' },
  { color: '#93c5fd', label: 'Site Boundary' },
];

/* ─────────────────────────────────────────────────────────────
   Shared sub-components
───────────────────────────────────────────────────────────── */

const BOMTable: React.FC<{ bomResults: DewateringSimulationResult; compact?: boolean }> = ({
  bomResults,
  compact = false,
}) => {
  const rows = [
    ['Header Pipes (6 m)', bomResults.headers],
    ['Dewatering Pumps', bomResults.pumps],
    ['Wellpoints', bomResults.wellpoints],
    ['Swing-Joint Connectors', bomResults.connectors],
    ['Bauer Clips (2″)', bomResults.clips],
    ['Pipe Elbows', bomResults.elbows],
    ['Pipe Tees', bomResults.tees],
  ];

  const textSizes = compact
    ? { heading: 'text-[9px]', row: 'text-[8px]', footer: 'text-[7px]', py: 'py-0.5' }
    : { heading: 'text-[11px]', row: 'text-[10px]', footer: 'text-[9px]', py: 'py-1' };

  return (
    <div className="flex flex-col h-full">
      <h3
        className={`${textSizes.heading} font-bold uppercase tracking-wider text-center border-b border-black pb-0.5 mb-1`}
      >
        Bill of Materials
      </h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={`border-b border-black font-bold ${textSizes.row}`}>
            <th className="py-0.5">Item</th>
            <th className="py-0.5 text-right">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map(([label, qty]) => (
            <tr key={String(label)} className={textSizes.row}>
              <td className={textSizes.py}>{label}</td>
              <td className={`text-right font-mono font-bold ${textSizes.py}`}>{qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`mt-auto pt-0.5 ${textSizes.footer} italic text-gray-500 border-t border-gray-300 pt-1`}>
        Total Pipeline Length: <strong>{bomResults.totalLengthMeters.toFixed(1)} m</strong>
      </div>
    </div>
  );
};

const LegendPanel: React.FC<{ compact?: boolean; activeLegendItems?: string[] }> = ({ compact = false, activeLegendItems }) => {
  const textSize = compact ? 'text-[8px]' : 'text-[10px]';
  const headingSize = compact ? 'text-[9px]' : 'text-[11px]';
  const swatchSize = compact ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className="flex flex-col h-full">
      <h3
        className={`${headingSize} font-bold uppercase tracking-wider text-center border-b border-black pb-0.5 mb-1`}
      >
        Drawing Legend
      </h3>
      <div className={`grid grid-cols-1 gap-y-0.5 ${textSize}`}>
        {LEGEND_ITEMS.filter(item => !activeLegendItems || activeLegendItems.includes(item.label.toUpperCase())).map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block ${swatchSize} rounded-sm border border-gray-400 flex-shrink-0`}
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
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
          <div className={`${hasRightColumn ? 'flex-[3] border-r-[2px] border-black' : 'flex-1'} relative flex flex-col bg-slate-50 overflow-hidden`}>
            <div className="absolute top-1.5 left-2 z-10 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">Site Plan — Plan View</span>
            </div>
            <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain p-2" />
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
                  <div className="bg-white/95 backdrop-blur-sm border border-gray-400 p-2 shadow-md rounded-sm">
                    <LegendPanel compact activeLegendItems={activeLegendItems} />
                  </div>
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
    sheetNo: layoutFormat === 'combined' ? 'A-100' : layoutFormat === 'pure-2d' ? 'A-101' : 'A-102',
    scale: 'NTS',
    revNo: '00',
    marginSize: '3mm',
  });

  const sheetLabel =
    layoutFormat === 'combined' ? 'A-100 — Combined Sheet'
    : layoutFormat === 'pure-2d' ? 'A-101 — 2D Floor Plan'
    : 'A-102 — 3D Perspective';

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
        <div className="text-xs font-bold text-gray-700 uppercase tracking-widest whitespace-nowrap">{sheetLabel}</div>
        <div className="w-px h-5 bg-gray-300" />
        
        {/* View Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDisplayOptions(!showDisplayOptions)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
            title="Toggle Sheet View Options"
          >
            <Eye size={13} className="text-indigo-600" /> View Options
          </button>

          {showDisplayOptions && (
            <div className="absolute top-full mt-2.5 left-0 w-52 bg-white rounded-xl shadow-2xl border border-gray-200 p-2.5 z-[150] text-xs space-y-1">
              <div className="font-bold text-[10px] uppercase text-gray-500 px-1 pb-1 flex items-center justify-between border-b mb-1">
                <span>Sheet Elements</span>
                <button onClick={() => setShowDisplayOptions(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              </div>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>BOM Table</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeBOM !== false}
                  onChange={() => toggleOption('includeBOM')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>Legend Panel</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeLegend !== false}
                  onChange={() => toggleOption('includeLegend')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <span>ISO Title Block</span>
                <input
                  type="checkbox"
                  checked={exportOptions.includeTitleBlock !== false}
                  onChange={() => toggleOption('includeTitleBlock')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
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
            {layoutFormat === 'combined' && <CombinedSheet {...updatedProps} />}
            {layoutFormat === 'pure-2d' && <Pure2DSheet {...updatedProps} />}
            {layoutFormat === 'pure-3d' && <Pure3DSheet {...updatedProps} />}
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
