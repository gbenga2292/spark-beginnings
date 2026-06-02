import React, { useState } from 'react';
import { Lock, Unlock, ChevronUp, ChevronDown, Layers, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { ElevationLevel } from '../../utils/simulationLogic';
import { CADLayer } from '../../utils/cadDataModels';

interface LayerItem {
  id: string;
  type: 'area' | 'line' | 'component';
  label: string;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  color: string;
}

interface DesignPanelProps {
  layerItems: LayerItem[];
  selectedId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringToFront: (id: string) => void;
  levels: ElevationLevel[];
  activeLevelId: string;
  onSelectLevel: (id: string) => void;
  onAddLevel: (level: ElevationLevel) => void;
  onUpdateLevel: (id: string, updates: Partial<ElevationLevel>) => void;
  onDeleteLevel: (id: string) => void;
  // CAD Layer props
  cadLayers?: CADLayer[];
  activeCadLayerId?: string;
  onSelectCadLayer?: (id: string) => void;
  onUpdateCadLayer?: (id: string, updates: Partial<CADLayer>) => void;
  onAddCadLayer?: (layer: CADLayer) => void;
  onDeleteCadLayer?: (id: string) => void;
}

export const DesignPanel: React.FC<DesignPanelProps> = ({
  layerItems,
  selectedId,
  onSelectLayer,
  onToggleLock,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onSendToBack,
  onBringToFront,
  levels,
  activeLevelId,
  onSelectLevel,
  onAddLevel,
  onUpdateLevel,
  onDeleteLevel,
  cadLayers = [],
  activeCadLayerId,
  onSelectCadLayer,
  onUpdateCadLayer,
  onAddCadLayer,
  onDeleteCadLayer,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'cadlayers' | 'levels'>('cadlayers');
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 640);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editLevelName, setEditLevelName] = useState('');
  const [editLevelDepth, setEditLevelDepth] = useState(0);
  const [editLevelWpDepth, setEditLevelWpDepth] = useState(0);

  const sortedLayers = [...layerItems].sort((a, b) => b.zIndex - a.zIndex);
  const sortedLevels = [...levels].sort((a, b) => a.depthFromGL - b.depthFromGL);

  const handleStartEditingLevel = (level: ElevationLevel) => {
    setEditingLevelId(level.id);
    setEditLevelName(level.name);
    setEditLevelDepth(level.depthFromGL);
    setEditLevelWpDepth(level.wellpointDepth);
  };

  const handleSaveLevelEdit = () => {
    if (editingLevelId) {
      onUpdateLevel(editingLevelId, {
        name: editLevelName,
        depthFromGL: editLevelDepth,
        wellpointDepth: editLevelWpDepth,
      });
      setEditingLevelId(null);
    }
  };

  const handleAddLevelClick = () => {
    const nextDepth =
      levels.length > 0 ? Math.max(...levels.map((l) => l.depthFromGL)) + 5 : 0;
    const newLevel: ElevationLevel = {
      id: crypto.randomUUID(),
      name: `Level at -${nextDepth}m`,
      depthFromGL: nextDepth,
      wellpointDepth: 6,
    };
    onAddLevel(newLevel);
  };

  const handleAddCadLayer = () => {
    if (!onAddCadLayer || !onSelectCadLayer) return;
    const newId = `layer-${Date.now()}`;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    onAddCadLayer({
      id: newId,
      name: `Layer ${cadLayers.length + 1}`,
      color: colors[cadLayers.length % colors.length],
      lineType: 'solid',
      lineWeight: 1,
      visible: true,
      locked: false,
    });
    onSelectCadLayer(newId);
  };

  const PANEL_WIDTH = 256;

  const tabs: { id: 'cadlayers' | 'layers' | 'levels'; label: string }[] = [
    { id: 'cadlayers', label: 'LAYERS' },
    { id: 'layers', label: 'OBJECTS' },
    { id: 'levels', label: 'LEVELS' },
  ];

  return (
    <div className="relative h-full flex-shrink-0 select-none z-10" style={{ width: isCollapsed ? 0 : PANEL_WIDTH }}>
      {/* Sliding panel */}
      <div
        className="h-full bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-300"
        style={{ width: PANEL_WIDTH, transform: isCollapsed ? `translateX(-${PANEL_WIDTH}px)` : 'translateX(0)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <Layers size={16} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-700 tracking-wide whitespace-nowrap">Design Tools</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-[10px] font-semibold py-2 px-1 text-center transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* ── CAD LAYERS tab ── */}
          {activeTab === 'cadlayers' && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">CAD Layers</span>
                {onAddCadLayer && (
                  <button
                    onClick={handleAddCadLayer}
                    className="p-1 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-600 transition-colors"
                    title="New Layer"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              {cadLayers.length === 0 && (
                <p className="text-xs text-slate-400 p-3 text-center italic">No layers defined</p>
              )}
              {cadLayers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => onSelectCadLayer?.(layer.id)}
                  className={`flex items-center justify-between px-2 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
                    activeCadLayerId === layer.id
                      ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                      : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 border border-slate-300"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className={`text-xs truncate ${
                      activeCadLayerId === layer.id ? 'font-semibold text-indigo-800' : 'text-slate-700'
                    } ${layer.locked ? 'opacity-50 italic' : ''}`}>
                      {layer.name}
                    </span>
                    {activeCadLayerId === layer.id && (
                      <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded shrink-0">active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onUpdateCadLayer?.(layer.id, { visible: !layer.visible })}
                      className="p-0.5 rounded hover:bg-slate-200"
                      title={layer.visible ? 'Hide' : 'Show'}
                    >
                      {layer.visible ? <Eye size={12} className="text-slate-500" /> : <EyeOff size={12} className="text-slate-300" />}
                    </button>
                    <button
                      onClick={() => onUpdateCadLayer?.(layer.id, { locked: !layer.locked })}
                      className="p-0.5 rounded hover:bg-slate-200"
                      title={layer.locked ? 'Unlock' : 'Lock'}
                    >
                      {layer.locked ? <Lock size={12} className="text-amber-500" /> : <Unlock size={12} className="text-slate-400" />}
                    </button>
                    {cadLayers.length > 1 && layer.id !== 'layer-0' && onDeleteCadLayer && (
                      <button
                        onClick={() => onDeleteCadLayer(layer.id)}
                        className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600"
                        title="Delete Layer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── OBJECTS (canvas items) tab ── */}
          {activeTab === 'layers' && (
            <div className="flex flex-col">
              {sortedLayers.length === 0 && (
                <p className="text-xs text-slate-400 p-3 text-center italic">No items on canvas</p>
              )}
              {sortedLayers.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }`}
                    onClick={() => !item.locked && onSelectLayer(item.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 border border-slate-300"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={`text-xs flex-1 truncate ${
                        item.locked ? 'text-slate-400 italic' : 'text-slate-700'
                      }`}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                        className="p-0.5 rounded hover:bg-slate-200"
                        title={item.visible ? 'Hide' : 'Show'}
                      >
                        {item.visible ? (
                          <Eye size={12} className="text-slate-500" />
                        ) : (
                          <EyeOff size={12} className="text-slate-300" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }}
                        className="p-0.5 rounded hover:bg-slate-200"
                        title={item.locked ? 'Unlock' : 'Lock'}
                      >
                        {item.locked ? (
                          <Lock size={12} className="text-amber-500" />
                        ) : (
                          <Unlock size={12} className="text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onMoveUp(item.id); }}
                        className="p-0.5 rounded hover:bg-slate-200"
                        title="Move Up"
                      >
                        <ChevronUp size={12} className="text-slate-400" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onMoveDown(item.id); }}
                        className="p-0.5 rounded hover:bg-slate-200"
                        title="Move Down"
                      >
                        <ChevronDown size={12} className="text-slate-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ELEVATION LEVELS tab ── */}
          {activeTab === 'levels' && (
            <div className="p-2 space-y-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-semibold">Active Work Plane</span>
                <button
                  onClick={handleAddLevelClick}
                  className="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                  title="Add Level"
                >
                  <Plus size={14} />
                </button>
              </div>
              {sortedLevels.map((level) => {
                const isActive = level.id === activeLevelId;
                const isEditing = level.id === editingLevelId;

                if (isEditing) {
                  return (
                    <div key={level.id} className="bg-slate-50 border border-blue-200 rounded p-2 text-xs">
                      <input
                        className="w-full mb-1 px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                        value={editLevelName}
                        onChange={(e) => setEditLevelName(e.target.value)}
                        placeholder="Level Name"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-12 text-slate-500">Depth:</span>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                          value={editLevelDepth}
                          onChange={(e) => setEditLevelDepth(parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-12 text-slate-500">WP Depth:</span>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                          value={editLevelWpDepth}
                          onChange={(e) => setEditLevelWpDepth(parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingLevelId(null)}
                          className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveLevelEdit}
                          className="px-2 py-0.5 bg-blue-500 text-white rounded flex items-center gap-1"
                        >
                          <Check size={12} /> Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={level.id}
                    onClick={() => onSelectLevel(level.id)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                      isActive
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        {level.name} {isActive && '(Active)'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Depth: -{level.depthFromGL}m | WP: {level.wellpointDepth}m
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartEditingLevel(level); }}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteLevel(level.id); }}
                        className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50"
                        disabled={levels.length === 1}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer quick actions for Objects */}
        {activeTab === 'layers' && selectedId && (
          <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-slate-200 bg-slate-50 shrink-0">
            <button
              onClick={() => onSendToBack(selectedId)}
              className="text-[10px] px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 transition-colors"
            >
              Send to Back
            </button>
            <button
              onClick={() => onBringToFront(selectedId)}
              className="text-[10px] px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-600 transition-colors"
            >
              Bring to Front
            </button>
          </div>
        )}
      </div>

      {/* Collapse / expand toggle */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full flex items-center justify-center w-5 h-10 bg-white border border-l-0 border-slate-200 rounded-r-md shadow-sm hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors z-20"
        title={isCollapsed ? 'Expand Design Tools' : 'Collapse Design Tools'}
      >
        {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </div>
  );
};
