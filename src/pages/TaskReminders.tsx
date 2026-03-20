import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  Bell, Plus, Trash2, Edit3, Clock, Mail, Users, X, Check,
  AlertCircle, RefreshCw, ToggleLeft, ToggleRight,
  Calendar, Zap, CheckCircle2, Link2, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useWorkspace } from '@/src/hooks/use-workspace';
import type { Reminder, ReminderFrequency } from '@/src/types/tasks';

const FREQ_LABELS: Record<ReminderFrequency, string> = {
  once: 'Once', hourly: 'Hourly', every_6_hours: 'Every 6h',
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

const FREQ_COLORS: Record<ReminderFrequency, string> = {
  once: 'bg-slate-100 text-slate-600 border-slate-200',
  hourly: 'bg-blue-50 text-blue-600 border-blue-200',
  every_6_hours: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  daily: 'bg-violet-50 text-violet-600 border-violet-200',
  weekly: 'bg-purple-50 text-purple-600 border-purple-200',
  monthly: 'bg-pink-50 text-pink-600 border-pink-200',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

interface ReminderFormData {
  title: string; body: string; remindAt: string; endAt: string;
  frequency: ReminderFrequency; recipientIds: string[];
  sendEmail: boolean; mainTaskId: string;
}

const emptyForm = (): ReminderFormData => ({
  title: '', body: '', remindAt: '', endAt: '', frequency: 'once',
  recipientIds: [], sendEmail: false, mainTaskId: '',
});

export default function Reminders() {
  const { user: currentUser } = useAuth();
  const { reminders, addReminder, updateReminder, deleteReminder, toggleReminderActive, users } = useAppData();
  const { wsMembers: activeUsers, wsTasks: mainTasks } = useWorkspace();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReminderFormData>(emptyForm());
  const [formError, setFormError] = useState('');
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tab, setTab] = useState<'all' | 'mine' | 'shared'>('all');

  const myReminders = reminders.filter(r => r.createdBy === currentUser?.id).filter(r => {
    if (r.mainTaskId) return mainTasks.some(m => m.id === r.mainTaskId);
    return true;
  });
  const sharedWithMe = reminders.filter(r =>
    r.recipientIds.includes(currentUser?.id || '') && r.createdBy !== currentUser?.id
  ).filter(r => {
    if (r.mainTaskId) return mainTasks.some(m => m.id === r.mainTaskId);
    return true;
  });
  const allRemindersForMe = [...myReminders, ...sharedWithMe].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  const tabFiltered = tab === 'mine' ? myReminders : tab === 'shared' ? sharedWithMe : allRemindersForMe;
  const filteredReminders = tabFiltered.filter(r => {
    if (filter === 'active') return r.isActive;
    if (filter === 'inactive') return !r.isActive;
    return true;
  }).sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

  const activeCount = allRemindersForMe.filter(r => r.isActive).length;

  const openCreateForm = () => { setForm(emptyForm()); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEditForm = (rem: Reminder) => {
    setForm({
      title: rem.title, body: rem.body, remindAt: rem.remindAt.slice(0, 16),
      endAt: rem.endAt ? rem.endAt.slice(0, 16) : '', frequency: rem.frequency,
      recipientIds: [...rem.recipientIds], sendEmail: rem.sendEmail, mainTaskId: rem.mainTaskId ?? '',
    });
    setEditingId(rem.id); setFormError(''); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.remindAt) { setFormError('Please select a date/time.'); return; }
    if (form.recipientIds.length === 0) { setFormError('Select at least one recipient.'); return; }
    const remindAtISO = new Date(form.remindAt).toISOString();
    const endAtISO = form.endAt ? new Date(form.endAt).toISOString() : undefined;
    if (editingId) {
      updateReminder(editingId, { title: form.title.trim(), body: form.body.trim(), remindAt: remindAtISO, endAt: endAtISO, frequency: form.frequency, recipientIds: form.recipientIds, sendEmail: form.sendEmail, mainTaskId: form.mainTaskId || undefined, isActive: true });
    } else {
      addReminder({ title: form.title.trim(), body: form.body.trim(), remindAt: remindAtISO, endAt: endAtISO, frequency: form.frequency, recipientIds: form.recipientIds, sendEmail: form.sendEmail, isActive: true, createdBy: currentUser!.id, mainTaskId: form.mainTaskId || undefined });
    }
    setShowForm(false); setEditingId(null);
  };

  const toggleRecipient = (userId: string) => {
    setForm(prev => ({ ...prev, recipientIds: prev.recipientIds.includes(userId) ? prev.recipientIds.filter(id => id !== userId) : [...prev.recipientIds, userId] }));
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return 'Unknown date';
      if (isToday(date)) return `Today · ${format(date, 'h:mm a')}`;
      return format(date, 'EEE, MMM d · h:mm a');
    } catch { return 'Unknown date'; }
  };

  return (
    <div className="h-full flex flex-col min-h-0">

      {/* ── Hero Header ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 py-5 text-white shadow-lg">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-20 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          </div>
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center border border-white/25">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Reminders</h1>
              </div>
              <p className="text-white/70 text-sm">
                <span className="font-semibold text-white">{activeCount}</span> active ·{' '}
                <span className="text-white/60">{allRemindersForMe.length} total</span>
              </p>
            </div>
            <button onClick={openCreateForm}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition-all backdrop-blur-sm">
              <Plus className="w-4 h-4" /> New Reminder
            </button>
          </div>
          {/* inline mini-stats */}
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'All', value: allRemindersForMe.length },
              { label: 'Active', value: activeCount },
              { label: 'Shared', value: sharedWithMe.length },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-center">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-white/60 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab + Filter Bar ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-3 space-y-2">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 border border-border/40">
          {([
            { key: 'all' as const, label: 'All', count: allRemindersForMe.length },
            { key: 'mine' as const, label: 'Created by Me', count: myReminders.length },
            { key: 'shared' as const, label: 'Shared with Me', count: sharedWithMe.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filter === f ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{filteredReminders.length} reminder{filteredReminders.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Reminder List ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 min-h-0">
        {filteredReminders.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-5 shadow-sm">
              <Bell className="w-9 h-9 text-violet-500 dark:text-violet-400" />
            </div>
            <p className="text-base font-semibold text-foreground">No reminders {filter !== 'all' ? `(${filter})` : ''}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {filter === 'all' ? 'Create your first reminder to stay on top of your tasks.' : `No ${filter} reminders found.`}
            </p>
            {filter === 'all' && (
              <button onClick={openCreateForm} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> Create a reminder
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3 max-w-3xl mx-auto">
            {filteredReminders.map(rem => {
              let remDate: Date;
              let isPastDue = false;
              try {
                remDate = parseISO(rem.remindAt);
                isPastDue = isPast(remDate) && !isToday(remDate);
              } catch {
                remDate = new Date();
              }
              const creator = users.find(u => u.id === rem.createdBy);
              const linkedTask = rem.mainTaskId ? mainTasks.find(t => t.id === rem.mainTaskId) : null;
              const isOwner = rem.createdBy === currentUser?.id;

              return (
                <motion.div key={rem.id} variants={item}
                  className={`rounded-2xl border overflow-hidden transition-all ${!rem.isActive
                    ? 'bg-muted/20 border-border opacity-60'
                    : isPastDue
                      ? 'bg-red-50/30 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40'
                      : 'bg-card border-border hover:shadow-md hover:border-primary/20'
                    }`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPastDue ? 'bg-red-100 dark:bg-red-900/30' : rem.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                        {isPastDue
                          ? <AlertCircle className="w-5 h-5 text-red-500" />
                          : rem.isActive
                            ? <Bell className="w-5 h-5 text-primary" />
                            : <Bell className="w-5 h-5 text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">{rem.title}</h3>
                            {rem.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rem.body}</p>}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {isOwner && (
                              <>
                                <button onClick={() => toggleReminderActive(rem.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${rem.isActive ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                                  title={rem.isActive ? 'Deactivate' : 'Activate'}>
                                  {rem.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                </button>
                                <button onClick={() => openEditForm(rem)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteReminder(rem.id)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Meta bar */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
                          {/* Time */}
                          <div className={`flex items-center gap-1 text-xs font-medium ${isPastDue ? 'text-red-500' : 'text-muted-foreground'}`}>
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                            {isPastDue && '⚠ Overdue · '}
                            {safeFormatDate(rem.remindAt)}
                          </div>
                          {/* Frequency */}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${FREQ_COLORS[rem.frequency]}`}>
                            <RefreshCw className="w-2.5 h-2.5" />{FREQ_LABELS[rem.frequency]}
                          </span>
                          {/* Email */}
                          {rem.sendEmail && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                              <Mail className="w-2.5 h-2.5" /> Email
                            </span>
                          )}
                          {/* Linked task */}
                          {linkedTask && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 truncate max-w-[160px]">
                              <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{linkedTask.title}</span>
                            </span>
                          )}
                        </div>

                        {/* Recipients */}
                        {rem.recipientIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {rem.recipientIds.slice(0, 5).map(id => {
                              const u = users.find(u => u.id === id);
                              if (!u) return null;
                              return (
                                <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground">
                                  <div className={`w-3.5 h-3.5 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[7px] font-bold`}>
                                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  {u.name.split(' ')[0]}
                                </span>
                              );
                            })}
                            {rem.recipientIds.length > 5 && (
                              <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground">
                                +{rem.recipientIds.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Modal header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{editingId ? 'Edit Reminder' : 'New Reminder'}</h3>
                  <p className="text-[11px] text-muted-foreground">Set a timed notification for your team</p>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Submit weekly report"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm" />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Message</label>
                  <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    placeholder="Optional details or instructions..." rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none shadow-sm" />
                </div>

                {/* Date/time row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1"><Calendar className="w-3 h-3" /> Start At *</label>
                    <input type="datetime-local" value={form.remindAt} onChange={e => setForm(p => ({ ...p, remindAt: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">End At</label>
                    <input type="datetime-local" value={form.endAt} onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))} min={form.remindAt}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm" />
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Frequency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['once', 'hourly', 'every_6_hours', 'daily', 'weekly', 'monthly'] as ReminderFrequency[]).map(freq => (
                      <button key={freq} type="button" onClick={() => setForm(p => ({ ...p, frequency: freq }))}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.frequency === freq ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}>
                        {FREQ_LABELS[freq]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> Recipients *</label>
                  <button type="button" onClick={() => setShowRecipientPicker(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-background text-sm hover:bg-muted/50 transition-colors shadow-sm">
                    <span className="text-muted-foreground">
                      {form.recipientIds.length === 0 ? 'Select recipients...' : `${form.recipientIds.length} selected`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRecipientPicker ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showRecipientPicker && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden max-h-40 overflow-y-auto">
                          {activeUsers.map(u => {
                            const selected = form.recipientIds.includes(u.id);
                            return (
                              <button key={u.id} type="button" onClick={() => toggleRecipient(u.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${selected ? 'bg-primary/5' : ''}`}>
                                <div className={`w-6 h-6 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <span className="flex-1 text-left font-medium text-foreground">{u.name}</span>
                                {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
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
                          <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-medium">
                            {u.name.split(' ')[0]}
                            <button type="button" onClick={() => toggleRecipient(id)} className="hover:text-primary/60"><X className="w-3 h-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Link to task */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1"><Link2 className="w-3 h-3" /> Link to Task</label>
                  <select value={form.mainTaskId} onChange={e => setForm(p => ({ ...p, mainTaskId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 cursor-pointer shadow-sm">
                    <option value="">— None —</option>
                    {mainTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>

                {/* Email toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Email Notification</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Also send email when reminder fires</p>
                  </div>
                  <button type="button" onClick={() => setForm(p => ({ ...p, sendEmail: !p.sendEmail }))} className="flex-shrink-0">
                    {form.sendEmail ? <ToggleRight className="w-7 h-7 text-primary" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                  </button>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 pb-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    {editingId ? <><CheckCircle2 className="w-4 h-4" /> Save Changes</> : <><Plus className="w-4 h-4" /> Create Reminder</>}
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
