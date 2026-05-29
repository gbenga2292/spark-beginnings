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
  locked?: boolean;
  zIndex?: number;
}

export interface DimensionData {
  id: string;
  start: Point;
  end: Point;
  text: string;
}

export interface AreaData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind?: string;
  levelId?: string; // Links this area to a specific elevation level
  locked?: boolean;
  zIndex?: number;
}

export interface HoseData {
  id: string;
  points: Point[];
}

export type ComponentType = 'pump' | 'tee' | 'elbow';

export interface PlacedComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  levelId?: string; // Links this component to a specific elevation level
}

export interface DewateringSimulationResult {
  headers: number;
  pumps: number;
  wellpoints: number;
  connectors: number;
  clips: number;
  elbows: number;
  tees: number;
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
  scalePxPerMeter: number = PIXELS_PER_METER
): DewateringSimulationResult {
  let totalLengthPx = 0;
  let elbows = 0;
  
  const allPoints: Point[] = [];
  
  lines.forEach(line => {
    if (line.points.length < 2) return;
    
    // Add internal elbows for this line
    elbows += Math.max(0, line.points.length - 2);
    
    for (let i = 0; i < line.points.length - 1; i++) {
      totalLengthPx += calculateDistance(line.points[i], line.points[i + 1]);
    }
    
    allPoints.push(...line.points);
  });

  const totalLengthMeters = totalLengthPx / scalePxPerMeter;
  
  // Calculate headers
  let headers = Math.ceil(totalLengthMeters / DEFAULT_HEADER_LENGTH_METERS);
  
  // 1 pump for every 10 headers
  let pumps = Math.ceil(headers / 10);
  
  // 6 wellpoints and 6 connectors per header
  const wellpoints = headers * 6;
  const connectors = headers * 6;
  
  // 2 clips per wellpoint
  const clips = wellpoints * 2;
  
  // Basic Tee calculation: find points that are shared across different lines (or close to each other)
  // To keep it performant for a rough sketch, we just count how many points overlap
  let tees = 0;
  for (let i = 0; i < allPoints.length; i++) {
    let overlapCount = 0;
    for (let j = i + 1; j < allPoints.length; j++) {
      if (Math.abs(allPoints[i].x - allPoints[j].x) < 5 && Math.abs(allPoints[i].y - allPoints[j].y) < 5) {
        overlapCount++;
      }
    }
    if (overlapCount >= 1) { // 3-way connection means at least 2 lines meet at a point (1 overlap)
      tees++;
    }
  }

  // Add manual components
  placedComponents.forEach(comp => {
    if (comp.type === 'pump') pumps++;
    if (comp.type === 'tee') tees++;
    if (comp.type === 'elbow') elbows++;
  });

  return {
    headers,
    pumps,
    wellpoints,
    connectors,
    clips,
    elbows,
    tees,
    totalLengthMeters: Math.round(totalLengthMeters * 100) / 100
  };
}
