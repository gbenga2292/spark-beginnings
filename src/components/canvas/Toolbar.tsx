import React, { useState } from 'react';
import { MousePointer2, Pencil, Droplet, GitMerge, CornerDownRight, Square, Undo2, Eraser, Eye, EyeOff, Crosshair, Maximize, Minimize, Grid, Ruler, Spline, Frame, ChevronUp, ChevronDown, Printer } from 'lucide-react';
import { ComponentType } from '../../utils/simulationLogic';

export type ActiveTool = 'select' | 'line' | 'dimension' | 'delete' | 'area' | 'hose' | 'discharge' | 'discharge-area' | 'site-area' | ComponentType;

interface ToolbarProps {
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
  onUndo: () => void;
  showWellpoints?: boolean;
  onToggleWellpoints?: () => void;
  orthoLocked?: boolean;
  onToggleOrtho?: () => void;
  gridSnap?: boolean;
  onToggleGridSnap?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  show3D?: boolean;
  onToggle3D?: () => void;
  onExportDrawing?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  activeTool, onToolSelect, onUndo, 
  showWellpoints, onToggleWellpoints, 
  orthoLocked, onToggleOrtho, 
  gridSnap, onToggleGridSnap,
  isFullscreen, onToggleFullscreen,
  show3D, onToggle3D,
  onExportDrawing
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
    { id: 'select', label: 'Select/Edit', icon: MousePointer2 },
    { id: 'delete', label: 'Erase', icon: Eraser },
  ];

  const renderTool = (tool: {id: string, label: string, icon: any}) => {
    const Icon = tool.icon;
    const isActive = activeTool === tool.id;
    return (
      <button
        key={tool.id}
        onClick={() => onToolSelect(tool.id as ActiveTool)}
        title={tool.label}
        className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
          isActive 
            ? 'bg-blue-100 text-blue-700 shadow-inner' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon size={20} className="mb-1" />
        <span className="text-[10px] font-medium">{tool.label}</span>
      </button>
    );
  };

  return (
    <div className="relative z-20 w-full bg-white">
      <div className={`grid transition-[grid-template-rows] duration-300 ${isMobileCollapsed ? 'grid-rows-[0fr] sm:grid-rows-[1fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
          <div className="bg-white border-b border-gray-200 shadow-sm flex items-center px-4 py-2 space-x-6 overflow-x-auto select-none">
            
            {/* Draw Section */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-6">
              {drawTools.map(renderTool)}
            </div>

            {/* Components Section */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-6">
              {compTools.map(renderTool)}
            </div>

            {/* Modify Section */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-6">
              {editTools.map(renderTool)}
              <button
                onClick={onUndo}
                title="Undo Last Action"
                className="flex flex-col items-center justify-center p-2 rounded transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <Undo2 size={20} className="mb-1" />
                <span className="text-[10px] font-medium">Undo</span>
              </button>
            </div>

            {/* Settings / View Section */}
            <div className="flex items-center space-x-1">
              {onToggleWellpoints && (
                <button
                  onClick={onToggleWellpoints}
                  title={showWellpoints ? 'Hide Wellpoints' : 'Show Wellpoints'}
                  className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                    showWellpoints ? 'bg-blue-100 text-blue-700 shadow-inner' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {showWellpoints ? <Eye size={20} className="mb-1" /> : <EyeOff size={20} className="mb-1" />}
                  <span className="text-[10px] font-medium">Wellpoints</span>
                </button>
              )}

              {onToggleOrtho && (
                <button
                  onClick={onToggleOrtho}
                  title="Lock Ortho Snapping"
                  className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                    orthoLocked ? 'bg-blue-100 text-blue-700 shadow-inner' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Crosshair size={20} className="mb-1" />
                  <span className="text-[10px] font-medium">Ortho</span>
                </button>
              )}

              {onToggleGridSnap && (
                <button
                  onClick={onToggleGridSnap}
                  title="Toggle Grid Snap"
                  className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                    gridSnap ? 'bg-blue-100 text-blue-700 shadow-inner' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Grid size={20} className="mb-1" />
                  <span className="text-[10px] font-medium">Grid Snap</span>
                </button>
              )}

              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                    isFullscreen ? 'bg-blue-100 text-blue-700 shadow-inner' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {isFullscreen ? <Minimize size={20} className="mb-1" /> : <Maximize size={20} className="mb-1" />}
                  <span className="text-[10px] font-medium">Fullscreen</span>
                </button>
              )}

              {/* Separator */}
              <div className="w-px h-10 bg-gray-300 mx-1"></div>

              {onToggle3D && (
                <button
                  onClick={onToggle3D}
                  className={`flex items-center justify-center px-4 py-2 ml-2 border border-transparent rounded-md shadow-sm text-sm font-medium transition-colors ${show3D ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  {show3D ? 'View 2D' : 'View 3D'}
                </button>
              )}

              {onExportDrawing && (
                <button
                  onClick={onExportDrawing}
                  title="Export Drawing Sheet"
                  className="flex flex-col items-center justify-center p-2 rounded transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 ml-1"
                >
                  <Printer size={20} className="mb-1" />
                  <span className="text-[10px] font-medium">Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
