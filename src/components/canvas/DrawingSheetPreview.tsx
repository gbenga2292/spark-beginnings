import React, { useState } from 'react';
import { Printer, X, Layers, Edit3, Settings, Check } from 'lucide-react';
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

  return (
    <div className="h-[90px] flex border-t-[2px] border-black divide-x-[2px] divide-black bg-white text-black flex-shrink-0">
      {/* Logo */}
      <div className="w-[120px] flex items-center justify-center p-1.5 flex-shrink-0">
        {logoSrc ? (
          <img src={logoSrc} alt="Company Logo" className="max-h-[72px] max-w-full object-contain" />
        ) : (
          <div className="text-[10px] font-black uppercase text-center leading-tight opacity-60">
            <Layers size={22} className="mx-auto mb-0.5 opacity-50" />
            {compName.split(' ').slice(0, 2).join('\n')}
          </div>
        )}
      </div>

      {/* Company info */}
      <div className="w-[170px] px-2 py-1 flex flex-col justify-center flex-shrink-0 min-w-0">
        <div className="font-bold text-[11px] uppercase leading-tight mb-0.5 truncate">{compName}</div>
        <div className="text-[8.5px] text-gray-600 truncate">{compAddress}</div>
        <div className="text-[8.5px] text-gray-600 truncate">
          {compPhone} {compEmail ? `· ${compEmail}` : ''}
        </div>
        <div className="text-[8px] text-gray-400 mt-0.5">{regNum}</div>
      </div>

      {/* Title & drawing type */}
      <div className="flex-1 px-3 py-1 flex flex-col justify-center min-w-0">
        <div className="text-[9px] font-bold uppercase text-gray-500 tracking-widest truncate">{drawingType}</div>
        <div className="font-black text-[14px] uppercase leading-tight mt-0.5 truncate">
          {title || 'Dewatering System Layout'}
        </div>
        <div className="text-[9px] text-gray-500 mt-auto">Dewatering Construction Drawing</div>
      </div>

      {/* Drawing metadata cells */}
      <div className="w-[140px] flex flex-col flex-shrink-0 divide-y-[2px] divide-black">
        <div className="flex flex-1 divide-x-[2px] divide-black">
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Date</span>
            <span className="text-[9.5px] font-bold leading-tight truncate">{date}</span>
          </div>
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Scale</span>
            <span className="text-[9.5px] font-bold leading-tight truncate">{scaleVal}</span>
          </div>
          <div className="flex-1 px-1 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[7.5px] font-bold uppercase text-gray-500">Rev.</span>
            <span className="text-[9.5px] font-bold leading-tight truncate">{rev}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <span className="text-[7.5px] font-bold uppercase text-gray-500">Sheet No.</span>
          <span className="text-[16px] font-black leading-tight truncate">{sheetNum}</span>
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
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area */}
      <div className={`flex-1 flex ${showTitleBlock ? 'border-b-[2px] border-black' : 'border-b-0'} min-h-0`}>
        {/* Site Plan — takes ~75% width */}
        {sitePlanDataUrl && (
          <div className="flex-[3] border-r-[2px] border-black relative flex flex-col bg-slate-50">
            <div className="absolute top-1.5 left-2 z-10 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 border border-gray-300 rounded-sm">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">Site Plan — Plan View</span>
            </div>
            <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Right column: 3D + BOM + Legend */}
        <div className="flex-1 flex flex-col divide-y-[2px] divide-black min-w-0">
          {/* 3D Perspective */}
          {perspectiveDataUrl && (
            <div className="flex-[3] relative bg-slate-900 flex flex-col">
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
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showLegend = exportOptions.includeLegend !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area */}
      <div className={`flex-1 flex ${showTitleBlock ? 'border-b-[2px] border-black' : 'border-b-0'} min-h-0`}>
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
}) => {
  const showBOM = exportOptions.includeBOM !== false;
  const showTitleBlock = exportOptions.includeTitleBlock !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Drawing area — full-bleed 3D */}
      <div className={`flex-1 flex ${showTitleBlock ? 'border-b-[2px] border-black' : 'border-b-0'} min-h-0 relative bg-slate-900`}>
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

  const updatedProps = {
    ...props,
    sheetDetails,
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-600 overflow-auto print:bg-white print:overflow-visible flex flex-col items-center py-6 print:py-0 print-area">
      {/* Non-print interactive toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl px-4 py-2 border border-gray-200 print:hidden z-50 max-w-[95vw] overflow-x-auto">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-widest whitespace-nowrap">{sheetLabel}</div>
        <div className="w-px h-5 bg-gray-300" />
        
        {/* Toggle options */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <input
              type="checkbox"
              checked={exportOptions.includeBOM !== false}
              onChange={() => toggleOption('includeBOM')}
              className="rounded text-slate-900 focus:ring-slate-500"
            />
            <span>BOM</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <input
              type="checkbox"
              checked={exportOptions.includeLegend !== false}
              onChange={() => toggleOption('includeLegend')}
              className="rounded text-slate-900 focus:ring-slate-500"
            />
            <span>Legend</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <input
              type="checkbox"
              checked={exportOptions.includeTitleBlock !== false}
              onChange={() => toggleOption('includeTitleBlock')}
              className="rounded text-slate-900 focus:ring-slate-500"
            />
            <span>Title Block</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <input
              type="checkbox"
              checked={exportOptions.colorMode === 'bw'}
              onChange={() => toggleOption('colorMode')}
              className="rounded text-slate-900 focus:ring-slate-500"
            />
            <span>B&W</span>
          </label>
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
          </div>

          <button
            onClick={() => setShowEditDrawer(false)}
            className="w-full mt-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1 transition-colors"
          >
            <Check size={14} /> Apply Edits to Sheet
          </button>
        </div>
      )}

      {/* The A3/A1 ISO Drawing Sheet */}
      <div
        className={`bg-white shadow-2xl print:shadow-none print:m-0 relative flex flex-col ${exportOptions.colorMode === 'bw' ? 'grayscale' : ''}`}
        style={{
          width: '297mm',
          minWidth: '297mm',
          aspectRatio: '1.414 / 1',
          marginTop: '52px',
          border: '1px solid #ccc',
        }}
      >
        {/* Outer ISO border */}
        <div className="absolute inset-[5mm] border-[2px] border-black pointer-events-none z-20" />

        {/* Inner sheet content with margin matching ISO border */}
        <div className="absolute inset-[5mm] flex flex-col bg-white">
          {layoutFormat === 'combined' && <CombinedSheet {...updatedProps} />}
          {layoutFormat === 'pure-2d' && <Pure2DSheet {...updatedProps} />}
          {layoutFormat === 'pure-3d' && <Pure3DSheet {...updatedProps} />}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 100vh !important;
          }
        }
      `}</style>
    </div>
  );
};
