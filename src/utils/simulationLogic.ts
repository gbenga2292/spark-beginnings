export interface Point {
  x: number;
  y: number;
}

export interface ElevationLevel {
  id: string;
  name: string;
  depthFromGL: number; // Positive number, representing depth in meters below GL
  wellpointDepth: number; // Default wellpoint depth for this level
}

export interface LineData {
  id: string;
  points: Point[];
  depthFromGL?: number; // Optional override for depth below Ground Level
  levelId?: string; // Links this line to a specific elevation level
  layerId?: string;
  locked?: boolean;
  zIndex?: number;
  wellpointSide?: 'left' | 'right' | 'both';
  hideLength?: boolean; // Whether to hide the L: ...m label
}

export interface DimensionData {
  id: string;
  start: Point;
  end: Point;
  measuredStart?: Point;
  measuredEnd?: Point;
  text: string;
  layerId?: string;
  x?: number;
  y?: number;
  locked?: boolean;
}

export interface ArrowData {
  id: string;
  start: Point;
  end: Point;
  text?: string;
  layerId?: string;
  locked?: boolean;
}


export interface AreaData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind?: string;
  levelId?: string; // Links this area to a specific elevation level
  layerId?: string;
  locked?: boolean;
  zIndex?: number;
  points?: Point[]; // Optional points for polygon shape
}

export interface TextData {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: string;
  rotation?: number;
  layerId?: string;
  locked?: boolean;
}

export interface BlueprintSettings {
  visible: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

export interface HoseData {
  id: string;
  points: Point[];
  kind?: string;
  levelId?: string;
  layerId?: string;
  locked?: boolean;
  zIndex?: number;
  hideLength?: boolean;
}

export type ComponentType = 'pump' | 'tee' | 'elbow' | 'ingress';

export interface PlacedComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation?: number; // Optional rotation in degrees for directional assets
  levelId?: string; // Links this component to a specific elevation level
  layerId?: string;
}

export interface DewateringSimulationResult {
  headers: number; // total count of headers (headers6m + headers3m)
  headers6m: number;
  headers3m: number;
  pumps: number;
  wellpoints: number; // filters (1.0m c/c along active headers)
  connectors: number; // swing joints (for backwards compatibility)
  clips: number; // couplings / clamps (for backwards compatibility)
  elbows: number;
  tees: number;
  endCaps: number;
  swingJoints: number;
  couplings: number; // quick-release Bauer clamp couplings
  suctionHoses: number;
  dischargeHoseMeters: number;
  totalLengthMeters: number;
}

export const DEFAULT_HEADER_LENGTH_METERS = 6; 
export const PIXELS_PER_METER = 10; // Simple scale factor
export const ENTRANCE_GAP_METERS = 3; 

export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function calculateBOM(
  lines: LineData[], 
  placedComponents: PlacedComponent[] = [],
  scalePxPerMeter: number = PIXELS_PER_METER,
  hoses: HoseData[] = []
): DewateringSimulationResult {
  let totalLengthPx = 0;
  let detectedElbows = 0;
  let isClosedLoop = false;
  
  const allPoints: Point[] = [];
  
  lines.forEach(line => {
    if (line.points.length < 2) return;
    
    // Check if line is a closed ring (first point touches last point)
    const pFirst = line.points[0];
    const pLast = line.points[line.points.length - 1];
    const isRing = line.points.length >= 4 && calculateDistance(pFirst, pLast) < 15;
    if (isRing) isClosedLoop = true;

    // Detect 90° corners / elbows in polylines
    if (isRing) {
      detectedElbows += line.points.length - 1; // e.g. 4-sided ring has 4 corners
    } else {
      detectedElbows += Math.max(0, line.points.length - 2);
    }
    
    for (let i = 0; i < line.points.length - 1; i++) {
      totalLengthPx += calculateDistance(line.points[i], line.points[i + 1]);
    }
    
    allPoints.push(...line.points);
  });

  const totalLengthMeters = Math.round((totalLengthPx / scalePxPerMeter) * 100) / 100;
  
  // Modular 6m & 3m header breakdown (matches Dewatering Calculator breakdownRunLength)
  let headers6m = 0;
  let headers3m = 0;
  if (totalLengthMeters > 0) {
    lines.forEach(line => {
      for (let i = 0; i < line.points.length - 1; i++) {
        const segDistPx = calculateDistance(line.points[i], line.points[i + 1]);
        const segLenM = segDistPx / scalePxPerMeter;
        if (segLenM > 0.5) {
          const needed = Math.ceil(segLenM / 3) * 3;
          const h6 = Math.floor(needed / 6);
          const h3 = (needed % 6 === 3) ? 1 : 0;
          headers6m += h6;
          headers3m += h3;
        }
      }
    });

    if (headers6m === 0 && headers3m === 0 && totalLengthMeters > 0) {
      const needed = Math.ceil(totalLengthMeters / 3) * 3;
      headers6m = Math.floor(needed / 6);
      headers3m = (needed % 6 === 3) ? 1 : 0;
    }
  }

  const totalHeaders = headers6m + headers3m;
  
  // Pumps: 100 m³/hr vacuum pump, max 60m header coverage per pump, min 1 if lines exist
  let calculatedPumps = totalLengthMeters > 0 ? Math.max(1, Math.ceil(totalLengthMeters / 60)) : 0;
  
  // Manual pumps added on canvas
  const manualPumps = placedComponents.filter(c => c.type === 'pump').length;
  const pumps = Math.max(calculatedPumps, manualPumps || (totalLengthMeters > 0 ? 1 : 0));
  
  // Wellpoints / Filters: 1.0m c/c along active line (minimum 4 if system active)
  const wellpoints = totalLengthMeters > 0 ? Math.max(4, Math.ceil(totalLengthMeters / 1.0)) : 0;
  
  // Swing joints: 1 flexible swing arm per wellpoint filter
  const swingJoints = wellpoints;
  const connectors = swingJoints; // alias for backwards compatibility
  
  // Fittings: Elbows & Tees
  const manualElbows = placedComponents.filter(c => c.type === 'elbow').length;
  const elbows = detectedElbows + manualElbows;

  const manualTees = placedComponents.filter(c => c.type === 'tee').length;
  // 1 suction tie-in tee per vacuum pump to tie into line + manual tees
  const tees = (pumps > 0 ? pumps : 0) + manualTees;

  // End Caps: 0 for closed ring, 2 for open linear / U-shape / ingress break
  let endCaps = 0;
  if (totalLengthMeters > 0) {
    endCaps = isClosedLoop ? 0 : 2 * Math.max(1, lines.length);
  }

  // Couplings / Bauer clamps:
  // Pipe-to-pipe joints within runs + (elbows * 2) + (tees * 2) + endCaps + pumps tie-ins
  const pipeToPipeJoints = Math.max(0, totalHeaders - Math.max(1, lines.length));
  const couplings = totalLengthMeters > 0 
    ? pipeToPipeJoints + (elbows * 2) + (tees * 2) + endCaps + pumps
    : 0;
  const clips = couplings; // alias for backwards compatibility

  // Suction Hoses: 1 heavy-duty armored suction hose per pump + drawn suction hoses
  const drawnSuctionHoses = hoses.filter(h => h.kind === 'suction' || h.kind === 'hose').length;
  const suctionHoses = Math.max(pumps, drawnSuctionHoses);

  // Discharge Lines (meters): default ~30m per active pump + length of drawn discharge hoses
  let drawnDischargeLengthMeters = 0;
  hoses.filter(h => h.kind === 'discharge').forEach(h => {
    for (let i = 0; i < h.points.length - 1; i++) {
      drawnDischargeLengthMeters += calculateDistance(h.points[i], h.points[i + 1]) / scalePxPerMeter;
    }
  });
  const dischargeHoseMeters = drawnDischargeLengthMeters > 0 
    ? Math.round(drawnDischargeLengthMeters * 10) / 10 
    : (pumps * 30);

  return {
    headers: totalHeaders,
    headers6m,
    headers3m,
    pumps,
    wellpoints,
    connectors,
    clips,
    elbows,
    tees,
    endCaps,
    swingJoints,
    couplings,
    suctionHoses,
    dischargeHoseMeters,
    totalLengthMeters
  };
}
