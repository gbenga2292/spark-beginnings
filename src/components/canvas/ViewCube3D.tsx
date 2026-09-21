import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Home, ChevronDown } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export type CubeFace = 'TOP' | 'BOTTOM' | 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' | 'ISOMETRIC';

interface ViewCube3DProps {
  camera: THREE.Camera | null;
  controls: any; // OrbitControls instance
  onAnimateCamera?: (targetPos: THREE.Vector3, targetLookAt: THREE.Vector3) => void;
  className?: string;
}

export const ViewCube3D: React.FC<ViewCube3DProps> = ({
  camera,
  controls,
  onAnimateCamera,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [hoveredFace, setHoveredFace] = useState<string | null>(null);
  const [cubeTransform, setCubeTransform] = useState<string>('rotateX(30deg) rotateY(-45deg)');
  const [compassRotation, setCompassRotation] = useState<number>(0);
  const [showMenu, setShowMenu] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync ViewCube orientation with actual Three.js camera
  const updateCubeOrientation = useCallback(() => {
    if (!camera) return;

    // Camera offset vector from target
    const target = controls?.target || new THREE.Vector3(0, 0, 0);
    const offset = new THREE.Vector3().subVectors(camera.position, target);
    
    if (offset.lengthSq() < 0.0001) return;

    const radius = offset.length();
    // Azimuth around Y axis
    const theta = Math.atan2(offset.x, offset.z);
    // Elevation above ground plane
    const phi = Math.asin(Math.max(-1, Math.min(1, offset.y / radius)));

    const degX = THREE.MathUtils.radToDeg(phi);
    const degY = THREE.MathUtils.radToDeg(theta);

    // In CSS 3D:
    // rotateX(degX) tilts top towards viewer
    // rotateY(-degY) rotates around vertical axis matching world camera
    setCubeTransform(`rotateX(${degX}deg) rotateY(${-degY}deg)`);
    setCompassRotation(-degY);
  }, [camera, controls]);

  useEffect(() => {
    let animFrame: number;
    const loop = () => {
      updateCubeOrientation();
      animFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animFrame);
  }, [updateCubeOrientation]);

  // Smooth camera animation helper
  const snapToView = (face: CubeFace) => {
    setShowMenu(false);
    if (!camera || !controls) return;

    const target = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const curDist = Math.max(12, camera.position.distanceTo(target));
    let newPos = new THREE.Vector3();

    switch (face) {
      case 'TOP':
        newPos.set(target.x + 0.001, target.y + curDist, target.z);
        break;
      case 'BOTTOM':
        newPos.set(target.x + 0.001, target.y - curDist, target.z);
        break;
      case 'FRONT': // South view (+Z looking towards origin)
        newPos.set(target.x, target.y + 0.5, target.z + curDist);
        break;
      case 'BACK': // North view (-Z looking towards origin)
        newPos.set(target.x, target.y + 0.5, target.z - curDist);
        break;
      case 'RIGHT': // East view (+X looking towards origin)
        newPos.set(target.x + curDist, target.y + 0.5, target.z);
        break;
      case 'LEFT': // West view (-X looking towards origin)
        newPos.set(target.x - curDist, target.y + 0.5, target.z);
        break;
      case 'ISOMETRIC':
      default:
        // Default standard Revit 3D isometric angle
        const isoDist = Math.max(16, curDist);
        newPos.set(target.x + isoDist * 0.7, target.y + isoDist * 0.55, target.z + isoDist * 0.7);
        break;
    }

    if (onAnimateCamera) {
      onAnimateCamera(newPos, target);
    } else {
      animateCameraManual(camera, controls, newPos, target);
    }
  };

  const animateCameraManual = (
    cam: THREE.Camera,
    ctrl: any,
    targetPosition: THREE.Vector3,
    targetLookAt: THREE.Vector3
  ) => {
    const startPos = cam.position.clone();
    const startTarget = ctrl.target ? ctrl.target.clone() : new THREE.Vector3(0, 0, 0);
    const duration = 350; // ms
    const startTime = performance.now();

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      cam.position.lerpVectors(startPos, targetPosition, ease);
      if (ctrl.target) {
        ctrl.target.lerpVectors(startTarget, targetLookAt, ease);
      }
      cam.lookAt(ctrl.target || targetLookAt);
      ctrl.update();

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      }
    };
    requestAnimationFrame(animateStep);
  };

  // Drag-to-orbit functionality directly on the ViewCube
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !camera || !controls) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const target = controls.target || new THREE.Vector3(0, 0, 0);
    const offset = new THREE.Vector3().subVectors(camera.position, target);
    
    const rotSpeed = 0.008;
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * rotSpeed);

    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), offset).normalize();
    offset.applyAxisAngle(right, -dy * rotSpeed);

    camera.position.addVectors(target, offset);
    camera.lookAt(target);
    controls.update();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const cubeSize = 64; // px
  const halfSize = cubeSize / 2;

  // Solid Revit-style metallic CAD shading tokens:
  // Top face receives most light, front mid-tone, right slightly darker
  const topColor = isDark ? '#475569' : '#f1f5f9';
  const frontColor = isDark ? '#334155' : '#e2e8f0';
  const sideColor = isDark ? '#1e293b' : '#cbd5e1';
  const borderColor = isDark ? '#64748b' : '#94a3b8';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  const hoverFill = '#38bdf8'; // Sky blue highlight like in Revit reference
  const hoverText = '#ffffff';

  const compassBg = isDark ? '#0f172a' : '#ffffff';
  const compassBorder = isDark ? '#334155' : '#cbd5e1';
  const compassLabel = isDark ? '#94a3b8' : '#475569';

  return (
    <div 
      className={`relative select-none pointer-events-auto flex flex-col items-center justify-center p-1 rounded-xl transition-all ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Top Header: Home Button + Menu dropdown */}
      <div className="w-full flex items-center justify-between mb-0.5 px-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            snapToView('ISOMETRIC');
          }}
          className={`p-1 rounded-md transition-all cursor-pointer shadow-xs ${
            isDark 
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700' 
              : 'bg-white/95 hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200'
          }`}
          title="Home View (Default 3D Isometric)"
          aria-label="Home View"
        >
          <Home className="w-3 h-3" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`p-0.5 rounded transition-all cursor-pointer ${
              isDark 
                ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
            title="View Options"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Revit View Options Dropdown */}
          {showMenu && (
            <div 
              className={`absolute right-0 top-6 w-36 rounded-lg shadow-xl border text-[11px] py-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                isDark 
                  ? 'bg-slate-900 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Standard Views
              </div>
              <button 
                onClick={() => snapToView('TOP')} 
                className="w-full text-left px-2.5 py-1 hover:bg-sky-50 dark:hover:bg-slate-800 flex justify-between"
              >
                <span>Top (Plan)</span>
                <span className="font-mono text-slate-400">Y+</span>
              </button>
              <button 
                onClick={() => snapToView('FRONT')} 
                className="w-full text-left px-2.5 py-1 hover:bg-sky-50 dark:hover:bg-slate-800 flex justify-between"
              >
                <span>Front (South)</span>
                <span className="font-mono text-slate-400">Z+</span>
              </button>
              <button 
                onClick={() => snapToView('BACK')} 
                className="w-full text-left px-2.5 py-1 hover:bg-sky-50 dark:hover:bg-slate-800 flex justify-between"
              >
                <span>Back (North)</span>
                <span className="font-mono text-slate-400">Z-</span>
              </button>
              <button 
                onClick={() => snapToView('RIGHT')} 
                className="w-full text-left px-2.5 py-1 hover:bg-sky-50 dark:hover:bg-slate-800 flex justify-between"
              >
                <span>Right (East)</span>
                <span className="font-mono text-slate-400">X+</span>
              </button>
              <button 
                onClick={() => snapToView('LEFT')} 
                className="w-full text-left px-2.5 py-1 hover:bg-sky-50 dark:hover:bg-slate-800 flex justify-between"
              >
                <span>Left (West)</span>
                <span className="font-mono text-slate-400">X-</span>
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button 
                onClick={() => snapToView('ISOMETRIC')} 
                className="w-full text-left px-2.5 py-1 font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800"
              >
                Default Isometric
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D ViewCube & Compass Disc */}
      <div className="relative w-28 h-28 flex items-center justify-center cursor-grab active:cursor-grabbing">
        
        {/* Cardinal Compass Ring (rotates with scene azimuth) */}
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ transform: `rotate(${compassRotation}deg)` }}
        >
          <svg className="w-28 h-28" viewBox="0 0 120 120">
            {/* Outer ring */}
            <circle cx="60" cy="60" r="54" fill={compassBg} fillOpacity="0.9" stroke={compassBorder} strokeWidth="1.5" />
            <circle cx="60" cy="60" r="45" fill="none" stroke={compassBorder} strokeWidth="1" strokeDasharray="3 2" />
            
            {/* Cardinal points */}
            <text x="60" y="16" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="900" fill="#ef4444">N</text>
            <text x="60" y="106" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={compassLabel}>S</text>
            <text x="106" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={compassLabel}>E</text>
            <text x="14" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={compassLabel}>W</text>
          </svg>
        </div>

        {/* Solid 3D Cube Container */}
        <div 
          className="relative"
          style={{
            perspective: '500px',
            perspectiveOrigin: '50% 50%',
          }}
        >
          <div
            className="transition-transform duration-75 ease-out"
            style={{
              width: `${cubeSize}px`,
              height: `${cubeSize}px`,
              transformStyle: 'preserve-3d',
              transform: cubeTransform,
            }}
          >
            {/* 1. TOP Face (+Y, normal pointing up, North at top of screen) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer shadow-sm"
              style={{
                transform: `rotateX(-90deg) translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'TOP' ? hoverFill : topColor,
                color: hoveredFace === 'TOP' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('TOP')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('TOP'); }}
            >
              TOP
            </div>

            {/* 2. BOTTOM Face (-Y, normal pointing down) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer"
              style={{
                transform: `rotateX(90deg) translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'BOTTOM' ? hoverFill : sideColor,
                color: hoveredFace === 'BOTTOM' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('BOTTOM')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('BOTTOM'); }}
            >
              BOTTOM
            </div>

            {/* 3. FRONT Face (South +Z) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer shadow-sm"
              style={{
                transform: `translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'FRONT' ? hoverFill : frontColor,
                color: hoveredFace === 'FRONT' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('FRONT')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('FRONT'); }}
            >
              FRONT
            </div>

            {/* 4. BACK Face (North -Z) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer"
              style={{
                transform: `rotateY(180deg) translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'BACK' ? hoverFill : sideColor,
                color: hoveredFace === 'BACK' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('BACK')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('BACK'); }}
            >
              BACK
            </div>

            {/* 5. RIGHT Face (East +X) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer shadow-sm"
              style={{
                transform: `rotateY(90deg) translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'RIGHT' ? hoverFill : sideColor,
                color: hoveredFace === 'RIGHT' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('RIGHT')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('RIGHT'); }}
            >
              RIGHT
            </div>

            {/* 6. LEFT Face (West -X) */}
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-[10px] tracking-wider transition-colors cursor-pointer"
              style={{
                transform: `rotateY(-90deg) translateZ(${halfSize}px)`,
                backgroundColor: hoveredFace === 'LEFT' ? hoverFill : sideColor,
                color: hoveredFace === 'LEFT' ? hoverText : textColor,
                border: `1px solid ${borderColor}`,
                backfaceVisibility: 'hidden',
              }}
              onMouseEnter={() => setHoveredFace('LEFT')}
              onMouseLeave={() => setHoveredFace(null)}
              onClick={(e) => { e.stopPropagation(); snapToView('LEFT'); }}
            >
              LEFT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
