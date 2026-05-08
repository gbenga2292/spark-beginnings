import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle, Database, CloudOff, RefreshCw, HardDrive, DownloadCloud } from 'lucide-react';
import { useNetworkStore } from '@/src/store/networkStore';

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
      // Sync logic placeholder
      await new Promise(r => setTimeout(r, 1500));
      alert('NAS Site Diary folder verified/created. Sync will proceed here.');
    } catch (e) {
      console.error(e);
      alert('Failed to access NAS for sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="z-30">
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-50 dark:bg-slate-900 border-none p-0 shadow-2xl">
        <div className="absolute top-4 right-4 z-10">
          <DialogClose onClick={() => onOpenChange(false)} className="bg-white/10 hover:bg-white/20 text-slate-500 dark:text-slate-400" />
        </div>
        
        {/* Header Section */}
        <div className={`px-4 sm:px-8 py-6 sm:py-10 text-white relative flex flex-col items-center justify-center text-center ${
          status === 'online' ? 'bg-emerald-600' : status === 'unstable' ? 'bg-amber-500' : 'bg-rose-600'
        }`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          
          <div className="relative z-10 bg-white/20 p-4 rounded-full mb-4 shadow-inner">
            {status === 'online' ? <Wifi className="w-10 h-10" /> : status === 'unstable' ? <AlertTriangle className="w-10 h-10" /> : <WifiOff className="w-10 h-10" />}
          </div>
          <DialogTitle className="text-white text-3xl mb-2 relative z-10">
            {status === 'online' ? 'System Online' : status === 'unstable' ? 'Connection Unstable' : 'System Offline'}
          </DialogTitle>
          <p className="text-white/80 font-medium relative z-10 max-w-md">
            {status === 'online' 
              ? 'All features are fully operational. Data is synchronizing in real-time.' 
              : 'You are currently disconnected. The application is running in Read-Only Mode using securely cached local data.'}
          </p>
        </div>

        {/* Content Section */}
        <div className="p-4 sm:p-8 grid gap-6 md:grid-cols-2 bg-white dark:bg-slate-950">
          {/* OFFLINE FEATURES */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Available Offline</h3>
            </div>
            <ul className="space-y-3">
              {[
                'View Dashboard metrics',
                'Browse Employee Directory',
                'Read Tasks and subtasks',
                'View Attendance history',
                'Access cached Reports'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 font-medium leading-tight">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* ONLINE ONLY FEATURES */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <CloudOff className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Requires Connection</h3>
            </div>
            <ul className="space-y-3">
              {[
                'Create or edit Tasks',
                'Process Payroll & advances',
                'Add new Employees',
                'Approve pending Leaves',
                'Real-time Chat & Comm Logs'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 font-medium leading-tight">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* ELECTRON NAS SYNC SECTION */}
          {isElectron && (
            <div className="md:col-span-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isNasAccessible ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Local NAS Storage</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {isNasAccessible ? '\\\\MYCLOUDEX2ULTRA\\DCEL_Share is accessible' : 'NAS drive is currently disconnected or unreachable.'}
                  </p>
                </div>
              </div>
              
              <button 
                disabled={!isNasAccessible || isSyncing}
                onClick={handleNasSync}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Site Media'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-4 h-4" />
            <span className="font-medium">Data automatically syncs when connection returns.</span>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
