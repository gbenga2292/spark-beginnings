import React, { useState, useMemo, useRef, useEffect } from 'react';
import logoSrc from '../../logo/logo-2.png';
import { Upload, Save, FolderOpen, Loader2, X, Trash2, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { DewateringCanvas } from '../components/canvas/DewateringCanvas';
import { Dewatering3DView } from '../components/canvas/Dewatering3DView';
import { ResultsPanel } from '../components/canvas/ResultsPanel';
import { Toolbar, ActiveTool } from '../components/canvas/Toolbar';
import { DrawingSheetPreview, ExportOptions } from '../components/canvas/DrawingSheetPreview';
import { calculateBOM, LineData, PlacedComponent, DimensionData, AreaData, HoseData, ElevationLevel } from '../utils/simulationLogic';
import { captureKonvaStage, captureThreeCanvas } from '../utils/drawingExportUtils';
import { useSetPageTitle } from '../contexts/PageContext';
import { db } from '../lib/supabaseService';
import { useUserStore } from '../store/userStore';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

interface SavedLayout {
  id: string;
  name: string;
  lines: LineData[];
  components: PlacedComponent[];
  dimensions?: DimensionData[];
  areas?: AreaData[];
  hoses?: HoseData[];
  levels?: ElevationLevel[];
  background_image_url: string | null;
  created_at: string;
}

export default function Simulator() {
  const [lines, setLines] = useState<LineData[]>([]);
  const [placedComponents, setPlacedComponents] = useState<PlacedComponent[]>([]);
  const [dimensions, setDimensions] = useState<DimensionData[]>([]);
  const [areas, setAreas] = useState<AreaData[]>([]);
  const [hoses, setHoses] = useState<HoseData[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>('line');
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [history, setHistory] = useState<{ type: 'line' | 'component' | 'dimension' | 'area' | 'hose'; id: string }[]>([]);
  const [lineLengthMeters, setLineLengthMeters] = useState<number | ''>('');
  
  // Elevation Levels
  const [levels, setLevels] = useState<ElevationLevel[]>([
    { id: 'gl-level', name: 'Ground Level (GL)', depthFromGL: 0, wellpointDepth: 6 }
  ]);
  const [activeLevelId, setActiveLevelId] = useState<string>('gl-level');

  // Dewatering Level Settings
  const [groundElevation, setGroundElevation] = useState<number>(0);
  const [targetDepth, setTargetDepth] = useState<number>(5);
  const [screenLength, setScreenLength] = useState<number>(2);
  const [showWellpoints, setShowWellpoints] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [orthoLocked, setOrthoLocked] = useState(false);
  const [gridSnap, setGridSnap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResults, setShowResults] = useState(window.innerWidth >= 640);
  const [show3D, setShow3D] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [currentLayoutName, setCurrentLayoutName] = useState('');

  // Drawing Export State
  const stageRef = useRef<any>(null);
  const [showDrawingPreview, setShowDrawingPreview] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeSitePlan: true,
    include3DView: true,
    includeBOM: true,
    includeLegend: true,
  });
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
    }
  };

  const handleSaveLayout = async () => {
    const user = useUserStore.getState().getCurrentUser();
    if (!user) {
      toast.error('You must be logged in to save.');
      return;
    }
    if (!saveName.trim()) {
      toast.error('Please enter a name for the layout.');
      return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = backgroundImage && !backgroundImage.startsWith('blob:') ? backgroundImage : null;

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

      await db.saveDewateringLayout({
        user_id: user.id,
        name: saveName.trim(),
        lines,
        components: placedComponents,
        dimensions,
        areas,
        hoses,
        levels,
        background_image_url: finalImageUrl
      });
      toast.success(`Layout "${saveName.trim()}" saved successfully.`);
      setCurrentLayoutName(saveName.trim());
      setShowSaveDialog(false);
      setSaveName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save layout.');
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
    if (layout.levels && layout.levels.length > 0) {
      setLevels(layout.levels);
      setActiveLevelId(layout.levels[0].id);
    }
    setBackgroundImage(layout.background_image_url || undefined);
    setBackgroundFile(null);
    setHistory([]);
    setShowLoadPanel(false);
    setCurrentLayoutName(layout.name);
    toast.success(`Loaded layout "${layout.name}".`);
  };

  const handleDeleteLayout = async (id: string, name: string) => {
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
    setShowExportOptions(true);
  };

  const confirmExport = async () => {
    setShowExportOptions(false);
    const sitePlanUrl = captureKonvaStage(stageRef);
    if (!sitePlanUrl) {
      toast.error('Failed to capture the site plan drawing.');
      return;
    }
    
    let perspectiveUrl: string | null = null;
    if (show3D && exportOptions.include3DView) {
      perspectiveUrl = captureThreeCanvas();
      if (!perspectiveUrl) {
        toast.warning('Failed to capture 3D view. Continuing without it.');
      }
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
      sitePlanDataUrl: sitePlanUrl,
      perspectiveDataUrl: perspectiveUrl,
      companyInfo,
      logoSrc,
      dateStr: new Date().toLocaleDateString(),
    });
    setShowDrawingPreview(true);
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
        onClick={() => { setSaveName(''); setShowSaveDialog(true); }} 
        disabled={isSaving}
        className="flex items-center justify-center px-4 py-2 bg-green-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="w-4 h-4 mr-2" />
        <span>Save</span>
      </button>
      <button 
        onClick={handleOpenLoadPanel}
        className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        <span>Load</span>
      </button>
    </div>
  );

  const handleClear = () => {
    setLines([]);
    setPlacedComponents([]);
    setDimensions([]);
    setAreas([]);
    setHoses([]);
    setHistory([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    if (lastAction.type === 'line') {
      setLines(lines.filter(l => l.id !== lastAction.id));
    } else if (lastAction.type === 'dimension') {
      setDimensions(dimensions.filter(d => d.id !== lastAction.id));
    } else if (lastAction.type === 'area') {
      setAreas(areas.filter(a => a.id !== lastAction.id));
    } else if (lastAction.type === 'hose') {
      setHoses(hoses.filter(h => h.id !== lastAction.id));
    } else {
      setPlacedComponents(placedComponents.filter(c => c.id !== lastAction.id));
    }
    setHistory(history.slice(0, -1));
  };

  const handleLinesChange = (newLines: LineData[]) => {
    if (newLines.length > lines.length) {
      const newLine = newLines[newLines.length - 1];
      if (newLine.id !== 'current') {
        setHistory([...history, { type: 'line', id: newLine.id }]);
      }
    }
    setLines(newLines);
  };

  const handleComponentsChange = (newComps: PlacedComponent[]) => {
    if (newComps.length > placedComponents.length) {
      const newComp = newComps[newComps.length - 1];
      setHistory([...history, { type: 'component', id: newComp.id }]);
    }
    setPlacedComponents(newComps);
  };

  const handleDimensionsChange = (newDims: DimensionData[]) => {
    if (newDims.length > dimensions.length) {
      const newDim = newDims[newDims.length - 1];
      setHistory([...history, { type: 'dimension', id: newDim.id }]);
    }
    setDimensions(newDims);
  };

  const handleAreasChange = (newAreas: AreaData[]) => {
    if (newAreas.length > areas.length) {
      const newArea = newAreas[newAreas.length - 1];
      setHistory([...history, { type: 'area', id: newArea.id }]);
    }
    setAreas(newAreas);
  };

  const handleHosesChange = (newHoses: HoseData[]) => {
    if (newHoses.length > hoses.length) {
      const newHose = newHoses[newHoses.length - 1];
      if (newHose.id !== 'current') {
        setHistory([...history, { type: 'hose', id: newHose.id }]);
      }
    }
    setHoses(newHoses);
  };

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-gray-100 flex flex-col overflow-hidden" : "absolute inset-0 flex flex-col bg-gray-100 overflow-hidden"}>
      {/* Top Toolbar Ribbon */}
      <div className="flex-shrink-0 z-10 w-full">
        <Toolbar 
          activeTool={activeTool} 
          onToolSelect={setActiveTool} 
          onUndo={handleUndo} 
          showWellpoints={showWellpoints}
          onToggleWellpoints={() => setShowWellpoints(!showWellpoints)}
          orthoLocked={orthoLocked}
          onToggleOrtho={() => setOrthoLocked(!orthoLocked)}
          gridSnap={gridSnap}
          onToggleGridSnap={() => setGridSnap(!gridSnap)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          show3D={show3D}
          onToggle3D={() => setShow3D(!show3D)}
          onExportDrawing={handleExportDrawing}
        />
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#e5e7eb] overflow-hidden relative">
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
            />
          ) : (
            <>
              <DewateringCanvas
              stageRef={stageRef}
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
              activeTool={activeTool}
              onToolSelect={setActiveTool}
              backgroundImageUrl={backgroundImage}
              fixedLineLengthMeters={lineLengthMeters === '' ? undefined : lineLengthMeters}
              showWellpoints={showWellpoints}
              orthoLocked={orthoLocked}
              gridSnap={gridSnap}
              levels={levels}
              activeLevelId={activeLevelId}
              onSelectLevel={setActiveLevelId}
              onAddLevel={(lvl) => setLevels(prev => [...prev, lvl])}
              onUpdateLevel={(id, updates) => setLevels(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onDeleteLevel={(id) => setLevels(prev => prev.filter(l => l.id !== id))}
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
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteLayout(layout.id, layout.name); }}
                        disabled={deletingId === layout.id}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Delete layout"
                      >
                        {deletingId === layout.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
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
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSitePlan}
                  onChange={e => setExportOptions(prev => ({ ...prev, includeSitePlan: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Include Site Plan (2D)</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.include3DView}
                  onChange={e => setExportOptions(prev => ({ ...prev, include3DView: e.target.checked }))}
                  disabled={!show3D}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className={`text-sm ${show3D ? 'text-gray-700' : 'text-gray-400'}`}>
                  Include 3D Perspective (requires 3D view active)
                </span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeBOM}
                  onChange={e => setExportOptions(prev => ({ ...prev, includeBOM: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Include Bill of Materials</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions.includeLegend}
                  onChange={e => setExportOptions(prev => ({ ...prev, includeLegend: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Include Legend</span>
              </label>
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
                disabled={!exportOptions.includeSitePlan && !exportOptions.include3DView && !exportOptions.includeBOM && !exportOptions.includeLegend}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Generate Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {showDrawingPreview && drawingExportData && (
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
        />
      )}
    </div>
  );
};
