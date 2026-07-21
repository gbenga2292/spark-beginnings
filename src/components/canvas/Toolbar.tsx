import React, { useState } from 'react';
import { MousePointer2, Pencil, Droplet, GitMerge, CornerDownRight, Square, Undo2, Eraser, Eye, EyeOff, Crosshair, Maximize, Minimize, Grid, Ruler, Spline, Frame, ChevronUp, ChevronDown, Printer, Move, Copy, RotateCw, Type, Pin, PinOff, Scissors, AlignLeft, SlidersHorizontal, FlipHorizontal, Image } from 'lucide-react';
import { ComponentType } from '../../utils/simulationLogic';

export type ActiveTool = 'select' | 'line' | 'dimension' | 'delete' | 'area' | 'hose' | 'discharge' | 'discharge-area' | 'site-area' | 'move' | 'copy' | 'rotate' | 'align' | 'offset' | 'mirror-pick' | 'mirror-draw' | 'split' | 'trim' | 'pin' | 'unpin' | 'text' | 'modify-blueprint' | ComponentType;

interface ToolbarProps {
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
  onUndo: () => void;
  showWellpoints?: boolean;
  onToggleWellpoints?: () => void;
  wellpointSide?: 'left' | 'right' | 'both';
  onToggleWellpointSide?: () => void;
  orthoLocked?: boolean;
  onToggleOrtho?: () => void;
  gridSnap?: boolean;
  onToggleGridSnap?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  show3D?: boolean;
  onToggle3D?: () => void;
  onExportDrawing?: () => void;
  
  // Options bar state
  offsetDistance: number;
  onOffsetDistanceChange: (val: number) => void;
  mirrorCopy: boolean;
  onMirrorCopyChange: (val: boolean) => void;
  drawShapeMode: 'rect' | 'poly';
  onDrawShapeModeChange: (mode: 'rect' | 'poly') => void;
  textColor: string;
  onTextColorChange: (color: string) => void;
  textSize: number;
  onTextSizeChange: (size: number) => void;
  
  // Blueprint settings
  blueprintSettings: any;
  onUpdateBlueprintSettings: (updates: any) => void;
  hasBlueprint: boolean;
  onUploadBlueprintClick?: () => void;
  isSettingScale?: boolean;
  onStartReferenceScale?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  activeTool, onToolSelect, onUndo, 
  showWellpoints, onToggleWellpoints, 
  wellpointSide = 'left', onToggleWellpointSide,
  orthoLocked, onToggleOrtho, 
  gridSnap, onToggleGridSnap,
  isFullscreen, onToggleFullscreen,
  show3D, onToggle3D,
  onExportDrawing,
  offsetDistance, onOffsetDistanceChange,
  mirrorCopy, onMirrorCopyChange,
  drawShapeMode, onDrawShapeModeChange,
  textColor, onTextColorChange,
  textSize, onTextSizeChange,
  blueprintSettings, onUpdateBlueprintSettings,
  hasBlueprint, onUploadBlueprintClick,
  isSettingScale, onStartReferenceScale
}) => {
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(window.innerWidth < 640);

  const drawTools = [
    { id: 'site-area', label: 'Site Area', icon: Grid },
    { id: 'area', label: 'Excavation Area', icon: Frame },
    { id: 'discharge-area', label: 'Discharge Area', icon: Square },
    { id: 'line', label: 'Header Pipe', icon: Pencil },
    { id: 'hose', label: 'Suction Pipe', icon: Spline },
    { id: 'discharge', label: 'Discharge Pipe', icon: GitMerge },
    { id: 'dimension', label: 'Dimension', icon: Ruler },
  ];
  
  const compTools = [
    { id: 'pump', label: 'Dew. Pump', icon: Droplet },
    { id: 'tee', label: 'Place Tee', icon: CornerDownRight },
    { id: 'elbow', label: 'Place Elbow', icon: Crosshair },
  ];
  
  const editTools = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'move', label: 'Move', icon: Move },
    { id: 'copy', label: 'Copy', icon: Copy },
    { id: 'rotate', label: 'Rotate', icon: RotateCw },
    { id: 'delete', label: 'Erase', icon: Eraser },
  ];

  const renderTool = (tool: {id: string, label: string, icon: any, desc?: string}) => {
    const Icon = tool.icon;
    const isActive = activeTool === tool.id;
    return (
      <button
        key={tool.id}
        onClick={() => onToolSelect(tool.id as ActiveTool)}
        title={tool.desc ? `${tool.label} - ${tool.desc}` : tool.label}
        className={`relative flex flex-col items-center justify-center p-2 rounded transition-all duration-200 ${
          isActive 
            ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
        }`}
      >
        <Icon size={18} className="mb-1" />
        <span className="text-[10px] font-semibold">{tool.label}</span>
        {isActive && (
          <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
        )}
      </button>
    );
  };

  const drawToolsExtended = [
    { id: 'site-area', label: 'Site Area', icon: Grid, desc: 'Boundary of layout' },
    { id: 'area', label: 'Excavation', icon: Frame, desc: 'Excavated pit boundaries' },
    { id: 'discharge-area', label: 'Disc. Area', icon: Square, desc: 'Discharge/recharge zone' },
    { id: 'line', label: 'Header', icon: Pencil, desc: 'Header pipeline' },
    { id: 'hose', label: 'Suction', icon: Spline, desc: 'Suction hose connection' },
    { id: 'discharge', label: 'Discharge', icon: GitMerge, desc: 'Discharge pipeline' },
    { id: 'dimension', label: 'Dimension', icon: Ruler, desc: 'Measure distance between points' },
    { id: 'text', label: 'Text', icon: Type, desc: 'Add text annotation' },
  ];
  
  const compToolsExtended = [
    { id: 'pump', label: 'Dew. Pump', icon: Droplet, desc: 'High-capacity dewatering pump unit' },
    { id: 'tee', label: 'Place Tee', icon: CornerDownRight, desc: 'Auto-connecting pipeline Tee joint' },
    { id: 'elbow', label: 'Place Elbow', icon: Crosshair, desc: 'Auto-connecting pipeline Elbow joint' },
  ];
  
  const editToolsExtended = [
    { id: 'select', label: 'Select', icon: MousePointer2, desc: 'Select or edit items (ESC to cancel)' },
    { id: 'move', label: 'Move', icon: Move, desc: 'Move elements around canvas' },
    { id: 'copy', label: 'Copy', icon: Copy, desc: 'Duplicate selected elements' },
    { id: 'rotate', label: 'Rotate', icon: RotateCw, desc: 'Click component to rotate 90° · Right-click to flip 180°' },
    { id: 'align', label: 'Align (AL)', icon: AlignLeft, desc: 'Align component or line endpoint to a snap reference' },
    { id: 'offset', label: 'Offset (OF)', icon: SlidersHorizontal, desc: 'Create parallel offsets of lines/boundaries' },
    { id: 'mirror-pick', label: 'Mirror Pick (MM)', icon: FlipHorizontal, desc: 'Mirror elements by picking an axis' },
    { id: 'mirror-draw', label: 'Mirror Draw (DM)', icon: Pencil, desc: 'Mirror elements by drawing a mirror line' },
    { id: 'split', label: 'Split (SL)', icon: Scissors, desc: 'Split a header pipe, hose or boundary at a click point' },
    { id: 'trim', label: 'Trim/Ext (TR)', icon: CornerDownRight, desc: 'Trim or extend two header lines to join at corner' },
    { id: 'pin', label: 'Pin (PN)', icon: Pin, desc: 'Pin element to freeze position' },
    { id: 'unpin', label: 'Unpin (UP)', icon: PinOff, desc: 'Unpin element to unlock' },
    { id: 'delete', label: 'Erase', icon: Eraser, desc: 'Remove elements from canvas' },
  ];

  const showOptionsBar = 
    ['offset', 'mirror-pick', 'mirror-draw', 'site-area', 'area', 'discharge-area', 'text', 'modify-blueprint'].includes(activeTool);

  return (
    <div className="relative z-20 w-full bg-white select-none">
      <div className={`grid transition-[grid-template-rows] duration-300 ${isMobileCollapsed ? 'grid-rows-[0fr] sm:grid-rows-[1fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
          <div className="bg-white border-b border-gray-200/80 shadow-sm flex items-center px-4 py-2 space-x-6 overflow-x-auto select-none">
            
            {/* Draw Section */}
            <div className="flex flex-col space-y-1 pr-6 border-r border-gray-200">
              <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5 select-none">Draw</span>
              <div className="flex items-center space-x-1">
                {drawToolsExtended.map(renderTool)}
              </div>
            </div>

            {/* Components Section */}
            <div className="flex flex-col space-y-1 pr-6 border-r border-gray-200">
              <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5 select-none">Components</span>
              <div className="flex items-center space-x-1">
                {compToolsExtended.map(renderTool)}
              </div>
            </div>

            {/* Modify Section */}
            <div className="flex flex-col space-y-1 pr-6 border-r border-gray-200">
              <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5 select-none">Modify</span>
              <div className="flex items-center space-x-1">
                {editToolsExtended.map(renderTool)}
                <button
                  onClick={onUndo}
                  title="Undo Last Action"
                  className="flex flex-col items-center justify-center p-2 rounded transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent"
                >
                  <Undo2 size={18} className="mb-1" />
                  <span className="text-[10px] font-semibold">Undo</span>
                </button>
              </div>
            </div>

            {/* Settings / View Section */}
            <div className="flex flex-col space-y-1 pr-6">
              <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5 select-none">View / Settings</span>
              <div className="flex items-center space-x-1">
                {onToggleWellpoints && (
                  <button
                    onClick={onToggleWellpoints}
                    title={showWellpoints ? 'Hide Wellpoints' : 'Show Wellpoints'}
                    className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                      showWellpoints ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {showWellpoints ? <Eye size={18} className="mb-1" /> : <EyeOff size={18} className="mb-1" />}
                    <span className="text-[10px] font-semibold">Wellpoints</span>
                  </button>
                )}

                {onToggleWellpointSide && showWellpoints && (
                  <button
                    onClick={onToggleWellpointSide}
                    title={`Wellpoint Side: ${wellpointSide === 'left' ? 'Left' : wellpointSide === 'right' ? 'Right' : 'Both'}`}
                    className="flex flex-col items-center justify-center p-2 rounded transition-colors bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50"
                  >
                    <span className="text-[14px] mb-0.5">{wellpointSide === 'left' ? '◀' : wellpointSide === 'right' ? '▶' : '◀▶'}</span>
                    <span className="text-[10px] font-semibold">{wellpointSide === 'left' ? 'Left' : wellpointSide === 'right' ? 'Right' : 'Both'}</span>
                  </button>
                )}

                {onToggleOrtho && (
                  <button
                    onClick={onToggleOrtho}
                    title="Lock Ortho Snapping"
                    className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                      orthoLocked ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Crosshair size={18} className="mb-1" />
                    <span className="text-[10px] font-semibold">Ortho</span>
                  </button>
                )}

                {onToggleGridSnap && (
                  <button
                    onClick={onToggleGridSnap}
                    title="Toggle Grid Snap"
                    className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                      gridSnap ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Grid size={18} className="mb-1" />
                    <span className="text-[10px] font-semibold">Grid Snap</span>
                  </button>
                )}

                {onToggleFullscreen && (
                  <button
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                      isFullscreen ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {isFullscreen ? <Minimize size={18} className="mb-1" /> : <Maximize size={18} className="mb-1" />}
                    <span className="text-[10px] font-semibold">Fullscreen</span>
                  </button>
                )}

                {/* Blueprint visibility & scale triggers */}
                {hasBlueprint && (
                  <>
                    <div className="w-px h-8 bg-gray-200 mx-1"></div>
                    <button
                      onClick={() => onUpdateBlueprintSettings({ visible: !blueprintSettings.visible })}
                      title={blueprintSettings.visible ? 'Hide Blueprint Underlay' : 'Show Blueprint Underlay'}
                      className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                        blueprintSettings.visible ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Image size={18} className="mb-1" />
                      <span className="text-[10px] font-semibold">Blueprint</span>
                    </button>
                    
                    <button
                      onClick={() => onToolSelect(activeTool === 'modify-blueprint' ? 'select' : 'modify-blueprint')}
                      title="Adjust Blueprint Scale / Position / Opacity"
                      className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                        activeTool === 'modify-blueprint' ? 'bg-blue-50/70 text-blue-600 shadow-sm border border-blue-200/50' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <SlidersHorizontal size={18} className="mb-1" />
                      <span className="text-[10px] font-semibold">Scale Underlay</span>
                    </button>
                  </>
                )}

                {/* Separator */}
                <div className="w-px h-8 bg-gray-200 mx-1"></div>

                {onToggle3D && (
                  <button
                    onClick={onToggle3D}
                    className={`flex items-center justify-center px-3 py-1.5 ml-2 border border-transparent rounded-md shadow-sm text-xs font-bold transition-colors ${show3D ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                  >
                    {show3D ? 'View 2D' : 'View 3D'}
                  </button>
                )}

                {onExportDrawing && (
                  <button
                    onClick={onExportDrawing}
                    title="Export Drawing Sheet"
                    className="flex flex-col items-center justify-center p-2 rounded transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 ml-1 border border-transparent"
                  >
                    <Printer size={18} className="mb-1" />
                    <span className="text-[10px] font-semibold">Export</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Tool Chip */}
            <div className="flex-1" />
            <div className="hidden lg:flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shrink-0 select-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Tool</span>
              <span className="text-xs font-bold text-indigo-600 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                {activeTool.toUpperCase().replace('-', ' ')}
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Options Bar */}
      {showOptionsBar && (
        <div className="bg-slate-50 border-b border-gray-200 px-6 py-2 flex flex-wrap items-center gap-6 text-xs font-semibold text-gray-700 select-none animate-in slide-in-from-top duration-150 shrink-0">
          {/* Tool Identifier */}
          <div className="flex items-center gap-1.5 border-r border-gray-200 pr-4">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Options:</span>
            <span className="text-slate-700 font-bold capitalize">
              {activeTool.replace('-', ' ')}
            </span>
          </div>

          {/* Area Shape Option */}
          {['site-area', 'area', 'discharge-area'].includes(activeTool) && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Draw Shape:</span>
              <div className="flex items-center bg-gray-200 p-0.5 rounded border border-gray-300">
                <button
                  onClick={() => onDrawShapeModeChange('rect')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    drawShapeMode === 'rect' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Rectangle
                </button>
                <button
                  onClick={() => onDrawShapeModeChange('poly')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    drawShapeMode === 'poly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Polygon (Line)
                </button>
              </div>
              <span className="text-[10px] text-gray-400 italic">
                {drawShapeMode === 'rect' ? '· Drag diagonal corners' : '· Click vertices, double-click/close to finish'}
              </span>
            </div>
          )}

          {/* Offset Option */}
          {activeTool === 'offset' && (
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-medium">Offset Distance:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  className="w-16 border border-gray-300 rounded px-1.5 py-0.5 font-mono text-sm bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={offsetDistance}
                  onChange={(e) => onOffsetDistanceChange(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                />
                <span className="text-gray-500 font-mono">meters</span>
              </div>
            </div>
          )}

          {/* Mirror Option */}
          {['mirror-pick', 'mirror-draw'].includes(activeTool) && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  checked={mirrorCopy}
                  onChange={(e) => onMirrorCopyChange(e.target.checked)}
                />
                <span className="text-gray-700">Copy (Duplicate)</span>
              </label>
              <span className="text-[10px] text-gray-400 italic">
                {mirrorCopy ? '· Will duplicate elements across axis' : '· Will move elements to mirrored position'}
              </span>
            </div>
          )}

          {/* Text Tool Option */}
          {activeTool === 'text' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Font Size:</span>
                <input
                  type="number"
                  min="8"
                  max="72"
                  className="w-14 border border-gray-300 rounded px-1.5 py-0.5 font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={textSize}
                  onChange={(e) => onTextSizeChange(Math.max(8, parseInt(e.target.value) || 12))}
                />
                <span className="text-gray-400">px</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Color:</span>
                <input
                  type="color"
                  className="w-7 h-7 border border-gray-300 rounded p-0 bg-transparent cursor-pointer"
                  value={textColor}
                  onChange={(e) => onTextColorChange(e.target.value)}
                />
              </div>
              <span className="text-[10px] text-gray-400 italic">· Click canvas to place floating text</span>
            </div>
          )}

          {/* Modify Blueprint Options */}
          {activeTool === 'modify-blueprint' && (
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="w-24 cursor-pointer"
                  value={Math.round(blueprintSettings.opacity * 100)}
                  onChange={(e) => onUpdateBlueprintSettings({ opacity: parseFloat(e.target.value) / 100 })}
                />
                <span className="font-mono w-8 text-right text-xs">{Math.round(blueprintSettings.opacity * 100)}%</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Visibility:</span>
                <button
                  onClick={() => onUpdateBlueprintSettings({ visible: !blueprintSettings.visible })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    blueprintSettings.visible ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-150 border-gray-300 text-gray-500'
                  }`}
                >
                  {blueprintSettings.visible ? 'Visible' : 'Hidden'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Underlay Interaction:</span>
                <button
                  onClick={() => {
                    const nextLock = !blueprintSettings.locked;
                    onUpdateBlueprintSettings({ locked: nextLock });
                    if (nextLock) {
                      onToolSelect('select');
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                    blueprintSettings.locked ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-green-50 border-green-200 text-green-600'
                  }`}
                >
                  {blueprintSettings.locked ? <Pin size={10} /> : <PinOff size={10} />}
                  {blueprintSettings.locked ? 'Pinned (Locked)' : 'Unpinned (Transformable)'}
                </button>
              </div>

              <div className="sm:ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onStartReferenceScale) onStartReferenceScale();
                  }}
                  disabled={isSettingScale}
                  className={`border rounded px-2 py-0.5 transition-colors text-[10px] font-bold flex items-center gap-1 ${
                    isSettingScale
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-800 border-gray-300 hover:bg-gray-100'
                  }`}
                  title="Scale by selecting two points of known length"
                >
                  <Ruler size={10} />
                  Set Reference Scale
                </button>
                <button
                  onClick={() => onUpdateBlueprintSettings({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 })}
                  className="text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-100 transition-colors text-[10px] font-bold"
                >
                  Reset Position & Scale
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Collapse Toggle Button */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 sm:hidden -mt-[1px]">
        <button
          onClick={() => setIsMobileCollapsed(!isMobileCollapsed)}
          className="flex items-center justify-center w-12 h-6 bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {isMobileCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </div>
  );
};
