import { Point } from './simulationLogic';

export const SNAP_THRESHOLD = 15; // Pixels – general snapping
export const CONN_SNAP_THRESHOLD = 30; // Pixels – magnetic pull for open connection ports

export type SnapPoint = {
  pt: Point;
  type: 'endpoint' | 'midpoint' | 'intersection' | 'nearest' | 'connection';
};

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function getNearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const len2 = atob.x * atob.x + atob.y * atob.y;
  let dot = atop.x * atob.x + atop.y * atob.y;
  let t = Math.min(1, Math.max(0, dot / len2));
  if (isNaN(t)) t = 0;
  return {
    x: a.x + atob.x * t,
    y: a.y + atob.y * t,
  };
}

/** High-priority magnetic snap for explicit connection ports (pump/tee/elbow).
 *  Returns the nearest port within CONN_SNAP_THRESHOLD, or null. */
export function findConnectionSnap(
  cursor: Point,
  connectionPoints: { id: string; pt: Point }[]
): SnapPoint | null {
  let best: SnapPoint | null = null;
  let minDist = CONN_SNAP_THRESHOLD;

  for (const cp of connectionPoints) {
    const d = distance(cursor, cp.pt);
    if (d < minDist) {
      minDist = d;
      best = { pt: cp.pt, type: 'connection' };
    }
  }
  return best;
}

export function findSnapPoint(
  cursor: Point,
  lines: { id: string; points: Point[] }[],
  options = { endpoint: true, midpoint: true, nearest: true }
): SnapPoint | null {
  let bestSnap: SnapPoint | null = null;
  let minDistance = SNAP_THRESHOLD;

  for (const line of lines) {
    if (line.points.length < 2) continue;

    for (let i = 0; i < line.points.length - 1; i++) {
      const p1 = line.points[i];
      const p2 = line.points[i + 1];

      // Endpoints
      if (options.endpoint) {
        const d1 = distance(cursor, p1);
        if (d1 < minDistance) {
          minDistance = d1;
          bestSnap = { pt: p1, type: 'endpoint' };
        }
        const d2 = distance(cursor, p2);
        if (d2 < minDistance) {
          minDistance = d2;
          bestSnap = { pt: p2, type: 'endpoint' };
        }
      }

      // Midpoints
      if (options.midpoint) {
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const dMid = distance(cursor, mid);
        if (dMid < minDistance) {
          minDistance = dMid;
          bestSnap = { pt: mid, type: 'midpoint' };
        }
      }

      // Nearest
      if (options.nearest && minDistance > SNAP_THRESHOLD * 0.5) {
        const nearest = getNearestPointOnSegment(cursor, p1, p2);
        const dNear = distance(cursor, nearest);
        if (dNear < minDistance) {
          minDistance = dNear;
          bestSnap = { pt: nearest, type: 'nearest' };
        }
      }
    }
  }

  return bestSnap;
}
