import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoSrc from '../../logo/logo-2.png';
import { Save, FolderOpen, Loader2, X, Trash2, Clock, Ruler, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { DewateringCanvas } from '../components/canvas/DewateringCanvas';
import { Dewatering3DView } from '../components/canvas/Dewatering3DView';
import { DewateringSectionView } from '../components/canvas/DewateringSectionView';
import { ResultsPanel } from '../components/canvas/ResultsPanel';
import { ActiveTool } from '../components/canvas/Toolbar';
import { StatusBar } from '../components/canvas/StatusBar';
import { DrawingSheetPreview, ExportOptions } from '../components/canvas/DrawingSheetPreview';
import { DewaterCadHeader, ViewMode } from '../components/canvas/DewaterCadHeader';
import { CadToolDock } from '../components/canvas/CadToolDock';
import { DesignPanel, LayerItem } from '../components/canvas/DesignPanel';
import { BlueprintControlBar } from '../components/canvas/BlueprintControlBar';
import { AiDewateringWizard } from '../components/canvas/AiDewateringWizard';
import { calculateBOM, LineData, PlacedComponent, DimensionData, AreaData, HoseData, ArrowData, TextData, ElevationLevel, PIXELS_PER_METER, Point } from '../utils/simulationLogic';
import { captureKonvaStage, captureThreeCanvas } from '../utils/drawingExportUtils';
import { useSetPageTitle } from '../contexts/PageContext';
import { db } from '../lib/supabaseService';
import { useUserStore } from '../store/userStore';
import { useAppStore } from '../store/appStore';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { CADLayer, DEFAULT_LAYERS } from '../utils/cadDataModels';
import { usePriv } from '../hooks/usePriv';
import { useTheme } from '../hooks/useTheme';
import { DewateringInput, DewateringLayoutType, DEFAULT_DEWATERING_INPUT, calculateDewatering } from '../utils/dewateringCalculator';
import {
  saveDewaterDraft,
  loadDewaterDraft,
  clearDewaterDraft,
  hasDraftContent,
  type DewaterDraftData
} from '../utils/dewaterAutoSave';

interface SavedLayout {
  id: string;
  name: string;
  lines: LineData[];
  components: PlacedComponent[];
  dimensions?: DimensionData[];
  areas?: AreaData[];
  hoses?: HoseData[];
  arrows?: ArrowData[];
  texts?: TextData[];
  levels?: ElevationLevel[];
  background_image_url: string | null;
  created_at: string;
}

interface BlueprintSettings {
  visible: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

function parseBlueprintUrl(urlStr: string | null | undefined): { url: string | null; settings: BlueprintSettings } {
  const defaultSettings: BlueprintSettings = {
    visible: true,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 0.5,
    locked: true
  };
  
  if (!urlStr) return { url: null, settings: defaultSettings };
  
  const hashIdx = urlStr.indexOf('#');
  if (hashIdx === -1) return { url: urlStr, settings: defaultSettings };
  
  const url = urlStr.substring(0, hashIdx);
  const hash = urlStr.substring(hashIdx + 1);
  const params = new URLSearchParams(hash);
  
  const settings: BlueprintSettings = {
    visible: params.get('visible') !== 'false',
    x: parseFloat(params.get('x') || '0'),
    y: parseFloat(params.get('y') || '0'),
    scaleX: parseFloat(params.get('scaleX') || '1'),
    scaleY: parseFloat(params.get('scaleY') || '1'),
    rotation: parseFloat(params.get('rotation') || '0'),
    opacity: parseFloat(params.get('opacity') || '0.5'),
    locked: params.get('locked') !== 'false'
  };
  
  return { url, settings };
}

function serializeBlueprintUrl(url: string | null | undefined, settings: BlueprintSettings): string | null {
  if (!url) return null;
  const params = new URLSearchParams();
  params.set('visible', String(settings.visible));
  params.set('x', String(settings.x));
  params.set('y', String(settings.y));
  params.set('scaleX', String(settings.scaleX));
  params.set('scaleY', String(settings.scaleY));
  params.set('rotation', String(settings.rotation));
  params.set('opacity', String(settings.opacity));
  params.set('locked', String(settings.locked));
  return `${url}#${params.toString()}`;
}

interface CanvasHudOverlayProps {
  isLoopClosed: boolean;
  is3D: boolean;
  activeLayerName: string;
  gridSnap: boolean;
  orthoLocked: boolean;
  scale?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomAll: () => void;
  onResetView?: () => void;
  onToggleLayers?: () => void;
  showLayers?: boolean;
}

function CanvasHudOverlay({
  isLoopClosed, is3D, activeLayerName,
  gridSnap, orthoLocked, scale = '1:100',
  onZoomIn, onZoomOut, onZoomAll, onResetView,
  onToggleLayers, showLayers,
}: CanvasHudOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* ── Top-Left Status Badge ── */}
      <div className="absolute top-3 left-3 pointer-events-auto">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-600">
          <span>Scale: <span className="font-semibold text-slate-900">{scale}</span></span>
          <span className="text-slate-300">•</span>
          <span>Grid: <span className="font-semibold text-slate-900">1.0 m</span></span>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={onToggleLayers}
            title={`Toggle Layers & Levels (F7) ${showLayers ? '(Active)' : ''}`}
            className={`flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded transition-colors cursor-pointer ${
              showLayers
                ? 'bg-blue-100 text-blue-800 font-semibold'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span className="text-slate-500">Layer:</span>
            <span className="font-semibold text-blue-600">{activeLayerName}</span>
          </button>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 font-sans">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoopClosed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className={`font-semibold ${isLoopClosed ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isLoopClosed ? 'Closed Loop' : 'Open Header'}
            </span>
          </span>
        </div>
      </div>

      {/* ── Top-Right ViewCube / Compass ── */}
      <div className="absolute top-3 right-3 pointer-events-auto">
        <div className="flex flex-col items-center gap-1.5">
          {/* 2D Compass / View label (only shown in 2D mode; 3D uses interactive ViewCube3D) */}
          {!is3D && (
            <div className="relative w-11 h-11 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex flex-col items-center justify-center cursor-default">
              <span className="text-[9px] font-bold text-slate-700 tracking-widest">
                TOP
              </span>
              <span className="text-[8px] font-medium text-slate-400">
                2D
              </span>
              {/* N arrow */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[7.5px] font-bold text-rose-500">N</span>
              </div>
            </div>
          )}

          {/* Zoom controls (offset below ViewCube3D in 3D mode) */}
          <div className={`flex flex-col gap-0.5 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg p-0.5 ${is3D ? 'mt-[138px]' : ''}`}>
            <button
              onClick={onZoomIn}
              title="Zoom In (+)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={onZoomAll}
              title="Zoom All / Fit (A)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onZoomOut}
              title="Zoom Out (-)"
              className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            {onResetView && (
              <button
                onClick={onResetView}
                title="Reset View"
                className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Simulator() {
  const priv = usePriv('simulator');
  const { isDark } = useTheme();
  const { isSimulatorDirty, setSimulatorDirty } = useAppStore();
  const [lines, setLines] = useState<LineData[]>([]);
  const [placedComponents, setPlacedComponents] = useState<PlacedComponent[]>([]);
  const [dimensions, setDimensions] = useState<DimensionData[]>([]);
  const [areas, setAreas] = useState<AreaData[]>([]);
  const [hoses, setHoses] = useState<HoseData[]>([]);
  const [arrows, setArrows] = useState<ArrowData[]>([]);
  const [texts, setTexts] = useState<TextData[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>('line');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // browser reload / tab close guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSimulatorDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved simulator changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Clean up the store dirty state when unmounting the simulator entirely
      setSimulatorDirty(false);
    };
  }, [isSimulatorDirty, setSimulatorDirty]);

  // Auto-collapse navigation sidebar when in DewaterCAD Simulator to maximize canvas workspace
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sidebar:collapse'));
    return () => {
      window.dispatchEvent(new CustomEvent('sidebar:restore'));
    };
  }, []);
  
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [blueprintSettings, setBlueprintSettings] = useState<BlueprintSettings>({
    visible: true,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 0.5,
    locked: true
  });

  // Options bar state
  const [offsetDistance, setOffsetDistance] = useState<number>(2.0);
  const [mirrorCopy, setMirrorCopy] = useState<boolean>(true);
  const [drawShapeMode, setDrawShapeMode] = useState<'rect' | 'poly'>('rect');
  const [textColor, setTextColor] = useState<string>('#000000');
  const [textSize, setTextSize] = useState<number>(14);

  interface CanvasSnapshot {
    lines: LineData[];
    placedComponents: PlacedComponent[];
    dimensions: DimensionData[];
    areas: AreaData[];
    hoses: HoseData[];
    arrows: ArrowData[];
    texts: TextData[];
  }

  const [undoStack, setUndoStack] = useState<CanvasSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasSnapshot[]>([]);

  // Refs to read current canvas state synchronously without race conditions
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const placedComponentsRef = useRef(placedComponents);
  placedComponentsRef.current = placedComponents;
  const dimensionsRef = useRef(dimensions);
  dimensionsRef.current = dimensions;
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const hosesRef = useRef(hoses);
  hosesRef.current = hoses;
  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;
  const textsRef = useRef(texts);
  textsRef.current = texts;

  // Guard flags to coalesce simultaneous mutations and avoid recording during restore
  const isRestoringRef = useRef(false);
  const snapshotPendingRef = useRef(false);
  const snapshotTimerRef = useRef<any>(null);

  const [lineLengthMeters, setLineLengthMeters] = useState<number | ''>('');
  
  // Elevation Levels
  const [levels, setLevels] = useState<ElevationLevel[]>([
    { id: 'gl-level', name: 'Ground Level (GL)', depthFromGL: 0, wellpointDepth: 6 }
  ]);
  const [activeLevelId, setActiveLevelId] = useState<string>('gl-level');

  // Layer Management
  const [layers, setLayers] = useState<CADLayer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-0');

  // Dewatering Level Settings
  const [groundElevation, setGroundElevation] = useState<number>(0);
  const [targetDepth, setTargetDepth] = useState<number>(5);
  const [screenLength, setScreenLength] = useState<number>(2);
  const [showWellpoints, setShowWellpoints] = useState(false);
  const [wellpointSide, setWellpointSide] = useState<'left' | 'right' | 'both'>('left');
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [orthoLocked, setOrthoLocked] = useState(false);
  const [gridSnap, setGridSnap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [selected3DId, setSelected3DId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showNavWheel, setShowNavWheel] = useState(false);
  const [hiddenCanvasIds, setHiddenCanvasIds] = useState<Set<string>>(new Set());
  const [lockedCanvasIds, setLockedCanvasIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // F7 Global shortcut to toggle Layers & Levels panel
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        setShowLayersPanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const layerItems = useMemo<LayerItem[]>(() => {
    const items: LayerItem[] = [];
    lines.forEach((l, i) => items.push({
      id: l.id,
      label: `Header Pipe ${i + 1}`,
      type: 'line',
      visible: !hiddenCanvasIds.has(l.id),
      locked: lockedCanvasIds.has(l.id),
      zIndex: 10 + i,
      color: '#0284c7'
    }));
    hoses.forEach((h, i) => items.push({
      id: h.id,
      label: `${h.kind === 'discharge' ? 'Discharge' : 'Suction'} Hose ${i + 1}`,
      type: 'line',
      visible: !hiddenCanvasIds.has(h.id),
      locked: lockedCanvasIds.has(h.id),
      zIndex: 20 + i,
      color: h.kind === 'discharge' ? '#f97316' : '#eab308'
    }));
    placedComponents.forEach((c, i) => items.push({
      id: c.id,
      label: `${c.type.toUpperCase()} ${i + 1}`,
      type: 'component',
      visible: !hiddenCanvasIds.has(c.id),
      locked: lockedCanvasIds.has(c.id),
      zIndex: 30 + i,
      color: c.type === 'pump' ? '#16a34a' : '#f59e0b'
    }));
    areas.forEach((a, i) => items.push({
      id: a.id,
      label: `${a.kind === 'site' ? 'Site' : a.kind === 'discharge' ? 'Discharge' : 'Pit'} ${i + 1}`,
      type: 'area',
      visible: !hiddenCanvasIds.has(a.id),
      locked: lockedCanvasIds.has(a.id),
      zIndex: 1 + i,
      color: a.kind === 'site' ? '#22c55e' : a.kind === 'discharge' ? '#f97316' : '#ef4444'
    }));
    return items;
  }, [lines, hoses, placedComponents, areas, hiddenCanvasIds, lockedCanvasIds]);

  const handleToggleCanvasItemVisibility = useCallback((id: string) => {
    setHiddenCanvasIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleCanvasItemLock = useCallback((id: string) => {
    setLockedCanvasIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Auto-import layout from Dewatering Calculator
  const location = useLocation();
  const [calculatorInputs, setCalculatorInputs] = useState<DewateringInput | null>(null);
  useEffect(() => {
    try {
      const stateData = (location.state as any)?.layoutData;
      const sessionStr = sessionStorage.getItem('dewatering_calculator_import');
      const importPayload = stateData || (sessionStr ? JSON.parse(sessionStr) : null);

      if (importPayload) {
        sessionStorage.removeItem('dewatering_calculator_import');
        if (importPayload.lines) {
          setLines(importPayload.lines.map((l: any) => ({
            ...l,
            layerId: (l.layerId && l.layerId !== 'layer-0') ? l.layerId : 'layer-headers',
          })));
        }
        if (importPayload.components) {
          setPlacedComponents(importPayload.components.map((c: any) => ({
            ...c,
            layerId: (c.layerId && c.layerId !== 'layer-0') ? c.layerId : 'layer-components',
          })));
        }
        if (importPayload.areas) {
          setAreas(importPayload.areas.map((a: any) => ({
            ...a,
            layerId: (a.layerId && a.layerId !== 'layer-0') ? a.layerId : 'layer-areas',
          })));
        }
        if (importPayload.hoses) {
          setHoses(importPayload.hoses.map((h: any) => ({
            ...h,
            layerId: (h.layerId && h.layerId !== 'layer-0') ? h.layerId : (h.kind === 'discharge' ? 'layer-discharge' : 'layer-suction'),
          })));
        }
        if (importPayload.arrows) setArrows(importPayload.arrows);
        if (importPayload.dimensions) {
          setDimensions(importPayload.dimensions.map((d: any) => ({
            ...d,
            layerId: (d.layerId && d.layerId !== 'layer-0') ? d.layerId : 'layer-dimensions',
          })));
        }
        if (importPayload.texts) setTexts(importPayload.texts);
        if (importPayload.targetDepth) setTargetDepth(importPayload.targetDepth);
        if (importPayload.calculatorInputs) setCalculatorInputs(importPayload.calculatorInputs);
        if (importPayload.levels && importPayload.levels.length > 0) {
          setLevels(importPayload.levels);
          setActiveLevelId(importPayload.activeLevelId || importPayload.levels[0].id);
        }
        setShowWellpoints(true);
        setSimulatorDirty(true);
        toast.success(`Imported ${importPayload.name || 'Dewatering Layout'} from Calculator`);
        setTimeout(() => {
          canvasApiRef.current?.zoomAll();
          view3DApiRef.current?.zoomAll();
        }, 120);
      }
    } catch {
      // ignore
    }
  }, [location.state]);

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [currentLayoutName, setCurrentLayoutName] = useState('');
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

  // Offline Auto-Save & Recovery State
  const [pendingDraft, setPendingDraft] = useState<{ draft: DewaterDraftData; blob: Blob | null } | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const autoSaveDebounceTimerRef = useRef<any>(null);
  const initialDraftCheckedRef = useRef(false);

  // Drawing Export State
  const stageRef = useRef<any>(null);
  const canvasApiRef = useRef<any>(null);
  const view3DApiRef = useRef<any>(null);
  const [showDrawingPreview, setShowDrawingPreview] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    layoutFormat: 'multi-view',
    includeSitePlan: true,
    includeSectionView: true,
    include3DView: true,
    includeBOM: true,
    includeLegend: true,
    includeBlueprint: true,
    includeTitleBlock: true,
    colorMode: 'color',
  });
  const [exportWindowMode, setExportWindowMode] = useState<boolean>(false);
  const [drawingExportData, setDrawingExportData] = useState<{
    sitePlanDataUrl: string;
    perspectiveDataUrl: string | null;
    companyInfo: any;
    logoSrc: string;
    dateStr: string;
  } | null>(null);

  // Load panel state
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [isLoadingLayouts, setIsLoadingLayouts] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Selected Canvas Item State
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);

  // Reference Scale state
  const [scaleRefMode, setScaleRefMode] = useState<'idle' | 'selecting-start' | 'selecting-end'>('idle');
  const [scaleRefPt1, setScaleRefPt1] = useState<{ x: number; y: number } | null>(null);
  const [scaleRefPt2, setScaleRefPt2] = useState<{ x: number; y: number } | null>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleInputStr, setScaleInputStr] = useState('');

  // AI Dewatering Assistant State
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [isAiTracing, setIsAiTracing] = useState(false);
  const [aiTracedPoints, setAiTracedPoints] = useState<Point[]>([]);
  const aiTraceCallbackRef = useRef<((points: Point[]) => void) | null>(null);

  const handleStartAiTracing = useCallback((onComplete: (points: Point[]) => void) => {
    aiTraceCallbackRef.current = onComplete;
    setIsAiTracing(true);
    setShowAiWizard(false);
    setActiveTool('area');
    setDrawShapeMode('poly');
    toast.info('Click consecutive points on blueprint to trace excavation pit. Click first point to finish.');
  }, []);

  const handleCancelAiTracing = useCallback(() => {
    setIsAiTracing(false);
    setShowAiWizard(true);
    setActiveTool('select');
    aiTraceCallbackRef.current = null;
    setAiTracedPoints([]);
  }, []);

  // Reference Scale & Blueprint Handlers
  const handleStartReferenceScale = useCallback(() => {
    if (!backgroundImage) {
      toast.info('Please import a blueprint underlay first (File -> Import Blueprint)');
      return;
    }
    if (show3D) {
      setShow3D(false);
      setViewMode('2d');
    }
    setScaleRefMode('selecting-start');
    setScaleRefPt1(null);
    setScaleRefPt2(null);
    toast.info('Reference Scale: Click the START point of a known dimension line on the blueprint.');
  }, [backgroundImage, show3D]);

  const handleCancelReferenceScale = useCallback(() => {
    setScaleRefMode('idle');
    setScaleRefPt1(null);
    setScaleRefPt2(null);
    toast.info('Scale calibration cancelled.');
  }, []);

  const handleResetBlueprint = useCallback(() => {
    setBlueprintSettings(prev => ({
      ...prev,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    }));
    setSimulatorDirty(true);
    toast.info('Blueprint position and scale reset to defaults.');
  }, [setSimulatorDirty]);

  const handleRemoveBlueprint = useCallback(() => {
    if (backgroundImage && backgroundImage.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundImage);
    }
    setBackgroundImage(undefined);
    setBackgroundFile(null);
    setScaleRefMode('idle');
    setScaleRefPt1(null);
    setScaleRefPt2(null);
    setSimulatorDirty(true);
    toast.info('Blueprint removed.');
  }, [backgroundImage, setSimulatorDirty]);

  const handleConfirmScale = useCallback(() => {
    if (!scaleRefPt1 || !scaleRefPt2) return;
    const actualLengthMeters = parseFloat(scaleInputStr);
    if (isNaN(actualLengthMeters) || actualLengthMeters <= 0) {
      toast.error('Please enter a valid positive length in meters.');
      return;
    }
    const distPx = Math.sqrt(Math.pow(scaleRefPt2.x - scaleRefPt1.x, 2) + Math.pow(scaleRefPt2.y - scaleRefPt1.y, 2));
    if (distPx === 0) return;
    const factor = (actualLengthMeters * PIXELS_PER_METER) / distPx;
    const newX = scaleRefPt1.x - (scaleRefPt1.x - blueprintSettings.x) * factor;
    const newY = scaleRefPt1.y - (scaleRefPt1.y - blueprintSettings.y) * factor;
    setBlueprintSettings(prev => ({
      ...prev,
      scaleX: prev.scaleX * factor,
      scaleY: prev.scaleY * factor,
      x: newX,
      y: newY,
    }));
    setShowScaleModal(false);
    setScaleInputStr('');
    setScaleRefPt1(null);
    setScaleRefPt2(null);
    setSimulatorDirty(true);
    toast.success(`Blueprint scaled: reference length calibrated to ${actualLengthMeters}m.`);
  }, [scaleRefPt1, scaleRefPt2, scaleInputStr, blueprintSettings, setSimulatorDirty]);

  // ── Offline Auto-Save & Draft Check on Mount ──────────────────────────────
  useEffect(() => {
    // Only check once on mount
    if (initialDraftCheckedRef.current) return;
    initialDraftCheckedRef.current = true;

    // If we're importing from calculator, don't interrupt with restore prompt
    const stateData = (location.state as any)?.layoutData;
    const sessionStr = sessionStorage.getItem('dewatering_calculator_import');
    if (stateData || sessionStr) return;

    loadDewaterDraft().then(({ draft, blueprintBlob }) => {
      if (hasDraftContent(draft)) {
        setPendingDraft({ draft: draft!, blob: blueprintBlob });
        setShowRestorePrompt(true);
        if (draft?.savedAt) {
          setLastAutoSavedAt(draft.savedAt);
        }
      }
    });
  }, [location.state]);

  const handleApplyRestoredDraft = useCallback((draftData: DewaterDraftData, blob: Blob | null) => {
    setLines(draftData.lines || []);
    setPlacedComponents(draftData.placedComponents || []);
    setDimensions(draftData.dimensions || []);
    setAreas(draftData.areas || []);
    setHoses(draftData.hoses || []);
    setArrows(draftData.arrows || []);
    setTexts(draftData.texts || []);
    if (draftData.levels && draftData.levels.length > 0) {
      setLevels(draftData.levels);
      setActiveLevelId(draftData.activeLevelId || draftData.levels[0].id);
    }
    if (draftData.layers && draftData.layers.length > 0) {
      setLayers(draftData.layers);
      setActiveLayerId(draftData.activeLayerId || draftData.layers[0].id);
    }
    if (draftData.blueprintSettings) {
      setBlueprintSettings(draftData.blueprintSettings);
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      setBackgroundImage(url);
      setBackgroundFile(blob as File);
    } else if (draftData.backgroundImageUrl) {
      setBackgroundImage(draftData.backgroundImageUrl);
    }
    if (draftData.name) {
      setCurrentLayoutName(draftData.name);
    }
    if (draftData.layoutId) {
      setCurrentLayoutId(draftData.layoutId);
    }
    setUndoStack([]);
    setRedoStack([]);
    setShowRestorePrompt(false);
    setPendingDraft(null);
    setSimulatorDirty(true);
    toast.success(`Restored previous drawing session (${draftData.itemCount} items).`);
    setTimeout(() => {
      canvasApiRef.current?.zoomAll();
    }, 150);
  }, [setSimulatorDirty]);

  const handleDiscardDraft = useCallback(() => {
    clearDewaterDraft();
    setShowRestorePrompt(false);
    setPendingDraft(null);
    setLastAutoSavedAt(null);
    setSimulatorDirty(false);
    toast.info('Offline draft discarded. Starting fresh canvas.');
  }, [setSimulatorDirty]);

  // ── Debounced Auto-Save to IndexedDB whenever canvas state changes ──────────
  useEffect(() => {
    // If restore modal is currently open, don't overwrite the draft with empty initial state
    if (showRestorePrompt) return;

    // Only auto-save to offline draft if the user actually has UNSAVED changes
    if (!isSimulatorDirty) {
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      return;
    }

    const hasAnyContent =
      lines.length > 0 ||
      placedComponents.length > 0 ||
      dimensions.length > 0 ||
      areas.length > 0 ||
      hoses.length > 0 ||
      arrows.length > 0 ||
      texts.length > 0 ||
      !!backgroundImage;

    if (!hasAnyContent) return;

    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
    }

    autoSaveDebounceTimerRef.current = setTimeout(async () => {
      try {
        await saveDewaterDraft({
          name: currentLayoutName || 'Untitled Drawing',
          layoutId: currentLayoutId,
          lines,
          placedComponents,
          dimensions,
          areas,
          hoses,
          arrows,
          texts,
          levels,
          activeLevelId,
          layers,
          activeLayerId,
          blueprintSettings,
          backgroundImageUrl: backgroundImage && !backgroundImage.startsWith('blob:') ? backgroundImage : null,
        }, backgroundFile || null);

        const nowIso = new Date().toISOString();
        setLastAutoSavedAt(nowIso);
      } catch (err) {
        console.warn('Auto-save error', err);
      }
    }, 800);

    return () => {
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
    };
  }, [
    isSimulatorDirty,
    lines, placedComponents, dimensions, areas, hoses, arrows, texts,
    levels, activeLevelId, layers, activeLayerId,
    blueprintSettings, backgroundImage, backgroundFile,
    currentLayoutName, currentLayoutId, showRestorePrompt
  ]);

  const results = useMemo(() => calculateBOM(lines, placedComponents, PIXELS_PER_METER, hoses, calculatorInputs?.filterPipeLength), [lines, placedComponents, hoses, calculatorInputs?.filterPipeLength]);

  useEffect(() => {
    return () => {
      if (backgroundImage && backgroundImage.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundImage);
      }
    };
  }, [backgroundImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (backgroundImage && backgroundImage.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundImage);
      }
      const url = URL.createObjectURL(file);
      setBackgroundImage(url);
      setBackgroundFile(file);
      setSimulatorDirty(true);
    }
  };

  const handleSaveLayout = async () => {
    const user = useUserStore.getState().getCurrentUser();
    if (!user) {
      toast.error('You must be logged in to save.');
      return;
    }
    if (!priv.canSave) {
      toast.error('You do not have permission to save layouts.');
      return;
    }
    if (!saveName.trim()) {
      toast.error('Please enter a name for the layout.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanImageBase = backgroundImage ? parseBlueprintUrl(backgroundImage).url : null;
      let finalImageUrl = cleanImageBase && !cleanImageBase.startsWith('blob:') ? cleanImageBase : null;

      if (backgroundFile) {
        const fileExt = backgroundFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('simulator-blueprints')
          .upload(fileName, backgroundFile);
        
        if (uploadError) throw uploadError;
        if (data) {
          const { data: publicUrlData } = supabase.storage
            .from('simulator-blueprints')
            .getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
        }
      }

      const dbImageUrl = serializeBlueprintUrl(finalImageUrl, blueprintSettings);

      const newId = crypto.randomUUID();
      await db.saveDewateringLayout({
        id: newId,
        user_id: user.id,
        name: saveName.trim(),
        lines,
        components: placedComponents,
        dimensions,
        areas,
        hoses,
        arrows,
        texts,
        levels,
        background_image_url: dbImageUrl
      });
      toast.success(`Layout "${saveName.trim()}" saved successfully.`);
      setCurrentLayoutName(saveName.trim());
      setCurrentLayoutId(newId);
      setShowSaveDialog(false);
      setSaveName('');
      setSimulatorDirty(false);
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      clearDewaterDraft();
      setLastAutoSavedAt(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLayout = async () => {
    if (!currentLayoutId || !currentLayoutName) return;
    const user = useUserStore.getState().getCurrentUser();
    if (!user) {
      toast.error('You must be logged in to update.');
      return;
    }
    if (!priv.canSave) {
      toast.error('You do not have permission to save layouts.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanImageBase = backgroundImage ? parseBlueprintUrl(backgroundImage).url : null;
      let finalImageUrl = cleanImageBase && !cleanImageBase.startsWith('blob:') ? cleanImageBase : null;

      if (backgroundFile) {
        const fileExt = backgroundFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('simulator-blueprints')
          .upload(fileName, backgroundFile);
        
        if (uploadError) throw uploadError;
        if (data) {
          const { data: publicUrlData } = supabase.storage
            .from('simulator-blueprints')
            .getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
        }
      }

      const dbImageUrl = serializeBlueprintUrl(finalImageUrl, blueprintSettings);

      await db.saveDewateringLayout({
        id: currentLayoutId,
        user_id: user.id,
        name: currentLayoutName,
        lines,
        components: placedComponents,
        dimensions,
        areas,
        hoses,
        arrows,
        texts,
        levels,
        background_image_url: dbImageUrl
      });
      toast.success(`Layout "${currentLayoutName}" updated successfully.`);
      setSimulatorDirty(false);
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      clearDewaterDraft();
      setLastAutoSavedAt(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchLayouts = async () => {
    const user = useUserStore.getState().getCurrentUser();
    if (!user) {
      toast.error('You must be logged in to load layouts.');
      return;
    }
    setIsLoadingLayouts(true);
    try {
      const data = await db.getDewateringLayouts(user.id);
      setSavedLayouts((data || []) as SavedLayout[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load layouts.');
    } finally {
      setIsLoadingLayouts(false);
    }
  };

  const handleOpenLoadPanel = () => {
    setShowLoadPanel(true);
    fetchLayouts();
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    // Revoke old blob URL if any
    if (backgroundImage && backgroundImage.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundImage);
    }
    setLines(layout.lines || []);
    setPlacedComponents(layout.components || []);
    setDimensions(layout.dimensions || []);
    setAreas(layout.areas || []);
    setHoses(layout.hoses || []);
    setArrows(layout.arrows || []);
    setTexts(layout.texts || []);
    if (layout.levels && layout.levels.length > 0) {
      setLevels(layout.levels);
      setActiveLevelId(layout.levels[0].id);
    }
    const { url, settings } = parseBlueprintUrl(layout.background_image_url);
    setBackgroundImage(url || undefined);
    setBlueprintSettings(settings);
    setBackgroundFile(null);
    setUndoStack([]);
    setRedoStack([]);
    setShowLoadPanel(false);
    setCurrentLayoutName(layout.name);
    setCurrentLayoutId(layout.id);
    toast.success(`Loaded layout "${layout.name}".`);
    setSimulatorDirty(false);
    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
    }
    clearDewaterDraft();
    setLastAutoSavedAt(null);
  };

  const handleDeleteLayout = async (id: string, name: string) => {
    if (!priv.canDelete) {
      toast.error('You do not have permission to delete layouts.');
      return;
    }
    if (!confirm(`Delete layout "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await db.deleteDewateringLayout(id);
      setSavedLayouts(prev => prev.filter(l => l.id !== id));
      toast.success(`Deleted layout "${name}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportDrawing = () => {
    if (!priv.canExport) {
      toast.error('You do not have permission to export drawings.');
      return;
    }
    setShowExportOptions(true);
  };

  const confirmExport = async () => {
    setShowExportOptions(false);
    const fmt = exportOptions.layoutFormat;

    let sitePlanUrl: string | null = null;
    let perspectiveUrl: string | null = null;

    // ── 2D Site Plan Capture ──
    if (fmt === 'pure-2d' || fmt === 'combined' || fmt === 'multi-view' || fmt === 'tri-view-a1' || fmt === 'plan-section') {
      if (show3D && fmt === 'pure-2d') {
        toast.error(
          'Please switch back to the 2D canvas view before exporting a 2D Floor Plan.',
          { duration: 4000 }
        );
        return;
      }
      
      if (exportWindowMode) {
        setActiveTool('export-window');
        toast.info('Click and drag on the canvas to select the export area.');
        return;
      }
      
      sitePlanUrl = captureKonvaStage(stageRef, undefined, { includeBlueprint: exportOptions.includeBlueprint });
      if (!sitePlanUrl && fmt === 'pure-2d') {
        toast.error('Failed to capture the 2D site plan. Make sure the canvas has content.');
        return;
      }
    }

    // ── 3D View Capture ──
    if (fmt === 'pure-3d' || fmt === 'combined' || fmt === 'multi-view' || fmt === 'tri-view-a1') {
      if (!show3D && fmt === 'pure-3d') {
        toast.error(
          'Please switch to the 3D view before exporting a 3D Perspective sheet.',
          { duration: 4000 }
        );
        return;
      }
      if (viewMode !== '3d') {
        view3DApiRef.current?.fitImmediate?.();
        // Allow brief tick for Three.js WebGL buffer to commit immediate isometric frame
        await new Promise(r => setTimeout(r, 60));
      }
      perspectiveUrl = captureThreeCanvas();
      if (!perspectiveUrl && fmt === 'pure-3d') {
        toast.error('Failed to capture 3D view. Make sure 3D mode is active.');
        return;
      }
    }

    if (!sitePlanUrl && !perspectiveUrl && fmt !== 'pure-section') {
      toast.error('Nothing to export.');
      return;
    }

    await finishExport(sitePlanUrl, perspectiveUrl);
  };

  const finishExport = async (sitePlanUrl: string | null, perspectiveUrl: string | null) => {
    const fmt = exportOptions.layoutFormat;
    if (!sitePlanUrl && !perspectiveUrl && fmt !== 'pure-section') {
      toast.error('No drawings captured for export.');
      return;
    }

    // Fetch company info
    let companyInfo = {
      name: 'DEWATERING CONSTRUCTION ETC LIMITED',
      address: 'N/A',
      regNumber: 'N/A',
      phone: 'N/A',
      email: 'N/A',
    };
    try {
      const { data } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (data) {
        companyInfo.name = data.company_name || companyInfo.name;
        companyInfo.address = data.company_address || companyInfo.address;
        companyInfo.regNumber = data.company_reg_number || companyInfo.regNumber;
        companyInfo.phone = data.company_phone || companyInfo.phone;
        companyInfo.email = data.company_email || companyInfo.email;
      }
    } catch (err) {
      console.error('Failed to fetch company info for export', err);
    }

    setDrawingExportData({
      sitePlanDataUrl: sitePlanUrl || '',
      perspectiveDataUrl: perspectiveUrl,
      companyInfo,
      logoSrc,
      dateStr: new Date().toLocaleDateString(),
    });
    setShowDrawingPreview(true);
  };

  const handleExportWindowSelected = async (rect: {x: number, y: number, width: number, height: number}) => {
    setActiveTool('select');
    const fmt = exportOptions.layoutFormat;
    
    let sitePlanUrl: string | null = captureKonvaStage(stageRef, rect, { includeBlueprint: exportOptions.includeBlueprint });
    let perspectiveUrl: string | null = null;
    if (fmt === 'combined' || fmt === 'multi-view' || fmt === 'tri-view-a1') {
      if (viewMode !== '3d') {
        view3DApiRef.current?.fitImmediate?.();
        await new Promise(r => setTimeout(r, 60));
      }
      perspectiveUrl = captureThreeCanvas();
    }
    
    await finishExport(sitePlanUrl, perspectiveUrl);
  };

  const handleClear = () => {
    // Record snapshot so user can undo accidental clear
    recordSnapshotBeforeChange();
    setLines([]);
    setPlacedComponents([]);
    setDimensions([]);
    setAreas([]);
    setHoses([]);
    setArrows([]);
    setTexts([]);
    setCurrentLayoutId(null);
    setCurrentLayoutName('');
    setSimulatorDirty(false);
    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
    }
    clearDewaterDraft();
    setLastAutoSavedAt(null);
  };

  const handleNewLayout = () => {
    if (isSimulatorDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to start a new drawing without saving?")) {
        return;
      }
    }
    handleClear();
  };

  useSetPageTitle('Dewatering Layout Simulator', '', null);

  // Helper to compute live effective calculator inputs from canvas geometry
  const getEffectiveCalculatorInputs = useCallback((): DewateringInput => {
    const pit = areas.find(a => a.kind === 'excavation') || areas[0];
    const site = areas.find(a => a.kind === 'site');

    let calcL = calculatorInputs?.excavationLength || 12;
    let calcW = calculatorInputs?.excavationWidth || 8;

    if (pit && pit.width && pit.height) {
      calcL = Math.max(1, Math.round((pit.width / PIXELS_PER_METER) * 10) / 10);
      calcW = Math.max(1, Math.round((pit.height / PIXELS_PER_METER) * 10) / 10);
    } else if (lines.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      lines.forEach(l => l.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }));
      if (minX !== Infinity && maxX > minX && maxY > minY) {
        calcL = Math.max(1, Math.round(((maxX - minX) / PIXELS_PER_METER) * 10) / 10);
        calcW = Math.max(1, Math.round(((maxY - minY) / PIXELS_PER_METER) * 10) / 10);
      }
    }

    let landL = calculatorInputs?.landLength || Math.max(30, calcL + 12);
    let landW = calculatorInputs?.landWidth || Math.max(24, calcW + 12);
    if (site && site.width && site.height) {
      landL = Math.max(calcL + 4, Math.round((site.width / PIXELS_PER_METER) * 10) / 10);
      landW = Math.max(calcW + 4, Math.round((site.height / PIXELS_PER_METER) * 10) / 10);
    }

    const calcDepth = targetDepth || calculatorInputs?.excavationDepth || 4.0;

    let detectedLayout: DewateringLayoutType = calculatorInputs?.layoutType || 'ring';
    if (lines.length === 1 && lines[0].points.length === 2) {
      detectedLayout = 'single_line';
    } else if (lines.length === 1 && lines[0].points.length === 3) {
      detectedLayout = 'l_shape';
    } else if (lines.length === 1 && lines[0].points.length === 4) {
      detectedLayout = 'u_shape';
    } else if (lines.length > 0) {
      detectedLayout = 'ring';
    }

    return {
      ...(calculatorInputs || DEFAULT_DEWATERING_INPUT),
      excavationLength: calcL,
      excavationWidth: calcW,
      excavationDepth: calcDepth,
      landLength: Math.max(landL, calcL + 4),
      landWidth: Math.max(landW, calcW + 4),
      layoutType: detectedLayout,
      waterTableDepth: calculatorInputs?.waterTableDepth ?? 1.0,
      requiredDrawdown: calculatorInputs?.requiredDrawdown ?? 0.5,
      filterPipeLength: calculatorInputs?.filterPipeLength ?? DEFAULT_DEWATERING_INPUT.filterPipeLength ?? 6.0,
    };
  }, [calculatorInputs, areas, lines, targetDepth]);

  // Handle view mode changes
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === '3d') {
      setShow3D(true);
    } else if (mode === '2d') {
      setShow3D(false);
    } else if (mode === 'section') {
      setShow3D(false);
    } else if (mode === 'calc') {
      const exportInputs = getEffectiveCalculatorInputs();
      sessionStorage.setItem('dewatering_simulator_export', JSON.stringify(exportInputs));
      navigate('/operations/dewatering-calculator', {
        state: { fromSimulator: true, calculatorInputs: exportInputs }
      });
    }
  }, [navigate, getEffectiveCalculatorInputs]);

  // Keep viewMode in sync with show3D
  useEffect(() => {
    if (show3D && viewMode !== '3d') {
      setViewMode('3d');
    } else if (!show3D && viewMode === '3d') {
      setViewMode('2d');
    }
  }, [show3D, viewMode]);

  const recordSnapshotBeforeChange = useCallback(() => {
    if (isRestoringRef.current) return;
    if (snapshotPendingRef.current) return;

    snapshotPendingRef.current = true;
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      snapshotPendingRef.current = false;
    }, 200);

    const snapshot: CanvasSnapshot = {
      lines: JSON.parse(JSON.stringify(linesRef.current)),
      placedComponents: JSON.parse(JSON.stringify(placedComponentsRef.current)),
      dimensions: JSON.parse(JSON.stringify(dimensionsRef.current)),
      areas: JSON.parse(JSON.stringify(areasRef.current)),
      hoses: JSON.parse(JSON.stringify(hosesRef.current)),
      arrows: JSON.parse(JSON.stringify(arrowsRef.current)),
      texts: JSON.parse(JSON.stringify(textsRef.current)),
    };

    setUndoStack(prev => {
      const next = [...prev, snapshot];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot: CanvasSnapshot = {
      lines: JSON.parse(JSON.stringify(linesRef.current)),
      placedComponents: JSON.parse(JSON.stringify(placedComponentsRef.current)),
      dimensions: JSON.parse(JSON.stringify(dimensionsRef.current)),
      areas: JSON.parse(JSON.stringify(areasRef.current)),
      hoses: JSON.parse(JSON.stringify(hosesRef.current)),
      arrows: JSON.parse(JSON.stringify(arrowsRef.current)),
      texts: JSON.parse(JSON.stringify(textsRef.current)),
    };

    isRestoringRef.current = true;
    setRedoStack(prev => [...prev, currentSnapshot]);
    setUndoStack(prev => prev.slice(0, -1));

    setLines(previousSnapshot.lines);
    setPlacedComponents(previousSnapshot.placedComponents);
    setDimensions(previousSnapshot.dimensions);
    setAreas(previousSnapshot.areas);
    setHoses(previousSnapshot.hoses);
    setArrows(previousSnapshot.arrows);
    setTexts(previousSnapshot.texts);
    setSimulatorDirty(true);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 50);
  }, [undoStack, setSimulatorDirty]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: CanvasSnapshot = {
      lines: JSON.parse(JSON.stringify(linesRef.current)),
      placedComponents: JSON.parse(JSON.stringify(placedComponentsRef.current)),
      dimensions: JSON.parse(JSON.stringify(dimensionsRef.current)),
      areas: JSON.parse(JSON.stringify(areasRef.current)),
      hoses: JSON.parse(JSON.stringify(hosesRef.current)),
      arrows: JSON.parse(JSON.stringify(arrowsRef.current)),
      texts: JSON.parse(JSON.stringify(textsRef.current)),
    };

    isRestoringRef.current = true;
    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack(prev => prev.slice(0, -1));

    setLines(nextSnapshot.lines);
    setPlacedComponents(nextSnapshot.placedComponents);
    setDimensions(nextSnapshot.dimensions);
    setAreas(nextSnapshot.areas);
    setHoses(nextSnapshot.hoses);
    setArrows(nextSnapshot.arrows);
    setTexts(nextSnapshot.texts);
    setSimulatorDirty(true);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, 50);
  }, [redoStack, setSimulatorDirty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleLinesChange = (newLines: LineData[]) => {
    recordSnapshotBeforeChange();
    setLines(newLines);
    setSimulatorDirty(true);
  };

  const handleComponentsChange = (newComps: PlacedComponent[]) => {
    recordSnapshotBeforeChange();
    setPlacedComponents(newComps);
    setSimulatorDirty(true);
  };

  const handleDimensionsChange = (newDims: DimensionData[]) => {
    recordSnapshotBeforeChange();
    setDimensions(newDims);
    setSimulatorDirty(true);
  };

  const handleApplyAiGeneratedLayout = useCallback((payload: {
    lines: LineData[];
    areas: AreaData[];
    components: PlacedComponent[];
    hoses: HoseData[];
    levels: ElevationLevel[];
    targetDepth: number;
    calculatorInputs: DewateringInput;
    name: string;
  }) => {
    recordSnapshotBeforeChange();
    setLines(payload.lines);
    setAreas(payload.areas);
    setPlacedComponents(payload.components);
    setHoses(payload.hoses);
    if (payload.levels && payload.levels.length > 0) {
      setLevels(payload.levels);
      setActiveLevelId(payload.levels[1]?.id || payload.levels[0].id);
    }
    setTargetDepth(payload.targetDepth);
    setCalculatorInputs(payload.calculatorInputs);
    setShowWellpoints(true);
    setCurrentLayoutName(payload.name);
    setSimulatorDirty(true);
    toast.success(`Generated ${payload.name} and placed on CAD canvas!`);
    setTimeout(() => {
      canvasApiRef.current?.zoomAll();
      view3DApiRef.current?.zoomAll();
    }, 120);
  }, [recordSnapshotBeforeChange, setSimulatorDirty]);

  const handleAreasChange = (newAreas: AreaData[]) => {
    recordSnapshotBeforeChange();
    setAreas(newAreas);
    setSimulatorDirty(true);

    if (isAiTracing && aiTraceCallbackRef.current && newAreas.length > areas.length) {
      const addedArea = newAreas[newAreas.length - 1];
      const pts: Point[] = addedArea.points && addedArea.points.length >= 3
        ? addedArea.points
        : [
            { x: addedArea.x, y: addedArea.y },
            { x: addedArea.x + (addedArea.width || 0), y: addedArea.y },
            { x: addedArea.x + (addedArea.width || 0), y: addedArea.y + (addedArea.height || 0) },
            { x: addedArea.x, y: addedArea.y + (addedArea.height || 0) }
          ];
      setIsAiTracing(false);
      setShowAiWizard(true);
      setActiveTool('select');
      aiTraceCallbackRef.current(pts);
      aiTraceCallbackRef.current = null;
      setAiTracedPoints([]);
    }
  };

  const handleHosesChange = (newHoses: HoseData[]) => {
    recordSnapshotBeforeChange();
    setHoses(newHoses);
    setSimulatorDirty(true);
  };

  const handleArrowsChange = (newArrows: ArrowData[]) => {
    recordSnapshotBeforeChange();
    setArrows(newArrows);
    setSimulatorDirty(true);
  };

  const handleTextsChange = (newTexts: TextData[]) => {
    recordSnapshotBeforeChange();
    setTexts(newTexts);
    setSimulatorDirty(true);
  };

  const handleToolSelect = (tool: ActiveTool) => {
    if (tool === 'scale-blueprint') {
      handleStartReferenceScale();
      return;
    }
    setActiveTool(tool);
    if (['line', 'hose', 'discharge'].includes(tool)) {
      setOrthoLocked(true);
    }
  };

  // Zoom Variation Handlers (Revit / AutoCAD Suite)
  const handleZoomIn = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.zoomIn?.();
    } else {
      canvasApiRef.current?.zoomIn?.();
    }
  }, [show3D]);

  const handleZoomOut = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.zoomOut?.();
    } else {
      canvasApiRef.current?.zoomOut?.();
    }
  }, [show3D]);

  const handleZoomAll = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.zoomAll?.();
    } else {
      canvasApiRef.current?.zoomAll?.();
    }
  }, [show3D]);

  const handleZoomWindow = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.zoomWindow?.();
    } else {
      setActiveTool('zoom-window');
    }
  }, [show3D]);

  const handleZoomSelection = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.zoomAll?.();
    } else {
      canvasApiRef.current?.zoomSelection?.();
    }
  }, [show3D]);

  const handleZoom100 = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.resetView?.();
    } else {
      canvasApiRef.current?.zoom100?.();
    }
  }, [show3D]);

  const handleZoomPrevious = useCallback(() => {
    if (show3D) {
      view3DApiRef.current?.resetView?.();
    } else {
      canvasApiRef.current?.zoomPrevious?.();
    }
  }, [show3D]);

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 select-none" : "absolute inset-0 flex flex-col overflow-hidden bg-slate-50 select-none"}>

      {/* Hidden blueprint file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept="image/*"
        onChange={handleImageUpload}
      />

      {/* ── Top Navigation Bar ── */}
      <DewaterCadHeader
        currentLayoutName={currentLayoutName}
        onLayoutNameChange={(name) => {
          setCurrentLayoutName(name);
          setSaveName(name);
        }}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onNew={handleNewLayout}
        onSave={() => { setSaveName(''); setShowSaveDialog(true); }}
        onUpdate={handleUpdateLayout}
        onOpenLoad={handleOpenLoadPanel}
        onExport={handleExportDrawing}
        onUploadBlueprint={() => fileInputRef.current?.click()}
        hasBlueprint={!!backgroundImage}
        onStartReferenceScale={handleStartReferenceScale}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomAll={handleZoomAll}
        orthoLocked={orthoLocked}
        onToggleOrtho={() => setOrthoLocked(!orthoLocked)}
        gridSnap={gridSnap}
        onToggleGridSnap={() => setGridSnap(!gridSnap)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        boqResults={results}
        onClearBOQ={handleClear}
        isSaving={isSaving}
        isDirty={isSimulatorDirty}
        hasLayout={!!currentLayoutId}
        onOpenAiAssistant={() => setShowAiWizard(true)}
        lastAutoSavedAt={lastAutoSavedAt}
      />

      {/* ── Body: Left Dock + Layers Panel + Canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Vertical Tool Dock ── */}
        <div className="relative z-20 flex-shrink-0">
          <CadToolDock
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
            orthoLocked={orthoLocked}
            onToggleOrtho={() => setOrthoLocked(!orthoLocked)}
            gridSnap={gridSnap}
            onToggleGridSnap={() => setGridSnap(!gridSnap)}
            onToggleLayers={() => setShowLayersPanel(p => !p)}
            showWellpoints={showWellpoints}
            onToggleWellpoints={() => setShowWellpoints(!showWellpoints)}
            showLayers={showLayersPanel}
            showNavWheel={showNavWheel}
            onToggleNavWheel={() => setShowNavWheel(p => !p)}
          />
        </div>

        {/* ── Slide-out Design / Layers & Levels Panel ── */}
        {showLayersPanel && (
          <div className="relative z-20 flex-shrink-0 animate-in slide-in-from-left duration-200">
            <DesignPanel
              layerItems={layerItems}
              selectedId={selectedCanvasId}
              onSelectLayer={(id) => setSelectedCanvasId(id)}
              onToggleLock={handleToggleCanvasItemLock}
              onToggleVisibility={handleToggleCanvasItemVisibility}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              onSendToBack={() => {}}
              onBringToFront={() => {}}
              levels={levels}
              activeLevelId={activeLevelId}
              onSelectLevel={setActiveLevelId}
              onAddLevel={(lvl) => setLevels(prev => [...prev, lvl])}
              onUpdateLevel={(id, updates) => setLevels(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onDeleteLevel={(id) => setLevels(prev => prev.filter(l => l.id !== id))}
              cadLayers={layers}
              activeCadLayerId={activeLayerId}
              onSelectCadLayer={setActiveLayerId}
              onUpdateCadLayer={(id, updates) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onAddCadLayer={(layer) => setLayers(prev => [...prev, layer])}
              onDeleteCadLayer={(id) => setLayers(prev => prev.filter(l => l.id !== id))}
              onToggleCollapse={() => setShowLayersPanel(false)}
            />
          </div>
        )}

      <div className="flex flex-1 relative overflow-hidden flex-col z-0">
        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#e5e7eb] overflow-hidden relative">

          {/* Canvas HUD Overlays */}
          <CanvasHudOverlay
            isLoopClosed={lines.length > 0}
            is3D={show3D}
            activeLayerName={layers.find(l => l.id === activeLayerId)?.name || 'Layer 0'}
            gridSnap={gridSnap}
            orthoLocked={orthoLocked}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomAll={handleZoomAll}
            onResetView={show3D ? () => view3DApiRef.current?.resetView?.() : undefined}
            onToggleLayers={() => setShowLayersPanel(p => !p)}
            showLayers={showLayersPanel}
          />

          {/* Active Reference Scale Calibration Guidance Banner */}
          {scaleRefMode !== 'idle' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-blue-400 select-none animate-in fade-in slide-in-from-top-2">
              <Ruler className="w-4 h-4 animate-pulse" />
              <span>
                {scaleRefMode === 'selecting-start'
                  ? 'Step 1 of 2: Click the START point of a known dimension line on the blueprint'
                  : 'Step 2 of 2: Click the END point of the known dimension line'}
              </span>
              <button
                type="button"
                onClick={handleCancelReferenceScale}
                className="ml-2 px-2.5 py-0.5 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {activeTool === 'export-window' && (
            <div className="absolute top-0 inset-x-0 z-50 bg-blue-700/90 backdrop-blur-sm text-white text-center py-1.5 text-xs font-medium shadow-md flex items-center justify-center gap-4">
              <span>Click and drag on the canvas to select the export window area.</span>
              <button 
                onClick={() => setActiveTool('select')} 
                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* 3D Model View Container */}
          <div
            className={viewMode === '3d' ? "absolute inset-0 z-0 overflow-hidden" : "fixed -left-[9999px] top-0 w-[1280px] h-[720px] pointer-events-none opacity-0 -z-50"}
            aria-hidden={viewMode !== '3d'}
          >
            <Dewatering3DView 
              lines={lines}
              placedComponents={placedComponents}
              areas={areas}
              hoses={hoses}
              groundElevation={groundElevation}
              targetDepth={targetDepth}
              screenLength={screenLength}
              levels={levels}
              wellpointSide={wellpointSide}
              activeTool={activeTool}
              selectedId={selected3DId}
              onSelectId={setSelected3DId}
              onAreasChange={handleAreasChange}
              onLinesChange={handleLinesChange}
              onPlacedComponentsChange={handleComponentsChange}
              onHosesChange={handleHosesChange}
              resultsOpen={showResults}
              showNavWheel={showNavWheel}
              onToggleNavWheel={() => setShowNavWheel(p => !p)}
              view3DApiRef={view3DApiRef}
            />
          </div>

          {/* Section Profile View Container */}
          {viewMode === 'section' && (
            <div className={`absolute inset-0 z-10 ${isDark ? 'bg-slate-900' : 'bg-slate-100'} overflow-hidden flex flex-col`}>
              <DewateringSectionView
                inputs={getEffectiveCalculatorInputs()}
                onUpdateInputs={(updates) => {
                  setCalculatorInputs(prev => ({
                    ...(prev || DEFAULT_DEWATERING_INPUT),
                    ...updates,
                  }));
                  if (updates.excavationDepth !== undefined) {
                    setTargetDepth(updates.excavationDepth);
                  }
                  setSimulatorDirty(true);
                }}
                theme={isDark ? 'dark' : 'light'}
                className="h-full w-full"
              />
            </div>
          )}

          {/* 2D CAD Canvas Container */}
          <div
            className={viewMode === '2d' ? "absolute inset-0 z-0 overflow-hidden" : "fixed -left-[9999px] top-0 w-[1280px] h-[720px] pointer-events-none opacity-0 -z-50"}
            aria-hidden={viewMode !== '2d'}
          >
            <DewateringCanvas
              stageRef={stageRef}
              canvasApiRef={canvasApiRef}
              showLayersPanel={showLayersPanel}
              onToggleLayersPanel={() => setShowLayersPanel(p => !p)}
              onSelectionChange={setSelectedCanvasId}
              lines={lines}
              onLinesChange={handleLinesChange}
              placedComponents={placedComponents}
              onPlacedComponentsChange={handleComponentsChange}
              dimensions={dimensions}
              onDimensionsChange={handleDimensionsChange}
              areas={areas}
              onAreasChange={handleAreasChange}
              hoses={hoses}
              onHosesChange={handleHosesChange}
              arrows={arrows}
              onArrowsChange={handleArrowsChange}
              texts={texts}
              onTextsChange={handleTextsChange}
              activeTool={activeTool}
              onToolSelect={setActiveTool}
              backgroundImageUrl={backgroundImage}
              blueprintSettings={blueprintSettings}
              onUpdateBlueprintSettings={(updates) => setBlueprintSettings(prev => ({ ...prev, ...updates }))}
              offsetDistance={offsetDistance}
              mirrorCopy={mirrorCopy}
              drawShapeMode={drawShapeMode}
              textColor={textColor}
              textSize={textSize}
              onExportWindowSelected={handleExportWindowSelected}
              fixedLineLengthMeters={lineLengthMeters === '' ? undefined : lineLengthMeters}
              showWellpoints={showWellpoints}
              wellpointSide={wellpointSide}
              orthoLocked={orthoLocked}
              gridSnap={gridSnap}
              levels={levels}
              activeLevelId={activeLevelId}
              onSelectLevel={setActiveLevelId}
              onAddLevel={(lvl) => setLevels(prev => [...prev, lvl])}
              onUpdateLevel={(id, updates) => setLevels(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onDeleteLevel={(id) => setLevels(prev => prev.filter(l => l.id !== id))}
              layers={layers}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              onUpdateLayer={(id, updates) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onAddLayer={(layer) => setLayers(prev => [...prev, layer])}
              onCursorPosChange={setCursorPos}
              lockedCanvasIds={lockedCanvasIds}
              hiddenCanvasIds={hiddenCanvasIds}
              scaleRefMode={scaleRefMode}
              scaleRefPt1={scaleRefPt1}
              scaleRefPt2={scaleRefPt2}
              onSetScaleRefPt1={(pt) => { setScaleRefPt1(pt); setScaleRefMode('selecting-end'); }}
              onSetScaleRefPt2={(pt) => { setScaleRefPt2(pt); setScaleRefMode('idle'); setShowScaleModal(true); setScaleInputStr(''); }}
            />
          </div>

          {/* Blueprint Floating Control Bar */}
          {backgroundImage && !show3D && (
            <BlueprintControlBar
              blueprintSettings={blueprintSettings}
              onUpdateSettings={(updates) => {
                setBlueprintSettings(prev => ({ ...prev, ...updates }));
                setSimulatorDirty(true);
              }}
              onStartReferenceScale={handleStartReferenceScale}
              isCalibrating={scaleRefMode !== 'idle'}
              onResetBlueprint={handleResetBlueprint}
              onRemoveBlueprint={handleRemoveBlueprint}
              onOpenAiAssistant={() => setShowAiWizard(true)}
            />
          )}

        </div>

        {/* Status Bar */}
        <StatusBar
          cursorPos={cursorPos}
          activeTool={activeTool}
          gridSnap={gridSnap}
          orthoLocked={orthoLocked}
          osnapEnabled={true}
          activeLayerName={layers.find(l => l.id === activeLayerId)?.name || 'Layer 0'}
          isDirty={isSimulatorDirty}
          onToggleOrtho={() => setOrthoLocked(!orthoLocked)}
          onToggleGridSnap={() => setGridSnap(!gridSnap)}
          onToggleLayers={() => setShowLayersPanel(p => !p)}
          showLayers={showLayersPanel}
        />
      </div>

      </div> {/* end body */}

      {/* ── Save Dialog ── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white rounded-md border border-slate-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">Save Layout</h2>
              </div>
              <button onClick={() => setShowSaveDialog(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label htmlFor="layout-name" className="block text-sm font-semibold text-gray-700 mb-2">Layout Name</label>
              <input
                id="layout-name"
                type="text"
                autoFocus
                placeholder="e.g. Site A - Phase 1"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && saveName.trim()) handleSaveLayout(); }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-400 mt-2">{lines.length} line(s), {placedComponents.length} component(s) will be saved.</p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button onClick={() => setShowSaveDialog(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={isSaving || !saveName.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reference Scale Modal ── */}
      {showScaleModal && scaleRefPt1 && scaleRefPt2 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                  <Ruler className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Calibrate Blueprint Scale</h2>
              </div>
              <button
                onClick={() => { setShowScaleModal(false); setScaleRefPt1(null); setScaleRefPt2(null); }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-600">
              <p className="mb-4 text-slate-500 leading-relaxed">
                Enter the actual real-world length of the line you picked on the blueprint to calibrate accurate measurements.
              </p>
              
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5 border border-slate-200 mb-4">
                <span className="font-medium text-slate-600">Measured on screen:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {(Math.sqrt(Math.pow(scaleRefPt2.x - scaleRefPt1.x, 2) + Math.pow(scaleRefPt2.y - scaleRefPt1.y, 2)) / PIXELS_PER_METER).toFixed(3)} m
                </span>
              </div>
              
              <div className="mb-5">
                <label className="block font-bold text-slate-700 mb-1.5">
                  Actual Dimension (Meters):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    autoFocus
                    placeholder="e.g. 10.0"
                    className="w-full pl-3 pr-16 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={scaleInputStr}
                    onChange={e => setScaleInputStr(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleConfirmScale();
                      if (e.key === 'Escape') { setShowScaleModal(false); setScaleRefPt1(null); setScaleRefPt2(null); }
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                    meters
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowScaleModal(false); setScaleRefPt1(null); setScaleRefPt2(null); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScale}
                  disabled={!scaleInputStr || parseFloat(scaleInputStr) <= 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 transition-colors"
                >
                  Apply Scale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Load Panel (Slide-over) ── */}
      {showLoadPanel && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowLoadPanel(false)}>
          <div
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Saved Layouts</h2>
              </div>
              <button onClick={() => setShowLoadPanel(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingLayouts ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Loading layouts…</p>
                </div>
              ) : savedLayouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No saved layouts yet.</p>
                  <p className="text-xs mt-1">Save a layout and it will appear here.</p>
                </div>
              ) : (
                savedLayouts.map(layout => (
                  <div
                    key={layout.id}
                    className="group bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-4 cursor-pointer transition-all"
                    onClick={() => handleLoadLayout(layout)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-700 truncate transition-colors">
                          {layout.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(layout.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span>{(layout.lines || []).length} lines</span>
                          <span>{(layout.components || []).length} comps</span>
                        </div>
                      </div>
                      {priv.canDelete && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteLayout(layout.id, layout.name); }}
                          disabled={deletingId === layout.id}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Delete layout"
                        >
                          {deletingId === layout.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {layout.background_image_url && (
                      <div className="mt-2.5 rounded-lg overflow-hidden h-20 bg-gray-200">
                        <img src={layout.background_image_url} alt="" className="w-full h-full object-cover opacity-70" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showExportOptions && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Export Options</h2>
              <button onClick={() => setShowExportOptions(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Layout Sheet Format
                </label>
                <select
                  value={exportOptions.layoutFormat}
                  onChange={e => {
                    const format = e.target.value as ExportOptions['layoutFormat'];
                    setExportOptions(prev => {
                      const next = { ...prev, layoutFormat: format };
                      if (format === 'tri-view-a1' || format === 'multi-view') {
                        next.includeSitePlan = true;
                        next.includeSectionView = true;
                        next.include3DView = true;
                        next.includeBOM = true;
                        next.includeLegend = true;
                      } else if (format === 'plan-section') {
                        next.includeSitePlan = true;
                        next.includeSectionView = true;
                        next.include3DView = false;
                        next.includeBOM = true;
                        next.includeLegend = true;
                      } else if (format === 'pure-section') {
                        next.includeSitePlan = false;
                        next.includeSectionView = true;
                        next.include3DView = false;
                        next.includeBOM = true;
                        next.includeLegend = false;
                      } else if (format === 'pure-2d') {
                        next.includeSitePlan = true;
                        next.includeSectionView = false;
                        next.include3DView = false;
                      } else if (format === 'pure-3d') {
                        next.includeSitePlan = false;
                        next.includeSectionView = false;
                        next.include3DView = true;
                        next.includeBOM = false;
                        next.includeLegend = false;
                      } else if (format === 'combined') {
                        next.includeSitePlan = true;
                        next.includeSectionView = false;
                        next.include3DView = show3D;
                        next.includeBOM = true;
                        next.includeLegend = true;
                      }
                      return next;
                    });
                  }}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border"
                >
                  <option value="tri-view-a1">Civil Engineering Tri-View (A1) — 2D + 3D + Full Section + Tech Data</option>
                  <option value="multi-view">Multi-View Master (A-103) — Plan + Section + 3D + BOM</option>
                  <option value="plan-section">Plan + Section Profile (A-104) — Plan + Section + BOM</option>
                  <option value="pure-section">Cross-Section Blueprint (A-105) — Pure Section Profile</option>
                  <option value="combined">Combined Sheet (A-100) — 2D + 3D + BOM</option>
                  <option value="pure-2d">Pure 2D Floor Plan (A-101) — Blueprint layout</option>
                  <option value="pure-3d">Pure 3D Perspective (A-102) — Full-bleed 3D render</option>
                </select>
              </div>
              
              {(exportOptions.layoutFormat === 'combined' || exportOptions.layoutFormat === 'pure-2d') && (
                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="exportWindowMode"
                      checked={exportWindowMode}
                      onChange={e => setExportWindowMode(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                    />
                    <label htmlFor="exportWindowMode" className="text-sm text-gray-700">
                      Select export window area (like AutoCAD)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeBlueprint"
                      checked={exportOptions.includeBlueprint}
                      onChange={e => setExportOptions(prev => ({ ...prev, includeBlueprint: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                    />
                    <label htmlFor="includeBlueprint" className="text-sm text-gray-700">
                      Include blueprint in export
                    </label>
                  </div>
                </div>
              )}

              {/* Contextual requirement banner */}
              {exportOptions.layoutFormat === 'pure-2d' && (
                <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${
                  show3D ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-green-50 border border-green-300 text-green-800'
                }`}>
                  <span className="mt-0.5">{show3D ? '⚠️' : '✅'}</span>
                  <span>
                    {show3D
                      ? 'You are currently in 3D view. Switch back to the 2D canvas before generating to capture the floor plan.'
                      : 'Ready — 2D canvas is active. This will export the full floor plan with BOM and legend.'}
                  </span>
                </div>
              )}
              {exportOptions.layoutFormat === 'pure-3d' && (
                <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${
                  show3D ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-amber-50 border border-amber-300 text-amber-800'
                }`}>
                  <span className="mt-0.5">{show3D ? '✅' : '⚠️'}</span>
                  <span>
                    {show3D
                      ? 'Ready — 3D view is active. This will export a full-bleed 3D perspective with floating BOM.'
                      : 'Switch to 3D view mode first (toggle the 3D button in the toolbar) to capture a perspective render.'}
                  </span>
                </div>
              )}
              {exportOptions.layoutFormat === 'tri-view-a1' && (
                <div className="rounded-md px-3 py-2 text-xs flex items-start gap-2 bg-blue-50 border border-blue-300 text-blue-800">
                  <span className="mt-0.5">✅</span>
                  <span>
                    Ready — Sheet A1 will generate with the Civil Engineering arrangement: 2D Plan View, 3D Isometric View, full-width Ground Profile Section A-A, Legend, Technical Data bar, and Title Block.
                  </span>
                </div>
              )}
              {exportOptions.layoutFormat === 'multi-view' && (
                <div className="rounded-md px-3 py-2 text-xs flex items-start gap-2 bg-blue-50 border border-blue-300 text-blue-800">
                  <span className="mt-0.5">✅</span>
                  <span>
                    Ready — Sheet A-103 will generate with all views: 2D Plan Grid, Hydraulic Section Profile, 3D Isometric View, and Bill of Materials.
                  </span>
                </div>
              )}
              {exportOptions.layoutFormat === 'combined' && (
                <div className="rounded-md px-3 py-2 text-xs flex items-start gap-2 bg-blue-50 border border-blue-300 text-blue-800">
                  <span className="mt-0.5">✅</span>
                  <span>
                    Ready — Combined Sheet (A-100) will include the 2D floor plan, 3D perspective thumbnail, BOM, and legend.
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExportOptions(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Generate Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {showDrawingPreview && drawingExportData && (() => {
        const activeLegendItems: string[] = [];
        if (results.headers > 0) activeLegendItems.push('HEADER PIPES');
        if (results.wellpoints > 0) activeLegendItems.push('WELL POINTS');
        if (results.pumps > 0) activeLegendItems.push('DEWATERING PUMPS');
        if (results.elbows > 0) activeLegendItems.push('ELBOW CONNECTORS');
        if (results.tees > 0) activeLegendItems.push('TEE CONNECTORS');
        if (hoses.some(h => h.kind === 'suction' || h.kind === 'hose')) activeLegendItems.push('SUCTION HOSES');
        if (hoses.some(h => h.kind === 'discharge')) activeLegendItems.push('DISCHARGE HOSES');
        if (areas.some(a => a.kind === 'excavation')) activeLegendItems.push('EXCAVATION AREA');
        if (areas.some(a => a.kind === 'boundary' || !a.kind)) activeLegendItems.push('SITE BOUNDARY');

        return (
          <DrawingSheetPreview
            onClose={() => setShowDrawingPreview(false)}
            layoutName={currentLayoutName || 'Untitled Dewatering Layout'}
            companyInfo={drawingExportData.companyInfo}
            logoSrc={drawingExportData.logoSrc}
            sitePlanDataUrl={drawingExportData.sitePlanDataUrl}
            perspectiveDataUrl={drawingExportData.perspectiveDataUrl}
            bomResults={results}
            dateStr={drawingExportData.dateStr}
            exportOptions={exportOptions}
            onExportOptionsChange={setExportOptions}
            activeLegendItems={activeLegendItems}
            calculatorInputs={getEffectiveCalculatorInputs()}
            calculationResult={results ? calculateDewatering(getEffectiveCalculatorInputs()) : null}
          />
        );
      })()}

      {/* ── Offline Draft Auto-Recovery Modal ── */}
      {showRestorePrompt && pendingDraft && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <RotateCcw className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Resume Unsaved Drawing?
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              We detected an unsaved drawing session auto-saved offline on this device. Would you like to restore where you left off or start fresh?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Drawing Name:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                  {pendingDraft.draft.name || 'Untitled Drawing'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Placed Items:</span>
                <span className="font-semibold text-blue-600">
                  {pendingDraft.draft.itemCount} items
                </span>
              </div>
              {pendingDraft.draft.savedAt && (
                <div className="flex justify-between text-slate-600">
                  <span>Last Auto-Saved:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(pendingDraft.draft.savedAt).toLocaleDateString()} at{' '}
                    {new Date(pendingDraft.draft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {pendingDraft.draft.hasBlueprintImage && (
                <div className="flex justify-between text-slate-600">
                  <span>Blueprint Underlay:</span>
                  <span className="text-emerald-600 font-semibold">Included</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Discard & Start Fresh
              </button>
              <button
                type="button"
                onClick={() => handleApplyRestoredDraft(pendingDraft.draft, pendingDraft.blob)}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Drawing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Dewatering Blueprint Assistant Wizard ── */}
      <AiDewateringWizard
        isOpen={showAiWizard || isAiTracing}
        onClose={() => setShowAiWizard(false)}
        blueprintUrl={backgroundImage}
        onUploadBlueprint={() => fileInputRef.current?.click()}
        onStartScaleCalibration={handleStartReferenceScale}
        scalePixelsPerMeter={PIXELS_PER_METER * (blueprintSettings.scaleX || 1)}
        existingAreas={areas}
        onApplyGeneratedLayout={handleApplyAiGeneratedLayout}
        onStartTracingBoundary={handleStartAiTracing}
        isTracingActive={isAiTracing}
        tracedPoints={aiTracedPoints}
        onCancelTracing={handleCancelAiTracing}
      />
    </div>
  );
};
