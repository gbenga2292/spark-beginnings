import React from 'react';
import { Button } from '@/src/components/ui/button';
import { ViewToggle, type TaskViewMode } from "@/src/components/tasks/ViewToggle";
import { ScopePicker, SORT_OPTIONS, type SortOption } from "@/src/components/tasks/TasksShared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { ArrowUpDown, Plus, FolderOpen, Filter } from 'lucide-react';

interface TaskHeaderProps {
  viewMode: TaskViewMode;
  onViewModeChange: (v: TaskViewMode) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  showFilterBar: boolean;
  onToggleFilterBar: () => void;
  onNewTask: () => void;
  onNewProject: () => void;
  isPersonalWorkspace?: boolean;
  scope?: 'all' | 'mine' | 'pending_review' | 'projects';
  onScopeChange?: (s: any) => void;
  myCount?: number;
  pendingCount?: number;
}

export function TaskHeader({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  showFilterBar,
  onToggleFilterBar,
  onNewTask,
  onNewProject,
  isPersonalWorkspace = false,
  scope,
  onScopeChange,
  myCount = 0,
  pendingCount = 0,
}: TaskHeaderProps) {
  const currentSortLabel = SORT_OPTIONS.find(s => s.value === sortBy)?.label || 'Sort';

  return (
    <div className="relative flex items-center justify-between gap-2 md:gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <ViewToggle value={viewMode} onChange={onViewModeChange} />

        <div className="hidden sm:block h-7 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 transition-all gap-1.5 shadow-sm"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentSortLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {SORT_OPTIONS.map(opt => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`text-xs ${sortBy === opt.value ? 'font-bold text-indigo-600 bg-indigo-50/50' : ''}`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter Toggle */}
        <Button
          variant={showFilterBar ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleFilterBar}
          className={`h-9 px-3 text-xs font-semibold gap-1.5 transition-all shadow-sm ${
            showFilterBar
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
              : 'text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {!isPersonalWorkspace && scope && onScopeChange && (
          <ScopePicker
            scope={scope}
            setScope={onScopeChange}
            myCount={myCount}
            pendingCount={pendingCount}
          />
        )}

        {!isPersonalWorkspace && (
          <Button
            size="sm"
            variant="outline"
            onClick={onNewProject}
            className="h-9 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 gap-1.5 shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">New Project</span>
          </Button>
        )}

        <Button
          size="sm"
          onClick={onNewTask}
          className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-md shadow-indigo-200 dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </Button>
      </div>
    </div>
  );
}
