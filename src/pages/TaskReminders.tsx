import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday, isTomorrow, differenceInHours } from 'date-fns';
import {
  Bell, Plus, Trash2, Edit3, Clock, Mail, Users, X, Check,
  AlertCircle, RefreshCw, ToggleLeft, ToggleRight,
  Calendar, CheckCircle2, Link2, ChevronDown, Eye, BellOff,
  Zap, Search,
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useWorkspace } from '@/src/hooks/use-workspace';
import { useSearchParams } from 'react-router-dom';
import type { Reminder, ReminderFrequency } from '@/src/types/tasks';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const FREQ_LABELS: Record<ReminderFrequency, string> = {
  once: 'Once', hourly: 'Hourly', every_6_hours: 'Every 6h',
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

const FREQ_COLORS: Record<ReminderFrequency, string> = {
  once:         'bg-slate-100 text-slate-600 border-slate-200',
  hourly:       'bg-blue-50 text-blue-600 border-blue-200',
  every_6_hours:'bg-indigo-50 text-indigo-600 border-indigo-200',
  daily:        'bg-violet-50 text-violet-600 border-violet-200',
  weekly:       'bg-purple-50 text-purple-600 border-purple-200',
  monthly:      'bg-pink-50 text-pink-600 border-pink-200',
};

interface ReminderFormData {
  title: string; body: string; remindAt: string; endAt: string;
  frequency: ReminderFrequency; recipientIds: string[];
  sendEmail: boolean; mainTaskId: string;
}
const emptyForm = (): ReminderFormData => ({
  title: '', body: '', remindAt: '', endAt: '', frequency: 'once',
  recipientIds: [], sendEmail: false, mainTaskId: '',
});

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function getRelativeTime(dateStr: string): { label: string; tone: 'ok' | 'soon' | 'overdue' | 'today' } {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return { label: `Today at ${format(d, 'h:mm a')}`, tone: 'today' };
    if (isTomorrow(d)) return { label: `Tomorrow at ${format(d, 'h:mm a')}`, tone: 'soon' };
    if (isPast(d)) return { label: `Overdue · ${format(d, 'MMM d, h:mm a')}`, tone: 'overdue' };
    const hrs = differenceInHours(d, new Date());
    if (hrs < 48) return { label: `In ${hrs}h · ${format(d, 'h:mm a')}`, tone: 'soon' };
    return { label: format(d, 'EEE, MMM d · h:mm a'), tone: 'ok' };
  } catch {
    return { label: 'Unknown date', tone: 'ok' };
  }
}

const toneStyles = {
  ok:      'text-muted-foreground',
  soon:    'text-amber-600 dark:text-amber-400 font-semibold',
  overdue: 'text-red-600 dark:text-red-400 font-bold',
  today:   'text-indigo-600 dark:text-indigo-400 font-semibold',
};
const toneIconStyles = {
  ok:      'text-muted-foreground',
  soon:    'text-amber-500',
  overdue: 'text-red-500',
  today:   'text-indigo-500',
};

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function Reminders() {
  const { user: currentUser } = useAuth();
  const { reminders, addReminder, updateReminder, deleteReminder, toggleReminderActive, users } = useAppData();
  const { wsMembers: activeUsers, wsTasks: mainTasks } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  /* Form state */
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<ReminderFormData>(emptyForm());
  const [formError, setFormError]   = useState('');
  const [recipientOpen, setRecipientOpen] = useState(false);

  /* List / filter state */
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [tab, setTab]               = useState<'all' | 'mine' | 'shared'>('all');
  const [selected, setSelected]     = useState<Reminder | null>(null);

  /* Derived lists */
  const myReminders     = reminders.filter(r => r.createdBy === currentUser?.id);
  const sharedWithMe    = reminders.filter(r =>
    r.recipientIds.includes(currentUser?.id || '') && r.createdBy !== currentUser?.id
  );
  const pool = tab === 'mine' ? myReminders : tab === 'shared' ? sharedWithMe
    : [...myReminders, ...sharedWithMe].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  const filtered = pool
    .filter(r => filterStatus === 'all' ? true : filterStatus === 'active' ? r.isActive : !r.isActive)
    .filter(r => !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

  const activeCount   = pool.filter(r => r.isActive).length;
  const overdueCount  = pool.filter(r => r.isActive && isPast(parseISO(r.remindAt)) && !isToday(parseISO(r.remindAt))).length;

  /* Deep-link handling */
  useEffect(() => {
    const viewId = searchParams.get('view');
    const editid = searchParams.get('edit');
    if (viewId && reminders.length > 0) {
      const r = reminders.find(x => x.id === viewId);
      if (r) setSelected(r);
      const next = new URLSearchParams(searchParams); next.delete('view');
      setSearchParams(next, { replace: true });
    }
    if (editid && reminders.length > 0) {
      const r = reminders.find(x => x.id === editid);
      if (r) openEdit(r);
      const next = new URLSearchParams(searchParams); next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, reminders]);

  /* Form helpers */
  const openCreate = () => { setForm(emptyForm()); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit = (r: Reminder) => {
    setForm({
      title: r.title, body: r.body, remindAt: r.remindAt.slice(0, 16),
      endAt: r.endAt ? r.endAt.slice(0, 16) : '', frequency: r.frequency,
      recipientIds: [...r.recipientIds], sendEmail: r.sendEmail, mainTaskId: r.mainTaskId ?? '',
    });
    setEditingId(r.id);
    setFormError('');
    setShowForm(true);
    setSelected(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.remindAt)     { setFormError('Please set a date/time.'); return; }
    if (form.recipientIds.length === 0) { setFormError('Select at least one recipient.'); return; }
    const payload = {
      title: form.title.trim(), body: form.body.trim(),
      remindAt: new Date(form.remindAt).toISOString(),
      endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
      frequency: form.frequency, recipientIds: form.recipientIds,
      sendEmail: form.sendEmail, mainTaskId: form.mainTaskId || undefined,
    };
    if (editingId) updateReminder(editingId, { ...payload, isActive: true });
    else addReminder({ ...payload, isActive: true, createdBy: currentUser!.id });
    setShowForm(false); setEditingId(null);
  };

  const toggleRecipient = (id: string) =>
    setForm(p => ({ ...p, recipientIds: p.recipientIds.includes(id) ? p.recipientIds.filter(x => x !== id) : [...p.recipientIds, id] }));

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col min-h-0">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-violet-500" /> Reminders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active{overdueCount > 0 && <span className="text-red-500 font-semibold"> · {overdueCount} overdue</span>}
            {' '}· {pool.length} total
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Reminder
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 px-6 pb-3 flex flex-wrap items-center gap-3">
        {/* Tab pills */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/40">
          {([['all','All'], ['mine','Mine'], ['shared','Shared with me']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === k ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {(['all','active','inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-all ${filterStatus === f ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reminders…"
            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-44 transition-all" />
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-4">
              <BellOff className="w-7 h-7 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No reminders found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Try a different search term.' : 'Hit "New Reminder" to create your first one.'}
            </p>
            {!search && (
              <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
                <Plus className="w-4 h-4" /> Create Reminder
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 max-w-4xl">
            {filtered.map(rem => {
              const rel         = getRelativeTime(rem.remindAt);
              const isOwner     = rem.createdBy === currentUser?.id;
              const linkedTask  = rem.mainTaskId ? mainTasks.find(t => t.id === rem.mainTaskId) : null;
              const creatorUser = users.find(u => u.id === rem.createdBy);
              const isSelected  = selected?.id === rem.id;

              return (
                <motion.div key={rem.id} id={`reminder-${rem.id}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={`rounded-2xl border transition-all ${
                    !rem.isActive
                      ? 'bg-muted/20 border-border/40 opacity-60'
                      : rel.tone === 'overdue'
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40'
                        : rel.tone === 'today'
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/30'
                          : 'bg-card border-border hover:border-violet-200/60 hover:shadow-sm'
                  }`}>

                  {/* Card header row */}
                  <div className="flex items-start gap-3 p-4">

                    {/* Status dot */}
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      rel.tone === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' :
                      rem.isActive ? 'bg-violet-100 dark:bg-violet-900/20' : 'bg-muted'
                    }`}>
                      {rel.tone === 'overdue'
                        ? <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                        : rem.isActive
                          ? <Bell className="w-4.5 h-4.5 text-violet-500" />
                          : <BellOff className="w-4.5 h-4.5 text-muted-foreground" />
                      }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{rem.title}</h3>
                          {rem.body && (
                            <p className={`text-xs text-muted-foreground mt-0.5 ${isSelected ? '' : 'line-clamp-1'}`}>{rem.body}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                          <button onClick={() => setSelected(isSelected ? null : rem)}
                            title="View details"
                            className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-violet-100 text-violet-600' : 'text-muted-foreground hover:bg-muted'}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isOwner && (
                            <>
                              <button onClick={() => toggleReminderActive(rem.id)}
                                title={rem.isActive ? 'Pause' : 'Resume'}
                                className={`p-1.5 rounded-lg transition-colors ${rem.isActive ? 'text-violet-500 hover:bg-violet-50' : 'text-muted-foreground hover:bg-muted'}`}>
                                {rem.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => openEdit(rem)} title="Edit"
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteReminder(rem.id)} title="Delete"
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                        {/* Time */}
                        <span className={`flex items-center gap-1 text-xs ${toneStyles[rel.tone]}`}>
                          <Clock className={`w-3 h-3 ${toneIconStyles[rel.tone]}`} />
                          {rel.label}
                        </span>

                        {/* Freq badge */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${FREQ_COLORS[rem.frequency]}`}>
                          <RefreshCw className="w-2.5 h-2.5" />{FREQ_LABELS[rem.frequency]}
                        </span>

                        {/* Email badge */}
                        {rem.sendEmail && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                            <Mail className="w-2.5 h-2.5" /> Email
                          </span>
                        )}

                        {/* Linked task */}
                        {linkedTask && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 max-w-[140px]">
                            <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{linkedTask.title}</span>
                          </span>
                        )}

                        {/* Recipient avatars */}
                        {rem.recipientIds.length > 0 && (
                          <div className="flex items-center -space-x-1 ml-auto">
                            {rem.recipientIds.slice(0, 5).map(id => {
                              const u = users.find(u => u.id === id);
                              if (!u) return null;
                              return (
                                <div key={id} title={u.name}
                                  className={`w-5 h-5 rounded-full border-2 border-card text-[8px] font-bold text-white flex items-center justify-center ${u.avatarColor}`}>
                                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                              );
                            })}
                            {rem.recipientIds.length > 5 && (
                              <div className="w-5 h-5 rounded-full border-2 border-card bg-muted text-[8px] font-bold text-muted-foreground flex items-center justify-center">
                                +{rem.recipientIds.length - 5}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border/50">
                        <div className="p-4 pt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/20">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Created by</p>
                            <p className="text-xs font-medium text-foreground">{creatorUser?.name ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">End At</p>
                            <p className="text-xs font-medium text-foreground">
                              {rem.endAt ? format(parseISO(rem.endAt), 'MMM d, yyyy') : 'No end date'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Status</p>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rem.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'}`}>
                              {rem.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Recipients</p>
                            <p className="text-xs font-medium text-foreground">
                              {rem.recipientIds.map(id => users.find(u => u.id === id)?.name?.split(' ')[0]).filter(Boolean).join(', ') || '—'}
                            </p>
                          </div>
                          {isOwner && (
                            <div className="col-span-2 sm:col-span-4 flex gap-2 pt-1 border-t border-border/40">
                              <button onClick={() => openEdit(rem)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors">
                                <Edit3 className="w-3 h-3" /> Edit Reminder
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Modal header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{editingId ? 'Edit Reminder' : 'New Reminder'}</h3>
                  <p className="text-[11px] text-muted-foreground">Set a timed notification for your team</p>
                </div>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Submit weekly report"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Message (optional)</label>
                  <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    placeholder="Add any details or notes…" rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Start *</label>
                    <input type="datetime-local" value={form.remindAt} onChange={e => setForm(p => ({ ...p, remindAt: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">End (optional)</label>
                    <input type="datetime-local" value={form.endAt} min={form.remindAt}
                      onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Repeat</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['once','hourly','every_6_hours','daily','weekly','monthly'] as ReminderFrequency[]).map(f => (
                      <button key={f} type="button" onClick={() => setForm(p => ({ ...p, frequency: f }))}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.frequency === f ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/20' : 'border-border text-muted-foreground hover:border-violet-300 hover:text-foreground'}`}>
                        {FREQ_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" /> Recipients *</label>
                  <button type="button" onClick={() => setRecipientOpen(p => !p)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm hover:bg-muted/40 transition">
                    <span className="text-muted-foreground text-xs">
                      {form.recipientIds.length === 0 ? 'Select recipients…' : `${form.recipientIds.length} selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${recipientOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {recipientOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-1 rounded-xl border border-border bg-card overflow-y-auto max-h-36">
                          {activeUsers.map(u => {
                            const sel = form.recipientIds.includes(u.id);
                            return (
                              <button key={u.id} type="button" onClick={() => toggleRecipient(u.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${sel ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''}`}>
                                <div className={`w-6 h-6 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <span className="flex-1 text-left font-medium text-foreground text-xs">{u.name}</span>
                                {sel && <Check className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {form.recipientIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.recipientIds.map(id => {
                        const u = activeUsers.find(u => u.id === id);
                        if (!u) return null;
                        return (
                          <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-full text-[11px] font-medium border border-violet-200 dark:border-violet-800">
                            {u.name.split(' ')[0]}
                            <button type="button" onClick={() => toggleRecipient(id)} className="hover:text-violet-500"><X className="w-3 h-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Link task */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1"><Link2 className="w-3 h-3" /> Link to Task (optional)</label>
                  <select value={form.mainTaskId} onChange={e => setForm(p => ({ ...p, mainTaskId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">— None —</option>
                    {mainTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>

                {/* Email toggle */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/40 border border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Email Notification</p>
                    <p className="text-[11px] text-muted-foreground">Also send email when this fires</p>
                  </div>
                  <button type="button" onClick={() => setForm(p => ({ ...p, sendEmail: !p.sendEmail }))} className="flex-shrink-0">
                    {form.sendEmail ? <ToggleRight className="w-7 h-7 text-violet-600" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                  </button>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1 pb-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
                    {editingId ? <><CheckCircle2 className="w-4 h-4" /> Save Changes</> : <><Plus className="w-4 h-4" /> Create</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
