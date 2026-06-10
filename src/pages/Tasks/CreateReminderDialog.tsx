import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Calendar, RefreshCw, Users, Link2, ChevronDown, Check } from 'lucide-react';
import { useAppData } from "@/src/contexts/AppDataContext";
import { useWorkspace } from "@/src/hooks/use-workspace";
import { useAuth } from "@/src/hooks/useAuth";
import { toast } from "@/src/components/ui/toast";
import type { ReminderFrequency } from "@/src/types/tasks";

interface CreateReminderDialogProps {
  onClose: () => void;
  initialDateTime?: string; // e.g. "2026-06-09T15:00"
}

const FREQ_LABELS: Record<ReminderFrequency, string> = {
  once: 'Once',
  hourly: 'Hourly',
  every_6_hours: 'Every 6h',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function CreateReminderDialog({ onClose, initialDateTime = "" }: CreateReminderDialogProps) {
  const { user: currentUser } = useAuth();
  const { addReminder } = useAppData();
  const { wsMembers: activeUsers, wsTasks: allMainTasks } = useWorkspace();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [remindAt, setRemindAt] = useState(initialDateTime);
  const [endAt, setEndAt] = useState("");
  const [frequency, setFrequency] = useState<ReminderFrequency>("once");
  const [recipientIds, setRecipientIds] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
  const [sendEmail, setSendEmail] = useState(false);
  const [mainTaskId, setMainTaskId] = useState("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const activeFilteredUsers = useMemo(() => activeUsers.filter(u => u.isActive !== false), [activeUsers]);

  const toggleRecipient = (id: string) => {
    setRecipientIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!remindAt) {
      setFormError("Please set a start date/time.");
      return;
    }
    if (recipientIds.length === 0) {
      setFormError("Select at least one recipient.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        remindAt: new Date(remindAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        frequency,
        recipientIds,
        sendEmail,
        mainTaskId: mainTaskId || null,
        isActive: true,
        createdBy: currentUser?.id || "unknown",
      };

      await addReminder(payload);
      toast.success("Reminder created successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-[#0f111a] border border-[#2a2e3d] rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] text-white"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">New Reminder</h2>
              <p className="text-[11px] text-white/50">Set a timely notification for your team</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Submit weekly report"
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">
              Message (optional)
            </label>
            <textarea
              rows={2}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add details or notes…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all shadow-sm"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-white/50" /> Start <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={remindAt}
                onChange={e => setRemindAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">
                End (optional)
              </label>
              <input
                type="datetime-local"
                value={endAt}
                min={remindAt}
                onChange={e => setEndAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Repeat Frequency */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-2 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-white/50" /> Repeat
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['once', 'hourly', 'every_6_hours', 'daily', 'weekly', 'monthly'] as ReminderFrequency[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    frequency === f
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-white/5 text-white/50 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-white/50" /> Recipients <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRecipientOpen(p => !p)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white hover:bg-white/5 transition-all text-left"
              >
                <span className="text-white/60 text-xs">
                  {recipientIds.length === 0 ? 'Select recipients…' : `${recipientIds.length} selected`}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${recipientOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {recipientOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden absolute z-10 w-full mt-1 rounded-xl border border-white/10 bg-[#141622] shadow-2xl"
                  >
                    <div className="overflow-y-auto max-h-36 p-1 space-y-0.5">
                      {activeFilteredUsers.map(u => {
                        const isSelected = recipientIds.includes(u.id);
                        const initials = u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleRecipient(u.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 rounded-lg transition-colors ${
                              isSelected ? 'bg-indigo-500/10 text-indigo-400' : 'text-white/80'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full ${u.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                              {initials}
                            </div>
                            <span className="flex-1 text-left font-medium text-xs truncate">{u.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {recipientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipientIds.map(id => {
                  const u = activeFilteredUsers.find(x => x.id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[11px] font-medium border border-indigo-500/20"
                    >
                      {u.name.split(' ')[0]}
                      <button type="button" onClick={() => toggleRecipient(id)} className="hover:text-indigo-300">
                        <X className="w-3 h-3 ml-0.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link to Task */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-white/50" /> Link to Task (optional)
            </label>
            <select
              value={mainTaskId}
              onChange={e => setMainTaskId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#141622] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="" className="bg-[#141622]">— None —</option>
              {allMainTasks.map(t => (
                <option key={t.id} value={t.id} className="bg-[#141622]">{t.title}</option>
              ))}
            </select>
          </div>

          {/* Email notifications */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5">
            <div>
              <p className="text-sm font-semibold text-white">Email Notification</p>
              <p className="text-[11px] text-white/50">Also send email when this fires</p>
            </div>
            <button
              type="button"
              onClick={() => setSendEmail(e => !e)}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                sendEmail ? 'bg-indigo-500' : 'bg-white/10'
              }`}
            >
              <motion.div
                layout
                className="w-4 h-4 rounded-full bg-white shadow-md"
                animate={{ x: sendEmail ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-md text-white"
            >
              {isSubmitting ? "Creating..." : "Create Reminder"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
