import { useCallback } from 'react';
import { useNetworkStore } from '@/src/store/networkStore';
import { toast } from 'sonner';

/**
 * Returns a guard function that wraps any mutation callback.
 * If offline, shows a toast and skips the action.
 *
 * Usage:
 *   const guard = useOfflineGuard();
 *   const handleSave = guard(() => { ... });
 */
export function useOfflineGuard() {
  const status = useNetworkStore((s) => s.connectionStatus);

  return useCallback(
    <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: any[]) => {
        if (status === 'offline') {
          toast.error('You are offline. This action is unavailable until connection is restored.');
          return;
        }
        if (status === 'unstable') {
          toast.warning('Connection is unstable. Action may fail.');
        }
        return fn(...args);
      }) as unknown as T;
    },
    [status]
  );
}
