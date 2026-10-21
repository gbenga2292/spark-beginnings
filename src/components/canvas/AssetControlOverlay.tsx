import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  RotateCcw,
  ArrowLeftRight,
  Trash2,
  Settings,
  Droplets,
  Copy,
  Pin,
  PinOff,
  Check,
  X,
  Sliders,
  Layers,
  ChevronRight,
  HelpCircle,
  Gauge,
  Scissors
} from 'lucide-react';
import { PlacedComponent, ElevationLevel } from '../../utils/simulationLogic';

export interface AutoFittingItem {
  id: string;
  type: 'elbow' | 'tee';
  x: number;
  y: number;
  rotation: number;
  sourceType: 'internal' | 'closing' | 'meeting' | 'tee-branch';
  lineId: string;
  lineIdB?: string;
  pointIndex?: number;
  endTypeA?: 'start' | 'end';
  endTypeB?: 'start' | 'end';
}

interface AssetControlOverlayProps {
  selectedComp: PlacedComponent | null;
  scale: number;
  position: { x: number; y: number };
  canvasSize: { width: number; height: number };
  levels: ElevationLevel[];
  onUpdateComponent: (id: string, updates: Partial<PlacedComponent>) => void;
  onDeleteComponent: (id: string) => void;
  onDuplicateComponent: (id: string) => void;
  onOpenPropertiesModal?: (comp: PlacedComponent) => void;
}

const COMMON_FLOW_PRESETS = [60, 90, 100, 150, 200, 250, 300, 400];

export const AssetQuickToolbar: React.FC<{
  comp: PlacedComponent;
  screenX: number;
  screenY: number;
  canvasWidth: number;
  canvasHeight: number;
  onUpdate: (updates: Partial<PlacedComponent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpenSettings: () => void;
}> = ({
  comp,
  screenX,
  screenY,
  canvasWidth,
  canvasHeight,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenSettings,
}) => {
  const isPump = comp.type === 'pump';
  const flowRate = comp.flowRate ?? 150;
  const isFlipped = !!comp.flipped;
  const rotation = comp.rotation || 0;

  // Clamp toolbar so it always stays safely inside the visible canvas viewport
  const clampedX = Math.max(160, Math.min(canvasWidth - 160, screenX));
  const clampedY = Math.max(55, Math.min(canvasHeight - 50, screenY - 45));

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ flipped: !isFlipped });
  };

  const handleRotateCw = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ rotation: (rotation + 90) % 360 });
  };

  const handleRotateCcw = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ rotation: (rotation + 270) % 360 });
  };

  return (
    <div
      className="absolute z-30 pointer-events-auto select-none transition-all duration-75"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -100%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-xs animate-in fade-in zoom-in-95">
        
        {/* Component Badge / Name */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700">
          {isPump ? (
            <Droplets size={13} className="text-sky-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          )}
          <span className="font-bold text-[11px] uppercase tracking-wide text-slate-200">
            {comp.label || (isPump ? 'Pump' : comp.type)}
          </span>
        </div>

        {/* Pump-Specific Controls: Flow Rate & Flip */}
        {isPump && (
          <>
            {/* Flow Rate Inline Input */}
            <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg px-2 py-0.5 border border-slate-700">
              <Gauge size={12} className="text-slate-400" />
              <input
                type="number"
                min="10"
                max="2000"
                step="10"
                value={flowRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdate({ flowRate: isNaN(val) ? 150 : Math.max(10, val) });
                }}
                className="w-12 bg-transparent text-center font-mono font-bold text-sky-400 outline-none text-xs focus:ring-1 focus:ring-sky-500 rounded px-0.5"
                title="Pump Flow Rate / Capacity (m³/h)"
              />
              <span className="text-[10px] text-slate-400 font-mono">m³/h</span>
            </div>

            {/* Quick Flow Presets */}
            <div className="hidden sm:flex items-center gap-1 border-r border-slate-700 pr-1.5">
              {[100, 150, 250].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdate({ flowRate: preset })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                    flowRate === preset
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={`Set flow rate to ${preset} m³/h`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Flip Ports (Suction ↔ Discharge) Toggle */}
            <button
              type="button"
              onClick={handleFlip}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold text-[11px] transition-all border ${
                isFlipped
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={`Click to flip pump ports. Currently: Suction on ${isFlipped ? 'RIGHT' : 'LEFT'}, Discharge on ${isFlipped ? 'LEFT' : 'RIGHT'}`}
            >
              <ArrowLeftRight size={12} className={isFlipped ? 'text-amber-400' : 'text-sky-400'} />
              <span>{isFlipped ? 'Suct: ➔ R' : 'Suct: ⬅ L'}</span>
            </button>
          </>
        )}

        {/* Rotate Controls */}
        <div className="flex items-center gap-0.5 border-l border-slate-700 pl-1.5">
          <button
            type="button"
            onClick={handleRotateCw}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Rotate 90° Clockwise"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            onClick={handleRotateCcw}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Rotate 90° Counter-Clockwise"
          >
            <RotateCcw size={13} />
          </button>
          <span className="text-[10px] text-slate-400 font-mono px-1">
            {rotation}°
          </span>
        </div>

        {/* Properties / Settings Modal Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/30 transition-colors ml-0.5"
          title="Open Asset Configuration & Properties"
        >
          <Settings size={13} />
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={onDuplicate}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Duplicate Element"
        >
          <Copy size={13} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded-lg hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors ml-0.5"
          title="Delete Element (Del)"
        >
          <Trash2 size={13} />
        </button>

      </div>
    </div>
  );
};

export const AssetPropertiesModal: React.FC<{
  comp: PlacedComponent;
  levels: ElevationLevel[];
  onClose: () => void;
  onSave: (updates: Partial<PlacedComponent>) => void;
  onDelete: () => void;
}> = ({ comp, levels, onClose, onSave, onDelete }) => {
  const isPump = comp.type === 'pump';
  const [flowRate, setFlowRate] = useState<number>(comp.flowRate ?? 150);
  const [isFlipped, setIsFlipped] = useState<boolean>(!!comp.flipped);
  const [rotation, setRotation] = useState<number>(comp.rotation || 0);
  const [label, setLabel] = useState<string>(comp.label || (isPump ? 'Dewatering Pump' : comp.type));
  const [levelId, setLevelId] = useState<string>(comp.levelId || levels[0]?.id || 'gl-level');

  const handleApply = () => {
    onSave({
      flowRate: isPump ? flowRate : undefined,
      flipped: isPump ? isFlipped : undefined,
      rotation,
      label,
      levelId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Droplets size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {isPump ? 'Dewatering Pump Configuration' : `${comp.type.toUpperCase()} Component Settings`}
              </h2>
              <p className="text-[11px] text-slate-500">
                Asset ID: <span className="font-mono text-slate-700">{comp.id.substring(0, 8)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Live Schematic Visual Preview Box */}
          <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Live Asset Orientation & Port Preview
            </div>

            <div 
              className="relative w-48 h-28 flex items-center justify-center transition-transform duration-200"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {isPump ? (
                /* High-Fidelity SVG Pump Diagram */
                <svg width="180" height="90" viewBox="-90 -45 180 90">
                  {/* Skid Base */}
                  <rect x="-45" y="24" width="90" height="8" rx="2" fill="#334155" />
                  
                  {/* Pump Volute Body */}
                  <rect x="-35" y="-20" width="70" height="42" rx="4" fill="#0ea5e9" stroke="#0284c7" strokeWidth="2.5" />
                  <rect x="-18" y="-10" width="36" height="22" rx="2" fill="#bae6fd" />
                  <circle cx="0" cy="1" r="5" fill="#0369a1" />

                  {/* Suction Inlet Side */}
                  <g transform={`translate(${isFlipped ? 35 : -35}, 0)`}>
                    <circle cx="0" cy="0" r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="2.5" fill="#fff" />
                    <line x1={isFlipped ? 7 : -7} y1="0" x2={isFlipped ? 20 : -20} y2="0" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                  </g>

                  {/* Discharge Outlet Side */}
                  <g transform={`translate(${isFlipped ? -35 : 35}, 0)`}>
                    <circle cx="0" cy="0" r="7" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="2.5" fill="#fff" />
                    <line x1={isFlipped ? -7 : 7} y1="0" x2={isFlipped ? -20 : 20} y2="0" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                  </g>
                </svg>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-emerald-500/20 border border-emerald-500 flex items-center justify-center font-bold text-white uppercase">
                  {comp.type}
                </div>
              )}
            </div>

            {/* Readout Pill */}
            <div className="flex items-center gap-3 mt-2 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Suction: <span className="font-bold">{isFlipped ? 'Right Face' : 'Left Face'}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Discharge: <span className="font-bold">{isFlipped ? 'Left Face' : 'Right Face'}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">
                Rotation: <span className="text-white font-bold">{rotation}°</span>
              </span>
            </div>
          </div>

          {/* Section 1: Flow Rate / Capacity (Pump Only) */}
          {isPump && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Flow Rate / Capacity</span>
                <span className="text-[11px] font-mono text-blue-600 font-semibold">{flowRate} m³/h</span>
              </label>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    step="10"
                    value={flowRate}
                    onChange={(e) => setFlowRate(Math.max(10, parseFloat(e.target.value) || 150))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    m³/h
                  </span>
                </div>
              </div>

              {/* Standard Flow Rate Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-medium">Standard Presets:</span>
                {COMMON_FLOW_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFlowRate(preset)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                      flowRate === preset
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Port Orientation (Suction ↔ Discharge Flip) */}
          {isPump && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">
                Port Orientation (Flip Suction / Discharge)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !isFlipped
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>Standard Ports</span>
                    {!isFlipped && <Check size={14} className="text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Suction on <span className="font-semibold text-amber-600">Left</span>, Discharge on <span className="font-semibold text-blue-600">Right</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isFlipped
                      ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>Flipped Ports</span>
                    {isFlipped && <Check size={14} className="text-amber-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Suction on <span className="font-semibold text-amber-600">Right</span>, Discharge on <span className="font-semibold text-blue-600">Left</span>
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Rotation Angle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Rotation Angle</span>
              <span className="font-mono text-slate-600">{rotation}°</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { angle: 0, label: '0° Horizontal' },
                { angle: 90, label: '90° Down' },
                { angle: 180, label: '180° Inverted' },
                { angle: 270, label: '270° Up' },
              ].map(({ angle, label }) => (
                <button
                  key={angle}
                  type="button"
                  onClick={() => setRotation(angle)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
                    rotation === angle
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="range"
              min="0"
              max="355"
              step="5"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Section 4: Label & Level */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Asset Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Pump 1"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Elevation Level</label>
              <select
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.depthFromGL}m)
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this asset?')) {
                onDelete();
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
          >
            <Trash2 size={13} />
            <span>Delete Asset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm shadow-blue-500/20 transition-all"
            >
              Apply Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const AssetContextMenu: React.FC<{
  x: number;
  y: number;
  comp: PlacedComponent;
  onClose: () => void;
  onUpdate: (updates: Partial<PlacedComponent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpenSettings: () => void;
}> = ({
  x,
  y,
  comp,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenSettings,
}) => {
  const isPump = comp.type === 'pump';

  useEffect(() => {
    const handleClose = () => onClose();
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[250] bg-white border border-slate-200 rounded-xl shadow-2xl py-1 w-56 text-xs text-slate-700 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
        <span>{comp.label || comp.type}</span>
        <span className="font-mono text-slate-500">{comp.rotation || 0}°</span>
      </div>

      {isPump && (
        <>
          <button
            type="button"
            onClick={() => {
              onUpdate({ flipped: !comp.flipped });
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left font-medium"
          >
            <ArrowLeftRight size={13} className="text-blue-500" />
            <span className="flex-1">Flip Suction / Discharge</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {comp.flipped ? 'Right ➔' : '⬅ Left'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left font-medium"
          >
            <Gauge size={13} className="text-sky-500" />
            <span className="flex-1">Edit Flow Capacity...</span>
            <span className="text-[10px] text-slate-400 font-mono">{comp.flowRate ?? 150}m³</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          onUpdate({ rotation: ((comp.rotation || 0) + 90) % 360 });
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 transition-colors text-left"
      >
        <RotateCw size={13} className="text-slate-500" />
        <span>Rotate 90° Clockwise</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onUpdate({ rotation: ((comp.rotation || 0) + 270) % 360 });
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 transition-colors text-left"
      >
        <RotateCcw size={13} className="text-slate-500" />
        <span>Rotate 90° Counter-CW</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 transition-colors text-left"
      >
        <Copy size={13} className="text-slate-500" />
        <span>Duplicate Element</span>
      </button>

      <div className="my-1 border-t border-slate-100" />

      <button
        type="button"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 transition-colors text-left font-semibold text-slate-800"
      >
        <Settings size={13} className="text-slate-500" />
        <span>Asset Properties...</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 transition-colors text-left font-medium"
      >
        <Trash2 size={13} />
        <span>Delete</span>
      </button>
    </div>
  );
};

export const AutoFittingQuickToolbar: React.FC<{
  fitting: AutoFittingItem;
  screenX: number;
  screenY: number;
  canvasWidth: number;
  canvasHeight: number;
  onDisconnect: () => void;
  onStraighten: () => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({
  fitting,
  screenX,
  screenY,
  canvasWidth,
  canvasHeight,
  onDisconnect,
  onStraighten,
  onDelete,
  onClose,
}) => {
  const isElbow = fitting.type === 'elbow';
  const clampedX = Math.max(160, Math.min(canvasWidth - 160, screenX));
  const clampedY = Math.max(55, Math.min(canvasHeight - 50, screenY - 35));

  return (
    <div
      className="absolute z-30 pointer-events-auto select-none transition-all duration-75"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -100%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-xs animate-in fade-in zoom-in-95">
        {/* Badge */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700">
          <div className={`w-2.5 h-2.5 rounded-full ${isElbow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span className="font-bold text-[11px] uppercase tracking-wide text-slate-200">
            {isElbow ? 'Corner Elbow' : 'Tee Branch'}
          </span>
        </div>

        {/* Action: Disconnect Corner / Branch */}
        <button
          type="button"
          onClick={onDisconnect}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all font-semibold text-[11px]"
          title={isElbow ? "Disconnect this corner and open the joint" : "Disconnect branch line from header"}
        >
          <Scissors size={12} className="text-amber-400" />
          <span>{isElbow ? 'Disconnect Corner' : 'Disconnect Branch'}</span>
        </button>

        {/* Action: Straighten / Remove Bend (for internal elbows) */}
        {isElbow && fitting.sourceType === 'internal' && (
          <button
            type="button"
            onClick={onStraighten}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all font-semibold text-[11px]"
            title="Remove this corner bend and straighten line between adjacent vertices"
          >
            <span>Straighten Bend</span>
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded-lg hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors ml-0.5"
          title="Delete Fitting (Del)"
        >
          <Trash2 size={13} />
        </button>

        {/* Close / Deselect */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

