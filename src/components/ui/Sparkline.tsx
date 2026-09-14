import React, { useMemo } from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDot?: boolean;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = React.memo(({
  data,
  width = 96,
  height = 28,
  color = 'currentColor',
  strokeWidth = 1.5,
  showDot = true,
  className = '',
}) => {
  const points = useMemo(() => {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = strokeWidth * 1.5;

    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    const pts = data.map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * effectiveWidth;
      const y = height - padding - ((val - min) / range) * effectiveHeight;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    // Build SVG path
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x} ${pts[i].y}`;
    }

    const lastPoint = pts[pts.length - 1];

    return { path, lastPoint };
  }, [data, width, height, strokeWidth]);

  if (!points) {
    return (
      <div
        style={{ width, height }}
        className={`flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 ${className}`}
      >
        <span className="h-[1px] w-full bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={`overflow-visible shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d={points.path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && (
        <circle
          cx={points.lastPoint.x}
          cy={points.lastPoint.y}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
});

Sparkline.displayName = 'Sparkline';
