/**
 * useTaskReadTracker
 *
 * Tracks which tasks / subtasks the current user has "opened" (read).
 * Stores { [id]: ISO timestamp } in localStorage under STORAGE_KEY.
 *
 * When computing unseen comment counts, only count comments created AFTER the
 * last read timestamp — so the badge disappears as soon as the user opens the
 * task detail, making it behave exactly like WhatsApp's read-receipt model.
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dcel_task_read_at';

export function useTaskReadTracker() {
  const [readMap, setReadMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  /** Mark one or more task/subtask IDs as read right now. */
  const markRead = useCallback((...ids: (string | null | undefined)[]) => {
    const now = new Date().toISOString();
    setReadMap(prev => {
      const next = { ...prev };
      ids.filter(Boolean).forEach(id => { next[id as string] = now; });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { readMap, markRead };
}
