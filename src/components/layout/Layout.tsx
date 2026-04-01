import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/src/hooks/useAuth';
import { useTheme } from '@/src/hooks/useTheme';
import { useUserStore } from '@/src/store/userStore';
import { DesktopFloatingCalendar } from '../tasks/DesktopFloatingCalendar';
import { ConnectionBanner } from '@/src/components/offline/ConnectionBanner';
import { startNetworkMonitor } from '@/src/store/networkStore';

export function Layout() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDark, showFloatingCalendar } = useTheme();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // Start network monitoring
  useEffect(() => {
    const cleanup = startNetworkMonitor();
    return cleanup;
  }, []);

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
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        <ConnectionBanner />
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className={`flex-1 overflow-y-auto pt-4 px-2 pb-4 md:pt-4 md:px-6 md:pb-6 w-full ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <Outlet />
        </main>
      </div>

      {/* Global Features */}
      {canViewCalendar && showFloatingCalendar && <DesktopFloatingCalendar />}
    </div>
  );
}

