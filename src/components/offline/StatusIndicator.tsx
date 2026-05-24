import { useState } from 'react';
import { useNetworkStore, type ConnectionStatus } from '@/src/store/networkStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/task_ui/tooltip';
import { OfflineCapabilitiesModal } from './OfflineCapabilitiesModal';

const dotColors: Record<ConnectionStatus, string> = {
  online: 'bg-emerald-500',
  unstable: 'bg-amber-400',
  offline: 'bg-red-500',
};

const labels: Record<ConnectionStatus, string> = {
  online: 'Connected',
  unstable: 'Connection unstable',
  offline: 'Offline – view-only mode',
};

export function StatusIndicator() {
  const status = useNetworkStore((s) => s.connectionStatus);
  const lastSynced = useNetworkStore((s) => s.lastSyncedAt);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setModalOpen(true)}
              className={`
            relative flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200
            ${status === 'online' 
              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20' 
              : status === 'unstable'
              ? 'bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20'
              : 'bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20'
            }
            hover:scale-105 active:scale-95
          `}>
            <span className={`h-2.5 w-2.5 rounded-full ${dotColors[status]} ${status !== 'online' ? 'animate-pulse' : 'shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="p-3 min-w-[140px] border-slate-200 dark:border-slate-700 shadow-xl">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-xs flex items-center gap-1.5 uppercase tracking-tight">
              <span className={`h-1.5 w-1.5 rounded-full ${dotColors[status]}`} />
              {labels[status]}
            </p>
            {lastSynced && (
              <p className="text-[10px] opacity-60 font-medium">
                Last synced: {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <OfflineCapabilitiesModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
