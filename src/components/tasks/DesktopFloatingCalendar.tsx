import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import CalendarPage from '@/src/pages/TaskCalendar';

export function DesktopFloatingCalendar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 md:w-16 md:h-16 rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-500 transition-all active:scale-95 hover:scale-105"
        title="Open Calendar"
      >
        <CalendarIcon className="w-6 h-6 md:w-7 md:h-7" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl flex flex-col"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden bg-[#0f111a]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0 bg-[#0f111a] border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 backdrop-blur-sm flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-heading font-bold text-white">Floating Calendar</h2>
                    <p className="text-[11px] sm:text-xs text-white/50">Your tasks, deadlines, and reminders at a glance</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-2.5 rounded-full hover:bg-white/10 transition-all text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
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
