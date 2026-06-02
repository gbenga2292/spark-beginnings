import React from 'react';
import { Printer, X, Layers } from 'lucide-react';
import { DewateringSimulationResult } from '../../utils/simulationLogic';

export interface ExportOptions {
  layoutFormat: 'combined' | 'pure-2d' | 'pure-3d';
  includeSitePlan: boolean;
  include3DView: boolean;
  includeBOM: boolean;
  includeLegend: boolean;
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
      <table className="w-full border-collapse text-left leading-tight flex-1">
        <thead>
          <tr className="border-b border-black bg-gray-100">
            <th className={`${textSizes.row} ${textSizes.py} pl-1 font-bold`}>Item</th>
            <th className={`${textSizes.row} ${textSizes.py} pr-1 text-right font-bold`}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, qty]) => (
            <tr key={label as string} className="border-b border-gray-200">
              <td className={`${textSizes.row} ${textSizes.py} pl-1`}>{label}</td>
              <td className={`${textSizes.row} ${textSizes.py} pr-1 text-right font-semibold`}>{qty}</td>
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

const LegendPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
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
        {LEGEND_ITEMS.map(item => (
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
}) => (
  <div className="h-[90px] flex border-t-[2px] border-black divide-x-[2px] divide-black bg-white text-black">
    {/* Logo */}
    <div className="w-[120px] flex items-center justify-center p-1.5 flex-shrink-0">
      {logoSrc ? (
        <img src={logoSrc} alt="Company Logo" className="max-h-[72px] max-w-full object-contain" />
      ) : (
        <div className="text-[10px] font-black uppercase text-center leading-tight opacity-60">
          <Layers size={22} className="mx-auto mb-0.5 opacity-50" />
          {companyInfo.name.split(' ').slice(0, 2).join('\n')}
        </div>
      )}
    </div>

    {/* Company info */}
    <div className="w-[170px] px-2 py-1 flex flex-col justify-center flex-shrink-0">
      <div className="font-bold text-[11px] uppercase leading-tight mb-0.5">{companyInfo.name}</div>
      <div className="text-[8.5px] text-gray-600">{companyInfo.address}</div>
      <div className="text-[8.5px] text-gray-600">
        {companyInfo.phone} · {companyInfo.email}
      </div>
      <div className="text-[8px] text-gray-400 mt-0.5">{companyInfo.regNumber}</div>
    </div>

    {/* Title & drawing type */}
    <div className="flex-1 px-3 py-1 flex flex-col justify-center">
      <div className="text-[9px] font-bold uppercase text-gray-500 tracking-widest">{drawingType}</div>
      <div className="font-black text-[14px] uppercase leading-tight mt-0.5">
        {layoutName || 'Dewatering System Layout'}
      </div>
      <div className="text-[9px] text-gray-500 mt-auto">Dewatering Construction Drawing</div>
    </div>

    {/* Drawing metadata cells */}
    <div className="w-[140px] flex flex-col flex-shrink-0 divide-y-[2px] divide-black">
      <div className="flex flex-1 divide-x-[2px] divide-black">
        <div className="flex-1 px-1 py-0.5 flex flex-col justify-center">
          <span className="text-[7.5px] font-bold uppercase text-gray-500">Date</span>
          <span className="text-[10px] font-bold leading-tight">{dateStr}</span>
        </div>
        <div className="flex-1 px-1 py-0.5 flex flex-col justify-center">
          <span className="text-[7.5px] font-bold uppercase text-gray-500">Scale</span>
          <span className="text-[10px] font-bold leading-tight">{scale}</span>
        </div>
        <div className="flex-1 px-1 py-0.5 flex flex-col justify-center">
          <span className="text-[7.5px] font-bold uppercase text-gray-500">Rev.</span>
          <span className="text-[10px] font-bold leading-tight">{revNo}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <span className="text-[7.5px] font-bold uppercase text-gray-500">Sheet No.</span>
        <span className="text-[18px] font-black leading-tight">{sheetNo}</span>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   SHEET A-100: Combined (Site Plan + 3D + BOM + Legend)
───────────────────────────────────────────────────────── */
const CombinedSheet: React.FC<Omit<DrawingSheetPreviewProps, 'exportOptions'>> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  perspectiveDataUrl,
  bomResults,
  dateStr,
}) => (
  <div className="flex-1 flex flex-col">
    {/* Drawing area */}
    <div className="flex-1 flex border-b-[2px] border-black min-h-0">
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
        <div className="flex-[2] p-2">
          <BOMTable bomResults={bomResults} compact />
        </div>

        {/* Legend */}
        <div className="flex-[2] p-2">
          <LegendPanel compact />
        </div>
      </div>
    </div>

    {/* Title Block */}
    <TitleBlock
      companyInfo={companyInfo}
      logoSrc={logoSrc}
      layoutName={layoutName}
      dateStr={dateStr}
      sheetNo="A-100"
      drawingType="Combined Site Plan + 3D Perspective"
      scale="NTS"
    />
  </div>
);

/* ─────────────────────────────────────────────────────────────
   SHEET A-101: Pure 2D Floor Plan (full-width CAD blueprint)
───────────────────────────────────────────────────────── */
const Pure2DSheet: React.FC<Omit<DrawingSheetPreviewProps, 'exportOptions'>> = ({
  companyInfo,
  logoSrc,
  layoutName,
  sitePlanDataUrl,
  bomResults,
  dateStr,
}) => {
  const showBOM = true;
  const showLegend = true;

  return (
    <div className="flex-1 flex flex-col">
      {/* Drawing area */}
      <div className="flex-1 flex border-b-[2px] border-black min-h-0">
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
                  DRAWING No: {layoutName ? layoutName.substring(0, 12).toUpperCase() : 'DW-001'} · SCALE: NTS ·
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
            <div className="absolute bottom-2 right-3 z-10 bg-white/90 border border-gray-300 p-1.5 flex flex-col items-center">
              <svg width="24" height="32" viewBox="0 0 24 32">
                <polygon points="12,0 4,24 12,20 20,24" fill="black" />
                <polygon points="12,0 20,24 12,20" fill="white" />
                <text x="12" y="30" textAnchor="middle" fontSize="8" fontWeight="bold">N</text>
              </svg>
            </div>
          </div>
        )}

        {/* Right column: BOM + Legend stacked */}
        {(showBOM || showLegend) && (
          <div className="w-[160px] flex flex-col divide-y-[2px] divide-black border-l-[2px] border-black flex-shrink-0">
            {showBOM && (
              <div className="flex-1 p-2 min-h-0 overflow-hidden">
                <BOMTable bomResults={bomResults} compact />
              </div>
            )}
            {showLegend && (
              <div className="flex-1 p-2 min-h-0 overflow-hidden">
                <LegendPanel compact />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title Block */}
      <TitleBlock
        companyInfo={companyInfo}
        logoSrc={logoSrc}
        layoutName={layoutName}
        dateStr={dateStr}
        sheetNo="A-101"
        drawingType="Construction Floor Plan — Dewatering System"
        scale="NTS"
      />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SHEET A-102: Pure 3D Perspective (full-bleed 3D rendering)
───────────────────────────────────────────────────────── */
const Pure3DSheet: React.FC<Omit<DrawingSheetPreviewProps, 'exportOptions'>> = ({
  companyInfo,
  logoSrc,
  layoutName,
  perspectiveDataUrl,
  bomResults,
  dateStr,
}) => (
  <div className="flex-1 flex flex-col">
    {/* Drawing area — full-bleed 3D */}
    <div className="flex-1 flex border-b-[2px] border-black min-h-0 relative bg-slate-900">
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
          <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-sm border border-gray-300 p-2 w-[170px] shadow-xl">
            <BOMTable bomResults={bomResults} compact />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-white/40 text-sm">No 3D capture available. Enable 3D view before exporting.</span>
        </div>
      )}
    </div>

    {/* Title Block */}
    <TitleBlock
      companyInfo={companyInfo}
      logoSrc={logoSrc}
      layoutName={layoutName}
      dateStr={dateStr}
      sheetNo="A-102"
      drawingType="3D Perspective Presentation — Dewatering System"
      scale="3D / NTS"
    />
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Root Component
───────────────────────────────────────────────────────── */
export const DrawingSheetPreview: React.FC<DrawingSheetPreviewProps> = (props) => {
  const { onClose, exportOptions } = props;
  const { layoutFormat } = exportOptions;

  const sheetLabel =
    layoutFormat === 'combined' ? 'A-100 — Combined Sheet'
    : layoutFormat === 'pure-2d' ? 'A-101 — 2D Floor Plan'
    : 'A-102 — 3D Perspective';

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[100] bg-gray-600 overflow-auto print:bg-white print:overflow-visible flex flex-col items-center py-6 print:py-0">
      {/* Non-print toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white rounded-xl shadow-xl px-4 py-2.5 border border-gray-200 print:hidden z-50">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{sheetLabel}</div>
        <div className="w-px h-5 bg-gray-200" />
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-700 transition-colors"
        >
          <Printer size={14} /> Print / Save PDF
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <X size={14} /> Close
        </button>
      </div>

      {/* The A3/A1 ISO Drawing Sheet */}
      <div
        className="bg-white shadow-2xl print:shadow-none print:m-0 relative flex flex-col"
        style={{
          width: '420mm',
          minWidth: '420mm',
          aspectRatio: '1.414 / 1',
          marginTop: '52px',
          border: '1px solid #ccc',
        }}
      >
        {/* Outer ISO border */}
        <div className="absolute inset-[8mm] border-[2px] border-black pointer-events-none z-20" />

        {/* Inner sheet content with margin matching ISO border */}
        <div className="absolute inset-[8mm] flex flex-col">
          {layoutFormat === 'combined' && <CombinedSheet {...props} />}
          {layoutFormat === 'pure-2d' && <Pure2DSheet {...props} />}
          {layoutFormat === 'pure-3d' && <Pure3DSheet {...props} />}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 0; }
          body > * { display: none !important; }
          body > .fixed.inset-0.z-\\[100\\] { display: flex !important; }
        }
      `}</style>
    </div>
  );
};
