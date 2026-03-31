import { create } from 'zustand';
import { supabase } from '@/src/integrations/supabase/client';

export type ConnectionStatus = 'online' | 'unstable' | 'offline';

interface NetworkState {
  connectionStatus: ConnectionStatus;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  setStatus: (status: ConnectionStatus) => void;
  setLastSynced: (ts: string) => void;
  setSyncing: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  connectionStatus: navigator.onLine ? 'online' : 'offline',
  lastSyncedAt: null,
  isSyncing: false,
  setStatus: (connectionStatus) => set({ connectionStatus }),
  setLastSynced: (ts) => set({ lastSyncedAt: ts }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));

// ── Heartbeat logic ──────────────────────────────────────────
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let failCount = 0;
const MAX_FAILS_UNSTABLE = 1;
const MAX_FAILS_OFFLINE = 3;
const HEARTBEAT_INTERVAL = 15_000; // 15s

async function heartbeat() {
  try {
    // Lightweight check: fetch a tiny Supabase endpoint
    const { error } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
    if (error) throw error;
    failCount = 0;
    useNetworkStore.getState().setStatus('online');
  } catch {
    failCount++;
    if (failCount >= MAX_FAILS_OFFLINE) {
      useNetworkStore.getState().setStatus('offline');
    } else if (failCount >= MAX_FAILS_UNSTABLE) {
      useNetworkStore.getState().setStatus('unstable');
    }
  }
}

export function startNetworkMonitor() {
  // Browser events
  const onOnline = () => {
    failCount = 0;
    useNetworkStore.getState().setStatus('online');
  };
  const onOffline = () => {
    useNetworkStore.getState().setStatus('offline');
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // Periodic heartbeat
  heartbeat();
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };
}
