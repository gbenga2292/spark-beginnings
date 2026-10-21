import React, { useState } from 'react';
import {
  Ruler, Eye, EyeOff, Pin, PinOff, RotateCcw,
  SlidersHorizontal, ChevronDown, ChevronUp, Trash2, Layers, Sparkles
} from 'lucide-react';

export interface BlueprintSettings {
  visible: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

interface BlueprintControlBarProps {
  blueprintSettings: BlueprintSettings;
  onUpdateSettings: (updates: Partial<BlueprintSettings>) => void;
  onStartReferenceScale: () => void;
  isCalibrating?: boolean;
  onResetBlueprint: () => void;
  onRemoveBlueprint?: () => void;
  onOpenAiAssistant?: () => void;
}

export const BlueprintControlBar: React.FC<BlueprintControlBarProps> = ({
  blueprintSettings,
  onUpdateSettings,
  onStartReferenceScale,
  isCalibrating = false,
  onResetBlueprint,
  onRemoveBlueprint,
  onOpenAiAssistant,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-auto">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-xl px-3 py-2 flex items-center gap-3 text-xs transition-all duration-200">
        
        {/* Title Tag */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 text-slate-700">
          <Layers size={14} className="text-blue-600" />
          <span className="font-bold tracking-tight text-[11px] uppercase text-slate-800">Blueprint</span>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 ml-1 transition-colors"
            title={isMinimized ? 'Expand blueprint controls' : 'Minimize blueprint controls'}
          >
            {isMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Minimized View Pill */}
        {isMinimized ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartReferenceScale}
              disabled={isCalibrating}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors shadow-sm ${
                isCalibrating
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80'
              }`}
            >
              <Ruler size={12} />
              <span>{isCalibrating ? 'Calibrating...' : 'Scale Blueprint'}</span>
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              {Math.round(blueprintSettings.opacity * 100)}%
            </span>
          </div>
        ) : (
          /* Full Controls */
          <div className="flex items-center gap-3 flex-wrap">
            {/* 1. Scale Calibration Action */}
            <button
              type="button"
              onClick={onStartReferenceScale}
              disabled={isCalibrating}
              title="Calibrate blueprint scale using 2 reference points of known length"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold text-[11px] transition-all shadow-sm ${
                isCalibrating
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/20'
              }`}
            >
              <Ruler size={13} />
              <span>{isCalibrating ? 'Picking Points...' : 'Calibrate Scale'}</span>
            </button>

            {/* AI Dewatering Assistant Action */}
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                title="AI Dewatering Assistant: Auto-design system from this blueprint"
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold text-[11px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={13} className="text-emerald-200" />
                <span>AI Dewatering</span>
              </button>
            )}

            {/* 2. Opacity Slider */}
            <div className="flex items-center gap-2 pl-1 pr-2 border-r border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Opacity</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(blueprintSettings.opacity * 100)}
                onChange={(e) => onUpdateSettings({ opacity: parseFloat(e.target.value) / 100 })}
                className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                title={`Underlay Opacity: ${Math.round(blueprintSettings.opacity * 100)}%`}
              />
              <span className="font-mono text-[11px] font-bold text-slate-600 w-8 text-right">
                {Math.round(blueprintSettings.opacity * 100)}%
              </span>
            </div>

            {/* 3. Visibility Toggle */}
            <button
              type="button"
              onClick={() => onUpdateSettings({ visible: !blueprintSettings.visible })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-[11px] border transition-colors ${
                blueprintSettings.visible
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-amber-50 border-amber-200 text-amber-700 font-semibold'
              }`}
              title={blueprintSettings.visible ? 'Hide underlay image' : 'Show underlay image'}
            >
              {blueprintSettings.visible ? <Eye size={12} className="text-slate-500" /> : <EyeOff size={12} className="text-amber-600" />}
              <span>{blueprintSettings.visible ? 'Visible' : 'Hidden'}</span>
            </button>

            {/* 4. Lock / Pin Toggle */}
            <button
              type="button"
              onClick={() => onUpdateSettings({ locked: !blueprintSettings.locked })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-[11px] border transition-colors ${
                blueprintSettings.locked
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold shadow-xs'
              }`}
              title={blueprintSettings.locked ? 'Underlay is locked (cannot be moved accidentally)' : 'Underlay is unpinned (can be repositioned)'}
            >
              {blueprintSettings.locked ? <Pin size={12} className="text-slate-500" /> : <PinOff size={12} className="text-emerald-600" />}
              <span>{blueprintSettings.locked ? 'Pinned' : 'Movable'}</span>
            </button>

            {/* 5. Reset Position & Scale */}
            <button
              type="button"
              onClick={onResetBlueprint}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
              title="Reset position and scale to original defaults"
            >
              <RotateCcw size={13} />
            </button>

            {/* 6. Remove Blueprint */}
            {onRemoveBlueprint && (
              <button
                type="button"
                onClick={onRemoveBlueprint}
                className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                title="Remove blueprint underlay"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
