import React, { useState, useRef, useCallback } from 'react';
import { Lock, Unlock, ChevronUp, ChevronDown, Layers, ChevronLeft, Eye, EyeOff, GripHorizontal } from 'lucide-react';

interface LayerItem {
  id: string;
  type: 'area' | 'line' | 'component';
  label: string;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  color: string;
}

interface LayersPanelProps {
  items: LayerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringToFront: (id: string) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  items,
  selectedId,
  onSelect,
  onToggleLock,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onSendToBack,
  onBringToFront,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 8, y: 64 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pos]);

  // Sort by zIndex descending so highest z is at the top of the panel
  const sorted = [...items].sort((a, b) => b.zIndex - a.zIndex);

  if (collapsed) {
    return (
      <div className="absolute z-20" style={{ left: pos.x, top: pos.y }}>
        <button
          onClick={() => setCollapsed(false)}
          className="bg-white border border-slate-300 shadow-lg rounded-md p-2 hover:bg-slate-50 transition-colors"
          title="Show Layers Panel"
        >
          <Layers size={18} className="text-slate-600" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute z-20 bg-white border border-slate-300 rounded-lg shadow-xl w-56 max-h-[400px] flex flex-col select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Draggable Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={12} className="text-slate-400" />
          <Layers size={14} className="text-slate-500" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Layers</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
          className="text-slate-400 hover:text-slate-600 p-0.5"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Items List */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {sorted.length === 0 && (
          <p className="text-xs text-slate-400 p-3 text-center italic">No items on canvas</p>
        )}
        {sorted.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50 border-l-2 border-l-transparent'
              }`}
              onClick={() => !item.locked && onSelect(item.id)}
            >
              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 border border-slate-300"
                style={{ backgroundColor: item.color }}
              />

              {/* Label */}
              <span className={`text-xs flex-1 truncate ${item.locked ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                {item.label}
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                  className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                  title={item.visible ? 'Hide' : 'Show'}
                >
                  {item.visible ? <Eye size={12} className="text-slate-500" /> : <EyeOff size={12} className="text-slate-300" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }}
                  className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                  title={item.locked ? 'Unlock' : 'Lock'}
                >
                  {item.locked ? <Lock size={12} className="text-amber-500" /> : <Unlock size={12} className="text-slate-400" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(item.id); }}
                  className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                  title="Move Up"
                >
                  <ChevronUp size={12} className="text-slate-400" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(item.id); }}
                  className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                  title="Move Down"
                >
                  <ChevronDown size={12} className="text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer quick actions */}
      {selectedId && (
        <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-lg">
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
  );
};

export type { LayerItem };
