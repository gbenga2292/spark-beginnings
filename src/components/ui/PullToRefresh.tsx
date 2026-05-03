import { useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/src/hooks/usePullToRefresh';
import { useTheme } from '@/src/hooks/useTheme';

interface PullToRefreshProps {
  /** The ref of the scrollable container to watch. */
  scrollRef: React.RefObject<HTMLElement>;
  /** Optional custom refresh handler. Defaults to window.location.reload(). */
  onRefresh?: () => void | Promise<void>;
}

/**
 * Renders a pull-to-refresh indicator above the scroll container.
 * Visible only on touch devices (hidden via CSS on non-touch).
 */
export function PullToRefresh({ scrollRef, onRefresh }: PullToRefreshProps) {
  const { isDark } = useTheme();

  const { pullDistance, isRefreshing, isPulling } = usePullToRefresh(scrollRef, {
    threshold: 72,
    maxPull: 110,
    onRefresh,
  });

  // Nothing to show — skip render entirely
  const isVisible = isPulling || isRefreshing;
  if (!isVisible && pullDistance === 0) return null;

  const progress = Math.min(pullDistance / 72, 1); // 0 → 1
  const hasTriggered = pullDistance >= 72;

  return (
    // The indicator slides down from the top of the scroll container
    <div
      aria-live="polite"
      aria-label={isRefreshing ? 'Refreshing…' : hasTriggered ? 'Release to refresh' : 'Pull to refresh'}
      style={{
        // Translate it into view as the user pulls
        transform: `translateY(${isRefreshing ? 48 : pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      className={[
        // Fixed at the very top, full-width, centered content
        'ptr-indicator',
        'absolute top-0 left-0 right-0 z-50',
        'flex items-center justify-center',
        // Translate starts at -48px (hidden above viewport)
        '-translate-y-12',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium',
          'select-none pointer-events-none',
          isDark
            ? 'bg-slate-800 text-slate-100 border border-slate-700'
            : 'bg-white text-slate-700 border border-slate-200',
        ].join(' ')}
      >
        <RefreshCw
          className={[
            'h-4 w-4 transition-transform',
            isRefreshing ? 'animate-spin' : '',
          ].join(' ')}
          style={
            !isRefreshing
              ? { transform: `rotate(${progress * 360}deg)` }
              : undefined
          }
        />
        <span>
          {isRefreshing
            ? 'Refreshing…'
            : hasTriggered
            ? 'Release to refresh'
            : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
