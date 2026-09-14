import { Skeleton } from '@/src/components/ui/skeleton';

interface PageSkeletonProps {
  label?: string;
  type?: 'table' | 'cards' | 'default';
}

export function PageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Top Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-2.5 w-36 rounded-md" />
          </div>
        ))}
      </div>

      {/* Toolbar / Search / Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-xs overflow-hidden">
        {/* Table Header row */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-950/40 gap-4">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md hidden sm:block" />
          <Skeleton className="h-3.5 w-28 rounded-md hidden md:block" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-16 rounded-md text-right" />
        </div>

        {/* Table Rows with realistic alternating widths */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {[
            { c1: 'w-32', c2: 'w-44', c3: 'w-24', c4: 'w-20', c5: 'w-16' },
            { c1: 'w-28', c2: 'w-36', c3: 'w-28', c4: 'w-16', c5: 'w-20' },
            { c1: 'w-36', c2: 'w-48', c3: 'w-20', c4: 'w-24', c5: 'w-14' },
            { c1: 'w-24', c2: 'w-40', c3: 'w-32', c4: 'w-18', c5: 'w-24' },
            { c1: 'w-40', c2: 'w-32', c3: 'w-24', c4: 'w-20', c5: 'w-16' },
            { c1: 'w-30', c2: 'w-44', c3: 'w-28', c4: 'w-22', c5: 'w-18' },
          ].map((row, idx) => (
            <div key={idx} className="flex items-center justify-between px-5 py-3.5 gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className={`h-3.5 ${row.c1} rounded-md`} />
                  <Skeleton className="h-2.5 w-20 rounded-md" />
                </div>
              </div>
              <Skeleton className={`h-3.5 ${row.c2} rounded-md hidden sm:block`} />
              <Skeleton className={`h-3.5 ${row.c3} rounded-md hidden md:block`} />
              <Skeleton className={`h-5 ${row.c4} rounded-full`} />
              <Skeleton className={`h-4 ${row.c5} rounded-md`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
