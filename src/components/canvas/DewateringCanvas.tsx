import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { Point, LineData, PlacedComponent, ComponentType, DimensionData, PIXELS_PER_METER, ElevationLevel } from '../../utils/simulationLogic';
import { Check, X } from 'lucide-react';
import { ActiveTool } from './Toolbar';
import { DesignPanel } from './DesignPanel';
import { DraggablePanel } from './DraggablePanel';

interface DewateringCanvasProps {
  lines: LineData[];
  onLinesChange: (lines: LineData[]) => void;
  placedComponents: PlacedComponent[];
  onPlacedComponentsChange: (components: PlacedComponent[]) => void;
  activeTool: ActiveTool;
  onToolSelect?: (tool: ActiveTool) => void;
  backgroundImageUrl?: string | null;
  fixedLineLengthMeters?: number;
  showWellpoints?: boolean;
  orthoLocked?: boolean;
  gridSnap?: boolean;
  dimensions?: DimensionData[];
  onDimensionsChange?: (dims: DimensionData[]) => void;
  areas: any[];
  onAreasChange?: (areas: any[]) => void;
  hoses: any[];
  onHosesChange?: (hoses: any[]) => void;
  levels: ElevationLevel[];
  activeLevelId: string;
  onSelectLevel?: (id: string) => void;
  onAddLevel?: (level: ElevationLevel) => void;
  onUpdateLevel?: (id: string, updates: Partial<ElevationLevel>) => void;
  onDeleteLevel?: (id: string) => void;
  stageRef?: React.RefObject<any>;
}

function snapToAngle(prev: Point, raw: Point): Point {
  const dx = raw.x - prev.x;
  const dy = raw.y - prev.y;
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: prev.x + dist * Math.cos(snapped), y: prev.y + dist * Math.sin(snapped) };
}

function snapToGrid(pt: Point, gridSize: number): Point {
  return {
    x: Math.round(pt.x / gridSize) * gridSize,
    y: Math.round(pt.y / gridSize) * gridSize,
  };
}

function applyFixedLength(prev: Point, raw: Point, meters: number): Point {
  const dx = raw.x - prev.x;
  const dy = raw.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return raw;
  const targetPx = meters * PIXELS_PER_METER;
  return { x: prev.x + (dx / dist) * targetPx, y: prev.y + (dy / dist) * targetPx };
}

function distMeters(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy) / PIXELS_PER_METER;
}

export const DewateringCanvas: React.FC<DewateringCanvasProps> = ({
  lines,
  onLinesChange,
  placedComponents,
  onPlacedComponentsChange,
  dimensions,
  onDimensionsChange,
  activeTool,
  onToolSelect,
  backgroundImageUrl,
  fixedLineLengthMeters,
  showWellpoints = true,
  orthoLocked,
  gridSnap,
  areas = [],
  onAreasChange,
  hoses = [],
  onHosesChange,
  levels,
  activeLevelId,
  onSelectLevel,
  onAddLevel,
  onUpdateLevel,
  onDeleteLevel,
  stageRef: externalStageRef,
}) => {
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [currentDim, setCurrentDim] = useState<Point[]>([]);
  const [currentAreaStart, setCurrentAreaStart] = useState<{ pt: Point; kind: 'excavation' | 'discharge' | 'site' } | null>(null);
  const [currentHose, setCurrentHose] = useState<Point[]>([]);
  const [currentDischarge, setCurrentDischarge] = useState<Point[]>([]);
  
  // Drag cancellation tracking
  const dragInfoRef = useRef<{ node: any, startX: number, startY: number, cancelled: boolean } | null>(null);

  const cancelCurrentDrag = useCallback(() => {
    if (dragInfoRef.current) {
      dragInfoRef.current.cancelled = true;
      const node = dragInfoRef.current.node;
      node.stopDrag();
      node.x(dragInfoRef.current.startX);
      node.y(dragInfoRef.current.startY);
    }
  }, []);

  const [bgImage] = useImage(backgroundImageUrl || '');
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [dimTyped, setDimTyped] = useState('');
  
  const isDrawing = currentLine.length > 0 || currentHose.length > 0 || currentDischarge.length > 0 || currentAreaStart !== null;

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosRef = useRef<{ x: number, y: number } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedArea = areas.find((a: any) => a.id === selectedId);
  const selectedLine = lines.find((l: any) => l.id === selectedId);
  const selectedHose = hoses.find((h: any) => h.id === selectedId);

  // Are we currently dragging the whole line body (not a vertex)?
  const lineDragStartRef = useRef<{ points: Point[]; mouseX: number; mouseY: number } | null>(null);
  const hoseDragStartRef = useRef<{ points: Point[]; mouseX: number; mouseY: number } | null>(null);

  const localStageRef = useRef<any>(null);
  const stageRef = externalStageRef || localStageRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });



  // Transformer Ref for resizing
  const trRef = useRef<any>(null);

  // ---------- resize canvas ----------
  useEffect(() => {
    const check = () => {
      if (containerRef.current) {
        setCanvasSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ---------- shift tracking ----------
  useEffect(() => {
    const up = (e: KeyboardEvent) => setShiftHeld(e.shiftKey);
    window.addEventListener('keydown', up);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', up); window.removeEventListener('keyup', up); };
  }, []);

  // ---------- clear selection when tool changes ----------
  useEffect(() => {
    setSelectedId(null);
    setCurrentLine([]);
    setDimTyped('');
    setCurrentAreaStart(null);
    setCurrentHose([]);
    setCurrentDischarge([]);
    if (trRef.current) trRef.current.nodes([]);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool === 'select' && selectedId && trRef.current) {
      const node = stageRef.current?.findOne(`#area-${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, activeTool, areas]);

  // ---------- geometry helpers ----------
  const getSnappedPoint = useCallback((raw: Point): Point => {
    let pt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
    if (currentLine.length === 0) return pt;
    const prev = currentLine[currentLine.length - 1];
    pt = (shiftHeld || orthoLocked) ? snapToAngle(prev, pt) : pt;
    if (fixedLineLengthMeters) pt = applyFixedLength(prev, pt, fixedLineLengthMeters);
    return pt;
  }, [currentLine, shiftHeld, orthoLocked, fixedLineLengthMeters, gridSnap]);

  // --- Visibility state (hidden items) ---
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // --- Layer management callbacks ---
  const layerItems: any[] = useMemo(() => {
    const items: any[] = [];
    areas.forEach((a: any) => items.push({ id: a.id, type: 'area', zIndex: a.zIndex || 0, label: `Area ${a.id.substring(0, 4)}`, locked: a.locked, visible: !hiddenIds.has(a.id) }));
    lines.forEach((l: any) => items.push({ id: l.id, type: 'header', zIndex: l.zIndex || 0, label: `Header ${l.id.substring(0, 4)}`, locked: l.locked, visible: !hiddenIds.has(l.id) }));
    hoses.forEach((h: any) => items.push({ id: h.id, type: h.kind === 'suction' ? 'suction' : 'discharge', zIndex: h.zIndex || 0, label: `${h.kind} hose ${h.id.substring(0, 4)}`, locked: h.locked, visible: !hiddenIds.has(h.id) }));
    return items.sort((a, b) => b.zIndex - a.zIndex); // Highest zIndex at top
  }, [areas, lines, hoses, hiddenIds]);

  const handleLayerSelect = (id: string) => setSelectedId(id);
  const handleToggleVisibility = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateZIndex = (id: string, delta: number | 'top' | 'bottom') => {
    const maxZ = Math.max(...layerItems.map(i => i.zIndex), 0);
    const minZ = Math.min(...layerItems.map(i => i.zIndex), 0);
    
    if (onAreasChange) {
      onAreasChange(areas.map((a: any) => {
        if (a.id === id) {
          let newZ = (a.zIndex || 0);
          if (delta === 'top') newZ = maxZ + 1;
          else if (delta === 'bottom') newZ = minZ - 1;
          else newZ += delta;
          return { ...a, zIndex: newZ };
        }
        return a;
      }));
    }
    if (onLinesChange) {
      onLinesChange(lines.map((l: any) => {
        if (l.id === id) {
          let newZ = (l.zIndex || 0);
          if (delta === 'top') newZ = maxZ + 1;
          else if (delta === 'bottom') newZ = minZ - 1;
          else newZ += delta;
          return { ...l, zIndex: newZ };
        }
        return l;
      }));
    }
    if (onHosesChange) {
      onHosesChange(hoses.map((h: any) => {
        if (h.id === id) {
          let newZ = (h.zIndex || 0);
          if (delta === 'top') newZ = maxZ + 1;
          else if (delta === 'bottom') newZ = minZ - 1;
          else newZ += delta;
          return { ...h, zIndex: newZ };
        }
        return h;
      }));
    }
  };

  const handleMoveUp = (id: string) => updateZIndex(id, 1);
  const handleMoveDown = (id: string) => updateZIndex(id, -1);
  const handleBringToFront = (id: string) => updateZIndex(id, 'top');
  const handleSendToBack = (id: string) => updateZIndex(id, 'bottom');

  // --- Layer management callbacks ---
  const handleToggleLock = (id: string) => {
    const area = areas.find((a: any) => a.id === id);
    if (area && onAreasChange) {
      onAreasChange(areas.map((a: any) => a.id === id ? { ...a, locked: !a.locked } : a));
    }
    const line = lines.find((l: any) => l.id === id);
    if (line) {
      onLinesChange(lines.map((l: any) => l.id === id ? { ...l, locked: !l.locked } : l));
    }
    if (selectedId === id) setSelectedId(null);
  };

  const finishLine = useCallback((pts: Point[]) => {
    if (pts.length > 1) {
      if (activeTool === 'hose' && onHosesChange) {
        onHosesChange([...hoses, { id: crypto.randomUUID(), points: pts, kind: 'suction' }]);
      } else if (activeTool === 'discharge' && onHosesChange) {
        onHosesChange([...hoses, { id: crypto.randomUUID(), points: pts, kind: 'discharge' }]);
      } else {
        const newLine: LineData = { id: crypto.randomUUID(), points: pts, levelId: activeLevelId };
        onLinesChange([...lines, newLine]);
      }
    }
    setCurrentLine([]);
    setCurrentHose([]);
    setCurrentDischarge([]);
    setCursorPos(null);
    setDimTyped('');
  }, [lines, hoses, activeTool, onLinesChange, onHosesChange, activeLevelId]);

  // ---------- AutoCAD keyboard capture ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Shift') { setShiftHeld(true); e.preventDefault(); return; }
      if (e.key === 'Escape') {
        if (dragInfoRef.current) {
          cancelCurrentDrag();
          return;
        }
        if (currentAreaStart) {
          setCurrentAreaStart(null);
          return;
        }
        const activeList = activeTool === 'line' ? currentLine : activeTool === 'hose' ? currentHose : currentDischarge;
        const setActiveList = activeTool === 'line' ? setCurrentLine : activeTool === 'hose' ? setCurrentHose : setCurrentDischarge;
        if (activeList.length > 0) { finishLine(activeList); }
        setDimTyped('');
        setCursorPos(null);
        return;
      }

      if (e.key === 'Enter') {
        const meters = parseFloat(dimTyped);
        const activeList = activeTool === 'line' ? currentLine : activeTool === 'hose' ? currentHose : currentDischarge;
        const setActiveList = activeTool === 'line' ? setCurrentLine : activeTool === 'hose' ? setCurrentHose : setCurrentDischarge;
        if (!isNaN(meters) && meters > 0 && cursorPos && activeList.length > 0) {
          const prev = activeList[activeList.length - 1];
          const dir = (shiftHeld || orthoLocked) ? snapToAngle(prev, cursorPos) : cursorPos;
          const pt = applyFixedLength(prev, dir, meters);
          setActiveList(p => [...p, pt]);
          setDimTyped('');
        } else if (cursorPos) {
          const pt = getSnappedPoint(cursorPos);
          setActiveList(p => [...p, pt]);
          setDimTyped('');
        }
        e.preventDefault(); return;
      }
      if (e.key === 'Backspace') { setDimTyped(p => p.slice(0, -1)); e.preventDefault(); return; }
      if (/^[\d.]$/.test(e.key)) {
        if (e.key === '.' && dimTyped.includes('.')) return;
        setDimTyped(p => p + e.key);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawing, dimTyped, cursorPos, currentLine, shiftHeld, orthoLocked, finishLine, getSnappedPoint, activeTool, currentHose, currentDischarge, currentAreaStart]);

  // ---------- useEffect: auto-dimension selected spline ----------
  useEffect(() => {
    if (activeTool === 'dimension' && selectedId) {
      const targetLine = lines.find((l: any) => l.id === selectedId);
      const targetHose = hoses.find((h: any) => h.id === selectedId);
      const target = targetLine || targetHose;

      if (target && target.points.length > 1 && onDimensionsChange && dimensions) {
        const start = target.points[0];
        const end = target.points[target.points.length - 1];

        let totalDist = 0;
        for (let i = 0; i < target.points.length - 1; i++) {
          totalDist += distMeters(target.points[i], target.points[i+1]);
        }

        const newDim: DimensionData = {
          id: Math.random().toString(36).substring(2, 9),
          start,
          end,
          text: `${totalDist.toFixed(2)}m`
        };

        onDimensionsChange([...dimensions, newDim]);
        if (onToolSelect) {
          onToolSelect('select');
        }
      }
    }
  }, [activeTool, selectedId, lines, hoses, dimensions, onDimensionsChange, onToolSelect]);

  // ---------- helper: screen to world coords ----------
  const getWorldPointerPos = useCallback((stage: any): Point | null => {
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pos);
  }, []);

  // ---------- pointer events on Stage ----------
  const handleStageMouseDown = (e: any) => {
    const isStage = e.target === e.target.getStage();

    // Middle-click to pan
    if (e.evt.button === 1) {
      setIsPanning(true);
      const pos = e.target.getStage().getPointerPosition();
      if (pos) lastPanPosRef.current = { x: pos.x, y: pos.y };
      return;
    }

    // Right-click finishes drawing or cancels drag
    if (e.evt.button === 2) {
      if (dragInfoRef.current) {
        cancelCurrentDrag();
        return;
      }
      if (activeTool === 'line' && currentLine.length > 0) finishLine(currentLine);
      if (activeTool === 'hose' && currentHose.length > 0) finishLine(currentHose);
      if (activeTool === 'discharge' && currentDischarge.length > 0) finishLine(currentDischarge);
      if (currentAreaStart) setCurrentAreaStart(null);
      return;
    }

    if (e.evt && e.evt.button !== undefined && e.evt.button !== 0) return;

    if (activeTool === 'select') {
      // Click on empty stage → deselect
      if (isStage) {
        setSelectedId(null);
        if (trRef.current) trRef.current.nodes([]);
      }
      return;
    }

    if (['pump', 'tee', 'elbow'].includes(activeTool)) {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      const pt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      
      const newComp: PlacedComponent = {
        id: crypto.randomUUID(),
        type: activeTool as ComponentType,
        x: pt.x,
        y: pt.y,
        levelId: activeLevelId
      };
      onPlacedComponentsChange([...placedComponents, newComp]);
      return;
    }

    if (activeTool === 'area' || activeTool === 'discharge-area' || activeTool === 'site-area') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      const pt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      const kind = activeTool === 'area' ? 'excavation' : activeTool === 'discharge-area' ? 'discharge' : 'site';

      if (!currentAreaStart) {
        setCurrentAreaStart({ pt, kind });
      } else {
        const newArea = {
          id: crypto.randomUUID(),
          x: Math.min(currentAreaStart.pt.x, pt.x),
          y: Math.min(currentAreaStart.pt.y, pt.y),
          width: Math.abs(pt.x - currentAreaStart.pt.x),
          height: Math.abs(pt.y - currentAreaStart.pt.y),
          kind: currentAreaStart.kind,
          levelId: activeLevelId
        };
        if (onAreasChange) onAreasChange([...areas, newArea]);
        setCurrentAreaStart(null);
      }
      return;
    }

    if (activeTool === 'dimension') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      
      const snappedRaw = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      const pt = getSnappedPoint(snappedRaw);

      if (currentDim.length === 0) {
        setCurrentDim([pt]);
      } else {
        const start = currentDim[0];
        const distPx = Math.sqrt(Math.pow(pt.x - start.x, 2) + Math.pow(pt.y - start.y, 2));
        const distM = (distPx / PIXELS_PER_METER).toFixed(2);
        
        const newDim: DimensionData = {
          id: Math.random().toString(36).substring(2, 9),
          start,
          end: pt,
          text: `${distM}m`
        };
        if (onDimensionsChange && dimensions) {
          onDimensionsChange([...dimensions, newDim]);
        }
        setCurrentDim([]);
      }
      return;
    }

    if (activeTool === 'line' || activeTool === 'hose' || activeTool === 'discharge') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;

      const snappedRaw = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      const meters = parseFloat(dimTyped);
      let pt: Point;

      const currentList = activeTool === 'line' ? currentLine : activeTool === 'hose' ? currentHose : currentDischarge;
      const setCurrentList = activeTool === 'line' ? setCurrentLine : activeTool === 'hose' ? setCurrentHose : setCurrentDischarge;

      if (!isNaN(meters) && meters > 0 && currentList.length > 0) {
        const prev = currentList[currentList.length - 1];
        pt = applyFixedLength(prev, (shiftHeld || orthoLocked) ? snapToAngle(prev, snappedRaw) : snappedRaw, meters);
      } else {
        pt = activeTool === 'line' ? getSnappedPoint(snappedRaw) : snappedRaw;
      }

      setCurrentList(p => [...p, pt]);
      setDimTyped('');
    }
  };

  const handlePointerMove = (e: any) => {
    const stage = e.target.getStage();
    
    if (isPanning && lastPanPosRef.current) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const dx = pos.x - lastPanPosRef.current.x;
        const dy = pos.y - lastPanPosRef.current.y;
        setPosition(p => ({ x: p.x + dx, y: p.y + dy }));
        lastPanPosRef.current = { x: pos.x, y: pos.y };
      }
      return;
    }

    const raw = getWorldPointerPos(stage);
    if (raw) {
      setCursorPos(gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw);
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (e.evt.button === 1) {
      setIsPanning(false);
      lastPanPosRef.current = null;
    }
  };

  const handleAreaClick = (e: any, id: string) => {
    const area = areas.find((a: any) => a.id === id);
    if (area?.locked) return;
    if (activeTool === 'select') {
      setSelectedId(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'delete') {
      if (onAreasChange) onAreasChange(areas.filter(a => a.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension' && area) {
      const wM = (area.width / PIXELS_PER_METER).toFixed(1);
      const hM = (area.height / PIXELS_PER_METER).toFixed(1);
      const newDimW: DimensionData = {
        id: Date.now().toString() + 'w',
        start: { x: area.x, y: area.y },
        end: { x: area.x + area.width, y: area.y },
        text: `${wM}m`
      };
      const newDimH: DimensionData = {
        id: Date.now().toString() + 'h',
        start: { x: area.x, y: area.y },
        end: { x: area.x, y: area.y + area.height },
        text: `${hM}m`
      };
      if (onDimensionsChange && dimensions) {
        onDimensionsChange([...dimensions, newDimW, newDimH]);
      }
      e.cancelBubble = true;
      setCurrentDim([]);
    }
  };

  const handleAreaTransformEnd = (e: any, areaId: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    
    if (onAreasChange) {
      onAreasChange(areas.map(a => 
        a.id === areaId ? {
          ...a,
          x: node.x(),
          y: node.y(),
          width: Math.max(1, a.width * scaleX),
          height: Math.max(1, a.height * scaleY)
        } : a
      ));
    }
  };

  const handleAreaDragStart = (e: any, areaId: string) => {
    dragInfoRef.current = { node: e.target, startX: e.target.x(), startY: e.target.y(), cancelled: false };
  };

  const handleAreaDragEnd = (e: any, areaId: string) => {
    if (dragInfoRef.current?.cancelled) {
      dragInfoRef.current = null;
      return;
    }
    dragInfoRef.current = null;
    if (onAreasChange) {
      onAreasChange(areas.map(a => 
        a.id === areaId ? { ...a, x: e.target.x(), y: e.target.y() } : a
      ));
    }
  };

  // ---------- line body click (select mode) ----------
  const handleLineClick = (e: any, id: string) => {
    const line = lines.find(l => l.id === id);
    if (line?.locked) return;
    if (activeTool === 'select') {
      setSelectedId(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'delete') {
      onLinesChange(lines.filter(l => l.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension' && line && line.points.length > 1) {
      let totalDist = 0;
      for (let i = 0; i < line.points.length - 1; i++) {
        const dx = line.points[i+1].x - line.points[i].x;
        const dy = line.points[i+1].y - line.points[i].y;
        totalDist += Math.sqrt(dx * dx + dy * dy) / PIXELS_PER_METER;
      }
      const newDim: DimensionData = {
        id: Date.now().toString(),
        start: line.points[0],
        end: line.points[line.points.length - 1],
        text: `${totalDist.toFixed(1)}m`
      };
      if (onDimensionsChange && dimensions) {
        onDimensionsChange([...dimensions, newDim]);
      }
      e.cancelBubble = true;
      setCurrentDim([]);
    }
  };

  // ---------- vertex drag (select mode) ----------
  const handleVertexDragEnd = (lineId: string, ptIndex: number, e: any) => {
    const newX = e.target.x();
    const newY = e.target.y();
    onLinesChange(lines.map(l =>
      l.id !== lineId ? l : {
        ...l,
        points: l.points.map((p, i) => i === ptIndex ? { x: newX, y: newY } : p),
      }
    ));
  };

  // ---------- line body drag ----------
  const handleLineDragStart = (lineId: string, e: any) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const stage = e.target.getStage();
    const pos = getWorldPointerPos(stage);
    if (!pos) return;
    dragInfoRef.current = { node: e.target, startX: e.target.x(), startY: e.target.y(), cancelled: false };
    lineDragStartRef.current = { points: line.points, mouseX: pos.x, mouseY: pos.y };
  };

  const handleLineDragEnd = (lineId: string, e: any) => {
    if (dragInfoRef.current?.cancelled) {
      dragInfoRef.current = null;
      lineDragStartRef.current = null;
      return;
    }
    dragInfoRef.current = null;
    if (!lineDragStartRef.current) return;
    const stage = e.target.getStage();
    const pos = getWorldPointerPos(stage);
    if (!pos) return;
    const dx = pos.x - lineDragStartRef.current.mouseX;
    const dy = pos.y - lineDragStartRef.current.mouseY;
    const origPts = lineDragStartRef.current.points;
    onLinesChange(lines.map(l =>
      l.id !== lineId ? l : {
        ...l,
        points: origPts.map(p => ({ x: p.x + dx, y: p.y + dy })),
      }
    ));
    // Reset the Konva node position so it doesn't double-apply
    e.target.position({ x: 0, y: 0 });
    lineDragStartRef.current = null;
  };

  // ---------- hose click / drag (select mode) ----------
  const handleHoseClick = (e: any, id: string) => {
    const hose = hoses.find(h => h.id === id);
    if (hose?.locked) return;
    if (activeTool === 'select') {
      setSelectedId(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'delete') {
      if (onHosesChange) onHosesChange(hoses.filter(h => h.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension' && hose && hose.points.length > 1) {
      let totalDist = 0;
      for (let i = 0; i < hose.points.length - 1; i++) {
        totalDist += distMeters(hose.points[i], hose.points[i+1]);
      }
      const newDim: DimensionData = {
        id: Date.now().toString(),
        start: hose.points[0],
        end: hose.points[hose.points.length - 1],
        text: `${totalDist.toFixed(1)}m`
      };
      if (onDimensionsChange && dimensions) {
        onDimensionsChange([...dimensions, newDim]);
      }
      e.cancelBubble = true;
      setCurrentDim([]);
    }
  };

  const handleHoseDragStart = (hoseId: string, e: any) => {
    const hose = hoses.find(h => h.id === hoseId);
    if (!hose) return;
    const stage = e.target.getStage();
    const pos = getWorldPointerPos(stage);
    if (!pos) return;
    dragInfoRef.current = { node: e.target, startX: e.target.x(), startY: e.target.y(), cancelled: false };
    hoseDragStartRef.current = { points: hose.points, mouseX: pos.x, mouseY: pos.y };
  };

  const handleHoseDragEnd = (hoseId: string, e: any) => {
    if (dragInfoRef.current?.cancelled) {
      dragInfoRef.current = null;
      hoseDragStartRef.current = null;
      return;
    }
    dragInfoRef.current = null;
    if (!hoseDragStartRef.current) return;
    const stage = e.target.getStage();
    const pos = getWorldPointerPos(stage);
    if (!pos) return;
    const dx = pos.x - hoseDragStartRef.current.mouseX;
    const dy = pos.y - hoseDragStartRef.current.mouseY;
    const origPts = hoseDragStartRef.current.points;
    if (onHosesChange) {
      onHosesChange(hoses.map(h =>
        h.id !== hoseId ? h : {
          ...h,
          points: origPts.map(p => ({ x: p.x + dx, y: p.y + dy })),
        }
      ));
    }
    e.target.position({ x: 0, y: 0 });
    hoseDragStartRef.current = null;
  };

  const handleHoseVertexDragMove = (hoseId: string, ptIndex: number, e: any) => {
    const newX = e.target.x();
    const newY = e.target.y();
    if (onHosesChange) {
      onHosesChange(hoses.map(h =>
        h.id !== hoseId ? h : {
          ...h,
          points: h.points.map((p, i) => i === ptIndex ? { x: newX, y: newY } : p),
        }
      ));
    }
  };

  const handleHoseVertexDragEnd = (hoseId: string, ptIndex: number, e: any) => {
    const newX = e.target.x();
    const newY = e.target.y();
    if (onHosesChange) {
      onHosesChange(hoses.map(h =>
        h.id !== hoseId ? h : {
          ...h,
          points: h.points.map((p, i) => i === ptIndex ? { x: newX, y: newY } : p),
        }
      ));
    }
  };

  // ---------- component click / drag ----------
  const handleCompClick = (e: any, id: string) => {
    if (activeTool === 'select') { setSelectedId(id); e.cancelBubble = true; }
    if (activeTool === 'delete') { onPlacedComponentsChange(placedComponents.filter(c => c.id !== id)); e.cancelBubble = true; }
  };

  const handleCompDragEnd = (id: string, e: any) => {
    let newX = e.target.x();
    let newY = e.target.y();
    if (gridSnap) {
      const snapped = snapToGrid({ x: newX, y: newY }, PIXELS_PER_METER / 2);
      newX = snapped.x;
      newY = snapped.y;
    }
    onPlacedComponentsChange(placedComponents.map(c => c.id !== id ? c : { ...c, x: newX, y: newY }));
  };

  // ---------- derived preview ----------
  const lastPoint = currentLine.length > 0 ? currentLine[currentLine.length - 1] : null;
  const previewPoint = cursorPos && isDrawing ? getSnappedPoint(cursorPos) : null;
  const liveDistM = previewPoint && lastPoint ? distMeters(lastPoint, previewPoint) : null;
  const typedMeters = parseFloat(dimTyped);
  const resolvedDistM = !isNaN(typedMeters) && typedMeters > 0 ? typedMeters : liveDistM;

  // ---------- component renderer ----------
  const renderComponent = (comp: PlacedComponent) => {
    const del = activeTool === 'delete';
    const sel = activeTool === 'select' && selectedId === comp.id;
    const isDraggable = activeTool === 'select';
    const base = {
      onClick: (e: any) => handleCompClick(e, comp.id),
      onTap: (e: any) => handleCompClick(e, comp.id),
      draggable: isDraggable,
      onDragEnd: (e: any) => handleCompDragEnd(comp.id, e),
      strokeWidth: sel ? 3 : 2,
    };

    switch (comp.type) {
      case 'pump': return (
        <Group key={comp.id} {...base}>
          <Rect x={comp.x - 20} y={comp.y - 15} width={40} height={30} fill={del ? '#fca5a5' : '#0ea5e9'} stroke={sel ? '#fbbf24' : '#0284c7'} strokeWidth={2} cornerRadius={2} />
          <Rect x={comp.x - 10} y={comp.y - 8} width={20} height={16} fill="#bae6fd" />
          <Text x={comp.x - 35} y={comp.y - 28} text="Dewatering Pump" fill="#0284c7" fontSize={11} fontStyle="bold" listening={false} />
        </Group>
      );
      case 'tee': return (
        <React.Fragment key={comp.id}>
          <Rect x={comp.x - 10} y={comp.y - 10} width={20} height={20}
            fill={del ? '#6ee7b7' : '#10b981'}
            stroke={sel ? '#fbbf24' : '#064e3b'}
            {...base} />
          <Text x={comp.x - 4} y={comp.y - 6} text="T" fill="white" fontSize={12} fontStyle="bold" listening={false} />
        </React.Fragment>
      );
      case 'elbow': return (
        <React.Fragment key={comp.id}>
          <Circle x={comp.x} y={comp.y} radius={8}
            fill={del ? '#fcd34d' : '#f59e0b'}
            stroke={sel ? '#fbbf24' : '#78350f'}
            strokeWidth={1.5}
            {...base} />
        </React.Fragment>
      );
      default: return null;
    }
  };

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'select') return 'default';
    if (['line', 'hose', 'discharge', 'delete', 'dimension', 'area', 'discharge-area', 'site-area'].includes(activeTool)) return 'crosshair';
    return 'pointer';
  };

  // ---------- zoom wheel ----------
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? 1 : -1;
    const zoomFactor = 1.1;
    let newScale = direction > 0 ? oldScale / zoomFactor : oldScale * zoomFactor;
    newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp between 0.1x and 10x

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  return (
    <div className="flex w-full h-full bg-[#e5e7eb] overflow-hidden">
      <DesignPanel
        layerItems={layerItems}
        selectedId={selectedId}
        onSelectLayer={handleLayerSelect}
        onToggleLock={handleToggleLock}
        onToggleVisibility={handleToggleVisibility}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onSendToBack={handleSendToBack}
        onBringToFront={handleBringToFront}
        levels={levels}
        activeLevelId={activeLevelId}
        onSelectLevel={onSelectLevel!}
        onAddLevel={onAddLevel!}
        onUpdateLevel={onUpdateLevel!}
        onDeleteLevel={onDeleteLevel!}
      />
      
      <div
        ref={containerRef}
        className="flex-1 h-full relative outline-none touch-none"
        tabIndex={0}
        onMouseEnter={() => containerRef.current?.focus()}
        style={{ cursor: getCursor() }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={() => { setIsPanning(false); lastPanPosRef.current = null; }}
          onTouchStart={handleStageMouseDown}
          onTouchMove={handlePointerMove}
          onDblTap={(e) => {
            if (activeTool === 'line' && currentLine.length > 0) finishLine(currentLine);
            if (activeTool === 'hose' && currentHose.length > 0) finishLine(currentHose);
            if (activeTool === 'discharge' && currentDischarge.length > 0) finishLine(currentDischarge);
            if (currentAreaStart) setCurrentAreaStart(null);
          }}
          onDblClick={(e) => {
            if (activeTool === 'line' && currentLine.length > 0) finishLine(currentLine);
            if (activeTool === 'hose' && currentHose.length > 0) finishLine(currentHose);
            if (activeTool === 'discharge' && currentDischarge.length > 0) finishLine(currentDischarge);
            if (currentAreaStart) setCurrentAreaStart(null);
          }}
          ref={stageRef}
        >
        <Layer>
          {/* Grid Background */}
          {gridSnap && (() => {
            const gridLines = [];
            const step = PIXELS_PER_METER;
            for (let i = 0; i < canvasSize.width / step; i++) {
              gridLines.push(<Line key={`gv-${i}`} points={[Math.round(i * step), 0, Math.round(i * step), canvasSize.height]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} listening={false} />);
            }
            for (let j = 0; j < canvasSize.height / step; j++) {
              gridLines.push(<Line key={`gh-${j}`} points={[0, Math.round(j * step), canvasSize.width, Math.round(j * step)]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} listening={false} />);
            }
            return gridLines;
          })()}

          {bgImage && (
            <KonvaImage image={bgImage} width={canvasSize.width} height={canvasSize.height} opacity={0.5} />
          )}

          {/* Excavation, Discharge & Site Areas */}
          {areas.filter(a => !hiddenIds.has(a.id)).map((area: any) => {
            const isDischarge = area.kind === 'discharge';
            const isSite = area.kind === 'site';
            const isSelected = selectedId === area.id && activeTool === 'select';
            
            const fillCol = isSite ? '#86efac' : isDischarge ? '#fed7aa' : '#fca5a5';
            const strokeCol = isSite ? '#22c55e' : isDischarge ? '#f97316' : '#ef4444';
            const labelStr = isSite ? 'SITE BOUNDARY' : isDischarge ? 'DISCHARGE AREA' : 'EXCAVATION';
            
            const wMeters = (area.width / PIXELS_PER_METER).toFixed(1);
            const hMeters = (area.height / PIXELS_PER_METER).toFixed(1);

            return (
              <Group key={area.id}>
                {/* The actual resizable Rect */}
                <Rect
                  id={`area-${area.id}`}
                  x={area.x} y={area.y} width={area.width} height={area.height}
                  fill={fillCol} opacity={area.locked ? 0.1 : 0.2}
                  stroke={strokeCol}
                  strokeWidth={isSelected ? 2.5 : 1.5} dash={isSite ? undefined : [10, 5]}
                  draggable={activeTool === 'select' && !area.locked}
                  onDragStart={(e) => !area.locked && handleAreaDragStart(e, area.id)}
                  onDragEnd={(e) => !area.locked && handleAreaDragEnd(e, area.id)}
                  onTransformEnd={(e) => !area.locked && handleAreaTransformEnd(e, area.id)}
                  onClick={(e) => !area.locked && handleAreaClick(e, area.id)}
                  onTap={(e) => !area.locked && handleAreaClick(e, area.id)}
                  onMouseEnter={(e) => { 
                    if (area.locked) return;
                    if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                    if (activeTool === 'select') document.body.style.cursor = 'move';
                  }}
                  onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                />
                
                {/* Overlay Text inside Group to avoid scaling when transformed */}
                <Text
                  x={area.x + 5} y={area.y + 5}
                  text={area.locked ? `🔒 ${labelStr}` : labelStr}
                  fill={strokeCol}
                  opacity={0.8} fontSize={12} fontStyle="bold" listening={false}
                />
                
                {/* Dimension Labels */}
                <Text x={area.x + area.width / 2} y={area.y - 15} text={`${wMeters}m`} fill="#475569" fontSize={12} fontStyle="bold" align="center" width={area.width} offsetX={area.width / 2} listening={false} />
                <Text x={area.x - 35} y={area.y + area.height / 2} text={`${hMeters}m`} fill="#475569" fontSize={12} fontStyle="bold" align="center" width={70} offsetX={35} offsetY={6} rotation={-90} listening={false} />
              </Group>
            );
          })}

          {/* Finished lines (sorted by zIndex, rendered after areas so they appear on top) */}
          {[...lines].filter((l: any) => !hiddenIds.has(l.id)).sort((a: any, b: any) => (a.zIndex ?? 100) - (b.zIndex ?? 100)).map((line) => {
            const isSelected = activeTool === 'select' && selectedId === line.id;
            return (
              <React.Fragment key={line.id}>
                {/* Invisible wide hit area for easier clicking */}
                <Line
                  points={line.points.flatMap(p => [p.x, p.y])}
                  stroke="transparent"
                  strokeWidth={20}
                  lineJoin="round" lineCap="round"
                  onClick={(e) => handleLineClick(e, line.id)}
                  onTap={(e) => handleLineClick(e, line.id)}
                  draggable={isSelected && !line.locked}
                  onDragStart={(e) => handleLineDragStart(line.id, e)}
                  onDragEnd={(e) => handleLineDragEnd(line.id, e)}
                />
                {/* Visible line (thick outer edge) */}
                <Line
                  points={line.points.flatMap(p => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#0369a1'}
                  strokeWidth={isSelected ? 10 : 8}
                  lineJoin="round" lineCap="round"
                  listening={false}
                />
                {/* Visible line (inner pipe body) */}
                <Line
                  points={line.points.flatMap(p => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#fca5a5' : '#22d3ee'}
                  strokeWidth={4}
                  lineJoin="round" lineCap="round"
                  listening={false}
                />
                
                {/* Length and Depth Label */}
                {line.points.length > 1 && (() => {
                  const p1 = line.points[0];
                  const p2 = line.points[line.points.length - 1];
                  let totalDist = 0;
                  for (let i = 0; i < line.points.length - 1; i++) {
                    const dx = line.points[i+1].x - line.points[i].x;
                    const dy = line.points[i+1].y - line.points[i].y;
                    totalDist += Math.sqrt(dx * dx + dy * dy) / PIXELS_PER_METER;
                  }
                  const label = line.depthFromGL ? `L: ${totalDist.toFixed(1)}m | D: -${line.depthFromGL}m` : `L: ${totalDist.toFixed(1)}m`;
                  return (
                    <Text 
                      x={(p1.x + p2.x) / 2} 
                      y={(p1.y + p2.y) / 2 - 20} 
                      text={label} 
                      fill="#0369a1" 
                      fontSize={12} 
                      fontStyle="bold" 
                      listening={false} 
                      align="center"
                      offsetX={50}
                      width={100}
                    />
                  );
                })()}

                {/* Vertex handles when selected and NOT locked */}
                {isSelected && !line.locked && line.points.map((p, i) => (
                  <Circle
                    key={`vh-${i}`}
                    x={p.x} y={p.y}
                    radius={7}
                    fill="#fbbf24"
                    stroke="#78350f"
                    strokeWidth={2}
                    draggable
                    onDragEnd={(e) => handleVertexDragEnd(line.id, i, e)}
                    onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'move'; }}
                    onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }}
                  />
                ))}

                {/* Wellpoints and Header Visualizations */}
                {showWellpoints && (() => {
                  const headerLengthPx = 6 * PIXELS_PER_METER;
                  const wpDistPx = headerLengthPx / 6;
                  const elements = [];
                  let currentHeaderCount = 0;
                  
                  for (let i = 0; i < line.points.length - 1; i++) {
                    const p1 = line.points[i];
                    const p2 = line.points[i + 1];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) continue;
                    
                    // Wellpoints
                    let traveled = wpDistPx / 2; // Offset slightly from start
                    let wpCount = 0;
                    while (traveled <= dist) {
                      const t = traveled / dist;
                      const wpX = p1.x + dx * t;
                      const wpY = p1.y + dy * t;
                      const perpX = -dy / dist;
                      const perpY = dx / dist;
                      const offsetLength = 8; // Shrink wellpoints
                      const outerX = wpX + perpX * offsetLength;
                      const outerY = wpY + perpY * offsetLength;
                      elements.push(
                        <Group key={`wp-${line.id}-${i}-${wpCount}`} listening={false}>
                          <Line points={[wpX, wpY, outerX, outerY]} stroke="#94a3b8" strokeWidth={1.5} />
                          <Circle x={outerX} y={outerY} radius={4} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={1} />
                          <Circle x={outerX} y={outerY} radius={1.5} fill="#0369a1" />
                        </Group>
                      );
                      traveled += wpDistPx;
                      wpCount++;
                    }
                    
                    // Header dividers
                    let hTraveled = headerLengthPx;
                    let hCount = 0;
                    while (hTraveled <= dist) {
                      currentHeaderCount++;
                      const t = hTraveled / dist;
                      const hx = p1.x + dx * t;
                      const hy = p1.y + dy * t;
                      const perpX = -dy / dist;
                      const perpY = dx / dist;
                      const tickSize = 6;
                      elements.push(
                        <Line key={`ht-${line.id}-${i}-${hCount}`} points={[hx - perpX * tickSize, hy - perpY * tickSize, hx + perpX * tickSize, hy + perpY * tickSize]} stroke="#1e3a8a" strokeWidth={2} listening={false} />
                      );
                      elements.push(
                        <Text key={`hl-${line.id}-${i}-${hCount}`} x={hx + perpX * 10 - 6} y={hy + perpY * 10 - 4} text={`H${currentHeaderCount}`} fontSize={10} fontStyle="bold" fill="#1e3a8a" listening={false} />
                      );
                      hTraveled += headerLengthPx;
                      hCount++;
                    }
                  }
                  return elements;
                })()}
              </React.Fragment>
            );
          })}


          {/* Suction Pipes (yellow) */}
          {hoses.filter((h: any) => h.kind !== 'discharge' && !hiddenIds.has(h.id)).map((hose: any) => {
            const isSelected = activeTool === 'select' && selectedId === hose.id;
            return (
              <React.Fragment key={hose.id}>
                {/* Invisible wide hit area for easier clicking */}
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke="transparent"
                  strokeWidth={20}
                  lineJoin="round" lineCap="round"
                  onClick={(e) => handleHoseClick(e, hose.id)}
                  onTap={(e) => handleHoseClick(e, hose.id)}
                  draggable={isSelected && !hose.locked}
                  onDragStart={(e) => handleHoseDragStart(hose.id, e)}
                  onDragEnd={(e) => handleHoseDragEnd(hose.id, e)}
                />
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#eab308'}
                  strokeWidth={isSelected ? 6 : 4}
                  tension={0.5}
                  lineJoin="round" lineCap="round"
                  listening={false}
                />
                
                {/* Vertex handles when selected and NOT locked */}
                {isSelected && !hose.locked && hose.points.map((p: Point, i: number) => (
                  <Circle
                    key={`hvh-${i}`}
                    x={p.x} y={p.y}
                    radius={7}
                    fill="#fbbf24"
                    stroke="#78350f"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleHoseVertexDragMove(hose.id, i, e)}
                    onDragEnd={(e) => handleHoseVertexDragEnd(hose.id, i, e)}
                  />
                ))}

                {/* Length Label when selected */}
                {isSelected && hose.points.length > 1 && (() => {
                  const p1 = hose.points[0];
                  const p2 = hose.points[hose.points.length - 1];
                  let totalDist = 0;
                  for (let i = 0; i < hose.points.length - 1; i++) {
                    totalDist += distMeters(hose.points[i], hose.points[i+1]);
                  }
                  return (
                    <Text 
                      x={(p1.x + p2.x) / 2} 
                      y={(p1.y + p2.y) / 2 - 20} 
                      text={`L: ${totalDist.toFixed(1)}m`} 
                      fill="#854d0e" 
                      fontSize={12} 
                      fontStyle="bold" 
                      listening={false} 
                      align="center"
                      offsetX={50}
                      width={100}
                    />
                  );
                })()}
              </React.Fragment>
            );
          })}

          {/* Discharge Pipes (orange) */}
          {hoses.filter((h: any) => h.kind === 'discharge' && !hiddenIds.has(h.id)).map((hose: any) => {
            const isSelected = activeTool === 'select' && selectedId === hose.id;
            return (
              <React.Fragment key={hose.id}>
                {/* Invisible wide hit area for easier clicking */}
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke="transparent"
                  strokeWidth={20}
                  lineJoin="round" lineCap="round"
                  onClick={(e) => handleHoseClick(e, hose.id)}
                  onTap={(e) => handleHoseClick(e, hose.id)}
                  draggable={isSelected && !hose.locked}
                  onDragStart={(e) => handleHoseDragStart(hose.id, e)}
                  onDragEnd={(e) => handleHoseDragEnd(hose.id, e)}
                />
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#f97316'}
                  strokeWidth={isSelected ? 6 : 4}
                  tension={0.5}
                  lineJoin="round" lineCap="round"
                  listening={false}
                />
                
                {/* Vertex handles when selected and NOT locked */}
                {isSelected && !hose.locked && hose.points.map((p: Point, i: number) => (
                  <Circle
                    key={`hvh-d-${i}`}
                    x={p.x} y={p.y}
                    radius={7}
                    fill="#fbbf24"
                    stroke="#78350f"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleHoseVertexDragMove(hose.id, i, e)}
                    onDragEnd={(e) => handleHoseVertexDragEnd(hose.id, i, e)}
                  />
                ))}

                {/* Length Label when selected */}
                {isSelected && hose.points.length > 1 && (() => {
                  const p1 = hose.points[0];
                  const p2 = hose.points[hose.points.length - 1];
                  let totalDist = 0;
                  for (let i = 0; i < hose.points.length - 1; i++) {
                    totalDist += distMeters(hose.points[i], hose.points[i+1]);
                  }
                  return (
                    <Text 
                      x={(p1.x + p2.x) / 2} 
                      y={(p1.y + p2.y) / 2 - 20} 
                      text={`L: ${totalDist.toFixed(1)}m`} 
                      fill="#9a3412" 
                      fontSize={12} 
                      fontStyle="bold" 
                      listening={false} 
                      align="center"
                      offsetX={50}
                      width={100}
                    />
                  );
                })()}
              </React.Fragment>
            );
          })}

          {/* Current Suction Pipe Preview */}
          {currentHose.length > 0 && (() => {
            const pts = [...currentHose, ...(cursorPos ? [cursorPos] : [])];
            const totalM = pts.slice(0,-1).reduce((acc, p, i) => acc + distMeters(p, pts[i+1]), 0);
            const last = pts[pts.length - 2] || null;
            const cur = pts[pts.length - 1] || null;
            const segM = last && cur ? distMeters(last, cur) : 0;
            return (
              <>
                <Line points={pts.flatMap((p: Point) => [p.x, p.y])} stroke="#eab308" strokeWidth={4} tension={0.5} lineJoin="round" lineCap="round" dash={[8, 8]} opacity={0.8} listening={false} />
                {cur && <Text x={cur.x + 10} y={cur.y - 20} text={`Seg: ${segM.toFixed(1)}m | Total: ${totalM.toFixed(1)}m`} fill="#854d0e" fontSize={12} fontStyle="bold" padding={3} listening={false} />}
              </>
            );
          })()}

          {/* Current Discharge Pipe Preview */}
          {currentDischarge.length > 0 && (() => {
            const pts = [...currentDischarge, ...(cursorPos ? [cursorPos] : [])];
            const totalM = pts.slice(0,-1).reduce((acc, p, i) => acc + distMeters(p, pts[i+1]), 0);
            const last = pts[pts.length - 2] || null;
            const cur = pts[pts.length - 1] || null;
            const segM = last && cur ? distMeters(last, cur) : 0;
            return (
              <>
                <Line points={pts.flatMap((p: Point) => [p.x, p.y])} stroke="#f97316" strokeWidth={4} tension={0.5} lineJoin="round" lineCap="round" dash={[8, 8]} opacity={0.8} listening={false} />
                {cur && <Text x={cur.x + 10} y={cur.y - 20} text={`Seg: ${segM.toFixed(1)}m | Total: ${totalM.toFixed(1)}m`} fill="#9a3412" fontSize={12} fontStyle="bold" padding={3} listening={false} />}
              </>
            );
          })()}

          {/* Current Area Preview */}
          {currentAreaStart && cursorPos && (() => {
            const isDischarge = currentAreaStart.kind === 'discharge';
            const isSite = currentAreaStart.kind === 'site';
            const fillCol = isSite ? '#86efac' : isDischarge ? '#fed7aa' : '#fca5a5';
            const strokeCol = isSite ? '#22c55e' : isDischarge ? '#f97316' : '#ef4444';
            
            const w = Math.abs(cursorPos.x - currentAreaStart.pt.x);
            const h = Math.abs(cursorPos.y - currentAreaStart.pt.y);
            const wM = (w / PIXELS_PER_METER).toFixed(1);
            const hM = (h / PIXELS_PER_METER).toFixed(1);

            return (
              <Group listening={false}>
                <Rect
                  x={Math.min(currentAreaStart.pt.x, cursorPos.x)}
                  y={Math.min(currentAreaStart.pt.y, cursorPos.y)}
                  width={w}
                  height={h}
                  fill={fillCol} opacity={0.2}
                  stroke={strokeCol}
                  strokeWidth={1.5} dash={isSite ? undefined : [10, 5]}
                />
                <Text x={Math.min(currentAreaStart.pt.x, cursorPos.x) + w / 2 - 15} y={Math.min(currentAreaStart.pt.y, cursorPos.y) - 15} text={`${wM}m`} fill="#475569" fontSize={12} fontStyle="bold" />
                <Text x={Math.min(currentAreaStart.pt.x, cursorPos.x) - 15} y={Math.min(currentAreaStart.pt.y, cursorPos.y) + h / 2 - 10} text={`${hM}m`} fill="#475569" fontSize={12} fontStyle="bold" />
              </Group>
            );
          })()}

          {/* Saved Dimensions */}
          {(dimensions || []).map(dim => {
            const dx = dim.end.x - dim.start.x;
            const dy = dim.end.y - dim.start.y;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <Group key={dim.id}
                onMouseEnter={() => { if (activeTool === 'delete') document.body.style.cursor = 'pointer'; }}
                onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                onClick={(e) => {
                  if (activeTool === 'delete' && onDimensionsChange && dimensions) {
                    onDimensionsChange(dimensions.filter(d => d.id !== dim.id));
                    e.cancelBubble = true;
                  }
                }}
              >
                <Line points={[dim.start.x, dim.start.y, dim.end.x, dim.end.y]} stroke={activeTool === 'delete' ? '#ef4444' : '#64748b'} strokeWidth={1} listening={false} />
                <Line points={[dim.start.x - 5, dim.start.y - 5, dim.start.x + 5, dim.start.y + 5]} stroke="#64748b" strokeWidth={1.5} rotation={45} listening={false} />
                <Line points={[dim.end.x - 5, dim.end.y - 5, dim.end.x + 5, dim.end.y + 5]} stroke="#64748b" strokeWidth={1.5} rotation={45} listening={false} />
                <Text 
                  x={(dim.start.x + dim.end.x) / 2} 
                  y={(dim.start.y + dim.end.y) / 2} 
                  text={dim.text} 
                  fill="#334155" 
                  fontSize={14} 
                  fontStyle="bold"
                  align="center"
                  rotation={angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle}
                  offsetY={12}
                  offsetX={20}
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Current Dimension Preview */}
          {activeTool === 'dimension' && currentDim.length === 1 && cursorPos && (
            <Group listening={false}>
              <Line points={[currentDim[0].x, currentDim[0].y, cursorPos.x, cursorPos.y]} stroke="#3b82f6" strokeWidth={1} dash={[4, 4]} />
              <Text 
                x={(currentDim[0].x + cursorPos.x) / 2} 
                y={(currentDim[0].y + cursorPos.y) / 2} 
                text={`${(Math.sqrt(Math.pow(cursorPos.x - currentDim[0].x, 2) + Math.pow(cursorPos.y - currentDim[0].y, 2)) / PIXELS_PER_METER).toFixed(2)}m`}
                fill="#3b82f6" 
                fontSize={14} 
                fontStyle="bold"
                offsetY={12}
              />
            </Group>
          )}

          {/* Current in-progress line */}
          {currentLine.length > 0 && (
            <>
              <Line
                points={currentLine.flatMap(p => [p.x, p.y])}
                stroke="#ef4444" strokeWidth={4}
                lineJoin="round" lineCap="round"
                dash={[10, 5]} listening={false}
              />
              {currentLine.map((p, i) => (
                <Circle key={`c-${i}`} x={p.x} y={p.y} radius={4} fill="#b91c1c" listening={false} />
              ))}
            </>
          )}

          {/* Rubber-band preview */}
          {previewPoint && lastPoint && (
            <>
              <Line
                points={[lastPoint.x, lastPoint.y, previewPoint.x, previewPoint.y]}
                stroke={(shiftHeld || orthoLocked) ? '#22c55e' : '#ef4444'}
                strokeWidth={2} dash={[6, 4]} opacity={0.75} listening={false}
              />
              {resolvedDistM !== null && (
                <Text
                  x={(lastPoint.x + previewPoint.x) / 2 + 6}
                  y={(lastPoint.y + previewPoint.y) / 2 - 18}
                  text={`${resolvedDistM.toFixed(2)} m`}
                  fontSize={13} fontStyle="bold"
                  fill={dimTyped ? '#3b82f6' : (shiftHeld || orthoLocked) ? '#16a34a' : '#b91c1c'}
                  listening={false}
                />
              )}
            </>
          )}

          {placedComponents.map(renderComponent)}
          {/* Transformer */}
          {activeTool === 'select' && (
            <Transformer 
              ref={trRef} 
              rotateEnabled={false} 
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                return newBox;
              }}
            />
          )}

        </Layer>
      </Stage>

      {/* Area Properties Panel */}
      {selectedArea && activeTool === 'select' && (
        <DraggablePanel title="Area Dimensions" onClose={() => setSelectedId(null)}>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Assigned Level</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                value={selectedArea.levelId || activeLevelId}
                onChange={(e) => {
                  if (onAreasChange) {
                    onAreasChange(areas.map((a: any) => a.id === selectedId ? { ...a, levelId: e.target.value } : a));
                  }
                }}
              >
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name} (-{l.depthFromGL}m)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Length (m)</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                value={parseFloat((selectedArea.width / PIXELS_PER_METER).toFixed(1))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0 && onAreasChange) {
                    onAreasChange(areas.map((a: any) => a.id === selectedId ? { ...a, width: val * PIXELS_PER_METER } : a));
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Breadth (m)</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                value={parseFloat((selectedArea.height / PIXELS_PER_METER).toFixed(1))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0 && onAreasChange) {
                    onAreasChange(areas.map((a: any) => a.id === selectedId ? { ...a, height: val * PIXELS_PER_METER } : a));
                  }
                }}
              />
            </div>
          </div>
        </DraggablePanel>
      )}

      {/* Line Properties Panel */}
      {selectedLine && activeTool === 'select' && (
        <DraggablePanel title="Header Properties" onClose={() => setSelectedId(null)}>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Assigned Level</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                value={selectedLine.levelId || activeLevelId}
                onChange={(e) => {
                  if (onLinesChange) {
                    onLinesChange(lines.map((l: any) => l.id === selectedId ? { ...l, levelId: e.target.value } : l));
                  }
                }}
              >
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name} (-{l.depthFromGL}m)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Depth from Level (m)</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="e.g. 5"
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                value={selectedLine.depthFromGL !== undefined ? selectedLine.depthFromGL : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  if (onLinesChange) {
                    onLinesChange(lines.map((l: any) => l.id === selectedId ? { ...l, depthFromGL: val } : l));
                  }
                }}
              />
              <p className="text-[10px] text-slate-400 mt-1">Relative to the assigned level.</p>
            </div>
          </div>
        </DraggablePanel>
      )}

      {/* AutoCAD-style floating HUD */}
      {isDrawing && cursorPos && (
        <div
          className="absolute z-50 pointer-events-none select-none"
          style={{
            // Convert world coords to screen coords for the HUD
            left: Math.min((cursorPos.x * scale + position.x) + 22, canvasSize.width - 180),
            top: Math.min((cursorPos.y * scale + position.y) + 22, canvasSize.height - 52),
          }}
        >
          <div className={`flex items-center gap-1.5 rounded-md shadow-2xl px-3 py-1.5 border transition-colors ${
            dimTyped ? 'bg-gray-900 border-blue-400' : 'bg-gray-900/80 border-gray-600'
          }`}>
            <span className="text-gray-400 text-xs font-mono">L =</span>
            <span className={`text-sm font-mono font-bold min-w-[52px] tracking-wider ${dimTyped ? 'text-blue-300' : 'text-gray-400'}`}>
              {dimTyped || (liveDistM !== null ? liveDistM.toFixed(2) : '—')}
            </span>
            <span className="text-gray-500 text-xs">m</span>
            {dimTyped && <span className="text-blue-500 text-xs font-semibold ml-1 animate-pulse">↵</span>}
          </div>
          {(shiftHeld || orthoLocked) && (
            <div className="mt-1 bg-green-800/90 border border-green-500 text-green-300 text-xs font-semibold px-2 py-0.5 rounded">
              ⟂ Ortho ON
            </div>
          )}
        </div>
      )}

      {/* Mobile Drawing Actions (Cancel / Done) */}
      {isDrawing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:hidden z-50">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (currentAreaStart) setCurrentAreaStart(null);
              if (activeTool === 'line') setCurrentLine([]);
              if (activeTool === 'hose') setCurrentHose([]);
              if (activeTool === 'discharge') setCurrentDischarge([]);
              setCursorPos(null);
              setDimTyped('');
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-500 border border-red-200 rounded-full shadow-lg font-semibold text-sm active:bg-red-50"
          >
            <X size={16} /> Cancel
          </button>
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (activeTool === 'line' && currentLine.length > 0) finishLine(currentLine);
              if (activeTool === 'hose' && currentHose.length > 0) finishLine(currentHose);
              if (activeTool === 'discharge' && currentDischarge.length > 0) finishLine(currentDischarge);
              if (currentAreaStart) setCurrentAreaStart(null);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg font-semibold text-sm active:bg-blue-700"
          >
            <Check size={16} /> Done
          </button>
        </div>
      )}

      </div>
    </div>
  );
};
