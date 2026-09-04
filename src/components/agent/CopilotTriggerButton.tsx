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
          className="h-11 px-3.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-medium text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-white/10 cursor-pointer"
        >
          <div className="relative">
            <Bot className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400"></span>
            </span>
          </div>
          <span className="hidden sm:inline font-semibold">AI Co-Pilot</span>
          <span className="hidden md:inline text-[9.5px] px-1.5 py-0.2 rounded bg-black/20 text-indigo-100 font-mono">
            ⌘J
          </span>
        </Button>
      </div>

      {/* Slide-over Co-Pilot Drawer */}
      <SiteCopilotDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
