import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Cylinder } from '@react-three/drei';
import { LineData, PlacedComponent, PIXELS_PER_METER, ElevationLevel, Point } from '../../utils/simulationLogic';
import * as THREE from 'three';

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
}

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

      {/* 7. Inlet Suction Port (Left End) with Bauer coupling flange */}
      <mesh position={[-1.1, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>
      <mesh position={[-1.3, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>

      {/* 8. Discharge Head — Vertical Riser Manifold */}
      {/* 8a. Horizontal stub from pump body to riser base */}
      <mesh position={[0.95, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8b. 90° Elbow transition (torus quarter) at riser base */}
      <mesh position={[1.1, 0.0, 0]} rotation={[0, Math.PI, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.07, 12, 24, Math.PI / 2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* 8c. Vertical riser pipe (discharge head column) */}
      <mesh position={[1.22, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8d. Riser reinforcement ring (mid-height) */}
      <mesh position={[1.22, 0.35, 0]}>
        <torusGeometry args={[0.09, 0.02, 8, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 8e. Top 90° Elbow — riser to horizontal discharge outlet */}
      <mesh position={[1.22, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.07, 12, 24, Math.PI / 2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* 8f. Horizontal discharge outlet pipe */}
      <mesh position={[1.45, 0.97, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 8g. Discharge outlet Bauer coupling flange */}
      <mesh position={[1.63, 0.97, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 8h. Flange bolt ring detail */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`bolt-${i}`} position={[1.65, 0.97 + Math.sin(angle) * 0.095, Math.cos(angle) * 0.095]}>
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
        <cylinderGeometry args={[0.07, 0.07, 0.5, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Perpendicular branch pipe */}
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Left Flange */}
      <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
      {/* Right Flange */}
      <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
      {/* Branch Flange */}
      <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} />
      </mesh>
    </group>
  );
};

// Premium 3D Segmented Galvanized Steel Header Pipe with Flanged Ends
const StraightFlangedPipe3D: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = ({ start, end }) => {
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
    <group position={position} quaternion={quaternion}>
      {/* Main Pipe body */}
      <mesh>
        <cylinderGeometry args={[0.075, 0.075, length - 0.08, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
      </mesh>
      
      {/* Start Flange */}
      <mesh position={[0, -length / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* End Flange */}
      <mesh position={[0, length / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

// Thick 3D Flexible Hose Rendered as a Tube with Ribbed Corrugations for Suction Hoses
const TubeHose3D: React.FC<{ points: THREE.Vector3[]; color: string; radius: number; isSuction?: boolean }> = ({
  points,
  color,
  radius,
  isSuction = false,
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
    <group>
      {/* Main hose core tube */}
      <mesh>
        <tubeGeometry args={[curve, 60, radius, 12, false]} />
        <meshStandardMaterial 
          color={color} 
          roughness={isSuction ? 0.35 : 0.6} 
          metalness={isSuction ? 0.3 : 0.05} 
        />
      </mesh>
      
      {/* Corrugated external reinforcement spirals (suction hose exclusive) */}
      {isSuction && rings.map(r => (
        <mesh key={r.key} position={r.position} quaternion={r.quaternion}>
          <torusGeometry args={[radius + 0.015, 0.015, 8, 16]} />
          <meshStandardMaterial color="#b45309" roughness={0.1} metalness={0.5} />
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
}) => {
  const HEADER_Y = groundElevation + 0.5;
  const BOTTOM_Y = groundElevation - targetDepth;

  const to3D = (pt: { x: number; y: number }, y: number = 0) => {
    return new THREE.Vector3(pt.x / PIXELS_PER_METER, y, pt.y / PIXELS_PER_METER);
  };

  // Build segmented rigid header pipe segments in 3D (6m pieces + remainder)
  // Pipes are tangent-trimmed at corners/junctions so they don't overlap elbow fittings.
  const segmentedHeaderPipes = useMemo(() => {
    const pipes: { key: string; start: THREE.Vector3; end: THREE.Vector3 }[] = [];
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

        // T_start: junction — first segment's start meets another line's endpoint
        if (i === 0) {
          const startPt = line.points[0];
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

        // T_end: junction — last segment's end meets another line's endpoint
        if (i === line.points.length - 2) {
          const endPt = line.points[line.points.length - 1];
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
          targetY = portY + 0.9;
        }
      }

      // Tee: 3 ports — left (-15,0), right (15,0), branch (0,15)
      if (comp.type === 'tee') {
        [[-15, 0], [15, 0], [0, 15]].forEach(([ox, oy]) => {
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
    const wps: { position: THREE.Vector3; headerAttach: THREE.Vector3; connDir: THREE.Vector3; headerY: number; wellpointDepth: number }[] = [];
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
            for (const side of (wellpointSide === 'left' ? [1] : wellpointSide === 'right' ? [-1] : [1, -1])) {
              const perpX = -dirY * side;
              const perpY = dirX * side;
              const outerX = wpX + perpX * offsetPx;
              const outerY = wpY + perpY * offsetPx;
              const wpPos = to3D({ x: outerX, y: outerY }, headerY);
              // Connector direction vector in 3D (normalised horizontal)
              const connDir = new THREE.Vector3(perpX, 0, perpY).normalize();
              wps.push({ position: wpPos, headerAttach, connDir, headerY, wellpointDepth });
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

            for (const side of (wellpointSide === 'left' ? [1] : wellpointSide === 'right' ? [-1] : [1, -1])) {
              const perpX = -dirY * side;
              const perpY = dirX * side;
              const outerX = wpX + perpX * offsetPx;
              const outerY = wpY + perpY * offsetPx;
              const wpPos = to3D({ x: outerX, y: outerY }, headerY);
              const connDir = new THREE.Vector3(perpX, 0, perpY).normalize();
              wps.push({ position: wpPos, headerAttach, connDir, headerY, wellpointDepth });
            }
          }
        }
      }
    });
    return wps;
  }, [lines, groundElevation, targetDepth, levels, wellpointSide]);

  return (
    <div className="w-full h-full bg-slate-900 dewatering-3d-view">
      <Canvas camera={{ position: [15, 12, 15], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[10, 20, 10]} intensity={1.3} castShadow />
        <directionalLight position={[-10, 15, -10]} intensity={0.5} />
        <OrbitControls 
          makeDefault 
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN
          }}
        />

        {/* Ground Reference Grid */}
        <Grid 
          position={[0, groundElevation, 0]} 
          args={[100, 100]} 
          cellSize={1} 
          cellThickness={1} 
          cellColor="#475569" 
          sectionSize={10} 
          sectionThickness={1.5} 
          sectionColor="#64748b" 
          fadeDistance={50} 
        />

        {/* Excavation Areas */}
        {areas.map(area => {
          const width = area.width / PIXELS_PER_METER;
          const length = area.height / PIXELS_PER_METER;
          const cx = (area.x + area.width / 2) / PIXELS_PER_METER;
          const cz = (area.y + area.height / 2) / PIXELS_PER_METER;
          
          return (
            <Box 
              key={area.id} 
              args={[width, targetDepth, length]} 
              position={[cx, groundElevation - targetDepth / 2, cz]}
            >
              <meshStandardMaterial color="#f87171" transparent opacity={0.25} wireframe />
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
                    p3D = new THREE.Vector3(pos.x - 1.3, portY, pos.z);
                  } else if (distDischarge < 30 && distDischarge < distSuction) {
                    p3D = new THREE.Vector3(pos.x + 1.63, portY + 0.9, pos.z);
                  }
                }

                if (comp.type === 'tee') {
                  const rotTee = (lx: number, lz: number) => {
                    const c = Math.cos(-rotationRad);
                    const s = Math.sin(-rotationRad);
                    return { x: lx * c - lz * s, z: lx * s + lz * c };
                  };
                  const teeLocalPorts = [[-15, 0], [15, 0], [0, 15]];
                  const tee3DOffsets = [[-0.25, 0], [0.25, 0], [0, 0.3]];

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
                    const r = rotTee(lx, lz);
                    p3D = new THREE.Vector3(pos.x + r.x, compHeaderY, pos.z + r.z);
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
            />
          );
        })}

        {/* Rigid Galvanized Steel Header Pipes (Realistic Segmented Flanged Cylinders) */}
        {segmentedHeaderPipes.map(pipe => (
          <StraightFlangedPipe3D key={pipe.key} start={pipe.start} end={pipe.end} />
        ))}

        {/* Wellpoint Cylinders, Connector Swing Joints & Screen Filters — on selected side(s) of header */}
        {wellpoints.map((wp, i) => {
          const depth = wp.wellpointDepth;
          // Use quaternion-based orientation for the horizontal connector (same approach as StraightFlangedPipe3D)
          const yAxis = new THREE.Vector3(0, 1, 0);
          const connQuat = new THREE.Quaternion().setFromUnitVectors(yAxis, wp.connDir);
          const connLen = wp.position.distanceTo(wp.headerAttach);
          const connMid = new THREE.Vector3().addVectors(wp.headerAttach, wp.position).multiplyScalar(0.5);
          
          return (
            <group key={`wp3d-${i}`}>
              {/* Connector swing joint pipe — quaternion-oriented perfectly horizontal */}
              <group position={[connMid.x, wp.headerY, connMid.z]} quaternion={connQuat}>
                <mesh>
                  <cylinderGeometry args={[0.06, 0.06, connLen, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
                </mesh>
              </group>
              {/* Header junction ball joint */}
              <mesh position={[wp.headerAttach.x, wp.headerY, wp.headerAttach.z]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
              </mesh>
              {/* Wellpoint top cap / entry flange */}
              <mesh position={[wp.position.x, wp.headerY, wp.position.z]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Wellpoint riser pipe (vertical, going down) */}
              <mesh position={[wp.position.x, wp.headerY - depth / 2, wp.position.z]}>
                <cylinderGeometry args={[0.04, 0.04, depth, 8]} />
                <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Screen / Filter tip at the bottom (bright blue) */}
              <mesh position={[wp.position.x, wp.headerY - depth + screenLength / 2, wp.position.z]}>
                <cylinderGeometry args={[0.055, 0.055, screenLength, 8]} />
                <meshStandardMaterial color="#0ea5e9" metalness={0.8} roughness={0.1} />
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
          
          if (comp.type === 'pump') {
            return (
              <GehoPump3D key={comp.id} position={[pos.x, groundElevation + 0.45, pos.z]} />
            );
          }
          if (comp.type === 'elbow') {
            return (
              <Elbow3D key={comp.id} position={[pos.x, componentY, pos.z]} rotationY={-rotationRad} />
            );
          }
          if (comp.type === 'tee') {
            return (
              <Tee3D key={comp.id} position={[pos.x, componentY, pos.z]} rotationY={-rotationRad} />
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
