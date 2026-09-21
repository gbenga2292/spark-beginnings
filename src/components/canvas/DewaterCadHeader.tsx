import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Edit3, Eye, Wrench, Download, Share2, Save,
  FilePlus, FolderOpen, Upload, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize2, Grid3x3, Layout, Calculator,
  ChevronDown, Box, Pencil, X, Loader2, Settings
} from 'lucide-react';

export type ViewMode = '2d' | '3d' | 'calc';

interface DewaterCadHeaderProps {
  currentLayoutName: string;
  onLayoutNameChange: (name: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNew: () => void;
  onSave: () => void;
  onUpdate: () => void;
  onOpenLoad: () => void;
  onExport: () => void;
  onUploadBlueprint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomAll: () => void;
  orthoLocked: boolean;
  onToggleOrtho: () => void;
  gridSnap: boolean;
  onToggleGridSnap: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showBOQ?: boolean;
  onToggleBOQ?: () => void;
  boqResults?: any;
  onClearBOQ?: () => void;
  isSaving: boolean;
  isDirty: boolean;
  hasLayout: boolean;
}

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

function Dropdown({ items, onClose }: { label: string; items: DropdownItem[]; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-0.5 w-52 rounded-lg border border-gray-200 bg-white shadow-xl z-[200] py-1 animate-in fade-in slide-in-from-top-1 duration-100">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.divider && <div className="my-1 border-t border-gray-100" />}
          <button
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {item.icon && <span className="w-3.5 h-3.5 opacity-60">{item.icon}</span>}
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && <span className="text-gray-400 text-[10px]">{item.shortcut}</span>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function DewaterCadHeader({
  currentLayoutName, onLayoutNameChange,
  viewMode, onViewModeChange,
  onNew, onSave, onUpdate, onOpenLoad, onExport, onUploadBlueprint,
  onUndo, onRedo, canUndo, canRedo,
  onZoomIn, onZoomOut, onZoomAll,
  orthoLocked, onToggleOrtho, gridSnap, onToggleGridSnap,
  isFullscreen, onToggleFullscreen,
  showBOQ, onToggleBOQ,
  boqResults, onClearBOQ,
  isSaving, isDirty, hasLayout,
}: DewaterCadHeaderProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const isBoqOpen = openMenu === 'boq';
  const toggleBoq = () => setOpenMenu(prev => prev === 'boq' ? null : 'boq');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(currentLayoutName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const boqDropdownRef = useRef<HTMLDivElement>(null);

  const boqItems = useMemo(() => {
    if (!boqResults) return [];
    const items: Array<{ name: string; value: number | string; unit: string }> = [];
    if (boqResults.headers > 0 || boqResults.totalLengthMeters > 0) {
      items.push({ name: 'Header Pipes', value: `${boqResults.headers} pcs (${boqResults.totalLengthMeters || 0}m)`, unit: '' });
    }
    if (boqResults.wellpoints > 0) {
      items.push({ name: 'Wellpoints & Risers', value: boqResults.wellpoints, unit: 'pts' });
    }
    if (boqResults.pumps > 0) {
      items.push({ name: 'Dewatering Vacuum Pumps', value: boqResults.pumps, unit: 'units' });
    }
    if (boqResults.elbows > 0) {
      items.push({ name: '90° Elbow Fittings', value: boqResults.elbows, unit: 'pcs' });
    }
    if (boqResults.tees > 0) {
      items.push({ name: 'Tee Junctions', value: boqResults.tees, unit: 'pcs' });
    }
    if (boqResults.endCaps > 0) {
      items.push({ name: 'Header End Caps', value: boqResults.endCaps, unit: 'pcs' });
    }
    if (boqResults.suctionHoses > 0) {
      items.push({ name: 'Suction Flexible Hoses', value: boqResults.suctionHoses, unit: 'lines' });
    }
    if (boqResults.dischargeHoseMeters > 0) {
      items.push({ name: 'Discharge Pipeline', value: `${boqResults.dischargeHoseMeters}`, unit: 'm' });
    }
    if (boqResults.couplings > 0 || boqResults.clips > 0) {
      items.push({ name: 'Quick Couplings', value: boqResults.couplings || boqResults.clips, unit: 'sets' });
    }
    return items;
  }, [boqResults]);

  const boqTotalItems = useMemo(() => {
    if (!boqResults) return 0;
    return (boqResults.headers || 0) + (boqResults.wellpoints || 0) + (boqResults.pumps || 0) + (boqResults.elbows || 0) + (boqResults.tees || 0);
  }, [boqResults]);

  useEffect(() => { setDraftName(currentLayoutName); }, [currentLayoutName]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleMenu = (menu: string) => setOpenMenu(prev => prev === menu ? null : menu);

  const fileItems: DropdownItem[] = [
    { label: 'New Drawing', icon: <FilePlus size={12} />, onClick: onNew, shortcut: 'Ctrl+N' },
    { label: 'Open / Load', icon: <FolderOpen size={12} />, onClick: onOpenLoad, shortcut: 'Ctrl+O' },
    { label: 'Save', icon: <Save size={12} />, onClick: onSave, shortcut: 'Ctrl+S', divider: true },
    { label: 'Save / Update', icon: <Save size={12} />, onClick: onUpdate, disabled: !hasLayout },
    { label: 'Import Blueprint', icon: <Upload size={12} />, onClick: onUploadBlueprint, divider: true },
    { label: 'Export Sheet (PDF)', icon: <Download size={12} />, onClick: onExport },
  ];

  const editItems: DropdownItem[] = [
    { label: 'Undo', icon: <Undo2 size={12} />, onClick: onUndo, disabled: !canUndo, shortcut: 'Ctrl+Z' },
    { label: 'Redo', icon: <Redo2 size={12} />, onClick: onRedo, disabled: !canRedo, shortcut: 'Ctrl+Y' },
  ];

  const viewItems: DropdownItem[] = [
    { label: 'Zoom In', icon: <ZoomIn size={12} />, onClick: onZoomIn, shortcut: '+' },
    { label: 'Zoom Out', icon: <ZoomOut size={12} />, onClick: onZoomOut, shortcut: '-' },
    { label: 'Zoom All (Fit)', icon: <Maximize2 size={12} />, onClick: onZoomAll, shortcut: 'A' },
    { label: `Ortho Lock ${orthoLocked ? '✓' : ''}`, icon: <Layout size={12} />, onClick: onToggleOrtho, shortcut: 'F8', divider: true },
    { label: `Grid Snap ${gridSnap ? '✓' : ''}`, icon: <Grid3x3 size={12} />, onClick: onToggleGridSnap, shortcut: 'F9' },
    { label: `${isFullscreen ? 'Exit' : 'Enter'} Fullscreen`, icon: <Maximize2 size={12} />, onClick: onToggleFullscreen, shortcut: 'F11', divider: true },
    ...(onToggleBOQ ? [{ label: `BOQ Panel ${showBOQ ? '✓' : ''}`, icon: <Calculator size={12} />, onClick: onToggleBOQ, shortcut: 'B' }] : []),
  ];

  const toolsItems: DropdownItem[] = [
    { label: 'Switch to 3D View', icon: <Box size={12} />, onClick: () => onViewModeChange('3d') },
    { label: 'Switch to 2D Draft', icon: <Pencil size={12} />, onClick: () => onViewModeChange('2d') },
    { label: 'Open Calculator', icon: <Calculator size={12} />, onClick: () => onViewModeChange('calc') },
  ];

  const menus = [
    { key: 'file', label: 'File', items: fileItems },
    { key: 'edit', label: 'Edit', items: editItems },
    { key: 'view', label: 'View', items: viewItems },
    { key: 'tools', label: 'Tools', items: toolsItems },
  ];

  const displayName = currentLayoutName || 'Untitled Drawing';

  return (
    <header
      ref={headerRef}
      className="flex-shrink-0 h-10 flex items-center gap-0 bg-white border-b border-gray-200 px-2 z-30 select-none shadow-sm"
    >
      {/* Brand */}
      <div className="flex items-center gap-1.5 pl-1 pr-3 mr-1 border-r border-gray-200">
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Box size={11} className="text-white" />
        </div>
        <span className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">DewaterCAD</span>
      </div>

      {/* Menus */}
      <div className="flex items-center">
        {menus.map(m => (
          <div key={m.key} className="relative">
            <button
              onClick={() => toggleMenu(m.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                openMenu === m.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
            {openMenu === m.key && (
              <Dropdown label={m.label} items={m.items} onClose={() => setOpenMenu(null)} />
            )}
          </div>
        ))}
      </div>

      {/* Active File Pill */}
      <div className="flex-1 flex justify-center">
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={() => {
              if (draftName.trim()) onLayoutNameChange(draftName.trim());
              setEditingName(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { if (draftName.trim()) onLayoutNameChange(draftName.trim()); setEditingName(false); }
              if (e.key === 'Escape') { setDraftName(currentLayoutName); setEditingName(false); }
            }}
            className="bg-white border border-blue-400 rounded px-2 py-0.5 text-[11px] text-gray-800 text-center outline-none w-52 shadow-sm"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            title="Click to rename layout"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group max-w-xs"
          >
            <FileText size={11} className="text-gray-400 flex-shrink-0" />
            <span className="text-[11px] text-gray-600 group-hover:text-blue-700 truncate max-w-[200px]">
              {displayName}
              {isDirty && <span className="ml-1 text-amber-500">•</span>}
            </span>
            <Edit3 size={9} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Segmented View Switcher */}
      <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200 p-0.5 mr-3">
        {([
          { mode: '2d' as ViewMode, label: '2D Draft', icon: <Pencil size={10} /> },
          { mode: '3d' as ViewMode, label: '3D Iso', icon: <Box size={10} /> },
          { mode: 'calc' as ViewMode, label: 'Calc', icon: <Calculator size={10} /> },
        ] as const).map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              viewMode === mode
                ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* BOQ Quantities Dropdown in Title Bar */}
      <div className="relative mr-2" ref={boqDropdownRef}>
        <button
          type="button"
          onClick={toggleBoq}
          title="Bill of Quantities (B)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
            isBoqOpen
              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
          }`}
        >
          <Calculator size={11} className="text-amber-600 flex-shrink-0" />
          <span>BOQ</span>
          {boqTotalItems > 0 && (
            <span className="bg-amber-500 text-white text-[8.5px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-tight">
              {boqTotalItems}
            </span>
          )}
          <ChevronDown size={10} className={`text-amber-600 transition-transform ${isBoqOpen ? 'rotate-180' : ''}`} />
        </button>

        {isBoqOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl z-[300] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">BOQ · Quantities</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenMenu(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            {/* Concise Minimalist Items List */}
            <div className="p-2 space-y-1 text-[11px] max-h-72 overflow-y-auto">
              {boqItems.length === 0 ? (
                <p className="text-slate-400 text-center py-3 italic text-[11px]">No elements placed on canvas</p>
              ) : (
                boqItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50 transition-colors">
                    <span className="text-slate-600">{item.name}</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                      {item.value} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {onClearBOQ && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Live Simulation BOM</span>
                <button
                  type="button"
                  onClick={() => { onClearBOQ(); setOpenMenu(null); }}
                  className="text-red-500 hover:text-red-700 font-semibold hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Download size={12} />
          <span>Export</span>
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); }}
          title="Copy share link"
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Share2 size={12} />
          <span>Share</span>
        </button>
        <button
          onClick={hasLayout ? onUpdate : onSave}
          disabled={isSaving || (!isDirty && hasLayout)}
          className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          <span>Save</span>
        </button>
      </div>
    </header>
  );
}

export default DewaterCadHeader;
