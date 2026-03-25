import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import CalendarPage from '@/src/pages/TaskCalendar';
import { useTheme } from '@/src/hooks/useTheme';

export function DesktopFloatingCalendar() {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const isDragging = useRef(false);
  
  const isMac = (window as any).electronAPI?.platform === 'darwin';

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  // Dynamically update TitleBar overlay color when calendar is open
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.setTitleBarOverlay) return;
    
    const updateOverlay = () => {
      let zoom = window.innerWidth ? window.outerWidth / window.innerWidth : 1;
      zoom = Math.round(zoom * 20) / 20;
      if (zoom < 0.2 || zoom > 5) zoom = 1;
      const height = Math.round(40 * zoom);

      if (open) {
        // Keep window controls visible via symbolColor
        api.setTitleBarOverlay({ color: '#0f111a', symbolColor: '#ffffff', height });
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

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => {
          isDragging.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            isDragging.current = false;
          }, 150);
        }}
        onClick={(e) => {
          if (isDragging.current) {
            e.preventDefault();
            return;
          }
          setOpen(true);
        }}
        className="pointer-events-auto fixed bottom-6 right-6 z-[150] w-14 h-14 md:w-16 md:h-16 rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-500 transition-colors cursor-grab active:cursor-grabbing"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Drag to move, click to open Calendar"
        style={{ touchAction: 'none' }}
      >
        <CalendarIcon className="w-6 h-6 md:w-7 md:h-7 pointer-events-none" />
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xl flex flex-col"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden bg-[#0f111a]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`relative flex items-center justify-between py-4 flex-shrink-0 bg-[#0f111a] border-b border-white/5 ${isMac ? 'pl-[90px] pr-16' : 'pl-4 sm:pl-6 pr-16'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 backdrop-blur-sm flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-heading font-bold text-white">Floating Calendar</h2>
                    <p className="text-[11px] sm:text-xs text-white/50">Your tasks, deadlines, and reminders at a glance</p>
                  </div>
                </div>
                
                {/* Close Window-like Button */}
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

              {/* Body */}
              <div className="flex-1 overflow-hidden bg-[#0f111a] text-white">
                <CalendarPage onNavigate={() => setOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
