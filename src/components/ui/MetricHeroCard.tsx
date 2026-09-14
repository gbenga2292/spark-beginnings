import React from 'react';
import { Sparkline } from './Sparkline';

export interface SecondaryMetric {
  label: string;
  value: string | number;
  period?: string;
  sparklineData?: number[];
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

export interface MetricHeroCardProps {
  primary?: {
    label: string;
    value: string | number;
    unit?: string;
    period?: string;
    sparklineData?: number[];
    delta?: string;
    deltaType?: 'positive' | 'negative' | 'neutral';
    footnote?: string;
  };
  secondary?: SecondaryMetric[];
  // Flat convenience props
  title?: string;
  heroLabel?: string;
  heroValue?: string | number;
  heroUnit?: string;
  period?: string;
  sparklineData?: number[];
  secondaryMetrics?: Array<{ 
    label: string; 
    value: string | number; 
    subValue?: string; 
    period?: string; 
    tone?: string; 
    delta?: string;
    deltaType?: 'positive' | 'negative' | 'neutral';
  }>;
  className?: string;
}

const TONE_STYLES: Record<string, { bg: string; glow: string }> = {
  positive: {
    bg: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    glow: 'rgba(52,211,153,0.28)',
  },
  negative: {
    bg: 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)',
    glow: 'rgba(251,113,133,0.28)',
  },
  neutral: {
    bg: 'linear-gradient(135deg, #334155 0%, #64748b 100%)',
    glow: 'rgba(100,116,139,0.22)',
  },
};

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const MetricHeroCard: React.FC<MetricHeroCardProps> = ({
  primary,
  secondary,
  title,
  heroLabel,
  heroValue,
  heroUnit,
  period,
  sparklineData,
  secondaryMetrics,
  className = '',
}) => {
  const effectivePrimary = primary ?? {
    label: heroLabel || title || 'Key Metric',
    value: heroValue ?? 0,
    unit: heroUnit,
    period: period || '',
    sparklineData,
  };

  const effectiveSecondary: SecondaryMetric[] = secondary ?? (secondaryMetrics?.map(m => ({
    label: m.label,
    value: m.value,
    period: m.subValue || m.period,
    delta: m.delta,
    deltaType: m.deltaType || (m.tone as any) || 'neutral',
  })) || []);

  const secondaryCount = Math.min(effectiveSecondary.length, 3);
  const secondaryGridCols =
    secondaryCount === 1 ? 'grid-cols-1' : secondaryCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div
      className={`rounded-xl overflow-hidden border border-white/10 ${className}`}
      style={{ boxShadow: '0 4px 20px rgba(14,165,233,0.12), 0 2px 6px rgba(0,0,0,0.14)' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* ── Hero Panel ── */}
        <div
          className="lg:col-span-5 relative overflow-hidden flex flex-col justify-center px-3.5 py-2.5 sm:px-5 sm:py-3.5"
          style={{ background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }}
        >
          {/* Decorative orb */}
          <div
            className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.10)', filter: 'blur(20px)' }}
          />
          {/* Noise */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{ backgroundImage: NOISE_BG }}
          />

          <div className="relative z-10 flex flex-col justify-between h-full min-h-0 sm:min-h-[58px]">
            {/* Top Label & Period Row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-white/75 truncate">
                {effectivePrimary.label}
              </span>
              {effectivePrimary.period && (
                <span className="text-[9px] sm:text-[10px] font-mono text-white/55 tabular-nums truncate max-w-[55%] text-right">
                  {effectivePrimary.period}
                </span>
              )}
            </div>

            {/* Value, Delta & Sparkline Row */}
            <div className="flex items-end justify-between gap-2 mt-0.5 sm:mt-1">
              <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <span
                  className="text-xl sm:text-3xl font-black font-mono tracking-tight text-white tabular-nums leading-none"
                  style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
                >
                  {effectivePrimary.value}
                </span>
                {effectivePrimary.unit && (
                  <span className="text-xs sm:text-sm font-semibold text-white/75">{effectivePrimary.unit}</span>
                )}
                {effectivePrimary.delta && (
                  <span
                    className="text-[9px] sm:text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full inline-flex items-center shadow-sm"
                    style={{
                      background:
                        effectivePrimary.deltaType === 'negative'
                          ? 'rgba(239,68,68,0.30)'
                          : effectivePrimary.deltaType === 'positive'
                          ? 'rgba(52,211,153,0.30)'
                          : 'rgba(255,255,255,0.18)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {effectivePrimary.delta}
                  </span>
                )}
              </div>

              {effectivePrimary.sparklineData && effectivePrimary.sparklineData.length > 1 && (
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <Sparkline
                    data={effectivePrimary.sparklineData}
                    width={70}
                    height={18}
                    color="rgba(255,255,255,0.85)"
                  />
                </div>
              )}
            </div>

            {/* Footnote if exists */}
            {effectivePrimary.footnote && (
              <div className="text-[9px] sm:text-[10px] font-mono text-white/55 truncate mt-0.5 sm:mt-1">
                {effectivePrimary.footnote}
              </div>
            )}
          </div>
        </div>

        {/* ── Secondary Metric Tiles (Always side-by-side in single row on mobile) ── */}
        <div className={`lg:col-span-7 grid ${secondaryGridCols} divide-x divide-white/10 border-t lg:border-t-0 border-white/10`}>
          {effectiveSecondary.slice(0, 3).map((item, idx) => {
            const tone = TONE_STYLES[(item.deltaType as string) || 'neutral'] ?? TONE_STYLES.neutral;
            return (
              <div
                key={idx}
                className="relative overflow-hidden flex flex-col justify-center px-2 py-2 sm:px-4 sm:py-3.5"
                style={{ background: tone.bg, boxShadow: `inset 0 0 24px ${tone.glow}` }}
              >
                {/* Sheen */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 60%)' }}
                />
                {/* Noise */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.04]"
                  style={{ backgroundImage: NOISE_BG }}
                />

                <div className="relative z-10 flex flex-col justify-between h-full min-h-0 sm:min-h-[58px]">
                  {/* Label + Delta */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] sm:text-[10px] font-bold text-white/60 tracking-wider uppercase truncate">
                      {item.label}
                    </span>
                    {item.delta && (
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold tabular-nums text-white/90 shrink-0">
                        {item.delta}
                      </span>
                    )}
                  </div>

                  {/* Value + Sparkline */}
                  <div className="flex items-baseline justify-between gap-1.5 mt-0.5 sm:mt-1">
                    <div className="text-base sm:text-2xl font-black font-mono tracking-tight tabular-nums text-white leading-none">
                      {item.value}
                    </div>
                    {item.sparklineData && item.sparklineData.length > 1 && (
                      <Sparkline
                        data={item.sparklineData}
                        width={42}
                        height={14}
                        color="rgba(255,255,255,0.7)"
                        strokeWidth={1.2}
                        showDot={false}
                      />
                    )}
                  </div>

                  {/* Subtext / Period */}
                  {item.period && (
                    <div className="text-[8.5px] sm:text-[10px] font-mono text-white/45 truncate mt-0.5">
                      {item.period}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
