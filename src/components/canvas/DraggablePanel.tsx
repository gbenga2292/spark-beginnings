import React, { useState, useRef, useCallback } from 'react';
import { GripHorizontal, X } from 'lucide-react';

interface DraggablePanelProps {
  title: string;
  children: React.ReactNode;
  defaultX?: number;
  defaultY?: number;
  onClose?: () => void;
  width?: number;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  children,
  defaultX = window.innerWidth - 220,
  defaultY = 80,
  onClose,
  width = 192,
}) => {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
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
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
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

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-slate-200 z-50"
      style={{ left: pos.x, top: pos.y, width }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-t-lg cursor-grab active:cursor-grabbing border-b border-slate-200 select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={12} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-slate-200 transition-colors"
          >
            <X size={12} className="text-slate-400" />
          </button>
        )}
      </div>
      {/* Body */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};
