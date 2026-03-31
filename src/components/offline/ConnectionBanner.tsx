import { useNetworkStore, type ConnectionStatus } from '@/src/store/networkStore';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const config: Record<Exclude<ConnectionStatus, 'online'>, {
  icon: typeof WifiOff;
  bg: string;
  text: string;
  message: string;
  detail: string;
}> = {
  offline: {
    icon: WifiOff,
    bg: 'bg-red-600',
    text: 'text-white',
    message: 'You are offline',
    detail: 'Viewing last saved data. All actions are disabled until connection is restored.',
  },
  unstable: {
    icon: AlertTriangle,
    bg: 'bg-amber-500',
    text: 'text-amber-950',
    message: 'Connection unstable',
    detail: 'Some actions may fail. Data shown may not be up to date.',
  },
};

export function ConnectionBanner() {
  const status = useNetworkStore((s) => s.connectionStatus);
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const lastSynced = useNetworkStore((s) => s.lastSyncedAt);

  const show = status !== 'online';
  const cfg = status !== 'online' ? config[status] : null;

  return (
    <AnimatePresence>
      {show && cfg && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`${cfg.bg} ${cfg.text} overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-2 text-sm font-medium">
            <div className="flex items-center gap-2">
              <cfg.icon className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{cfg.message}</span>
              <span className="hidden sm:inline opacity-80">— {cfg.detail}</span>
            </div>
            <div className="flex items-center gap-3 text-xs opacity-80">
              {isSyncing && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Syncing…
                </span>
              )}
              {lastSynced && (
                <span>Last synced: {new Date(lastSynced).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
