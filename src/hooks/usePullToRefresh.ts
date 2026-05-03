import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  /** Minimum pull distance (px) before refresh fires. Default: 72 */
  threshold?: number;
  /** Max visual pull distance before rubber-band caps it. Default: 110 */
  maxPull?: number;
  /** Called when user releases past threshold. Defaults to page reload. */
  onRefresh?: () => void | Promise<void>;
}

export interface PullToRefreshState {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

/**
 * Attaches touch listeners to `containerRef`.
 * Only activates when the container is scrolled to the very top.
 */
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement>,
  options: UsePullToRefreshOptions = {},
): PullToRefreshState {
  const { threshold = 72, maxPull = 110, onRefresh } = options;

  const [state, setState] = useState<PullToRefreshState>({
    pullDistance: 0,
    isRefreshing: false,
    isPulling: false,
  });

  // Keep refs so touch handlers always read latest values without stale closures
  const startYRef = useRef(0);
  const currentPullRef = useRef(0);   // live pull distance
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    isPullingRef.current = false;
    currentPullRef.current = 0;

    setState({ pullDistance: 0, isPulling: false, isRefreshing: true });

    try {
      if (onRefresh) {
        await onRefresh();
        isRefreshingRef.current = false;
        setState({ pullDistance: 0, isPulling: false, isRefreshing: false });
      } else {
        // Give spinner a beat to show before hard reload
        await new Promise(r => setTimeout(r, 700));
        window.location.reload();
      }
    } catch {
      isRefreshingRef.current = false;
      setState({ pullDistance: 0, isPulling: false, isRefreshing: false });
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (el.scrollTop > 2) return;          // not at the top → ignore
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (el.scrollTop > 2) return;

      const delta = e.touches[0].clientY - startYRef.current;

      if (delta <= 0) {
        if (isPullingRef.current) {
          isPullingRef.current = false;
          currentPullRef.current = 0;
          setState({ pullDistance: 0, isPulling: false, isRefreshing: false });
        }
        return;
      }

      // Prevent the browser's native pull-to-refresh / over-scroll
      if (delta > 4) e.preventDefault();

      // Rubber-band easing: slows down the further you pull
      const eased = Math.min(maxPull, delta * (1 - delta / (maxPull * 4)));
      const clamped = Math.max(0, Math.min(eased, maxPull));

      isPullingRef.current = true;
      currentPullRef.current = clamped;
      setState({ pullDistance: clamped, isPulling: true, isRefreshing: false });
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current) return;
      const dist = currentPullRef.current;

      isPullingRef.current = false;
      currentPullRef.current = 0;

      if (dist >= threshold) {
        triggerRefresh();
      } else {
        setState({ pullDistance: 0, isPulling: false, isRefreshing: false });
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef, threshold, maxPull, triggerRefresh]);

  return state;
}
