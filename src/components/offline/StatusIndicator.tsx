import { useNetworkStore, type ConnectionStatus } from '@/src/store/networkStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/task_ui/tooltip';

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

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="relative flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className={`h-2.5 w-2.5 rounded-full ${dotColors[status]} ${status !== 'online' ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
              {status === 'online' ? 'Online' : status === 'unstable' ? 'Unstable' : 'Offline'}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          <p className="font-medium">{labels[status]}</p>
          {lastSynced && (
            <p className="opacity-70 mt-0.5">
              Last synced: {new Date(lastSynced).toLocaleTimeString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
