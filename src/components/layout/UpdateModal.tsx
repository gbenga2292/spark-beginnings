import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { 
  Network, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Lock, 
  ShieldAlert, 
  Download, 
  WifiOff 
} from 'lucide-react';
import { toast } from '@/src/components/ui/toast';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StepType = 'select' | 'checking' | 'auth' | 'downloading' | 'ready' | 'up-to-date' | 'error';
type NasStatusType = 'checking' | 'online' | 'auth-required' | 'offline';

export function UpdateModal({ isOpen, onClose }: UpdateModalProps) {
  const [step, setStep] = useState<StepType>('select');
  const [nasStatus, setNasStatus] = useState<NasStatusType>('checking');
  const [nasError, setNasError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'nas' | 'web' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const nasPath = '\\\\MYCLOUDEX2ULTRA\\DCEL_Share\\Updates\\';

  // Check NAS status on mount or when modal opens
  const performNasCheck = async () => {
    if (!(window as any).electronAPI) return;
    setNasStatus('checking');
    setNasError(null);
    try {
      const res = await (window as any).electronAPI.checkNasStatus(nasPath);
      setNasStatus(res.status);
      setNasError(res.error || null);
    } catch (err: any) {
      console.error('NAS connectivity check failed:', err);
      setNasStatus('offline');
      setNasError(err.message || 'Unknown network error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setAuthError(null);
      setErrorMessage(null);
      setNewVersion(null);
      setDownloadPercent(0);
      performNasCheck();
    }
  }, [isOpen]);

  // Subscribe to updater events from main process
  useEffect(() => {
    if (!isOpen || !(window as any).electronAPI?.onUpdateStatus) return;

    const unsubscribe = (window as any).electronAPI.onUpdateStatus((status: any) => {
      console.log('Update status received:', status);
      switch (status.type) {
        case 'checking':
          setStep('checking');
          break;
        case 'available':
          setStep('downloading');
          setNewVersion(status.version);
          break;
        case 'not-available':
          setStep('up-to-date');
          break;
        case 'downloading':
          setStep('downloading');
          setDownloadPercent(status.percent);
          break;
        case 'downloaded':
          setStep('ready');
          break;
        case 'error':
          setStep('error');
          setErrorMessage(status.message);
          break;
        default:
          break;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const handleSelectSource = async (source: 'nas' | 'web') => {
    setSelectedSource(source);
    if (!(window as any).electronAPI) {
      toast.error('Native updates are only supported in desktop app mode.');
      return;
    }

    if (source === 'nas') {
      if (nasStatus === 'auth-required') {
        setStep('auth');
      } else if (nasStatus === 'offline') {
        toast.error('The local NAS share is offline. Please use the Web Server option.');
      } else {
        // Online, start update directly
        (window as any).electronAPI.startUpdateCheck('nas');
        setStep('checking');
      }
    } else {
      (window as any).electronAPI.startUpdateCheck('web');
      setStep('checking');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }

    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const result = await (window as any).electronAPI.authenticateNas(nasPath, username, password);
      if (result.success) {
        // Authenticated! Check status again
        const nextStatus = await (window as any).electronAPI.checkNasStatus(nasPath);
        setNasStatus(nextStatus);
        
        if (nextStatus === 'online') {
          // Success! Start update sequence
          (window as any).electronAPI.startUpdateCheck('nas');
          setStep('checking');
        } else {
          setAuthError('Credentials accepted, but cannot access updates folder.');
        }
      } else {
        setAuthError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleInstall = () => {
    if ((window as any).electronAPI?.quitAndInstall) {
      (window as any).electronAPI.quitAndInstall();
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-2xl p-0 overflow-hidden flex flex-col rounded-2xl">
        
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-row items-center justify-between shrink-0">
          <div className="flex flex-col space-y-1">
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <RefreshCw className={`h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 ${step === 'checking' ? 'animate-spin' : ''}`} />
              DCEL Update Manager
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Keep your desktop suite synchronized and secure.
            </DialogDescription>
          </div>
          <DialogClose onClick={onClose} />
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 flex-1 flex flex-col justify-center min-h-[220px]">
          
          {/* STEP 1: SELECT SOURCE */}
          {step === 'select' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Select Update Source
              </p>
              
              {/* NAS Selection Option */}
              <button
                onClick={() => handleSelectSource('nas')}
                disabled={nasStatus === 'checking'}
                className="w-full text-left p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700/80 flex items-center justify-between transition-all duration-200 group focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Network className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Local Network NAS
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Fastest local sync (for office devices)
                    </p>
                    {nasStatus === 'offline' && nasError && (
                      <p className="text-[10px] text-rose-550 dark:text-rose-400 mt-1 font-semibold max-w-[220px] truncate" title={nasError}>
                        {nasError}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Live NAS Status Badge */}
                <div className="flex items-center gap-2">
                  {nasStatus === 'checking' && (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                      <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                      Checking...
                    </span>
                  )}
                  {nasStatus === 'online' && (
                    <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-full font-bold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  )}
                  {nasStatus === 'auth-required' && (
                    <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-full font-bold flex items-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      Auth Required
                    </span>
                  )}
                  {nasStatus === 'offline' && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 rounded-full font-bold flex items-center gap-1.5">
                      <WifiOff className="h-3 w-3" />
                      Offline
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-1 transition-transform ml-1" />
                </div>
              </button>

              {/* Web Server Selection Option */}
              <button
                onClick={() => handleSelectSource('web')}
                className="w-full text-left p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700/80 flex items-center justify-between transition-all duration-200 group focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Cloud Web Server
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Direct internet download (fallback)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30 rounded-full font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    Available
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-1 transition-transform ml-1" />
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: CREDENTIALS INPUT FORM (NAS ONLY) */}
          {step === 'auth' && (
            <form onSubmit={handleAuthSubmit} className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/20 rounded-lg text-amber-800 dark:text-amber-400 text-xs font-semibold leading-relaxed">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">NAS Authentication Required</p>
                  <p className="font-medium opacity-90">Please enter your network credentials to authenticate the share folder connection.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-xs font-bold text-slate-600 dark:text-slate-400">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Administrator"
                    className="h-9 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isAuthenticating}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-600 dark:text-slate-400">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isAuthenticating}
                  />
                </div>
              </div>

              {authError && (
                <p className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 px-2 py-1.5 rounded">
                  ⚠️ {authError}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('select')}
                  disabled={isAuthenticating}
                  className="h-8 text-xs font-bold"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAuthenticating}
                  className="h-8 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
                >
                  {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: CHECKING */}
          {step === 'checking' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-6 animate-in fade-in duration-200">
              <div className="relative h-14 w-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-950/30" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
                <RefreshCw className="h-6 w-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Connecting to Update Server
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Checking for new releases on {selectedSource === 'nas' ? 'Local NAS' : 'Cloud Server'}...
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: DOWNLOADING */}
          {step === 'downloading' && (
            <div className="space-y-5 py-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Downloading Version {newVersion}
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Retrieving update packages. Do not close the application.
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Progress</span>
                  <span>{downloadPercent}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${downloadPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: READY (DOWNLOADED) */}
          {step === 'ready' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-4 animate-in fade-in duration-200">
              <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Update Ready to Install
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                  Version {newVersion} has successfully downloaded. The application will restart to complete the installation.
                </p>
              </div>
              <Button
                onClick={handleInstall}
                className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-6 h-9 text-xs flex items-center gap-1.5 mt-2"
              >
                Restart & Install
              </Button>
            </div>
          )}

          {/* STEP 6: UP TO DATE */}
          {step === 'up-to-date' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-6 animate-in fade-in duration-200">
              <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Application Up to Date
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  You are already running the latest version of DCEL Office Suite.
                </p>
              </div>
              <Button
                onClick={onClose}
                variant="outline"
                className="font-bold px-6 h-8 text-xs mt-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Done
              </Button>
            </div>
          )}

          {/* STEP 7: ERROR */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-4 animate-in fade-in duration-200">
              <div className="h-12 w-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="text-center space-y-1 px-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Update Failed
                </h4>
                <p className="text-xs text-rose-500 dark:text-rose-400 font-bold max-w-xs break-words mt-1 leading-normal">
                  {errorMessage || 'An error occurred during update operations.'}
                </p>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setStep('select')}
                  variant="outline"
                  className="font-bold px-4 h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Try Again
                </Button>
                {selectedSource === 'nas' && (
                  <Button
                    onClick={() => handleSelectSource('web')}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-4 h-8 text-xs"
                  >
                    Check Web Server
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        {step !== 'auth' && (
          <DialogFooter className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/80 shrink-0 mt-0 flex items-center justify-between flex-row">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 select-none">
              Source: {selectedSource === 'nas' ? 'Local Network NAS' : selectedSource === 'web' ? 'Cloud Web Server' : 'None Selected'}
            </span>
            {step === 'downloading' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
              >
                Run in Background
              </Button>
            ) : step === 'select' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-transparent"
              >
                Close
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="h-8 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </Button>
            )}
          </DialogFooter>
        )}

      </DialogContent>
    </Dialog>
  );
}
