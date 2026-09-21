import React, { useState, useRef } from 'react';
import { DewateringSimulationResult } from '../../utils/simulationLogic';
import { ChevronUp, ChevronDown, Download, Trash2, CheckCircle2, X, GripVertical } from 'lucide-react';

interface ModernBOQPanelProps {
  results: DewateringSimulationResult;
  onClear: () => void;
  onClose?: () => void;
}

export const ResultsPanel: React.FC<ModernBOQPanelProps> = ({ results, onClear, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.startPosX + dx,
        y: dragRef.current.startPosY + dy,
      });
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleExportCSV = () => {
    const rows: string[] = ['Item,Description,Specification,Qty,Unit'];
    if (results.headers > 0) {
      rows.push(`6m DN150 Header Pipes,Quick-connect lever couplings,"L=6.0m DN150 Bauer",${results.headers6m},pcs`);
      if (results.headers3m > 0)
        rows.push(`3m DN150 Header Pipes,Quick-connect lever couplings,"L=3.0m DN150 Bauer",${results.headers3m},pcs`);
    }
    if (results.wellpoints > 0)
      rows.push(`Wellpoint Riser Pipes,Self-jetting tip,"L=6.0m, 1m C/C spacing",${results.wellpoints},pcs`);
    if (results.swingJoints > 0)
      rows.push(`Flexible Swing Joints,Reinforced braided PVC,"1½″ BSP",${results.swingJoints},pcs`);
    if (results.pumps > 0)
      rows.push(`6″ Diesel Vacuum Pump,Automatic priming,"50 CFM, 1 Duty / 1 Stby",${results.pumps},sets`);
    if (results.elbows > 0)
      rows.push(`90° Elbows & End Plugs,Ring closure fittings,"DN150 Bauer",${results.elbows},pcs`);
    if (results.tees > 0)
      rows.push(`Tee Connectors,Header tie-in fittings,"DN150 Bauer T-piece",${results.tees},pcs`);
    if (results.couplings > 0)
      rows.push(`Bauer Couplings,Quick-release couplings,"DN150",${results.couplings},pcs`);
    if (results.suctionHoses > 0)
      rows.push(`Suction Hoses,Reinforced flexible hose,"DN150",${results.suctionHoses},pcs`);
    if (results.dischargeHoseMeters > 0)
      rows.push(`TPU Layflat Discharge Hose,Abrasion-resistant layflat,"Ø4″",${results.dischargeHoseMeters},m`);

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dewatering-boq.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryMetrics = [
    {
      label: 'Ring Length',
      value: `${results.totalLengthMeters.toFixed(1)} m`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Pumps',
      value: `${results.pumps} ${results.pumps === 1 ? 'Unit' : 'Units'}`,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Wellpoints',
      value: `${results.wellpoints}`,
      color: 'text-slate-700',
      bgColor: 'bg-slate-50',
    },
  ];

  const bomRows = [
    results.headers > 0 && {
      label: '6m DN150 Header Pipes',
      sub: 'Quick-connect lever couplings',
      qty: `${results.headers6m} pcs`,
      extra: results.headers3m > 0 ? `+ ${results.headers3m} × 3m` : undefined,
    },
    results.wellpoints > 0 && {
      label: 'Wellpoint Riser Pipes',
      sub: 'L=6.0m, self-jetting tip',
      qty: `${results.wellpoints} pcs`,
      extra: '1m C/C',
    },
    results.swingJoints > 0 && {
      label: 'Flexible Swing Joints',
      sub: 'Reinforced braided PVC, 1½″',
      qty: `${results.swingJoints} pcs`,
    },
    results.pumps > 0 && {
      label: '6″ Diesel Vacuum Pump',
      sub: 'Automatic priming to CFM',
      qty: `${results.pumps} sets`,
      extra: '1 Duty / 1 Stby',
    },
    results.elbows > 0 && {
      label: '90° Elbows & End Plugs',
      sub: 'DN150 Bauer — ring closure',
      qty: `${results.elbows} pcs`,
    },
    results.tees > 0 && {
      label: 'Tee Connectors',
      sub: 'DN150 Bauer T-piece',
      qty: `${results.tees} pcs`,
    },
    results.couplings > 0 && {
      label: 'Bauer Couplings',
      sub: 'Quick-release DN150',
      qty: `${results.couplings} pcs`,
    },
    results.suctionHoses > 0 && {
      label: 'Suction Hoses',
      sub: 'Reinforced flexible — DN150',
      qty: `${results.suctionHoses} pcs`,
      extra: 'Ø4″',
    },
    results.dischargeHoseMeters > 0 && {
      label: 'TPU Layflat Discharge Hose',
      sub: 'Abrasion-resistant layflat',
      qty: `${results.dischargeHoseMeters} m`,
      extra: 'Ø4″',
    },
  ].filter(Boolean) as { label: string; sub: string; qty: string; extra?: string }[];

  return (
    <div 
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      className="w-64 rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden will-change-transform select-none"
    >

      {/* Header */}
      <div 
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between px-2.5 py-2 border-b border-slate-100 bg-slate-50 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical size={13} className="text-slate-400 shrink-0 cursor-grab active:cursor-grabbing" />
          <button
            onClick={() => setIsExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-colors truncate cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="uppercase tracking-wider">BOQ · Quantities</span>
            {isExpanded ? <ChevronUp size={12} className="ml-1 shrink-0" /> : <ChevronDown size={12} className="ml-1 shrink-0" />}
          </button>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onClear}
            title="Clear Canvas"
            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Hide BOQ Panel"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 3-metric summary */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            {summaryMetrics.map(m => (
              <div key={m.label} className={`flex flex-col items-center py-2.5 px-1 ${m.bgColor}`}>
                <span className={`text-[13px] font-bold font-mono ${m.color}`}>{m.value}</span>
                <span className="text-[8.5px] text-slate-400 uppercase tracking-wide mt-0.5">{m.label}</span>
              </div>
            ))}
          </div>

          {/* BOM rows */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 280, scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            {bomRows.length === 0 ? (
              <div className="py-8 text-center text-[10px] text-slate-400">
                No items yet — draw some pipes
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {bomRows.map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-[10px] font-medium text-slate-800 truncate">{row.label}</p>
                      <p className="text-[9px] text-slate-400 truncate">{row.sub}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] font-bold font-mono text-slate-700">{row.qty}</span>
                      {row.extra && (
                        <p className="text-[8.5px] text-slate-400 font-mono">{row.extra}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-1 text-[8.5px] text-emerald-600">
              <CheckCircle2 size={9} />
              <span>DIN 4095 Calculated</span>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[9px] text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Download size={9} />
              CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsPanel;
