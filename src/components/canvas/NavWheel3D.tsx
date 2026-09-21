import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { 
  X, 
  GripHorizontal, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Scan, 
  Compass, 
  RotateCcw,
  Move,
  Orbit
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export type NavMode = 'orbit' | 'pan' | 'zoom';

interface NavWheel3DProps {
  camera: THREE.Camera | null;
  controls: any; // OrbitControls instance
  onClose: () => void;
  onZoomToFit?: () => void;
  onStartZoomWindow?: () => void;
  onResetView?: () => void;
  className?: string;
}

export const NavWheel3D: React.FC<NavWheel3DProps> = ({
  camera,
  controls,
  onClose,
  onZoomToFit,
  onStartZoomWindow,
  onResetView,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [activeMode, setActiveMode] = useState<NavMode>('orbit');
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Position of the movable navigator (default: top-left directly below HUD next to tool dock)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('dewatercad_navwheel_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: 16, y: 52 };
  });
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Step Zoom (+/-) ──
  const stepZoom = useCallback((factor: number) => {
    if (!camera || !controls) return;
    const target = controls.target || new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(target);
    offset.multiplyScalar(factor);
    camera.position.copy(target).add(offset);
    controls.update();
  }, [camera, controls]);

  // ── Reset View ──
  const handleResetCamera = useCallback(() => {
    if (onResetView) {
      onResetView();
      return;
    }
    if (!camera || !controls) return;
    camera.position.set(15, 12, 15);
    if (controls.target) controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
  }, [camera, controls, onResetView]);

  // ── Interactive Disk Pointer Handlers ──
  const handleDiskPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsInteracting(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isInteracting || !camera || !controls) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const target = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);

    if (activeMode === 'orbit') {
      const rotSpeed = 0.007;
      const offset = camera.position.clone().sub(target);
      const radius = offset.length();

      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

      theta -= dx * rotSpeed;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi + dy * rotSpeed));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.update();
    } else if (activeMode === 'pan') {
      const panSpeed = 0.025;
      const right = new THREE.Vector3();
      camera.getWorldDirection(right);
      right.cross(camera.up).normalize();

      const up = camera.up.clone().normalize();
      const panOffset = right.clone().multiplyScalar(-dx * panSpeed).add(up.clone().multiplyScalar(dy * panSpeed));

      camera.position.add(panOffset);
      target.add(panOffset);
      if (controls.target) controls.target.add(panOffset);
      controls.update();
    } else if (activeMode === 'zoom') {
      const zoomFactor = 1 + dy * 0.01;
      const offset = camera.position.clone().sub(target);
      offset.multiplyScalar(Math.max(0.2, Math.min(3.0, zoomFactor)));
      camera.position.copy(target).add(offset);
      controls.update();
    }
  }, [isInteracting, activeMode, camera, controls]);

  const handlePointerUp = useCallback(() => {
    setIsInteracting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // ── Dragging the Widget ──
  const handleCardDragStart = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.navigator-drag-handle')) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCard(true);
    cardDragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!isDraggingCard) return;

    const handleCardMove = (e: PointerEvent) => {
      const maxX = Math.max(10, window.innerWidth - 170);
      const maxY = Math.max(10, window.innerHeight - 220);
      setPosition({
        x: Math.max(10, Math.min(maxX, e.clientX - cardDragStartRef.current.x)),
        y: Math.max(10, Math.min(maxY, e.clientY - cardDragStartRef.current.y)),
      });
    };

    const handleCardUp = () => {
      setIsDraggingCard(false);
      setPosition(current => {
        try {
          localStorage.setItem('dewatercad_navwheel_pos', JSON.stringify(current));
        } catch {}
        return current;
      });
    };

    window.addEventListener('pointermove', handleCardMove);
    window.addEventListener('pointerup', handleCardUp);
    return () => {
      window.removeEventListener('pointermove', handleCardMove);
      window.removeEventListener('pointerup', handleCardUp);
    };
  }, [isDraggingCard]);

  return (
    <div
      className={`absolute z-30 select-none flex flex-col items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-2.5 transition-all ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '150px',
        touchAction: 'none',
      }}
      onPointerDown={handleCardDragStart}
    >
      {/* ── Top Header Bar ── */}
      <div className="navigator-drag-handle w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5 text-slate-500">
          <GripHorizontal className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            3D Navigator
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
          title="Close Navigator"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Orbit / Compass Disk with Step Zoom Buttons ── */}
      <div className="relative flex items-center justify-center my-1">
        {/* Zoom Out Button (Left) */}
        <button
          type="button"
          onClick={() => stepZoom(1.15)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 hover:text-amber-700 text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer mr-1.5"
          title="Zoom Out (-)"
        >
          <ZoomOut size={12} />
        </button>

        {/* Central Compass Orbit Disk */}
        <div
          onPointerDown={handleDiskPointerDown}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all cursor-grab active:cursor-grabbing select-none ${
            isInteracting
              ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 shadow-inner scale-98'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-amber-400 hover:bg-slate-100 shadow-sm'
          }`}
          title={`Click & drag to ${activeMode.toUpperCase()} 3D model`}
        >
          {/* Compass Cardinal Points */}
          <span className="absolute top-1 text-[8px] font-bold text-rose-500">N</span>
          <span className="absolute bottom-1 text-[8px] font-bold text-slate-400">S</span>
          <span className="absolute right-1 text-[8px] font-bold text-slate-400">E</span>
          <span className="absolute left-1 text-[8px] font-bold text-slate-400">W</span>

          {/* Center Crosshair / Mode Indicator */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isInteracting ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
          }`}>
            {activeMode === 'orbit' ? (
              <Orbit size={14} className={isInteracting ? 'animate-spin' : ''} />
            ) : activeMode === 'pan' ? (
              <Move size={14} />
            ) : (
              <Compass size={14} />
            )}
          </div>
        </div>

        {/* Zoom In Button (Right) */}
        <button
          type="button"
          onClick={() => stepZoom(0.85)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 hover:text-amber-700 text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer ml-1.5"
          title="Zoom In (+)"
        >
          <ZoomIn size={12} />
        </button>
      </div>

      {/* Mode hint text */}
      <div className="text-[9px] font-mono font-medium text-slate-400 text-center mt-1 mb-2">
        {isInteracting ? `Dragging to ${activeMode.toUpperCase()}` : `Drag disk to ${activeMode.toUpperCase()}`}
      </div>

      {/* ── Mode Selection & Action Toolbar ── */}
      <div className="w-full grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
        {/* Orbit mode */}
        <button
          type="button"
          onClick={() => setActiveMode('orbit')}
          className={`flex items-center justify-center p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            activeMode === 'orbit'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Orbit / Rotate Mode"
        >
          <Orbit size={13} />
        </button>

        {/* Pan mode */}
        <button
          type="button"
          onClick={() => setActiveMode('pan')}
          className={`flex items-center justify-center p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            activeMode === 'pan'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Pan Mode"
        >
          <Move size={13} />
        </button>

        {/* Zoom Window */}
        <button
          type="button"
          onClick={() => onStartZoomWindow?.()}
          className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Zoom Window (Drag rectangle)"
        >
          <Scan size={13} />
        </button>

        {/* Zoom to Fit */}
        <button
          type="button"
          onClick={() => onZoomToFit?.()}
          className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Zoom to Fit Extents"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Reset Camera footer button */}
      <button
        type="button"
        onClick={handleResetCamera}
        className="w-full mt-2 flex items-center justify-center gap-1 py-1 text-[9.5px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded transition-colors cursor-pointer"
        title="Reset Camera to Default Isometric View"
      >
        <RotateCcw size={10} />
        <span>Reset ISO View</span>
      </button>
    </div>
  );
};

export default NavWheel3D;
