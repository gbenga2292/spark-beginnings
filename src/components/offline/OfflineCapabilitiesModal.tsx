import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle, Database, CloudOff, RefreshCw, HardDrive, DownloadCloud, X } from 'lucide-react';
import { useNetworkStore } from '@/src/store/networkStore';
import { cn } from '@/src/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OfflineCapabilitiesModal({ open, onOpenChange }: Props) {
  const status = useNetworkStore((s) => s.connectionStatus);
  const isElectron = !!(window as any).electronAPI?.isElectron;
  const [isNasAccessible, setIsNasAccessible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isElectron && open) {
      const checkNas = async () => {
        try {
          const exists = await (window as any).electronAPI.fsExists('\\\\MYCLOUDEX2ULTRA\\DCEL_Share');
          setIsNasAccessible(exists);
        } catch (e) {
          setIsNasAccessible(false);
        }
      };
      checkNas();
    }
  }, [isElectron, open]);

  const handleNasSync = async () => {
    setIsSyncing(true);
    try {
      await (window as any).electronAPI.fsMkdir('\\\\MYCLOUDEX2ULTRA\\DCEL_Share\\Site Diary');
      await new Promise(r => setTimeout(r, 1500));
      alert('NAS Site Diary folder verified/created. Sync will proceed here.');
    } catch (e) {
      console.error(e);
      alert('Failed to access NAS for sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  const statusConfig = {
    online: {
      bg: 'bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-700 dark:to-teal-850',
      badgeBg: 'bg-emerald-500/30 text-emerald-100 border-emerald-400/30',
      badgeText: 'Live Sync Active',
      icon: Wifi,
      title: 'System Online',
      desc: 'All features are fully operational. Data is synchronizing in real-time with the cloud.',
    },
    unstable: {
      bg: 'bg-gradient-to-br from-amber-600 to-orange-700 dark:from-amber-700 dark:to-orange-850',
      badgeBg: 'bg-amber-500/30 text-amber-100 border-amber-400/30',
      badgeText: 'Slow Connection',
      icon: AlertTriangle,
      title: 'Connection Unstable',
      desc: 'Syncing may experience delays. Offline changes are stored safely in local cache.',
    },
    offline: {
      bg: 'bg-gradient-to-br from-rose-600 to-red-700 dark:from-rose-700 dark:to-red-850',
      badgeBg: 'bg-rose-500/30 text-rose-100 border-rose-400/30',
      badgeText: 'Cached Mode',
      icon: WifiOff,
      title: 'System Offline',
      desc: 'You are disconnected. Running in read-only mode using securely cached local records.',
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-20 h-7 w-7 rounded-full bg-black/20 hover:bg-black/35 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs focus:outline-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Compact Hero Header */}
        <div className={cn("shrink-0 px-5 py-4 sm:px-6 sm:py-5 text-white relative overflow-hidden", statusConfig.bg)}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
              <StatusIcon className="h-5 w-5 text-white drop-shadow-xs" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <DialogTitle className="text-white text-lg sm:text-xl font-bold tracking-tight">
                  {statusConfig.title}
                </DialogTitle>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", statusConfig.badgeBg)}>
                  {statusConfig.badgeText}
                </span>
              </div>
              <p className="text-white/85 text-xs font-normal leading-relaxed line-clamp-2">
                {statusConfig.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60 dark:bg-slate-950/60">
          {/* Comparison Grid */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* OFFLINE FEATURES */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Available Offline</h3>
                <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">Cached</span>
              </div>
              <ul className="space-y-2">
                {[
                  'View Dashboard & KPIs',
                  'Browse Employee Directory',
                  'Read Tasks and subtasks',
                  'View Attendance logs & history',
                  'Access cached Reports',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ONLINE ONLY FEATURES */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <CloudOff className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Requires Connection</h3>
                <span className="ml-auto text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">Cloud</span>
              </div>
              <ul className="space-y-2">
                {[
                  'Create, edit, or delete Tasks',
                  'Process Payroll & advances',
                  'Add new Employees & Onboarding',
                  'Approve pending Leaves',
                  'Real-time Chat & Comm Logs',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ELECTRON NAS SYNC SECTION */}
          {isElectron && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200/70 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  isNasAccessible 
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" 
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}>
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Local NAS Storage</h4>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                      isNasAccessible 
                        ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/80 dark:text-teal-300" 
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {isNasAccessible ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {isNasAccessible ? '\\\\MYCLOUDEX2ULTRA\\DCEL_Share available' : 'NAS drive is currently disconnected or unreachable.'}
                  </p>
                </div>
              </div>
              
              <button 
                disabled={!isNasAccessible || isSyncing}
                onClick={handleNasSync}
                className={cn(
                  "w-full sm:w-auto px-3.5 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer",
                  "bg-teal-600 hover:bg-teal-500 active:scale-95 text-white disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
                )}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="w-3.5 h-3.5" />
                )}
                <span>{isSyncing ? 'Syncing...' : 'Sync Site Media'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Pinned Bottom Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 min-w-0">
            <RefreshCw className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-[11px] font-medium">Automatic cloud sync when connection returns</span>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
