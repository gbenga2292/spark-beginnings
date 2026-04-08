/**
 * Lightweight in-app toast + confirm system.
 * Replaces all browser alert() / confirm() calls with styled notifications.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('FYI...');
 *
 *   const ok = await showConfirm('Are you sure?');
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    type: ToastType;
    message: string | React.ReactNode;
    action?: ToastAction;
}

// ── Global event bus (no context needed) ──────────────────────────────────
type Listener = (toast: Toast) => void;
const listeners: Listener[] = [];

function emit(toast: Toast) {
    listeners.forEach(l => l(toast));
}

function makeId() {
    return Math.random().toString(36).slice(2);
}

// ── Public API ─────────────────────────────────────────────────────────────
export const toast = {
    success: (message: string | React.ReactNode, action?: ToastAction) => emit({ id: makeId(), type: 'success', message, action }),
    error: (message: string | React.ReactNode, action?: ToastAction) => emit({ id: makeId(), type: 'error', message, action }),
    info: (message: string | React.ReactNode, action?: ToastAction) => emit({ id: makeId(), type: 'info', message, action }),
    warning: (message: string | React.ReactNode, action?: ToastAction) => emit({ id: makeId(), type: 'warning', message, action }),
};

// useToast hook – returns the same toast object for convenience
export function useToast() {
    return { toast };
}

// ── ToastContainer – render once near app root ─────────────────────────────
const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-red-500    shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500   shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500  shrink-0" />,
};

const BORDER: Record<ToastType, string> = {
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    info: 'border-l-blue-500',
    warning: 'border-l-amber-500',
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(t.id), 4000);
        return () => clearTimeout(timer);
    }, [t.id, onDismiss]);

    return (
        <div
            className={`
        flex items-start gap-3 bg-white border border-slate-200 border-l-4
        ${BORDER[t.type]} rounded-lg shadow-lg px-4 py-3 min-w-[280px] max-w-sm
        animate-[slide-in_0.2s_ease-out]
      `}
            style={{ animation: 'slideInRight 0.25s ease-out' }}
        >
            {ICONS[t.type]}
            <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 leading-snug">{t.message}</div>
                {t.action && (
                    <button 
                        onClick={() => { t.action!.onClick(); onDismiss(t.id); }}
                        className="mt-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        {t.action.label}
                    </button>
                )}
            </div>
            <button
                onClick={() => onDismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 ml-1 mt-0.5 shrink-0"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const handler: Listener = (t) => setToasts(prev => [...prev, t]);
        listeners.push(handler);
        return () => { const i = listeners.indexOf(handler); if (i >= 0) listeners.splice(i, 1); };
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <>
            <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(1.5rem); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
            <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3">
                {toasts.map(t => (
                    <ToastItem key={t.id} t={t} onDismiss={dismiss} />
                ))}
            </div>
        </>,
        document.body
    );
}

// ── showConfirm – async confirm dialog replacing browser confirm() ──────────
interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
}

let confirmResolver: ((val: boolean) => void) | null = null;
let confirmSetters: ((opts: ConfirmOptions | null) => void)[] = [];

export function showConfirm(message: string, options?: Partial<ConfirmOptions>): Promise<boolean> {
    return new Promise(resolve => {
        confirmResolver = resolve;
        confirmSetters.forEach(s => s({ message, ...options }));
    });
}

export function ConfirmDialog() {
    const [opts, setOpts] = useState<ConfirmOptions | null>(null);

    useEffect(() => {
        confirmSetters.push(setOpts);
        return () => { const i = confirmSetters.indexOf(setOpts); if (i >= 0) confirmSetters.splice(i, 1); };
    }, []);

    const respond = (val: boolean) => {
        confirmResolver?.(val);
        confirmResolver = null;
        setOpts(null);
    };

    if (!opts) return null;

    const isDanger = opts.variant === 'danger';

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => respond(false)} />
            {/* Dialog */}
            <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-slate-200">
                {opts.title && (
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{opts.title}</h3>
                )}
                <p className="text-sm text-slate-600 leading-relaxed mb-6">{opts.message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => respond(false)}
                        className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        {opts.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                        onClick={() => respond(true)}
                        className={`px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors ${isDanger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {opts.confirmLabel ?? 'Confirm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
