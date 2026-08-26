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
  const [viewMode, setViewMode] = useState<'split' | 'calendar' | 'ai'>('split');
  const [splitPercent, setSplitPercent] = useState<number>(55); // 55% Calendar, 45% AI
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const { isDark } = useTheme();

  const isMac = (window as any).electronAPI?.platform === 'darwin';
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Resizable Divider Mouse Handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 25 && newPercent <= 75) {
        setSplitPercent(Math.round(newPercent * 10) / 10);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    if (isDraggingDivider) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex flex-col select-none"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden bg-[#0b0f19] border border-white/10 text-white select-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Studio Top Header Bar ── */}
              <div className={`relative flex flex-wrap items-center justify-between py-2.5 px-4 flex-shrink-0 bg-[#0b0f19] border-b border-white/10 ${isMac ? 'pl-[90px] pr-16' : 'pl-4 sm:pl-6 pr-16'}`}>
                {/* Left: Studio Identity */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Columns className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Operations Studio</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                        {viewMode === 'split' ? `Split View (${splitPercent}% / ${100 - splitPercent}%)` : viewMode === 'calendar' ? 'Calendar Focused' : 'AI Copilot Focused'}
                      </span>
                    </h2>
                  </div>
                </div>

                {/* Center / Right: Studio Layout View Toggles */}
                <div className="flex items-center gap-3">
                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10 text-xs">
                    <button
                      onClick={() => setViewMode('split')}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs",
                        viewMode === 'split'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      title="Split View (Calendar + AI Copilot)"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Split View</span>
                    </button>

                    <button
                      onClick={() => setViewMode('calendar')}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs",
                        viewMode === 'calendar'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      title="Calendar & Tasks Fullscreen"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Calendar</span>
                    </button>

                    <button
                      onClick={() => setViewMode('ai')}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-xs",
                        viewMode === 'ai'
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white"
                      )}
                      title="AI Operations Copilot Fullscreen"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">AI Copilot</span>
                    </button>
                  </div>

                  {/* Task Completed Toggle */}
                  <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10">
                    <span className="text-[11px] text-white/50">Done Tasks</span>
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={`relative w-8 h-4 rounded-full transition-all duration-300 border ${showCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                        : 'bg-white/5 border-white/10'
                        }`}
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
                <div className="absolute top-0 right-0 h-full flex items-center">
                  <button
                    onClick={() => setOpen(false)}
                    className="h-full w-12 flex justify-center items-center transition-colors hover:bg-red-500 hover:text-white text-white/60"
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
                      flexShrink: 0
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
                    onDoubleClick={() => setSplitPercent(55)}
                    className={cn(
                      "w-1.5 hover:w-2 bg-white/10 hover:bg-indigo-500 active:bg-indigo-600 transition-colors cursor-col-resize flex items-center justify-center group relative z-20 shrink-0 select-none",
                      isDraggingDivider && "bg-indigo-500 w-2"
                    )}
                    title="Drag to resize split panes (Double-click to reset 55/45)"
                  >
                    <div className="w-1 h-8 rounded-full bg-white/30 group-hover:bg-white flex flex-col items-center justify-center gap-0.5" />
                  </div>
                )}

                {/* ── Right Pane: AI Operations Copilot ── */}
                {(viewMode === 'split' || viewMode === 'ai') && (
                  <div
                    style={{
                      width: viewMode === 'split' ? `${100 - splitPercent}%` : '100%',
                      flexShrink: 0
                    }}
                    className="h-full flex flex-col overflow-hidden bg-[#0b0f19]"
                  >
                    <DailyLogsAiModal isEmbedded={true} onClose={() => setOpen(false)} />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
