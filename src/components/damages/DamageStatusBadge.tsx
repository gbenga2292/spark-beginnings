import { DamageSeverity, DamageStatus } from '../../types/damage';

interface StatusBadgeProps {
  status: DamageStatus;
  className?: string;
}

export function DamageStatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config: Record<DamageStatus, { label: string; bg: string; text: string; dot: string }> = {
    reported: {
      label: 'Reported',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    under_assessment: {
      label: 'Under Assessment',
      bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60',
      text: 'text-sky-700 dark:text-sky-400',
      dot: 'bg-sky-500',
    },
    in_repair: {
      label: 'In Repair',
      bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60',
      text: 'text-orange-700 dark:text-orange-400',
      dot: 'bg-orange-500 animate-pulse',
    },
    repaired: {
      label: 'Repaired',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
      text: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
    written_off: {
      label: 'Written Off',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
      text: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
    },
    resolved: {
      label: 'Resolved / Closed',
      bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60',
      text: 'text-teal-700 dark:text-teal-400',
      dot: 'bg-teal-500',
    },
  };

  const item = config[status] || config.reported;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.bg} ${item.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: DamageSeverity;
  className?: string;
}

export function DamageSeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const config: Record<DamageSeverity, { label: string; bg: string; text: string }> = {
    minor: {
      label: 'Minor',
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      text: 'text-slate-600 dark:text-slate-400',
    },
    moderate: {
      label: 'Moderate',
      bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
      text: 'text-blue-600 dark:text-blue-400',
    },
    severe: {
      label: 'Severe',
      bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/60',
      text: 'text-orange-600 dark:text-orange-400',
    },
    critical: {
      label: 'Critical',
      bg: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60 font-semibold',
      text: 'text-red-600 dark:text-red-400',
    },
  };

  const item = config[severity] || config.minor;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${item.bg} ${className}`}
    >
      {item.label}
    </span>
  );
}
