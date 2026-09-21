import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface CanvasHudOverlayProps {
  /** Header loop status */
  isLoopClosed: boolean;
  /** Whether we're in 3D mode */
  is3D: boolean;
  /** Active layer name */
  activeLayerName: string;
  /** Grid/Snap state */
  gridSnap: boolean;
  /** Ortho state */
  orthoLocked: boolean;
  /** Scale readout (e.g. "1:100") */
  scale?: string;
  /** Quick zoom controls */
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomAll: () => void;
  onResetView?: () => void;
  /** Toggle Layers & Levels panel */
  onToggleLayers?: () => void;
  /** Whether Layers panel is open */
  showLayers?: boolean;
}

export function CanvasHudOverlay({
  isLoopClosed, is3D, activeLayerName,
  gridSnap, orthoLocked, scale = '1:100',
  onZoomIn, onZoomOut, onZoomAll, onResetView,
  onToggleLayers, showLayers,
}: CanvasHudOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">

      {/* ── Top-Left Status Badge ── */}
      <div className="absolute top-3 left-3 pointer-events-auto">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-600">
          <span>Scale: <span className="font-semibold text-slate-900">{scale}</span></span>
          <span className="text-slate-300">•</span>
          <span>Grid: <span className="font-semibold text-slate-900">1.0 m</span></span>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={onToggleLayers}
            title={`Toggle Layers & Levels (F7) ${showLayers ? '(Active)' : ''}`}
            className={`flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded transition-colors cursor-pointer ${
              showLayers
                ? 'bg-blue-100 text-blue-800 font-semibold'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span className="text-slate-500">Layer:</span>
            <span className="font-semibold text-blue-600">{activeLayerName}</span>
          </button>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 font-sans">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoopClosed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className={`font-semibold ${isLoopClosed ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isLoopClosed ? 'Closed Loop' : 'Open Header'}
            </span>
          </span>
        </div>
      </div>

      {/* ── Top-Right ViewCube / Compass ── */}
      <div className="absolute top-3 right-3 pointer-events-auto">
        <div className="flex flex-col items-center gap-1.5">
          {/* 2D Compass / View label (only shown in 2D mode; 3D uses interactive ViewCube3D) */}
          {!is3D && (
            <div className="relative w-11 h-11 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex flex-col items-center justify-center cursor-default">
              <span className="text-[9px] font-bold text-slate-700 tracking-widest">
                TOP
              </span>
              <span className="text-[8px] font-medium text-slate-400">
                2D
              </span>
              {/* N arrow */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[7.5px] font-bold text-rose-500">N</span>
              </div>
            </div>
          )}

          {/* Zoom controls (placed neatly underneath ViewCube3D when in 3D mode) */}
          <div className={`flex flex-col gap-0.5 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg p-0.5 ${is3D ? 'mt-[138px]' : ''}`}>
            <button
              onClick={onZoomIn}
              title="Zoom In (+)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={onZoomAll}
              title="Zoom All / Fit (A)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onZoomOut}
              title="Zoom Out (-)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            {onResetView && (
              <button
                onClick={onResetView}
                title="Reset View"
                className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CanvasHudOverlay;
