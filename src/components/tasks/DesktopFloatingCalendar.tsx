import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Calendar as CalendarIcon, X, CheckSquare, Sparkles, Columns,
  Maximize2, Minimize2, PanelLeftClose, PanelRightClose, GripVertical
} from 'lucide-react';
import CalendarPage from '@/src/pages/TaskCalendar';
import { DailyLogsAiModal } from '@/src/components/ai/DailyLogsAiModal';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';

export function DesktopFloatingCalendar() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'split' | 'ai'>(() => {
    try {
      const saved = localStorage.getItem('operations_studio_view_mode');
      if (saved === 'calendar' || saved === 'split' || saved === 'ai') return saved;
    } catch {}
    return 'calendar'; // Default: Calendar is the first and default view
  });
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('operations_studio_split');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 85) return parsed;
      }
    } catch {}
    return 75; // Default: 75% Calendar, 25% AI Copilot
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const { isDark } = useTheme();

  const isMac = (window as any).electronAPI?.platform === 'darwin';
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSplitPercent = useCallback((val: number) => {
    const clamped = Math.min(85, Math.max(20, Math.round(val * 10) / 10));
    setSplitPercent(clamped);
    try {
      localStorage.setItem('operations_studio_split', clamped.toString());
    } catch {}
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  // Dynamically update TitleBar overlay color when studio is open
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.setTitleBarOverlay) return;

    const updateOverlay = () => {
      let zoom = window.innerWidth ? window.outerWidth / window.innerWidth : 1;
      zoom = Math.round(zoom * 20) / 20;
      if (zoom < 0.2 || zoom > 5) zoom = 1;
      const height = Math.round(40 * zoom);

      if (open) {
        api.setTitleBarOverlay({ color: '#0b0f19', symbolColor: '#ffffff', height });
      } else {
        if (isDark) {
          api.setTitleBarOverlay({ color: '#0f172a', symbolColor: '#94a3b8', height });
        } else {
          api.setTitleBarOverlay({ color: '#ffffff', symbolColor: '#475569', height });
        }
      }
    };

    updateOverlay();
    window.addEventListener('resize', updateOverlay);
    return () => window.removeEventListener('resize', updateOverlay);
  }, [open, isDark]);

  // Resizable Divider Mouse Handling with high-performance direct throttle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  }, []);

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider || !containerRef.current) return;
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
        if (newPercent >= 20 && newPercent <= 85) {
          updateSplitPercent(newPercent);
        }
      });
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (isDraggingDivider) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDraggingDivider, updateSplitPercent]);

  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-y-8 right-0 w-16 pointer-events-none z-[240]" />
      
      {/* Minimal edge-docked tab — expands on hover */}
      <motion.button
        drag="y"
        dragConstraints={constraintsRef}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => setHovered(false)}
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`pointer-events-auto fixed top-[calc(50vh-22px)] right-0 z-[250] flex items-center gap-2 overflow-hidden rounded-l-xl border border-r-0 shadow-lg backdrop-blur-sm cursor-grab active:cursor-grabbing ${isDark
          ? 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700/90 hover:text-white'
          : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        animate={{ width: hovered ? 175 : 44, paddingRight: hovered ? 16 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        title="Drag up/down, click to open Calendar & AI Studio"
        style={{ height: 44, touchAction: "none" }}
      >
        <div className="flex items-center justify-center w-[44px] h-[44px] shrink-0">
          <CalendarIcon className="w-[18px] h-[18px]" />
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
            >
              <span>Calendar</span>
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                + AI Studio
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
            <div
              className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xs flex flex-col select-none"
              onClick={() => setOpen(false)}
            >
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden bg-[#0b0f19] border border-white/10 text-white select-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Studio Top Header Bar ── */}
              <div
                style={{ WebkitAppRegion: 'drag' } as any}
                className={`relative flex flex-wrap items-center justify-between py-2.5 px-4 flex-shrink-0 bg-[#0b0f19] border-b border-white/10 ${isMac ? 'pl-[90px] pr-20' : 'pl-4 sm:pl-6 pr-36'}`}
              >
                {/* Left: Studio Identity */}
                <div
                  className="flex items-center gap-2.5 no-drag select-none"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Columns className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Operations Studio</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                        {viewMode === 'split' ? `Split View (${Math.round(splitPercent)}% / ${100 - Math.round(splitPercent)}%)` : viewMode === 'calendar' ? 'Calendar Focused' : 'AI Copilot Focused'}
                      </span>
                    </h2>
                  </div>
                </div>

                {/* Center / Right: Studio Layout View Toggles */}
                <div
                  className="flex items-center gap-3 no-drag z-30 relative"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  {/* View Mode Switcher: Calendar first, Split View second, AI Copilot third */}
                  <div
                    className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10 text-xs no-drag"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                  >
                    {/* 1. Calendar Primary / Default */}
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('calendar');
                        try { localStorage.setItem('operations_studio_view_mode', 'calendar'); } catch {}
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs cursor-pointer select-none no-drag",
                        viewMode === 'calendar'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                      title="Calendar & Tasks (Primary Fullscreen)"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Calendar</span>
                    </button>

                    {/* 2. Split View */}
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('split');
                        try { localStorage.setItem('operations_studio_view_mode', 'split'); } catch {}
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs cursor-pointer select-none no-drag",
                        viewMode === 'split'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                      title="Split View (Calendar 75% + AI Copilot 25%)"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Split View</span>
                    </button>

                    {/* 3. AI Copilot */}
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('ai');
                        try { localStorage.setItem('operations_studio_view_mode', 'ai'); } catch {}
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs cursor-pointer select-none no-drag",
                        viewMode === 'ai'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                      title="AI Operations Copilot Fullscreen"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">AI Copilot</span>
                    </button>
                  </div>

                  {/* Task Completed Toggle */}
                  <div
                    className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10 no-drag"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                  >
                    <span className="text-[11px] text-white/50 select-none">Done Tasks</span>
                    <button
                      type="button"
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={`relative w-8 h-4 rounded-full transition-all duration-300 border cursor-pointer no-drag ${showCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                        : 'bg-white/5 border-white/10'
                        }`}
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                    >
                      <motion.div
                        animate={{ x: showCompleted ? 16 : 2 }}
                        initial={false}
                        className={`absolute top-0.5 w-2 h-2 rounded-full transition-colors duration-300 ${showCompleted ? 'bg-emerald-400' : 'bg-white/30'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Close Button */}
                <div
                  className="absolute top-0 right-0 h-full flex items-center z-40 no-drag"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-full w-12 flex justify-center items-center transition-colors hover:bg-red-500 hover:text-white text-white/60 cursor-pointer no-drag"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Close Studio (Esc)"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── Studio Body: Resizable Split Pane ── */}
              <div ref={containerRef} className="flex-1 flex overflow-hidden relative bg-[#0b0f19]">
                
                {/* ── Left Pane: Calendar & Tasks ── */}
                {(viewMode === 'split' || viewMode === 'calendar') && (
                  <div
                    style={{
                      width: viewMode === 'split' ? `${splitPercent}%` : '100%',
                      flexShrink: 0,
                      pointerEvents: isDraggingDivider ? 'none' : 'auto',
                      willChange: isDraggingDivider ? 'width' : 'auto'
                    }}
                    className="h-full flex flex-col overflow-hidden bg-[#0b0f19]"
                  >
                    <CalendarPage onNavigate={() => setOpen(false)} showCompleted={showCompleted} hideHeaderToggle={true} />
                  </div>
                )}

                {/* ── Center Studio Divider (Draggable Demarcation) ── */}
                {viewMode === 'split' && (
                  <div
                    onMouseDown={handleMouseDown}
                    onDoubleClick={() => updateSplitPercent(75)}
                    className={cn(
                      "w-1.5 hover:w-2 bg-white/10 hover:bg-indigo-500 active:bg-indigo-600 transition-colors cursor-col-resize flex items-center justify-center group relative z-20 shrink-0 select-none",
                      isDraggingDivider && "bg-indigo-500 w-2"
                    )}
                    title="Drag to resize split panes (Double-click to reset 75/25)"
                  >
                    <div className="w-1 h-8 rounded-full bg-white/30 group-hover:bg-white flex flex-col items-center justify-center gap-0.5" />
                  </div>
                )}

                {/* ── Right Pane: AI Operations Copilot ── */}
                {(viewMode === 'split' || viewMode === 'ai') && (
                  <div
                    style={{
                      width: viewMode === 'split' ? `${100 - splitPercent}%` : '100%',
                      flexShrink: 0,
                      pointerEvents: isDraggingDivider ? 'none' : 'auto',
                      willChange: isDraggingDivider ? 'width' : 'auto'
                    }}
                    className="h-full flex flex-col overflow-hidden bg-[#0b0f19]"
                  >
                    <DailyLogsAiModal isEmbedded={true} onClose={() => setOpen(false)} />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
