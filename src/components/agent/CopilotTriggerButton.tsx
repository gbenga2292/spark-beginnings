import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useUserStore } from '@/src/store/userStore';
import { SiteCopilotDrawer } from './SiteCopilotDrawer';

export function CopilotTriggerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // Check if AI Co-Pilot is permitted for the current user (defaults to true for existing users unless explicitly disabled)
  const hasAccess = currentUser?.privileges?.aiCopilot?.canAccess !== false;

  // Global keyboard shortcut (Ctrl+J or Cmd+J) to open Co-Pilot
  useEffect(() => {
    if (!hasAccess) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAccess]);

  if (!hasAccess) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-11 px-4 rounded-full bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 hover:from-blue-600 hover:via-blue-700 hover:to-slate-800 dark:bg-none dark:bg-slate-900 dark:hover:bg-slate-800 text-white font-medium text-xs border border-white/15 dark:border-slate-700/80 shadow-lg shadow-blue-950/25 dark:shadow-black/40 flex items-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer group"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-white/20 blur-xs animate-pulse opacity-75" />
            <Bot className="w-4 h-4 text-white relative z-10 drop-shadow-xs transition-transform duration-300 group-hover:scale-110" />
          </div>
          <span className="hidden sm:inline font-bold text-xs tracking-wide text-white drop-shadow-xs">
            AI Co-Pilot
          </span>
          <span className="hidden md:inline-flex items-center justify-center text-[9.5px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/90 font-mono font-semibold border border-white/15 shadow-xs">
            ⌘J
          </span>
        </Button>
      </div>

      {/* Slide-over Co-Pilot Drawer */}
      <SiteCopilotDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
