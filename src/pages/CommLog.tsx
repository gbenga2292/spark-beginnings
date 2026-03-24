import { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import type { CommLog } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import {
  Phone, Mail, MessageSquare, Users, MessageCircle, Car,
  ArrowDownLeft, ArrowUpRight, Plus, Search, Filter,
  Trash2, Pencil, X, Save, ChevronDown, ChevronUp,
  Bell, BellOff, CheckCircle2, Circle, MapPin, Building2,
  UserCheck, MoreVertical, CalendarDays, AlertCircle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const CHANNELS = ['Call', 'Email', 'WhatsApp', 'Meeting', 'SMS', 'Visit', 'Other'] as const;
const CONTACT_TYPES = ['Client', 'Site', 'Both', 'Potential Client'] as const;

const channelIcon = (ch: string) => {
  if (ch === 'Call') return <Phone className="w-4 h-4" />;
  if (ch === 'Email') return <Mail className="w-4 h-4" />;
  if (ch === 'WhatsApp') return <MessageCircle className="w-4 h-4" />;
  if (ch === 'Meeting') return <Users className="w-4 h-4" />;
  if (ch === 'SMS') return <MessageSquare className="w-4 h-4" />;
  if (ch === 'Visit') return <Car className="w-4 h-4" />;
  return <MessageSquare className="w-4 h-4" />;
};

const channelColor = (ch: string) => {
  if (ch === 'Call') return 'bg-blue-100 text-blue-700';
  if (ch === 'Email') return 'bg-purple-100 text-purple-700';
  if (ch === 'WhatsApp') return 'bg-emerald-100 text-emerald-700';
  if (ch === 'Meeting') return 'bg-amber-100 text-amber-700';
  if (ch === 'SMS') return 'bg-pink-100 text-pink-700';
  if (ch === 'Visit') return 'bg-cyan-100 text-cyan-700';
  return 'bg-slate-100 text-slate-700';
};

const contactTypeColor = (ct: string) => {
  if (ct === 'Client') return 'bg-indigo-100 text-indigo-700';
  if (ct === 'Site') return 'bg-green-100 text-green-700';
  if (ct === 'Both') return 'bg-violet-100 text-violet-700';
  if (ct === 'Potential Client') return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-600';
};

const contactTypeIcon = (ct: string) => {
  if (ct === 'Client') return <Building2 className="w-3 h-3" />;
  if (ct === 'Site') return <MapPin className="w-3 h-3" />;
  if (ct === 'Both') return <MapPin className="w-3 h-3" />;
  if (ct === 'Potential Client') return <UserCheck className="w-3 h-3" />;
  return null;
};

// ────────────────────────────────────────────────────────────
// Empty form factory
// ────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

function emptyForm() {
  return {
    date: today(),
    time: '',
    direction: 'Incoming' as 'Incoming' | 'Outgoing',
    channel: 'Call' as typeof CHANNELS[number],
    contactType: 'Client' as typeof CONTACT_TYPES[number],
    client: '',
    siteId: '',
    siteName: '',
    contactPerson: '',
    subject: '',
    notes: '',
    outcome: '',
    followUpDate: '',
    followUpDone: false,
  };
}

// ────────────────────────────────────────────────────────────
// LogForm component
// ────────────────────────────────────────────────────────────
interface LogFormProps {
  form: ReturnType<typeof emptyForm>;
  onChange: (updates: Partial<ReturnType<typeof emptyForm>>) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit?: boolean;
  isDark: boolean;
}

function LogForm({ form, onChange, onSave, onCancel, isEdit, isDark }: LogFormProps) {
  const sites = useAppStore(s => s.sites);
  const clients = useAppStore(s => s.clients);

  const inputCls = cn(
    'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );

  const selectCls = cn(inputCls, 'cursor-pointer');
  const labelCls = cn('text-xs font-semibold mb-1', isDark ? 'text-slate-400' : 'text-slate-500');

  const showClient = form.contactType === 'Client' || form.contactType === 'Both';
  const showSite = form.contactType === 'Site' || form.contactType === 'Both';
  const isPotential = form.contactType === 'Potential Client';

  return (
    <div className={cn('rounded-xl border p-5 shadow-lg space-y-4', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
      {/* Row 1: date, time, direction, channel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className={labelCls}>Date *</div>
          <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <div className={labelCls}>Time</div>
          <input type="time" value={form.time} onChange={e => onChange({ time: e.target.value })} className={inputCls} />
        </div>
        <div>
          <div className={labelCls}>Direction *</div>
          <select value={form.direction} onChange={e => onChange({ direction: e.target.value as any })} className={selectCls}>
            <option value="Incoming">📥 Incoming</option>
            <option value="Outgoing">📤 Outgoing</option>
          </select>
        </div>
        <div>
          <div className={labelCls}>Channel *</div>
          <select value={form.channel} onChange={e => onChange({ channel: e.target.value as any })} className={selectCls}>
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: contact type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className={labelCls}>Linked To *</div>
          <select value={form.contactType} onChange={e => onChange({ contactType: e.target.value as any, client: '', siteId: '', siteName: '' })} className={selectCls}>
            {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {(showClient || isPotential) && (
          <div className={isPotential ? 'md:col-span-3' : ''}>
            <div className={labelCls}>{isPotential ? 'Potential Client Name *' : 'Client'}</div>
            {isPotential ? (
              <input
                type="text"
                placeholder="Enter prospect / company name"
                value={form.client}
                onChange={e => onChange({ client: e.target.value })}
                className={inputCls}
              />
            ) : (
              <select value={form.client} onChange={e => onChange({ client: e.target.value })} className={selectCls}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        )}

        {showSite && (
          <div>
            <div className={labelCls}>Site</div>
            <select
              value={form.siteId}
              onChange={e => {
                const site = sites.find(s => s.id === e.target.value);
                onChange({ siteId: e.target.value, siteName: site?.name || '', client: form.client || site?.client || '' });
              }}
              className={selectCls}
            >
              <option value="">Select Site</option>
              {sites.filter(s => !form.client || s.client === form.client).map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.client}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Row 3: contact person, subject */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className={labelCls}>Contact Person</div>
          <input type="text" placeholder="e.g. Mr. Adeyemi, Site Manager" value={form.contactPerson} onChange={e => onChange({ contactPerson: e.target.value })} className={inputCls} />
        </div>
        <div>
          <div className={labelCls}>Subject</div>
          <input type="text" placeholder="Brief topic of communication" value={form.subject} onChange={e => onChange({ subject: e.target.value })} className={inputCls} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className={labelCls}>Notes / Details *</div>
        <textarea
          rows={3}
          placeholder="Describe the conversation, what was discussed, any decisions made..."
          value={form.notes}
          onChange={e => onChange({ notes: e.target.value })}
          className={cn(inputCls, 'h-auto resize-none')}
        />
      </div>

      {/* Outcome */}
      <div>
        <div className={labelCls}>Outcome / Next Steps</div>
        <input type="text" placeholder="e.g. Client will revert by Friday, Proposal to be sent, Awaiting approval..." value={form.outcome} onChange={e => onChange({ outcome: e.target.value })} className={inputCls} />
      </div>

      {/* Follow-up */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className={labelCls}>Follow-up Date</div>
          <input type="date" value={form.followUpDate} onChange={e => onChange({ followUpDate: e.target.value })} className={cn(inputCls, 'w-44')} />
        </div>
        {form.followUpDate && (
          <div className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              id="follow-up-done"
              checked={form.followUpDone}
              onChange={e => onChange({ followUpDone: e.target.checked })}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="follow-up-done" className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
              Follow-up done
            </label>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Save className="w-4 h-4" /> {isEdit ? 'Update Log' : 'Save Log'}
        </Button>
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="w-4 h-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// LogCard component
// ────────────────────────────────────────────────────────────
interface LogCardProps {
  log: CommLog;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFollowUp: () => void;
  isDark: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

function LogCard({ log, onEdit, onDelete, onToggleFollowUp, isDark, expanded, onToggleExpand }: LogCardProps) {
  const isOverdue = log.followUpDate && !log.followUpDone && isBefore(parseISO(log.followUpDate), startOfDay(new Date()));

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-200',
      isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
      'hover:shadow-md'
    )}>
      {/* Header strip: direction color */}
      <div className={cn('h-1', log.direction === 'Incoming' ? 'bg-emerald-500' : 'bg-blue-500')} />

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Direction + channel icon bubble */}
            <div className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              log.direction === 'Incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            )}>
              {log.direction === 'Incoming'
                ? <ArrowDownLeft className="w-5 h-5" />
                : <ArrowUpRight className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              {/* Date / time / subject */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn('text-sm font-bold', isDark ? 'text-slate-100' : 'text-slate-900')}>
                  {format(parseISO(log.date), 'dd MMM yyyy')}
                  {log.time && <span className={cn('ml-1 text-xs font-normal', isDark ? 'text-slate-400' : 'text-slate-500')}> at {log.time}</span>}
                </span>
                {/* Badges */}
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', channelColor(log.channel))}>
                  {channelIcon(log.channel)} {log.channel}
                </span>
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', contactTypeColor(log.contactType))}>
                  {contactTypeIcon(log.contactType)} {log.contactType}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', log.direction === 'Incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                  {log.direction}
                </span>
              </div>

              {/* Who + subject */}
              <div className={cn('text-sm', isDark ? 'text-slate-200' : 'text-slate-800')}>
                {log.subject && <span className="font-semibold">{log.subject}</span>}
                {log.client && (
                  <span className={cn('ml-2 text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {log.contactType === 'Potential Client' ? '🔮 Prospect: ' : '🏢 '}{log.client}
                    {log.siteName && ` · 📍 ${log.siteName}`}
                  </span>
                )}
              </div>
              {log.contactPerson && (
                <div className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
                  👤 {log.contactPerson}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {log.followUpDate && (
              <button
                onClick={onToggleFollowUp}
                title={log.followUpDone ? 'Follow-up done' : isOverdue ? 'OVERDUE follow-up!' : 'Mark follow-up done'}
                className={cn('p-1.5 rounded-lg transition-colors', log.followUpDone
                  ? 'text-emerald-600 hover:bg-emerald-50'
                  : isOverdue ? 'text-red-600 hover:bg-red-50 animate-pulse' : 'text-amber-500 hover:bg-amber-50'
                )}
              >
                {log.followUpDone ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>
            )}
            <button onClick={onEdit} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600')}>
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600')}>
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onToggleExpand} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Notes preview */}
        {!expanded && log.notes && (
          <p onClick={onToggleExpand} className={cn('mt-2 text-sm line-clamp-2 cursor-pointer', isDark ? 'text-slate-400' : 'text-slate-600')}>
            {log.notes}
          </p>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className={cn('mt-3 space-y-2 pt-3 border-t', isDark ? 'border-slate-700' : 'border-slate-100')}>
            {log.notes && (
              <div>
                <div className={cn('text-xs font-semibold mb-1', isDark ? 'text-slate-500' : 'text-slate-400')}>NOTES</div>
                <p className={cn('text-sm whitespace-pre-wrap', isDark ? 'text-slate-300' : 'text-slate-700')}>{log.notes}</p>
              </div>
            )}
            {log.outcome && (
              <div>
                <div className={cn('text-xs font-semibold mb-1', isDark ? 'text-slate-500' : 'text-slate-400')}>OUTCOME / NEXT STEPS</div>
                <p className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>{log.outcome}</p>
              </div>
            )}
            {log.followUpDate && (
              <div className={cn(
                'inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-medium',
                log.followUpDone ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              )}>
                {log.followUpDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                Follow-up: {format(parseISO(log.followUpDate), 'dd MMM yyyy')}
                {log.followUpDone && ' ✓ Done'}
                {!log.followUpDone && isOverdue && ' — OVERDUE'}
              </div>
            )}
            <div className={cn('text-xs', isDark ? 'text-slate-600' : 'text-slate-400')}>
              Logged by {log.loggedBy}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────
export function CommLog() {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const sites = useAppStore(s => s.sites);
  const clients = useAppStore(s => s.clients);
  const commLogs = useAppStore(s => s.commLogs);
  const addCommLog = useAppStore(s => s.addCommLog);
  const updateCommLog = useAppStore(s => s.updateCommLog);
  const deleteCommLog = useAppStore(s => s.deleteCommLog);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDirection, setFilterDirection] = useState('All');
  const [filterChannel, setFilterChannel] = useState('All');
  const [filterContactType, setFilterContactType] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [filterFollowUp, setFilterFollowUp] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selectCls = cn(
    'h-9 px-3 text-sm rounded-md border shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  );

  // Derived stats
  const stats = useMemo(() => {
    const total = commLogs.length;
    const incoming = commLogs.filter(l => l.direction === 'Incoming').length;
    const outgoing = commLogs.filter(l => l.direction === 'Outgoing').length;
    const pendingFollowUp = commLogs.filter(l => l.followUpDate && !l.followUpDone).length;
    const overdueFollowUp = commLogs.filter(l => l.followUpDate && !l.followUpDone && isBefore(parseISO(l.followUpDate), startOfDay(new Date()))).length;
    const potentialClients = new Set(commLogs.filter(l => l.contactType === 'Potential Client').map(l => l.client)).size;
    return { total, incoming, outgoing, pendingFollowUp, overdueFollowUp, potentialClients };
  }, [commLogs]);

  // Filtered list
  const filtered = useMemo(() => {
    return commLogs
      .filter(l => {
        if (filterDirection !== 'All' && l.direction !== filterDirection) return false;
        if (filterChannel !== 'All' && l.channel !== filterChannel) return false;
        if (filterContactType !== 'All' && l.contactType !== filterContactType) return false;
        if (filterClient !== 'All' && l.client !== filterClient) return false;
        if (filterFollowUp === 'Pending' && !(l.followUpDate && !l.followUpDone)) return false;
        if (filterFollowUp === 'Overdue' && !(l.followUpDate && !l.followUpDone && isBefore(parseISO(l.followUpDate), startOfDay(new Date())))) return false;
        if (filterFollowUp === 'Done' && !l.followUpDone) return false;
        if (dateFrom && isBefore(parseISO(l.date), parseISO(dateFrom))) return false;
        if (dateTo && isAfter(parseISO(l.date), parseISO(dateTo))) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          return l.notes.toLowerCase().includes(q)
            || (l.subject || '').toLowerCase().includes(q)
            || (l.client || '').toLowerCase().includes(q)
            || (l.siteName || '').toLowerCase().includes(q)
            || (l.contactPerson || '').toLowerCase().includes(q)
            || (l.outcome || '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.time || '').localeCompare(a.time || '');
      });
  }, [commLogs, filterDirection, filterChannel, filterContactType, filterClient, filterFollowUp, searchTerm, dateFrom, dateTo]);

  // Unique clients in logs (including potential)
  const allLogClients = useMemo(() => {
    return [...new Set(commLogs.map(l => l.client).filter(Boolean))].sort();
  }, [commLogs]);

  const handleSave = () => {
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.notes.trim()) { toast.error('Notes are required'); return; }
    if (form.contactType === 'Potential Client' && !form.client.trim()) {
      toast.error('Please enter the potential client name'); return;
    }

    const loggedBy = currentUser?.name || 'Admin';

    if (editingId) {
      updateCommLog(editingId, {
        date: form.date,
        time: form.time || undefined,
        direction: form.direction,
        channel: form.channel,
        contactType: form.contactType,
        client: form.client || undefined,
        siteId: form.siteId || undefined,
        siteName: form.siteName || undefined,
        contactPerson: form.contactPerson || undefined,
        subject: form.subject || undefined,
        notes: form.notes,
        outcome: form.outcome || undefined,
        followUpDate: form.followUpDate || undefined,
        followUpDone: form.followUpDone,
      });
      toast.success('Log updated');
      setEditingId(null);
    } else {
      addCommLog({
        id: crypto.randomUUID(),
        date: form.date,
        time: form.time || undefined,
        direction: form.direction,
        channel: form.channel,
        contactType: form.contactType,
        client: form.client || undefined,
        siteId: form.siteId || undefined,
        siteName: form.siteName || undefined,
        contactPerson: form.contactPerson || undefined,
        subject: form.subject || undefined,
        notes: form.notes,
        outcome: form.outcome || undefined,
        followUpDate: form.followUpDate || undefined,
        followUpDone: false,
        loggedBy,
        createdAt: new Date().toISOString(),
      });
      toast.success('Communication logged');
    }

    setForm(emptyForm());
    setShowForm(false);
  };

  const handleEdit = (log: CommLog) => {
    setForm({
      date: log.date,
      time: log.time || '',
      direction: log.direction,
      channel: log.channel,
      contactType: log.contactType,
      client: log.client || '',
      siteId: log.siteId || '',
      siteName: log.siteName || '',
      contactPerson: log.contactPerson || '',
      subject: log.subject || '',
      notes: log.notes,
      outcome: log.outcome || '',
      followUpDate: log.followUpDate || '',
      followUpDone: log.followUpDone,
    });
    setEditingId(log.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this communication log?', { variant: 'danger', confirmLabel: 'Delete' });
    if (ok) { deleteCommLog(id); toast.success('Log deleted'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const panelBg = isDark ? 'bg-slate-950' : 'bg-slate-50';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className={cn('flex flex-col gap-6 min-h-full', panelBg)}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className={cn('text-3xl font-bold tracking-tight', isDark ? 'text-slate-100' : 'text-slate-900')}>
            Communication Log
          </h1>
          <p className={cn('mt-1 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Track all communications with clients, sites and prospects.
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Log Communication
        </Button>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Logs', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Incoming', value: stats.incoming, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Outgoing', value: stats.outgoing, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Follow-ups Pending', value: stats.pendingFollowUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Overdue', value: stats.overdueFollowUp, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Prospects', value: stats.potentialClients, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', isDark ? 'bg-slate-900 border-slate-800' : s.bg)}>
            <div className={cn('text-2xl font-bold', isDark ? 'text-slate-100' : s.color)}>{s.value}</div>
            <div className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-500')}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <LogForm
          form={form}
          onChange={updates => setForm(prev => ({ ...prev, ...updates }))}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }}
          isEdit={!!editingId}
          isDark={isDark}
        />
      )}

      {/* ── Filters ── */}
      <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, client, subject..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={cn(selectCls, 'pl-9 w-full')}
            />
          </div>

          <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)} className={selectCls}>
            <option value="All">All Directions</option>
            <option value="Incoming">Incoming</option>
            <option value="Outgoing">Outgoing</option>
          </select>

          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className={selectCls}>
            <option value="All">All Channels</option>
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filterContactType} onChange={e => setFilterContactType(e.target.value)} className={selectCls}>
            <option value="All">All Types</option>
            {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterFollowUp} onChange={e => setFilterFollowUp(e.target.value)} className={selectCls}>
            <option value="All">All Follow-ups</option>
            <option value="Pending">Pending Follow-up</option>
            <option value="Overdue">Overdue</option>
            <option value="Done">Follow-up Done</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('h-9 px-3 rounded-md border text-sm flex items-center gap-1.5 transition-colors',
              isDark ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-slate-200 text-slate-500 hover:border-slate-400'
            )}
          >
            <Filter className="w-4 h-4" /> More
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={cn(selectCls, 'w-36')} />
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={cn(selectCls, 'w-36')} />
            </div>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={selectCls}>
              <option value="All">All Clients / Prospects</option>
              {allLogClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => { setFilterDirection('All'); setFilterChannel('All'); setFilterContactType('All'); setFilterClient('All'); setFilterFollowUp('All'); setDateFrom(''); setDateTo(''); setSearchTerm(''); }}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        <div className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
          Showing {filtered.length} of {commLogs.length} logs
        </div>
      </div>

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div className={cn('rounded-xl border py-20 flex flex-col items-center gap-3', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
          <MessageSquare className={cn('w-12 h-12', isDark ? 'text-slate-700' : 'text-slate-200')} />
          <p className={cn('font-medium', isDark ? 'text-slate-500' : 'text-slate-400')}>
            {commLogs.length === 0 ? 'No communication logs yet' : 'No logs match your filters'}
          </p>
          {commLogs.length === 0 && (
            <Button onClick={() => setShowForm(true)} className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Log your first communication
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => (
            <LogCard
              key={log.id}
              log={log}
              isDark={isDark}
              expanded={expandedIds.has(log.id)}
              onToggleExpand={() => toggleExpand(log.id)}
              onEdit={() => handleEdit(log)}
              onDelete={() => handleDelete(log.id)}
              onToggleFollowUp={() => updateCommLog(log.id, { followUpDone: !log.followUpDone })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
