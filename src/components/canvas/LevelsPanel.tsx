import React, { useState } from 'react';
import { Layers, Plus, Trash2, Edit2, Check, GripHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { ElevationLevel } from '../../utils/simulationLogic';
import { DraggablePanel } from './DraggablePanel';

interface LevelsPanelProps {
  levels: ElevationLevel[];
  activeLevelId: string;
  onSelectLevel: (id: string) => void;
  onAddLevel: (level: ElevationLevel) => void;
  onUpdateLevel: (id: string, updates: Partial<ElevationLevel>) => void;
  onDeleteLevel: (id: string) => void;
}

export const LevelsPanel: React.FC<LevelsPanelProps> = ({
  levels,
  activeLevelId,
  onSelectLevel,
  onAddLevel,
  onUpdateLevel,
  onDeleteLevel
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepth, setEditDepth] = useState(0);
  const [editWpDepth, setEditWpDepth] = useState(0);

  const startEditing = (level: ElevationLevel) => {
    setEditingId(level.id);
    setEditName(level.name);
    setEditDepth(level.depthFromGL);
    setEditWpDepth(level.wellpointDepth);
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdateLevel(editingId, { name: editName, depthFromGL: editDepth, wellpointDepth: editWpDepth });
      setEditingId(null);
    }
  };

  const handleAddLevel = () => {
    const nextDepth = levels.length > 0 ? Math.max(...levels.map(l => l.depthFromGL)) + 5 : 0;
    const newLevel: ElevationLevel = {
      id: crypto.randomUUID(),
      name: `Level at -${nextDepth}m`,
      depthFromGL: nextDepth,
      wellpointDepth: 6,
    };
    onAddLevel(newLevel);
  };

  // Sort levels by depth (top to bottom)
  const sortedLevels = [...levels].sort((a, b) => a.depthFromGL - b.depthFromGL);

  return (
    <DraggablePanel title="Elevation Levels" defaultX={window.innerWidth - 240} defaultY={300} width={220}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500 font-semibold">Active Work Plane</span>
          <button onClick={handleAddLevel} className="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50" title="Add Level">
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {sortedLevels.map((level) => {
            const isActive = level.id === activeLevelId;
            const isEditing = level.id === editingId;

            if (isEditing) {
              return (
                <div key={level.id} className="bg-slate-50 border border-blue-200 rounded p-2 text-xs">
                  <input
                    className="w-full mb-1 px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Level Name"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-12 text-slate-500">Depth:</span>
                    <input
                      type="number" step="0.1"
                      className="w-full px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                      value={editDepth}
                      onChange={(e) => setEditDepth(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-12 text-slate-500">WP Depth:</span>
                    <input
                      type="number" step="0.1"
                      className="w-full px-1 py-0.5 border rounded outline-none focus:border-blue-400"
                      value={editWpDepth}
                      onChange={(e) => setEditWpDepth(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditingId(null)} className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded">Cancel</button>
                    <button onClick={saveEdit} className="px-2 py-0.5 bg-blue-500 text-white rounded flex items-center gap-1">
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
                  isActive ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                    {level.name} {isActive && '(Active)'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Depth: -{level.depthFromGL}m | WP: {level.wellpointDepth}m
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(level); }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteLevel(level.id); }}
                    className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50"
                    disabled={levels.length === 1} // Can't delete the last level
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DraggablePanel>
  );
};
