import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  Bell, Plus, Trash2, Edit3, Clock, Mail, Users, ToggleLeft, ToggleRight,
  RefreshCw, X, Check, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useWorkspace } from '@/hooks/use-workspace';
import type { Reminder, ReminderFrequency } from '@/types/tasks';

const FREQ_LABELS: Record<ReminderFrequency, string> = {
  once: 'Once', hourly: 'Hourly', every_6_hours: 'Every 6h',
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
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

export default function Reminders() {
  const { currentUser } = useAuth();
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
  const sharedWithMe = reminders.filter(r => r.recipientIds.includes(currentUser?.id || '') && r.createdBy !== currentUser?.id).filter(r => {
    if (r.mainTaskId) return mainTasks.some(m => m.id === r.mainTaskId);
    return true;
  });
  const allRemindersForMe = [...myReminders, ...sharedWithMe].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  // Tab filter
  const tabFiltered = tab === 'mine' ? myReminders : tab === 'shared' ? sharedWithMe : allRemindersForMe;

  const filteredReminders = tabFiltered.filter(r => {
    if (filter === 'active') return r.isActive;
    if (filter === 'inactive') return !r.isActive;
    return true;
  }).sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card/50 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-semibold text-foreground">Reminders</h1>
            <p className="text-xs text-muted-foreground">{filteredReminders.length} reminder{filteredReminders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status filter */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 text-sm">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {f}
              </button>
            ))}
          </div>

          <button onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm ml-auto sm:ml-0">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-border bg-card/30 flex-shrink-0 overflow-x-auto">
        {([
          { key: 'all' as const, label: 'All Reminders', count: allRemindersForMe.length },
          { key: 'mine' as const, label: 'Created by Me', count: myReminders.length },
          { key: 'shared' as const, label: 'Shared with Me', count: sharedWithMe.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
            {t.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Reminder List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredReminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-base font-semibold text-foreground">No reminders</p>
            <p className="text-sm text-muted-foreground mt-1">Create a reminder to get started</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {filteredReminders.map(rem => {
              const remDate = parseISO(rem.remindAt);
              const isPastDue = isPast(remDate) && !isToday(remDate);
              const creator = users.find(u => u.id === rem.createdBy);
              const linkedTask = rem.mainTaskId ? mainTasks.find(t => t.id === rem.mainTaskId) : null;

              return (
                <motion.div
                  key={rem.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-4 transition-all ${!rem.isActive ? 'bg-muted/30 border-border opacity-60' :
                    isPastDue ? 'bg-destructive/5 border-destructive/20' :
                      'bg-card border-border hover:shadow-sm'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPastDue ? 'bg-destructive/10' : 'bg-primary/10'
                      }`}>
                      {isPastDue ? <AlertCircle className="w-5 h-5 text-destructive" /> : <Bell className="w-5 h-5 text-primary" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{rem.title}</h3>
                          {rem.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rem.body}</p>}
                        </div>
                        {/* Actions */}
                        {rem.createdBy === currentUser?.id && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => toggleReminderActive(rem.id)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={rem.isActive ? 'Pause' : 'Activate'}>
                              {rem.isActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            <button onClick={() => openEditForm(rem)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                              <Edit3 className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteReminder(rem.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className={`flex items-center gap-1 font-medium ${isPastDue ? 'text-destructive' : ''}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {isPastDue && '⚠ Overdue · '}
                          {isToday(remDate) ? `Today · ${format(remDate, 'h:mm a')}` : format(remDate, 'EEE, MMM d · h:mm a')}
                        </span>
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {FREQ_LABELS[rem.frequency]}
                        </span>
                        {rem.sendEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                        )}
                        {linkedTask && (
                          <span className="flex items-center gap-1 text-primary">
                            📌 {linkedTask.title}
                          </span>
                        )}
                      </div>

                      {/* Recipients */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rem.recipientIds.slice(0, 5).map(id => {
                          const u = users.find(u => u.id === id);
                          if (!u) return null;
                          return (
                            <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-[11px] font-medium text-muted-foreground">
                              <div className={`w-4 h-4 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[7px] font-bold`}>
                                {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              {u.name.split(' ')[0]}
                            </span>
                          );
                        })}
                        {rem.recipientIds.length > 5 && (
                          <span className="px-2 py-0.5 bg-muted rounded-full text-[11px] font-medium text-muted-foreground">
                            +{rem.recipientIds.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }} className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Bell className="w-4 h-4 text-primary" /></div>
                  <h3 className="text-base font-semibold text-foreground">{editingId ? 'Edit Reminder' : 'New Reminder'}</h3>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Submit weekly report"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Message</label>
                  <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Optional details..." rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Start At *</label>
                    <input type="datetime-local" value={form.remindAt} onChange={e => setForm(p => ({ ...p, remindAt: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">End At</label>
                    <input type="datetime-local" value={form.endAt} onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))} min={form.remindAt}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Frequency</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['once', 'hourly', 'every_6_hours', 'daily', 'weekly', 'monthly'] as ReminderFrequency[]).map(freq => (
                      <button key={freq} type="button" onClick={() => setForm(p => ({ ...p, frequency: freq }))}
                        className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.frequency === freq ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'}`}>
                        {FREQ_LABELS[freq]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Recipients *</label>
                  <button type="button" onClick={() => setShowRecipientPicker(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-muted text-sm hover:bg-muted/70 transition-colors">
                    <span className="text-muted-foreground">{form.recipientIds.length === 0 ? 'Select recipients...' : `${form.recipientIds.length} selected`}</span>
                    <Users className="w-4 h-4 text-muted-foreground" />
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
                                <div className="flex-1 text-left"><p className="font-medium text-foreground">{u.name}</p></div>
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
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Link to Task</label>
                  <select value={form.mainTaskId} onChange={e => setForm(p => ({ ...p, mainTaskId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">— None —</option>
                    {mainTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Notification</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Also send email when reminder fires</p>
                  </div>
                  <button type="button" onClick={() => setForm(p => ({ ...p, sendEmail: !p.sendEmail }))} className="flex-shrink-0">
                    {form.sendEmail ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                  </button>
                </div>
                {formError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">{editingId ? 'Save' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
