/**
 * useTaskReadTracker
 *
 * Industry-standard dual-layer read tracking:
 *
 * LAYER 1 — localStorage (instant, per-device)
 *   Gives immediate UI feedback with zero latency.
 *   Populated from the DB on mount; updated optimistically on every markRead call.
 *
 * LAYER 2 — Supabase task_participant_status (authoritative, cross-device)
 *   The server-side high-water mark cursor. Synced in real-time via Supabase
 *   Postgres Changes subscriptions inside AppDataContext.
 *   When a user reads a task on their phone, their laptop sees the badge clear.
 *
 * The merged readMap uses whichever timestamp is NEWER (DB wins if it's newer
 * than localStorage, e.g. after reading on another device).
 *
 * All existing `readMap[id]` usage remains fully backward-compatible.
 */
import { useState, useCallback, useMemo } from 'react';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';

const STORAGE_KEY = 'dcel_task_read_at';

export function useTaskReadTracker() {
  const { participantStatuses, markTaskAsRead } = useAppData();
  const { user } = useAuth();
  const myId = user?.id;

  // ── Layer 1: localStorage fast cache ─────────────────────────────────────
  const [localMap, setLocalMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  // ── Layer 2: DB cursors from context (cross-device) ───────────────────────
  const dbMap = useMemo<Record<string, string>>(() => {
    if (!myId) return {};
    return participantStatuses
      .filter((p: any) => p.userId === myId)
      .reduce((acc: Record<string, string>, p: any) => {
        acc[p.taskId] = p.lastReadTimestamp;
        return acc;
      }, {});
  }, [participantStatuses, myId]);

  // ── Merged readMap: pick the NEWER timestamp per task ────────────────────
  const readMap = useMemo<Record<string, string>>(() => {
    const merged: Record<string, string> = { ...localMap };
    Object.entries(dbMap).forEach(([id, dbTs]) => {
      const localTs = localMap[id] || '';
      // DB wins if it has a newer timestamp (cross-device read happened)
      if (!localTs || dbTs > localTs) merged[id] = dbTs;
    });
    return merged;
  }, [localMap, dbMap]);

  /**
   * Mark one or more task/subtask IDs as read right now.
   * - Instantly updates localStorage (Layer 1) for zero-latency UI feedback.
   * - Persists to the DB (Layer 2) for cross-device sync and teammate visibility.
   */
  const markRead = useCallback((...ids: (string | null | undefined)[]) => {
    const now = new Date().toISOString();
    const validIds = ids.filter(Boolean) as string[];

    // Layer 1: instant local update
    setLocalMap(prev => {
      const next = { ...prev };
      validIds.forEach(id => { next[id] = now; });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

    // Layer 2: persist to Supabase (fire-and-forget, non-blocking)
    if (myId) {
      validIds.forEach(id => {
        markTaskAsRead(id, myId).catch(console.error);
      });
    }
  }, [myId, markTaskAsRead]);

  return { readMap, markRead };
}
