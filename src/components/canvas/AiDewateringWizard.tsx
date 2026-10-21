import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sparkles, X, ChevronRight, ChevronLeft, Check, AlertTriangle,
  Ruler, Upload, Layers, MapPin, CornerDownRight, CheckCircle2,
  Sliders, Info, Compass, ShieldAlert, Cpu, ArrowRight
} from 'lucide-react';
import {
  DewateringInput,
  DewateringCalculationResult,
  DewateringLayoutType,
  PipeStockOption,
  OffsetMode,
  PumpSide,
  calculateDewatering,
  DEFAULT_DEWATERING_INPUT,
  getRecommendedPumpSides
} from '../../utils/dewateringCalculator';
import {
  LineData,
  PlacedComponent,
  AreaData,
  HoseData,
  ElevationLevel,
  Point,
  PIXELS_PER_METER
} from '../../utils/simulationLogic';
import { toast } from 'sonner';

export interface AiDewateringWizardProps {
  isOpen: boolean;
  onClose: () => void;
  blueprintUrl?: string | null;
  onUploadBlueprint: () => void;
  onStartScaleCalibration: () => void;
  scalePixelsPerMeter: number;
  existingAreas: AreaData[];
  onApplyGeneratedLayout: (payload: {
    lines: LineData[];
    areas: AreaData[];
    components: PlacedComponent[];
    hoses: HoseData[];
    levels: ElevationLevel[];
    targetDepth: number;
    calculatorInputs: DewateringInput;
    name: string;
  }) => void;
  onStartTracingBoundary: (onComplete: (points: Point[]) => void) => void;
  isTracingActive: boolean;
  tracedPoints: Point[];
  onCancelTracing: () => void;
}

export type WizardStep = 'blueprint' | 'area' | 'engineering' | 'preview';

export const AiDewateringWizard: React.FC<AiDewateringWizardProps> = ({
  isOpen,
  onClose,
  blueprintUrl,
  onUploadBlueprint,
  onStartScaleCalibration,
  scalePixelsPerMeter,
  existingAreas,
  onApplyGeneratedLayout,
  onStartTracingBoundary,
  isTracingActive,
  tracedPoints,
  onCancelTracing,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('blueprint');

  // Excavation area parameters
  const [pitLength, setPitLength] = useState<number>(18);
  const [pitWidth, setPitWidth] = useState<number>(12);
  const [siteLength, setSiteLength] = useState<number>(40);
  const [siteWidth, setSiteWidth] = useState<number>(30);
  const [pitOrigin, setPitOrigin] = useState<Point>({ x: 400, y: 300 });

  // Engineering & Hydraulic inputs
  const [inputs, setInputs] = useState<DewateringInput>({
    ...DEFAULT_DEWATERING_INPUT,
    landLength: 40,
    landWidth: 30,
    excavationLength: 18,
    excavationWidth: 12,
    excavationDepth: 4.5,
    waterTableDepth: 1.2,
    requiredDrawdown: 0.5,
    layoutType: 'ring',
    pipeStock: 'all',
    offsetMode: 'auto',
    manualOffset: 1.0,
    minOffset: 0.75,
    ingressRequired: false,
    ingressWidth: 6.0,
    ingressSide: 'south',
    dischargeDirection: 'east',
  });

  // Synchronize dimensional inputs
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      landLength: siteLength,
      landWidth: siteWidth,
      excavationLength: pitLength,
      excavationWidth: pitWidth,
    }));
  }, [pitLength, pitWidth, siteLength, siteWidth]);

  // When polygon points are received from interactive tracing
  const handlePolygonReceived = useCallback((points: Point[]) => {
    if (points.length < 3) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const pxW = Math.max(20, maxX - minX);
    const pxH = Math.max(20, maxY - minY);
    const scale = scalePixelsPerMeter > 0 ? scalePixelsPerMeter : PIXELS_PER_METER;
    const calcL = Number((pxW / scale).toFixed(1));
    const calcW = Number((pxH / scale).toFixed(1));

    setPitLength(Math.max(2, calcL));
    setPitWidth(Math.max(2, calcW));
    setPitOrigin({ x: Math.round(minX), y: Math.round(minY) });
    setSiteLength(Math.max(Math.round(calcL * 1.6), calcL + 12));
    setSiteWidth(Math.max(Math.round(calcW * 1.6), calcW + 12));

    toast.success(`Traced Excavation Pit: ${calcL}m × ${calcW}m`);
    setCurrentStep('engineering');
  }, [scalePixelsPerMeter]);

  // Start canvas tracing
  const handleTriggerCanvasTracing = () => {
    onStartTracingBoundary(handlePolygonReceived);
  };

  // Check for pre-existing pit areas on canvas
  const existingPitArea = useMemo(() => {
    return existingAreas.find(a => a.kind === 'pit') || existingAreas[0];
  }, [existingAreas]);

  const handleUseExistingArea = () => {
    if (!existingPitArea) return;
    const scale = scalePixelsPerMeter > 0 ? scalePixelsPerMeter : PIXELS_PER_METER;
    const calcL = Number(((existingPitArea.width || 120) / scale).toFixed(1));
    const calcW = Number(((existingPitArea.height || 120) / scale).toFixed(1));

    setPitLength(Math.max(2, calcL));
    setPitWidth(Math.max(2, calcW));
    setPitOrigin({ x: Math.round(existingPitArea.x), y: Math.round(existingPitArea.y) });
    setSiteLength(Math.max(Math.round(calcL * 1.6), calcL + 12));
    setSiteWidth(Math.max(Math.round(calcW * 1.6), calcW + 12));

    toast.success(`Loaded Excavation Area: ${calcL}m × ${calcW}m`);
    setCurrentStep('engineering');
  };

  // Run calculation
  const calculationResult: DewateringCalculationResult | null = useMemo(() => {
    return calculateDewatering(inputs);
  }, [inputs]);

  // Generate layout payload
  const handleGenerateAndApply = () => {
    if (!calculationResult || calculationResult.status === 'ERROR') {
      toast.error(calculationResult?.errorMessage || 'Invalid dewatering configuration');
      return;
    }

    const scale = scalePixelsPerMeter > 0 ? scalePixelsPerMeter : PIXELS_PER_METER;
    const L = inputs.excavationLength;
    const W = inputs.excavationWidth;
    const depth = inputs.excavationDepth;
    const layout = inputs.layoutType || 'ring';
    const ingressRequired = inputs.ingressRequired;
    const ingressWidth = inputs.ingressWidth || 6.0;
    const ingressSide = inputs.ingressSide || 'south';
    const offset = calculationResult.designOffset;

    // Dimensions in canvas pixels
    const pitPxW = Math.round(L * scale);
    const pitPxH = Math.round(W * scale);
    const sitePxW = Math.round(inputs.landLength * scale);
    const sitePxH = Math.round(inputs.landWidth * scale);

    const pitX = pitOrigin.x;
    const pitY = pitOrigin.y;

    // Site boundary area centered around pit
    const siteX = Math.round(pitX - (sitePxW - pitPxW) / 2);
    const siteY = Math.round(pitY - (sitePxH - pitPxH) / 2);

    const siteArea: AreaData = {
      id: `site-area-${Date.now()}`,
      x: siteX,
      y: siteY,
      width: sitePxW,
      height: sitePxH,
      kind: 'site',
      layerId: 'layer-areas',
    };

    const pitArea: AreaData = {
      id: `pit-area-${Date.now()}`,
      x: pitX,
      y: pitY,
      width: pitPxW,
      height: pitPxH,
      kind: 'pit',
      layerId: 'layer-areas',
    };

    // Header Ring geometry offset around pit
    const ringX = Math.round(pitX - offset * scale);
    const ringY = Math.round(pitY - offset * scale);
    const ringW = Math.round(pitPxW + 2 * offset * scale);
    const ringH = Math.round(pitPxH + 2 * offset * scale);
    const botY = ringY + ringH;

    const glLevel: ElevationLevel = {
      id: `gl-level-${Date.now()}`,
      name: 'Ground Level (GL)',
      depthFromGL: 0,
      wellpointDepth: depth + 2,
    };

    const pitLevel: ElevationLevel = {
      id: `pit-formation-${Date.now()}`,
      name: `Excavation Pit (-${depth.toFixed(1)}m)`,
      depthFromGL: depth,
      wellpointDepth: depth + 2,
    };

    // Construct ring points with ingress gap if specified
    let ringPoints: Point[] = [];
    const ingressPx = Math.round(ingressWidth * scale);

    if (layout === 'ring') {
      if (ingressRequired && ingressWidth > 0) {
        if (ingressSide === 'south') {
          const ingressLeft = ringX + ringW - ingressPx;
          ringPoints = [
            { x: ingressLeft, y: botY },
            { x: ringX + ringW, y: botY },
            { x: ringX + ringW, y: ringY },
            { x: ringX, y: ringY },
            { x: ringX, y: botY },
            { x: ringX + ringW - ingressPx - 10, y: botY },
          ];
        } else if (ingressSide === 'north') {
          const ingressLeft = ringX + ingressPx;
          ringPoints = [
            { x: ingressLeft, y: ringY },
            { x: ringX + ringW, y: ringY },
            { x: ringX + ringW, y: botY },
            { x: ringX, y: botY },
            { x: ringX, y: ringY },
            { x: ringX + 10, y: ringY },
          ];
        } else if (ingressSide === 'east') {
          const ingressTop = ringY + ingressPx;
          ringPoints = [
            { x: ringX + ringW, y: ingressTop },
            { x: ringX + ringW, y: botY },
            { x: ringX, y: botY },
            { x: ringX, y: ringY },
            { x: ringX + ringW, y: ringY },
            { x: ringX + ringW, y: ringY + 10 },
          ];
        } else {
          // west
          const ingressTop = ringY + ingressPx;
          ringPoints = [
            { x: ringX, y: botY },
            { x: ringX + ringW, y: botY },
            { x: ringX + ringW, y: ringY },
            { x: ringX, y: ringY },
            { x: ringX, y: ingressTop },
          ];
        }
      } else {
        ringPoints = [
          { x: ringX, y: ringY },
          { x: ringX + ringW, y: ringY },
          { x: ringX + ringW, y: botY },
          { x: ringX, y: botY },
          { x: ringX, y: ringY },
        ];
      }
    } else if (layout === 'u_shape') {
      ringPoints = [
        { x: ringX, y: botY },
        { x: ringX, y: ringY },
        { x: ringX + ringW, y: ringY },
        { x: ringX + ringW, y: botY },
      ];
    } else if (layout === 'l_shape') {
      ringPoints = [
        { x: ringX + ringW, y: ringY },
        { x: ringX, y: ringY },
        { x: ringX, y: botY },
      ];
    } else {
      // single line
      ringPoints = [
        { x: ringX, y: ringY },
        { x: ringX + ringW, y: ringY },
      ];
    }

    const headerLine: LineData = {
      id: `header-line-${Date.now()}`,
      points: ringPoints,
      levelId: glLevel.id,
      layerId: 'layer-headers',
      wellpointSide: 'left',
    };

    // Calculate pump positions & suction/discharge connections
    const simPumpSides: PumpSide[] = (calculationResult.pumpSides && calculationResult.pumpSides.length > 0)
      ? calculationResult.pumpSides
      : getRecommendedPumpSides(calculationResult.pumps, layout, ingressSide, ingressRequired);

    const pumpComponents: PlacedComponent[] = [];
    const teeComponents: PlacedComponent[] = [];
    const suctionHoses: HoseData[] = [];
    const dischargeHoses: HoseData[] = [];

    const simSideCounts: Record<PumpSide, number> = { north: 0, east: 0, south: 0, west: 0 };
    simPumpSides.forEach(s => { simSideCounts[s] = (simSideCounts[s] || 0) + 1; });
    const simSideCurrentIdx: Record<PumpSide, number> = { north: 0, east: 0, south: 0, west: 0 };

    const dir = inputs.dischargeDirection || 'east';
    const targetEastX = Math.round(siteX + sitePxW + 60);
    const targetWestX = Math.round(siteX - 60);
    const targetNorthY = Math.round(siteY - 60);
    const targetSouthY = Math.round(siteY + sitePxH + 60);

    simPumpSides.forEach((side, idx) => {
      const totalOnSide = simSideCounts[side];
      const idxOnSide = simSideCurrentIdx[side]++;
      const t = totalOnSide === 1 ? 0.5 : (idxOnSide + 1) / (totalOnSide + 1);

      let teeX = ringX + ringW / 2;
      let teeY = ringY;
      let pumpX = teeX + 25;
      let pumpY = ringY - 45;
      let teeRot = 180;
      let suctionPoints: Point[] = [];

      if (side === 'north') {
        teeX = Math.round(ringX + ringW * t);
        teeY = ringY;
        pumpX = teeX + 25;
        pumpY = ringY - 45;
        teeRot = 180;
        suctionPoints = [
          { x: teeX, y: teeY },
          { x: teeX, y: pumpY },
        ];
      } else if (side === 'south') {
        teeX = Math.round(ringX + ringW * t);
        teeY = botY;
        pumpX = teeX + 25;
        pumpY = botY + 45;
        teeRot = 0;
        suctionPoints = [
          { x: teeX, y: teeY },
          { x: teeX, y: pumpY },
        ];
      } else if (side === 'east') {
        teeX = ringX + ringW;
        teeY = Math.round(ringY + ringH * t);
        pumpX = ringX + ringW + 45;
        pumpY = teeY;
        teeRot = 270;
        suctionPoints = [
          { x: teeX, y: teeY },
          { x: pumpX - 20, y: pumpY },
        ];
      } else {
        // west
        teeX = ringX;
        teeY = Math.round(ringY + ringH * t);
        pumpX = ringX - 45;
        pumpY = teeY;
        teeRot = 90;
        suctionPoints = [
          { x: teeX, y: teeY },
          { x: pumpX - 20, y: pumpY },
        ];
      }

      const pumpPortX = pumpX + 20;
      const pumpPortY = pumpY;
      let dischargePoints: Point[] = [];

      if (dir === 'east') {
        if (side === 'west') {
          const corridorY = teeY < (ringY + ringH / 2) ? (ringY - 35) : (botY + 35);
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: pumpPortX, y: corridorY },
            { x: targetEastX, y: corridorY },
          ];
        } else {
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: targetEastX, y: pumpPortY },
          ];
        }
      } else if (dir === 'west') {
        if (side === 'east') {
          const corridorY = teeY < (ringY + ringH / 2) ? (ringY - 35) : (botY + 35);
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: pumpPortX, y: corridorY },
            { x: targetWestX, y: corridorY },
          ];
        } else {
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: targetWestX, y: pumpPortY },
          ];
        }
      } else if (dir === 'north') {
        if (side === 'south') {
          const corridorX = teeX < (ringX + ringW / 2) ? (ringX - 35) : (ringX + ringW + 35);
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: corridorX, y: pumpPortY },
            { x: corridorX, y: targetNorthY },
          ];
        } else {
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: pumpPortX, y: targetNorthY },
          ];
        }
      } else {
        // south
        if (side === 'north') {
          const corridorX = teeX < (ringX + ringW / 2) ? (ringX - 35) : (ringX + ringW + 35);
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: corridorX, y: pumpPortY },
            { x: corridorX, y: targetSouthY },
          ];
        } else {
          dischargePoints = [
            { x: pumpPortX, y: pumpPortY },
            { x: pumpPortX, y: targetSouthY },
          ];
        }
      }

      teeComponents.push({
        id: `tee-${Date.now()}-${idx}`,
        type: 'tee',
        x: teeX,
        y: teeY,
        rotation: teeRot,
        levelId: glLevel.id,
        layerId: 'layer-components',
      });

      pumpComponents.push({
        id: `pump-${Date.now()}-${idx}`,
        type: 'pump',
        x: pumpX,
        y: pumpY,
        rotation: 0,
        flowRate: 150,
        levelId: glLevel.id,
        layerId: 'layer-components',
      });

      suctionHoses.push({
        id: `suction-hose-${Date.now()}-${idx}`,
        points: suctionPoints,
        kind: 'suction',
        levelId: glLevel.id,
        layerId: 'layer-suction',
      });

      dischargeHoses.push({
        id: `discharge-hose-${Date.now()}-${idx}`,
        points: dischargePoints,
        kind: 'discharge',
        levelId: glLevel.id,
        layerId: 'layer-discharge',
      });
    });

    onApplyGeneratedLayout({
      name: `AI Dewatering - ${L}x${W}m Pit (${layout.toUpperCase()})`,
      lines: [headerLine],
      areas: [siteArea, pitArea],
      components: [...pumpComponents, ...teeComponents],
      hoses: [...suctionHoses, ...dischargeHoses],
      levels: [glLevel, pitLevel],
      targetDepth: depth,
      calculatorInputs: inputs,
    });

    onClose();
  };

  // If user is currently tracing polygon directly on the Konva stage, show compact floating prompt HUD
  if (isTracingActive) {
    return (
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 text-xs animate-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span className="font-bold tracking-wide uppercase text-[11px] text-blue-400">Blueprint Tracing</span>
        </div>
        <div className="text-slate-200">
          Click the corners of the excavation pit on the blueprint.
          <span className="ml-2 font-mono font-bold text-amber-400">
            {tracedPoints.length} {tracedPoints.length === 1 ? 'point' : 'points'} placed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {tracedPoints.length >= 3 && (
            <button
              type="button"
              onClick={() => handlePolygonReceived(tracedPoints)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>Finish Boundary</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCancelTracing}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white">AI Dewatering Assistant</h2>
                <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                  CAD Auto-Design
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Design and calculate standard dewatering systems from site blueprints
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            {[
              { id: 'blueprint' as WizardStep, label: '1. Blueprint & Scale', icon: Layers },
              { id: 'area' as WizardStep, label: '2. Dewatering Pit', icon: MapPin },
              { id: 'engineering' as WizardStep, label: '3. Constraints & Ingress', icon: Sliders },
              { id: 'preview' as WizardStep, label: '4. AI Sizing & BOQ', icon: Cpu },
            ].map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isPassed =
                (currentStep === 'area' && idx === 0) ||
                (currentStep === 'engineering' && idx <= 1) ||
                (currentStep === 'preview' && idx <= 2);

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : isPassed
                      ? 'text-slate-800 hover:bg-slate-200/60 font-medium'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-white' : isPassed ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body / Active Step */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* STEP 1: BLUEPRINT & SCALE */}
          {currentStep === 'blueprint' && (
            <div className="space-y-5">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900 text-xs">Site Layout Blueprint Underlay</h4>
                  <p className="text-[11px] text-blue-800/90 leading-relaxed">
                    Import your architectural site plan, geotechnical foundation drawing, or excavation layout.
                    Calibrating a 2-point reference line ensures all wellpoint offsets, pipe lengths, and pump positions match real meters.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Blueprint Status Card */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Blueprint Status</span>
                    {blueprintUrl ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold">
                        <CheckCircle2 size={11} /> Loaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono text-[10px] font-bold">
                        No Underlay
                      </span>
                    )}
                  </div>

                  <p className="text-slate-500 text-[11px]">
                    {blueprintUrl
                      ? 'Blueprint is active in your DewaterCAD canvas workspace.'
                      : 'You can upload an image (PNG, JPG, PDF render) or proceed with a clean CAD coordinate grid.'}
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onUploadBlueprint}
                      className="w-full py-2 px-3 border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Upload size={13} className="text-blue-600" />
                      <span>{blueprintUrl ? 'Change Blueprint Image' : 'Import Blueprint Image'}</span>
                    </button>
                  </div>
                </div>

                {/* Scale Calibration Card */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Scale Calibration</span>
                    <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      1m = {Math.round(scalePixelsPerMeter)}px
                    </span>
                  </div>

                  <p className="text-slate-500 text-[11px]">
                    Accurate civil engineering requires matching drawing pixels to physical meters. Click two known points (e.g. grid spacing or scale bar).
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartScaleCalibration();
                      }}
                      className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Ruler size={13} className="text-blue-600" />
                      <span>Calibrate Scale (2-Point Pick)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DEWATERING PIT BOUNDARY */}
          {currentStep === 'area' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Define Excavation Pit Boundary</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Trace the pit perimeter directly over the blueprint or enter standard site dimensions.
                  </p>
                </div>

                {existingPitArea && (
                  <button
                    type="button"
                    onClick={handleUseExistingArea}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Use Canvas Area</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method A: Interactive Trace on Blueprint */}
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                    <Compass size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs">Trace Pit on Blueprint</h5>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Minimizes the assistant so you can click consecutive boundary points on the blueprint underlay.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerCanvasTracing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <MapPin size={13} />
                    <span>Start Tracing on Canvas</span>
                  </button>
                </div>

                {/* Method B: Enter Pit Dimensions */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <Sliders size={13} className="text-slate-500" />
                    <span>Dimensions (Meters)</span>
                  </h5>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Excavation Length ($L$)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={pitLength}
                          onChange={e => setPitLength(Math.max(1, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                          m
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Excavation Width ($W$)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={pitWidth}
                          onChange={e => setPitWidth(Math.max(1, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                          m
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Site Plot Length ($LL$)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min={pitLength + 2}
                          value={siteLength}
                          onChange={e => setSiteLength(Math.max(pitLength + 2, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                          m
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Site Plot Width ($LW$)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min={pitWidth + 2}
                          value={siteWidth}
                          onChange={e => setSiteWidth(Math.max(pitWidth + 2, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                          m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Calculated Pit Footprint:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {(pitLength * pitWidth).toFixed(1)} m² (Perimeter: {(2 * (pitLength + pitWidth)).toFixed(1)} m)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ENGINEERING CONSTRAINTS & INGRESS */}
          {currentStep === 'engineering' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Depth & Groundwater */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs">Hydraulic Depths</h5>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Excavation Pit Depth
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.2"
                        min="0.5"
                        value={inputs.excavationDepth}
                        onChange={e => setInputs(prev => ({ ...prev, excavationDepth: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">m</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Static Water Table (b.g.l.)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={inputs.waterTableDepth}
                        onChange={e => setInputs(prev => ({ ...prev, waterTableDepth: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">m</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Required Drawdown Below Base
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.2"
                        value={inputs.requiredDrawdown}
                        onChange={e => setInputs(prev => ({ ...prev, requiredDrawdown: parseFloat(e.target.value) || 0.5 }))}
                        className="w-full px-3 py-1.5 font-mono text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">m</span>
                    </div>
                  </div>
                </div>

                {/* System Layout & Pipe Stock */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs">Layout & Pipe Inventory</h5>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Topology Layout
                    </label>
                    <select
                      value={inputs.layoutType || 'ring'}
                      onChange={e => setInputs(prev => ({ ...prev, layoutType: e.target.value as DewateringLayoutType }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                    >
                      <option value="ring">Full Ring (4-sided)</option>
                      <option value="u_shape">U-Shape (3-sided)</option>
                      <option value="l_shape">L-Shape (2-sided cutoff)</option>
                      <option value="single_line">Single Line (1-sided)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Header Pipe Stock
                    </label>
                    <select
                      value={inputs.pipeStock || 'all'}
                      onChange={e => setInputs(prev => ({ ...prev, pipeStock: e.target.value as PipeStockOption }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                    >
                      <option value="all">Modular Mix (6m & 3m headers)</option>
                      <option value="6m_only">6m Headers Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Installation Setback / Offset
                    </label>
                    <select
                      value={inputs.offsetMode || 'auto'}
                      onChange={e => setInputs(prev => ({ ...prev, offsetMode: e.target.value as OffsetMode }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                    >
                      <option value="auto">Auto-Fit (Minimizes pipe cuts)</option>
                      <option value="manual">Manual Setback Distance</option>
                    </select>
                  </div>

                  {inputs.offsetMode === 'manual' && (
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        Manual Setback (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="3.0"
                        value={inputs.manualOffset || 1.0}
                        onChange={e => setInputs(prev => ({ ...prev, manualOffset: parseFloat(e.target.value) || 1.0 }))}
                        className="w-full px-3 py-1 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Ingress Ramp & Discharge Direction */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs">Ingress & Discharge</h5>

                  {/* Ingress Toggle */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-700 text-[11px]">Vehicle Ingress Ramp</span>
                    <input
                      type="checkbox"
                      checked={inputs.ingressRequired}
                      onChange={e => setInputs(prev => ({ ...prev, ingressRequired: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {inputs.ingressRequired && (
                    <div className="space-y-2 p-2 bg-amber-50/60 border border-amber-200 rounded-lg">
                      <div>
                        <label className="block text-[10px] font-semibold text-amber-900 mb-1">
                          Ramp Gap Width (Min 6.0m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="6.0"
                          value={inputs.ingressWidth}
                          onChange={e => setInputs(prev => ({ ...prev, ingressWidth: Math.max(6.0, parseFloat(e.target.value) || 6.0) }))}
                          className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-amber-900 mb-1">
                          Ingress Location Side
                        </label>
                        <select
                          value={inputs.ingressSide || 'south'}
                          onChange={e => setInputs(prev => ({ ...prev, ingressSide: e.target.value as PumpSide }))}
                          className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded font-medium text-slate-800"
                        >
                          <option value="south">South Edge</option>
                          <option value="north">North Edge</option>
                          <option value="east">East Edge</option>
                          <option value="west">West Edge</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Discharge Pipeline Direction
                    </label>
                    <select
                      value={inputs.dischargeDirection || 'east'}
                      onChange={e => setInputs(prev => ({ ...prev, dischargeDirection: e.target.value as PumpSide }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800"
                    >
                      <option value="east">East Boundary</option>
                      <option value="west">West Boundary</option>
                      <option value="north">North Boundary</option>
                      <option value="south">South Boundary</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AI HYDRAULIC SIZING & PREVIEW */}
          {currentStep === 'preview' && (
            <div className="space-y-5">
              {calculationResult && calculationResult.status === 'REQUIRED' ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-emerald-950 text-xs">
                          Feasible Dewatering System Synthesized
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          Target drawdown: <span className="font-bold">{calculationResult.drawdownAmount.toFixed(2)}m</span> (Static WT at {inputs.waterTableDepth.toFixed(1)}m b.g.l. depressed to {calculationResult.targetDepth.toFixed(1)}m b.g.l.)
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full border border-emerald-300">
                      Offset: {calculationResult.designOffset.toFixed(2)}m
                    </span>
                  </div>

                  {/* Sizing Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perimeter Line</span>
                      <span className="block font-mono text-base font-bold text-slate-900 mt-0.5">
                        {calculationResult.loopPerimeter.toFixed(1)} m
                      </span>
                      <span className="text-[10px] text-slate-500">{calculationResult.runs.length} active runs</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wellpoints (Filters)</span>
                      <span className="block font-mono text-base font-bold text-blue-600 mt-0.5">
                        {calculationResult.filters} pts
                      </span>
                      <span className="text-[10px] text-slate-500">1.0 m center-to-center</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modular Pipes</span>
                      <span className="block font-mono text-base font-bold text-slate-900 mt-0.5">
                        {calculationResult.headers6m}x6m + {calculationResult.headers3m}x3m
                      </span>
                      <span className="text-[10px] text-slate-500">Nominal: {calculationResult.finalHeaderLength}m</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vacuum Pumps</span>
                      <span className="block font-mono text-base font-bold text-emerald-600 mt-0.5">
                        {calculationResult.pumps} units
                      </span>
                      <span className="text-[10px] text-slate-500">Cap: {calculationResult.pumps * 150} m³/h</span>
                    </div>
                  </div>

                  {/* Bill of Quantities Preview */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                    <h5 className="font-bold text-slate-800 text-xs">Installation Bill of Quantities (BOQ)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">90° Elbows:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.elbows90} pcs</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Tee Junctions:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.tees} pcs</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">End Caps:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.endCaps} pcs</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Swing Joints:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.swingJoints} pcs</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Bauer Couplings:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.couplings} sets</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Suction Hoses:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.suctionHoses} lines</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Discharge Line:</span>
                        <span className="font-mono font-bold text-slate-900">{calculationResult.dischargeHoseMeters} m</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-slate-50 rounded border border-slate-100">
                        <span className="text-slate-600">Ingress Gap:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {inputs.ingressRequired ? `${inputs.ingressWidth}m (${inputs.ingressSide})` : 'None (Closed Loop)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Offset & Waste Note */}
                  {calculationResult.optimizationNote && (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                      <Info size={14} className="text-blue-600 shrink-0" />
                      <span>{calculationResult.optimizationNote}</span>
                    </div>
                  )}

                  {/* Warning Note if Setback < 0.75m */}
                  {calculationResult.warningMessage && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      <span>{calculationResult.warningMessage}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
                  <ShieldAlert size={24} className="text-amber-600 mx-auto" />
                  <h4 className="font-bold text-amber-950 text-xs">Dewatering Feasibility Check</h4>
                  <p className="text-[11px] text-amber-800 max-w-md mx-auto">
                    {calculationResult?.autoSummary || calculationResult?.errorMessage || 'Water table does not require pumping or excavation dimensions exceed land boundary.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep !== 'blueprint' ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'area') setCurrentStep('blueprint');
                  else if (currentStep === 'engineering') setCurrentStep('area');
                  else if (currentStep === 'preview') setCurrentStep('engineering');
                }}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <ChevronLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep !== 'preview' ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'blueprint') setCurrentStep('area');
                  else if (currentStep === 'area') setCurrentStep('engineering');
                  else if (currentStep === 'engineering') setCurrentStep('preview');
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <span>Continue</span>
                <ChevronRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateAndApply}
                disabled={!calculationResult || calculationResult.status === 'ERROR'}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={14} className="text-emerald-200" />
                <span>Apply Dewatering System to CAD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
