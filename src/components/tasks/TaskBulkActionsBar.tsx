import React from 'react';
import { Button } from '@/src/components/ui/button';
import { CheckCircle2, UserCheck, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkAssign: () => void;
  onBulkDelete: () => void;
}

export function TaskBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkComplete,
  onBulkAssign,
  onBulkDelete,
}: TaskBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3"
      >
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <span className="h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold text-slate-300">
            {selectedCount === 1 ? 'task selected' : 'tasks selected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onBulkComplete}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Complete
          </Button>

          <Button
            size="sm"
            onClick={onBulkAssign}
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={onBulkDelete}
            className="h-8 px-3 text-xs font-bold gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>

        <button
          onClick={onClearSelection}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors ml-1"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
