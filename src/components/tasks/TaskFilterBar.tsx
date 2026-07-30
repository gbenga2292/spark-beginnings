import React, { useEffect, useState, useRef } from 'react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Search, X, Users, Flag, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import { PRIORITY_CONFIG, PRIORITY_ORDER } from "@/src/components/tasks/TasksShared";
import type { TaskPriority } from "@/src/types/tasks";
import { useAppData } from '@/src/contexts/AppDataContext';

type PriorityFilter = TaskPriority | 'all';

interface TaskFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (val: PriorityFilter) => void;
  assigneeFilter?: string;
  onAssigneeFilterChange?: (val: string) => void;
  users?: any[];
  onClearFilters: () => void;
  showAssigneeFilter?: boolean;
}

export function TaskFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  assigneeFilter = 'all',
  onAssigneeFilterChange,
  users = [],
  onClearFilters,
  showAssigneeFilter = false,
}: TaskFilterBarProps) {
  const { searchTasksServer } = useAppData();
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger server-side debounced search when user types in search box
  useEffect(() => {
    if (!search || search.trim().length < 2) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        await searchTasksServer(search);
      } finally {
        setIsSearchingServer(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [search, searchTasksServer]);

  const STATUS_TABS = [
    { label: "All", value: "all" },
    { label: "To Start", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Approval Needed", value: "pending_approval" },
    { label: "Completed", value: "completed" },
  ];

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || (showAssigneeFilter && assigneeFilter !== 'all');

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 transition-all animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks, descriptions, or historical records..."
            className="pl-9 pr-8 h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
          />
          {isSearchingServer ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 animate-spin" />
          ) : search ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0 no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onStatusFilterChange(tab.value)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Pills */}
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Priority:</span>
          <button
            onClick={() => onPriorityFilterChange('all')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all ${
              priorityFilter === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {PRIORITY_ORDER.map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const isSelected = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => onPriorityFilterChange(p)}
                className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                  isSelected
                    ? `${cfg.className} shadow-sm ring-1 ring-offset-1 ring-indigo-400`
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-2.5 h-2.5" />
                {cfg.label}
              </button>
            );
          })}

          {/* Assignee Filter Dropdown */}
          {showAssigneeFilter && onAssigneeFilterChange && users.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={assigneeFilter}
                onChange={(e) => onAssigneeFilterChange(e.target.value)}
                className="h-7 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 px-2.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all gap-1 ml-auto"
          >
            <X className="h-3 w-3" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
