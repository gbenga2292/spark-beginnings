import React, { useState, useMemo, useRef, useEffect } from 'react';
import logoSrc from '../../logo/logo-2.png';
import { Upload, Save, FolderOpen, Loader2, X, Trash2, Clock, ChevronRight, ChevronLeft, Ruler } from 'lucide-react';
import { DewateringCanvas } from '../components/canvas/DewateringCanvas';
import { Dewatering3DView } from '../components/canvas/Dewatering3DView';
import { ResultsPanel } from '../components/canvas/ResultsPanel';
import { Toolbar, ActiveTool } from '../components/canvas/Toolbar';
import { StatusBar } from '../components/canvas/StatusBar';
import { DrawingSheetPreview, ExportOptions } from '../components/canvas/DrawingSheetPreview';
import { calculateBOM, LineData, PlacedComponent, DimensionData, AreaData, HoseData, ArrowData, TextData, ElevationLevel, PIXELS_PER_METER } from '../utils/simulationLogic';
import { captureKonvaStage, captureThreeCanvas } from '../utils/drawingExportUtils';
import { useSetPageTitle } from '../contexts/PageContext';
import { db } from '../lib/supabaseService';
import { useUserStore } from '../store/userStore';
import { useAppStore } from '../store/appStore';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { CADLayer, DEFAULT_LAYERS } from '../utils/cadDataModels';
import { usePriv } from '../hooks/usePriv';

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

export default function Simulator() {
  const priv = usePriv('simulator');
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

  const [history, setHistory] = useState<{ type: 'line' | 'component' | 'dimension' | 'area' | 'hose' | 'arrow'; id: string }[]>([]);
  const [redoStack, setRedoStack] = useState<{ type: string; id: string; item: any }[]>([]);
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
  const [showResults, setShowResults] = useState(window.innerWidth >= 640);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [currentLayoutName, setCurrentLayoutName] = useState('');
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

  // Drawing Export State
  const stageRef = useRef<any>(null);
  const [showDrawingPreview, setShowDrawingPreview] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    layoutFormat: 'combined',
    includeSitePlan: true,
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

  const results = useMemo(() => calculateBOM(lines, placedComponents), [lines, placedComponents]);

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
    setHistory([]);
    setShowLoadPanel(false);
    setCurrentLayoutName(layout.name);
    setCurrentLayoutId(layout.id);
    toast.success(`Loaded layout "${layout.name}".`);
    setSimulatorDirty(false);
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

    // ── Pure 2D: capture Konva stage only ──
    if (fmt === 'pure-2d' || fmt === 'combined') {
      if (show3D) {
        // 2D canvas is not mounted when in 3D mode
        toast.error(
          'Please switch back to the 2D canvas view before exporting a 2D Floor Plan.',
          { duration: 4000 }
        );
        return;
      }
      
      if (exportWindowMode) {
        // If window mode, we enter select mode and wait for the user to drag a box.
        setActiveTool('export-window');
        toast.info('Click and drag on the canvas to select the export area.');
        return;
      }
      
      sitePlanUrl = captureKonvaStage(stageRef, undefined, { includeBlueprint: exportOptions.includeBlueprint });
      if (!sitePlanUrl) {
        toast.error('Failed to capture the 2D site plan. Make sure the canvas has content.');
        return;
      }
    }

    // ── Pure 3D: capture Three.js canvas only ──
    if (fmt === 'pure-3d' || fmt === 'combined') {
      if (!show3D && fmt === 'pure-3d') {
        toast.error(
          'Please switch to the 3D view before exporting a 3D Perspective sheet.',
          { duration: 4000 }
        );
        return;
      }
      perspectiveUrl = captureThreeCanvas();
      if (!perspectiveUrl && fmt === 'pure-3d') {
        toast.error('Failed to capture 3D view. Make sure 3D mode is active.');
        return;
      }
    }

    if (!sitePlanUrl && !perspectiveUrl) {
      toast.error('Nothing to export.');
      return;
    }

    await finishExport(sitePlanUrl, perspectiveUrl);
  };

  const finishExport = async (sitePlanUrl: string | null, perspectiveUrl: string | null) => {
    if (!sitePlanUrl && !perspectiveUrl) {
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

  const handleExportWindowSelected = (rect: {x: number, y: number, width: number, height: number}) => {
    setActiveTool('select');
    const fmt = exportOptions.layoutFormat;
    
    let sitePlanUrl: string | null = captureKonvaStage(stageRef, rect, { includeBlueprint: exportOptions.includeBlueprint });
    let perspectiveUrl: string | null = null;
    if (fmt === 'combined') {
      perspectiveUrl = captureThreeCanvas();
    }
    
    finishExport(sitePlanUrl, perspectiveUrl);
  };

  const handleClear = () => {
    setLines([]);
    setPlacedComponents([]);
    setDimensions([]);
    setAreas([]);
    setHoses([]);
    setTexts([]);
    setHistory([]);
    setRedoStack([]);
    setCurrentLayoutId(null);
    setCurrentLayoutName('');
    setSimulatorDirty(false);
  };

  const handleNewLayout = () => {
    if (isSimulatorDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to start a new drawing without saving?")) {
        return;
      }
    }
    handleClear();
  };

  useSetPageTitle(
    'Dewatering Layout Simulator',
    '',
    <div className="flex items-center gap-3">

      <label className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 cursor-pointer">
        <Upload className="w-4 h-4 mr-2" />
        <span>Upload Blueprint</span>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept="image/*"
          onChange={handleImageUpload}
        />
      </label>

      <button 
        onClick={handleNewLayout} 
        className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-gray-700"
      >
        <span>New</span>
      </button>

      {currentLayoutId ? (
        <>
          <button 
            onClick={handleUpdateLayout} 
            disabled={isSaving || !priv.canSave}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            title={!priv.canSave ? "You don't have permission to save layouts" : ""}
          >
            <Save className="w-4 h-4 mr-2" />
            <span>Update</span>
          </button>
          <button 
            onClick={() => { setSaveName(currentLayoutName); setShowSaveDialog(true); }} 
            disabled={isSaving || !priv.canSave}
            className="flex items-center justify-center px-4 py-2 bg-teal-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            title={!priv.canSave ? "You don't have permission to save layouts" : ""}
          >
            <Save className="w-4 h-4 mr-2" />
            <span>Save As</span>
          </button>
        </>
      ) : (
        <button 
          onClick={() => { setSaveName(''); setShowSaveDialog(true); }} 
          disabled={isSaving || !priv.canSave}
          className="flex items-center justify-center px-4 py-2 bg-green-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          title={!priv.canSave ? "You don't have permission to save layouts" : ""}
        >
          <Save className="w-4 h-4 mr-2" />
          <span>Save</span>
        </button>
      )}

      <button 
        onClick={handleOpenLoadPanel}
        className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        <span>Load</span>
      </button>
    </div>
  );

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    let removedItem: any = null;

    if (lastAction.type === 'line') {
      removedItem = lines.find(l => l.id === lastAction.id);
      setLines(prev => prev.filter(l => l.id !== lastAction.id));
    } else if (lastAction.type === 'dimension') {
      removedItem = dimensions.find(d => d.id === lastAction.id);
      setDimensions(prev => prev.filter(d => d.id !== lastAction.id));
    } else if (lastAction.type === 'area') {
      removedItem = areas.find(a => a.id === lastAction.id);
      setAreas(prev => prev.filter(a => a.id !== lastAction.id));
    } else if (lastAction.type === 'hose') {
      removedItem = hoses.find(h => h.id === lastAction.id);
      setHoses(prev => prev.filter(h => h.id !== lastAction.id));
    } else if (lastAction.type === 'arrow') {
      removedItem = arrows.find(a => a.id === lastAction.id);
      setArrows(prev => prev.filter(a => a.id !== lastAction.id));
    } else {
      removedItem = placedComponents.find(c => c.id === lastAction.id);
      setPlacedComponents(prev => prev.filter(c => c.id !== lastAction.id));
    }

    if (removedItem) {
      setRedoStack(prev => [...prev, { type: lastAction.type, id: lastAction.id, item: removedItem }]);
    }
    setHistory(prev => prev.slice(0, -1));
    setSimulatorDirty(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextAction = redoStack[redoStack.length - 1];
    const item = nextAction.item;
    if (!item) {
      setRedoStack(prev => prev.slice(0, -1));
      return;
    }

    if (nextAction.type === 'line') {
      setLines(prev => [...prev, item]);
    } else if (nextAction.type === 'dimension') {
      setDimensions(prev => [...prev, item]);
    } else if (nextAction.type === 'area') {
      setAreas(prev => [...prev, item]);
    } else if (nextAction.type === 'hose') {
      setHoses(prev => [...prev, item]);
    } else if (nextAction.type === 'arrow') {
      setArrows(prev => [...prev, item]);
    } else {
      setPlacedComponents(prev => [...prev, item]);
    }

    setHistory(prev => [...prev, { type: nextAction.type as any, id: nextAction.id }]);
    setRedoStack(prev => prev.slice(0, -1));
    setSimulatorDirty(true);
  };

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
  }, [history, redoStack, lines, placedComponents, dimensions, areas, hoses, arrows]);

  const handleLinesChange = (newLines: LineData[]) => {
    if (newLines.length > lines.length) {
      const newLine = newLines[newLines.length - 1];
      if (newLine.id !== 'current') {
        setHistory([...history, { type: 'line', id: newLine.id }]);
        setRedoStack([]);
      }
    }
    setLines(newLines);
    setSimulatorDirty(true);
  };

  const handleComponentsChange = (newComps: PlacedComponent[]) => {
    if (newComps.length > placedComponents.length) {
      const newComp = newComps[newComps.length - 1];
      setHistory([...history, { type: 'component', id: newComp.id }]);
      setRedoStack([]);
    }
    setPlacedComponents(newComps);
    setSimulatorDirty(true);
  };

  const handleDimensionsChange = (newDims: DimensionData[]) => {
    if (newDims.length > dimensions.length) {
      const newDim = newDims[newDims.length - 1];
      setHistory([...history, { type: 'dimension', id: newDim.id }]);
      setRedoStack([]);
    }
    setDimensions(newDims);
    setSimulatorDirty(true);
  };

  const handleAreasChange = (newAreas: AreaData[]) => {
    if (newAreas.length > areas.length) {
      const newArea = newAreas[newAreas.length - 1];
      setHistory([...history, { type: 'area', id: newArea.id }]);
      setRedoStack([]);
    }
    setAreas(newAreas);
    setSimulatorDirty(true);
  };

  const handleHosesChange = (newHoses: HoseData[]) => {
    if (newHoses.length > hoses.length) {
      const newHose = newHoses[newHoses.length - 1];
      if (newHose.id !== 'current') {
        setHistory([...history, { type: 'hose', id: newHose.id }]);
        setRedoStack([]);
      }
    }
    setHoses(newHoses);
    setSimulatorDirty(true);
  };

  const handleArrowsChange = (newArrows: ArrowData[]) => {
    if (newArrows.length > arrows.length) {
      const newArrow = newArrows[newArrows.length - 1];
      setHistory([...history, { type: 'arrow', id: newArrow.id }]);
      setRedoStack([]);
    }
    setArrows(newArrows);
    setSimulatorDirty(true);
  };

  const handleToolSelect = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (['line', 'hose', 'discharge'].includes(tool)) {
      setOrthoLocked(true);
    }
  };

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-gray-100 flex flex-col overflow-hidden print:overflow-visible print:static print:h-auto" : "absolute inset-0 flex flex-col bg-gray-100 overflow-hidden print:overflow-visible print:static print:h-auto"}>
      {/* Top Toolbar Ribbon */}
      <div className="flex-shrink-0 z-10 w-full">
        <Toolbar 
          activeTool={activeTool} 
          onToolSelect={handleToolSelect} 
          onUndo={handleUndo} 
          onRedo={handleRedo}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0} 
          showWellpoints={showWellpoints}
          onToggleWellpoints={() => setShowWellpoints(!showWellpoints)}
          wellpointSide={
            (selectedCanvasId && lines.find(l => l.id === selectedCanvasId)?.wellpointSide) || wellpointSide
          }
          onToggleWellpointSide={() => {
            if (selectedCanvasId) {
              const line = lines.find(l => l.id === selectedCanvasId);
              if (line) {
                const currentSide = line.wellpointSide || wellpointSide;
                const nextSide = currentSide === 'left' ? 'right' : currentSide === 'right' ? 'both' : 'left';
                handleLinesChange(lines.map(l => l.id === selectedCanvasId ? { ...l, wellpointSide: nextSide } : l));
                return;
              }
            }
            setWellpointSide(prev => prev === 'left' ? 'right' : prev === 'right' ? 'both' : 'left');
          }}
          orthoLocked={orthoLocked}
          onToggleOrtho={() => setOrthoLocked(!orthoLocked)}
          gridSnap={gridSnap}
          onToggleGridSnap={() => setGridSnap(!gridSnap)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          show3D={show3D}
          onToggle3D={() => { setShow3D(!show3D); setSelected3DId(null); }}
          onExportDrawing={handleExportDrawing}
          offsetDistance={offsetDistance}
          onOffsetDistanceChange={setOffsetDistance}
          mirrorCopy={mirrorCopy}
          onMirrorCopyChange={setMirrorCopy}
          drawShapeMode={drawShapeMode}
          onDrawShapeModeChange={setDrawShapeMode}
          textColor={textColor}
          onTextColorChange={setTextColor}
          textSize={textSize}
          onTextSizeChange={setTextSize}
          blueprintSettings={blueprintSettings}
          onUpdateBlueprintSettings={(updates) => setBlueprintSettings(prev => ({ ...prev, ...updates }))}
          hasBlueprint={!!backgroundImage}
          isSettingScale={scaleRefMode !== 'idle'}
          onStartReferenceScale={() => { setScaleRefMode('selecting-start'); setScaleRefPt1(null); setScaleRefPt2(null); setShowScaleModal(false); }}
        />
      </div>

      <div className="flex flex-1 relative overflow-hidden flex-col">
        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#e5e7eb] overflow-hidden relative">
          {activeTool === 'export-window' && (
            <div className="absolute top-0 inset-x-0 z-50 bg-indigo-600 text-white text-center py-1.5 text-sm font-medium shadow-md flex items-center justify-center gap-4">
              <span>Click and drag on the canvas to select the export window area.</span>
              <button 
                onClick={() => setActiveTool('select')} 
                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {show3D ? (
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
            />
          ) : (
            <>
              <DewateringCanvas
              stageRef={stageRef}
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
              onTextsChange={(newTexts) => { setTexts(newTexts); setSimulatorDirty(true); }}
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
              onDeleteLayer={(id) => setLayers(prev => prev.filter(l => l.id !== id))}
              onCursorPosChange={setCursorPos}
              scaleRefMode={scaleRefMode}
              scaleRefPt1={scaleRefPt1}
              scaleRefPt2={scaleRefPt2}
              onSetScaleRefPt1={(pt) => { setScaleRefPt1(pt); setScaleRefMode('selecting-end'); }}
              onSetScaleRefPt2={(pt) => { setScaleRefPt2(pt); setScaleRefMode('idle'); setShowScaleModal(true); setScaleInputStr(''); }}
            />
            </>
          )}
        </div>

        {/* Floating/Collapsible Results Sidebar */}
        <div className={`absolute top-4 right-4 z-20 flex transition-transform duration-300 ${showResults ? 'translate-x-0' : 'translate-x-[calc(100%+16px)]'}`}>
          <button 
            onClick={() => setShowResults(!showResults)}
            className="absolute -left-8 top-2 bg-white border border-gray-200 shadow-md p-1.5 rounded-l-md hover:bg-gray-50"
            title={showResults ? "Hide BOM" : "Show BOM"}
          >
            {showResults ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <div className="shadow-2xl rounded-lg">
            <ResultsPanel
              results={results}
              onClear={handleClear}
            />
          </div>
        </div>

        <StatusBar
          cursorPos={cursorPos}
          activeTool={activeTool}
          gridSnap={gridSnap}
          orthoLocked={orthoLocked}
          osnapEnabled={true}
          activeLayerName={layers.find(l => l.id === activeLayerId)?.name || 'Layer 0'}
          isDirty={isSimulatorDirty}
        />
      </div>

      {/* ── Save Dialog ── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
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
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1 rounded">
                  <Ruler className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Set scale</h2>
              </div>
              <button onClick={() => { setShowScaleModal(false); setScaleRefPt1(null); setScaleRefPt2(null); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-sm">
              <p className="text-gray-700 mb-4">Enter the actual length to calculate the scale.</p>
              
              <div className="flex items-center gap-2 mb-3">
                <label className="text-gray-600 w-28">Measured length:</label>
                <div className="px-2 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded">
                  {(Math.sqrt(Math.pow(scaleRefPt2.x - scaleRefPt1.x, 2) + Math.pow(scaleRefPt2.y - scaleRefPt1.y, 2)) / PIXELS_PER_METER).toFixed(3)}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-6">
                <label className="text-gray-600 w-28">Actual length:</label>
                <input
                  type="number"
                  autoFocus
                  className="flex-1 px-2 py-1 border border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  value={scaleInputStr}
                  onChange={e => setScaleInputStr(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const actualLengthMeters = parseFloat(scaleInputStr);
                      if (isNaN(actualLengthMeters) || actualLengthMeters <= 0) return;
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
                    }
                  }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    const actualLengthMeters = parseFloat(scaleInputStr);
                    if (isNaN(actualLengthMeters) || actualLengthMeters <= 0) return;
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
                  }}
                  disabled={!scaleInputStr || parseFloat(scaleInputStr) <= 0}
                  className="px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-700 bg-white shadow-sm disabled:opacity-50"
                >
                  Ok
                </button>
                <button
                  onClick={() => { setShowScaleModal(false); setScaleRefPt1(null); setScaleRefPt2(null); }}
                  className="px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-700 bg-white shadow-sm"
                >
                  Cancel
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
                <FolderOpen className="w-5 h-5 text-indigo-600" />
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
                    className="group bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl p-4 cursor-pointer transition-all"
                    onClick={() => handleLoadLayout(layout)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900 group-hover:text-indigo-700 truncate transition-colors">
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
                    const format = e.target.value as 'combined' | 'pure-2d' | 'pure-3d';
                    setExportOptions(prev => {
                      const next = { ...prev, layoutFormat: format };
                      // Auto-adjust checkboxes based on selected format for user convenience
                      if (format === 'pure-2d') {
                        next.includeSitePlan = true;
                        next.include3DView = false;
                      } else if (format === 'pure-3d') {
                        next.includeSitePlan = false;
                        next.include3DView = true;
                        next.includeBOM = false;
                        next.includeLegend = false;
                      } else if (format === 'combined') {
                        next.includeSitePlan = true;
                        next.include3DView = show3D;
                        next.includeBOM = true;
                        next.includeLegend = true;
                      }
                      return next;
                    });
                  }}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                >
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
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
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
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
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
              {exportOptions.layoutFormat === 'combined' && (
                <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${
                  show3D ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-blue-50 border border-blue-300 text-blue-800'
                }`}>
                  <span className="mt-0.5">{show3D ? '⚠️' : 'ℹ️'}</span>
                  <span>
                    {show3D
                      ? 'Switch back to 2D canvas view to capture the site plan. The 3D panel will be omitted from this sheet if not captured.'
                      : 'Combined sheet will include the 2D floor plan, BOM, and legend. Enable 3D view first if you also want a perspective thumbnail.'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExportOptions(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
        if (results.tees > 0) activeLegendItems.push('FLUSH CONNECTIONS');
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
          />
        );
      })()}
    </div>
  );
};
