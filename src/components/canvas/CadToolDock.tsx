import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer2, Move, Copy,
  Frame, Square, Grid,
  Ruler, Type, ArrowRight,
  RotateCw, SlidersHorizontal, Scissors, AlignLeft, FlipHorizontal, Pin, Eraser,
  ChevronsRight, ChevronsLeft, Check,
  Layers, Spline, Compass, Hand
} from 'lucide-react';
import type { ActiveTool } from './Toolbar';

export interface ToolDef {
  id: ActiveTool;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  description?: string;
}

export interface ToolSlot {
  id: string;
  category: string;
  defaultTool: ActiveTool;
  tools: ToolDef[];
}

// ── Precision CAD/Photoshop SVG Icons for Components ──

export const ElbowIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* 90 degree pipe bend */}
    <path d="M4 19 L4 12 C4 7.58 7.58 4 12 4 L19 4" strokeWidth="2.5" />
    <path d="M7 19 L7 13 C7 9.69 9.69 7 13 7 L19 7" strokeWidth="1.5" strokeOpacity="0.6" />
    {/* Flange collars */}
    <line x1="2" y1="19" x2="9" y2="19" strokeWidth="3" />
    <line x1="19" y1="2" x2="19" y2="9" strokeWidth="3" />
  </svg>
);

export const TeeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Run pipe */}
    <line x1="4" y1="8" x2="20" y2="8" strokeWidth="2.5" />
    {/* Branch pipe */}
    <line x1="12" y1="8" x2="12" y2="20" strokeWidth="2.5" />
    {/* Flange collars */}
    <line x1="4" y1="5" x2="4" y2="11" strokeWidth="3" />
    <line x1="20" y1="5" x2="20" y2="11" strokeWidth="3" />
    <line x1="9" y1="20" x2="15" y2="20" strokeWidth="3" />
  </svg>
);

export const IngressIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Concentric inflow water rings */}
    <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="12" cy="12" r="5.5" strokeWidth="1.75" />
    {/* Center intake vortex */}
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    {/* Inflow directional arrows */}
    <path d="M12 2 L12 5 M12 4 L10 5 M12 4 L14 5" strokeWidth="1.5" />
    <path d="M22 12 L19 12 M20 10 L19 12 M20 14 L19 12" strokeWidth="1.5" />
    <path d="M12 22 L12 19 M10 20 L12 19 M14 20 L12 19" strokeWidth="1.5" />
    <path d="M2 12 L5 12 M4 10 L5 12 M4 14 L5 12" strokeWidth="1.5" />
  </svg>
);

export const PumpIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Centrifugal volute casing */}
    <circle cx="12" cy="13" r="6.5" strokeWidth="2" />
    <circle cx="12" cy="13" r="2.5" fill="currentColor" />
    {/* Suction inlet (left) */}
    <line x1="2" y1="13" x2="5.5" y2="13" strokeWidth="3" />
    {/* Discharge outlet (top) */}
    <line x1="12" y1="2" x2="12" y2="6.5" strokeWidth="3" />
    {/* Base plate */}
    <line x1="6" y1="21" x2="18" y2="21" strokeWidth="2.5" />
  </svg>
);

export const HeaderPipeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Header line with Bauer couplings */}
    <line x1="5" y1="12" x2="19" y2="12" strokeWidth="3.5" />
    <rect x="2" y1="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="19" y1="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
    {/* Quick test points */}
    <circle cx="12" cy="9" r="1" fill="currentColor" />
  </svg>
);

export const SuctionHoseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 18 C 7 18, 9 14, 12 12 C 15 10, 17 6, 20 6" strokeWidth="2.5" strokeDasharray="2 1.5" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <circle cx="20" cy="6" r="2" fill="currentColor" />
  </svg>
);

export const DischargePipeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="12" x2="18" y2="12" strokeWidth="2.5" />
    <polyline points="14 8 18 12 14 16" strokeWidth="2" />
    <line x1="3" y1="7" x2="3" y2="17" strokeWidth="2.5" />
  </svg>
);

// ── Photoshop-Style Grouped Tool Slots Definition ──

const TOOL_SLOTS: ToolSlot[] = [
  {
    id: 'slot-navigate',
    category: 'Navigate',
    defaultTool: 'select',
    tools: [
      { id: 'select', label: 'Select / Edit', icon: <MousePointer2 size={16} />, shortcut: 'V', description: 'Select, drag, or edit elements' },
      { id: 'pan', label: 'Pan Tool', icon: <Hand size={16} />, shortcut: 'H', description: 'Click and drag to pan the canvas view' },
      { id: 'move', label: 'Move / Reposition', icon: <Move size={16} />, shortcut: 'M', description: 'Reposition objects on canvas' },
      { id: 'copy', label: 'Copy Selection', icon: <Copy size={16} />, shortcut: 'Co', description: 'Duplicate active element' },
    ],
  },
  {
    id: 'slot-pipes',
    category: 'Pipes',
    defaultTool: 'line',
    tools: [
      { id: 'line', label: 'Header Pipe', icon: <HeaderPipeIcon size={16} />, shortcut: 'L', description: 'DN150 Bauer quick-coupling header line' },
      { id: 'hose', label: 'Suction Hose', icon: <SuctionHoseIcon size={16} />, shortcut: 'S', description: 'Flexible suction hose connector' },
      { id: 'discharge', label: 'Discharge Pipe', icon: <DischargePipeIcon size={16} />, shortcut: 'D', description: 'Discharge runoff line to outlet' },
    ],
  },
  {
    id: 'slot-components',
    category: 'Components',
    defaultTool: 'pump',
    tools: [
      { id: 'pump', label: 'Dewatering Pump', icon: <PumpIcon size={16} />, shortcut: 'P', description: 'Vacuum-assisted centrifugal pump (150 m³/h)' },
      { id: 'ingress', label: 'Water Ingress', icon: <IngressIcon size={16} />, shortcut: 'I', description: 'Water inflow / sump pit intake point' },
      { id: 'tee', label: 'Tee Connector', icon: <TeeIcon size={16} />, shortcut: 'Te', description: '3-way DN150 Bauer branch tee joint' },
      { id: 'elbow', label: 'Elbow Fitting', icon: <ElbowIcon size={16} />, shortcut: 'El', description: '90° Bauer directional pipe bend' },
    ],
  },
  {
    id: 'slot-areas',
    category: 'Areas',
    defaultTool: 'area',
    tools: [
      { id: 'area', label: 'Excavation Area', icon: <Frame size={16} />, shortcut: 'E', description: 'Define excavation pit polygon' },
      { id: 'site-area', label: 'Site Boundary', icon: <Grid size={16} />, shortcut: 'B', description: 'Overall job site boundary limits' },
      { id: 'discharge-area', label: 'Discharge Area', icon: <Square size={16} />, shortcut: 'Da', description: 'Designated water retention / settlement pond' },
    ],
  },
  {
    id: 'slot-annotations',
    category: 'Annotations',
    defaultTool: 'dimension',
    tools: [
      { id: 'dimension', label: 'Dimension', icon: <Ruler size={16} />, shortcut: 'Di', description: 'Measure distances and draw linear dims' },
      { id: 'text', label: 'Text Annotation', icon: <Type size={16} />, shortcut: 'T', description: 'Place labels, specifications, and notes' },
      { id: 'arrow', label: 'Direction Arrow', icon: <ArrowRight size={16} />, shortcut: 'Ar', description: 'Indicate water flow or site access' },
    ],
  },
  {
    id: 'slot-modify',
    category: 'Modify',
    defaultTool: 'rotate',
    tools: [
      { id: 'rotate', label: 'Rotate', icon: <RotateCw size={16} />, shortcut: 'R', description: 'Rotate selected element' },
      { id: 'offset', label: 'Offset', icon: <SlidersHorizontal size={16} />, shortcut: 'O', description: 'Offset parallel boundary or line' },
      { id: 'split', label: 'Split Line', icon: <Scissors size={16} />, shortcut: 'Sp', description: 'Break header pipe at specific point' },
      { id: 'trim', label: 'Trim / Extend', icon: <AlignLeft size={16} />, shortcut: 'Tr', description: 'Trim or extend conduit to intersection' },
      { id: 'mirror-pick', label: 'Mirror', icon: <FlipHorizontal size={16} />, shortcut: 'Mi', description: 'Mirror elements along axis' },
      { id: 'pin', label: 'Pin / Lock', icon: <Pin size={16} />, shortcut: 'Pn', description: 'Lock position to prevent accidental edits' },
    ],
  },
  {
    id: 'slot-erase',
    category: 'Erase',
    defaultTool: 'delete',
    tools: [
      { id: 'delete', label: 'Erase Element', icon: <Eraser size={16} />, shortcut: 'Del', description: 'Click element or node to delete' },
    ],
  },
];

interface CadToolDockProps {
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
  orthoLocked: boolean;
  onToggleOrtho: () => void;
  gridSnap: boolean;
  onToggleGridSnap: () => void;
  onToggleLayers: () => void;
  showWellpoints: boolean;
  onToggleWellpoints: () => void;
  showLayers?: boolean;
  showNavWheel?: boolean;
  onToggleNavWheel?: () => void;
}

export function CadToolDock({
  activeTool,
  onToolSelect,
  orthoLocked,
  onToggleOrtho,
  gridSnap,
  onToggleGridSnap,
  onToggleLayers,
  showWellpoints,
  onToggleWellpoints,
  showLayers,
  showNavWheel,
  onToggleNavWheel,
}: CadToolDockProps) {
  // Photoshop 1-column vs 2-column mode toggle (state remembered in localStorage)
  const [isDoubleColumn, setIsDoubleColumn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dewatercad_tool_columns') === '2';
    } catch {
      return false;
    }
  });

  // Track the most recently used tool for each slot (Photoshop memory behavior)
  const [slotTools, setSlotTools] = useState<Record<string, ActiveTool>>(() => {
    const initial: Record<string, ActiveTool> = {};
    TOOL_SLOTS.forEach(slot => {
      initial[slot.id] = slot.defaultTool;
    });
    return initial;
  });

  // Active flyout menu state
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const flyoutAnchorRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync slotTools when activeTool changes externally
  useEffect(() => {
    TOOL_SLOTS.forEach(slot => {
      const match = slot.tools.find(t => t.id === activeTool);
      if (match) {
        setSlotTools(prev => ({ ...prev, [slot.id]: match.id }));
      }
    });
  }, [activeTool]);

  // Close flyout when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.photoshop-flyout-container')) {
        setOpenFlyoutId(null);
      }
    };
    if (openFlyoutId) {
      window.addEventListener('mousedown', handleOutsideClick);
      return () => window.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [openFlyoutId]);

  const toggleColumns = () => {
    setIsDoubleColumn(prev => {
      const next = !prev;
      try {
        localStorage.setItem('dewatercad_tool_columns', next ? '2' : '1');
      } catch {}
      return next;
    });
  };

  const handleToolSlotClick = (slot: ToolSlot) => {
    // Single click selects the currently remembered tool for this slot
    const currentToolId = slotTools[slot.id] || slot.defaultTool;
    onToolSelect(currentToolId);
  };

  const handleMouseDown = (slot: ToolSlot) => {
    // Photoshop long-press: open flyout if held for 250ms
    if (slot.tools.length <= 1) return;
    pressTimerRef.current = setTimeout(() => {
      setOpenFlyoutId(slot.id);
    }, 250);
  };

  const handleMouseUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, slot: ToolSlot) => {
    // Photoshop right-click immediately opens flyout
    if (slot.tools.length > 1) {
      e.preventDefault();
      e.stopPropagation();
      setOpenFlyoutId(openFlyoutId === slot.id ? null : slot.id);
    }
  };

  const selectSubTool = (slotId: string, toolId: ActiveTool) => {
    setSlotTools(prev => ({ ...prev, [slotId]: toolId }));
    onToolSelect(toolId);
    setOpenFlyoutId(null);
  };

  return (
    <aside
      className={`photoshop-flyout-container relative flex-shrink-0 flex flex-col items-center bg-white border-r border-slate-200 select-none z-50 shadow-sm transition-all duration-150 overflow-visible ${
        isDoubleColumn ? 'w-[82px]' : 'w-11'
      }`}
    >
      {/* ── Top Header: Photoshop Double Arrow (>> / <<) & Gripper Handle ── */}
      <div className="w-full flex flex-col items-center pt-1.5 pb-1 border-b border-slate-100">
        <button
          onClick={toggleColumns}
          title={isDoubleColumn ? 'Collapse to Single Column (<<)' : 'Expand to Two Columns (>>)'}
          className="flex items-center justify-center w-7 h-5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          {isDoubleColumn ? <ChevronsLeft size={13} /> : <ChevronsRight size={13} />}
        </button>

        {/* Textured Drag / Gripper Bar (||||||||) */}
        <div 
          className="flex items-center justify-center gap-0.5 my-1 cursor-default opacity-40 hover:opacity-80 transition-opacity" 
          title="DewaterCAD Tool Dock"
        >
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
        </div>
      </div>

      {/* ── Tool Slots Grid (1-Col or 2-Col) ── */}
      <div className="w-full overflow-visible py-1 px-1 flex flex-col items-center">
        <div className={isDoubleColumn ? 'grid grid-cols-2 gap-1 w-full justify-items-center' : 'flex flex-col gap-1 w-full items-center'}>
          {TOOL_SLOTS.map(slot => {
            const currentToolId = slotTools[slot.id] || slot.defaultTool;
            const currentTool = slot.tools.find(t => t.id === currentToolId) || slot.tools[0];
            const isSlotActive = slot.tools.some(t => t.id === activeTool);
            const hasMultiple = slot.tools.length > 1;
            const isFlyoutOpen = openFlyoutId === slot.id;

            return (
              <div key={slot.id} className="relative group">
                {/* Main Tool Button */}
                <button
                  ref={el => { flyoutAnchorRef.current[slot.id] = el; }}
                  onClick={() => handleToolSlotClick(slot)}
                  onMouseDown={() => handleMouseDown(slot)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={e => handleContextMenu(e, slot)}
                  title={`${currentTool.label}${currentTool.shortcut ? ` (${currentTool.shortcut})` : ''} — ${hasMultiple ? 'Right-click or hold for more' : ''}`}
                  className={`relative flex items-center justify-center w-8 h-8 rounded transition-all duration-75 ${
                    isSlotActive
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {currentTool.icon}

                  {/* Photoshop Corner Triangle (◢) indicating sub-tools */}
                  {hasMultiple && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFlyoutId(isFlyoutOpen ? null : slot.id);
                      }}
                      title="Click or hold to reveal grouped tools"
                      className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 cursor-pointer pointer-events-auto"
                    >
                      <svg viewBox="0 0 6 6" className={`w-1.5 h-1.5 ${isSlotActive ? 'fill-blue-200' : 'fill-slate-400 group-hover:fill-slate-600'}`}>
                        <polygon points="6,0 6,6 0,6" />
                      </svg>
                    </span>
                  )}

                  {/* Inset border when active */}
                  {isSlotActive && (
                    <span className="absolute inset-0 rounded border border-white/25 pointer-events-none" />
                  )}
                </button>

                {/* ── Photoshop-Style Flyout Popout Submenu ── */}
                {isFlyoutOpen && hasMultiple && (
                  <div
                    className="absolute left-full top-0 ml-2 z-[100] bg-white border border-slate-200 rounded-lg shadow-2xl py-1 px-1 min-w-[215px] animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
                    style={{ filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.22))' }}
                  >
                    <div className="px-2 py-1 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {slot.category} Tools
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">Long-press / Right-click</span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      {slot.tools.map(subTool => {
                        const isSubActive = activeTool === subTool.id;
                        return (
                          <button
                            key={subTool.id}
                            onClick={() => selectSubTool(slot.id, subTool.id)}
                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors w-full ${
                              isSubActive
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <span className={`flex items-center justify-center w-5 h-5 rounded ${isSubActive ? 'text-blue-600' : 'text-slate-500'}`}>
                              {subTool.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="truncate">{subTool.label}</span>
                                {subTool.shortcut && (
                                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200 ml-2">
                                    {subTool.shortcut}
                                  </span>
                                )}
                              </div>
                              {subTool.description && (
                                <p className="text-[9px] text-slate-400 truncate leading-tight font-normal">
                                  {subTool.description}
                                </p>
                              )}
                            </div>
                            {isSubActive && <Check size={13} className="text-blue-600 flex-shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Utility / Snap Controls ── */}
      <div className="w-full border-t border-slate-200 py-1.5 px-1 bg-slate-50/50 flex flex-col items-center gap-1">
        <div className={isDoubleColumn ? 'grid grid-cols-2 gap-1 w-full justify-items-center' : 'flex flex-col gap-1 items-center'}>
          {/* Layers Panel Toggle */}
          <button
            onClick={onToggleLayers}
            title={`Toggle Layers & Levels (F7) ${showLayers ? '(Active)' : ''}`}
            className={`flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer ${
              showLayers
                ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-xs'
                : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:border hover:border-slate-200'
            }`}
          >
            <Layers size={15} />
          </button>

          {/* Wellpoint System Toggle */}
          <button
            onClick={onToggleWellpoints}
            title={showWellpoints ? 'Hide Wellpoints' : 'Show Wellpoints'}
            className={`flex items-center justify-center w-8 h-8 rounded transition-all ${
              showWellpoints
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            <Spline size={15} />
          </button>

          {/* Ortho Mode (F8) */}
          <button
            onClick={onToggleOrtho}
            title={`Ortho Mode ${orthoLocked ? 'ON' : 'OFF'} (F8)`}
            className={`flex items-center justify-center w-8 h-8 rounded font-bold text-xs transition-all ${
              orthoLocked
                ? 'bg-amber-50 text-amber-600 border border-amber-300'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            ⊥
          </button>

          {/* Grid Snap (F9) */}
          <button
            onClick={onToggleGridSnap}
            title={`Grid Snap ${gridSnap ? 'ON' : 'OFF'} (F9)`}
            className={`flex items-center justify-center w-8 h-8 rounded transition-all ${
              gridSnap
                ? 'bg-blue-50 text-blue-600 border border-blue-300'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            <Grid size={15} />
          </button>

          {/* 3D Navigator Toggle */}
          {onToggleNavWheel && (
            <button
              onClick={onToggleNavWheel}
              title={`3D Navigator ${showNavWheel ? '(Active)' : ''}`}
              className={`flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer ${
                showNavWheel
                  ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-xs'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:border hover:border-slate-200'
              }`}
            >
              <Compass size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default CadToolDock;
