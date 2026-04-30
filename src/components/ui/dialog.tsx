import React, { createContext, useContext } from 'react';
import { cn } from '@/src/lib/utils';
import { X } from 'lucide-react';

interface SharedProps {
  children: React.ReactNode;
  className?: string;
}

// ── Dialog close context — lets DialogClose resolve the close fn automatically ─
const DialogCloseContext = createContext<(() => void) | undefined>(undefined);

// ── Flexible Dialog Root ───────────────────────────────────────────────────────
export function Dialog({ open, onOpenChange, onClose, title, children, className, fullScreenMobile }: any) {
  if (!open) return null;
  const handleClose = onOpenChange ? () => onOpenChange(false) : onClose;

  // Legacy title-based API
  if (title) {
    return (
      <DialogCloseContext.Provider value={handleClose}>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className={cn("relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200", className)}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {children}
            </div>
          </div>
        </div>
      </DialogCloseContext.Provider>
    );
  }

  // Modern component-based API
  return (
    <DialogCloseContext.Provider value={handleClose}>
      <div className={cn("fixed inset-0 z-50 flex items-center justify-center", fullScreenMobile ? "p-0 sm:p-4 sm:pt-20" : "p-4 pt-20", className)}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
        {children}
      </div>
    </DialogCloseContext.Provider>
  );
}

// ── Sub-components for modern API ──────────────────────────────────────────────
export function DialogContent({ children, className, ...rest }: SharedProps & Record<string, any>) {
  return (
    <div
      className={cn(
        "relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: SharedProps) {
  return (
    <div className={cn("px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex flex-col space-y-1.5 shrink-0", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }: SharedProps) {
  return (
    <h3 className={cn("text-lg font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function DialogDescription({ children, className }: SharedProps) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-slate-400 mt-1.5", className)}>
      {children}
    </p>
  );
}

// DialogClose: reads close fn from context automatically; onClick prop is still
// supported as an override for cases that need custom behaviour.
export function DialogClose({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const contextClose = useContext(DialogCloseContext);
  const handleClick = onClick ?? contextClose;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-all shrink-0",
        className
      )}
    >
      {children || <X className="h-4 w-4" />}
    </button>
  );
}

export function DialogFooter({ children, className }: SharedProps) {
  return (
    <div className={cn("flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700", className)}>
      {children}
    </div>
  );
}
