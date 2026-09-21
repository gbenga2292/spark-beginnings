import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Cylinder } from '@react-three/drei';
import { LineData, PlacedComponent, PIXELS_PER_METER, ElevationLevel, Point } from '../../utils/simulationLogic';
import * as THREE from 'three';
import { useTheme } from '../../hooks/useTheme';
import { ViewCube3D } from './ViewCube3D';
import { NavWheel3D } from './NavWheel3D';
import { Compass, RotateCcw, X } from 'lucide-react';
import { ActiveTool } from './Toolbar';

interface Dewatering3DViewProps {
  lines: LineData[];
  placedComponents: PlacedComponent[];
  areas: any[];
  hoses: any[];
  groundElevation: number;
  targetDepth: number;
  screenLength: number;
  levels?: ElevationLevel[];
  wellpointSide?: 'left' | 'right' | 'both';
  // Modify tool integration
  activeTool?: ActiveTool;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  onAreasChange?: (areas: any[]) => void;
  onLinesChange?: (lines: LineData[]) => void;
  onPlacedComponentsChange?: (comps: PlacedComponent[]) => void;
  onHosesChange?: (hoses: any[]) => void;
  resultsOpen?: boolean;
  showNavWheel?: boolean;
  onToggleNavWheel?: () => void;
  view3DApiRef?: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    zoomAll: () => void;
    zoomWindow: () => void;
    resetView: () => void;
  } | null>;
}

// Camera and Controls Bridge component
const CameraController: React.FC<{
  onControlsReady: (camera: THREE.Camera, controls: any) => void;
  activeTool?: ActiveTool;
  layoutCenter: THREE.Vector3;
  layoutSize: THREE.Vector3;
}> = ({ onControlsReady, activeTool, layoutCenter, layoutSize }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const initializedCenterKeyRef = useRef<string | null>(null);

  const centerKey = `${layoutCenter.x.toFixed(1)},${layoutCenter.z.toFixed(1)},${layoutSize.x.toFixed(1)}`;

  useEffect(() => {
    if (controlsRef.current && camera) {
      if (initializedCenterKeyRef.current !== centerKey) {
        initializedCenterKeyRef.current = centerKey;
        const maxDim = Math.max(layoutSize.x, layoutSize.z, layoutSize.y, 8);
        const fov = (camera as THREE.PerspectiveCamera).fov || 45;
        const dist = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5;

        controlsRef.current.target.copy(layoutCenter);
        camera.position.set(
          layoutCenter.x + dist * 0.7,
          layoutCenter.y + dist * 0.55,
          layoutCenter.z + dist * 0.7
        );
        camera.lookAt(layoutCenter);
        controlsRef.current.update();
      }
      onControlsReady(camera, controlsRef.current);
    }
  }, [camera, onControlsReady, layoutCenter, layoutSize, centerKey]);

  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault 
      mouseButtons={{
        LEFT: activeTool === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN
      }}
    />
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// HIGH-FIDELITY 3D ASSETS
// ──────────────────────────────────────────────────────────────────────────────

// Detailed 3D GEHO ZD 900 Double-Acting Dewatering Piston Pump
const GehoPump3D: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* 1. Heavy Black Steel Skid Frame Chassis */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[2.2, 0.15, 1.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* 2. Central Hatz Diesel Engine Case (Premium Wellpoint Green) */}
      <mesh position={[0.2, 0.1, 0]}>
        <boxGeometry args={[1.0, 0.8, 0.8]} />
        <meshStandardMaterial color="#16a34a" roughness={0.4} metalness={0.1} />
      </mesh>
      
      {/* 3. Crankshaft / Piston Drive Box (Dark Metallic Steel) */}
      <mesh position={[-0.4, 0.0, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.9]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* 4. Suction side - Large Silver Vacuum Chamber Dome (Left Pulsation Vessel) */}
      <group position={[-0.7, 0.7, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.8, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* 5. Discharge side - Vertical Silver Pulsation Vessel Dome (Right Pulsation Vessel) */}
      <group position={[0.5, 0.7, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.8, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* 6. Heavy-Duty Steel Lifting Arch / Handle */}
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} />
      </mesh>

      {/* 7. Inlet Suction Port (Left End) with Bauer coupling flange extending to x = -2.0 */}
      <mesh position={[-1.35, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 1.3, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>
      <mesh position={[-2.0, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`suction-bolt-${i}`} position={[-2.02, -0.1 + Math.sin(angle) * 0.095, Math.cos(angle) * 0.095]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        );
      })}

      {/* 8. Discharge Head — Vertical Riser Manifold with smooth bends */}
      {/* 8a. Horizontal stub from pump body to riser base */}
      <mesh position={[0.95, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8b. Smooth 90° Elbow transition at riser base */}
      <mesh>
        <tubeGeometry args={[new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(1.10, -0.1, 0),
          new THREE.Vector3(1.22, -0.1, 0),
          new THREE.Vector3(1.22, 0.02, 0)
        ), 12, 0.075, 12, false]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* 8c. Vertical riser pipe (discharge head column) */}
      <mesh position={[1.22, 0.435, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.83, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8d. Riser reinforcement ring (mid-height) */}
      <mesh position={[1.22, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.02, 8, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 8e. Top 90° Elbow — smooth transition from vertical riser to horizontal discharge */}
      <mesh>
        <tubeGeometry args={[new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(1.22, 0.85, 0),
          new THREE.Vector3(1.22, 0.97, 0),
          new THREE.Vector3(1.34, 0.97, 0)
        ), 12, 0.075, 12, false]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* 8f. Horizontal discharge outlet pipe extending from (1.34, 0.97, 0) to (2.0, 0.97, 0) */}
      <mesh position={[1.67, 0.97, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.66, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8g. Discharge outlet Bauer coupling flange at x = 2.0 */}
      <mesh position={[2.0, 0.97, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 8h. Flange bolt ring detail */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`discharge-bolt-${i}`} position={[2.02, 0.97 + Math.sin(angle) * 0.095, Math.cos(angle) * 0.095]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        );
      })}
      {/* 8i. Pressure gauge on discharge head */}
      <mesh position={[1.22, 0.65, 0.1]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.3} />
      </mesh>
      <mesh position={[1.22, 0.65, 0.115]}>
        <circleGeometry args={[0.035, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
};

// Premium 3D Pipe Elbow with a smooth curved tube and end flanges (supports dynamic bend angles)
const Elbow3D: React.FC<{ position: [number, number, number]; rotationY?: number; angle?: number }> = ({ 
  position, 
  rotationY = 0, 
  angle = Math.PI / 2 
}) => {
  const R = 0.2;
  const T = R * Math.tan(angle / 2);
  
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Curved torus segment based on dynamic corner angle */}
      <mesh rotation={[Math.PI / 2, 0, Math.PI]} position={[R, 0, T]}>
        <torusGeometry args={[R, 0.07, 16, 32, angle]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* End Flange 1 (at angle = 0, pointing along Z-axis) */}
      <mesh position={[0, 0, T]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* End Flange 2 (at angle = 'angle', pointing along the tangent of the arc) */}
      <mesh 
        position={[R - R * Math.cos(angle), 0, T - R * Math.sin(angle)]} 
        rotation={[Math.PI / 2, -angle, 0]}
      >
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

// Premium 3D Pipe Tee (Intersection Cylinder with Flanges)
const Tee3D: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Main run horizontal pipe */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.4, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Perpendicular branch pipe */}
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.2, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Left Flange */}
      <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
      {/* Right Flange */}
      <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
      {/* Branch Flange */}
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
    </group>
  );
};

// Premium 3D Segmented Galvanized Steel Header Pipe with Flanged Ends
const StraightFlangedPipe3D: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  isSelected?: boolean;
  onClick?: (e: any) => void;
}> = ({ start, end, isSelected = false, onClick }) => {
  const direction = useMemo(() => new THREE.Vector3().subVectors(end, start), [start, end]);
  const length = useMemo(() => direction.length(), [direction]);
  const dirNormalized = useMemo(() => direction.clone().normalize(), [direction]);
  const position = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end]);
  
  const quaternion = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(up, dirNormalized);
  }, [dirNormalized]);

  if (length === 0) return null;

  return (
    <group 
      position={position} 
      quaternion={quaternion}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      onPointerOver={(e) => {
        if (onClick) {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Invisible wider hit proxy cylinder for easy raycasting */}
      {onClick && (
        <mesh>
          <cylinderGeometry args={[0.25, 0.25, length, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Main Pipe body */}
      <mesh>
        <cylinderGeometry args={[0.075, 0.075, length - 0.08, 16]} />
        <meshStandardMaterial 
          color={isSelected ? "#38bdf8" : "#cbd5e1"} 
          metalness={0.8} 
          roughness={0.25} 
          emissive={isSelected ? "#0284c7" : "#000000"}
          emissiveIntensity={isSelected ? 0.45 : 0}
        />
      </mesh>
      
      {/* Start Flange */}
      <mesh position={[0, -length / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial 
          color={isSelected ? "#38bdf8" : "#475569"} 
          metalness={0.9} 
          roughness={0.1} 
        />
      </mesh>
      
      {/* End Flange */}
      <mesh position={[0, length / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial 
          color={isSelected ? "#38bdf8" : "#475569"} 
          metalness={0.9} 
          roughness={0.1} 
        />
      </mesh>
    </group>
  );
};

// Thick 3D Flexible Hose Rendered as a Tube with Ribbed Corrugations for Suction Hoses
const TubeHose3D: React.FC<{ 
  points: THREE.Vector3[]; 
  color: string; 
  radius: number; 
  isSuction?: boolean;
  isSelected?: boolean;
  onClick?: (e: any) => void;
}> = ({
  points,
  color,
  radius,
  isSuction = false,
  isSelected = false,
  onClick,
}) => {
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.CatmullRomCurve3(points);
  }, [points]);

  // Ribbing rings for reinforced PVC suction hose
  const rings = useMemo(() => {
    if (!isSuction || !curve) return [];
    const list = [];
    const segments = 45; // Rib density along the path
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, tangent);
      list.push({ position: pt, quaternion, key: i });
    }
    return list;
  }, [isSuction, curve]);

  if (!curve) return null;

  return (
    <group
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      onPointerOver={(e) => {
        if (onClick) {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Invisible wider hit proxy tube for easy raycasting */}
      {onClick && (
        <mesh>
          <tubeGeometry args={[curve, 40, radius * 2.5, 8, false]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Main hose core tube */}
      <mesh>
        <tubeGeometry args={[curve, 60, radius, 12, false]} />
        <meshStandardMaterial 
          color={isSelected ? '#38bdf8' : color} 
          roughness={isSuction ? 0.35 : 0.6} 
          metalness={isSuction ? 0.3 : 0.05} 
          emissive={isSelected ? '#0284c7' : '#000000'}
          emissiveIntensity={isSelected ? 0.45 : 0}
        />
      </mesh>
      
      {/* Corrugated external reinforcement spirals (suction hose exclusive) */}
      {isSuction && rings.map(r => (
        <mesh key={r.key} position={r.position} quaternion={r.quaternion}>
          <torusGeometry args={[radius + 0.015, 0.015, 8, 16]} />
          <meshStandardMaterial color={isSelected ? '#7dd3fc' : '#b45309'} roughness={0.1} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN 3D VIEW PORT
// ──────────────────────────────────────────────────────────────────────────────

export const Dewatering3DView: React.FC<Dewatering3DViewProps> = ({
  lines,
  placedComponents,
  areas,
  hoses,
  groundElevation,
  targetDepth,
  screenLength,
  levels = [],
  wellpointSide = 'left',
  activeTool,
  selectedId,
  onSelectId,
  onAreasChange,
  onLinesChange,
  onPlacedComponentsChange,
  onHosesChange,
  resultsOpen = false,
  showNavWheel: showNavWheelProp,
  onToggleNavWheel,
  view3DApiRef,
}) => {
  const { isDark } = useTheme();
  const [internalShowNavWheel, setInternalShowNavWheel] = useState(false);
  const showNavWheel = showNavWheelProp !== undefined ? showNavWheelProp : internalShowNavWheel;
  const [cameraInstance, setCameraInstance] = useState<THREE.Camera | null>(null);
  const [controlsInstance, setControlsInstance] = useState<any>(null);

  // Escape key deselect handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        onSelectId?.(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onSelectId]);

  // Human-readable title for selected item in 3D
  const selectedLabel = useMemo(() => {
    if (!selectedId) return null;
    const line = lines.find(l => l.id === selectedId);
    if (line) {
      const idx = lines.indexOf(line) + 1;
      return `Header Pipe #${idx}`;
    }
    const hose = hoses.find(h => h.id === selectedId);
    if (hose) {
      const idx = hoses.indexOf(hose) + 1;
      const kind = hose.kind === 'discharge' ? 'Discharge' : 'Suction';
      return `${kind} Hose #${idx}`;
    }
    const comp = placedComponents.find(c => c.id === selectedId);
    if (comp) {
      const idx = placedComponents.indexOf(comp) + 1;
      const nameMap: Record<string, string> = {
        pump: 'Vacuum Pump',
        tee: 'Header Tee Junction',
        elbow: 'Header Elbow 90°',
        ingress: 'Suction Ingress Bell',
      };
      return `${nameMap[comp.type] || comp.type.toUpperCase()} #${idx}`;
    }
    const area = areas.find(a => a.id === selectedId);
    if (area) {
      const idx = areas.indexOf(area) + 1;
      const nameMap: Record<string, string> = {
        pit: 'Excavation Pit',
        site: 'Site Boundary',
        discharge: 'Discharge Area',
      };
      return `${nameMap[area.kind] || 'Area'} #${idx}`;
    }
    if (selectedId.startsWith('wp-')) {
      return 'Wellpoint Riser';
    }
    return `Selected Item (${selectedId.slice(0, 6)}…)`;
  }, [selectedId, lines, hoses, placedComponents, areas]);

  // Refs for pending zoom and layout bounds (must be before handleControlsReady)
  const pendingZoomToFitRef = useRef(false);
  const layoutBoundsRef = useRef<{ center: THREE.Vector3; size: THREE.Vector3 } | null>(null);

  const handleControlsReady = useCallback((cam: THREE.Camera, ctrl: any) => {
    setCameraInstance(cam);
    setControlsInstance(ctrl);
    // If a zoom-to-fit was requested before the camera was ready, execute it now
    if (pendingZoomToFitRef.current) {
      pendingZoomToFitRef.current = false;
      const center = layoutBoundsRef.current?.center ?? new THREE.Vector3();
      const size = layoutBoundsRef.current?.size ?? new THREE.Vector3(40, 0, 40);
      const maxDim = Math.max(size.x, size.z, size.y, 8);
      const fov = (cam as THREE.PerspectiveCamera).fov || 45;
      const dist = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5;
      const targetPos = new THREE.Vector3(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7);
      const startPos = cam.position.clone();
      const startTarget = ctrl.target.clone();
      const duration = 350;
      const startTime = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        cam.position.lerpVectors(startPos, targetPos, ease);
        ctrl.target.lerpVectors(startTarget, center, ease);
        cam.lookAt(ctrl.target);
        ctrl.update();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, []);

  const [isZoomWindowMode, setIsZoomWindowMode] = useState(false);
  const [zoomWindowDrag, setZoomWindowDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute dynamic layout 3D bounds and center to anchor 3D ground grid and camera
  const layoutBounds = useMemo(() => {
    const box = new THREE.Box3();
    lines.forEach(l => (l.points || []).forEach(p => box.expandByPoint(new THREE.Vector3(p.x / PIXELS_PER_METER, groundElevation, p.y / PIXELS_PER_METER))));
    areas.forEach(a => {
      box.expandByPoint(new THREE.Vector3(a.x / PIXELS_PER_METER, groundElevation, a.y / PIXELS_PER_METER));
      box.expandByPoint(new THREE.Vector3((a.x + (a.width || 0)) / PIXELS_PER_METER, groundElevation - targetDepth, (a.y + (a.height || 0)) / PIXELS_PER_METER));
    });
    placedComponents.forEach(c => box.expandByPoint(new THREE.Vector3(c.x / PIXELS_PER_METER, groundElevation, c.y / PIXELS_PER_METER)));
    hoses.forEach(h => (h.points || []).forEach((p: Point) => box.expandByPoint(new THREE.Vector3(p.x / PIXELS_PER_METER, groundElevation, p.y / PIXELS_PER_METER))));

    if (box.isEmpty()) {
      return {
        center: new THREE.Vector3(0, groundElevation, 0),
        size: new THREE.Vector3(40, 0, 40),
        gridPosition: [0, groundElevation, 0] as [number, number, number],
        gridArgs: [120, 120] as [number, number],
        fadeDistance: 90,
      };
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Snap grid center to nearest 10m so lines remain continuous
    const snapGridX = Math.round(center.x / 10) * 10;
    const snapGridZ = Math.round(center.z / 10) * 10;
    const maxSpan = Math.max(size.x, size.z, 30);
    const gridSpan = Math.max(160, Math.ceil((maxSpan * 3.0) / 20) * 20);

    return {
      center,
      size,
      gridPosition: [snapGridX, groundElevation, snapGridZ] as [number, number, number],
      gridArgs: [gridSpan, gridSpan] as [number, number],
      fadeDistance: gridSpan * 0.75,
    };
  }, [lines, areas, placedComponents, hoses, groundElevation, targetDepth]);

  // Keep a ref to latest bounds so handleControlsReady can access them without stale closure
  useEffect(() => { layoutBoundsRef.current = layoutBounds; }, [layoutBounds]);

  // Reset Camera (Default Isometric Home View)
  const handleReset3DView = useCallback(() => {
    if (!cameraInstance || !controlsInstance) return;
    const startPos = cameraInstance.position.clone();
    const startTarget = controlsInstance.target.clone();

    const center = layoutBounds.center;
    const maxDim = Math.max(layoutBounds.size.x, layoutBounds.size.z, layoutBounds.size.y, 8);
    const fov = (cameraInstance as THREE.PerspectiveCamera).fov || 45;
    const dist = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5;

    const targetPos = new THREE.Vector3(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7);
    const targetCenter = center.clone();
    const duration = 400;
    const startTime = performance.now();

    const step = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      cameraInstance.position.lerpVectors(startPos, targetPos, ease);
      controlsInstance.target.lerpVectors(startTarget, targetCenter, ease);
      cameraInstance.lookAt(controlsInstance.target);
      controlsInstance.update();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [cameraInstance, controlsInstance, layoutBounds]);

  // Zoom In (+25%)
  const handleZoomIn = useCallback(() => {
    if (!cameraInstance || !controlsInstance) return;
    const dir = new THREE.Vector3().subVectors(controlsInstance.target, cameraInstance.position);
    cameraInstance.position.addScaledVector(dir, 0.25);
    controlsInstance.update();
  }, [cameraInstance, controlsInstance]);

  // Zoom Out (-25%)
  const handleZoomOut = useCallback(() => {
    if (!cameraInstance || !controlsInstance) return;
    const dir = new THREE.Vector3().subVectors(controlsInstance.target, cameraInstance.position);
    cameraInstance.position.addScaledVector(dir, -0.25);
    controlsInstance.update();
  }, [cameraInstance, controlsInstance]);

  // Zoom to Fit (Extents) - frames entire layout perfectly in viewport
  const handleZoomToFit = useCallback(() => {
    // Camera not ready yet — queue the zoom; it fires in handleControlsReady
    if (!cameraInstance || !controlsInstance) {
      pendingZoomToFitRef.current = true;
      return;
    }
    const center = layoutBounds.center;
    const maxDim = Math.max(layoutBounds.size.x, layoutBounds.size.z, layoutBounds.size.y, 8);
    const fov = (cameraInstance as THREE.PerspectiveCamera).fov || 45;
    const dist = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5;

    const targetPos = new THREE.Vector3(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7);

    const startPos = cameraInstance.position.clone();
    const startTarget = controlsInstance.target.clone();
    const duration = 350;
    const startTime = performance.now();

    const step = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      cameraInstance.position.lerpVectors(startPos, targetPos, ease);
      controlsInstance.target.lerpVectors(startTarget, center, ease);
      cameraInstance.lookAt(controlsInstance.target);
      controlsInstance.update();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [cameraInstance, controlsInstance, layoutBounds]);

  // Start Zoom Window mode
  const handleStartZoomWindow = useCallback(() => {
    setIsZoomWindowMode(true);
  }, []);

  // Expose 3D methods to parent via view3DApiRef
  useEffect(() => {
    if (view3DApiRef) {
      view3DApiRef.current = {
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        zoomAll: handleZoomToFit,
        zoomWindow: handleStartZoomWindow,
        resetView: handleReset3DView,
      };
    }
  }, [view3DApiRef, handleZoomIn, handleZoomOut, handleZoomToFit, handleStartZoomWindow, handleReset3DView]);

  const handleWindowPointerDown = (e: React.PointerEvent) => {
    if (!isZoomWindowMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setZoomWindowDrag({ startX: x, startY: y, currentX: x, currentY: y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleWindowPointerMove = (e: React.PointerEvent) => {
    if (!isZoomWindowMode || !zoomWindowDrag) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setZoomWindowDrag(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  };

  const handleWindowPointerUp = (e: React.PointerEvent) => {
    if (!isZoomWindowMode || !zoomWindowDrag || !cameraInstance || !controlsInstance) {
      setIsZoomWindowMode(false);
      setZoomWindowDrag(null);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const minX = Math.min(zoomWindowDrag.startX, zoomWindowDrag.currentX);
      const maxX = Math.max(zoomWindowDrag.startX, zoomWindowDrag.currentX);
      const minY = Math.min(zoomWindowDrag.startY, zoomWindowDrag.currentY);
      const maxY = Math.max(zoomWindowDrag.startY, zoomWindowDrag.currentY);

      if (maxX - minX > 15 && maxY - minY > 15) {
        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundElevation);

        const getGroundPoint = (px: number, py: number) => {
          const ndcX = (px / rect.width) * 2 - 1;
          const ndcY = -(py / rect.height) * 2 + 1;
          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraInstance);
          const target = new THREE.Vector3();
          return raycaster.ray.intersectPlane(groundPlane, target);
        };

        const pt1 = getGroundPoint(minX, minY);
        const pt2 = getGroundPoint(maxX, maxY);

        if (pt1 && pt2) {
          const box = new THREE.Box3().setFromPoints([pt1, pt2]);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.z, 5);
          const fov = (cameraInstance as THREE.PerspectiveCamera).fov || 45;
          const dist = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.4;

          const targetPos = new THREE.Vector3(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7);

          const startPos = cameraInstance.position.clone();
          const startTarget = controlsInstance.target.clone();
          const duration = 350;
          const startTime = performance.now();

          const step = (now: number) => {
            const p = Math.min(1, (now - startTime) / duration);
            const ease = 1 - Math.pow(1 - p, 3);
            cameraInstance.position.lerpVectors(startPos, targetPos, ease);
            controlsInstance.target.lerpVectors(startTarget, center, ease);
            cameraInstance.lookAt(controlsInstance.target);
            controlsInstance.update();
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      }
    }

    setIsZoomWindowMode(false);
    setZoomWindowDrag(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Escape key cancels Zoom Window mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomWindowMode) {
        setIsZoomWindowMode(false);
        setZoomWindowDrag(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomWindowMode]);

  const HEADER_Y = groundElevation + 0.5;
  const BOTTOM_Y = groundElevation - targetDepth;

  const to3D = (pt: { x: number; y: number }, y: number = 0) => {
    return new THREE.Vector3(pt.x / PIXELS_PER_METER, y, pt.y / PIXELS_PER_METER);
  };

  // Build segmented rigid header pipe segments in 3D (6m pieces + remainder)
  // Pipes are tangent-trimmed at corners/junctions so they don't overlap elbow fittings.
  const segmentedHeaderPipes = useMemo(() => {
    const pipes: { key: string; lineId: string; start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    const R_BEND = 0.2; // bend radius in metres (matches Elbow3D)
    const THRESHOLD = 12; // snap distance in pixels

    // Helper: compute deflection-based tangent length (px) for a corner formed by two direction vectors
    const tangentFromVectors = (v1: { x: number; y: number }, v2: { x: number; y: number }): number => {
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      if (len1 === 0 || len2 === 0) return 0;
      const a1 = Math.atan2(v1.y, v1.x);
      const a2 = Math.atan2(v2.y, v2.x);
      let diff = a2 - a1;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const deflection = Math.PI - Math.abs(diff);
      return R_BEND * Math.tan(deflection / 2) * PIXELS_PER_METER;
    };

    lines.forEach(line => {
      const level = levels.find(l => l.id === line.levelId);
      const levelDepth = level ? level.depthFromGL : 0;
      const depthOffset = line.depthFromGL !== undefined ? line.depthFromGL : levelDepth;
      const headerY = groundElevation - depthOffset + 0.5;

      for (let i = 0; i < line.points.length - 1; i++) {
        const p1 = line.points[i];
        const p2 = line.points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        if (distPx === 0) continue;

        const dirX = dx / distPx;
        const dirY = dy / distPx;

        // ── Calculate tangent offsets for seamless elbow connections ──

        let T_start_px = 0;
        let T_end_px = 0;

        // T_start: internal vertex (corner within this line)
        if (i > 0) {
          const prev = line.points[i - 1];
          const curr = line.points[i];
          const next = line.points[i + 1];
          T_start_px = tangentFromVectors(
            { x: prev.x - curr.x, y: prev.y - curr.y },
            { x: next.x - curr.x, y: next.y - curr.y }
          );
        }

        // T_start: junction — first segment's start meets another line's endpoint or closed loop
        if (i === 0) {
          const startPt = line.points[0];
          const endPt = line.points[line.points.length - 1];
          const isClosedSelf = line.points.length >= 4 && Math.sqrt((startPt.x - endPt.x) ** 2 + (startPt.y - endPt.y) ** 2) < THRESHOLD;
          if (isClosedSelf) {
            const thisDir = { x: line.points[1].x - startPt.x, y: line.points[1].y - startPt.y };
            const otherDir = { x: line.points[line.points.length - 2].x - startPt.x, y: line.points[line.points.length - 2].y - startPt.y };
            T_start_px = tangentFromVectors(thisDir, otherDir);
          } else {
            for (const otherLine of lines) {
              if (otherLine.id === line.id) continue;
              if (otherLine.points.length < 2) continue;
              const otherPts = otherLine.points;
              for (const epIdx of [0, otherPts.length - 1]) {
                const ep = otherPts[epIdx];
                if (Math.sqrt((startPt.x - ep.x) ** 2 + (startPt.y - ep.y) ** 2) < THRESHOLD) {
                  const otherDir = epIdx === 0
                    ? { x: otherPts[1].x - ep.x, y: otherPts[1].y - ep.y }
                    : { x: otherPts[otherPts.length - 2].x - ep.x, y: otherPts[otherPts.length - 2].y - ep.y };
                  const thisDir = { x: line.points[1].x - startPt.x, y: line.points[1].y - startPt.y };
                  T_start_px = tangentFromVectors(thisDir, otherDir);
                }
              }
            }
          }
        }

        // T_end: internal vertex (corner within this line)
        if (i < line.points.length - 2) {
          const curr = line.points[i + 1];
          const prev = line.points[i];
          const next = line.points[i + 2];
          T_end_px = tangentFromVectors(
            { x: prev.x - curr.x, y: prev.y - curr.y },
            { x: next.x - curr.x, y: next.y - curr.y }
          );
        }

        // T_end: junction — last segment's end meets another line's endpoint or closed loop
        if (i === line.points.length - 2) {
          const startPt = line.points[0];
          const endPt = line.points[line.points.length - 1];
          const isClosedSelf = line.points.length >= 4 && Math.sqrt((startPt.x - endPt.x) ** 2 + (startPt.y - endPt.y) ** 2) < THRESHOLD;
          if (isClosedSelf) {
            const thisDir = { x: line.points[line.points.length - 2].x - endPt.x, y: line.points[line.points.length - 2].y - endPt.y };
            const otherDir = { x: line.points[1].x - endPt.x, y: line.points[1].y - endPt.y };
            T_end_px = tangentFromVectors(thisDir, otherDir);
          } else {
            for (const otherLine of lines) {
              if (otherLine.id === line.id) continue;
              if (otherLine.points.length < 2) continue;
              const otherPts = otherLine.points;
              for (const epIdx of [0, otherPts.length - 1]) {
                const ep = otherPts[epIdx];
                if (Math.sqrt((endPt.x - ep.x) ** 2 + (endPt.y - ep.y) ** 2) < THRESHOLD) {
                  const otherDir = epIdx === 0
                    ? { x: otherPts[1].x - ep.x, y: otherPts[1].y - ep.y }
                    : { x: otherPts[otherPts.length - 2].x - ep.x, y: otherPts[otherPts.length - 2].y - ep.y };
                  const thisDir = { x: line.points[line.points.length - 2].x - endPt.x, y: line.points[line.points.length - 2].y - endPt.y };
                  T_end_px = tangentFromVectors(thisDir, otherDir);
                }
              }
            }
          }
        }

        // ── Trim the available distance and segment into 6m header pipes ──

        const adjustedDistPx = distPx - T_start_px - T_end_px;
        if (adjustedDistPx <= 0.1) continue;

        const headerLengthPx = 6 * PIXELS_PER_METER;
        const numPipes = Math.floor((adjustedDistPx / PIXELS_PER_METER) / 6);

        for (let k = 0; k < numPipes; k++) {
          const startPx = T_start_px + k * headerLengthPx;
          const endPx = T_start_px + (k + 1) * headerLengthPx;

          const s3D = to3D({ x: p1.x + dirX * startPx, y: p1.y + dirY * startPx }, headerY);
          const e3D = to3D({ x: p1.x + dirX * endPx, y: p1.y + dirY * endPx }, headerY);

          pipes.push({
            key: `pipe-3d-${line.id}-${i}-${k}`,
            lineId: line.id,
            start: s3D,
            end: e3D
          });
        }

        // Render remainder segment
        const remainderPx = adjustedDistPx - numPipes * headerLengthPx;
        if (remainderPx > 1.0) {
          const startPx = T_start_px + numPipes * headerLengthPx;
          const endPx = distPx - T_end_px;

          const s3D = to3D({ x: p1.x + dirX * startPx, y: p1.y + dirY * startPx }, headerY);
          const e3D = to3D({ x: p1.x + dirX * endPx, y: p1.y + dirY * endPx }, headerY);

          pipes.push({
            key: `pipe-3d-${line.id}-${i}-rem`,
            lineId: line.id,
            start: s3D,
            end: e3D
          });
        }
      }
    });

    return pipes;
  }, [lines, groundElevation, levels]);

  // Dynamically map 3D elevation of hose endpoints to connect with pump ports, tees, elbows & headers
  const getHosePointElevation = (pt2D: Point, isDischarge: boolean) => {
    let targetY = groundElevation + 0.12; // default: flat on ground

    // Helper: rotate a 2D local offset by component rotation angle
    const rotPt = (ox: number, oy: number, angleDeg: number) => {
      const r = (angleDeg || 0) * (Math.PI / 180);
      return { x: ox * Math.cos(r) - oy * Math.sin(r), y: ox * Math.sin(r) + oy * Math.cos(r) };
    };

    // 1. Check proximity to any placed component port
    placedComponents.forEach(comp => {
      const level = levels.find(l => l.id === comp.levelId);
      const levelDepth = level ? level.depthFromGL : 0;
      const compHeaderY = groundElevation - levelDepth + 0.5;

      if (comp.type === 'pump') {
        const portY = groundElevation - levelDepth + 0.35;
        const distSuction = Math.sqrt((pt2D.x - (comp.x - 20)) ** 2 + (pt2D.y - comp.y) ** 2);
        const distDischarge = Math.sqrt((pt2D.x - (comp.x + 20)) ** 2 + (pt2D.y - comp.y) ** 2);

        if (distSuction < 30 && distSuction <= distDischarge) {
          targetY = portY;
        } else if (distDischarge < 30 && distDischarge < distSuction) {
          targetY = groundElevation - levelDepth + 1.42;
        }
      }

      // Tee: 3 ports — left (-8,0), right (8,0), branch (0,8)
      if (comp.type === 'tee') {
        [[-8, 0], [8, 0], [0, 8]].forEach(([ox, oy]) => {
          const p = rotPt(ox, oy, comp.rotation || 0);
          const dist = Math.sqrt((pt2D.x - (comp.x + p.x)) ** 2 + (pt2D.y - (comp.y + p.y)) ** 2);
          if (dist < 30) targetY = compHeaderY;
        });
      }

      // Elbow: 2 ports — left (-12,0) and bottom (0,12)
      if (comp.type === 'elbow') {
        [[-12, 0], [0, 12]].forEach(([ox, oy]) => {
          const p = rotPt(ox, oy, comp.rotation || 0);
          const dist = Math.sqrt((pt2D.x - (comp.x + p.x)) ** 2 + (pt2D.y - (comp.y + p.y)) ** 2);
          if (dist < 30) targetY = compHeaderY;
        });
      }

      // Ingress: 1 central suction point
      if (comp.type === 'ingress') {
        const dist = Math.sqrt((pt2D.x - comp.x) ** 2 + (pt2D.y - comp.y) ** 2);
        if (dist < 30) targetY = groundElevation - levelDepth + 0.1;
      }
    });

    // 2. Check if near any header pipe point/endpoint (30px radius)
    if (targetY === groundElevation + 0.12) {
      lines.forEach(line => {
        const level = levels.find(l => l.id === line.levelId);
        const levelDepth = level ? level.depthFromGL : 0;
        const depthOffset = line.depthFromGL !== undefined ? line.depthFromGL : levelDepth;
        const headerY = groundElevation - depthOffset + 0.5;

        line.points.forEach(lp => {
          const dist = Math.sqrt((pt2D.x - lp.x) ** 2 + (pt2D.y - lp.y) ** 2);
          if (dist < 30) targetY = headerY;
        });
      });
    }

    return targetY;
  };

  // Compute robust auto-fittings (strictly header-to-header pipe connections) in 3D
  const autoFittings = useMemo(() => {
    const fittings: { type: 'elbow' | 'tee'; x: number; y: number; rotation: number; headerY: number; angle?: number }[] = [];
    const threshold = 12; // Snap distance in pixels

    const ptDist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const distToSegment = (p: Point, a: Point, b: Point) => {
      const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (l2 === 0) return { dist: ptDist(p, a), proj: { x: a.x, y: a.y } };
      let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      return { dist: ptDist(p, proj), proj };
    };

    const headerEndpoints: { pt: Point; parentId: string; headerY: number; linePoints: Point[] }[] = [];
    lines.forEach(l => {
      if (l.points.length > 1) {
        const level = levels.find(lv => lv.id === l.levelId);
        const levelDepth = level ? level.depthFromGL : 0;
        const depthOffset = l.depthFromGL !== undefined ? l.depthFromGL : levelDepth;
        const headerY = groundElevation - depthOffset + 0.5;

        headerEndpoints.push({ pt: l.points[0], parentId: l.id, headerY, linePoints: l.points });
        headerEndpoints.push({ pt: l.points[l.points.length - 1], parentId: l.id, headerY, linePoints: l.points });
      }
    });

    // Helper to calculate turn rotation and deflection angle for meeting or corner elbows
    const getRotationDegreesAndAngle = (v1: Point, v2: Point) => {
      const len1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
      const len2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
      if (len1 === 0 || len2 === 0) return { rotation: 0, angle: Math.PI / 2 };
      
      const a1 = Math.atan2(v1.y / len1, v1.x / len1);
      const a2 = Math.atan2(v2.y / len2, v2.x / len2);
      let diff = a2 - a1;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      const actualBisector = a1 + diff / 2;
      const deflectionAngle = Math.PI - Math.abs(diff);
      
      // Default Elbow3D connects +X (angle 0) and +Z (angle PI/2), bisector is PI/4 (45 deg)
      // Standard canvas is y-down, threejs is z-forward. Returns rotation in degrees.
      const elbowBisector = Math.PI / 2 - deflectionAngle / 2;
      const rotDegrees = -(actualBisector - elbowBisector) * (180 / Math.PI);
      return { rotation: rotDegrees, angle: deflectionAngle };
    };

    // 1. Elbow detection: Two separate header pipe endpoints meet (with proper angular rotation)
    for (let i = 0; i < headerEndpoints.length; i++) {
      for (let j = i + 1; j < headerEndpoints.length; j++) {
        if (headerEndpoints[i].parentId !== headerEndpoints[j].parentId) {
          if (ptDist(headerEndpoints[i].pt, headerEndpoints[j].pt) < threshold) {
            const ep1 = headerEndpoints[i];
            const ep2 = headerEndpoints[j];
            
            // Outgoing directions from meeting point
            const getOutgoingDir = (ep: typeof headerEndpoints[0]) => {
              const pts = ep.linePoints;
              if (ptDist(ep.pt, pts[0]) < 2) {
                return { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
              } else {
                const len = pts.length;
                return { x: pts[len - 2].x - pts[len - 1].x, y: pts[len - 2].y - pts[len - 1].y };
              }
            };
            
            const v1 = getOutgoingDir(ep1);
            const v2 = getOutgoingDir(ep2);
            const { rotation, angle } = getRotationDegreesAndAngle(v1, v2);

            fittings.push({
              type: 'elbow',
              x: (ep1.pt.x + ep2.pt.x) / 2,
              y: (ep1.pt.y + ep2.pt.y) / 2,
              rotation: rotation,
              headerY: (ep1.headerY + ep2.headerY) / 2,
              angle
            });
          }
        }
      }
    }

    // 2. Tee detection: Header segment endpoint meets another header segment mid-body
    lines.forEach(l => {
      const level = levels.find(lv => lv.id === l.levelId);
      const levelDepth = level ? level.depthFromGL : 0;
      const depthOffset = l.depthFromGL !== undefined ? l.depthFromGL : levelDepth;
      const headerY = groundElevation - depthOffset + 0.5;

      for (let i = 0; i < l.points.length - 1; i++) {
        const a = l.points[i];
        const b = l.points[i + 1];

        headerEndpoints.forEach(hept => {
          if (hept.parentId !== l.id) {
            if (ptDist(hept.pt, a) > threshold && ptDist(hept.pt, b) > threshold) {
              const { dist, proj } = distToSegment(hept.pt, a, b);
              if (dist < threshold) {
                fittings.push({
                  type: 'tee',
                  x: proj.x,
                  y: proj.y,
                  rotation: Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI),
                  headerY,
                });
              }
            }
          }
        });
      }
    });

    // 3. Corner detection: Internal corners within any multi-point line
    lines.forEach(l => {
      if (l.points.length > 2) {
        const level = levels.find(lv => lv.id === l.levelId);
        const levelDepth = level ? level.depthFromGL : 0;
        const depthOffset = l.depthFromGL !== undefined ? l.depthFromGL : levelDepth;
        const headerY = groundElevation - depthOffset + 0.5;

        for (let i = 1; i < l.points.length - 1; i++) {
          const prev = l.points[i - 1];
          const curr = l.points[i];
          const next = l.points[i + 1];
          
          const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
          const v2 = { x: next.x - curr.x, y: next.y - curr.y };
          const { rotation, angle } = getRotationDegreesAndAngle(v1, v2);
          
          fittings.push({
            type: 'elbow',
            x: curr.x,
            y: curr.y,
            rotation: rotation,
            headerY,
            angle
          });
        }

        // Check closing corner for closed loops (first point touches last point)
        const pFirst = l.points[0];
        const pLast = l.points[l.points.length - 1];
        const isClosedLoop = l.points.length >= 4 && ptDist(pFirst, pLast) < threshold;
        if (isClosedLoop) {
          const prev = l.points[l.points.length - 2];
          const curr = pFirst;
          const next = l.points[1];

          const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
          const v2 = { x: next.x - curr.x, y: next.y - curr.y };
          const { rotation, angle } = getRotationDegreesAndAngle(v1, v2);

          fittings.push({
            type: 'elbow',
            x: curr.x,
            y: curr.y,
            rotation: rotation,
            headerY,
            angle
          });
        }
      }
    });

    // Deduplicate
    const uniqueFittings: typeof fittings = [];
    fittings.forEach(fit => {
      const isDup = uniqueFittings.some(uf => ptDist(uf, fit) < 5);
      if (!isDup) uniqueFittings.push(fit);
    });

    return uniqueFittings;
  }, [lines, groundElevation, levels]);

  // Compute wellpoint structures on BOTH SIDES of header with correct horizontal connector attachment points
  const wellpoints = useMemo(() => {
    const wps: { lineId: string; position: THREE.Vector3; headerAttach: THREE.Vector3; connDir: THREE.Vector3; headerY: number; wellpointDepth: number }[] = [];
    lines.forEach(line => {
      const level = levels.find(l => l.id === line.levelId);
      const levelDepth = level ? level.depthFromGL : 0;
      const depthOffset = line.depthFromGL !== undefined ? line.depthFromGL : levelDepth;
      const headerY = groundElevation - depthOffset + 0.5;
      const wellpointDepth = level ? level.wellpointDepth : targetDepth + 0.5;

      for (let i = 0; i < line.points.length - 1; i++) {
        const p1 = line.points[i];
        const p2 = line.points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        if (distPx === 0) continue;
        
        const dirX = dx / distPx;
        const dirY = dy / distPx;
        const headerLengthPx = 6 * PIXELS_PER_METER;
        const wpDistPx = headerLengthPx / 6;
        const numPipes = Math.floor((distPx / PIXELS_PER_METER) / 6);
        const offsetPx = 10; // 1m perpendicular offset from header centreline
        
        // 1. Wellpoints on full 6m sections
        for (let k = 0; k < numPipes; k++) {
          const startPx = k * headerLengthPx;
          for (let w = 0; w < 6; w++) {
            const wpOffsetPx = startPx + (w + 0.5) * wpDistPx;
            const wpX = p1.x + dirX * wpOffsetPx;
            const wpY = p1.y + dirY * wpOffsetPx;
            const headerAttach = to3D({ x: wpX, y: wpY }, headerY);

            // Filter side selection based on wellpointSide prop
            const effectiveWellpointSide = line.wellpointSide || wellpointSide;
            for (const side of (effectiveWellpointSide === 'left' ? [1] : effectiveWellpointSide === 'right' ? [-1] : [1, -1])) {
              const perpX = -dirY * side;
              const perpY = dirX * side;
              const outerX = wpX + perpX * offsetPx;
              const outerY = wpY + perpY * offsetPx;
              const wpPos = to3D({ x: outerX, y: outerY }, headerY);
              // Connector direction vector in 3D (normalised horizontal)
              const connDir = new THREE.Vector3(perpX, 0, perpY).normalize();
              wps.push({ lineId: line.id, position: wpPos, headerAttach, connDir, headerY, wellpointDepth });
            }
          }
        }

        // 2. Wellpoints on remainder section
        const remainderPx = distPx - numPipes * headerLengthPx;
        if (remainderPx > 1.0) {
          const startPx = numPipes * headerLengthPx;
          const numWps = Math.floor(remainderPx / wpDistPx);
          for (let w = 0; w < numWps; w++) {
            const wpOffsetPx = startPx + (w + 0.5) * wpDistPx;
            const wpX = p1.x + dirX * wpOffsetPx;
            const wpY = p1.y + dirY * wpOffsetPx;
            const headerAttach = to3D({ x: wpX, y: wpY }, headerY);

            const effectiveWellpointSide = line.wellpointSide || wellpointSide;
            for (const side of (effectiveWellpointSide === 'left' ? [1] : effectiveWellpointSide === 'right' ? [-1] : [1, -1])) {
              const perpX = -dirY * side;
              const perpY = dirX * side;
              const outerX = wpX + perpX * offsetPx;
              const outerY = wpY + perpY * offsetPx;
              const wpPos = to3D({ x: outerX, y: outerY }, headerY);
              const connDir = new THREE.Vector3(perpX, 0, perpY).normalize();
              wps.push({ lineId: line.id, position: wpPos, headerAttach, connDir, headerY, wellpointDepth });
            }
          }
        }
      }
    });
    return wps;
  }, [lines, groundElevation, targetDepth, levels, wellpointSide]);

  const isModifyTool = activeTool && !['select','line','hose','discharge','dimension','area','site-area','discharge-area','text','pump','tee','elbow'].includes(activeTool);
  const isSelectTool = activeTool === 'select' || !activeTool;

  const guidance3D: Record<string, string> = {
    'align': 'Click an element in 3D to align it',
    'offset': 'Click a pipeline or area to offset it',
    'mirror-pick': selectedId ? 'Click axis line to mirror selected' : 'Click an element to select first',
    'mirror-draw': selectedId ? 'Orbiting disabled — modify in 2D view for mirror-draw' : 'Click an element to select first',
    'split': 'Click a pipeline in 3D to split it',
    'trim': 'Trim works best in 2D — switch view for precision',
    'pin': 'Click element to pin/lock it',
    'unpin': 'Click element to unpin/unlock it',
    'delete': 'Click element to delete it',
    'pan': 'Click and drag to pan the 3D model view',
  };

  const cursorStyle = (() => {
    if (activeTool === 'pan') return 'grab';
    if (!activeTool) return 'grab';
    if (activeTool === 'delete') return 'not-allowed';
    if (activeTool === 'pin' || activeTool === 'unpin') return 'alias';
    if (activeTool === 'select') return 'default';
    return 'pointer';
  })();

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full relative dewatering-3d-view transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`} 
      style={{ cursor: isZoomWindowMode ? 'crosshair' : cursorStyle }}
      onPointerDown={isZoomWindowMode ? handleWindowPointerDown : undefined}
      onPointerMove={isZoomWindowMode ? handleWindowPointerMove : undefined}
      onPointerUp={isZoomWindowMode ? handleWindowPointerUp : undefined}
    >

      {/* 3D Modify Guidance HUD */}
      {activeTool && guidance3D[activeTool] && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-blue-900/95 border border-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none">
          <span className="text-yellow-400">💡</span>
          {guidance3D[activeTool]}
        </div>
      )}

      {/* Zoom Window Active Guidance HUD */}
      {isZoomWindowMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 animate-pulse border border-white/20">
          <span>🔍 Zoom Window: Click & drag a rectangle over the 3D model</span>
          <button 
            type="button" 
            onClick={() => { setIsZoomWindowMode(false); setZoomWindowDrag(null); }}
            className="ml-2 bg-black/20 hover:bg-black/30 text-white px-2 py-0.5 rounded text-[10px] cursor-pointer"
          >
            Esc / Cancel
          </button>
        </div>
      )}

      {/* Zoom Window Marquee Drag Box */}
      {isZoomWindowMode && zoomWindowDrag && (
        <div
          className="absolute border-2 border-dashed border-amber-500 bg-amber-500/20 pointer-events-none z-30 rounded-xs shadow-sm"
          style={{
            left: Math.min(zoomWindowDrag.startX, zoomWindowDrag.currentX),
            top: Math.min(zoomWindowDrag.startY, zoomWindowDrag.currentY),
            width: Math.abs(zoomWindowDrag.currentX - zoomWindowDrag.startX),
            height: Math.abs(zoomWindowDrag.currentY - zoomWindowDrag.startY),
          }}
        />
      )}

      {/* Selected indicator badge (Bottom-Left, non-blocking) */}
      {selectedId && selectedLabel && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
          <span>Selected: <strong className="text-white font-semibold">{selectedLabel}</strong></span>
          <button
            type="button"
            onClick={() => onSelectId?.(null)}
            className="ml-1 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Deselect (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Revit ViewCube (Top-Right) */}
      <div className="absolute top-3 right-3 z-10">
        <ViewCube3D 
          camera={cameraInstance} 
          controls={controlsInstance} 
        />
      </div>

      {/* Revit Navigation Wheel (Draggable overlay) */}
      {showNavWheel && (
        <NavWheel3D 
          camera={cameraInstance} 
          controls={controlsInstance} 
          onClose={() => {
            if (onToggleNavWheel) onToggleNavWheel();
            else setInternalShowNavWheel(false);
          }} 
          onZoomToFit={handleZoomToFit}
          onStartZoomWindow={handleStartZoomWindow}
        />
      )}

      <Canvas 
        camera={{ position: [layoutBounds.center.x + 20, layoutBounds.center.y + 16, layoutBounds.center.z + 20], fov: 45 }} 
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => onSelectId?.(null)}
      >
        <color attach="background" args={[isDark ? '#0f172a' : '#f8fafc']} />
        <fog attach="fog" args={[isDark ? '#0f172a' : '#f8fafc', 60, Math.max(180, layoutBounds.fadeDistance * 1.5)]} />
        <ambientLight intensity={isDark ? 0.65 : 0.85} />
        <directionalLight 
          position={[layoutBounds.center.x + 15, layoutBounds.center.y + 25, layoutBounds.center.z + 15]} 
          intensity={isDark ? 1.3 : 1.5} 
          color="#ffffff" 
          castShadow 
        />
        <directionalLight 
          position={[layoutBounds.center.x - 15, layoutBounds.center.y + 20, layoutBounds.center.z - 15]} 
          intensity={isDark ? 0.5 : 0.45} 
          color={isDark ? '#ffffff' : '#e2e8f0'} 
        />
        <CameraController onControlsReady={handleControlsReady} activeTool={activeTool} layoutCenter={layoutBounds.center} layoutSize={layoutBounds.size} />

        {/* Ground Reference Grid */}
        <Grid 
          position={layoutBounds.gridPosition} 
          args={layoutBounds.gridArgs} 
          cellSize={1} 
          cellThickness={1} 
          cellColor={isDark ? "#334155" : "#cbd5e1"} 
          sectionSize={10} 
          sectionThickness={1.5} 
          sectionColor={isDark ? "#64748b" : "#94a3b8"} 
          fadeDistance={layoutBounds.fadeDistance} 
        />

        {/* Excavation Areas */}
        {areas.map(area => {
          const fillCol = area.kind === 'site' ? '#22c55e' : area.kind === 'discharge' ? '#f97316' : '#ef4444';
          const isSelected3D = selectedId === area.id;
          const highlightCol = isSelected3D ? '#facc15' : area.locked ? '#94a3b8' : fillCol;

          const handle3DClick = (e: any) => {
            e.stopPropagation();
            if (!activeTool || activeTool === 'select') {
              onSelectId?.(area.id);
            } else if (activeTool === 'delete') {
              onAreasChange?.(areas.filter((a: any) => a.id !== area.id));
              onSelectId?.(null);
            } else if (activeTool === 'pin') {
              onAreasChange?.(areas.map((a: any) => a.id === area.id ? { ...a, locked: true } : a));
            } else if (activeTool === 'unpin') {
              onAreasChange?.(areas.map((a: any) => a.id === area.id ? { ...a, locked: false } : a));
            } else {
              onSelectId?.(area.id);
            }
          };

          if (area.points && area.points.length > 2) {
            const shape = new THREE.Shape();
            const p0 = area.points[0];
            shape.moveTo(p0.x / PIXELS_PER_METER, p0.y / PIXELS_PER_METER);
            for (let i = 1; i < area.points.length; i++) {
              const pt = area.points[i];
              shape.lineTo(pt.x / PIXELS_PER_METER, pt.y / PIXELS_PER_METER);
            }
            shape.closePath();

            const extrudeSettings = {
              steps: 1,
              depth: targetDepth,
              bevelEnabled: false,
            };

            return (
              <mesh 
                key={area.id} 
                position={[0, groundElevation, 0]} 
                rotation={[Math.PI / 2, 0, 0]}
                onClick={handle3DClick}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = activeTool === 'delete' ? 'not-allowed' : 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'default'; }}
              >
                <extrudeGeometry args={[shape, extrudeSettings]} />
                <meshStandardMaterial color={highlightCol} transparent opacity={isSelected3D ? 0.45 : 0.2} wireframe={!isSelected3D} />
              </mesh>
            );
          }

          const width = area.width / PIXELS_PER_METER;
          const length = area.height / PIXELS_PER_METER;
          const cx = (area.x + area.width / 2) / PIXELS_PER_METER;
          const cz = (area.y + area.height / 2) / PIXELS_PER_METER;
          
          return (
            <Box 
              key={area.id} 
              args={[width, targetDepth, length]} 
              position={[cx, groundElevation - targetDepth / 2, cz]}
              onClick={handle3DClick}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = activeTool === 'delete' ? 'not-allowed' : 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'default'; }}
            >
              <meshStandardMaterial color={highlightCol} transparent opacity={isSelected3D ? 0.45 : 0.2} wireframe={!isSelected3D} />
            </Box>
          );
        })}

        {/* Suction & Discharge Hoses (Thick 3D Tubes with dynamic height mapping and corrugations) */}
        {hoses.map(hose => {
          const isDischarge = hose.kind === 'discharge';
          const pts = hose.points.map((p: any, idx: number) => {
            const yElevation = getHosePointElevation(p, isDischarge);
            let p3D = to3D(p, yElevation);

            // Override endpoints (first and last vertex) when snapped in 2D to align with physical 3D flanges
            if (idx === 0 || idx === hose.points.length - 1) {
              placedComponents.forEach(comp => {
                const level = levels.find(l => l.id === comp.levelId);
                const levelDepth = level ? level.depthFromGL : 0;
                const compHeaderY = groundElevation - levelDepth + 0.5;
                const pos = to3D(comp, groundElevation);
                const rotationRad = (comp.rotation || 0) * (Math.PI / 180);

                const rotPt = (ox: number, oy: number, angleDeg: number) => {
                  const r = (angleDeg || 0) * (Math.PI / 180);
                  return { x: ox * Math.cos(r) - oy * Math.sin(r), y: ox * Math.sin(r) + oy * Math.cos(r) };
                };

                if (comp.type === 'pump') {
                  const portY = groundElevation - levelDepth + 0.35;
                  const distSuction = Math.sqrt((p.x - (comp.x - 20)) ** 2 + (p.y - comp.y) ** 2);
                  const distDischarge = Math.sqrt((p.x - (comp.x + 20)) ** 2 + (p.y - comp.y) ** 2);

                  if (distSuction < 30 && distSuction <= distDischarge) {
                    p3D = new THREE.Vector3(pos.x - 2.0, portY, pos.z);
                  } else if (distDischarge < 30 && distDischarge < distSuction) {
                    p3D = new THREE.Vector3(pos.x + 2.0, groundElevation - levelDepth + 1.42, pos.z);
                  }
                }

                if (comp.type === 'tee') {
                  const teeLocalPorts = [[-8, 0], [8, 0], [0, 8]];
                  const tee3DOffsets = [[-0.2, 0], [0.2, 0], [0, 0.2]];

                  let bestIdx = -1;
                  let bestDist = 30;
                  teeLocalPorts.forEach(([ox, oy], i) => {
                    const pRot2D = rotPt(ox, oy, comp.rotation || 0);
                    const dist = Math.sqrt((p.x - (comp.x + pRot2D.x)) ** 2 + (p.y - (comp.y + pRot2D.y)) ** 2);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestIdx = i;
                    }
                  });

                  if (bestIdx !== -1) {
                    const [lx, lz] = tee3DOffsets[bestIdx];
                    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotationRad);
                    p3D = new THREE.Vector3(pos.x + v.x, compHeaderY, pos.z + v.z);
                  }
                }

                if (comp.type === 'elbow') {
                  const rotElbow = (lx: number, lz: number) => {
                    const c = Math.cos(-rotationRad);
                    const s = Math.sin(-rotationRad);
                    return { x: lx * c - lz * s, z: lx * s + lz * c };
                  };
                  const elbowLocalPorts = [[-12, 0], [0, 12]];
                  const elbow3DOffsets = [[0.2, 0], [0, 0.2]];

                  let bestIdx = -1;
                  let bestDist = 30;
                  elbowLocalPorts.forEach(([ox, oy], i) => {
                    const pRot2D = rotPt(ox, oy, comp.rotation || 0);
                    const dist = Math.sqrt((p.x - (comp.x + pRot2D.x)) ** 2 + (p.y - (comp.y + pRot2D.y)) ** 2);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestIdx = i;
                    }
                  });

                  if (bestIdx !== -1) {
                    const [lx, lz] = elbow3DOffsets[bestIdx];
                    const r = rotElbow(lx, lz);
                    p3D = new THREE.Vector3(pos.x + r.x, compHeaderY, pos.z + r.z);
                  }
                }
              });
            }

            return p3D;
          });

          return (
            <TubeHose3D 
              key={hose.id} 
              points={pts} 
              color={isDischarge ? '#2563eb' : '#fbbf24'} // Blue for discharge, golden yellow for suction
              radius={isDischarge ? 0.08 : 0.07} // Thick robust pipeline hoses
              isSuction={!isDischarge}
              isSelected={selectedId === hose.id}
              onClick={() => {
                if (!activeTool || activeTool === 'select') {
                  onSelectId?.(hose.id);
                } else if (activeTool === 'delete') {
                  onHosesChange?.(hoses.filter((h: any) => h.id !== hose.id));
                  onSelectId?.(null);
                } else {
                  onSelectId?.(hose.id);
                }
              }}
            />
          );
        })}

        {/* Rigid Galvanized Steel Header Pipes (Realistic Segmented Flanged Cylinders) */}
        {segmentedHeaderPipes.map(pipe => (
          <StraightFlangedPipe3D 
            key={pipe.key} 
            start={pipe.start} 
            end={pipe.end}
            isSelected={selectedId === pipe.lineId}
            onClick={() => {
              if (!activeTool || activeTool === 'select') {
                onSelectId?.(pipe.lineId);
              } else if (activeTool === 'delete') {
                onLinesChange?.(lines.filter(l => l.id !== pipe.lineId));
                onSelectId?.(null);
              } else {
                onSelectId?.(pipe.lineId);
              }
            }}
          />
        ))}

        {/* Wellpoint Cylinders, Connector Swing Joints & Screen Filters — on selected side(s) of header */}
        {wellpoints.map((wp, i) => {
          const depth = wp.wellpointDepth;
          // Use quaternion-based orientation for the horizontal connector (same approach as StraightFlangedPipe3D)
          const yAxis = new THREE.Vector3(0, 1, 0);
          const connQuat = new THREE.Quaternion().setFromUnitVectors(yAxis, wp.connDir);
          const connLen = wp.position.distanceTo(wp.headerAttach);
          const connMid = new THREE.Vector3().addVectors(wp.headerAttach, wp.position).multiplyScalar(0.5);
          const isLineSelected = selectedId === wp.lineId;
          
          return (
            <group 
              key={`wp3d-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!activeTool || activeTool === 'select') {
                  onSelectId?.(wp.lineId);
                } else if (activeTool === 'delete') {
                  onLinesChange?.(lines.filter(l => l.id !== wp.lineId));
                  onSelectId?.(null);
                } else {
                  onSelectId?.(wp.lineId);
                }
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = activeTool === 'delete' ? 'not-allowed' : 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              {/* Invisible wider hit proxy cylinder around wellpoint for easy clicking */}
              <mesh position={[wp.position.x, wp.headerY - depth / 2, wp.position.z]}>
                <cylinderGeometry args={[0.25, 0.25, depth, 8]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>

              {/* Connector swing joint pipe — quaternion-oriented perfectly horizontal */}
              <group position={[connMid.x, wp.headerY, connMid.z]} quaternion={connQuat}>
                <mesh>
                  <cylinderGeometry args={[0.06, 0.06, connLen, 8]} />
                  <meshStandardMaterial 
                    color={isLineSelected ? "#38bdf8" : "#cbd5e1"} 
                    metalness={0.6} 
                    roughness={0.3} 
                    emissive={isLineSelected ? "#0284c7" : "#000000"}
                    emissiveIntensity={isLineSelected ? 0.35 : 0}
                  />
                </mesh>
              </group>
              {/* Header junction ball joint */}
              <mesh position={[wp.headerAttach.x, wp.headerY, wp.headerAttach.z]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial 
                  color={isLineSelected ? "#38bdf8" : "#94a3b8"} 
                  metalness={0.85} 
                  roughness={0.15} 
                />
              </mesh>
              {/* Wellpoint top cap / entry flange */}
              <mesh position={[wp.position.x, wp.headerY, wp.position.z]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 8]} />
                <meshStandardMaterial 
                  color={isLineSelected ? "#38bdf8" : "#94a3b8"} 
                  metalness={0.9} 
                  roughness={0.1} 
                />
              </mesh>
              {/* Wellpoint riser pipe (vertical, going down) */}
              <mesh position={[wp.position.x, wp.headerY - depth / 2, wp.position.z]}>
                <cylinderGeometry args={[0.04, 0.04, depth, 8]} />
                <meshStandardMaterial 
                  color={isLineSelected ? "#7dd3fc" : "#64748b"} 
                  metalness={0.7} 
                  roughness={0.3} 
                  emissive={isLineSelected ? "#0284c7" : "#000000"}
                  emissiveIntensity={isLineSelected ? 0.35 : 0}
                />
              </mesh>
              {/* Screen / Filter tip at the bottom (bright blue) */}
              <mesh position={[wp.position.x, wp.headerY - depth + screenLength / 2, wp.position.z]}>
                <cylinderGeometry args={[0.055, 0.055, screenLength, 8]} />
                <meshStandardMaterial color={isLineSelected ? "#0284c7" : "#0ea5e9"} metalness={0.8} roughness={0.1} />
              </mesh>
            </group>
          );
        })}

        {/* Placed Components (Pumps, Elbows, Tees) */}
        {placedComponents.map(comp => {
          const level = levels.find(l => l.id === comp.levelId);
          const levelDepth = level ? level.depthFromGL : 0;
          const componentY = groundElevation - levelDepth + 0.5;
          const pos = to3D(comp, groundElevation);
          const rotationRad = (comp.rotation || 0) * (Math.PI / 180);
          const isSelected3D = selectedId === comp.id;

          const handleCompClick = (e: any) => {
            e.stopPropagation();
            if (!activeTool || activeTool === 'select') {
              onSelectId?.(comp.id);
            } else if (activeTool === 'delete') {
              onPlacedComponentsChange?.(placedComponents.filter(c => c.id !== comp.id));
              onSelectId?.(null);
            } else if (activeTool === 'pin') {
              onPlacedComponentsChange?.(placedComponents.map(c => c.id === comp.id ? { ...c, locked: true } : c));
            } else if (activeTool === 'unpin') {
              onPlacedComponentsChange?.(placedComponents.map(c => c.id === comp.id ? { ...c, locked: false } : c));
            } else {
              onSelectId?.(comp.id);
            }
          };

          const compGroup = (child: React.ReactNode) => (
            <group
              key={comp.id}
              onClick={handleCompClick}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = activeTool === 'delete' ? 'not-allowed' : 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'default'; }}
            >
              {child}
              {isSelected3D && (
                <mesh position={[pos.x, groundElevation + 0.45, pos.z]}>
                  <sphereGeometry args={[0.9, 16, 16]} />
                  <meshStandardMaterial color="#facc15" transparent opacity={0.15} wireframe />
                </mesh>
              )}
            </group>
          );

          if (comp.type === 'pump') {
            return compGroup(<GehoPump3D key={comp.id} position={[pos.x, groundElevation + 0.45, pos.z]} />);
          }
          if (comp.type === 'elbow') {
            return compGroup(<Elbow3D key={comp.id} position={[pos.x, componentY, pos.z]} rotationY={-rotationRad} />);
          }
          if (comp.type === 'tee') {
            return compGroup(<Tee3D key={comp.id} position={[pos.x, componentY, pos.z]} rotationY={-rotationRad} />);
          }
          if (comp.type === 'ingress') {
            return compGroup(
              <group key={comp.id} position={[pos.x, groundElevation - levelDepth + 0.05, pos.z]}>
                {/* Sump pit outer collar */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.7, 0.9, 32]} />
                  <meshStandardMaterial color="#0284c7" />
                </mesh>
                {/* Water pool */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                  <circleGeometry args={[0.7, 32]} />
                  <meshStandardMaterial color="#0ea5e9" roughness={0.1} metalness={0.8} transparent opacity={0.85} />
                </mesh>
              </group>
            );
          }
          return null;
        })}

        {/* Automatically Placed Fittings (Elbows, Tees) */}
        {autoFittings.map((fit, i) => {
          const pos = to3D(fit, groundElevation);
          const rotationRad = (fit.rotation || 0) * (Math.PI / 180);
          
          if (fit.type === 'elbow') {
            return (
              <Elbow3D key={`auto-elbow-3d-${i}`} position={[pos.x, fit.headerY, pos.z]} rotationY={rotationRad} angle={fit.angle} />
            );
          } else {
            return (
              <Tee3D key={`auto-tee-3d-${i}`} position={[pos.x, fit.headerY, pos.z]} rotationY={rotationRad} />
            );
          }
        })}
      </Canvas>
    </div>
  );
};
