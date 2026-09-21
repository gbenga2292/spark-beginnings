import React from 'react';
import { Point, PIXELS_PER_METER } from '../../utils/simulationLogic';
import { ActiveTool } from './Toolbar';
import { Layers, MousePointer2, Zap } from 'lucide-react';

interface StatusBarProps {
  cursorPos: Point | null;
  activeTool: ActiveTool;
  gridSnap: boolean;
  orthoLocked: boolean;
  osnapEnabled: boolean;
  activeLayerName?: string;
  isDirty: boolean;
  onToggleOrtho?: () => void;
  onToggleGridSnap?: () => void;
  onToggleLayers?: () => void;
  showLayers?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPos, activeTool, gridSnap, orthoLocked, osnapEnabled,
  activeLayerName = 'Layer 0', isDirty,
  onToggleOrtho, onToggleGridSnap, onToggleLayers, showLayers,
}) => {
  const xM = cursorPos ? (cursorPos.x / PIXELS_PER_METER).toFixed(2) : '---.--';
  const yM = cursorPos ? (cursorPos.y / PIXELS_PER_METER).toFixed(2) : '---.--';

  const formatTool = (t: string) => {
    const map: Record<string, string> = {
      select: 'Select / Edit', line: 'Header Pipe', hose: 'Suction Pipe',
      discharge: 'Discharge Pipe', dimension: 'Dimension', delete: 'Erase',
      area: 'Excavation Area', 'discharge-area': 'Discharge Area',
      'site-area': 'Site Area', pump: 'Dew. Pump', ingress: 'Water Ingress', tee: 'Tee Connector',
      elbow: 'Elbow Fitting', text: 'Text', move: 'Move', copy: 'Copy',
      rotate: 'Rotate', offset: 'Offset', split: 'Split', trim: 'Trim/Extend',
    };
    return map[t] || t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const toggleBtn = (
    label: string,
    active: boolean,
    onClick?: () => void,
    activeColor = 'text-emerald-700 border-emerald-300 bg-emerald-50',
  ) => (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
        active
          ? activeColor
          : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-200'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-7 flex-shrink-0 w-full bg-white border-t border-slate-200 text-slate-500 text-[9px] px-3 flex items-center justify-between select-none font-mono shadow-sm">
      {/* Left: tool + coords */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <MousePointer2 size={10} className="opacity-50" />
          <span className="font-sans text-slate-600">{formatTool(activeTool)}</span>
        </div>
        <div className="h-3 w-px bg-slate-200" />
        <span className="tabular-nums">
          <span className="text-slate-900 font-semibold">X:</span> {xM}m
          <span className="mx-2 text-slate-300">·</span>
          <span className="text-slate-900 font-semibold">Y:</span> {yM}m
        </span>
        <div className="h-3 w-px bg-slate-200" />
        <button
          type="button"
          onClick={onToggleLayers}
          title={`Toggle Layers & Levels (F7) ${showLayers ? '(Active)' : ''}`}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-sans transition-all cursor-pointer ${
            showLayers
              ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300 shadow-xs'
              : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
          }`}
        >
          <Layers size={9} className={showLayers ? 'text-blue-700' : 'opacity-60'} />
          <span className={showLayers ? 'text-blue-800 font-bold' : 'text-blue-600 font-semibold'}>{activeLayerName}</span>
        </button>
      </div>

      {/* Right: mode toggles + engine */}
      <div className="flex items-center gap-1.5">
        {isDirty && (
          <span className="text-[9px] text-amber-500 font-sans mr-1">● UNSAVED</span>
        )}
        <div className="h-3 w-px bg-slate-200" />
        {toggleBtn('ORTHO', orthoLocked, onToggleOrtho, 'text-amber-700 border-amber-300 bg-amber-50')}
        {toggleBtn('SNAP', gridSnap, onToggleGridSnap, 'text-blue-700 border-blue-300 bg-blue-50')}
        {toggleBtn('OSNAP', osnapEnabled, undefined, 'text-indigo-700 border-indigo-300 bg-indigo-50')}
        <div className="h-3 w-px bg-slate-200" />
        <div className="flex items-center gap-1">
          <Zap size={9} className="text-emerald-500" />
          <span className="text-emerald-600 font-sans text-[8.5px]">ENGINE RUNNING</span>
        </div>
      </div>
    </div>
  );
};
