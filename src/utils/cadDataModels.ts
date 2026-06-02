export interface CADLayer {
  id: string;
  name: string;
  color: string;
  lineType: 'solid' | 'dashed' | 'dotted';
  lineWeight: number;
  visible: boolean;
  locked: boolean;
}

export type CADEntityType = 
  | 'line' 
  | 'polyline' 
  | 'hose_suction' 
  | 'hose_discharge' 
  | 'area_site' 
  | 'area_excavation' 
  | 'area_discharge' 
  | 'dimension' 
  | 'component_pump' 
  | 'component_tee' 
  | 'component_elbow';

export interface Point {
  x: number;
  y: number;
}

export interface CADEntity {
  id: string;
  type: CADEntityType;
  layerId: string;
  levelId?: string; // For 3D elevation
  locked?: boolean;
  
  // Specific data based on entity type
  points?: Point[]; // For lines, polylines, hoses
  x?: number; // For components, areas
  y?: number; // For components, areas
  width?: number; // For areas
  height?: number; // For areas
  
  // Overrides for layer properties (optional)
  color?: string;
  lineWeight?: number;
  
  // Dimensions
  text?: string;
  start?: Point;
  end?: Point;
  
  // Dewatering specific
  depthFromGL?: number;
}

export const DEFAULT_LAYERS: CADLayer[] = [
  { id: 'layer-0', name: '0', color: '#000000', lineType: 'solid', lineWeight: 1, visible: true, locked: false },
  { id: 'layer-headers', name: 'Header Pipes', color: '#0369a1', lineType: 'solid', lineWeight: 2, visible: true, locked: false },
  { id: 'layer-suction', name: 'Suction Hoses', color: '#eab308', lineType: 'solid', lineWeight: 2, visible: true, locked: false },
  { id: 'layer-discharge', name: 'Discharge Hoses', color: '#f97316', lineType: 'solid', lineWeight: 2, visible: true, locked: false },
  { id: 'layer-areas', name: 'Areas', color: '#ef4444', lineType: 'dashed', lineWeight: 1, visible: true, locked: false },
  { id: 'layer-components', name: 'Components', color: '#0ea5e9', lineType: 'solid', lineWeight: 1, visible: true, locked: false },
  { id: 'layer-dimensions', name: 'Dimensions', color: '#64748b', lineType: 'solid', lineWeight: 1, visible: true, locked: false },
];
