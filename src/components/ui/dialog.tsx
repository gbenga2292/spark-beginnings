import React from 'react';
import { cn } from '@/src/lib/utils';
import { X } from 'lucide-react';

interface SharedProps {
  children: React.ReactNode;
  className?: string;
}

// ── Flexible Dialog Root ──────────────────────────────────────────────────
export function Dialog({ open, onOpenChange, onClose, title, children, className }: any) {
  if (!open) return null;
  const handleClose = onOpenChange || onClose;

  // If title is provided, act as the simple legacy Dialog
  if (title) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => handleClose?.(false)}
        />
        
        <div className={cn("relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200", className)}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <button
              onClick={() => handleClose?.(false)}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, act as the Root container for the component-based API
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => handleClose?.(false)} />
      {children}
    </div>
  );
}

// ── Sub-components for modern API ─────────────────────────────────────────
export function DialogContent({ children, className }: SharedProps) {
  return (
    <div className={cn("relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col", className)}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: SharedProps) {
  return (
    <div className={cn("px-10 py-8 border-b border-slate-50 flex flex-col space-y-1.5", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }: SharedProps) {
  return (
    <h3 className={cn("text-2xl font-black text-slate-900 leading-none tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function DialogClose({ onClick, className, children }: { onClick?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("h-10 w-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all", className)}
    >
      {children || <X className="h-5 w-5" />}
    </button>
  );
}

export function DialogFooter({ children, className }: SharedProps) {
  return (
    <div className={cn("flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200", className)}>
      {children}
    </div>
  );
}
