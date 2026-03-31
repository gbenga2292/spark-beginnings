import { useNetworkStore } from '@/src/store/networkStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/task_ui/tooltip';

interface OfflineGuardProps {
  children: React.ReactNode;
  /** Optional: also block in "unstable" state (default: only "offline") */
  blockUnstable?: boolean;
  /** Override message */
  message?: string;
}

/**
 * Wraps interactive elements. When offline, renders them as disabled
 * with a tooltip explaining why.
 */
export function OfflineGuard({ children, blockUnstable = false, message }: OfflineGuardProps) {
  const status = useNetworkStore((s) => s.connectionStatus);
  const isBlocked = status === 'offline' || (blockUnstable && status === 'unstable');

  if (!isBlocked) return <>{children}</>;

  const tip = message ?? 'Unavailable while offline';

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block cursor-not-allowed">
            <div className="pointer-events-none opacity-50 select-none">
              {children}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
