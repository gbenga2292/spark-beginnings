import React from 'react';
import { Loader2 } from 'lucide-react';

export function TaskSkeletonLoader() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Banner Indicator */}
      <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 rounded-xl p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
            Syncing task records with database…
          </span>
        </div>
        <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
          Loading your data
        </span>
      </div>

      {/* Skeleton Rows */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3" />
                <div className="h-4 bg-indigo-100 dark:bg-indigo-900/40 rounded-full w-16" />
              </div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-20" />
            </div>

            <div className="pl-7 space-y-2">
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-2/3" />
              <div className="flex items-center gap-4 pt-1">
                <div className="h-5 bg-slate-100 dark:bg-slate-800/80 rounded-md w-24" />
                <div className="h-5 bg-slate-100 dark:bg-slate-800/80 rounded-md w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
