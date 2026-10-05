import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { MeetingSettingsPanel } from './MeetingSettingsPanel';
import { Settings as SettingsIcon } from 'lucide-react';

interface MeetingSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingSettingsModal({ open, onOpenChange }: MeetingSettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-border/70 flex items-center justify-between">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <SettingsIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Meeting Minutes Configuration
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage default organizers, attendee committees, AI prompts, and print templates.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <MeetingSettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}
