import React from 'react';
import { Point, PIXELS_PER_METER } from '../../utils/simulationLogic';
import { ActiveTool } from './Toolbar';
import { Crosshair, Grid, Layers, MousePointer2, AlertCircle } from 'lucide-react';

interface StatusBarProps {
  cursorPos: Point | null;
  activeTool: ActiveTool;
  gridSnap: boolean;
  orthoLocked: boolean;
  osnapEnabled: boolean;
  activeLayerName?: string;
  isDirty: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPos,
  activeTool,
  gridSnap,
  orthoLocked,
  osnapEnabled,
  activeLayerName = 'Layer 0',
  isDirty
}) => {
  // Convert pixels to world coordinates in meters
  const coordsStr = cursorPos 
    ? `X: ${(cursorPos.x / PIXELS_PER_METER).toFixed(2)}m   Y: ${(cursorPos.y / PIXELS_PER_METER).toFixed(2)}m`
    : 'X: --.---   Y: --.---';

  const formatToolName = (tool: string) => {
    switch (tool) {
      case 'select': return 'Select / Edit';
      case 'line': return 'Header Pipe (Draw)';
      case 'hose': return 'Suction Pipe (Draw)';
      case 'discharge': return 'Discharge Pipe (Draw)';
      case 'dimension': return 'Dimension Line';
      case 'delete': return 'Erase Tool';
      case 'area': return 'Excavation Area';
      case 'discharge-area': return 'Discharge Area';
      case 'site-area': return 'Site Area Boundary';
      case 'pump': return 'Dew. Pump Component';
      case 'tee': return 'Tee Connection Joint';
      case 'elbow': return 'Elbow Connection Joint';
      default: return tool.charAt(0).toUpperCase() + tool.slice(1).replace('-', ' ');
    }
  };

  return (
    <div className="h-9 w-full bg-slate-900 border-t border-slate-800 text-slate-400 text-xs px-4 flex items-center justify-between select-none font-mono">
      {/* Left: Active Tool and Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <MousePointer2 size={12} className="text-slate-500" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Status:</span>
          <span className="text-slate-200 font-semibold">{formatToolName(activeTool)}</span>
        </div>

        {/* Coords */}
        <div className="h-4 w-px bg-slate-800" />
        <div className="text-slate-300 font-medium">
          {coordsStr}
        </div>
      </div>

      {/* Right: Snapping modes and current CAD layer */}
      <div className="flex items-center space-x-4">
        {/* Unsaved changes dot indicator */}
        {isDirty && (
          <div className="flex items-center space-x-1.5 animate-pulse bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] text-amber-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>UNSAVED</span>
          </div>
        )}

        <div className="h-4 w-px bg-slate-800" />

        {/* Snap Modes Indicators */}
        <div className="flex items-center space-x-2">
          {/* OSnap */}
          <span 
            title="Object Snap Status"
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              osnapEnabled 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' 
                : 'bg-slate-800/40 text-slate-600 border border-transparent'
            }`}
          >
            OSNAP
          </span>

          {/* Ortho */}
          <span 
            title="Ortho Mode Status (Shift key shortcut)"
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
              orthoLocked 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' 
                : 'bg-slate-800/40 text-slate-600 border border-transparent'
            }`}
          >
            <Crosshair size={9} />
            <span>ORTHO</span>
          </span>

          {/* Grid Snap */}
          <span 
            title="Grid Snapping Status"
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
              gridSnap 
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' 
                : 'bg-slate-800/40 text-slate-600 border border-transparent'
            }`}
          >
            <Grid size={9} />
            <span>GRID</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Layer Info */}
        <div className="flex items-center space-x-1.5">
          <Layers size={12} className="text-slate-500" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Layer:</span>
          <span className="text-slate-200 font-semibold">{activeLayerName}</span>
        </div>
      </div>
    </div>
  );
};
