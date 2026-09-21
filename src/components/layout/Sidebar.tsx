import { useState, useEffect, useRef, useMemo, useTransition } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { cn, IS_LIMITED_WEB_WEB } from '@/src/lib/utils';
import { prefetchRoute } from '@/src/lib/routePrefetch';
import { useUserStore } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { useTheme } from '@/src/hooks/useTheme';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { supabase } from '@/src/integrations/supabase/client';
import logoSrc from '../../../logo/logo-2.png';
import {
  PanelLeftClose,
  PanelLeftOpen,
  X,
  User,
  ArrowUpCircle,
  RefreshCw,
  DownloadCloud,
  ArrowLeft,
  Home,
  ChevronRight,
} from 'lucide-react';
import { APP_VERSION } from '@/src/constants/version';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import {
  navigation,
  getVisibleNavItems,
  getFirstAccessibleHref,
  getActiveCategory,
  NavCategory,
} from '@/src/constants/navigation';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

// Flat list of all hrefs that appear in navigation — statically computed once
const ALL_SIDEBAR_HREFS = navigation.flatMap(cat =>
  cat.standaloneHref ? [cat.standaloneHref] : cat.items.map(item => item.href)
);

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const commLogs = useAppStore((s) => s.commLogs);
  const commLogReads = useAppStore((s) => s.commLogReads);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Clear optimistic pending path once location changes
  useEffect(() => {
    setPendingHref(null);
  }, [location.pathname]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/tasks/archive' || p.startsWith('/tasks/archive/');
    }
    return false;
  });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  // Category drill-down state
  const [drilledCategory, setDrilledCategory] = useState<NavCategory | null>(null);
  const [isRootView, setIsRootView] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/tasks/dashboard' || p.startsWith('/tasks/dashboard/') || p === '/home' || p === '/';
    }
    return false;
  });

  // Modern matchMedia listener: 0 CPU cycles while resizing within the same desktop or mobile bracket
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Collapse only applies to desktop screens. Mobile drawer must always show full navigation.
  const effectiveCollapsed = isCollapsed && !isMobile;

  const canViewCommLog = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser?.privileges?.users?.canManage === true) return true;
    return currentUser?.privileges?.commLog?.canView === true;
  }, [currentUser]);

  const unreadCommCount = useMemo(() => {
    if (!canViewCommLog || !currentUser?.id || !commLogs?.length) return 0;
    const readSet = new Set(
      commLogReads
        ? commLogReads.filter(r => r.userId === currentUser.id).map(r => r.logId)
        : []
    );
    return commLogs.filter(l => l.loggedBy !== currentUser.name && !readSet.has(l.id)).length;
  }, [canViewCommLog, commLogs, commLogReads, currentUser]);

  // Track whether collapse was triggered automatically (non-sidebar page)
  // vs manually by the user. We only auto-restore on auto-collapse.
  const autoCollapsedRef = useRef(false);

  // Determine active category based on the current pathname
  const activeCategory = useMemo(() => {
    return getActiveCategory(location.pathname, navigation);
  }, [location.pathname]);

  // Current category to display: if in root view, null; otherwise drilledCategory or activeCategory
  const currentCategory = useMemo(() => {
    if (isRootView) return null;
    if (drilledCategory) return drilledCategory;
    if (activeCategory && !activeCategory.standalone) return activeCategory;
    return null;
  }, [isRootView, drilledCategory, activeCategory]);

  const accessibleCategories = useMemo(() => {
    return navigation.filter(cat => {
      const visible = getVisibleNavItems(cat.items, currentUser);
      return visible.length > 0;
    });
  }, [currentUser]);

  const categoryVisibleItems = useMemo(() => {
    if (!currentCategory) return [];
    return getVisibleNavItems(currentCategory.items, currentUser);
  }, [currentCategory, currentUser]);

  useEffect(() => {
    const isTaskDashboardPage = location.pathname === '/tasks/dashboard' ||
      location.pathname.startsWith('/tasks/dashboard/');

    if (isTaskDashboardPage) {
      autoCollapsedRef.current = false;
      setIsCollapsed(false);
      setIsRootView(true);
      setDrilledCategory(null);
      return;
    }

    const matched = getActiveCategory(location.pathname, navigation);
    if (matched && !matched.standalone) {
      setDrilledCategory(matched);
      setIsRootView(false);
    }

    const isOnSidebarPage = ALL_SIDEBAR_HREFS.some(href =>
      location.pathname === href ||
      (href !== '/' && location.pathname.startsWith(href + '/'))
    );

    const isTaskArchivePage = location.pathname === '/tasks/archive' ||
      location.pathname.startsWith('/tasks/archive/');

    const isReportsPage = matched?.name === 'Reports' ||
      location.pathname === '/reports' ||
      location.pathname.startsWith('/reports/') ||
      location.pathname === '/financial-reports' ||
      location.pathname.startsWith('/financial-reports/') ||
      location.pathname === '/tasks/reports' ||
      location.pathname.startsWith('/tasks/reports/') ||
      location.pathname === '/weekly-report' ||
      location.pathname.startsWith('/weekly-report/');

    const isFullCanvasPage = isTaskArchivePage || isReportsPage;

    if (!isOnSidebarPage || isFullCanvasPage) {
      autoCollapsedRef.current = true;
      setIsCollapsed(true);
    } else {
      if (autoCollapsedRef.current) {
        autoCollapsedRef.current = false;
        setIsCollapsed(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Listen for programmatic collapse/restore events (e.g. when full-screen form modal opens)
  useEffect(() => {
    const handleCollapseEvent = () => {
      autoCollapsedRef.current = true;
      setIsCollapsed(true);
    };
    const handleRestoreEvent = () => {
      if (autoCollapsedRef.current) {
        autoCollapsedRef.current = false;
        setIsCollapsed(false);
      }
    };

    window.addEventListener('sidebar:collapse', handleCollapseEvent);
    window.addEventListener('sidebar:restore', handleRestoreEvent);

    return () => {
      window.removeEventListener('sidebar:collapse', handleCollapseEvent);
      window.removeEventListener('sidebar:restore', handleRestoreEvent);
    };
  }, []);

  // ── Platform Detection ─────────────────────────────────────────────────
  const isAndroidNative = Capacitor.getPlatform() === 'android';
  const isElectron = !!(window as any).electronAPI?.isElectron;

  // ── Android Auto-Update Logic (mobile-only) ────────────────────────────
  const CURRENT_VERSION = APP_VERSION;
  const UPDATE_SERVER_URL = import.meta.env.VITE_UPDATE_SERVER_URL || 'https://dewaterconstruct.com/app-updates';

  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; notes: string } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const startDownload = async (url: string) => {
    try {
      setIsDownloading(true);
      let finalUrl = url;

      if (!url.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('app-updates')
          .createSignedUrl(url, 60);

        if (error) throw error;
        if (data?.signedUrl) {
          finalUrl = data.signedUrl;
        }
      }

      await Browser.open({ url: finalUrl });
      setIsUpdateModalOpen(false);
      toast.success('Download started! Track progress in your notification bar, then tap the APK to install.');
    } catch (err: any) {
      console.error('Download failed:', err);
      toast.error(`Could not start download: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!isAndroidNative || isElectron) return;

    const checkForUpdates = async () => {
      try {
        const response = await CapacitorHttp.get({
          url: `${UPDATE_SERVER_URL}/version.json?t=${Date.now()}`,
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (response.status !== 200) return;
        const data = response.data;

        const normalizeVersion = (v: string) => v.replace(/^v/i, '').trim();
        const cParts = normalizeVersion(CURRENT_VERSION).split('.').map(Number);
        const rParts = normalizeVersion(data.version).split('.').map(Number);

        let isNewer = false;
        for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
          const c = cParts[i] || 0;
          const r = rParts[i] || 0;
          if (r > c) { isNewer = true; break; }
          if (r < c) { isNewer = false; break; }
        }

        if (data.version && isNewer) {
          setUpdateInfo(data);
        }
      } catch (err) {
        console.error('Update check failed:', err);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAndroidNative, isElectron]);

  const handleLinkClick = async (e: React.MouseEvent, href: string) => {
    // If opening in new tab or using non-left click, allow default browser behavior
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    // Don't re-navigate if already on this exact route
    if (location.pathname === href) {
      e.preventDefault();
      setIsOpen?.(false);
      return;
    }

    const {
      pendingLedgerEntries,
      isVariablesDirty,
      setVariablesDirty,
      isLedgerDirty,
      setLedgerDirty,
      isEmployeeFormDirty,
      setEmployeeFormDirty,
      isDailyLogFormDirty,
      setDailyLogFormDirty,
      isSimulatorDirty,
      setSimulatorDirty,
    } = useAppStore.getState();

    if (isDailyLogFormDirty) {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved changes in this machine log. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Keep Editing',
        variant: 'danger',
      });
      if (ok) {
        setDailyLogFormDirty(false);
        setPendingHref(href);
        setIsOpen?.(false);
        startTransition(() => {
          navigate(href);
        });
      }
      return;
    }

    if (location.pathname === '/operations/simulator' && isSimulatorDirty && href !== '/operations/simulator') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved simulator changes. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger',
      });
      if (ok) {
        setSimulatorDirty(false);
        setPendingHref(href);
        setIsOpen?.(false);
        startTransition(() => {
          navigate(href);
        });
      }
      return;
    }

    if (location.pathname === '/ledger' && ((pendingLedgerEntries?.length ?? 0) > 0 || isLedgerDirty) && href !== '/ledger') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved entries in the ledger. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger',
      });
      if (ok) {
        setLedgerDirty(false);
        setPendingHref(href);
        setIsOpen?.(false);
        startTransition(() => {
          navigate(href);
        });
      }
      return;
    }

    if (location.pathname === '/settings' && isVariablesDirty && href !== '/settings') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved variable changes. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger',
      });
      if (ok) {
        setVariablesDirty(false);
        setPendingHref(href);
        setIsOpen?.(false);
        startTransition(() => {
          navigate(href);
        });
      }
      return;
    }

    if (location.pathname === '/employees' && isEmployeeFormDirty && href !== '/employees') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved changes in the employee form. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger',
      });
      if (ok) {
        setEmployeeFormDirty(false);
        setPendingHref(href);
        setIsOpen?.(false);
        startTransition(() => {
          navigate(href);
        });
      }
      return;
    }

    e.preventDefault();
    setPendingHref(href);
    setIsOpen?.(false);
    startTransition(() => {
      navigate(href);
    });
  };

  // ── Theme tokens ─────────────────────────────────────────────────────────
  const sidebarBg = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200';
  const navBg = isDark ? 'bg-slate-900' : 'bg-gradient-to-b from-blue-700 via-blue-800 to-slate-900';
  const itemBase = isDark
    ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 active:scale-[0.98] active:bg-slate-800 transition-all duration-75 cursor-pointer select-none'
    : 'text-white/90 hover:bg-white/15 hover:text-white active:scale-[0.98] active:bg-white/25 transition-all duration-75 cursor-pointer select-none';
  const itemActive = isDark
    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20 font-bold active:scale-[0.98] transition-all duration-75 cursor-pointer select-none'
    : 'bg-white text-blue-700 shadow-md font-bold active:scale-[0.98] transition-all duration-75 cursor-pointer select-none';
  const iconBase = isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-white/80 group-hover:text-white';
  const iconActive = isDark ? 'text-white' : 'text-blue-700';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setIsOpen?.(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          'fixed lg:relative flex h-full flex-col border-r transition-[width,transform] duration-200 ease-out z-50',
          sidebarBg,
          effectiveCollapsed ? 'w-20' : 'w-72 lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Area */}
        <div className={cn('flex h-16 shrink-0 items-center border-b border-transparent transition-all', effectiveCollapsed ? 'px-0 justify-center' : 'px-6 justify-between')}>
          <div className={cn('relative flex items-center gap-2 font-bold text-xl overflow-hidden transition-all duration-300', effectiveCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100')}>
            <div className="relative inline-flex items-center transform-gpu">
              <img
                src={logoSrc}
                alt="DCEL"
                className="h-10 w-auto min-w-max block transition-all duration-300"
                style={isDark ? { filter: 'brightness(0) invert(1)', opacity: 0.9 } : undefined}
              />
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-300"
                style={{
                  backgroundColor: 'var(--color-indigo-600)',
                  WebkitMaskImage: `url("${logoSrc}")`,
                  maskImage: `url("${logoSrc}")`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'left center',
                  maskPosition: 'left center',
                  mixBlendMode: isDark ? 'screen' : 'color',
                  opacity: isDark ? 0.75 : 1,
                }}
              />
            </div>
          </div>
          <div className="flex items-center">
            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => { autoCollapsedRef.current = false; setIsCollapsed(!isCollapsed); }}
              className={cn('hidden lg:flex p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors', isDark && 'hover:bg-slate-800 hover:text-slate-300')}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {effectiveCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            {/* Mobile Close Button */}
            <button onClick={() => setIsOpen?.(false)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Area */}
        <div className={cn("flex flex-1 flex-col overflow-y-auto overflow-x-hidden", navBg)}>
          <nav className={cn('flex-1 space-y-1.5 py-4', effectiveCollapsed ? 'px-2' : 'px-3')}>
            {/* ── DRILLED CATEGORY VIEW (Back button + Category Header + Category Items) ── */}
            {currentCategory && (
              <div>
                {/* ── BACK BUTTON (Replaces Home button) ──────────────── */}
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRootView(true);
                      setDrilledCategory(null);
                    }}
                    className={cn(
                      'group flex w-full items-center rounded-xl py-2 text-xs font-bold transition-all duration-75 active:scale-[0.98] cursor-pointer select-none',
                      'bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs',
                      effectiveCollapsed ? 'px-0 justify-center' : 'px-3'
                    )}
                    title={effectiveCollapsed ? 'Home' : undefined}
                  >
                    <div className={cn('flex items-center', effectiveCollapsed && 'justify-center w-full')}>
                      <Home className={cn('h-4 w-4 shrink-0 text-white transition-transform duration-200', !effectiveCollapsed && 'mr-2')} />
                      {!effectiveCollapsed && <span>Home</span>}
                    </div>
                  </button>
                </div>

                {/* ── ACTIVE CATEGORY HEADER ──────────────────────────── */}
                {!effectiveCollapsed ? (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2.5 rounded-xl bg-black/20 border border-white/10 shadow-inner">
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-xs shrink-0', currentCategory.color)}>
                      <currentCategory.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black uppercase tracking-wider text-white block truncate">
                        {currentCategory.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center my-2" title={currentCategory.name}>
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-xs', currentCategory.color)}>
                      <currentCategory.icon className="h-4 w-4" />
                    </div>
                  </div>
                )}

                {/* Category Items */}
                <div className="space-y-1">
                  {categoryVisibleItems.map((item) => {
                    const activePath = pendingHref || location.pathname;
                    const visibleSubItems = item.subItems ? getVisibleNavItems(item.subItems, currentUser) : [];
                    const isActive = activePath === item.href || visibleSubItems.some(sub => activePath === sub.href);
                    const isCommLog = item.href === '/comm-log';
                    const itemUnread = isCommLog ? unreadCommCount : 0;

                    return (
                      <div key={item.name} className="flex flex-col gap-0.5 mb-1">
                        <Link
                          to={item.href}
                          onClick={(e) => handleLinkClick(e, item.href)}
                          onMouseEnter={() => prefetchRoute(item.href)}
                          onTouchStart={() => prefetchRoute(item.href)}
                          onFocus={() => prefetchRoute(item.href)}
                          title={effectiveCollapsed ? (itemUnread > 0 ? `${item.name} (${itemUnread} unread)` : item.name) : undefined}
                          className={cn(
                            'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors',
                            effectiveCollapsed ? 'px-0 justify-center' : 'px-3',
                            isActive ? itemActive : itemBase
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <item.icon
                              className={cn(
                                'h-[18px] w-[18px] transition-colors',
                                !effectiveCollapsed && 'mr-3',
                                isActive ? iconActive : iconBase
                              )}
                              aria-hidden="true"
                            />
                            {effectiveCollapsed && itemUnread > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                            )}
                          </div>
                          {!effectiveCollapsed && <span className="truncate flex-1">{item.name}</span>}
                          {!effectiveCollapsed && itemUnread > 0 && (
                            <span className={cn(
                              'ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse',
                              isActive
                                ? (isDark ? 'bg-white text-blue-700' : 'bg-blue-600 text-white')
                                : (isDark ? 'bg-blue-500 text-white' : 'bg-white text-blue-700')
                            )}>
                              {itemUnread}
                            </span>
                          )}
                        </Link>

                        {/* Sub-items */}
                        {!effectiveCollapsed && visibleSubItems.length > 0 && (
                          <div className={cn("ml-7 flex flex-col gap-0.5 border-l pl-2 mt-0.5", isDark ? "border-slate-800/50" : "border-white/10")}>
                            {visibleSubItems.map((subItem) => {
                              const activePath = pendingHref || location.pathname;
                              const isSubActive = activePath === subItem.href;
                              return (
                                <Link
                                  key={subItem.name}
                                  to={subItem.href}
                                  onClick={(e) => handleLinkClick(e, subItem.href)}
                                  onMouseEnter={() => prefetchRoute(subItem.href)}
                                  onTouchStart={() => prefetchRoute(subItem.href)}
                                  onFocus={() => prefetchRoute(subItem.href)}
                                  className={cn(
                                    'group flex items-center rounded-md py-2 px-3 text-xs font-medium transition-colors',
                                    isSubActive ? itemActive : itemBase
                                  )}
                                >
                                  <subItem.icon
                                    className={cn(
                                      'h-4 w-4 mr-2.5 transition-colors',
                                      isSubActive ? iconActive : iconBase
                                    )}
                                  />
                                  <span className="truncate">{subItem.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ROOT / ALL CATEGORIES VIEW ─────────────────────────────── */}
            {!currentCategory && (
              <div className="space-y-1">
                {accessibleCategories.map((cat) => {
                  if (cat.standalone && cat.standaloneHref) {
                    const activePath = pendingHref || location.pathname;
                    const isActive = activePath === cat.standaloneHref ||
                      activePath.startsWith(cat.standaloneHref + '/');
                    return (
                      <div key={cat.name} className="mb-1">
                        <Link
                          to={cat.standaloneHref}
                          onClick={(e) => handleLinkClick(e, cat.standaloneHref!)}
                          onMouseEnter={() => prefetchRoute(cat.standaloneHref!)}
                          onTouchStart={() => prefetchRoute(cat.standaloneHref!)}
                          onFocus={() => prefetchRoute(cat.standaloneHref!)}
                          title={effectiveCollapsed ? cat.name : undefined}
                          className={cn(
                            'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors',
                            effectiveCollapsed ? 'px-0 justify-center' : 'px-3',
                            isActive ? itemActive : itemBase
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <cat.icon
                              className={cn(
                                'h-[18px] w-[18px] transition-colors',
                                !effectiveCollapsed && 'mr-3',
                                isActive ? iconActive : iconBase
                              )}
                            />
                          </div>
                          {!effectiveCollapsed && <span className="truncate flex-1 font-semibold">{cat.name}</span>}
                        </Link>
                      </div>
                    );
                  }

                  const isCurrentCatActive = activeCategory?.name === cat.name;
                  const catUnread = cat.name === 'Communication' ? unreadCommCount : 0;

                  return (
                    <div key={cat.name} className="mb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDrilledCategory(cat);
                          setIsRootView(false);
                          if (effectiveCollapsed) setIsCollapsed(false);
                        }}
                        onMouseEnter={() => {
                          const firstHref = getFirstAccessibleHref(cat, currentUser);
                          if (firstHref) prefetchRoute(firstHref);
                        }}
                        onTouchStart={() => {
                          const firstHref = getFirstAccessibleHref(cat, currentUser);
                          if (firstHref) prefetchRoute(firstHref);
                        }}
                        onFocus={() => {
                          const firstHref = getFirstAccessibleHref(cat, currentUser);
                          if (firstHref) prefetchRoute(firstHref);
                        }}
                        className={cn(
                          'group flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-75 active:scale-[0.98] cursor-pointer select-none text-left',
                          effectiveCollapsed ? 'px-0 justify-center' : 'px-3',
                          isCurrentCatActive
                            ? (isDark ? 'bg-slate-800/90 text-white font-bold' : 'bg-white/20 text-white font-bold')
                            : itemBase
                        )}
                        title={effectiveCollapsed ? (catUnread > 0 ? `${cat.name} (${catUnread} unread)` : cat.name) : undefined}
                      >
                        <div className="relative flex-shrink-0">
                          <div
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-xs',
                              cat.color,
                              !effectiveCollapsed && 'mr-3'
                            )}
                          >
                            <cat.icon className="h-4 w-4" />
                          </div>
                          {effectiveCollapsed && catUnread > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                          )}
                        </div>

                        {!effectiveCollapsed && (
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <span className="truncate text-sm font-semibold">{cat.name}</span>
                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                              {catUnread > 0 && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-500 text-white shadow-xs animate-pulse">
                                  {catUnread}
                                </span>
                              )}
                              <ChevronRight className="h-3.5 w-3.5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Special case: /profile page when not inside any category */}
            {!activeCategory && (location.pathname === '/profile' || pendingHref === '/profile') && (
              <div className="mb-1">
                <Link
                  to="/profile"
                  onClick={(e) => handleLinkClick(e, '/profile')}
                  className={cn(
                    'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors',
                    effectiveCollapsed ? 'px-0 justify-center' : 'px-3',
                    itemActive
                  )}
                >
                  <User className={cn('h-[18px] w-[18px]', !effectiveCollapsed && 'mr-3', iconActive)} />
                  {!effectiveCollapsed && <span className="truncate flex-1">Profile</span>}
                </Link>
              </div>
            )}
          </nav>

          {/* ── Android Update Banner (hidden in Web/Electron) ────────────── */}
          {isAndroidNative && !isElectron && updateInfo && (
            <div className={cn("mt-auto px-3 pb-4", effectiveCollapsed ? "flex justify-center" : "")}>
              <button
                onClick={() => setIsUpdateModalOpen(true)}
                title={`Update v${updateInfo.version} Available`}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-xl transition-all duration-200",
                  effectiveCollapsed
                    ? "h-9 w-9 justify-center"
                    : "w-full px-3 py-2.5",
                  isDark
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40"
                    : "bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80"
                )}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {!effectiveCollapsed && (
                  <>
                    <span className={cn("flex-1 text-left text-xs font-semibold", isDark ? "text-emerald-400" : "text-emerald-700")}>
                      Update available
                      <span className={cn("ml-1.5 text-[10px] font-normal", isDark ? "text-emerald-500" : "text-emerald-500")}>
                        v{updateInfo.version}
                      </span>
                    </span>
                    <ArrowUpCircle className={cn("h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-y-[-1px]", isDark ? "text-emerald-500" : "text-emerald-600")} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Android Update Modal (hidden in Web/Electron) ─────────────── */}
          {isAndroidNative && !isElectron && (
            <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
              <DialogContent
                className={cn(
                  "w-[calc(100vw-2rem)] max-w-sm rounded-md border border-slate-200 dark:border-slate-800 p-0 shadow-xl overflow-hidden",
                  isDark ? "bg-slate-900" : "bg-white"
                )}
              >
                <div className={cn(
                  "relative px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800",
                  isDark ? "bg-slate-800/40" : "bg-slate-50"
                )}>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider mb-2",
                    isDark ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-slate-200 text-slate-700 border border-slate-300"
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                    v{updateInfo?.version}
                  </span>

                  <DialogTitle className={cn("text-lg font-bold leading-snug", isDark ? "text-white" : "text-slate-900")}>
                    Update Ready
                  </DialogTitle>
                  <DialogDescription className={cn("mt-0.5 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    A new version of the app is available to install.
                  </DialogDescription>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div className={cn(
                    "rounded-xl px-4 py-3 text-xs leading-relaxed",
                    isDark ? "bg-slate-800 text-slate-300" : "bg-slate-50 text-slate-600"
                  )}>
                    <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-1.5", isDark ? "text-slate-500" : "text-slate-400")}>
                      What's New
                    </p>
                    {updateInfo?.notes || 'General improvements and bug fixes.'}
                  </div>

                  <p className={cn("text-[10px] text-center", isDark ? "text-slate-600" : "text-slate-400")}>
                    The APK will download via your notification bar. Tap the file to install once complete.
                  </p>

                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px]", isDark ? "text-slate-600" : "text-slate-400")}>
                      Current: v{CURRENT_VERSION}
                    </span>
                    <span className={cn("text-[10px]", isDark ? "text-slate-600" : "text-slate-400")}>
                      Platform: Android
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 px-6 pb-6">
                  <button
                    onClick={() => setIsUpdateModalOpen(false)}
                    disabled={isDownloading}
                    className={cn(
                      "flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors disabled:opacity-40",
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    Later
                  </button>
                  <button
                    onClick={() => { if (updateInfo?.url) startDownload(updateInfo.url); }}
                    disabled={isDownloading}
                    className={cn(
                      "flex-[2] flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition-all disabled:opacity-60",
                      "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]"
                    )}
                  >
                    {isDownloading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-3.5 w-3.5" />
                    )}
                    {isDownloading ? 'Opening Download...' : 'Download & Install'}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </>
  );
}
