import { useState, useMemo, useCallback } from 'react';
import { useAppStore, BudgetItem, LedgerEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { useTheme } from '@/src/hooks/useTheme';
import { generateId } from '@/src/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO,
  addWeeks, subWeeks, addMonths, subMonths, format,
} from 'date-fns';
import {
  getISOWeekMonday, getISOWeekMondayString, formatWeekLabel, formatDisplayDate,
} from '@/src/lib/dateUtils';
import {
  PiggyBank, Plus, Trash2, Edit2, Link2, Unlink, CheckCircle2,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, Calendar,
  AlertCircle, Clock, CheckCheck, SlidersHorizontal, MoreVertical,
  ListChecks, Wallet2, ClipboardList,
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { cn } from '@/src/lib/utils';

// ─── Date range helper ────────────────────────────────────────────────────────
function getBudgetRange(anchor: Date, mode: 'weekly' | 'monthly') {
  if (mode === 'monthly') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
}

function inRange(weekStartStr: string, start: Date, end: Date) {
  try {
    const d = parseISO(weekStartStr);
    return isWithinInterval(d, { start, end });
  } catch { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number | null) {
  if (n == null) return '\u2014';
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2 }).format(n);
}

function StatusBadge({ status }: { status: BudgetItem['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  }
  if (status === 'budgeted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
        <AlertCircle className="w-3 h-3" /> Budgeted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" /> Settled
    </span>
  );
}

function currentWeekStart() {
  return getISOWeekMondayString(new Date());
}
function currentWeekLabel() {
  return formatWeekLabel(getISOWeekMonday(new Date()));
}

interface BudgetForm {
  title: string;
  description: string;
  weekStart: string;
  weekLabel: string;
  requested: string;
  budgeted: string;
}

const emptyForm = (): BudgetForm => ({
  title: '',
  description: '',
  weekStart: currentWeekStart(),
  weekLabel: currentWeekLabel(),
  requested: '',
  budgeted: '',
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export function Budget() {
  const { isDark }  = useTheme();
  const priv        = usePriv('budget');
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { mainTasks, subtasks, users } = useAppData();

  const budgetItems      = useAppStore((s) => s.budgetItems);
  const addBudgetItem    = useAppStore((s) => s.addBudgetItem);
  const updateBudgetItem = useAppStore((s) => s.updateBudgetItem);
  const deleteBudgetItem = useAppStore((s) => s.deleteBudgetItem);
  const ledgerEntries    = useAppStore((s) => s.ledgerEntries);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [tab, setTab]               = useState<'requested' | 'budget'>('requested');
  const [viewMode, setViewMode]     = useState<'weekly' | 'monthly'>('weekly');
  const [anchor, setAnchor]         = useState(new Date());
  const [search, setSearch]         = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([currentWeekStart()]));
  const [expandedReqWeeks, setExpandedReqWeeks] = useState<Set<string>>(new Set([currentWeekStart()]));
  const [editItem, setEditItem]     = useState<BudgetItem | null>(null);
  const [formOpen, setFormOpen]     = useState(false);
  const [form, setForm]             = useState<BudgetForm>(emptyForm());
  const [linkTarget, setLinkTarget] = useState<BudgetItem | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [budgetedEdit, setBudgetedEdit] = useState<{ id: string; val: string } | null>(null);
  const [reqBudgetEdit, setReqBudgetEdit] = useState<{ id: string; val: string } | null>(null);
  const [showBacklog, setShowBacklog] = useState(true);

  // ── Period range ──────────────────────────────────────────────────────────
  const { start: rangeStart, end: rangeEnd } = getBudgetRange(anchor, viewMode);
  const periodLabel = viewMode === 'monthly'
    ? format(anchor, 'MMMM yyyy')
    : `Week ${format(rangeStart, 'w')} · ${format(rangeStart, 'MMM yyyy')}`;

  // ── Actual spend per item ─────────────────────────────────────────────────
  const actualSpend = useCallback((item: BudgetItem) => {
    return (item.linkedLedgerIds ?? [])
      .map((id) => ledgerEntries.find((e) => e.id === id))
      .filter(Boolean)
      .reduce((acc, e) => acc + Number((e as LedgerEntry).amount), 0);
  }, [ledgerEntries]);

  // ── Budget tab: only items where a budgeted amount has been set ──────────────
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = budgetItems.filter((b) => {
      if (b.budgeted == null) return false; // pending items live in Requested tab
      const matchesSearch = !q || b.title.toLowerCase().includes(q) || b.weekLabel.toLowerCase().includes(q);
      const matchesPeriod = inRange(b.weekStart, rangeStart, rangeEnd);
      return matchesSearch && matchesPeriod;
    });
    const map = new Map<string, BudgetItem[]>();
    for (const item of filtered) {
      if (!map.has(item.weekStart)) map.set(item.weekStart, []);
      map.get(item.weekStart)!.push(item);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekStart, items]) => ({
        weekStart,
        weekLabel: items[0].weekLabel,
        items: [...items].sort((a, b) => a.title.localeCompare(b.title)),
        totals: {
          requested:    items.reduce((s, i) => s + i.requested, 0),
          budgeted:     items.reduce((s, i) => s + (i.budgeted ?? 0), 0),
          actuallySpent: items.reduce((s, i) => s + actualSpend(i), 0),
        },
      }));
  }, [budgetItems, search, actualSpend, rangeStart, rangeEnd]);

  // ── Unified "Requested" rows: pending subtask requests + pending BudgetItems ──
  interface UnifiedReqRow {
    id: string;
    rowType: 'subtask' | 'budgetItem';
    title: string;
    description?: string;
    mainTaskTitle?: string;
    requesterId?: string;
    assigneeId?: string;
    amount: number;
    taskStatus?: string;    // for subtask rows
    budgetStatus?: string;  // for budgetItem rows (always 'pending')
    source: 'task' | 'manual';
    weekStart: string;
    weekLabel: string;
    // keep refs for actions on budgetItem rows
    budgetItemId?: string;
    rawBudgetItem?: BudgetItem;
    createdAt?: string;
  }

  const requestedGroups = useMemo(() => {
    const q = search.toLowerCase();

    // 1. Subtasks with hasBudget that don't yet have ANY BudgetItem created for them
    const subtaskRows: UnifiedReqRow[] = subtasks
      .filter((s: any) => {
        if (!s.hasBudget || !s.budgetRequested) return false;
        // If a BudgetItem already exists for this subtask, skip here (handled below)
        const hasItem = budgetItems.some(
          (b) => b.subtaskId === s.id || (b as any).subtask_id === s.id
        );
        if (hasItem) return false;
        const mt = mainTasks.find((m: any) => m.id === (s.mainTaskId || s.main_task_id));
        const matchesSearch = !q ||
          s.title.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (mt?.title || '').toLowerCase().includes(q);
        return matchesSearch;
      })
      .map((s: any) => {
        const dateStr: string = s.deadline || s.createdAt || new Date().toISOString();
        let weekStart: string, weekLabel: string;
        try {
          const d = parseISO(dateStr);
          weekStart = getISOWeekMondayString(d);
          weekLabel = formatWeekLabel(getISOWeekMonday(d));
        } catch {
          weekStart = currentWeekStart();
          weekLabel = currentWeekLabel();
        }
        const mt = mainTasks.find((m: any) => m.id === (s.mainTaskId || s.main_task_id));
        return {
          id: s.id,
          rowType: 'subtask' as const,
          title: s.title,
          description: s.description,
          mainTaskTitle: mt?.title,
          requesterId: mt?.createdBy || (mt as any)?.created_by,
          assigneeId: s.assignedTo || s.assigned_to,
          amount: Number(s.budgetRequested || 0),
          taskStatus: s.status,
          source: 'task' as const,
          weekStart,
          weekLabel,
          createdAt: s.createdAt || s.created_at,
        };
      });

    // 2. BudgetItems with no budgeted amount yet (pending — both manual and task-converted)
    const budgetItemRows: UnifiedReqRow[] = budgetItems
      .filter((b) => {
        if (b.budgeted != null) return false; // already in Budget tab
        const matchesSearch = !q ||
          b.title.toLowerCase().includes(q) ||
          b.weekLabel.toLowerCase().includes(q);
        return matchesSearch;
      })
      .map((b) => {
        const mt = mainTasks.find((m: any) => m.id === b.mainTaskId || m.id === (b as any).main_task_id);
        return {
          id: b.id,
          rowType: 'budgetItem' as const,
          title: b.title,
          description: b.description,
          mainTaskTitle: mt?.title,
          requesterId: b.source === 'task'
            ? (mt?.createdBy || (mt as any)?.created_by)
            : (b.createdBy || (b as any).created_by),
          amount: Number(b.requested || 0),
          budgetStatus: 'pending',
          source: b.source === 'task' ? 'task' as const : 'manual' as const,
          weekStart: b.weekStart,
          weekLabel: b.weekLabel,
          budgetItemId: b.id,
          rawBudgetItem: b,
          createdAt: b.createdAt || (b as any).created_at,
        };
      });

    // Merge + group by weekStart
    const allRows = [...subtaskRows, ...budgetItemRows];
    const map = new Map<string, UnifiedReqRow[]>();
    for (const r of allRows) {
      if (!map.has(r.weekStart)) map.set(r.weekStart, []);
      map.get(r.weekStart)!.push(r);
    }

    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekStart, rows]) => ({
        weekStart,
        weekLabel: rows[0].weekLabel,
        rows,
        total: rows.reduce((acc, r) => acc + r.amount, 0),
      }));
  }, [subtasks, mainTasks, budgetItems, search]);


  const toggleReqWeek = (ws: string) =>
    setExpandedReqWeeks((prev) => {
      const next = new Set(prev);
      next.has(ws) ? next.delete(ws) : next.add(ws);
      return next;
    });

  // ── Filtered ledger for link dialog ──────────────────────────────────────
  const filteredLedger = useMemo(() => {
    if (!linkTarget) return [];
    const q = linkSearch.toLowerCase();
    return ledgerEntries
      .filter((e) =>
        !q ||
        e.description?.toLowerCase().includes(q) ||
        e.voucherNo?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [ledgerEntries, linkSearch, linkTarget]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleWeek = (ws: string) =>
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(ws) ? next.delete(ws) : next.add(ws);
      return next;
    });

  const openAdd = () => { setEditItem(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (item: BudgetItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description || '',
      weekStart: item.weekStart,
      weekLabel: item.weekLabel,
      requested: String(item.requested),
      budgeted: item.budgeted != null ? String(item.budgeted) : '',
    });
    setFormOpen(true);
  };

  const handleWeekChange = (val: string) => {
    const label = val ? formatWeekLabel(getISOWeekMonday(new Date(val))) : '';
    setForm((f) => ({ ...f, weekStart: val, weekLabel: label }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.weekStart)    { toast.error('Week is required'); return; }
    const requested = parseFloat(form.requested);
    if (isNaN(requested) || requested <= 0) { toast.error('Enter a valid requested amount'); return; }
    const budgeted = form.budgeted ? parseFloat(form.budgeted) : undefined;
    const wLabel = form.weekLabel || formatWeekLabel(getISOWeekMonday(new Date(form.weekStart)));

    if (editItem) {
      updateBudgetItem(editItem.id, { title: form.title.trim(), description: form.description.trim(), weekStart: form.weekStart, weekLabel: wLabel, requested, budgeted });
      toast.success('Budget item updated');
    } else {
      const now = new Date().toISOString();
      addBudgetItem({
        id: generateId(),
        title: form.title.trim(),
        description: form.description.trim(),
        weekStart: form.weekStart,
        weekLabel: wLabel,
        requested,
        budgeted,
        linkedLedgerIds: [],
        source: 'manual',
        status: 'pending',
        workspaceId: currentUser?.workspaceId ?? '',
        createdBy: currentUser?.id ?? '',
        createdAt: now,
        updatedAt: now,
      });
      toast.success('Budget item added');
    }
    setFormOpen(false);
  };

  const handleDelete = useCallback(async (item: BudgetItem) => {
    const ok = await showConfirm(`Delete budget item "${item.title}"? This cannot be undone.`, { variant: 'danger' });
    if (!ok) return;
    deleteBudgetItem(item.id);
    toast.success('Deleted');
  }, [deleteBudgetItem]);

  const saveBudgeted = (item: BudgetItem, val: string) => {
    const num = parseFloat(val);
    if (!val.trim() || isNaN(num)) { setBudgetedEdit(null); return; }
    updateBudgetItem(item.id, { budgeted: num, status: 'budgeted' });
    setBudgetedEdit(null);
    toast.success('Budgeted amount saved');
  };

  const toggleSettled = (item: BudgetItem) => {
    const nextStatus: BudgetItem['status'] = item.status === 'settled' ? 'budgeted' : 'settled';
    updateBudgetItem(item.id, { status: nextStatus });
  };

  const toggleLedgerLink = (item: BudgetItem, ledgerId: string) => {
    const current = item.linkedLedgerIds ?? [];
    const linked = current.includes(ledgerId)
      ? current.filter((x) => x !== ledgerId)
      : [...current, ledgerId];
    updateBudgetItem(item.id, { linkedLedgerIds: linked });
  };

  // ── Set budget from Requested tab ────────────────────────────────────────
  const saveReqBudget = (row: UnifiedReqRow, val: string) => {
    const amount = parseFloat(val);
    if (isNaN(amount) || amount < 0) { setReqBudgetEdit(null); return; }

    if (row.rowType === 'budgetItem' && row.budgetItemId) {
      // Existing BudgetItem — just set the budgeted amount
      if (amount > 0) {
        updateBudgetItem(row.budgetItemId, { budgeted: amount, status: 'budgeted' });
        toast.success('Budget set — item moved to Budget tab');
      }
      // amount === 0 → stay in Requested, do nothing
    } else if (row.rowType === 'subtask') {
      // No BudgetItem yet — create one and (if amount > 0) immediately set budgeted
      const now = new Date().toISOString();
      addBudgetItem({
        id: generateId(),
        title: row.title,
        description: row.description,
        weekStart: row.weekStart,
        weekLabel: row.weekLabel,
        requested: row.amount,
        budgeted: amount > 0 ? amount : undefined,
        linkedLedgerIds: [],
        source: 'task',
        status: amount > 0 ? 'budgeted' : 'pending',
        workspaceId: currentUser?.workspaceId ?? '',
        createdBy: row.requesterId ?? currentUser?.id ?? '',
        createdAt: now,
        updatedAt: now,
        subtaskId: row.id,
        mainTaskId: subtasks.find((s: any) => s.id === row.id)?.mainTaskId || (subtasks.find((s: any) => s.id === row.id) as any)?.main_task_id || undefined,
      });
      if (amount > 0) {
        toast.success('Budget set — item moved to Budget tab');
      } else {
        toast.success('Item saved to Budget requests');
      }
    }
    setReqBudgetEdit(null);
  };

  // ── Page header (must be after all state declarations) ───────────────────
  useSetPageTitle(
    'Budget',
    'Weekly budget planning & spend tracking',
    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">

      {/* ── Tab switcher ─────────────────────────────────────────── */}
      <div className={cn("flex items-center rounded-lg border overflow-hidden h-9 shrink-0", isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
        <button
          onClick={() => setTab('requested')}
          className={cn(
            "h-full px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap",
            tab === 'requested'
              ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700')
              : (isDark ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50')
          )}
        >
          Requests
          {requestedGroups.reduce((s, g) => s + g.rows.length, 0) > 0 && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", tab === 'requested' ? (isDark ? 'bg-amber-500/30' : 'bg-amber-100') : (isDark ? 'bg-white/10' : 'bg-slate-100'))}>
              {requestedGroups.reduce((s, g) => s + g.rows.length, 0)}
            </span>
          )}
        </button>
        <div className={cn("w-px h-5 shrink-0", isDark ? "bg-white/10" : "bg-slate-200")} />
        <button
          onClick={() => setTab('budget')}
          className={cn(
            "h-full px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap",
            tab === 'budget'
              ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
              : (isDark ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50')
          )}
        >
          Budget
          {budgetItems.filter(b => b.budgeted != null).length > 0 && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", tab === 'budget' ? (isDark ? 'bg-emerald-500/30' : 'bg-emerald-100') : (isDark ? 'bg-white/10' : 'bg-slate-100'))}>
              {budgetItems.filter(b => b.budgeted != null).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Period navigator ─────────────────────────────────────── */}
      <div className={cn("flex items-center rounded-lg border overflow-hidden h-9 shrink-0", isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
        <button
          onClick={() => setAnchor(a => viewMode === 'monthly' ? subMonths(a, 1) : subWeeks(a, 1))}
          className={cn("h-full w-7 flex items-center justify-center transition-colors", isDark ? "text-white/50 hover:text-white hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50")}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className={cn("flex items-center gap-1 px-1.5 min-w-[120px] justify-center text-[11px] font-bold whitespace-nowrap", isDark ? "text-white" : "text-slate-700")}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          {periodLabel}
        </div>
        <button
          onClick={() => setAnchor(a => viewMode === 'monthly' ? addMonths(a, 1) : addWeeks(a, 1))}
          className={cn("h-full w-7 flex items-center justify-center transition-colors", isDark ? "text-white/50 hover:text-white hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50")}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── View mode (Weekly / Monthly) Toggle ──────────────────── */}
      <button
        onClick={() => setViewMode(v => v === 'monthly' ? 'weekly' : 'monthly')}
        className={cn(
          "h-9 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0",
          isDark ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10" : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
        {viewMode === 'monthly' ? 'Monthly' : 'Weekly'}
      </button>


    </div>
,
    [tab, viewMode, anchor, isDark, requestedGroups, budgetItems, periodLabel]
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">

      {/* ── Toolbar: Add Item + Search ────────────────────────────── */}
      <div className="flex items-center gap-3">
        {priv.canAdd && (
          <Button
            onClick={openAdd}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-10 px-4 text-sm font-semibold active:scale-[0.98] transition-transform rounded-xl shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        )}
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
          <input
            className={cn(
              "w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 h-10",
              isDark
                ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-emerald-500/30"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-emerald-500/20"
            )}
            placeholder="Search items, tasks, weeks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2", isDark ? "text-white/40 hover:text-white" : "text-slate-400 hover:text-slate-600")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REQUESTED TAB                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'requested' && (
        <>
          {/* This-week requested total card */}
          {(() => {
            const thisWeek = requestedGroups.find(g => g.weekStart === currentWeekStart());
            if (!thisWeek) return null;
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'This Week Requested',   value: thisWeek.total,                                                              color: 'amber' },
                  { label: 'Awaiting Budget',        value: thisWeek.rows.filter(r => r.rowType === 'budgetItem').length,               color: 'rose',    isCount: true },
                  { label: 'Pending Task Approval',  value: thisWeek.rows.filter(r => r.rowType === 'subtask').length,                  color: 'blue',    isCount: true },
                ].map(({ label, value, color, isCount }) => (
                  <Card key={label} className={cn("border rounded-xl shadow-sm", isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-slate-200")}>
                    <CardContent className="p-4">
                      <p className={cn("text-xs mb-1 font-semibold", isDark ? "text-white/50" : "text-slate-500")}>{label}</p>
                      <p className={cn('text-lg font-bold', isCount ? '' : 'font-mono', {
                        'text-amber-500':   color === 'amber',
                        'text-rose-500':    color === 'rose',
                        'text-blue-500':    color === 'blue',
                        'text-emerald-500': color === 'emerald',
                      })}>
                        {isCount ? value : <>&#8358;{fmt(value as number)}</>}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          {/* Empty state */}
          {requestedGroups.length === 0 && (
            <Card className={cn("border shadow-sm", isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white")}>
              <CardContent className="py-16 text-center">
                <ListChecks className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-white/20" : "text-slate-300")} />
                <p className={cn("text-sm font-semibold mb-1", isDark ? "text-white/60" : "text-slate-600")}>No budget requests yet</p>
                <p className={cn("text-xs", isDark ? "text-white/30" : "text-slate-400")}>
                  Budget task requests and manually added items (before a budget is set) appear here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Single flat table with week dividers ── */}
          {requestedGroups.length > 0 && (() => {
            const todayWS = currentWeekStart();
            const backlogCount = requestedGroups
              .filter(g => g.weekStart < todayWS)
              .reduce((s, g) => s + g.rows.length, 0);
            const visibleGroups = requestedGroups.filter(g =>
              g.weekStart >= todayWS || showBacklog
            );

            return (
              <>
                {/* Backlog toggle */}
                {backlogCount > 0 && (
                  <button
                    onClick={() => setShowBacklog(v => !v)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all w-full",
                      showBacklog
                        ? (isDark ? "bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/15" : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100")
                        : (isDark ? "bg-white/5 border-white/10 text-white/50 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100")
                    )}
                  >
                    <AlertCircle className={cn("w-3.5 h-3.5 shrink-0", showBacklog ? "text-rose-400" : (isDark ? "text-white/30" : "text-slate-400"))} />
                    <span>
                      {showBacklog ? 'Hide' : 'Show'} Backlog
                      <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        isDark ? "bg-rose-500/20 text-rose-300" : "bg-rose-100 text-rose-600"
                      )}>{backlogCount}</span>
                    </span>
                    <span className={cn("ml-auto text-[10px]", isDark ? "text-white/30" : "text-slate-400")}>
                      {backlogCount} item{backlogCount !== 1 ? 's' : ''} from past weeks still need a budget
                    </span>
                  </button>
                )}

                {/* ── REQUESTS: Mobile cards ── */}
                <div className="md:hidden space-y-3">
                  {visibleGroups.map(({ weekStart, weekLabel, rows }) => {
                    const isBacklog = weekStart < todayWS;
                    const isCurrent = weekStart === todayWS;
                    return (
                      <div key={`mob-grp-${weekStart}`}>
                        {/* Week header */}
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs font-bold',
                          isBacklog
                            ? (isDark ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200')
                            : (isDark ? 'bg-white/5 text-white/60 border border-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200')
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          {weekLabel}
                          {isCurrent && <span className="font-normal opacity-70">(current week)</span>}
                          {isBacklog && <span className={cn('ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold', isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-600')}>Backlog</span>}
                        </div>
                        {/* Row cards */}
                        {rows.map((row) => {
                          const requester = users.find((u: any) => u.id === row.requesterId);
                          let approver = null;
                          let approvalColorClass = isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-500';
                          if (row.source === 'task') {
                            let subtask;
                            if (row.rowType === 'subtask') subtask = subtasks.find((s: any) => s.id === row.id);
                            else if (row.rowType === 'budgetItem') { const raw = row.rawBudgetItem as any; subtask = subtasks.find((s: any) => s.id === raw?.subtaskId || s.id === raw?.subtask_id); }
                            if (subtask) {
                              approver = users.find((u: any) => u.id === (subtask.approvedBy || subtask.approved_by));
                              if (subtask.status === 'completed') approvalColorClass = isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
                              else if (subtask.status === 'rejected') approvalColorClass = isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700';
                            }
                          }
                          let statusClass = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                          let statusLabel = 'Pending Budget';
                          let StatusIcon = Clock;
                          if (row.rowType === 'subtask' && row.taskStatus) {
                            const map: Record<string, [string, string]> = {
                              not_started: ['text-slate-400 bg-slate-500/10 border-slate-500/20', 'Not Started'],
                              in_progress: ['text-blue-400 bg-blue-500/10 border-blue-500/20', 'In Progress'],
                              pending_approval: ['text-amber-400 bg-amber-500/10 border-amber-500/20', 'Pending Approval'],
                              completed: ['text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 'Completed'],
                            };
                            [statusClass, statusLabel] = map[row.taskStatus] ?? [statusClass, row.taskStatus];
                            if (row.taskStatus === 'completed') StatusIcon = CheckCircle2;
                          } else { statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20'; statusLabel = 'Awaiting Budget'; }
                          const dateAdded = row.createdAt ? (() => { try { return format(parseISO(row.createdAt!), 'd MMM yyyy'); } catch { return '—'; } })() : '—';
                          return (
                            <div key={row.id} className={cn(
                              'rounded-xl border p-4 mb-2 space-y-3',
                              isBacklog
                                ? (isDark ? 'border-rose-500/20 bg-rose-500/[0.06]' : 'border-rose-200 bg-rose-50/60')
                                : (isDark ? 'border-white/8 bg-white/[0.02]' : 'border-slate-200 bg-white')
                            )}>
                              {/* Title row */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn('font-semibold text-sm', isDark ? 'text-white/90' : 'text-slate-700')}>{row.title}</span>
                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium',
                                      row.source === 'task' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : (isDark ? 'bg-white/5 text-white/40 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200')
                                    )}>{row.source === 'task' ? 'Task' : 'Manual'}</span>
                                  </div>
                                  {row.mainTaskTitle && <div className={cn('text-[11px] mt-0.5 flex items-center gap-1', isDark ? 'text-white/35' : 'text-slate-400')}><ClipboardList className="w-3 h-3 shrink-0" />{row.mainTaskTitle}</div>}
                                  {row.description && <div className={cn('text-[11px] mt-1 leading-relaxed', isDark ? 'text-white/50' : 'text-slate-500')}>{row.description}</div>}
                                </div>
                                {row.rowType === 'budgetItem' && row.rawBudgetItem && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0 rounded-lg shrink-0', isDark ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100')}>
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className={cn('w-44 border shadow-lg', isDark ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                                      {priv.canEdit && <DropdownMenuItem onClick={() => openEdit(row.rawBudgetItem!)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"><Edit2 className="w-3.5 h-3.5 text-blue-500" />Edit Item</DropdownMenuItem>}
                                      {priv.canDelete && <DropdownMenuItem onClick={() => handleDelete(row.rawBudgetItem!)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2 text-red-500 focus:text-red-500"><Trash2 className="w-3.5 h-3.5 text-red-500" />Delete Item</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              {/* Meta row */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-slate-400')}>{dateAdded}</span>
                                {requester && <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')} title={requester.name}>{requester.name?.charAt(0).toUpperCase()}</div>}
                                {row.source === 'task' && (
                                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', approvalColorClass)} title={approver ? approver.name : 'Pending Approval'}>{approver ? approver.name.charAt(0).toUpperCase() : '?'}</div>
                                )}
                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ml-auto', statusClass)}><StatusIcon className="w-2.5 h-2.5" />{statusLabel}</span>
                              </div>
                              {/* Amount + Set Budget */}
                              <div className={cn('flex items-center justify-between pt-2 border-t', isDark ? 'border-white/5' : 'border-slate-100')}>
                                <div>
                                  <div className={cn('text-[10px] uppercase tracking-wider mb-0.5', isDark ? 'text-white/30' : 'text-slate-400')}>Requested</div>
                                  <div className="text-amber-600 dark:text-amber-400 font-mono font-semibold text-sm">&#8358;{fmt(row.amount)}</div>
                                </div>
                                <div>
                                  {row.source === 'task' && row.taskStatus !== 'completed' ? (
                                    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold opacity-60 bg-slate-100 border-slate-200 text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white/30')}>
                                      <Clock className="w-3 h-3" /> Awaiting Approval
                                    </span>
                                  ) : reqBudgetEdit?.id === row.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className={cn('text-xs font-semibold', isDark ? 'text-white/40' : 'text-slate-400')}>&#8358;</span>
                                      <input autoFocus type="number" min="0" step="any"
                                        value={reqBudgetEdit.val}
                                        onChange={(e) => setReqBudgetEdit({ id: row.id, val: e.target.value })}
                                        onBlur={() => saveReqBudget(row, reqBudgetEdit.val)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveReqBudget(row, reqBudgetEdit.val); if (e.key === 'Escape') setReqBudgetEdit(null); }}
                                        className={cn('w-24 px-2 py-1 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2', isDark ? 'bg-white/10 border-emerald-500/40 text-white focus:ring-emerald-500/30' : 'bg-emerald-50 border-emerald-300 text-slate-800 focus:ring-emerald-400/30')}
                                      />
                                    </div>
                                  ) : (
                                    <button onClick={() => setReqBudgetEdit({ id: row.id, val: '' })} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all', isDark ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100')}>
                                      <CheckCheck className="w-3 h-3" /> Set Budget
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* ── REQUESTS: Desktop table ── */}
                <Card className={cn("hidden md:block border rounded-xl overflow-hidden shadow-sm", isDark ? "border-white/10" : "border-slate-200")}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className={cn("hover:bg-transparent border-b", isDark ? "border-white/10" : "border-slate-200")}>
                          <TableHead className={cn("text-xs w-[28%] font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Task / Item</TableHead>
                          <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Date Added</TableHead>
                          <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Requester</TableHead>
                          <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Approved By</TableHead>
                          <TableHead className={cn("text-xs text-right font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Requested (&#8358;)</TableHead>
                          <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Set Budget (&#8358;)</TableHead>
                          <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Status</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleGroups.map(({ weekStart, weekLabel, rows }) => {
                          const isBacklog = weekStart < todayWS;
                          const isCurrent = weekStart === todayWS;
                          return (
                            <>
                              {/* Week divider row */}
                              <TableRow key={`divider-${weekStart}`} className={cn(
                                "border-b",
                                isBacklog
                                  ? (isDark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50/70 border-rose-200")
                                  : (isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200")
                              )}>
                                <TableCell colSpan={8} className="py-2 px-5">
                                  <div className="flex items-center gap-2">
                                    <Calendar className={cn('w-3.5 h-3.5', isBacklog ? 'text-rose-400' : isCurrent ? 'text-amber-400' : (isDark ? 'text-white/40' : 'text-slate-400'))} />
                                    <span className={cn('font-bold text-xs',
                                      isBacklog ? (isDark ? 'text-rose-300' : 'text-rose-700') :
                                      isCurrent ? (isDark ? 'text-amber-300' : 'text-amber-700') :
                                      (isDark ? 'text-white/60' : 'text-slate-600')
                                    )}>
                                      {weekLabel}
                                      {isCurrent && <span className="ml-2 font-normal opacity-70">(current week)</span>}
                                      {isBacklog && (
                                        <span className={cn("ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                          isDark ? "bg-rose-500/20 text-rose-300" : "bg-rose-100 text-rose-600"
                                        )}>Backlog</span>
                                      )}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Data rows */}
                              {rows.map((row) => {
                                const requester = users.find((u: any) => u.id === row.requesterId);
                                let approver = null;
                                let approvalColorClass = isDark ? "bg-slate-500/20 text-slate-400" : "bg-slate-100 text-slate-500";
                                if (row.source === 'task') {
                                  let subtask;
                                  if (row.rowType === 'subtask') subtask = subtasks.find((s: any) => s.id === row.id);
                                  else if (row.rowType === 'budgetItem') { const raw = row.rawBudgetItem as any; subtask = subtasks.find((s: any) => s.id === raw?.subtaskId || s.id === raw?.subtask_id); }
                                  if (subtask) {
                                    const approverId = subtask.approvedBy || subtask.approved_by;
                                    approver = users.find((u: any) => u.id === approverId);
                                    if (subtask.status === 'completed') approvalColorClass = isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700";
                                    else if (subtask.status === 'rejected') approvalColorClass = isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700";
                                  }
                                }
                                let statusClass = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                                let statusLabel = 'Pending Budget';
                                let StatusIcon = Clock;
                                if (row.rowType === 'subtask' && row.taskStatus) {
                                  const map: Record<string, [string, string]> = {
                                    not_started: ['text-slate-400 bg-slate-500/10 border-slate-500/20', 'Not Started'],
                                    in_progress: ['text-blue-400 bg-blue-500/10 border-blue-500/20', 'In Progress'],
                                    pending_approval: ['text-amber-400 bg-amber-500/10 border-amber-500/20', 'Pending Approval'],
                                    completed: ['text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 'Completed'],
                                  };
                                  [statusClass, statusLabel] = map[row.taskStatus] ?? [statusClass, row.taskStatus];
                                  if (row.taskStatus === 'completed') StatusIcon = CheckCircle2;
                                } else { statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20'; statusLabel = 'Awaiting Budget'; }
                                const dateAdded = row.createdAt ? (() => { try { return format(parseISO(row.createdAt!), 'd MMM yyyy'); } catch { return '—'; } })() : '—';
                                return (
                                  <TableRow key={row.id} className={cn(
                                    "border-b transition-colors",
                                    isBacklog
                                      ? (isDark ? "border-rose-500/10 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]" : "border-rose-100 bg-rose-50/40 hover:bg-rose-50/70")
                                      : (isDark ? "border-white/5 hover:bg-white/[0.03]" : "border-slate-100 hover:bg-slate-50/50")
                                  )}>
                                    <TableCell className={cn("font-medium text-sm py-3", isDark ? "text-white/90" : "text-slate-700")}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{row.title}</span>
                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', row.source === 'task' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : (isDark ? 'bg-white/5 text-white/40 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'))}>{row.source === 'task' ? 'Task' : 'Manual'}</span>
                                      </div>
                                      {row.mainTaskTitle && <div className={cn('text-[11px] mt-0.5 flex items-center gap-1', isDark ? 'text-white/35' : 'text-slate-400')}><ClipboardList className="w-3 h-3 shrink-0" />{row.mainTaskTitle}</div>}
                                      {row.description && <div className={cn('text-[11px] mt-1.5 leading-relaxed', isDark ? 'text-white/50' : 'text-slate-500')}>{row.description}</div>}
                                    </TableCell>
                                    <TableCell className={cn("text-xs whitespace-nowrap", isDark ? "text-white/40" : "text-slate-400")}>{dateAdded}</TableCell>
                                    <TableCell className={cn("text-xs", isDark ? "text-white/60" : "text-slate-600")}>
                                      {requester ? <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")} title={requester.name}>{requester.name?.charAt(0).toUpperCase()}</div> : <span className={isDark ? 'text-white/20' : 'text-slate-300'}>—</span>}
                                    </TableCell>
                                    <TableCell className={cn("text-xs", isDark ? "text-white/60" : "text-slate-600")}>
                                      {row.source === 'task' ? (approver ? <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", approvalColorClass)} title={approver.name}>{approver.name?.charAt(0).toUpperCase()}</div> : <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", approvalColorClass)} title="Pending Approval">?</div>) : <span className={isDark ? 'text-white/20' : 'text-slate-300'}>—</span>}
                                    </TableCell>
                                    <TableCell className="text-right text-amber-600 dark:text-amber-400 text-sm font-mono font-semibold">&#8358;{fmt(row.amount)}</TableCell>
                                    <TableCell className="py-2">
                                      {row.source === 'task' && row.taskStatus !== 'completed' ? (
                                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold opacity-60 bg-slate-100 border-slate-200 text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-white/30')}>
                                          <Clock className="w-3 h-3" /> Awaiting Approval
                                        </span>
                                      ) : reqBudgetEdit?.id === row.id ? (
                                        <div className="flex items-center gap-1">
                                          <span className={cn('text-xs font-semibold', isDark ? 'text-white/40' : 'text-slate-400')}>&#8358;</span>
                                          <input autoFocus type="number" min="0" step="any" value={reqBudgetEdit.val} onChange={(e) => setReqBudgetEdit({ id: row.id, val: e.target.value })} onBlur={() => saveReqBudget(row, reqBudgetEdit.val)} onKeyDown={(e) => { if (e.key === 'Enter') saveReqBudget(row, reqBudgetEdit.val); if (e.key === 'Escape') setReqBudgetEdit(null); }} className={cn('w-24 px-2 py-1 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2', isDark ? 'bg-white/10 border-emerald-500/40 text-white focus:ring-emerald-500/30' : 'bg-emerald-50 border-emerald-300 text-slate-800 focus:ring-emerald-400/30')} />
                                        </div>
                                      ) : (
                                        <button onClick={() => setReqBudgetEdit({ id: row.id, val: '' })} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all', isDark ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100')}><CheckCheck className="w-3 h-3" /> Set Budget</button>
                                      )}
                                    </TableCell>
                                    <TableCell><span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusClass)}><StatusIcon className="w-3 h-3" />{statusLabel}</span></TableCell>
                                    <TableCell className="text-right w-10 py-2">
                                      {row.rowType === 'budgetItem' && row.rawBudgetItem && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className={cn('h-8 w-8 p-0 rounded-lg', isDark ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100')}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className={cn('w-44 border shadow-lg', isDark ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                                            {priv.canEdit && <DropdownMenuItem onClick={() => openEdit(row.rawBudgetItem!)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"><Edit2 className="w-3.5 h-3.5 text-blue-500" />Edit Item</DropdownMenuItem>}
                                            {priv.canDelete && <DropdownMenuItem onClick={() => handleDelete(row.rawBudgetItem!)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"><Trash2 className="w-3.5 h-3.5 text-red-500" />Delete Item</DropdownMenuItem>}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* BUDGET TAB                                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'budget' && (
        <>
          {/* Current week summary cards */}
          {(() => {
            const thisWeek = grouped.find((g) => g.weekStart === currentWeekStart());
            if (!thisWeek) return null;
            const base = thisWeek.totals.budgeted || thisWeek.totals.requested;
            const left = base - thisWeek.totals.actuallySpent;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'This Week Requested', value: thisWeek.totals.requested,     color: 'amber'   },
                  { label: 'This Week Budgeted',  value: thisWeek.totals.budgeted,      color: 'blue'    },
                  { label: 'Actually Spent',      value: thisWeek.totals.actuallySpent, color: 'rose'    },
                  { label: 'Remaining',           value: left,                           color: left >= 0 ? 'emerald' : 'red' },
                ].map(({ label, value, color }) => (
                  <Card key={label} className={cn("border rounded-xl shadow-sm", isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-slate-200")}>
                    <CardContent className="p-4">
                      <p className={cn("text-xs mb-1 font-semibold", isDark ? "text-white/50" : "text-slate-500")}>{label}</p>
                      <p className={cn('text-lg font-bold font-mono', {
                        'text-amber-500':  color === 'amber',
                        'text-blue-500':   color === 'blue',
                        'text-rose-500':   color === 'rose',
                        'text-emerald-500':color === 'emerald',
                        'text-red-500':    color === 'red',
                      })}>
                        &#8358;{fmt(value)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          {/* Empty state */}
          {grouped.length === 0 && (
            <Card className={cn("border shadow-sm", isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white")}>
              <CardContent className="py-16 text-center">
                <PiggyBank className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-white/20" : "text-slate-300")} />
                <p className={cn("text-sm font-semibold mb-1", isDark ? "text-white/60" : "text-slate-600")}>No budget items yet</p>
                <p className={cn("text-xs mb-4", isDark ? "text-white/30" : "text-slate-400")}>Items appear here when approved from a task request or added manually.</p>
                {priv.canAdd && (
                  <Button onClick={openAdd} className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-sm font-semibold active:scale-[0.98] transition-transform">
                    <Plus className="w-4 h-4" /> Add your first item
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'budget' && (<>

      {/* Grouped weeks */}
      {grouped.map(({ weekStart, weekLabel, items, totals }) => {
        const isOpen    = expandedWeeks.has(weekStart);
        const isCurrent = weekStart === currentWeekStart();

        return (
          <Card key={weekStart} className={cn(
            "border rounded-xl overflow-hidden shadow-sm",
            isCurrent
              ? (isDark ? 'border-emerald-500/30' : 'border-emerald-500/40 bg-emerald-50/[0.02]')
              : (isDark ? 'border-white/10' : 'border-slate-200'),
          )}>
            {/* Week header */}
            <button
              onClick={() => toggleWeek(weekStart)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-4 transition-colors",
                isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar className={cn('w-4 h-4', isCurrent ? 'text-emerald-400' : (isDark ? 'text-white/40' : 'text-slate-400'))} />
                <span className={cn('font-semibold text-sm', isCurrent ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-white/80' : 'text-slate-700'))}>
                  {weekLabel}
                  {isCurrent && <span className="ml-2 text-xs text-emerald-500 font-normal">(current week)</span>}
                </span>
                <div className={cn("hidden sm:flex items-center gap-4 ml-4 text-xs", isDark ? "text-white/40" : "text-slate-400")}>
                  <span>Req: <span className="text-amber-500 font-medium">&#8358;{fmt(totals.requested)}</span></span>
                  <span>Bud: <span className="text-blue-500 font-medium">&#8358;{fmt(totals.budgeted)}</span></span>
                  <span>Spent: <span className="text-rose-500 font-medium">&#8358;{fmt(totals.actuallySpent)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs hidden sm:block", isDark ? "text-white/30" : "text-slate-400")}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                {isOpen ? <ChevronUp className={cn("w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} /> : <ChevronDown className={cn("w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />}
              </div>
            </button>

            {isOpen && (
              <div className={cn("border-t", isDark ? "border-white/10" : "border-slate-200")}>
                {/* ── Mobile cards ── */}
                <div className="md:hidden p-3 space-y-3">
                  {items.map((item) => {
                    const spent = actualSpend(item);
                    const base = item.budgeted ?? item.requested;
                    const left = base - spent;
                    const isBEditing = budgetedEdit?.id === item.id;
                    return (
                      <div key={item.id} className={cn('rounded-xl border p-4 space-y-3', isDark ? 'border-white/8 bg-white/[0.02]' : 'border-slate-200 bg-white')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className={cn('font-semibold text-sm', isDark ? 'text-white/90' : 'text-slate-700')}>{item.title}</div>
                            {item.description && <div className={cn('text-[11px] mt-1 leading-relaxed', isDark ? 'text-white/50' : 'text-slate-500')}>{item.description}</div>}
                            <div className={cn('text-[11px] mt-1.5 flex items-center gap-2 flex-wrap', isDark ? 'text-white/40' : 'text-slate-400')}>
                              {(() => {
                                if (item.source === 'task') {
                                  const mainTask = mainTasks.find(m => m.id === item.mainTaskId || m.id === (item as any).main_task_id);
                                  const subtask = subtasks.find(s => s.id === item.subtaskId || s.id === (item as any).subtask_id);
                                  const reqUser = users.find(u => u.id === mainTask?.createdBy || u.id === (mainTask as any)?.created_by);
                                  const appUser = users.find(u => u.id === subtask?.approvedBy || u.id === (subtask as any)?.approved_by);
                                  const appStatus = subtask?.status;
                                  let appCC = isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-500';
                                  if (appStatus === 'completed') appCC = isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
                                  else if (appStatus === 'rejected') appCC = isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700';
                                  return (<><span className="text-[10px] uppercase tracking-wider opacity-60">Req:</span><div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')} title={reqUser?.name || 'Unknown'}>{reqUser?.name?.charAt(0).toUpperCase() || '?'}</div><span className="text-[10px] uppercase tracking-wider opacity-60 ml-1">Appr:</span><div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', appCC)} title={appUser ? appUser.name : 'Pending Approval'}>{appUser ? appUser.name.charAt(0).toUpperCase() : '?'}</div></>);
                                } else {
                                  const reqUser = users.find(u => u.id === item.createdBy || u.id === (item as any).created_by);
                                  return (<><span className="text-[10px] uppercase tracking-wider opacity-60">Req:</span><div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')} title={reqUser?.name || 'Unknown'}>{reqUser?.name?.charAt(0).toUpperCase() || '?'}</div></>);
                                }
                              })()}
                              {(item.linkedLedgerIds?.length ?? 0) > 0 && <span className="text-teal-600 dark:text-teal-400 font-medium ml-1">{item.linkedLedgerIds!.length} link{item.linkedLedgerIds!.length > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge status={item.status} />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0 rounded-lg', isDark ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100')}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={cn('w-44 border shadow-lg', isDark ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
                                {priv.canLinkLedger && <DropdownMenuItem onClick={() => { setLinkTarget(item); setLinkSearch(''); }} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"><Link2 className="w-3.5 h-3.5 text-teal-500" />Link Ledger</DropdownMenuItem>}
                                {((item.linkedLedgerIds?.length ?? 0) > 0 || item.status === 'settled') && <DropdownMenuItem onClick={() => toggleSettled(item)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"><CheckCheck className={cn('w-3.5 h-3.5', item.status === 'settled' ? 'text-emerald-500' : 'text-slate-400')} />{item.status === 'settled' ? 'Unmark Settled' : 'Mark Settled'}</DropdownMenuItem>}
                                {priv.canEdit && <DropdownMenuItem onClick={() => openEdit(item)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"><Edit2 className="w-3.5 h-3.5 text-blue-500" />Edit Item</DropdownMenuItem>}
                                {priv.canDelete && <DropdownMenuItem onClick={() => handleDelete(item)} className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2 text-red-500 focus:text-red-500"><Trash2 className="w-3.5 h-3.5 text-red-500" />Delete Item</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className={cn('grid grid-cols-2 gap-2 pt-2 border-t', isDark ? 'border-white/5' : 'border-slate-100')}>
                          <div><div className={cn('text-[10px] uppercase tracking-wider mb-0.5', isDark ? 'text-white/30' : 'text-slate-400')}>Requested</div><div className="font-mono font-medium text-amber-600 dark:text-amber-400 text-sm">{fmt(item.requested)}</div></div>
                          <div>
                            <div className={cn('text-[10px] uppercase tracking-wider mb-0.5', isDark ? 'text-white/30' : 'text-slate-400')}>Budgeted</div>
                            {isBEditing ? (
                              <input autoFocus className={cn('w-full border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2', isDark ? 'bg-white/10 border-blue-500/40 text-white focus:ring-blue-500/20' : 'bg-white border-blue-400 text-slate-900 focus:ring-blue-500/10')} value={budgetedEdit.val} onChange={(e) => setBudgetedEdit({ id: item.id, val: e.target.value })} onBlur={() => saveBudgeted(item, budgetedEdit.val)} onKeyDown={(e) => { if (e.key === 'Enter') saveBudgeted(item, budgetedEdit.val); if (e.key === 'Escape') setBudgetedEdit(null); }} />
                            ) : (
                              <button disabled={!priv.canSetBudgeted} onClick={() => priv.canSetBudgeted && setBudgetedEdit({ id: item.id, val: item.budgeted != null ? String(item.budgeted) : '' })} className={cn('font-mono font-medium text-sm text-blue-600 dark:text-blue-400', priv.canSetBudgeted ? 'hover:underline cursor-pointer' : 'cursor-default')}>{item.budgeted != null ? fmt(item.budgeted) : <span className={cn('text-xs italic', isDark ? 'text-white/20' : 'text-slate-300')}>set amount</span>}</button>
                            )}
                          </div>
                          <div><div className={cn('text-[10px] uppercase tracking-wider mb-0.5', isDark ? 'text-white/30' : 'text-slate-400')}>Spent</div><div className="font-mono font-medium text-rose-500 dark:text-rose-400 text-sm">{fmt(spent)}</div></div>
                          <div><div className={cn('text-[10px] uppercase tracking-wider mb-0.5', isDark ? 'text-white/30' : 'text-slate-400')}>Left</div><div className={cn('font-mono font-medium text-sm', left >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>{fmt(left)}</div></div>
                        </div>
                        <span className={cn('inline-block text-xs px-2 py-0.5 rounded-full border font-medium', item.source === 'task' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' : (isDark ? 'bg-white/5 text-white/40 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'))}>{item.source === 'task' ? 'Task' : 'Manual'}</span>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop table ── */}
                <div className={cn("hidden md:block overflow-x-auto")}>
                <Table>
                  <TableHeader>
                    <TableRow className={cn("hover:bg-transparent border-b", isDark ? "border-white/10" : "border-slate-200")}>
                      <TableHead className={cn("text-xs w-[30%] font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Item</TableHead>
                      <TableHead className={cn("text-xs text-right font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Requested (&#8358;)</TableHead>
                      <TableHead className={cn("text-xs text-right font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Budgeted (&#8358;)</TableHead>
                      <TableHead className={cn("text-xs text-right font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Spent (&#8358;)</TableHead>
                      <TableHead className={cn("text-xs text-right font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Left (&#8358;)</TableHead>
                      <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Status</TableHead>
                      <TableHead className={cn("text-xs font-semibold", isDark ? "text-white/50" : "text-slate-500")}>Source</TableHead>
                      <TableHead className={cn("text-xs text-right w-[60px] font-semibold", isDark ? "text-white/50" : "text-slate-500")}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const spent  = actualSpend(item);
                      const base   = item.budgeted ?? item.requested;
                      const left   = base - spent;
                      const isBEditing = budgetedEdit?.id === item.id;

                      return (
                        <TableRow key={item.id} className={cn("border-b transition-colors", isDark ? "border-white/5 hover:bg-white/[0.03]" : "border-slate-100 hover:bg-slate-50/50")}>
                          {/* Title + meta */}
                          <TableCell className={cn("font-medium text-sm py-3", isDark ? "text-white/90" : "text-slate-700")}>
                            <div className="font-semibold">{item.title}</div>
                            <div className={cn("text-[11px] mt-1 font-normal flex items-center gap-2 flex-wrap", isDark ? "text-white/40" : "text-slate-400")}>
                              {(() => {
                                if (item.source === 'task') {
                                  const mainTask = mainTasks.find(m => m.id === item.mainTaskId || m.id === (item as any).main_task_id);
                                  const subtask = subtasks.find(s => s.id === item.subtaskId || s.id === (item as any).subtask_id);
                                  const reqUser = users.find(u => u.id === mainTask?.createdBy || u.id === (mainTask as any)?.created_by);
                                  const appUser = users.find(u => u.id === subtask?.approvedBy || u.id === (subtask as any)?.approved_by);
                                  const reqInitial = reqUser?.name?.charAt(0).toUpperCase() || '?';
                                  
                                  const appStatus = subtask?.status;
                                  let appColorClass = isDark ? "bg-slate-500/20 text-slate-400" : "bg-slate-100 text-slate-500";
                                  if (appStatus === 'completed') appColorClass = isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700";
                                  else if (appStatus === 'rejected') appColorClass = isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700";

                                  return (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-wider opacity-60">Req:</span>
                                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")} title={reqUser?.name || 'Unknown'}>{reqInitial}</div>
                                      </div>
                                      <span className="text-[10px]">&#8226;</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-wider opacity-60">Appr:</span>
                                        {appUser ? (
                                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", appColorClass)} title={appUser.name}>{appUser.name.charAt(0).toUpperCase()}</div>
                                        ) : (
                                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", appColorClass)} title="Pending Approval">?</div>
                                        )}
                                      </div>
                                    </>
                                  );
                                } else {
                                  const reqUser = users.find(u => u.id === item.createdBy || u.id === (item as any).created_by);
                                  const reqInitial = reqUser?.name?.charAt(0).toUpperCase() || '?';
                                  return (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] uppercase tracking-wider opacity-60">Req:</span>
                                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-help", isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")} title={reqUser?.name || 'Unknown'}>{reqInitial}</div>
                                    </div>
                                  );
                                }
                              })()}
                              {(item.linkedLedgerIds?.length ?? 0) > 0 && (
                                <>
                                  <span className="text-[10px]">&#8226;</span>
                                  <span className="text-teal-600 dark:text-teal-400 font-medium">
                                    {item.linkedLedgerIds!.length} link{item.linkedLedgerIds!.length > 1 ? 's' : ''}
                                  </span>
                                </>
                              )}
                            </div>
                            {item.description && (
                              <div className={cn("text-[11px] mt-1.5 leading-relaxed", isDark ? "text-white/50" : "text-slate-500")}>
                                {item.description}
                              </div>
                            )}
                          </TableCell>

                          {/* Requested */}
                          <TableCell className="text-right text-amber-600 dark:text-amber-400 text-sm font-mono font-medium">{fmt(item.requested)}</TableCell>

                          {/* Budgeted (inline-editable by accounts) */}
                          <TableCell className="text-right text-sm font-mono">
                            {isBEditing ? (
                              <input
                                autoFocus
                                className={cn(
                                  "w-28 text-right border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2",
                                  isDark
                                    ? "bg-white/10 border-blue-500/40 text-white focus:ring-blue-500/20"
                                    : "bg-white border-blue-400 text-slate-900 focus:ring-blue-500/10"
                                )}
                                value={budgetedEdit.val}
                                onChange={(e) => setBudgetedEdit({ id: item.id, val: e.target.value })}
                                onBlur={() => saveBudgeted(item, budgetedEdit.val)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')  saveBudgeted(item, budgetedEdit.val);
                                  if (e.key === 'Escape') setBudgetedEdit(null);
                                }}
                              />
                            ) : (
                              <button
                                disabled={!priv.canSetBudgeted}
                                onClick={() => priv.canSetBudgeted && setBudgetedEdit({ id: item.id, val: item.budgeted != null ? String(item.budgeted) : '' })}
                                className={cn(
                                  'text-blue-600 dark:text-blue-400 text-sm font-mono transition-colors font-medium',
                                  priv.canSetBudgeted ? 'hover:text-blue-500 dark:hover:text-blue-300 hover:underline cursor-pointer' : 'cursor-default',
                                )}
                                title={priv.canSetBudgeted ? 'Click to set budgeted amount' : undefined}
                              >
                                {item.budgeted != null ? fmt(item.budgeted) : <span className={cn("text-xs italic", isDark ? "text-white/20" : "text-slate-300")}>set amount</span>}
                              </button>
                            )}
                          </TableCell>

                          {/* Actually spent */}
                          <TableCell className="text-right text-rose-500 dark:text-rose-400 text-sm font-mono font-medium">{fmt(spent)}</TableCell>

                          {/* Left */}
                          <TableCell className={cn('text-right text-sm font-mono font-medium', left >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                            {fmt(left)}
                          </TableCell>

                          {/* Status */}
                          <TableCell><StatusBadge status={item.status} /></TableCell>

                          {/* Source */}
                          <TableCell>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full border font-medium',
                              item.source === 'task'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : (isDark ? 'bg-white/5 text-white/40 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'),
                            )}>
                              {item.source === 'task' ? 'Task' : 'Manual'}
                            </span>
                          </TableCell>

                          {/* Actions — 3-dot dropdown */}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn("h-8 w-8 p-0 rounded-lg", isDark ? "text-white/40 hover:text-white hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={cn("w-44 border shadow-lg", isDark ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
                                {priv.canLinkLedger && (
                                  <DropdownMenuItem
                                    onClick={() => { setLinkTarget(item); setLinkSearch(''); }}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-teal-500" />
                                    Link Ledger
                                  </DropdownMenuItem>
                                )}
                                {((item.linkedLedgerIds?.length ?? 0) > 0 || item.status === 'settled') && (
                                  <DropdownMenuItem
                                    onClick={() => toggleSettled(item)}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"
                                  >
                                    <CheckCheck className={cn("w-3.5 h-3.5", item.status === 'settled' ? "text-emerald-500" : "text-slate-400")} />
                                    {item.status === 'settled' ? 'Unmark Settled' : 'Mark Settled'}
                                  </DropdownMenuItem>
                                )}
                                {priv.canEdit && (
                                  <DropdownMenuItem
                                    onClick={() => openEdit(item)}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                    Edit Item
                                  </DropdownMenuItem>
                                )}
                                {priv.canDelete && (
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(item)}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    Delete Item
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}


                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      </>)}

      {/* ── Add / Edit Dialog ─────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className={cn(
          "max-w-md border shadow-2xl rounded-2xl overflow-hidden p-0",
          isDark ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
        )}>
          {/* Coloured header band */}
          <div className={cn(
            "px-6 pt-6 pb-4 border-b",
            isDark ? "bg-white/[0.02] border-white/10" : "bg-gradient-to-r from-emerald-50 to-teal-50/60 border-slate-100"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl border shrink-0",
                isDark ? "bg-emerald-500/20 border-emerald-500/30" : "bg-white border-emerald-200 shadow-sm"
              )}>
                <PiggyBank className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-800")}>
                  {editItem ? 'Edit Budget Item' : 'New Budget Item'}
                </h2>
                <p className={cn("text-xs mt-0.5", isDark ? "text-white/40" : "text-slate-500")}>
                  {editItem ? 'Update the details below' : 'Fill in the details to create a request'}
                </p>
              </div>
            </div>
          </div>

          {/* Form body */}
          <div className="px-6 py-5 space-y-5">
            {editItem?.source === 'task' && (() => {
              const mainTask = mainTasks.find(m => m.id === editItem.mainTaskId || m.id === (editItem as any).main_task_id);
              const subtask = subtasks.find(s => s.id === editItem.subtaskId || s.id === (editItem as any).subtask_id);
              return (
                <div className={cn(
                  "p-4 rounded-2xl border text-xs space-y-2.5",
                  isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-800"
                )}>
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse" />
                    Linked to Task Approval
                  </div>
                  <div>
                    <span className="font-semibold">Main Task:</span> {mainTask?.title || 'N/A'}
                  </div>
                  {subtask?.description && (
                    <div>
                      <span className="font-semibold">Task Description:</span> {subtask.description}
                    </div>
                  )}
                  <p className="text-[10px] opacity-75">
                    Note: Title, week, and requested amount cannot be edited manually because this item is bound to an approved task budget request.
                  </p>
                </div>
              );
            })()}

            {/* Item / Description */}
            <div className="space-y-1.5">
              <label className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-white/60" : "text-slate-500")}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Item / Description <span className="text-red-400 ml-0.5">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Office supplies purchase"
                disabled={editItem?.source === 'task'}
                className={cn(
                  "h-10 rounded-xl",
                  isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/25" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white"
                )}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-white/60" : "text-slate-500")}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                Details (Optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Any extra info..."
                disabled={editItem?.source === 'task'}
                rows={2}
                className={cn(
                  "w-full rounded-xl text-sm p-3 focus:outline-none focus:ring-2 border resize-none",
                  isDark
                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:ring-emerald-500/30"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-emerald-500/20"
                )}
              />
            </div>

            {/* Week picker */}
            <div className="space-y-1.5">
              <label className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-white/60" : "text-slate-500")}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                Target Week <span className="text-red-400 ml-0.5">*</span>
              </label>
              <div className="relative">
                <Calendar className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none", isDark ? "text-white/30" : "text-slate-400")} />
                <input
                  type="date"
                  value={form.weekStart}
                  onChange={(e) => handleWeekChange(e.target.value)}
                  disabled={editItem?.source === 'task'}
                  className={cn(
                    "w-full pl-9 pr-3 h-10 rounded-xl text-sm focus:outline-none focus:ring-2 border",
                    isDark
                      ? "bg-white/5 border-white/10 text-white focus:ring-emerald-500/30 [color-scheme:dark] disabled:opacity-50"
                      : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-emerald-500/20 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  )}
                />
              </div>
              {form.weekLabel && (
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
                  isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                )}>
                  <Calendar className="w-3 h-3" />
                  &#8594; {form.weekLabel}
                </div>
              )}
            </div>

            {/* Amounts */}
            <div className={cn("grid gap-4", priv.canSetBudgeted ? "grid-cols-2" : "grid-cols-1")}>
              {/* Requested */}
              <div className="space-y-1.5">
                <label className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-white/60" : "text-slate-500")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Requested (&#8358;) <span className="text-red-400 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none", isDark ? "text-white/30" : "text-slate-400")}>&#8358;</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.requested}
                    onChange={(e) => setForm((f) => ({ ...f, requested: e.target.value }))}
                    placeholder="0.00"
                    disabled={editItem?.source === 'task'}
                    className={cn(
                      "h-10 pl-7 rounded-xl font-mono",
                      isDark ? "bg-white/5 border-white/10 text-amber-300 placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-amber-700 placeholder:text-slate-400 focus:bg-white"
                    )}
                  />
                </div>
              </div>

              {/* Budgeted (accounts only) */}
              {priv.canSetBudgeted && (
                <div className="space-y-1.5">
                  <label className={cn("text-xs font-semibold flex items-center gap-1.5", isDark ? "text-white/60" : "text-slate-500")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    Budget (&#8358;)
                    <span className={cn("text-[10px] font-normal ml-1 px-1.5 py-0.5 rounded-full", isDark ? "bg-white/10 text-white/40" : "bg-slate-100 text-slate-400")}>Accounts</span>
                  </label>
                  <div className="relative">
                    <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none", isDark ? "text-white/30" : "text-slate-400")}>&#8358;</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.budgeted}
                      onChange={(e) => setForm((f) => ({ ...f, budgeted: e.target.value }))}
                      placeholder="0.00"
                      className={cn(
                        "h-10 pl-7 rounded-xl font-mono",
                        isDark ? "bg-white/5 border-white/10 text-blue-300 placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-blue-700 placeholder:text-slate-400 focus:bg-white"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "px-6 py-4 border-t flex items-center justify-end gap-3",
            isDark ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-slate-100"
          )}>
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              className={cn(
                "h-9 px-4 rounded-xl font-semibold text-sm",
                isDark ? "text-white/60 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm gap-2 active:scale-[0.98] transition-all"
            >
              {editItem ? (
                <><CheckCheck className="w-4 h-4" /> Save Changes</>
              ) : (
                <><Plus className="w-4 h-4" /> Add Item</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ledger Link Dialog ────────────────────────────── */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent className={cn("max-w-2xl border shadow-lg", isDark ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-teal-500" />
              Link Ledger Entries
              {linkTarget && (
                <span className={cn("font-normal text-sm ml-1", isDark ? "text-white/40" : "text-slate-500")}>&#8212; {linkTarget.title}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {linkTarget && (
            <div className="space-y-4">
              {/* Currently linked */}
              {(linkTarget.linkedLedgerIds?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <p className={cn("text-xs font-semibold", isDark ? "text-white/40" : "text-slate-500")}>Currently Linked</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {linkTarget.linkedLedgerIds!.map((lid) => {
                      const e = ledgerEntries.find((x) => x.id === lid);
                      if (!e) return null;
                      return (
                        <div key={lid} className={cn("flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border", isDark ? "bg-teal-500/10 border-teal-500/20 text-white/70" : "bg-teal-50/50 border-teal-200 text-slate-700")}>
                          <span className="font-medium">
                            {e.voucherNo} &middot; {e.description} &middot; <span className="text-teal-600 dark:text-teal-400 font-semibold font-mono">&#8358;{fmt(e.amount)}</span>
                          </span>
                          <button
                            onClick={() => {
                              toggleLedgerLink(linkTarget, lid);
                              setLinkTarget((prev) =>
                                prev ? { ...prev, linkedLedgerIds: prev.linkedLedgerIds.filter((x) => x !== lid) } : null,
                              );
                            }}
                            className={cn("ml-2 transition-colors", isDark ? "text-white/40 hover:text-red-400" : "text-slate-400 hover:text-red-600")}
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/30" : "text-slate-400")} />
                <input
                  autoFocus
                  className={cn(
                    "w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 border",
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-teal-500/40"
                      : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-teal-500/20"
                  )}
                  placeholder="Search by voucher no, description, category…"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {filteredLedger.length === 0 && (
                  <p className={cn("text-center text-sm py-6", isDark ? "text-white/30" : "text-slate-400")}>No ledger entries found.</p>
                )}
                {filteredLedger.map((entry) => {
                  const isLinked = linkTarget.linkedLedgerIds?.includes(entry.id) ?? false;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        toggleLedgerLink(linkTarget, entry.id);
                        setLinkTarget((prev) => {
                          if (!prev) return null;
                          const linked = prev.linkedLedgerIds ?? [];
                          return {
                            ...prev,
                            linkedLedgerIds: isLinked
                              ? linked.filter((x) => x !== entry.id)
                              : [...linked, entry.id],
                          };
                        });
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors border',
                        isLinked
                          ? (isDark ? 'bg-teal-500/10 border-teal-500/30 text-white/80' : 'bg-teal-50 border-teal-200 text-teal-850')
                          : (isDark ? 'bg-white/[0.03] border-white/5 text-white/60 hover:bg-white/5 hover:border-white/10' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200'),
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className={cn("font-semibold", isDark ? "text-white/80" : "text-slate-700")}>{entry.voucherNo || 'No VCH#'}</span>
                        <span className={cn("mx-2", isDark ? "text-white/30" : "text-slate-300")}>&middot;</span>
                        <span className="truncate">{entry.description}</span>
                        {entry.category && <span className={cn("ml-2", isDark ? "text-white/30" : "text-slate-400")}>({entry.category})</span>}
                        <span className={cn("ml-2", isDark ? "text-white/30" : "text-slate-400")}>{formatDisplayDate(entry.date)}</span>
                      </div>
                      <span className={cn('font-mono font-semibold ml-3 flex-shrink-0 flex items-center gap-1.5', isLinked ? 'text-teal-600 dark:text-teal-400' : (isDark ? 'text-white/40' : 'text-slate-500'))}>
                        &#8358;{fmt(entry.amount)}
                        {isLinked && <CheckCircle2 className="w-3.5 h-3.5 inline" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              {(linkTarget.linkedLedgerIds?.length ?? 0) > 0 && (
                <div className={cn("flex justify-between items-center text-xs pt-2 border-t", isDark ? "border-white/10" : "border-slate-200")}>
                  <span className={isDark ? "text-white/40" : "text-slate-500"}>
                    Total linked: <span className="text-teal-600 dark:text-teal-400 font-mono font-bold">
                      &#8358;{fmt(actualSpend(linkTarget))}
                    </span>
                  </span>
                  <span className={isDark ? "text-white/40" : "text-slate-500"}>
                    Requested: <span className="text-amber-600 dark:text-amber-400 font-mono font-semibold">&#8358;{fmt(linkTarget.requested)}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setLinkTarget(null)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold active:scale-[0.98]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
