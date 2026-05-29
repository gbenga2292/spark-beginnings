import React from 'react';
import { Printer, X } from 'lucide-react';
import { DewateringSimulationResult } from '../../utils/simulationLogic';

export interface ExportOptions {
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
  sitePlanDataUrl: string;
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
  { color: '#eab308', label: 'Discharge Hose' },
  { color: '#fca5a5', label: 'Excavation Area' },
  { color: '#93c5fd', label: 'Site Boundary' },
];

export const DrawingSheetPreview: React.FC<DrawingSheetPreviewProps> = ({
  onClose,
  layoutName,
  companyInfo,
  logoSrc,
  sitePlanDataUrl,
  perspectiveDataUrl,
  bomResults,
  dateStr,
  exportOptions = { includeSitePlan: true, include3DView: true, includeBOM: true, includeLegend: true },
}) => {
  const handlePrint = () => {
    window.print();
  };

  const { includeSitePlan, include3DView, includeBOM, includeLegend } = exportOptions;
  const show3D = include3DView && perspectiveDataUrl;

  // Calculate how many right-side panels exist
  const rightPanelCount = [show3D, includeBOM, includeLegend].filter(Boolean).length;
  const hasRightPanel = rightPanelCount > 0;

  return (
    <div className="fixed inset-0 z-[100] flex bg-gray-500 overflow-auto print:bg-white print:overflow-visible">
      {/* Non-print controls */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-10">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700"
        >
          <Printer size={16} /> Print Sheet
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-md shadow border border-gray-300 hover:bg-gray-100"
        >
          <X size={16} /> Close
        </button>
      </div>

      {/* The Sheet */}
      <div className="m-auto bg-white shadow-2xl print:shadow-none print:m-0 w-[297mm] h-[210mm] min-w-[297mm] min-h-[210mm] relative border border-gray-300 print:border-none box-border flex flex-col p-4">
        
        {/* Drawing Border */}
        <div className="border-[3px] border-black p-1 flex-1 flex flex-col h-full">
          <div className="border border-black flex-1 flex flex-col">
            
            {/* Top section: Drawings */}
            <div className="flex-1 flex border-b border-black">
              {/* Left: Site Plan (or full width if no right panel) */}
              {includeSitePlan && (
                <div className={`flex-1 ${hasRightPanel ? 'border-r border-black' : ''} relative flex flex-col`}>
                  <h2 className="absolute top-2 left-2 text-sm font-bold uppercase tracking-wider underline z-10 bg-white/70 px-1">
                    Site Plan
                  </h2>
                  <div className="flex-1 w-full h-full overflow-hidden">
                    <img src={sitePlanDataUrl} alt="Site Plan" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
              
              {/* Right panel stack */}
              {hasRightPanel && (
                <div className={`${includeSitePlan ? 'w-[20%]' : 'flex-1'} flex flex-col`}>
                  {/* 3D Perspective */}
                  {show3D && (
                    <div className={`${includeBOM || includeLegend ? 'flex-[2]' : 'flex-1'} ${(includeBOM || includeLegend) ? 'border-b border-black' : ''} relative flex flex-col p-2`}>
                      <h2 className="absolute top-2 left-2 text-sm font-bold uppercase tracking-wider underline z-10 bg-white/70 px-1">
                        3D Perspective View
                      </h2>
                      <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-900">
                        <img src={perspectiveDataUrl!} alt="Perspective" className="max-w-full max-h-full object-cover" />
                      </div>
                    </div>
                  )}
                  
                  {/* BOM — compact 1/3 size */}
                  {includeBOM && (
                    <div className={`flex-1 ${includeLegend ? 'border-b border-black' : ''} relative flex flex-col p-2 bg-white`}>
                      <h2 className="text-[10px] font-bold uppercase tracking-wider underline mb-1 text-center">
                        Bill of Materials
                      </h2>
                      <table className="w-full text-[9px] border-collapse text-left leading-tight">
                        <thead>
                          <tr className="border-b border-black">
                            <th className="py-0.5">Item</th>
                            <th className="py-0.5 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Headers (6m)', bomResults.headers],
                            ['Pumps', bomResults.pumps],
                            ['Wellpoints', bomResults.wellpoints],
                            ['Connectors', bomResults.connectors],
                            ['Clips (2")', bomResults.clips],
                            ['Elbows', bomResults.elbows],
                            ['Tees', bomResults.tees],
                          ].map(([label, qty]) => (
                            <tr key={label as string} className="border-b border-gray-200">
                              <td className="py-0.5">{label}</td>
                              <td className="py-0.5 text-right font-semibold">{qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-auto pt-0.5 text-[8px] italic text-gray-500">
                        Total Perimeter: {bomResults.totalLengthMeters.toFixed(1)}m
                      </div>
                    </div>
                  )}

                  {/* Legend */}
                  {includeLegend && (
                    <div className="flex-1 relative flex flex-col p-2 bg-white">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider underline mb-1 text-center">
                        Legend
                      </h2>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
                        {LEGEND_ITEMS.map(item => (
                          <div key={item.label} className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-3 h-3 rounded-sm border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* If nothing selected at all, show a message */}
              {!includeSitePlan && !hasRightPanel && (
                <div className="flex-1 flex items-center justify-center text-gray-400 italic text-sm">
                  No drawing sections selected
                </div>
              )}
            </div>

            {/* Bottom Title Block */}
            <div className="h-24 flex divide-x divide-black bg-white">
              
              {/* Logo & Company */}
              <div className="w-[30%] flex items-center justify-center p-2">
                <img src={logoSrc} alt="Company Logo" className="max-h-16 object-contain" />
              </div>
              
              <div className="w-[30%] p-2 flex flex-col justify-center text-xs">
                <div className="font-bold uppercase text-sm mb-1">{companyInfo.name}</div>
                <div>{companyInfo.address}</div>
                <div>{companyInfo.phone} | {companyInfo.email}</div>
                <div className="text-[10px] text-gray-500">{companyInfo.regNumber}</div>
              </div>

              {/* Project / Title */}
              <div className="flex-1 p-2 flex flex-col justify-center border-l border-black">
                <div className="text-[10px] uppercase font-bold text-gray-500">Project / Drawing Title</div>
                <div className="font-bold text-lg leading-tight uppercase mt-1">
                  {layoutName || 'Dewatering Layout'}
                </div>
              </div>

              {/* Drawing Info */}
              <div className="w-[20%] flex flex-col divide-y divide-black">
                <div className="flex-1 flex">
                  <div className="flex-1 p-1 flex flex-col border-r border-black">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Date</span>
                    <span className="text-xs font-bold mt-auto">{dateStr}</span>
                  </div>
                  <div className="flex-1 p-1 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Scale</span>
                    <span className="text-xs font-bold mt-auto">NTS</span>
                  </div>
                </div>
                <div className="flex-1 p-1 flex flex-col items-center justify-center bg-gray-100">
                  <span className="text-[9px] uppercase font-bold text-gray-500 mb-1">Sheet No.</span>
                  <span className="text-xl font-bold">A-100</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
