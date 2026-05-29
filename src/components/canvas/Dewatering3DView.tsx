import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Box, Cylinder, Sphere } from '@react-three/drei';
import { LineData, PlacedComponent, PIXELS_PER_METER, ElevationLevel } from '../../utils/simulationLogic';
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
}

export const Dewatering3DView: React.FC<Dewatering3DViewProps> = ({
  lines,
  placedComponents,
  areas,
  hoses,
  groundElevation,
  targetDepth,
  screenLength,
  levels = [],
}) => {
  // We center the 3D scene around the average points of the 2D layout.
  // To keep things simple, 1 unit in 3D = 1 meter.
  
  // Header height above ground
  const HEADER_Y = groundElevation + 0.5;
  const BOTTOM_Y = groundElevation - targetDepth;

  // Convert 2D pixel point to 3D world coords
  const to3D = (pt: { x: number, y: number }, y: number = 0) => {
    return new THREE.Vector3(pt.x / PIXELS_PER_METER, y, pt.y / PIXELS_PER_METER);
  };

  const headerPipes = useMemo(() => {
    return lines.map(line => {
      const level = levels.find(l => l.id === line.levelId);
      const levelDepth = level ? level.depthFromGL : 0;
      const depthOffset = line.depthFromGL !== undefined ? line.depthFromGL : levelDepth;
      const headerY = groundElevation - depthOffset + 0.5;
      const pts = line.points.map(p => to3D(p, headerY));
      return { id: line.id, pts, raw: line, headerY };
    });
  }, [lines, groundElevation, levels]);

  const wellpoints = useMemo(() => {
    const wps: { position: THREE.Vector3, headerY: number, wellpointDepth: number }[] = [];
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
        
        const headerLengthPx = 6 * PIXELS_PER_METER;
        const wpDistPx = headerLengthPx / 6;
        let traveled = wpDistPx / 2;
        
        while (traveled <= distPx) {
          const t = traveled / distPx;
          const wpX = p1.x + dx * t;
          const wpY = p1.y + dy * t;
          const perpX = -dy / distPx;
          const perpY = dx / distPx;
          const outerX = wpX + perpX * 8;
          const outerY = wpY + perpY * 8;
          
          wps.push({ position: to3D({ x: outerX, y: outerY }, headerY), headerY, wellpointDepth });
          traveled += wpDistPx;
        }
      }
    });
    return wps;
  }, [lines, groundElevation, targetDepth, levels]);

  return (
    <div className="w-full h-full bg-slate-900 dewatering-3d-view">
      <Canvas camera={{ position: [20, 20, 20], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
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
          cellColor="#64748b" 
          sectionSize={10} 
          sectionThickness={1.5} 
          sectionColor="#94a3b8" 
          fadeDistance={50} 
        />

        {/* Areas (Excavation) */}
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
              <meshStandardMaterial color="#fca5a5" transparent opacity={0.3} wireframe />
            </Box>
          );
        })}

        {/* Hoses */}
        {hoses.map(hose => {
          const pts = hose.points.map((p: any) => to3D(p, groundElevation + 0.1));
          return (
            <Line key={hose.id} points={pts} color="#eab308" lineWidth={5} />
          );
        })}

        {/* Header Pipes */}
        {headerPipes.map(hp => (
          <Line key={hp.id} points={hp.pts} color="#0369a1" lineWidth={8} />
        ))}

        {/* Wellpoints */}
        {wellpoints.map((wp, i) => {
          const depth = wp.wellpointDepth; // From header down to bottom
          return (
            <group key={`wp3d-${i}`} position={[wp.position.x, wp.headerY - depth / 2, wp.position.z]}>
              <Cylinder args={[0.05, 0.05, depth, 8]}>
                <meshStandardMaterial color="#38bdf8" />
              </Cylinder>
              {/* Screen filter at the bottom */}
              <Cylinder args={[0.06, 0.06, screenLength, 8]} position={[0, -depth / 2 + screenLength / 2, 0]}>
                <meshStandardMaterial color="#0284c7" />
              </Cylinder>
            </group>
          );
        })}

        {/* Components */}
        {placedComponents.map(comp => {
          const level = levels.find(l => l.id === comp.levelId);
          const levelDepth = level ? level.depthFromGL : 0;
          const componentY = groundElevation - levelDepth + 0.5;
          const pos = to3D(comp, groundElevation);
          if (comp.type === 'pump') {
            return (
              <group key={comp.id} position={[pos.x, groundElevation + 1, pos.z]}>
                <Box args={[2, 2, 3]}>
                  <meshStandardMaterial color="#0ea5e9" />
                </Box>
              </group>
            );
          }
          if (comp.type === 'elbow' || comp.type === 'tee') {
            return (
              <Sphere key={comp.id} args={[0.3, 16, 16]} position={[pos.x, componentY, pos.z]}>
                <meshStandardMaterial color={comp.type === 'tee' ? '#10b981' : '#f59e0b'} />
              </Sphere>
            );
          }
          return null;
        })}
      </Canvas>
    </div>
  );
};
