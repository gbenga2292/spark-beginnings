import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Image as KonvaImage, Transformer, RegularPolygon, Arrow } from 'react-konva';
import useImage from 'use-image';
import { Point, LineData, PlacedComponent, ComponentType, DimensionData, PIXELS_PER_METER, ElevationLevel, AreaData, HoseData, ArrowData, TextData, calculateBOM } from '../../utils/simulationLogic';
import { CADLayer } from '../../utils/cadDataModels';
import { findSnapPoint, findConnectionSnap, SnapPoint } from '../../utils/geometryEngine';
import { Check, X } from 'lucide-react';
import { ActiveTool } from './Toolbar';
import { DesignPanel } from './DesignPanel';
import { DraggablePanel } from './DraggablePanel';
import { toast } from '../ui/toast';

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
  wellpointSide?: 'left' | 'right' | 'both';
  orthoLocked?: boolean;
  gridSnap?: boolean;
  dimensions?: DimensionData[];
  onDimensionsChange?: (dims: DimensionData[]) => void;
  areas: AreaData[];
  onAreasChange?: (areas: AreaData[]) => void;
  hoses: HoseData[];
  onHosesChange?: (hoses: HoseData[]) => void;
  arrows?: ArrowData[];
  onArrowsChange?: (arrows: ArrowData[]) => void;
  texts?: TextData[];
  onTextsChange?: (texts: TextData[]) => void;
  levels: ElevationLevel[];
  activeLevelId: string;
  onSelectLevel?: (id: string) => void;
  onAddLevel?: (level: ElevationLevel) => void;
  onUpdateLevel?: (id: string, updates: Partial<ElevationLevel>) => void;
  onDeleteLevel?: (id: string) => void;
  layers?: CADLayer[];
  activeLayerId?: string;
  onExportWindowSelected?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onSelectLayer?: (id: string) => void;
  onUpdateLayer?: (id: string, updates: Partial<CADLayer>) => void;
  onAddLayer?: (layer: CADLayer) => void;
  onDeleteLayer?: (id: string) => void;
  stageRef?: React.RefObject<any>;
  onCursorPosChange?: (pos: Point | null) => void;
  onSelectionChange?: (id: string | null) => void;
  
  // Options states
  blueprintSettings?: any;
  onUpdateBlueprintSettings?: (updates: any) => void;
  offsetDistance?: number;
  mirrorCopy?: boolean;
  drawShapeMode?: 'rect' | 'poly';
  textColor?: string;
  textSize?: number;
  
  // Reference Scale mode
  scaleRefMode?: 'idle' | 'selecting-start' | 'selecting-end';
  scaleRefPt1?: Point | null;
  scaleRefPt2?: Point | null;
  onSetScaleRefPt1?: (pt: Point) => void;
  onSetScaleRefPt2?: (pt: Point) => void;
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

function offsetPath(points: Point[], distancePx: number): Point[] {
  if (points.length < 2) return points.map(p => ({ ...p }));
  
  const newPoints: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    let dx = 0;
    let dy = 0;
    
    if (i === 0) {
      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;
    } else if (i === points.length - 1) {
      dx = points[i].x - points[i - 1].x;
      dy = points[i].y - points[i - 1].y;
    } else {
      const dx1 = points[i].x - points[i - 1].x;
      const dy1 = points[i].y - points[i - 1].y;
      const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
      
      const dx2 = points[i + 1].x - points[i].x;
      const dy2 = points[i + 1].y - points[i].y;
      const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
      
      if (len1 > 0 && len2 > 0) {
        dx = (dx1 / len1 + dx2 / len2) / 2;
        dy = (dy1 / len1 + dy2 / len2) / 2;
      } else {
        dx = dx1 || dx2;
        dy = dy1 || dy2;
      }
    }
    
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      newPoints.push({ ...points[i] });
      continue;
    }
    
    const px = -dy / len;
    const py = dx / len;
    
    newPoints.push({
      x: points[i].x + px * distancePx,
      y: points[i].y + py * distancePx
    });
  }
  return newPoints;
}

function reflectPoint(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...p };
  
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  
  return {
    x: 2 * projX - p.x,
    y: 2 * projY - p.y
  };
}

function findLineIntersection(p1: Point, p2: Point, q1: Point, q2: Point): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = q2.x - q1.x;
  const d2y = q2.y - q1.y;
  
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 0.0001) return null;
  
  const t = ((q1.x - p1.x) * d2y - (q1.y - p1.y) * d2x) / denom;
  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y
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

function getTangentLengthsForSegment(lines: LineData[], line: LineData, segmentIdx: number): { T_start: number; T_end: number } {
  const R = 0.2; // bend radius in meters
  const threshold = 12; // Snap distance in pixels
  const points = line.points;
  const n = points.length;
  
  let T_start = 0;
  let T_end = 0;

  // 1. Calculate T_start (at points[segmentIdx])
  if (segmentIdx > 0) {
    T_start = getTangentLengthAtInternalVertex(points, segmentIdx);
  } else {
    // Endpoint: check if snapped to another line's endpoint
    const startPt = points[0];
    let snappedPt: Point | null = null;
    let otherDir: Point | null = null;
    
    for (const l of lines) {
      if (l.id !== line.id && l.points.length > 1) {
        const ep1 = l.points[0];
        const ep2 = l.points[l.points.length - 1];
        if (Math.sqrt((startPt.x - ep1.x) ** 2 + (startPt.y - ep1.y) ** 2) < threshold) {
          snappedPt = ep1;
          otherDir = { x: l.points[1].x - ep1.x, y: l.points[1].y - ep1.y };
          break;
        } else if (Math.sqrt((startPt.x - ep2.x) ** 2 + (startPt.y - ep2.y) ** 2) < threshold) {
          snappedPt = ep2;
          otherDir = { x: l.points[l.points.length - 2].x - ep2.x, y: l.points[l.points.length - 2].y - ep2.y };
          break;
        }
      }
    }
    if (snappedPt && otherDir) {
      const thisDir = { x: points[1].x - startPt.x, y: points[1].y - startPt.y };
      T_start = getTangentLengthBetweenVectors(thisDir, otherDir);
    }
  }

  // 2. Calculate T_end (at points[segmentIdx + 1])
  if (segmentIdx < n - 2) {
    T_end = getTangentLengthAtInternalVertex(points, segmentIdx + 1);
  } else {
    // Endpoint: check if snapped to another line's endpoint
    const endPt = points[n - 1];
    let snappedPt: Point | null = null;
    let otherDir: Point | null = null;
    
    for (const l of lines) {
      if (l.id !== line.id && l.points.length > 1) {
        const ep1 = l.points[0];
        const ep2 = l.points[l.points.length - 1];
        if (Math.sqrt((endPt.x - ep1.x) ** 2 + (endPt.y - ep1.y) ** 2) < threshold) {
          snappedPt = ep1;
          otherDir = { x: l.points[1].x - ep1.x, y: l.points[1].y - ep1.y };
          break;
        } else if (Math.sqrt((endPt.x - ep2.x) ** 2 + (endPt.y - ep2.y) ** 2) < threshold) {
          snappedPt = ep2;
          otherDir = { x: l.points[l.points.length - 2].x - ep2.x, y: l.points[l.points.length - 2].y - ep2.y };
          break;
        }
      }
    }
    if (snappedPt && otherDir) {
      const thisDir = { x: points[n - 2].x - endPt.x, y: points[n - 2].y - endPt.y };
      T_end = getTangentLengthBetweenVectors(thisDir, otherDir);
    }
  }

  return { T_start, T_end };
}

function getTangentLengthAtInternalVertex(points: Point[], idx: number): number {
  const prev = points[idx - 1];
  const curr = points[idx];
  const next = points[idx + 1];
  return getTangentLengthBetweenVectors(
    { x: prev.x - curr.x, y: prev.y - curr.y },
    { x: next.x - curr.x, y: next.y - curr.y }
  );
}

function getTangentLengthBetweenVectors(v1: Point, v2: Point): number {
  const len1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
  const len2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
  if (len1 === 0 || len2 === 0) return 0;
  
  const a1 = Math.atan2(v1.y, v1.x);
  const a2 = Math.atan2(v2.y, v2.x);
  let diff = a2 - a1;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  const deflectionAngle = Math.PI - Math.abs(diff);
  
  const R = 0.2;
  const T_meters = R * Math.tan(deflectionAngle / 2);
  return T_meters * PIXELS_PER_METER;
}

const LegendIcon = ({ label }: { label: string }) => {
  const l = label.toUpperCase();
  if (l.includes('WELL POINT')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Circle x={7} y={7} r={3.5} fill="black" />
      </Group>
    );
  }
  if (l.includes('HEADER')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Rect x={2} y={4.5} width={10} height={5} cornerRadius={2.5} stroke="black" strokeWidth={1} />
        <Circle x={7} y={7} r={1.5} fill="black" />
      </Group>
    );
  }
  if (l.includes('TEE') || l.includes('FLUSH')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Line points={[4.5, 4.5, 9.5, 4.5]} stroke="black" strokeWidth={1.5} />
        <Line points={[7, 4.5, 7, 9.5]} stroke="black" strokeWidth={1.5} />
      </Group>
    );
  }
  if (l.includes('ELBOW')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Line points={[4.5, 4.5, 4.5, 9.5, 9.5, 9.5]} stroke="black" strokeWidth={1.5} />
      </Group>
    );
  }
  if (l.includes('PUMP')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Rect x={3.5} y={3.5} width={7} height={7} fill="black" />
      </Group>
    );
  }
  if (l.includes('HOSE')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Line points={[2, 7, 12, 7]} stroke={l.includes('DISCHARGE') ? '#2563eb' : '#eab308'} strokeWidth={1.5} dash={[2, 2]} />
      </Group>
    );
  }
  if (l.includes('EXCAVATION')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Rect x={2} y={2} width={10} height={10} fill="rgba(252, 165, 165, 0.5)" />
      </Group>
    );
  }
  if (l.includes('BOUNDARY')) {
    return (
      <Group>
        <Rect width={14} height={14} stroke="black" strokeWidth={1} />
        <Line points={[2, 7, 12, 7]} stroke="#93c5fd" strokeWidth={2} />
      </Group>
    );
  }
  return <Rect width={14} height={14} stroke="black" strokeWidth={1} />;
};

const KonvaLegend = ({ lines, placedComponents, hoses, areas, pos, onDragEnd, scale }: any) => {
  const results = calculateBOM(lines, placedComponents, PIXELS_PER_METER);
  const activeLegendItems: string[] = [];
  if (results.headers > 0) activeLegendItems.push('HEADER PIPES');
  if (results.wellpoints > 0) activeLegendItems.push('WELL POINTS');
  if (results.pumps > 0) activeLegendItems.push('DEWATERING PUMPS');
  if (results.elbows > 0) activeLegendItems.push('ELBOW CONNECTORS');
  if (results.tees > 0) activeLegendItems.push('FLUSH CONNECTIONS');
  if (hoses.some((h: any) => h.kind === 'suction' || h.kind === 'hose')) activeLegendItems.push('SUCTION HOSES');
  if (hoses.some((h: any) => h.kind === 'discharge')) activeLegendItems.push('DISCHARGE HOSES');
  if (areas.some((a: any) => a.kind === 'excavation')) activeLegendItems.push('EXCAVATION AREA');
  if (areas.some((a: any) => a.kind === 'boundary' || !a.kind)) activeLegendItems.push('SITE BOUNDARY');

  if (activeLegendItems.length === 0) return null;

  const boxWidth = 140 / scale;
  const itemHeight = 18 / scale;
  const padding = 10 / scale;
  const boxHeight = padding * 2 + activeLegendItems.length * itemHeight;

  return (
    <Group 
      x={pos.x} 
      y={pos.y} 
      draggable 
      onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
    >
      <Rect width={boxWidth} height={boxHeight} fill="white" stroke="black" strokeWidth={1 / scale} opacity={0.95} />
      {activeLegendItems.map((label, idx) => {
        const y = padding + idx * itemHeight;
        return (
          <Group key={label} x={padding} y={y}>
            <Group scale={{ x: 1/scale, y: 1/scale }}>
              <LegendIcon label={label} />
            </Group>
            <Text x={22 / scale} y={3 / scale} text={label} fontSize={9 / scale} fontFamily="sans-serif" fontStyle="bold" fill="black" />
          </Group>
        );
      })}
    </Group>
  );
};

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
  wellpointSide = 'left',
  orthoLocked,
  gridSnap,
  areas = [],
  onAreasChange,
  hoses = [],
  onHosesChange,
  arrows = [],
  onArrowsChange,
  texts = [],
  onTextsChange,
  levels,
  activeLevelId,
  onSelectLevel,
  onAddLevel,
  onUpdateLevel,
  onDeleteLevel,
  layers = [],
  activeLayerId,
  onSelectLayer: onSelectCadLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onSelectionChange,
  onExportWindowSelected,
  stageRef: externalStageRef,
  onCursorPosChange,
  blueprintSettings = { visible: true, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.5, locked: true },
  onUpdateBlueprintSettings,
  offsetDistance = 2.0,
  mirrorCopy = true,
  drawShapeMode = 'rect',
  textColor = '#000000',
  textSize = 14,
  scaleRefMode = 'idle',
  scaleRefPt1,
  scaleRefPt2,
  onSetScaleRefPt1,
  onSetScaleRefPt2
}) => {
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [currentDim, setCurrentDim] = useState<Point[]>([]);
  const [currentAreaStart, setCurrentAreaStart] = useState<{ pt: Point; kind: 'excavation' | 'discharge' | 'site' } | null>(null);
  const [currentExportStart, setCurrentExportStart] = useState<Point | null>(null);
  const [currentHose, setCurrentHose] = useState<Point[]>([]);
  const [currentDischarge, setCurrentDischarge] = useState<Point[]>([]);
  const [currentArrow, setCurrentArrow] = useState<Point[]>([]);
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; val: string; editingId?: string } | null>(null);
  const [alignRef, setAlignRef] = useState<{ x?: number; y?: number } | null>(null);
  const [trimFirstId, setTrimFirstId] = useState<string | null>(null);
  const [mirrorAxisPoints, setMirrorAxisPoints] = useState<Point[]>([]);
  const [legendPos, setLegendPos] = useState({ x: 20, y: 20 });
  
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

  const [bgImage] = useImage(backgroundImageUrl || '', (backgroundImageUrl || '').startsWith('blob:') ? undefined : 'anonymous');
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [dimTyped, setDimTyped] = useState('');
  
  const isDrawing = currentLine.length > 0 || currentHose.length > 0 || currentDischarge.length > 0 || currentAreaStart !== null || currentExportStart !== null;

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosRef = useRef<{ x: number, y: number } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectElement = (id: string, e?: any) => {
    if (e) {
      e.cancelBubble = true;
      if (e.evt) {
        e.evt.preventDefault();
        e.evt.stopPropagation();
      }
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size > 0) {
        const lastAdded = Array.from(next)[next.size - 1];
        setSelectedId(lastAdded);
      } else {
        setSelectedId(null);
      }
      return next;
    });
  };

  const selectSingleElement = (id: string | null) => {
    setSelectedId(id);
    if (id === null) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set([id]));
    }
  };
  const selectedArea = areas.find((a: any) => a.id === selectedId);
  const selectedLine = lines.find((l: any) => l.id === selectedId);
  const selectedHose = hoses.find((h: any) => h.id === selectedId);

  // Are we currently dragging the whole line body (not a vertex)?
  const lineDragStartRef = useRef<{ points: Point[]; mouseX: number; mouseY: number } | null>(null);
  const hoseDragStartRef = useRef<{ points: Point[]; mouseX: number; mouseY: number } | null>(null);

  const localStageRef = useRef<any>(null);

  // --- Visibility state (hidden items) ---
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const isItemVisible = useCallback((item: any) => !hiddenIds.has(item.id), [hiddenIds]);

  // --- UI State ---
  const [showHUD, setShowHUD] = useState(true);
  const [osnapEnabled, setOsnapEnabled] = useState(true);
  const [currentSnap, setCurrentSnap] = useState<SnapPoint | null>(null);

  const stageRef = externalStageRef || localStageRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const textEditorScreenPos = textEditor ? {
    left: textEditor.x * scale + position.x,
    top: textEditor.y * scale + position.y,
  } : null;



  // Transformer Ref for resizing
  const trRef = useRef<any>(null);

  // ---------- resize canvas ----------
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(containerRef.current);
    
    // Initial size
    setCanvasSize({ 
      width: containerRef.current.offsetWidth, 
      height: containerRef.current.offsetHeight 
    });

    return () => {
      observer.disconnect();
    };
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
    setAlignRef(null);
    setTrimFirstId(null);
    setMirrorAxisPoints([]);
    setTextEditor(null);
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
    } else if (activeTool === 'modify-blueprint' && !blueprintSettings.locked && trRef.current) {
      const node = stageRef.current?.findOne('#blueprint-underlay');
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, activeTool, areas, blueprintSettings.locked, bgImage]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedId);
    }
  }, [selectedId, onSelectionChange]);

  // ---------- geometry helpers ----------
  const getSnappedPoint = useCallback((raw: Point): Point => {
    let pt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;

    // Object Snap
    if (osnapEnabled) {
      const snapLines = [
        ...lines.filter(isItemVisible),
        ...hoses.filter(isItemVisible)
      ];
      areas.filter(isItemVisible).forEach((a: any) => {
        snapLines.push({
          id: a.id,
          points: [
            { x: a.x, y: a.y },
            { x: a.x + a.width, y: a.y },
            { x: a.x + a.width, y: a.y + a.height },
            { x: a.x, y: a.y + a.height },
            { x: a.x, y: a.y }
          ]
        });
      });

      // Helper: rotate a local offset by component rotation angle
      const rotatePort = (ox: number, oy: number, angleDeg: number) => {
        const r = (angleDeg || 0) * (Math.PI / 180);
        return {
          x: ox * Math.cos(r) - oy * Math.sin(r),
          y: ox * Math.sin(r) + oy * Math.cos(r),
        };
      };

      // --- Priority connection ports (magnetic 30px snap) ---
      const connectionPorts: { id: string; pt: Point }[] = [];
      const isConnTool = ['hose', 'discharge', 'line', 'select'].includes(activeTool);

      if (isConnTool) {
        // Header pipe open endpoints
        lines.filter(isItemVisible).forEach((l: any) => {
          if (l.points?.length >= 2) {
            const first = l.points[0];
            const last = l.points[l.points.length - 1];
            connectionPorts.push({ id: `hdr-start-${l.id}`, pt: { x: first.x, y: first.y } });
            connectionPorts.push({ id: `hdr-end-${l.id}`, pt: { x: last.x, y: last.y } });
          }
        });
      }

      placedComponents.forEach((c: any) => {
        if (c.type === 'pump' && isConnTool) {
          // Always offer both suction and discharge ports for connection/select tools
          const suctionPt = { x: c.x - 20, y: c.y };
          connectionPorts.push({ id: `pump-suction-${c.id}`, pt: suctionPt });
          snapLines.push({ id: `pump-suction-${c.id}`, points: [suctionPt, suctionPt] });

          const dischargePt = { x: c.x + 20, y: c.y };
          connectionPorts.push({ id: `pump-discharge-${c.id}`, pt: dischargePt });
          snapLines.push({ id: `pump-discharge-${c.id}`, points: [dischargePt, dischargePt] });
        }

        // Tee: 3 ports — left (-15,0), right (15,0), branch (0,15)
        if (c.type === 'tee' && isConnTool) {
          const teeLocalPorts = [[-15, 0], [15, 0], [0, 15]];
          teeLocalPorts.forEach(([ox, oy], i) => {
            const p = rotatePort(ox, oy, c.rotation || 0);
            const wp = { x: c.x + p.x, y: c.y + p.y };
            connectionPorts.push({ id: `tee-port-${c.id}-${i}`, pt: wp });
            snapLines.push({ id: `tee-port-${c.id}-${i}`, points: [wp, wp] });
          });
        }

        // Elbow: 2 ports — left (-12,0) and bottom (0,12)
        if (c.type === 'elbow' && isConnTool) {
          const elbowLocalPorts = [[-12, 0], [0, 12]];
          elbowLocalPorts.forEach(([ox, oy], i) => {
            const p = rotatePort(ox, oy, c.rotation || 0);
            const wp = { x: c.x + p.x, y: c.y + p.y };
            connectionPorts.push({ id: `elbow-port-${c.id}-${i}`, pt: wp });
            snapLines.push({ id: `elbow-port-${c.id}-${i}`, points: [wp, wp] });
          });
        }
      });

      // Priority connection snap (30px) → fallback to general snap (15px)
      const connSnap = isConnTool ? findConnectionSnap(pt, connectionPorts) : null;
      if (connSnap) {
        pt = connSnap.pt;
      } else {
        const snapResult = findSnapPoint(pt, snapLines);
        if (snapResult) pt = snapResult.pt;
      }
    }

    if (currentLine.length === 0) return pt;
    const prev = currentLine[currentLine.length - 1];
    pt = (shiftHeld || orthoLocked) ? snapToAngle(prev, pt) : pt;
    if (fixedLineLengthMeters) pt = applyFixedLength(prev, pt, fixedLineLengthMeters);
    return pt;
  }, [currentLine, shiftHeld, orthoLocked, fixedLineLengthMeters, gridSnap, osnapEnabled, lines, hoses, areas, isItemVisible, layers, activeTool, placedComponents]);

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

  const mirrorElementAcrossAxis = useCallback((targetId: string, a: Point, b: Point) => {
    const area = areas.find(x => x.id === targetId);
    const line = lines.find(x => x.id === targetId);
    const hose = hoses.find(x => x.id === targetId);
    const comp = placedComponents.find(x => x.id === targetId);
    const textDim = dimensions?.find(x => x.id === targetId);

    const isCopy = mirrorCopy;

    if (area && onAreasChange) {
      const nextArea = { ...area, id: isCopy ? crypto.randomUUID() : area.id };
      if (area.points) {
        nextArea.points = area.points.map(p => reflectPoint(p, a, b));
        const xs = nextArea.points.map(p => p.x);
        const ys = nextArea.points.map(p => p.y);
        nextArea.x = Math.min(...xs);
        nextArea.y = Math.min(...ys);
        nextArea.width = Math.max(...xs) - nextArea.x;
        nextArea.height = Math.max(...ys) - nextArea.y;
      } else {
        const pTL = reflectPoint({ x: area.x, y: area.y }, a, b);
        const pBR = reflectPoint({ x: area.x + area.width, y: area.y + area.height }, a, b);
        nextArea.x = Math.min(pTL.x, pBR.x);
        nextArea.y = Math.min(pTL.y, pBR.y);
        nextArea.width = Math.abs(pTL.x - pBR.x);
        nextArea.height = Math.abs(pTL.y - pBR.y);
      }
      if (isCopy) onAreasChange([...areas, nextArea]);
      else onAreasChange(areas.map(x => x.id === targetId ? nextArea : x));
      toast.success("Area mirrored.");
    } else if (line && onLinesChange) {
      const nextLine = { ...line, id: isCopy ? crypto.randomUUID() : line.id, points: line.points.map(p => reflectPoint(p, a, b)) };
      if (isCopy) onLinesChange([...lines, nextLine]);
      else onLinesChange(lines.map(x => x.id === targetId ? nextLine : x));
      toast.success("Pipeline mirrored.");
    } else if (hose && onHosesChange) {
      const nextHose = { ...hose, id: isCopy ? crypto.randomUUID() : hose.id, points: hose.points.map(p => reflectPoint(p, a, b)) };
      if (isCopy) onHosesChange([...hoses, nextHose]);
      else onHosesChange(hoses.map(x => x.id === targetId ? nextHose : x));
      toast.success("Hose mirrored.");
    } else if (comp && onPlacedComponentsChange) {
      const nextCompPt = reflectPoint({ x: comp.x, y: comp.y }, a, b);
      const axisAngleRad = Math.atan2(b.y - a.y, b.x - a.x);
      const axisAngleDeg = axisAngleRad * (180 / Math.PI);
      const nextRot = (2 * axisAngleDeg - (comp.rotation || 0) + 360) % 360;
      
      const nextComp = { ...comp, id: isCopy ? crypto.randomUUID() : comp.id, x: nextCompPt.x, y: nextCompPt.y, rotation: nextRot };
      if (isCopy) onPlacedComponentsChange([...placedComponents, nextComp]);
      else onPlacedComponentsChange(placedComponents.map(x => x.id === targetId ? nextComp : x));
      toast.success("Component mirrored.");
    } else if (textDim && onDimensionsChange && dimensions) {
      const nextTextDimPt = reflectPoint({ x: textDim.x || textDim.start.x, y: textDim.y || textDim.start.y }, a, b);
      const nextTextDim = {
        ...textDim,
        id: isCopy ? crypto.randomUUID() : textDim.id,
        x: nextTextDimPt.x,
        y: nextTextDimPt.y,
        start: reflectPoint(textDim.start, a, b),
        end: reflectPoint(textDim.end, a, b)
      };
      if (isCopy) onDimensionsChange([...dimensions, nextTextDim]);
      else onDimensionsChange(dimensions.map(x => x.id === targetId ? nextTextDim : x));
      toast.success("Text mirrored.");
    }
  }, [areas, lines, hoses, placedComponents, dimensions, mirrorCopy, onAreasChange, onLinesChange, onHosesChange, onPlacedComponentsChange, onDimensionsChange]);

  const executeModifyCommand = useCallback((type: 'area' | 'line' | 'hose' | 'component' | 'text' | 'dimension', elementId: string, clickPt?: Point) => {
    if (activeTool === 'pin' || activeTool === 'unpin') {
      const lockVal = activeTool === 'pin';
      if (type === 'area' && onAreasChange) {
        onAreasChange(areas.map(a => a.id === elementId ? { ...a, locked: lockVal } : a));
      } else if (type === 'line' && onLinesChange) {
        onLinesChange(lines.map(l => l.id === elementId ? { ...l, locked: lockVal } : l));
      } else if (type === 'hose' && onHosesChange) {
        onHosesChange(hoses.map(h => h.id === elementId ? { ...h, locked: lockVal } : h));
      } else if (type === 'component' && onPlacedComponentsChange) {
        onPlacedComponentsChange(placedComponents.map(c => c.id === elementId ? { ...c, locked: lockVal } as any : c));
      } else if (type === 'text' && onDimensionsChange && dimensions) {
        onDimensionsChange(dimensions.map(d => d.id === elementId ? { ...d, locked: lockVal } : d));
      }
      toast.success(lockVal ? "Element pinned." : "Element unpinned.");
      return true;
    }

    if (activeTool === 'delete') {
      if (type === 'area' && onAreasChange) onAreasChange(areas.filter(a => a.id !== elementId));
      if (type === 'line' && onLinesChange) onLinesChange(lines.filter(l => l.id !== elementId));
      if (type === 'hose' && onHosesChange) onHosesChange(hoses.filter(h => h.id !== elementId));
      if (type === 'component' && onPlacedComponentsChange) onPlacedComponentsChange(placedComponents.filter(c => c.id !== elementId));
      if ((type === 'text' || type === 'dimension') && onDimensionsChange && dimensions) onDimensionsChange(dimensions.filter(d => d.id !== elementId));
      if (selectedId === elementId) setSelectedId(null);
      return true;
    }

    if (activeTool === 'copy') {
      const shiftPx = 40;
      if (type === 'area' && onAreasChange) {
        const area = areas.find(a => a.id === elementId);
        if (area) {
          const newArea = { ...area, id: crypto.randomUUID(), x: area.x + shiftPx, y: area.y + shiftPx };
          if (area.points) {
            newArea.points = area.points.map(p => ({ x: p.x + shiftPx, y: p.y + shiftPx }));
          }
          onAreasChange([...areas, newArea]);
        }
      } else if (type === 'line' && onLinesChange) {
        const line = lines.find(l => l.id === elementId);
        if (line) onLinesChange([...lines, { ...line, id: crypto.randomUUID(), points: line.points.map(p => ({ x: p.x + shiftPx, y: p.y + shiftPx })) }]);
      } else if (type === 'hose' && onHosesChange) {
        const hose = hoses.find(h => h.id === elementId);
        if (hose) onHosesChange([...hoses, { ...hose, id: crypto.randomUUID(), points: hose.points.map(p => ({ x: p.x + shiftPx, y: p.y + shiftPx })) }]);
      } else if (type === 'component' && onPlacedComponentsChange) {
        const comp = placedComponents.find(c => c.id === elementId);
        if (comp) onPlacedComponentsChange([...placedComponents, { ...comp, id: crypto.randomUUID(), x: comp.x + shiftPx, y: comp.y + shiftPx }]);
      } else if (type === 'text' && onDimensionsChange && dimensions) {
        const dim = dimensions.find(d => d.id === elementId);
        if (dim) onDimensionsChange([...dimensions, { ...dim, id: crypto.randomUUID(), x: (dim.x || 0) + shiftPx, y: (dim.y || 0) + shiftPx, start: { x: dim.start.x + shiftPx, y: dim.start.y + shiftPx }, end: { x: dim.end.x + shiftPx, y: dim.end.y + shiftPx } }]);
      }
      toast.success("Element duplicated.");
      return true;
    }

    if (activeTool === 'offset') {
      const distPx = offsetDistance * PIXELS_PER_METER;
      if (type === 'line' && onLinesChange) {
        const line = lines.find(l => l.id === elementId);
        if (line) {
          const offPts = offsetPath(line.points, distPx);
          onLinesChange([...lines, { ...line, id: crypto.randomUUID(), points: offPts }]);
          toast.success("Pipeline offset created.");
        }
      } else if (type === 'hose' && onHosesChange) {
        const hose = hoses.find(h => h.id === elementId);
        if (hose) {
          const offPts = offsetPath(hose.points, distPx);
          onHosesChange([...hoses, { ...hose, id: crypto.randomUUID(), points: offPts }]);
          toast.success("Hose offset created.");
        }
      } else if (type === 'area' && onAreasChange) {
        const area = areas.find(a => a.id === elementId);
        if (area) {
          const newArea = {
            ...area,
            id: crypto.randomUUID(),
            x: area.x + distPx,
            y: area.y + distPx
          };
          if (area.points) {
            newArea.points = offsetPath(area.points, distPx);
          }
          onAreasChange([...areas, newArea]);
          toast.success("Area offset created.");
        }
      }
      return true;
    }

    if (activeTool === 'align') {
      if (!alignRef) {
        if (clickPt) {
          setAlignRef({ x: clickPt.x });
          toast.success("Alignment axis set. Click elements to align vertically.");
        }
      } else {
        if (type === 'component' && onPlacedComponentsChange) {
          onPlacedComponentsChange(placedComponents.map(c => {
            if (c.id === elementId && !(c as any).locked) {
              return { ...c, x: alignRef.x !== undefined ? alignRef.x : c.x, y: alignRef.y !== undefined ? alignRef.y : c.y };
            }
            return c;
          }));
          toast.success("Aligned component.");
        } else if (type === 'area' && onAreasChange) {
          onAreasChange(areas.map(a => {
            if (a.id === elementId && !a.locked) {
              const dx = alignRef.x !== undefined ? alignRef.x - a.x : 0;
              const dy = alignRef.y !== undefined ? alignRef.y - a.y : 0;
              const nextArea = { ...a, x: a.x + dx, y: a.y + dy };
              if (a.points) {
                nextArea.points = a.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
              }
              return nextArea;
            }
            return a;
          }));
          toast.success("Aligned area.");
        } else if (type === 'line' && onLinesChange) {
          onLinesChange(lines.map(l => {
            if (l.id === elementId && !l.locked) {
              const dx = alignRef.x !== undefined ? alignRef.x - l.points[0].x : 0;
              const dy = alignRef.y !== undefined ? alignRef.y - l.points[0].y : 0;
              return { ...l, points: l.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
            }
            return l;
          }));
          toast.success("Aligned pipeline.");
        } else if (type === 'hose' && onHosesChange) {
          onHosesChange(hoses.map(h => {
            if (h.id === elementId && !h.locked) {
              const dx = alignRef.x !== undefined ? alignRef.x - h.points[0].x : 0;
              const dy = alignRef.y !== undefined ? alignRef.y - h.points[0].y : 0;
              return { ...h, points: h.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
            }
            return h;
          }));
          toast.success("Aligned hose.");
        } else if (type === 'text' && onDimensionsChange && dimensions) {
          onDimensionsChange(dimensions.map(d => {
            if (d.id === elementId && !d.locked) {
              const dx = alignRef.x !== undefined ? alignRef.x - (d.x || d.start.x) : 0;
              const dy = alignRef.y !== undefined ? alignRef.y - (d.y || d.start.y) : 0;
              return { ...d, x: (d.x || d.start.x) + dx, y: (d.y || d.start.y) + dy, start: { x: d.start.x + dx, y: d.start.y + dy }, end: { x: d.end.x + dx, y: d.end.y + dy } };
            }
            return d;
          }));
          toast.success("Aligned text.");
        }
      }
      return true;
    }

    if (activeTool === 'trim') {
      if (type !== 'line' && type !== 'hose') return false;
      if (!trimFirstId) {
        setTrimFirstId(elementId);
        toast.info("Select second line/hose to join corner.");
      } else {
        if (trimFirstId === elementId) return false;
        
        const line1 = lines.find(l => l.id === trimFirstId) || hoses.find(h => h.id === trimFirstId);
        const line2 = lines.find(l => l.id === elementId) || hoses.find(h => h.id === elementId);
        
        if (line1 && line2 && line1.points.length > 1 && line2.points.length > 1) {
          const p1 = line1.points[line1.points.length - 2];
          const p2 = line1.points[line1.points.length - 1];
          const q1 = line2.points[line2.points.length - 2];
          const q2 = line2.points[line2.points.length - 1];
          
          const intersect = findLineIntersection(p1, p2, q1, q2);
          if (intersect) {
            if (lines.some(l => l.id === trimFirstId)) {
              onLinesChange(lines.map(l => {
                if (l.id === trimFirstId) {
                  return { ...l, points: [...l.points.slice(0, -1), intersect] };
                }
                if (l.id === elementId) {
                  return { ...l, points: [...l.points.slice(0, -1), intersect] };
                }
                return l;
              }));
            } else {
              onHosesChange(hoses.map(h => {
                if (h.id === trimFirstId) {
                  return { ...h, points: [...h.points.slice(0, -1), intersect] };
                }
                if (h.id === elementId) {
                  return { ...h, points: [...h.points.slice(0, -1), intersect] };
                }
                return h;
              }));
            }
            toast.success("Lines trimmed to corner.");
          } else {
            toast.error("Lines do not intersect.");
          }
        }
        setTrimFirstId(null);
      }
      return true;
    }

    if (activeTool === 'split') {
      if (type !== 'line' && type !== 'hose') return false;
      if (!clickPt) return false;
      
      if (type === 'line') {
        const line = lines.find(l => l.id === elementId);
        if (line && line.points.length > 1) {
          let minD = Infinity;
          let segIdx = 0;
          for (let i = 0; i < line.points.length - 1; i++) {
            const p1 = line.points[i];
            const p2 = line.points[i + 1];
            const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
            let t = ((clickPt.x - p1.x) * (p2.x - p1.x) + (clickPt.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const dist = Math.sqrt((clickPt.x - (p1.x + t * (p2.x - p1.x)))**2 + (clickPt.y - (p1.y + t * (p2.y - p1.y)))**2);
            if (dist < minD) {
              minD = dist;
              segIdx = i;
            }
          }
          
          if (minD < 30) {
            const part1 = [...line.points.slice(0, segIdx + 1), clickPt];
            const part2 = [clickPt, ...line.points.slice(segIdx + 1)];
            const line1 = { ...line, points: part1 };
            const line2 = { ...line, id: crypto.randomUUID(), points: part2 };
            onLinesChange([...lines.filter(l => l.id !== elementId), line1, line2]);
            toast.success("Pipeline split.");
          }
        }
      } else if (type === 'hose') {
        const hose = hoses.find(h => h.id === elementId);
        if (hose && hose.points.length > 1) {
          let minD = Infinity;
          let segIdx = 0;
          for (let i = 0; i < hose.points.length - 1; i++) {
            const p1 = hose.points[i];
            const p2 = hose.points[i + 1];
            const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
            let t = ((clickPt.x - p1.x) * (p2.x - p1.x) + (clickPt.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const dist = Math.sqrt((clickPt.x - (p1.x + t * (p2.x - p1.x)))**2 + (clickPt.y - (p1.y + t * (p2.y - p1.y)))**2);
            if (dist < minD) {
              minD = dist;
              segIdx = i;
            }
          }
          
          if (minD < 30) {
            const part1 = [...hose.points.slice(0, segIdx + 1), clickPt];
            const part2 = [clickPt, ...hose.points.slice(segIdx + 1)];
            const hose1 = { ...hose, points: part1 };
            const hose2 = { ...hose, id: crypto.randomUUID(), points: part2 };
            onHosesChange([...hoses.filter(h => h.id !== elementId), hose1, hose2]);
            toast.success("Hose split.");
          }
        }
      }
      return true;
    }

    if (activeTool === 'mirror-pick') {
      if (type !== 'line' && type !== 'hose') return false;
      if (!selectedId) {
        toast.info("Please select an element to mirror first.");
        return false;
      }
      const axisLine = lines.find(l => l.id === elementId) || hoses.find(h => h.id === elementId);
      if (axisLine && axisLine.points.length > 1) {
        const a = axisLine.points[0];
        const b = axisLine.points[axisLine.points.length - 1];
        mirrorElementAcrossAxis(selectedId, a, b);
      }
      return true;
    }

    return false;
  }, [activeTool, offsetDistance, mirrorCopy, alignRef, trimFirstId, selectedId, lines, hoses, areas, placedComponents, dimensions, onLinesChange, onHosesChange, onAreasChange, onPlacedComponentsChange, onDimensionsChange, mirrorElementAcrossAxis]);

  const finishPolygon = useCallback((pts: Point[], kind: string) => {
    if (pts.length > 2 && onAreasChange) {
      const xs = pts.map(p => p.x);
      const ys = pts.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const newArea = {
        id: crypto.randomUUID(),
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        kind,
        levelId: activeLevelId,
        layerId: activeLayerId,
        points: pts
      };
      onAreasChange([...areas, newArea]);
    }
    setCurrentLine([]);
    setCursorPos(null);
  }, [areas, onAreasChange, activeLevelId, activeLayerId]);

  const finishLine = useCallback((pts: Point[]) => {
    if (pts.length > 1) {
      if (activeTool === 'hose' && onHosesChange) {
        onHosesChange([...hoses, { id: crypto.randomUUID(), points: pts, kind: 'suction', layerId: activeLayerId }]);
      } else if (activeTool === 'discharge' && onHosesChange) {
        onHosesChange([...hoses, { id: crypto.randomUUID(), points: pts, kind: 'discharge', layerId: activeLayerId }]);
      } else if (['area', 'site-area', 'discharge-area'].includes(activeTool)) {
        const kind = activeTool === 'area' ? 'excavation' : activeTool === 'discharge-area' ? 'discharge' : 'site';
        finishPolygon(pts, kind);
      } else {
        const newLine: LineData = { id: crypto.randomUUID(), points: pts, levelId: activeLevelId, layerId: activeLayerId };
        onLinesChange([...lines, newLine]);
      }
    }
    setCurrentLine([]);
    setCurrentHose([]);
    setCurrentDischarge([]);
    setCurrentAreaStart(null);
    setCurrentExportStart(null);
    setCursorPos(null);
    setDimTyped('');
  }, [lines, hoses, activeTool, onLinesChange, onHosesChange, activeLevelId, activeLayerId, finishPolygon]);

  const handleFinishText = useCallback((val: string, editingId?: string) => {
    // Check if it's a dimension
    if (editingId && dimensions?.some(d => d.id === editingId)) {
        if (!val.trim()) {
             // they cleared the text - maybe delete dimension? Or just clear text
             if (onDimensionsChange) {
                 onDimensionsChange(dimensions.filter(d => d.id !== editingId));
             }
        } else {
             if (onDimensionsChange) {
                 onDimensionsChange(dimensions.map(d => d.id === editingId ? { ...d, text: val } : d));
             }
        }
        setTextEditor(null);
        if (activeTool === 'text' && onToolSelect) onToolSelect('select');
        return;
    }

    if (!val.trim()) {
      if (editingId && onTextsChange) {
        onTextsChange(texts.filter(t => t.id !== editingId));
      }
      setTextEditor(null);
      if (activeTool === 'text' && onToolSelect) onToolSelect('select');
      return;
    }

    if (editingId && onTextsChange) {
      onTextsChange(texts.map(t => t.id === editingId ? { ...t, text: val } : t));
    } else if (onTextsChange && textEditor) {
      const newText: TextData = {
        id: crypto.randomUUID(),
        x: textEditor.x,
        y: textEditor.y,
        text: val,
        fontSize: textSize,
        color: textColor,
        layerId: activeLayerId,
        rotation: 0,
      };
      onTextsChange([...texts, newText]);
    }
    setTextEditor(null);
    if (activeTool === 'text' && onToolSelect) onToolSelect('select');
  }, [dimensions, onDimensionsChange, textEditor, activeLayerId, textSize, textColor, texts, onTextsChange, activeTool, onToolSelect]);

  // ---------- AutoCAD keyboard capture ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Shift') { setShiftHeld(true); e.preventDefault(); return; }
      if (e.key === 'Delete') {
        if (selectedIds.size > 0) {
          if (onPlacedComponentsChange) {
            onPlacedComponentsChange(placedComponents.filter(c => !selectedIds.has(c.id)));
          }
          if (onLinesChange) {
            onLinesChange(lines.filter(l => !selectedIds.has(l.id)));
          }
          if (onHosesChange) {
            onHosesChange(hoses.filter(h => !selectedIds.has(h.id)));
          }
          if (onAreasChange) {
            onAreasChange(areas.filter(a => !selectedIds.has(a.id)));
          }
          if (onDimensionsChange) {
            onDimensionsChange(dimensions.filter(d => !selectedIds.has(d.id)));
          }
          if (onArrowsChange && arrows) {
            onArrowsChange(arrows.filter(a => !selectedIds.has(a.id)));
          }
          selectSingleElement(null);
          if (trRef.current) trRef.current.nodes([]);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (dragInfoRef.current) {
          cancelCurrentDrag();
          return;
        }
        if (currentAreaStart) {
          setCurrentAreaStart(null);
          e.cancelBubble = true;
          return;
        }
        if (currentExportStart) {
          setCurrentExportStart(null);
          e.cancelBubble = true;
          return;
        }
        const activeList = activeTool === 'line' ? currentLine : activeTool === 'hose' ? currentHose : currentDischarge;
        const setActiveList = activeTool === 'line' ? setCurrentLine : activeTool === 'hose' ? setCurrentHose : setCurrentDischarge;
        if (activeList.length > 0) { finishLine(activeList); }
        setDimTyped('');
        setCursorPos(null);
        if (onToolSelect) {
          onToolSelect('select');
        }
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
  }, [isDrawing, dimTyped, cursorPos, currentLine, shiftHeld, orthoLocked, finishLine, getSnappedPoint, activeTool, currentHose, currentDischarge, currentAreaStart, currentExportStart, selectedIds, placedComponents, lines, hoses, areas, dimensions, onPlacedComponentsChange, onLinesChange, onHosesChange, onAreasChange, onDimensionsChange, onToolSelect]);

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

    // Right-click finishes drawing, cancels drag, or clears selection in select mode
    if (e.evt.button === 2) {
      if (activeTool === 'select') {
        if (isStage) {
          setSelectedId(null);
          setSelectedIds(new Set());
          if (trRef.current) trRef.current.nodes([]);
        }
        return;
      }
      if (dragInfoRef.current) {
        cancelCurrentDrag();
        return;
      }
      if (activeTool === 'line' && currentLine.length > 0) finishLine(currentLine);
      if (activeTool === 'hose' && currentHose.length > 0) finishLine(currentHose);
      if (activeTool === 'discharge' && currentDischarge.length > 0) finishLine(currentDischarge);
      if (currentAreaStart) setCurrentAreaStart(null);
      if (currentExportStart) setCurrentExportStart(null);
      return;
    }

    if (e.evt && e.evt.button !== undefined && e.evt.button !== 0) return;

    if (scaleRefMode && scaleRefMode !== 'idle') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      if (scaleRefMode === 'selecting-start' && onSetScaleRefPt1) {
        onSetScaleRefPt1(raw);
      } else if (scaleRefMode === 'selecting-end' && onSetScaleRefPt2) {
        onSetScaleRefPt2(raw);
      }
      return;
    }

    if (activeTool === 'select') {
      // Click on empty stage → deselect
      if (isStage) {
        setSelectedId(null);
        setSelectedIds(new Set());
        if (trRef.current) trRef.current.nodes([]);
      }
      return;
    }

    if (activeTool === 'text') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      const pt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      setTextEditor({ x: pt.x, y: pt.y, val: '' });
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
        levelId: activeLevelId,
        layerId: activeLayerId
      };
      onPlacedComponentsChange([...placedComponents, newComp]);
      return;
    }

    if (activeTool === 'export-window') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      setCurrentExportStart(raw);
      return;
    }

    if (activeTool === 'area' || activeTool === 'discharge-area' || activeTool === 'site-area') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      const pt = currentSnap ? currentSnap.pt : getSnappedPoint(gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw);
      const kind = activeTool === 'area' ? 'excavation' : activeTool === 'discharge-area' ? 'discharge' : 'site';

      if (drawShapeMode === 'poly') {
        if (currentLine.length > 2 && (currentSnap?.elementId === 'poly-start' || Math.sqrt((pt.x - currentLine[0].x)**2 + (pt.y - currentLine[0].y)**2) < 15)) {
          finishPolygon(currentLine, kind);
        } else {
          setCurrentLine(prev => [...prev, pt]);
        }
      } else {
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
            levelId: activeLevelId,
            layerId: activeLayerId
          };
          if (onAreasChange) onAreasChange([...areas, newArea]);
          setCurrentAreaStart(null);
        }
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
      } else if (currentDim.length === 1) {
        setCurrentDim([currentDim[0], pt]);
      } else if (currentDim.length === 2) {
        // 3rd click: calculate final points based on offset
        const pt1 = currentDim[0];
        const pt2 = currentDim[1];
        
        const dx = pt2.x - pt1.x;
        const dy = pt2.y - pt1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        let startPoint = pt1;
        let endPoint = pt2;
        
        if (length > 0) {
          const nx = -dy / length;
          const ny = dx / length;
          const offset = (pt.x - pt1.x) * nx + (pt.y - pt1.y) * ny;
          
          startPoint = { x: pt1.x + nx * offset, y: pt1.y + ny * offset };
          endPoint = { x: pt2.x + nx * offset, y: pt2.y + ny * offset };
        }

        const distM = (length / PIXELS_PER_METER).toFixed(2);
        
        const newDim: DimensionData = {
          id: crypto.randomUUID(),
          start: startPoint,
          end: endPoint,
          measuredStart: pt1,
          measuredEnd: pt2,
          text: `${distM}m`,
          layerId: activeLayerId
        };
        if (onDimensionsChange && dimensions) {
          onDimensionsChange([...dimensions, newDim]);
        }
        setCurrentDim([]);
      }
      return;
    }

    if (activeTool === 'arrow') {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (!raw) return;
      
      const snappedRaw = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      const pt = getSnappedPoint(snappedRaw);

      if (currentArrow.length === 0) {
        setCurrentArrow([pt]);
      } else {
        const start = currentArrow[0];
        const newArrow: ArrowData = {
          id: crypto.randomUUID(),
          start,
          end: pt,
          layerId: activeLayerId
        };
        if (onArrowsChange && arrows) {
          onArrowsChange([...arrows, newArrow]);
        }
        setCurrentArrow([]);
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
        pt = getSnappedPoint(snappedRaw);
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
      const gridPt = gridSnap ? snapToGrid(raw, PIXELS_PER_METER / 2) : raw;
      setCursorPos(gridPt);
      if (onCursorPosChange) onCursorPosChange(gridPt);

      // Update snap indicator during drawing
      if (isDrawing && osnapEnabled) {
        const snapLines = [
          ...lines.filter(isItemVisible),
          ...hoses.filter(isItemVisible)
        ];
        areas.filter(isItemVisible).forEach((a: any) => {
          snapLines.push({
            id: a.id,
            points: [
              { x: a.x, y: a.y }, { x: a.x + a.width, y: a.y },
              { x: a.x + a.width, y: a.y + a.height }, { x: a.x, y: a.y + a.height },
              { x: a.x, y: a.y }
            ]
          });
        });
        const normalSnap = findSnapPoint(gridPt, snapLines);
        
        if (['area', 'site-area', 'discharge-area'].includes(activeTool) && drawShapeMode === 'poly' && currentLine.length > 0) {
          const dStart = Math.sqrt((gridPt.x - currentLine[0].x)**2 + (gridPt.y - currentLine[0].y)**2);
          if (dStart < 15) {
            setCurrentSnap({
              pt: currentLine[0],
              type: 'endpoint',
              elementId: 'poly-start',
              dist: dStart
            });
          } else {
            setCurrentSnap(normalSnap);
          }
        } else {
          setCurrentSnap(normalSnap);
        }
      } else {
        setCurrentSnap(null);
      }
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (e.evt.button === 1) {
      setIsPanning(false);
      lastPanPosRef.current = null;
    }
    
    if (activeTool === 'export-window' && currentExportStart) {
      const stage = e.target.getStage();
      const raw = getWorldPointerPos(stage);
      if (raw) {
        const rect = {
          x: Math.min(currentExportStart.x, raw.x),
          y: Math.min(currentExportStart.y, raw.y),
          width: Math.abs(raw.x - currentExportStart.x),
          height: Math.abs(raw.y - currentExportStart.y)
        };
        // Only trigger if actually dragged
        if (rect.width > 5 && rect.height > 5 && onExportWindowSelected) {
          onExportWindowSelected(rect);
        }
      }
      setCurrentExportStart(null);
    }
  };
  const handleBlueprintDragEnd = (e: any) => {
    const node = e.target;
    if (onUpdateBlueprintSettings) {
      onUpdateBlueprintSettings({
        x: node.x(),
        y: node.y()
      });
    }
  };

  const handleBlueprintTransformEnd = (e: any) => {
    const node = e.target;
    if (onUpdateBlueprintSettings) {
      onUpdateBlueprintSettings({
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation()
      });
    }
  };
  const handleAreaClick = (e: any, id: string) => {
    const area = areas.find((a: any) => a.id === id);
    if (!area) return;

    if (activeTool === 'select' && e.evt && e.evt.button === 2) {
      toggleSelectElement(id, e);
      return;
    }

    const stage = e.target.getStage();
    const clickPt = getWorldPointerPos(stage) || undefined;
    const didExecute = executeModifyCommand('area', id, clickPt);
    if (didExecute) {
      e.cancelBubble = true;
      return;
    }

    if (area.locked && activeTool !== 'select') return;

    if (['select', 'move', 'rotate'].includes(activeTool)) {
      selectSingleElement(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'copy') {
      if (onAreasChange) {
        const newArea = { ...area, id: crypto.randomUUID(), x: area.x + 40, y: area.y + 40 };
        if (area.points) {
          newArea.points = area.points.map(p => ({ x: p.x + 40, y: p.y + 40 }));
        }
        onAreasChange([...areas, newArea]);
      }
      e.cancelBubble = true;
    }
    if (activeTool === 'delete') {
      if (onAreasChange) onAreasChange(areas.filter(a => a.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension') {
      const wM = (area.width / PIXELS_PER_METER).toFixed(1);
      const hM = (area.height / PIXELS_PER_METER).toFixed(1);
      const newDimW: DimensionData = {
        id: Date.now().toString() + 'w',
        start: { x: area.x, y: area.y },
        end: { x: area.x + area.width, y: area.y },
        text: `${wM}m`,
        layerId: activeLayerId
      };
      const newDimH: DimensionData = {
        id: Date.now().toString() + 'h',
        start: { x: area.x, y: area.y },
        end: { x: area.x, y: area.y + area.height },
        text: `${hM}m`,
        layerId: activeLayerId
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
    if (!line) return;

    if (activeTool === 'select' && e.evt && e.evt.button === 2) {
      toggleSelectElement(id, e);
      return;
    }

    const stage = e.target.getStage();
    const clickPt = getWorldPointerPos(stage) || undefined;
    const didExecute = executeModifyCommand('line', id, clickPt);
    if (didExecute) {
      e.cancelBubble = true;
      return;
    }

    if (line.locked && activeTool !== 'select') return;

    if (['select', 'move', 'rotate'].includes(activeTool)) {
      selectSingleElement(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'copy') {
      onLinesChange([...lines, { ...line, id: crypto.randomUUID(), points: line.points.map(p => ({ x: p.x + 40, y: p.y + 40 })) }]);
      e.cancelBubble = true;
    }
    if (activeTool === 'delete') {
      onLinesChange(lines.filter(l => l.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension' && line.points.length > 1) {
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
    if (!hose) return;

    if (activeTool === 'select' && e.evt && e.evt.button === 2) {
      toggleSelectElement(id, e);
      return;
    }

    const stage = e.target.getStage();
    const clickPt = getWorldPointerPos(stage) || undefined;
    const didExecute = executeModifyCommand('hose', id, clickPt);
    if (didExecute) {
      e.cancelBubble = true;
      return;
    }

    if (hose.locked && activeTool !== 'select') return;

    if (['select', 'move', 'rotate'].includes(activeTool)) {
      selectSingleElement(id);
      e.cancelBubble = true;
    }
    if (activeTool === 'copy' && onHosesChange) {
      onHosesChange([...hoses, { ...hose, id: crypto.randomUUID(), points: hose.points.map((p: any) => ({ x: p.x + 40, y: p.y + 40 })) }]);
      e.cancelBubble = true;
    }
    if (activeTool === 'delete' && onHosesChange) {
      onHosesChange(hoses.filter(h => h.id !== id));
      e.cancelBubble = true;
    }
    if (activeTool === 'dimension' && hose.points.length > 1) {
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
    const rawX = e.target.x();
    const rawY = e.target.y();
    const snapped = getSnappedPoint({ x: rawX, y: rawY });
    if (onHosesChange) {
      onHosesChange(hoses.map(h =>
        h.id !== hoseId ? h : {
          ...h,
          points: h.points.map((p, i) => i === ptIndex ? snapped : p),
        }
      ));
    }
  };

  const handleHoseVertexDragEnd = (hoseId: string, ptIndex: number, e: any) => {
    const rawX = e.target.x();
    const rawY = e.target.y();
    const snapped = getSnappedPoint({ x: rawX, y: rawY });
    if (onHosesChange) {
      onHosesChange(hoses.map(h =>
        h.id !== hoseId ? h : {
          ...h,
          points: h.points.map((p, i) => i === ptIndex ? snapped : p),
        }
      ));
    }
  };

  // ---------- component click / drag ----------
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

  // --- Auto fittings logic ---
  const autoFittings = useMemo(() => {
    const fittings: { type: 'elbow' | 'tee'; x: number; y: number; rotation: number }[] = [];
    const threshold = 12; // Snap distance in pixels (~8-12px)

    // Helper: point distance
    const ptDist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // Helper: is point on line segment
    const distToSegment = (p: Point, a: Point, b: Point) => {
      const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (l2 === 0) return { dist: ptDist(p, a), proj: { x: a.x, y: a.y } };
      let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      return { dist: ptDist(p, proj), proj };
    };

    // 1. Elbow detection: Two header pipe endpoints meet
    const headerEndpoints: { pt: Point; parentId: string }[] = [];
    lines.forEach(l => {
      if (l.points.length > 1) {
        headerEndpoints.push({ pt: l.points[0], parentId: l.id });
        headerEndpoints.push({ pt: l.points[l.points.length - 1], parentId: l.id });
      }
    });

    // Check header endpoint-to-endpoint meetings (Elbow)
    for (let i = 0; i < headerEndpoints.length; i++) {
      for (let j = i + 1; j < headerEndpoints.length; j++) {
        if (headerEndpoints[i].parentId !== headerEndpoints[j].parentId) {
          if (ptDist(headerEndpoints[i].pt, headerEndpoints[j].pt) < threshold) {
            fittings.push({
              type: 'elbow',
              x: (headerEndpoints[i].pt.x + headerEndpoints[j].pt.x) / 2,
              y: (headerEndpoints[i].pt.y + headerEndpoints[j].pt.y) / 2,
              rotation: 0
            });
          }
        }
      }
    }

    // 2. Tee detection: Header segment endpoint meets another header segment mid-body
    lines.forEach(l => {
      for (let i = 0; i < l.points.length - 1; i++) {
        const a = l.points[i];
        const b = l.points[i + 1];

        // Check if any other header pipe's endpoint meets this segment mid-body (Tee)
        headerEndpoints.forEach(hept => {
          if (hept.parentId !== l.id) {
            if (ptDist(hept.pt, a) > threshold && ptDist(hept.pt, b) > threshold) {
              const { dist, proj } = distToSegment(hept.pt, a, b);
              if (dist < threshold) {
                fittings.push({
                  type: 'tee',
                  x: proj.x,
                  y: proj.y,
                  rotation: Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
                });
              }
            }
          }
        });
      }
    });

    // 3. Internal corner elbows (within any multi-point line)
    lines.forEach(l => {
      if (l.points.length > 2) {
        for (let i = 1; i < l.points.length - 1; i++) {
          const prev = l.points[i - 1];
          const curr = l.points[i];
          const next = l.points[i + 1];
          
          const dx1 = curr.x - prev.x;
          const dy1 = curr.y - prev.y;
          const dx2 = next.x - curr.x;
          const dy2 = next.y - curr.y;
          const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
          const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
          
          let rot = 0;
          if (len1 > 0 && len2 > 0) {
            const a1 = Math.atan2(dy1, dx1);
            const a2 = Math.atan2(dy2, dx2);
            let diff = a2 - a1;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            rot = (a1 + diff / 2) * (180 / Math.PI);
          }
          
          fittings.push({
            type: 'elbow',
            x: curr.x,
            y: curr.y,
            rotation: rot
          });
        }
      }
    });

    // Deduplicate fittings that land at the exact same pixel coord
    const uniqueFittings: typeof fittings = [];
    fittings.forEach(fit => {
      const isDup = uniqueFittings.some(uf => ptDist(uf, fit) < 5);
      if (!isDup) uniqueFittings.push(fit);
    });

    return uniqueFittings;
  }, [lines]);

  // ---------- component renderer ----------
  const renderComponent = (comp: PlacedComponent) => {
    const isSelected = ['select', 'move', 'rotate'].includes(activeTool) && (selectedId === comp.id || selectedIds.has(comp.id));
    const isLocked = (comp as any).locked;
    const isDraggable = ['select', 'move', 'rotate'].includes(activeTool) && !isLocked;
    const del = activeTool === 'delete';

    const handleCompClick = (e: any) => {
      const stage = e.target.getStage();
      const clickPt = getWorldPointerPos(stage) || { x: comp.x, y: comp.y };
      
      const didExecute = executeModifyCommand('component', comp.id, clickPt);
      if (didExecute) {
        e.cancelBubble = true;
        return;
      }
      
      if (['select', 'move'].includes(activeTool)) { selectSingleElement(comp.id); e.cancelBubble = true; }
      if (activeTool === 'rotate' && !isLocked) {
        const delta = e.evt?.button === 2 ? 180 : 90;
        const newRot = ((comp.rotation || 0) + delta) % 360;
        onPlacedComponentsChange(placedComponents.map(c => c.id === comp.id ? { ...c, rotation: newRot } : c));
        e.cancelBubble = true;
        return;
      }
      if (activeTool === 'copy') {
        onPlacedComponentsChange([...placedComponents, { ...comp, id: crypto.randomUUID(), x: comp.x + 40, y: comp.y + 40 }]);
        e.cancelBubble = true;
      }
      if (activeTool === 'delete') { onPlacedComponentsChange(placedComponents.filter(c => c.id !== comp.id)); e.cancelBubble = true; }
    };

    const base = {
      onClick: handleCompClick,
      onTap: handleCompClick,
      onContextMenu: (e: any) => {
        if (activeTool === 'select') {
          toggleSelectElement(comp.id, e);
        }
      },
      draggable: isDraggable,
      onDragEnd: (e: any) => handleCompDragEnd(comp.id, e),
      strokeWidth: isSelected ? 3 : 2,
    };

    switch (comp.type) {
      case 'pump': return (
        <Group key={comp.id} {...base}>
          {isLocked && <Text x={comp.x - 5} y={comp.y - 30} text="📌" fontSize={14} listening={false} />}
          {/* Pump body shadow */}
          <Rect x={comp.x - 22} y={comp.y - 17} width={44} height={34} fill="rgba(0,0,0,0.1)" cornerRadius={3} listening={false} />
          {/* Main pump block */}
          <Rect x={comp.x - 20} y={comp.y - 15} width={40} height={30} fill={del ? '#fca5a5' : '#0ea5e9'} stroke={isSelected ? '#fbbf24' : '#0284c7'} strokeWidth={2} cornerRadius={2} />
          <Rect x={comp.x - 10} y={comp.y - 8} width={20} height={16} fill="#bae6fd" />
          
          {/* Suction port indicator at the left face edge */}
          <Circle x={comp.x - 20} y={comp.y} radius={5} fill="#fbbf24" stroke="#78350f" strokeWidth={1} />
          <Circle x={comp.x - 20} y={comp.y} radius={2} fill="#fff" />
          <Text x={comp.x - 55} y={comp.y - 4} text="Suction" fill="#78350f" fontSize={7} fontStyle="bold" listening={false} />

          {/* Discharge port indicator at the right face edge */}
          <Circle x={comp.x + 20} y={comp.y} radius={5} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
          <Circle x={comp.x + 20} y={comp.y} radius={2} fill="#fff" />
          <Text x={comp.x + 25} y={comp.y - 4} text="Discharge" fill="#1d4ed8" fontSize={7} fontStyle="bold" listening={false} />

          {/* Labels */}
          <Text x={comp.x - 35} y={comp.y - 28} text="Dewatering Pump" fill="#0284c7" fontSize={9} fontStyle="bold" listening={false} />
          <Text x={comp.x - 35} y={comp.y + 19} text="Cap: 150 m³/h" fill="#64748b" fontSize={8} fontStyle="bold" listening={false} />
        </Group>
      );
      case 'tee': {
        const showPorts = ['hose', 'discharge', 'line'].includes(activeTool);
        return (
          <Group 
            key={comp.id} 
            x={comp.x} 
            y={comp.y} 
            rotation={comp.rotation || 0}
            {...base}
          >
            {isLocked && <Text x={-5} y={-30} text="📌" fontSize={14} rotation={-(comp.rotation || 0)} listening={false} />}
            {/* Main horizontal flow path */}
            <Rect x={-15} y={-4} width={30} height={8} fill={del ? '#a7f3d0' : '#d1fae5'} stroke={isSelected ? '#fbbf24' : '#065f46'} strokeWidth={1.5} cornerRadius={1} />
            {/* Branch perpendicular path */}
            <Rect x={-4} y={0} width={8} height={15} fill={del ? '#a7f3d0' : '#d1fae5'} stroke={isSelected ? '#fbbf24' : '#065f46'} strokeWidth={1.5} cornerRadius={1} />
            
            {/* Three flanged inlets (Left, Right, Bottom) */}
            <Line points={[-15, -6, -15, 6]} stroke="#065f46" strokeWidth={2.5} />
            <Line points={[15, -6, 15, 6]} stroke="#065f46" strokeWidth={2.5} />
            <Line points={[-6, 15, 6, 15]} stroke="#065f46" strokeWidth={2.5} />
            
            {/* Center visual label */}
            <Circle x={0} y={2} radius={3.5} fill="#10b981" />
            <Text x={-2.5} y={-1} text="T" fill="white" fontSize={6} fontStyle="bold" listening={false} />

            {/* Port snap indicators — shown when connection tool is active */}
            {showPorts && (
              <>
                {/* Left port */}
                <Circle x={-15} y={0} radius={5} fill="rgba(6,182,212,0.25)" stroke="#06b6d4" strokeWidth={1.5} listening={false} />
                <Circle x={-15} y={0} radius={2} fill="#06b6d4" listening={false} />
                {/* Right port */}
                <Circle x={15} y={0} radius={5} fill="rgba(6,182,212,0.25)" stroke="#06b6d4" strokeWidth={1.5} listening={false} />
                <Circle x={15} y={0} radius={2} fill="#06b6d4" listening={false} />
                {/* Branch (mouth) port */}
                <Circle x={0} y={15} radius={6} fill="rgba(250,204,21,0.3)" stroke="#facc15" strokeWidth={2} listening={false} />
                <Circle x={0} y={15} radius={2.5} fill="#facc15" listening={false} />
              </>
            )}

            {/* Flip hint when selected */}
            {isSelected && <Text x={-22} y={-20} text="↺ rotate" fill="#f59e0b" fontSize={7} fontStyle="bold" listening={false} />}
          </Group>
        );
      }
      case 'elbow': {
        const showPorts = ['hose', 'discharge', 'line'].includes(activeTool);
        return (
          <Group 
            key={comp.id} 
            x={comp.x} 
            y={comp.y} 
            rotation={comp.rotation || 0}
            {...base}
          >
            {isLocked && <Text x={-5} y={-30} text="📌" fontSize={14} rotation={-(comp.rotation || 0)} listening={false} />}
            {/* L-shaped 90-degree curved body */}
            {/* Horizontal side */}
            <Rect x={-12} y={-4} width={12} height={8} fill={del ? '#fcd34d' : '#fef3c7'} stroke={isSelected ? '#fbbf24' : '#78350f'} strokeWidth={1.5} cornerRadius={1} />
            {/* Vertical side */}
            <Rect x={-4} y={0} width={8} height={12} fill={del ? '#fcd34d' : '#fef3c7'} stroke={isSelected ? '#fbbf24' : '#78350f'} strokeWidth={1.5} cornerRadius={1} />
            
            {/* Flange 1 (Left end) */}
            <Line points={[-12, -6, -12, 6]} stroke="#78350f" strokeWidth={2.5} />
            {/* Flange 2 (Bottom end) */}
            <Line points={[-6, 12, 6, 12]} stroke="#78350f" strokeWidth={2.5} />
            
            {/* Visual label */}
            <Circle x={-2} y={2} radius={3.5} fill="#f59e0b" />
            <Text x={-4} y={-1} text="E" fill="white" fontSize={6} fontStyle="bold" listening={false} />

            {/* Port snap indicators */}
            {showPorts && (
              <>
                {/* Left port */}
                <Circle x={-12} y={0} radius={5} fill="rgba(6,182,212,0.25)" stroke="#06b6d4" strokeWidth={1.5} listening={false} />
                <Circle x={-12} y={0} radius={2} fill="#06b6d4" listening={false} />
                {/* Bottom port */}
                <Circle x={0} y={12} radius={5} fill="rgba(6,182,212,0.25)" stroke="#06b6d4" strokeWidth={1.5} listening={false} />
                <Circle x={0} y={12} radius={2} fill="#06b6d4" listening={false} />
              </>
            )}

            {isSelected && <Text x={-18} y={-20} text="↺ rotate" fill="#f59e0b" fontSize={7} fontStyle="bold" listening={false} />}
          </Group>
        );
      }
      default: return null;
    }
  };

  const getModifyGuidance = () => {
    switch (activeTool) {
      case 'align':
        return alignRef 
          ? "Click element to align to reference axis"
          : "Click reference line or snap point to set alignment axis";
      case 'offset':
        return `Click line or area to offset by ${offsetDistance}m`;
      case 'mirror-pick':
        return selectedId
          ? "Click an existing line/hose to mirror selected element"
          : "Please SELECT an element first, then click a mirror axis line";
      case 'mirror-draw':
        return selectedId
          ? "Click 2 points on the canvas to draw mirror axis"
          : "Please SELECT an element first, then draw mirror axis";
      case 'split':
        return "Click a pipeline or hose to split it";
      case 'trim':
        return trimFirstId
          ? "Click second pipeline or hose to trim corner"
          : "Click first pipeline or hose to trim corner";
      case 'pin':
        return "Click elements to lock (pin) their position";
      case 'unpin':
        return "Click elements to unlock (unpin) their position";
      case 'delete':
        return "Click elements to delete (erase) them";
      case 'text':
        return "Click on canvas to add floating text annotation";
      default:
        return null;
    }
  };

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'align') return 'cell';
    if (activeTool === 'offset') return 'copy';
    if (['mirror-pick', 'mirror-draw'].includes(activeTool)) return 'alias';
    if (activeTool === 'pin') return 'alias';
    if (activeTool === 'unpin') return 'pointer';
    if (activeTool === 'delete') return 'not-allowed';
    if (activeTool === 'text') return 'text';
    if (['line', 'hose', 'discharge', 'dimension', 'area', 'discharge-area', 'site-area'].includes(activeTool)) return 'crosshair';
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
        cadLayers={layers}
        activeCadLayerId={activeLayerId}
        onSelectCadLayer={onSelectCadLayer}
        onUpdateCadLayer={onUpdateLayer}
        onAddCadLayer={onAddLayer}
        onDeleteCadLayer={onDeleteLayer}
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
          onMouseLeave={() => { setIsPanning(false); lastPanPosRef.current = null; if (onCursorPosChange) onCursorPosChange(null); }}
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
            
            // Calculate visible bounds in local coordinates
            const startX = -position.x / scale;
            const startY = -position.y / scale;
            const endX = (canvasSize.width - position.x) / scale;
            const endY = (canvasSize.height - position.y) / scale;

            // Snap start coordinates to the nearest grid step
            const firstGridX = Math.floor(startX / step) * step;
            const firstGridY = Math.floor(startY / step) * step;

            for (let x = firstGridX; x <= endX; x += step) {
              gridLines.push(<Line key={`gv-${Math.round(x)}`} points={[Math.round(x), startY, Math.round(x), endY]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} listening={false} />);
            }
            for (let y = firstGridY; y <= endY; y += step) {
              gridLines.push(<Line key={`gh-${Math.round(y)}`} points={[startX, Math.round(y), endX, Math.round(y)]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} listening={false} />);
            }
            return gridLines;
          })()}

          {bgImage && blueprintSettings.visible && (
            <KonvaImage
              id="blueprint-underlay"
              image={bgImage}
              x={blueprintSettings.x}
              y={blueprintSettings.y}
              scaleX={blueprintSettings.scaleX}
              scaleY={blueprintSettings.scaleY}
              rotation={blueprintSettings.rotation}
              opacity={blueprintSettings.opacity}
              draggable={activeTool === 'modify-blueprint' && !blueprintSettings.locked}
              onDragEnd={handleBlueprintDragEnd}
              onTransformEnd={handleBlueprintTransformEnd}
            />
          )}

          {/* Excavation, Discharge & Site Areas */}
          {areas.filter(isItemVisible).map((area: any) => {
            const isDischarge = area.kind === 'discharge';
            const isSite = area.kind === 'site';
            const isSelected = ['select', 'move', 'rotate'].includes(activeTool) && (selectedId === area.id || selectedIds.has(area.id));
            
            const fillCol = isSite ? '#86efac' : isDischarge ? '#fed7aa' : '#fca5a5';
            const strokeCol = isSite ? '#22c55e' : isDischarge ? '#f97316' : '#ef4444';
            const labelStr = isSite ? 'SITE BOUNDARY' : isDischarge ? 'DISCHARGE AREA' : 'EXCAVATION';
            
            const wMeters = (area.width / PIXELS_PER_METER).toFixed(1);
            const hMeters = (area.height / PIXELS_PER_METER).toFixed(1);

            return (
              <Group key={area.id}>
                {area.points ? (
                  // Custom Polygon Shape
                  <Line
                    id={`area-${area.id}`}
                    points={area.points.flatMap((p: any) => [p.x, p.y])}
                    closed={true}
                    fill={fillCol}
                    opacity={area.locked ? 0.1 : 0.2}
                    stroke={strokeCol}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    dash={isSite ? undefined : [10, 5]}
                    draggable={activeTool === 'select' && !area.locked}
                    onDragStart={(e) => !area.locked && handleAreaDragStart(e, area.id)}
                    onDragEnd={(e) => {
                      if (dragInfoRef.current?.cancelled) {
                        dragInfoRef.current = null;
                        return;
                      }
                      dragInfoRef.current = null;
                      if (onAreasChange) {
                        const dx = e.target.x();
                        const dy = e.target.y();
                        onAreasChange(areas.map(a => 
                          a.id === area.id ? {
                            ...a,
                            x: a.x + dx,
                            y: a.y + dy,
                            points: a.points ? a.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy })) : undefined
                          } : a
                        ));
                      }
                      e.target.position({ x: 0, y: 0 });
                    }}
                    onClick={(e) => handleAreaClick(e, area.id)}
                    onTap={(e) => handleAreaClick(e, area.id)}
                    onContextMenu={(e) => {
                      if (activeTool === 'select') {
                        toggleSelectElement(area.id, e);
                      }
                    }}
                    onMouseEnter={(e) => { 
                      if (area.locked) return;
                      if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                      if (activeTool === 'select') document.body.style.cursor = 'move';
                    }}
                    onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                  />
                ) : (
                  // Bounding Box Rectangle
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
                    onClick={(e) => handleAreaClick(e, area.id)}
                    onTap={(e) => handleAreaClick(e, area.id)}
                    onContextMenu={(e) => {
                      if (activeTool === 'select') {
                        toggleSelectElement(area.id, e);
                      }
                    }}
                    onMouseEnter={(e) => { 
                      if (area.locked) return;
                      if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                      if (activeTool === 'select') document.body.style.cursor = 'move';
                    }}
                    onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                  />
                )}
                
                {/* Overlay Text */}
                <Text
                  x={area.points ? area.points[0].x + 5 : area.x + 5}
                  y={area.points ? area.points[0].y + 5 : area.y + 5}
                  text={area.locked ? `🔒 ${labelStr}` : labelStr}
                  fill={strokeCol}
                  opacity={0.8} fontSize={12} fontStyle="bold" listening={false}
                />
                
                {/* Render Pin icon if locked */}
                {area.locked && (
                  <Text
                    x={area.points ? area.points[0].x + 10 : area.x + area.width / 2}
                    y={area.points ? area.points[0].y - 20 : area.y + area.height / 2 - 10}
                    text="📌"
                    fontSize={16}
                    listening={false}
                  />
                )}

                {/* Dimension Labels (only for rectangles since it's defined by width/height) */}
                {!area.points && (
                  <>
                    <Text x={area.x + area.width / 2} y={area.y - 15} text={`${wMeters}m`} fill="#475569" fontSize={12} fontStyle="bold" align="center" width={area.width} offsetX={area.width / 2} listening={false} />
                    <Text x={area.x - 35} y={area.y + area.height / 2} text={`${hMeters}m`} fill="#475569" fontSize={12} fontStyle="bold" align="center" width={70} offsetX={35} offsetY={6} rotation={-90} listening={false} />
                  </>
                )}

                {/* Draggable Corner Vertices for Custom Polygon in Select Mode */}
                {isSelected && area.points && area.points.map((pt: any, idx: number) => (
                  <Circle
                    key={`${area.id}-vertex-${idx}`}
                    x={pt.x}
                    y={pt.y}
                    radius={6}
                    fill="#ffffff"
                    stroke={strokeCol}
                    strokeWidth={2}
                    draggable={!area.locked}
                    onDragMove={(e) => {
                      const node = e.target;
                      const newPt = { x: node.x(), y: node.y() };
                      const updatedPts = area.points.map((p: any, i: number) => i === idx ? newPt : p);
                      if (onAreasChange) {
                        onAreasChange(areas.map(a => a.id === area.id ? { ...a, points: updatedPts } : a));
                      }
                    }}
                  />
                ))}
              </Group>
            );
          })}

          {/* Finished lines (sorted by zIndex, rendered after areas so they appear on top) */}
          {[...lines].filter(isItemVisible).sort((a: any, b: any) => (a.zIndex ?? 100) - (b.zIndex ?? 100)).map((line) => {
            const isSelected = activeTool === 'select' && (selectedId === line.id || selectedIds.has(line.id));
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
                  onContextMenu={(e) => {
                    if (activeTool === 'select') {
                      toggleSelectElement(line.id, e);
                    }
                  }}
                  draggable={isSelected && !line.locked}
                  onDragStart={(e) => handleLineDragStart(line.id, e)}
                  onDragEnd={(e) => handleLineDragEnd(line.id, e)}
                />
                {/* Segmented 2D Header Pipe Pieces (6-meter standard rigid segments + remainder) */}
                {(() => {
                  const pipeSegments: React.ReactNode[] = [];
                  const headerLengthPx = 6 * PIXELS_PER_METER;
                  
                  for (let i = 0; i < line.points.length - 1; i++) {
                    const p1 = line.points[i];
                    const p2 = line.points[i + 1];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) continue;
                    
                    const dirX = dx / dist;
                    const dirY = dy / dist;
                    
                    // Offset pipe ends at corners so they connect cleanly to the outer edge of elbow fittings
                    const { T_start, T_end } = getTangentLengthsForSegment(lines, line, i);
                    const adjustedDist = dist - T_start - T_end;
                    if (adjustedDist <= 0.1) continue; // too short to fit pipes
                    
                    const numPipes = Math.floor((adjustedDist / PIXELS_PER_METER) / 6);
                    
                    for (let k = 0; k < numPipes; k++) {
                      const startPx = T_start + k * headerLengthPx;
                      const endPx = T_start + (k + 1) * headerLengthPx;
                      const sx = p1.x + dirX * startPx;
                      const sy = p1.y + dirY * startPx;
                      const ex = p1.x + dirX * endPx;
                      const ey = p1.y + dirY * endPx;
                      
                      pipeSegments.push(
                        <Group key={`pipe-${line.id}-${i}-${k}`} listening={false}>
                          {/* Outer pipe border */}
                          <Line
                            points={[sx, sy, ex, ey]}
                            stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#0369a1'}
                            strokeWidth={isSelected ? 10 : 8}
                            lineCap="square"
                          />
                          {/* Inner pipe body (galvanized steel blue look) */}
                          <Line
                            points={[sx, sy, ex, ey]}
                            stroke={activeTool === 'delete' ? '#fca5a5' : '#22d3ee'}
                            strokeWidth={4}
                            lineCap="square"
                          />
                          {/* Left joint flange */}
                          <Line
                            points={[sx - dirY * 4, sy + dirX * 4, sx + dirY * 4, sy - dirX * 4]}
                            stroke="#0369a1"
                            strokeWidth={2.5}
                          />
                          {/* Right joint flange */}
                          <Line
                            points={[ex - dirY * 4, ey + dirX * 4, ex + dirY * 4, ey - dirX * 4]}
                            stroke="#0369a1"
                            strokeWidth={2.5}
                          />
                        </Group>
                      );
                    }

                    // Render remainder pipe segment to connect corners perfectly
                    const remainderPx = adjustedDist - numPipes * headerLengthPx;
                    if (remainderPx > 1.0) { // segment of at least 10cm
                      const startPx = T_start + numPipes * headerLengthPx;
                      const endPx = dist - T_end;
                      const sx = p1.x + dirX * startPx;
                      const sy = p1.y + dirY * startPx;
                      const ex = p1.x + dirX * endPx;
                      const ey = p1.y + dirY * endPx;

                      pipeSegments.push(
                        <Group key={`pipe-${line.id}-${i}-rem`} listening={false}>
                          {/* Outer pipe border */}
                          <Line
                            points={[sx, sy, ex, ey]}
                            stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#0369a1'}
                            strokeWidth={isSelected ? 10 : 8}
                            lineCap="square"
                          />
                          {/* Inner pipe body */}
                          <Line
                            points={[sx, sy, ex, ey]}
                            stroke={activeTool === 'delete' ? '#fca5a5' : '#22d3ee'}
                            strokeWidth={4}
                            lineCap="square"
                          />
                          {/* Left joint flange */}
                          <Line
                            points={[sx - dirY * 4, sy + dirX * 4, sx + dirY * 4, sy - dirX * 4]}
                            stroke="#0369a1"
                            strokeWidth={2.5}
                          />
                          {/* Right joint flange */}
                          <Line
                            points={[ex - dirY * 4, ey + dirX * 4, ex + dirY * 4, ey - dirX * 4]}
                            stroke="#0369a1"
                            strokeWidth={2.5}
                          />
                        </Group>
                      );
                    }
                  }
                  return pipeSegments;
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

                {/* Wellpoints and Header Visualizations — all sizes are scale-invariant */}
                {showWellpoints && (() => {
                  const headerLengthPx = 6 * PIXELS_PER_METER;
                  const wpDistPx = headerLengthPx / 6;
                  const elements = [];
                  let currentHeaderCount = 0;
                  // invScale keeps visual sizes constant regardless of canvas zoom
                  const invScale = 1 / scale;
                  
                  for (let i = 0; i < line.points.length - 1; i++) {
                    const p1 = line.points[i];
                    const p2 = line.points[i + 1];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) continue;
                    
                    const dirX = dx / dist;
                    const dirY = dy / dist;
                    const numPipes = Math.floor((dist / PIXELS_PER_METER) / 6);
                    
                    for (let k = 0; k < numPipes; k++) {
                      currentHeaderCount++;
                      const startPx = k * headerLengthPx;
                      
                      // Render 6 wellpoints on BOTH sides of this 6-meter header pipe segment
                      for (let w = 0; w < 6; w++) {
                        const wpOffsetPx = startPx + (w + 0.5) * wpDistPx;
                        const wpX = p1.x + dirX * wpOffsetPx;
                        const wpY = p1.y + dirY * wpOffsetPx;
                        // Physical offset: 1m from header centreline
                        const offsetLength = PIXELS_PER_METER; // = 10px = 1m
                        const effectiveWellpointSide = line.wellpointSide || wellpointSide;

                        for (const side of (effectiveWellpointSide === 'left' ? [1] : effectiveWellpointSide === 'right' ? [-1] : [1, -1])) {
                          const perpX = -dirY * side;
                          const perpY = dirX * side;
                          // Connector starts at pipe edge (half of visual stroke = 4px)
                          const edgePx = 4 * invScale;
                          const sx = wpX + perpX * edgePx;
                          const sy = wpY + perpY * edgePx;
                          const outerX = wpX + perpX * Math.max(offsetLength, 6 * invScale);
                          const outerY = wpY + perpY * Math.max(offsetLength, 6 * invScale);

                          elements.push(
                            <Group key={`wp-${line.id}-${i}-${k}-${w}-s${side}`} listening={false}>
                              {/* Connector swing joint stub — starts at pipe edge */}
                              <Line
                                points={[sx, sy, outerX, outerY]}
                                stroke="#64748b"
                                strokeWidth={Math.max(1, 1.5 * invScale)}
                              />
                              {/* Wellpoint top cap — scale-invariant circle */}
                              <Circle
                                x={outerX} y={outerY}
                                radius={Math.max(2.5, 4 * invScale)}
                                fill="#e0f2fe"
                                stroke="#0ea5e9"
                                strokeWidth={Math.max(0.8, 1.2 * invScale)}
                              />
                              <Circle
                                x={outerX} y={outerY}
                                radius={Math.max(1, 1.8 * invScale)}
                                fill="#0369a1"
                              />
                            </Group>
                          );
                        }
                      }
                      
                      // Header segment label — scale-invariant font
                      const labelPx = startPx + headerLengthPx / 2;
                      const lx = p1.x + dirX * labelPx;
                      const ly = p1.y + dirY * labelPx;
                      const perpX = -dirY;
                      const perpY = dirX;
                      const labelOffset = Math.max(12, 12 * invScale);
                      elements.push(
                        <Text 
                          key={`hl-${line.id}-${i}-${k}`} 
                          x={lx - perpX * labelOffset - 6 * invScale} 
                          y={ly - perpY * labelOffset - 4 * invScale} 
                          text={`H${currentHeaderCount}`} 
                          fontSize={Math.max(7, 9 * invScale)}
                          fontStyle="bold" 
                          fill="#1e3a8a" 
                          listening={false} 
                        />
                      );
                    }

                    // Render wellpoints on the remainder segment
                    const remainderPx = dist - numPipes * headerLengthPx;
                    if (remainderPx > 1.0) {
                      currentHeaderCount++;
                      const startPx = numPipes * headerLengthPx;
                      const numWps = Math.floor(remainderPx / wpDistPx);
                      
                      for (let w = 0; w < numWps; w++) {
                        const wpOffsetPx = startPx + (w + 0.5) * wpDistPx;
                        const wpX = p1.x + dirX * wpOffsetPx;
                        const wpY = p1.y + dirY * wpOffsetPx;
                        const offsetLength = PIXELS_PER_METER;
                        const effectiveWellpointSide = line.wellpointSide || wellpointSide;

                        for (const side of (effectiveWellpointSide === 'left' ? [1] : effectiveWellpointSide === 'right' ? [-1] : [1, -1])) {
                          const perpX = -dirY * side;
                          const perpY = dirX * side;
                          const edgePx = 4 * invScale;
                          const sx = wpX + perpX * edgePx;
                          const sy = wpY + perpY * edgePx;
                          const outerX = wpX + perpX * Math.max(offsetLength, 6 * invScale);
                          const outerY = wpY + perpY * Math.max(offsetLength, 6 * invScale);

                          elements.push(
                            <Group key={`wp-${line.id}-${i}-rem-${w}-s${side}`} listening={false}>
                              <Line
                                points={[sx, sy, outerX, outerY]}
                                stroke="#64748b"
                                strokeWidth={Math.max(1, 1.5 * invScale)}
                              />
                              <Circle
                                x={outerX} y={outerY}
                                radius={Math.max(2.5, 4 * invScale)}
                                fill="#e0f2fe"
                                stroke="#0ea5e9"
                                strokeWidth={Math.max(0.8, 1.2 * invScale)}
                              />
                              <Circle
                                x={outerX} y={outerY}
                                radius={Math.max(1, 1.8 * invScale)}
                                fill="#0369a1"
                              />
                            </Group>
                          );
                        }
                      }

                      // Label for remainder pipe
                      const labelPx = startPx + remainderPx / 2;
                      const lx = p1.x + dirX * labelPx;
                      const ly = p1.y + dirY * labelPx;
                      const perpX = -dirY;
                      const perpY = dirX;
                      const labelOffset = Math.max(12, 12 * invScale);
                      elements.push(
                        <Text 
                          key={`hl-${line.id}-${i}-rem`} 
                          x={lx - perpX * labelOffset - 6 * invScale} 
                          y={ly - perpY * labelOffset - 4 * invScale} 
                          text={`H${currentHeaderCount}`} 
                          fontSize={Math.max(7, 9 * invScale)}
                          fontStyle="bold" 
                          fill="#1e3a8a" 
                          listening={false} 
                        />
                      );
                    }
                  }
                  return elements;
                })()}
              </React.Fragment>
            );
          })}


          {/* Suction Pipes (yellow) */}
          {hoses.filter((h: any) => h.kind !== 'discharge' && isItemVisible(h)).map((hose: any) => {
            const isSelected = activeTool === 'select' && (selectedId === hose.id || selectedIds.has(hose.id));
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
                  onContextMenu={(e) => {
                    if (activeTool === 'select') {
                      toggleSelectElement(hose.id, e);
                    }
                  }}
                  draggable={isSelected && !hose.locked}
                  onDragStart={(e) => handleHoseDragStart(hose.id, e)}
                  onDragEnd={(e) => handleHoseDragEnd(hose.id, e)}
                />
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#eab308'}
                  strokeWidth={isSelected ? 6 : 4}
                  tension={0}
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
                    !hose.hideLength ? (
                      <Text 
                        x={(p1.x + p2.x) / 2 + 10} 
                        y={(p1.y + p2.y) / 2 - 20} 
                        text={`L: ${totalDist.toFixed(1)}m`} 
                        fill="#854d0e" 
                        fontSize={12} 
                        fontStyle="bold" 
                        padding={4}
                        listening={false}
                      />
                    ) : null
                  );
                })()}
              </React.Fragment>
            );
          })}

          {/* Discharge Pipes (orange) */}
          {hoses.filter((h: any) => h.kind === 'discharge' && isItemVisible(h)).map((hose: any) => {
            const isSelected = activeTool === 'select' && (selectedId === hose.id || selectedIds.has(hose.id));
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
                  onContextMenu={(e) => {
                    if (activeTool === 'select') {
                      toggleSelectElement(hose.id, e);
                    }
                  }}
                  draggable={isSelected && !hose.locked}
                  onDragStart={(e) => handleHoseDragStart(hose.id, e)}
                  onDragEnd={(e) => handleHoseDragEnd(hose.id, e)}
                />
                <Line
                  points={hose.points.flatMap((p: Point) => [p.x, p.y])}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#fbbf24' : '#f97316'}
                  strokeWidth={isSelected ? 6 : 4}
                  tension={0}
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
                    !hose.hideLength ? (
                      <Text 
                        x={(p1.x + p2.x) / 2 + 10} 
                        y={(p1.y + p2.y) / 2 - 20} 
                        text={`L: ${totalDist.toFixed(1)}m`} 
                        fill="#9a3412" 
                        fontSize={12} 
                        fontStyle="bold" 
                        padding={4}
                        listening={false}
                      />
                    ) : null
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
                <Line points={pts.flatMap((p: Point) => [p.x, p.y])} stroke="#eab308" strokeWidth={4} tension={0} lineJoin="round" lineCap="round" dash={[8, 8]} opacity={0.8} listening={false} />
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
                <Line points={pts.flatMap((p: Point) => [p.x, p.y])} stroke="#f97316" strokeWidth={4} tension={0} lineJoin="round" lineCap="round" dash={[8, 8]} opacity={0.8} listening={false} />
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
          
          {/* Export Window Tool Preview */}
          {activeTool === 'export-window' && currentExportStart && cursorPos && (() => {
            const w = Math.abs(cursorPos.x - currentExportStart.x);
            const h = Math.abs(cursorPos.y - currentExportStart.y);
            if (w < 1 && h < 1) return null;
            return (
              <Group>
                <Rect
                  name="hide-on-export"
                  x={Math.min(currentExportStart.x, cursorPos.x)}
                  y={Math.min(currentExportStart.y, cursorPos.y)}
                  width={w}
                  height={h}
                  stroke="#4f46e5"
                  strokeWidth={2 / scale}
                  dash={[8 / scale, 8 / scale]}
                  fill="rgba(79, 70, 229, 0.1)"
                  listening={false}
                />
              </Group>
            );
          })()}

          {/* Dimensions */}
          {(dimensions || []).filter(isItemVisible).map(dim => {
            if ((dim as any).isTextAnnotation) {
              const isSelected = activeTool === 'select' && (selectedId === dim.id || selectedIds.has(dim.id));
              const textX = dim.x !== undefined ? dim.x : dim.start.x;
              const textY = dim.y !== undefined ? dim.y : dim.start.y;
              const textFSize = (dim as any).fontSize || 14;
              const textCol = (dim as any).color || '#000000';
              const textRot = (dim as any).rotation || 0;
              const isLocked = (dim as any).locked;
              
              return (
                <Group 
                  key={dim.id}
                  x={textX}
                  y={textY}
                  draggable={activeTool === 'select' && !isLocked}
                  onDragEnd={(e) => {
                    const node = e.target;
                    if (onDimensionsChange && dimensions) {
                      onDimensionsChange(dimensions.map(d => d.id === dim.id ? { 
                        ...d, 
                        x: node.x(), 
                        y: node.y(), 
                        start: { x: node.x(), y: node.y() }, 
                        end: { x: node.x(), y: node.y() } 
                      } : d));
                    }
                    node.position({ x: textX, y: textY });
                  }}
                  onMouseEnter={() => { 
                    if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                    else if (activeTool === 'select' && !isLocked) document.body.style.cursor = 'move';
                  }}
                  onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                  onClick={(e) => {
                    const stage = e.target.getStage();
                    const clickPt = getWorldPointerPos(stage) || undefined;
                    const didExecute = executeModifyCommand('text', dim.id, clickPt);
                    if (didExecute) {
                      e.cancelBubble = true;
                      return;
                    }
                    if (isLocked && activeTool !== 'select') return;
                    if (activeTool === 'select') {
                      selectSingleElement(dim.id);
                      e.cancelBubble = true;
                    }
                  }}
                  onTap={(e) => {
                    const stage = e.target.getStage();
                    const clickPt = getWorldPointerPos(stage) || undefined;
                    const didExecute = executeModifyCommand('text', dim.id, clickPt);
                    if (didExecute) {
                      e.cancelBubble = true;
                      return;
                    }
                    if (isLocked && activeTool !== 'select') return;
                    if (activeTool === 'select') {
                      selectSingleElement(dim.id);
                      e.cancelBubble = true;
                    }
                  }}
                  onContextMenu={(e) => {
                    if (activeTool === 'select') {
                      toggleSelectElement(dim.id, e);
                    }
                  }}
                  onDblClick={(e) => {
                    if (activeTool === 'select') {
                      setTextEditor({ x: textX, y: textY, val: dim.text, editingId: dim.id });
                      e.cancelBubble = true;
                    }
                  }}
                  onDblTap={(e) => {
                    if (activeTool === 'select') {
                      setTextEditor({ x: textX, y: textY, val: dim.text, editingId: dim.id });
                      e.cancelBubble = true;
                    }
                  }}
                >
                  <Text
                    x={0}
                    y={0}
                    text={dim.text}
                    fill={textCol}
                    fontSize={textFSize}
                    fontStyle="bold"
                    rotation={textRot}
                    align="center"
                  />
                  {isLocked && (
                    <Text x={-5} y={-20} text="📌" fontSize={12} listening={false} />
                  )}
                  {isSelected && (
                    <Rect
                      x={-4}
                      y={-4}
                      width={dim.text.length * textFSize * 0.6 + 8}
                      height={textFSize + 8}
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      dash={[4, 4]}
                      listening={false}
                    />
                  )}
                </Group>
              );
            }

            const dx = dim.end.x - dim.start.x;
            const dy = dim.end.y - dim.start.y;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const isLocked = (dim as any).locked;
            return (
              <Group key={dim.id}
                onMouseEnter={() => { if (activeTool === 'delete') document.body.style.cursor = 'pointer'; }}
                onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                onClick={(e) => {
                  const stage = e.target.getStage();
                  const clickPt = getWorldPointerPos(stage) || undefined;
                  const didExecute = executeModifyCommand('dimension', dim.id, clickPt);
                  if (didExecute) {
                    e.cancelBubble = true;
                    return;
                  }
                  if (activeTool === 'delete' && onDimensionsChange && dimensions) {
                    onDimensionsChange(dimensions.filter(d => d.id !== dim.id));
                    e.cancelBubble = true;
                  }
                }}
                onContextMenu={(e) => {
                  if (activeTool === 'select') {
                    toggleSelectElement(dim.id, e);
                  }
                }}
              >
                {dim.measuredStart && (
                  <Line points={[dim.measuredStart.x, dim.measuredStart.y, dim.start.x, dim.start.y]} stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} listening={false} />
                )}
                {dim.measuredEnd && (
                  <Line points={[dim.measuredEnd.x, dim.measuredEnd.y, dim.end.x, dim.end.y]} stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} listening={false} />
                )}
                <Line points={[dim.start.x, dim.start.y, dim.end.x, dim.end.y]} stroke={activeTool === 'delete' ? '#ef4444' : '#64748b'} strokeWidth={1} hitStrokeWidth={15} />
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
                />
              </Group>
            );
          })}

          {/* Current Dimension Preview */}
          {activeTool === 'dimension' && currentDim.length > 0 && cursorPos && (() => {
            if (currentDim.length === 1) {
              return (
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
              );
            } else if (currentDim.length === 2) {
              const pt1 = currentDim[0];
              const pt2 = currentDim[1];
              
              const dx = pt2.x - pt1.x;
              const dy = pt2.y - pt1.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              
              let startPoint = pt1;
              let endPoint = pt2;
              
              if (length > 0) {
                const nx = -dy / length;
                const ny = dx / length;
                const offset = (cursorPos.x - pt1.x) * nx + (cursorPos.y - pt1.y) * ny;
                
                startPoint = { x: pt1.x + nx * offset, y: pt1.y + ny * offset };
                endPoint = { x: pt2.x + nx * offset, y: pt2.y + ny * offset };
              }
              
              return (
                <Group listening={false}>
                  <Line points={[pt1.x, pt1.y, startPoint.x, startPoint.y]} stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} />
                  <Line points={[pt2.x, pt2.y, endPoint.x, endPoint.y]} stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} />
                  <Line points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]} stroke="#3b82f6" strokeWidth={1} />
                  <Line points={[startPoint.x - 5, startPoint.y - 5, startPoint.x + 5, startPoint.y + 5]} stroke="#3b82f6" strokeWidth={1.5} rotation={45} />
                  <Line points={[endPoint.x - 5, endPoint.y - 5, endPoint.x + 5, endPoint.y + 5]} stroke="#3b82f6" strokeWidth={1.5} rotation={45} />
                  <Text 
                    x={(startPoint.x + endPoint.x) / 2} 
                    y={(startPoint.y + endPoint.y) / 2} 
                    text={`${(length / PIXELS_PER_METER).toFixed(2)}m`}
                    fill="#3b82f6" 
                    fontSize={14} 
                    fontStyle="bold"
                    offsetY={12}
                  />
                </Group>
              );
            }
            return null;
          })()}

          {/* Texts */}
          {texts.filter(isItemVisible).map(txt => {
            const isSelected = activeTool === 'select' && (selectedId === txt.id || selectedIds.has(txt.id));
            const isLocked = txt.locked;
            return (
              <Group 
                key={txt.id}
                x={txt.x}
                y={txt.y}
                draggable={activeTool === 'select' && !isLocked}
                onDragEnd={(e) => {
                  const node = e.target;
                  if (onTextsChange && texts) {
                    onTextsChange(texts.map(t => t.id === txt.id ? { 
                      ...t, 
                      x: node.x(), 
                      y: node.y(), 
                    } : t));
                  }
                  node.position({ x: txt.x, y: txt.y });
                }}
                onMouseEnter={() => { 
                  if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                  else if (activeTool === 'select' && !isLocked) document.body.style.cursor = 'move';
                }}
                onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                onClick={(e) => {
                  const stage = e.target.getStage();
                  const clickPt = getWorldPointerPos(stage) || undefined;
                  const didExecute = executeModifyCommand('text', txt.id, clickPt);
                  if (didExecute) {
                    e.cancelBubble = true;
                    return;
                  }
                  if (isLocked && activeTool !== 'select') return;
                  if (activeTool === 'select') {
                    selectSingleElement(txt.id);
                    e.cancelBubble = true;
                  } else if (activeTool === 'delete' && onTextsChange) {
                    onTextsChange(texts.filter(t => t.id !== txt.id));
                    e.cancelBubble = true;
                  }
                }}
                onContextMenu={(e) => {
                  if (activeTool === 'select') {
                    toggleSelectElement(txt.id, e);
                  }
                }}
                onDblClick={(e) => {
                  if (activeTool === 'select' || activeTool === 'text') {
                    setTextEditor({ x: txt.x, y: txt.y, val: txt.text, editingId: txt.id });
                    e.cancelBubble = true;
                  }
                }}
                onDblTap={(e) => {
                  if (activeTool === 'select' || activeTool === 'text') {
                    setTextEditor({ x: txt.x, y: txt.y, val: txt.text, editingId: txt.id });
                    e.cancelBubble = true;
                  }
                }}
              >
                <Text
                  x={0}
                  y={0}
                  text={txt.text}
                  fill={txt.color || textColor}
                  fontSize={txt.fontSize || textSize}
                  fontStyle="bold"
                  rotation={txt.rotation || 0}
                  align="center"
                />
                {isLocked && (
                  <Text x={-5} y={-20} text="📌" fontSize={12} listening={false} />
                )}
                {isSelected && (
                  <Rect
                    x={-4}
                    y={-4}
                    width={txt.text.length * (txt.fontSize || textSize) * 0.6 + 8}
                    height={(txt.fontSize || textSize) + 8}
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    dash={[4, 4]}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Arrows */}
          {arrows.filter(isItemVisible).map(arrow => {
            const isSelected = activeTool === 'select' && (selectedId === arrow.id || selectedIds.has(arrow.id));
            return (
              <Group
                key={arrow.id}
                draggable={activeTool === 'select' && !arrow.locked}
                onDragEnd={(e) => {
                  const node = e.target;
                  if (onArrowsChange && arrows) {
                    const dx = node.x();
                    const dy = node.y();
                    onArrowsChange(arrows.map(a => a.id === arrow.id ? {
                      ...a,
                      start: { x: a.start.x + dx, y: a.start.y + dy },
                      end: { x: a.end.x + dx, y: a.end.y + dy }
                    } : a));
                  }
                  node.position({ x: 0, y: 0 });
                }}
                onMouseEnter={() => { 
                  if (activeTool === 'delete') document.body.style.cursor = 'pointer'; 
                  else if (activeTool === 'select' && !arrow.locked) document.body.style.cursor = 'move';
                }}
                onMouseLeave={() => { document.body.style.cursor = 'default'; }}
                onClick={(e) => {
                  if (activeTool === 'delete' && onArrowsChange && arrows) {
                    onArrowsChange(arrows.filter(a => a.id !== arrow.id));
                    e.cancelBubble = true;
                    return;
                  }
                  if (activeTool === 'select') {
                    selectSingleElement(arrow.id);
                    e.cancelBubble = true;
                  }
                }}
              >
                <Arrow
                  points={[arrow.start.x, arrow.start.y, arrow.end.x, arrow.end.y]}
                  fill={activeTool === 'delete' ? '#ef4444' : isSelected ? '#3b82f6' : '#475569'}
                  stroke={activeTool === 'delete' ? '#ef4444' : isSelected ? '#3b82f6' : '#475569'}
                  strokeWidth={2}
                  pointerLength={10}
                  pointerWidth={10}
                  hitStrokeWidth={15}
                />
                {isSelected && (
                  <Rect
                    x={Math.min(arrow.start.x, arrow.end.x) - 10}
                    y={Math.min(arrow.start.y, arrow.end.y) - 10}
                    width={Math.abs(arrow.end.x - arrow.start.x) + 20}
                    height={Math.abs(arrow.end.y - arrow.start.y) + 20}
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    dash={[4, 4]}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {/* Current Arrow Preview */}
          {activeTool === 'arrow' && currentArrow.length === 1 && cursorPos && (
            <Group listening={false}>
              <Arrow
                points={[currentArrow[0].x, currentArrow[0].y, cursorPos.x, cursorPos.y]}
                fill="#3b82f6"
                stroke="#3b82f6"
                strokeWidth={2}
                pointerLength={10}
                pointerWidth={10}
                dash={[4, 4]}
              />
            </Group>
          )}

          {/* Reference Scale Preview Line */}
          {scaleRefMode === 'selecting-end' && scaleRefPt1 && cursorPos && (
            <Group listening={false}>
              <Line points={[scaleRefPt1.x, scaleRefPt1.y, cursorPos.x, cursorPos.y]} stroke="#1e3a8a" strokeWidth={2} dash={[5, 5]} />
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

            </>
          )}

          {/* Polygon closing helper preview */}
          {['area', 'site-area', 'discharge-area'].includes(activeTool) && drawShapeMode === 'poly' && currentLine.length > 1 && cursorPos && (
            <Line
              points={[cursorPos.x, cursorPos.y, currentLine[0].x, currentLine[0].y]}
              stroke="#f59e0b"
              strokeWidth={1.5}
              dash={[4, 4]}
              opacity={0.6}
              listening={false}
            />
          )}

          {/* OSnap Indicator */}
          {currentSnap && (
            <Group x={currentSnap.pt.x} y={currentSnap.pt.y} listening={false}>
              {currentSnap.type === 'endpoint' && (
                <Rect x={-5} y={-5} width={10} height={10} stroke="#f59e0b" strokeWidth={2} fill="transparent" />
              )}
              {currentSnap.type === 'midpoint' && (
                <RegularPolygon sides={3} radius={7} stroke="#f59e0b" strokeWidth={2} fill="transparent" rotation={0} />
              )}
              {currentSnap.type === 'nearest' && (
                <RegularPolygon sides={4} radius={6} stroke="#f59e0b" strokeWidth={2} fill="transparent" rotation={45} />
              )}
            </Group>
          )}

          {/* Components */}
          {placedComponents.filter(isItemVisible).map(renderComponent)}

           {/* Visual Auto Fittings (Elbows/Tees derived from junctions) */}
          {(() => {
            const invScale = 1 / scale;
            return autoFittings.map((fit, i) => {
              if (fit.type === 'elbow') {
                return (
                  <Group key={`auto-elbow-${i}`} x={fit.x} y={fit.y} listening={false}>
                    {/* Outer curved connector block */}
                    <Circle 
                      radius={Math.max(4, 7 * invScale)} 
                      fill="#f59e0b" 
                      stroke="#78350f" 
                      strokeWidth={Math.max(0.5, 1 * invScale)} 
                      shadowColor="#000" 
                      shadowBlur={2 * invScale} 
                      shadowOpacity={0.2} 
                    />
                    <Circle 
                      radius={Math.max(1.5, 3 * invScale)} 
                      fill="#fff" 
                    />
                  </Group>
                );
              } else {
                return (
                  <Group key={`auto-tee-${i}`} x={fit.x} y={fit.y} rotation={fit.rotation} listening={false}>
                    {/* High contrast visual Tee joint */}
                    <Rect 
                      x={-4 * invScale} 
                      y={-8 * invScale} 
                      width={8 * invScale} 
                      height={16 * invScale} 
                      fill="#10b981" 
                      stroke="#064e3b" 
                      strokeWidth={Math.max(0.5, 1.5 * invScale)} 
                      cornerRadius={1 * invScale} 
                    />
                    <Rect 
                      x={-8 * invScale} 
                      y={-4 * invScale} 
                      width={16 * invScale} 
                      height={8 * invScale} 
                      fill="#10b981" 
                      stroke="#064e3b" 
                      strokeWidth={Math.max(0.5, 1.5 * invScale)} 
                      cornerRadius={1 * invScale} 
                    />
                    {/* Center junction bullet */}
                    <Circle 
                      radius={Math.max(1.2, 2.5 * invScale)} 
                      fill="#fff" 
                    />
                  </Group>
                );
              }
            });
          })()}
          
          {/* Current Hoses (drawing in progress) */}
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
          
          <KonvaLegend 
            lines={lines} 
            placedComponents={placedComponents} 
            hoses={hoses} 
            areas={areas} 
            pos={legendPos} 
            onDragEnd={setLegendPos} 
            scale={scale} 
          />

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
              <label className="text-xs text-slate-600 block mb-1">Layer</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                value={selectedArea.layerId || activeLayerId}
                onChange={(e) => {
                  if (onAreasChange) {
                    onAreasChange(areas.map((a: any) => a.id === selectedId ? { ...a, layerId: e.target.value } : a));
                  }
                }}
              >
                {layers.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
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
              <label className="text-xs text-slate-600 block mb-1">Layer</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                value={selectedLine.layerId || activeLayerId}
                onChange={(e) => {
                  if (onLinesChange) {
                    onLinesChange(lines.map((l: any) => l.id === selectedId ? { ...l, layerId: e.target.value } : l));
                  }
                }}
              >
                {layers.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
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
            
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
              <input
                type="checkbox"
                id="hide-length-label"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={!!selectedLine.hideLength}
                onChange={(e) => {
                  if (onLinesChange) {
                    onLinesChange(lines.map((l: any) => l.id === selectedId ? { ...l, hideLength: e.target.checked } : l));
                  }
                }}
              />
              <label htmlFor="hide-length-label" className="text-xs text-slate-700">Hide "L:" length label</label>
            </div>
          </div>
        </DraggablePanel>
      )}

      {selectedHose && activeTool === 'select' && (
        <DraggablePanel title="Hose Properties" onClose={() => setSelectedId(null)}>
          <div className="space-y-2 p-1">
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="hide-hose-length-label"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={!!selectedHose.hideLength}
                onChange={(e) => {
                  if (onHosesChange) {
                    onHosesChange(hoses.map((h: any) => h.id === selectedId ? { ...h, hideLength: e.target.checked } : h));
                  }
                }}
              />
              <label htmlFor="hide-hose-length-label" className="text-xs text-slate-700">Hide "L:" length label</label>
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

      {/* Revit-style modify floating guidance tooltip */}
      {getModifyGuidance() && cursorPos && (
        <div
          className="absolute z-50 pointer-events-none select-none bg-blue-900 border border-blue-500 text-white text-xs rounded shadow-2xl px-2.5 py-1.5 font-bold flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: Math.min((cursorPos.x * scale + position.x) + 20, canvasSize.width - 240),
            top: Math.min((cursorPos.y * scale + position.y) + 20, canvasSize.height - 40),
          }}
        >
          <span className="text-yellow-400">💡</span>
          {getModifyGuidance()}
        </div>
      )}

      {/* Reference Scale Tooltips */}
      {scaleRefMode !== 'idle' && cursorPos && (
        <div
          className="absolute z-50 pointer-events-none select-none bg-blue-900 border border-blue-500 text-white text-xs rounded shadow-2xl px-3 py-2 font-medium flex items-center gap-1.5 whitespace-nowrap"
          style={{
            left: Math.min((cursorPos.x * scale + position.x) + 20, canvasSize.width - 320),
            top: Math.min((cursorPos.y * scale + position.y) + 20, canvasSize.height - 40),
          }}
        >
          {scaleRefMode === 'selecting-start' ? 'Select the start point of a line which has a known length' : 'Select the end point of this line'}
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
      {textEditor && textEditorScreenPos && (
        <div 
          className="absolute z-[100] bg-white border border-blue-400 rounded shadow-md p-1 flex items-center gap-1.5"
          style={{
            left: `${textEditorScreenPos.left}px`,
            top: `${textEditorScreenPos.top}px`,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <input
            type="text"
            className="border-none outline-none px-2 py-1 text-sm bg-slate-50 rounded"
            placeholder="Type note..."
            style={{
              color: textColor,
              fontSize: `${textSize}px`,
              fontWeight: 'bold',
              minWidth: '150px'
            }}
            value={textEditor.val}
            onChange={(e) => setTextEditor(prev => prev ? { ...prev, val: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFinishText(textEditor.val, textEditor.editingId);
              } else if (e.key === 'Escape') {
                setTextEditor(null);
              }
            }}
            autoFocus
          />
          <button
            onClick={() => handleFinishText(textEditor.val, textEditor.editingId)}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-colors"
          >
            OK
          </button>
          <button
            onClick={() => setTextEditor(null)}
            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
