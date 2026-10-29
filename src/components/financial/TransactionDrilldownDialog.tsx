import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

export interface DrillEntry {
  id: string;
  date: string;
  ref: string;
  description: string;
  party?: string;
  site?: string;
  category?: string;
  bank?: string;
  amount: number;
  side: 'debit' | 'credit';
  /** Raw source record shown when the entry is expanded */
  details?: Record<string, unknown>;
}

interface TransactionDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  notes?: string;
  entries: DrillEntry[];
  debitLabel?: string;
  creditLabel?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HIDDEN_KEYS = new Set(['printLayout', 'historyLog']);

const toLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

const toValue = (val: unknown): string => {
  if (typeof val === 'number') return Number.isInteger(val) ? val.toLocaleString() : fmt(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const isEmpty = (val: unknown) =>
  val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);

function EntryDetails({ details }: { details: Record<string, unknown> }) {
  const fields = Object.entries(details).filter(([k, v]) => !HIDDEN_KEYS.has(k) && !isEmpty(v));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
      {fields.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-[11px] min-w-0">
          <span className="text-slate-400 font-mono shrink-0 w-36 truncate">{toLabel(k)}</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium break-all">{toValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function TransactionDrilldownDialog({
  open,
  onClose,
  title,
  subtitle,
  notes,
  entries,
  debitLabel = 'Debit (₦)',
  creditLabel = 'Credit (₦)',
}: TransactionDrilldownDialogProps) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(entries.length === 1 ? entries[0].id : null);

  const filtered = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (normalizeDate(a.date) || '').localeCompare(normalizeDate(b.date) || ''));
    if (!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(e =>
      [e.ref, e.description, e.party, e.site, e.category, e.bank].some(f => (f || '').toLowerCase().includes(q))
    );
  }, [entries, query]);

  const totalDebit = filtered.reduce((s, e) => s + (e.side === 'debit' ? e.amount : 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + (e.side === 'credit' ? e.amount : 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-5xl rounded-sm">
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <DialogTitle>{title}</DialogTitle>
            {subtitle && <DialogDescription className="font-mono text-xs">{subtitle}</DialogDescription>}
          </div>
          <DialogClose />
        </DialogHeader>

        <div className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-xs font-mono text-slate-500">
            {filtered.length} of {entries.length} source record{entries.length === 1 ? '' : 's'} · click a row to see its full content
          </span>
          {entries.length > 1 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                id="drilldown-search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter records..."
                className="h-8 pl-8 text-xs rounded-sm"
              />
            </div>
          )}
        </div>

        {notes && (
          <div className="mx-6 mt-3 p-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-sm shrink-0">
            {notes}
          </div>
        )}

        <div className="overflow-auto flex-1 px-6 py-3">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">No individual voucher entries.</p>
              <p className="text-xs text-slate-400">
                This balance is an accounting reconciliation figure derived from recognized assets, liabilities, and reported operations.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse min-w-[760px]">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                <tr className="border-b-2 border-slate-900 dark:border-slate-100 text-[11px] uppercase tracking-wider font-bold text-slate-600 dark:text-slate-300 text-left bg-white dark:bg-slate-900">
                  <th className="py-2.5 px-2 w-6 bg-white dark:bg-slate-900" />
                  <th className="py-2.5 px-2 w-24 bg-white dark:bg-slate-900">Date</th>
                  <th className="py-2.5 px-2 w-32 font-mono bg-white dark:bg-slate-900">Ref / Voucher</th>
                  <th className="py-2.5 px-2 bg-white dark:bg-slate-900">Particulars</th>
                  <th className="py-2.5 px-2 text-right w-36 bg-white dark:bg-slate-900">{debitLabel}</th>
                  <th className="py-2.5 px-2 text-right w-36 bg-white dark:bg-slate-900">{creditLabel}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const expanded = expandedId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className={cn(
                          'border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40',
                          expanded && 'bg-slate-50 dark:bg-slate-800/40'
                        )}
                      >
                        <td className="py-2 px-2 text-slate-400">
                          {e.details && (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {e.date ? formatDisplayDate(normalizeDate(e.date) || e.date) : '—'}
                        </td>
                        <td className="py-2 px-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{e.ref}</td>
                        <td className="py-2 px-2">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{e.description}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex flex-wrap gap-x-2">
                            {e.party && <span>Party: {e.party}</span>}
                            {e.site && <span>· Site: {e.site}</span>}
                            {e.category && <span>· {e.category}</span>}
                            {e.bank && <span>· {e.bank}</span>}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">{e.side === 'debit' ? `₦${fmt(e.amount)}` : '—'}</td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">{e.side === 'credit' ? `₦${fmt(e.amount)}` : '—'}</td>
                      </tr>
                      {expanded && e.details && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <EntryDetails details={e.details} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-black bg-slate-100 dark:bg-slate-800">
                  <td colSpan={4} className="py-2.5 px-2 uppercase tracking-wider">Totals</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">₦{fmt(totalDebit)}</td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">₦{fmt(totalCredit)}</td>
                </tr>
                {totalDebit > 0 && totalCredit > 0 && (
                  <tr className="border-b-2 border-emerald-600 dark:border-emerald-500 font-bold bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200">
                    <td colSpan={4} className="py-2 px-2 uppercase tracking-wider text-[11px]">
                      Net Balance (Additions less Reductions)
                    </td>
                    <td colSpan={2} className="py-2 px-2 text-right font-mono tabular-nums text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      ₦{fmt(Math.abs(totalDebit - totalCredit))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
