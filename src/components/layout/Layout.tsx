import { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/src/hooks/useAuth';
import { useTheme } from '@/src/hooks/useTheme';
import { useUserStore } from '@/src/store/userStore';
import { DesktopFloatingCalendar } from '../tasks/DesktopFloatingCalendar';
import { TaskPopupNotifications } from '../tasks/TaskPopupNotifications';
import { ConnectionBanner } from '@/src/components/offline/ConnectionBanner';
import { startNetworkMonitor } from '@/src/store/networkStore';
import { ShieldAlert, RefreshCw, X } from 'lucide-react';

export function Layout() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDark, showFloatingCalendar } = useTheme();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const [privBannerVisible, setPrivBannerVisible] = useState(false);
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Start network monitoring
  useEffect(() => {
    const cleanup = startNetworkMonitor();
    return cleanup;
  }, []);

  // Listen for privilege updates pushed via realtime
  useEffect(() => {
    const handler = () => {
      setPrivBannerVisible(true);
      setReloadCountdown(10); // 10 second auto-reload
    };
    window.addEventListener('privileges-updated', handler);
    return () => window.removeEventListener('privileges-updated', handler);
  }, []);

  // Auto-reload countdown effect
  useEffect(() => {
    if (!privBannerVisible || reloadCountdown === null) return;
    if (reloadCountdown === 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => {
      setReloadCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [reloadCountdown, privBannerVisible]);

  // Still loading the Supabase session — don't redirect yet
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Only show floating calendar if user has task view privilege
  const canViewCalendar = !currentUser || (currentUser.privileges?.tasks?.canView);

  return (
    <div className={`flex h-full w-full overflow-hidden font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden w-full relative">
        <ConnectionBanner />

        {/* ── Privilege-update banner ─────────────────────────────── */}
        {privBannerVisible && (
          <div className="relative flex items-center gap-2 sm:gap-3 bg-amber-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-md z-50">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <div className="flex-1 text-xs sm:text-sm font-medium leading-tight">
              <span className="hidden sm:inline">
                Your permissions have been updated by an administrator. Reload the page to apply the changes.
              </span>
              <span className="sm:hidden">
                Permissions updated. Reload to apply.
              </span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 sm:gap-1.5 bg-white/20 hover:bg-white/30 rounded px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RefreshCw className="h-3 sm:h-3.5 w-3 sm:w-3.5 shrink-0" /> 
              <span className="hidden sm:inline">{reloadCountdown !== null ? `Reloading in ${reloadCountdown}s...` : 'Reload Now'}</span>
              <span className="sm:hidden">{reloadCountdown !== null ? `in ${reloadCountdown}s` : 'Reload'}</span>
            </button>
            <button
              onClick={() => {
                setPrivBannerVisible(false);
                setReloadCountdown(null);
              }}
              className="hover:bg-white/20 rounded p-1 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            </button>
          </div>
        )}

        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <div className="flex-1 relative overflow-hidden">
          <main 
            ref={mainRef}
            className={`h-full overflow-y-auto pt-4 px-2 pb-4 md:pt-4 md:px-6 md:pb-6 w-full ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
          >
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global Features */}
      {canViewCalendar && showFloatingCalendar && <DesktopFloatingCalendar />}
      <TaskPopupNotifications />
    </div>
  );
}

