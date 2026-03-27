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
  Bell, BellOff, CheckCircle2, MapPin, Building2,
  UserCheck, AlertCircle, ClipboardList, ListPlus,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import type { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const CHANNELS = ['Call', 'Email', 'WhatsApp', 'Meeting', 'SMS', 'Visit', 'Other'] as const;

// Only two link-to options shown in the form
const LINK_TO_OPTIONS = ['Existing Client', 'Potential Client'] as const;

// Legacy filter options (keeps backward compat with stored logs)
const ALL_CONTACT_TYPES = ['Client', 'Site', 'Both', 'Potential Client'] as const;

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
    contactType: 'Client' as 'Client' | 'Site' | 'Both' | 'Potential Client',
    client: '',
    siteId: '',
    siteName: '',
    contactPerson: '',
    subject: '',
    notes: '',
    outcome: '',
    followUpDate: '',
    followUpDone: false,
    createTask: false,
  };
}

// ────────────────────────────────────────────────────────────
// Helper: build a narrative description from log data
// ────────────────────────────────────────────────────────────
function buildTaskDescription(form: ReturnType<typeof emptyForm>): string {
  const lines: string[] = [];
  const dir = form.direction === 'Incoming' ? 'Received' : 'Made';
  const date = form.date ? format(parseISO(form.date), 'dd MMM yyyy') : '';
  const time = form.time ? ` at ${form.time}` : '';
  const who = form.contactPerson ? ` with ${form.contactPerson}` : '';
  const via = form.channel;
  const clientPart = form.client
    ? (form.contactType === 'Potential Client' ? ` (Prospect: ${form.client})` : ` — ${form.client}`)
    : '';
  const sitePart = form.siteName ? ` / ${form.siteName}` : '';

  lines.push(
    `${dir} a ${via} communication${clientPart}${sitePart}${who} on ${date}${time}.`,
    '',
  );

  if (form.notes) {
    lines.push('📋 Notes:', form.notes, '');
  }
  if (form.outcome) {
    lines.push('✅ Outcome / Next Steps:', form.outcome, '');
  }
  if (form.followUpDate) {
    lines.push(`🔔 Follow-up scheduled: ${format(parseISO(form.followUpDate), 'dd MMM yyyy')}`);
  }

  return lines.join('\n').trim();
}

// ────────────────────────────────────────────────────────────
// Blank SiteQuestionnaire factory (mirrors SiteOnboarding.tsx)
// ────────────────────────────────────────────────────────────
function blankSiteQuestionnaire(overrides: Partial<SiteQuestionnaire> = {}): SiteQuestionnaire {
  return {
    id: crypto.randomUUID(),
    siteName: '',
    clientName: '',
    address: '',
    contactPersonName: '',
    contactPersonPhone: '',
    status: 'Pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase1: {
      isNewSite: true, isNewClient: true,
      whatIsBeingBuilt: '', excavationDepthMeters: '', siteLength: '', siteWidth: '',
      timelineStartDate: '', geotechnicalReportAvailable: false,
      hydrogeologicalDataAvailable: false, completed: false,
    },
    phase2: {
      siteVisited: false, walkthroughCompleted: false, knownObstacles: '',
      dischargeLocation: '', dieselSupplyStrategy: '', completed: false,
    },
    phase3: {
      dewateringMethods: [], totalWellpointsRequired: '', totalHeadersRequired: '',
      totalPumpsRequired: '', expectedDailyDieselUsage: '', completed: false,
    },
    phase4: {
      quotationSent: false, clientFeedbackReceived: false, proposalAccepted: false,
      clientTaxStatus: '', scopeOfWorkSummary: '', scopeExclusionsSummary: '',
      timelineConfirmed: false, permittingResponsibilityOutlined: false,
      tinProvided: false, completed: false,
    },
    phase5: {
      safetyPlanIntegrated: false, stage1AdvanceReceived: false,
      stage2InstallationComplete: false, stage2FirstInvoiceIssued: false,
      stage3TimelyBilling: false, stage4DemobilizationComplete: false,
      stage4FinalInvoiceIssued: false, actualEndDate: '', completed: false,
    },
    ...overrides,
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
  const pendingSites = useAppStore(s => s.pendingSites);
  const addPendingSite = useAppStore(s => s.addPendingSite);
  const deletePendingSite = useAppStore(s => s.deletePendingSite);

  const allClients = useMemo(() => Array.from(new Set(sites.map(s => s.client))).sort(), [sites]);

  // Onboard-in-background wizard state
  const [onboardBannerFor, setOnboardBannerFor] = useState<string | null>(null);
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [useContactPerson, setUseContactPerson] = useState(false);
  const [recentlyOnboardedSite, setRecentlyOnboardedSite] = useState<{ id: string; name: string } | null>(null);
  // track sites the user has already decided on (to avoid re-prompting)
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());

  const inputCls = cn(
    'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const selectCls = cn(inputCls, 'cursor-pointer');
  const labelCls = cn('text-xs font-semibold mb-1', isDark ? 'text-slate-400' : 'text-slate-500');

  const isExistingClient = form.contactType === 'Client';
  const isPotential = form.contactType === 'Potential Client';

  // Sites list filtered by selected client
  const filteredSites = [
    ...sites,
    ...pendingSites.map(ps => ({
      id: ps.id,
      name: ps.siteName,
      client: ps.clientName,
      isPending: true
    }))
  ].filter(s => !form.client || s.client === form.client);

  // Check if the typed site name is genuinely new
  const isSiteNew = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return !sites.some(s => s.name.toLowerCase() === n)
      && !pendingSites.some(s => s.siteName.toLowerCase() === n);
  };

  const triggerOnboardCheck = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || processedKeys.has(key)) return;
    if (isSiteNew(name)) {
      setOnboardBannerFor(name.trim());
      setOnboardAddress('');
      setOnboardPhone('');
      setUseContactPerson(!!form.contactPerson.trim());
    }
  };

  const handleSiteInputBlur = () => triggerOnboardCheck(form.siteName);

  const handleOnboardYes = () => {
    const siteName = onboardBannerFor!;
    const newSite = blankSiteQuestionnaire({
      siteName,
      clientName: form.client || '',
      address: onboardAddress,
      contactPersonName: useContactPerson ? form.contactPerson : '',
      contactPersonPhone: onboardPhone,
      phase1: {
        isNewSite: true,
        isNewClient: !allClients.includes(form.client || ''),
        whatIsBeingBuilt: '', excavationDepthMeters: '', siteLength: '', siteWidth: '',
        timelineStartDate: '', geotechnicalReportAvailable: false,
        hydrogeologicalDataAvailable: false, completed: false,
      },
    });
    addPendingSite(newSite);
    setProcessedKeys(prev => new Set([...prev, siteName.toLowerCase()]));
    setOnboardBannerFor(null);
    setRecentlyOnboardedSite({ id: newSite.id, name: newSite.siteName });
    toast.success(`"${siteName}" added to Pending Sites for onboarding.`);
  };

  const handleUndoOnboard = () => {
    if (recentlyOnboardedSite) {
      deletePendingSite(recentlyOnboardedSite.id);
      setProcessedKeys(prev => {
        const next = new Set(prev);
        next.delete(recentlyOnboardedSite.name.toLowerCase());
        return next;
      });
      setRecentlyOnboardedSite(null);
      toast.info(`Registration of "${recentlyOnboardedSite.name}" undone.`);
    }
  };

  const handleOnboardNo = () => {
    if (onboardBannerFor) setProcessedKeys(prev => new Set([...prev, onboardBannerFor.toLowerCase()]));
    setOnboardBannerFor(null);
  };

  return (
    <div className={cn('rounded-xl border shadow-sm flex flex-col', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className={cn("text-lg font-semibold", isDark ? 'text-slate-100' : 'text-slate-900')}>
          {isEdit ? 'Edit Log' : 'New Communication'}
        </h2>
        {!isEdit && (
           <Button variant="ghost" size="icon" onClick={onCancel} className={cn("h-8 w-8", isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}>
             <X className="w-4 h-4" />
           </Button>
        )}
      </div>

      <div className="p-4 overflow-y-auto space-y-5 flex-1 style-scroll">
      
        {/* Row 1: date, time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelCls}>Date *</div>
            <input type="date" value={form.date} onChange={e => onChange({ date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <div className={labelCls}>Time</div>
            <input type="time" value={form.time} onChange={e => onChange({ time: e.target.value })} className={inputCls} />
          </div>
        </div>

        {/* Row 2: Direction, Channel */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Contact Person */}
        <div>
          <div className={labelCls}>Contact Person</div>
          <input
            type="text"
            placeholder="e.g. Mr. Adeyemi, Site Manager"
            value={form.contactPerson}
            onChange={e => onChange({ contactPerson: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* Linked & Site Block */}
        <div className={cn("p-3 rounded-lg border space-y-4", isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100')}>
          <div>
            <div className={labelCls}>Linked To *</div>
            <select
              value={form.contactType === 'Client' ? 'Existing Client' : 'Potential Client'}
              onChange={e => {
                const isPot = e.target.value === 'Potential Client';
                onChange({ contactType: isPot ? 'Potential Client' : 'Client', client: '', siteId: '', siteName: '' });
                setOnboardBannerFor(null);
                setProcessedKeys(new Set());
              }}
              className={selectCls}
            >
              <option value="Existing Client">🏢 Existing Client</option>
              <option value="Potential Client">🔮 Potential Client</option>
            </select>
          </div>

          <div>
            <div className={labelCls}>{isPotential ? 'Prospect / Company Name *' : 'Client *'}</div>
            {recentlyOnboardedSite ? (
               <input disabled value={form.client} className={cn(inputCls, isDark ? 'bg-slate-900 opacity-50 cursor-not-allowed' : 'bg-slate-100 opacity-50 cursor-not-allowed')} />
            ) : isPotential ? (
              <input
                type="text"
                placeholder="Enter prospect or company name"
                value={form.client}
                onChange={e => onChange({ client: e.target.value })}
                className={inputCls}
              />
            ) : (
              <select
                value={form.client}
                onChange={e => {
                  onChange({ client: e.target.value, siteId: '', siteName: '' });
                  setOnboardBannerFor(null);
                }}
                className={selectCls}
              >
                <option value="">Select Client</option>
                {allClients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div>
            <div className={labelCls}>
              Site Name
              <span className={cn('ml-1 font-normal', isDark ? 'text-slate-500' : 'text-slate-400')}>
                — select existing or type a new one
              </span>
            </div>
            {recentlyOnboardedSite ? (
               <div className="flex gap-2 items-center">
                 <input disabled value={form.siteName} className={cn(inputCls, 'flex-1', isDark ? 'bg-slate-900 opacity-50 cursor-not-allowed' : 'bg-slate-100 opacity-50 cursor-not-allowed')} />
                 <Button variant="ghost" title="Undo new site registration" onClick={handleUndoOnboard} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 px-2 h-9 flex-shrink-0">
                   <Trash2 className="w-4 h-4" />
                 </Button>
               </div>
            ) : (
               <>
                <input
                  type="text"
                  list={isPotential ? undefined : "comm-log-site-list"}
                  placeholder={isExistingClient && form.client ? `Sites for ${form.client}…` : 'Type or select site name'}
                  value={form.siteName}
                  onChange={e => {
                    const val = e.target.value;
                    const match = !isPotential ? filteredSites.find(s => s.name.toLowerCase() === val.toLowerCase()) : undefined;
                    if (match) {
                      onChange({ siteName: match.name, siteId: match.id, client: form.client || match.client });
                    } else {
                      onChange({ siteName: val, siteId: '' });
                    }
                    if (onboardBannerFor && val.toLowerCase() !== onboardBannerFor.toLowerCase()) setOnboardBannerFor(null);
                  }}
                  onBlur={handleSiteInputBlur}
                  className={inputCls}
                />
                {!isPotential && (
                  <datalist id="comm-log-site-list">
                    {filteredSites.map(s => (
                      <option key={s.id} value={s.name}>{s.name} — {s.client}</option>
                    ))}
                  </datalist>
                )}
                {form.siteName.trim() && isSiteNew(form.siteName) && !onboardBannerFor && (
                  <p className="mt-1.5 text-xs text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> New site — leave field or click away to get onboarding prompt.
                  </p>
                )}
               </>
            )}
          </div>
        </div>

        {/* ── Onboard-in-Background Banner ── */}
        {onboardBannerFor && (
          <div className={cn(
            'rounded-xl border p-4 space-y-3 animate-in slide-in-from-top-2 duration-200',
            isDark ? 'bg-amber-950/20 border-amber-800' : 'bg-amber-50 border-amber-200'
          )}>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className={cn('text-sm font-semibold', isDark ? 'text-amber-400' : 'text-amber-800')}>
                  "{onboardBannerFor}" is a new site
                </p>
                <p className={cn('text-xs mt-1', isDark ? 'text-amber-500/80' : 'text-amber-700')}>
                  Register this site in the background? It will be added to the <strong>Pending Sites</strong> tab in Sites &amp; Clients.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <div className={labelCls}>Site Address <span className="font-normal">(optional)</span></div>
                <input type="text" placeholder="e.g. 12 Allen Avenue, Ikeja" value={onboardAddress} onChange={e => setOnboardAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <div className={labelCls}>Contact Phone <span className="font-normal">(optional)</span></div>
                <input type="text" placeholder="e.g. 08012345678" value={onboardPhone} onChange={e => setOnboardPhone(e.target.value.replace(/[^0-9+\-\s]/g, ''))} className={inputCls} />
              </div>
              {form.contactPerson.trim() && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={useContactPerson} onChange={e => setUseContactPerson(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                    Make <strong>"{form.contactPerson}"</strong> the contact person
                  </span>
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleOnboardYes} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-xs flex-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Register Site
                </Button>
                <Button variant="outline" onClick={handleOnboardNo} className="gap-2 h-8 text-xs">
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <div className={labelCls}>Subject</div>
          <input
            type="text"
            placeholder="Brief topic of communication"
            value={form.subject}
            onChange={e => onChange({ subject: e.target.value })}
            className={inputCls}
          />
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
        <input
          type="text"
          placeholder="e.g. Client will revert by Friday, Proposal to be sent..."
          value={form.outcome}
          onChange={e => onChange({ outcome: e.target.value })}
          className={inputCls}
        />
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

      {/* Create Task checkbox */}
      {!isEdit && (
        <label className={cn(
          'flex items-center gap-2.5 text-sm cursor-pointer select-none px-3 py-2 rounded-lg border transition-colors',
          form.createTask
            ? (isDark ? 'bg-indigo-900/40 border-indigo-600 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700')
            : (isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-300')
        )}>
          <input
            type="checkbox"
            checked={form.createTask}
            onChange={e => onChange({ createTask: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <ClipboardList className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Create a task from this communication log</span>
          {form.createTask && (
            <span className={cn('text-xs ml-1', isDark ? 'text-indigo-400' : 'text-indigo-500')}>
              — a task dialog will open after saving
            </span>
          )}
        </label>
      )}

      {/* Actions */}
      <div className="flex gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-xl shrink-0">
        <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1">
          <Save className="w-4 h-4" /> {isEdit ? 'Update Log' : 'Save Log'}
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CommLogTaskDialog — pre-filled task creator from a comm log
// ────────────────────────────────────────────────────────────
interface CommLogTaskDialogProps {
  open: boolean;
  onClose: () => void;
  initialTitle: string;
  initialDescription: string;
  isDark: boolean;
}

function CommLogTaskDialog({ open, onClose, initialTitle, initialDescription, isDark }: CommLogTaskDialogProps) {
  const { createMainTask, users } = useAppData();
  const { user } = useAuth();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [assignee, setAssignee] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [subtasks, setSubtasks] = useState<{ id: string; title: string }[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);

  // reset when dialog opens with fresh data
  const [didInit, setDidInit] = useState(false);
  if (open && !didInit) {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setSubtasks([]);
    setNewSubtask('');
    setAssignee([]);
    setOpenDropdown(false);
    setDeadline('');
    setPriority('medium');
    setDidInit(true);
  }
  if (!open && didInit) setDidInit(false);

  if (!open) return null;

  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: t }]);
    setNewSubtask('');
  };

  const removeSubtask = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    const subs = subtasks.map(s => ({ title: s.title, status: 'not_started' }));
    await createMainTask({
      title: title.trim(),
      description: description.trim(),
      createdBy: user?.id,
      teamId: 'dcel-team',
      workspaceId: 'dcel-team',
      assignedTo: assignee.length > 0 ? assignee.join(',') : null,
      deadline: deadline || null,
      priority,
      is_project: false,
    }, subs);
    setSaving(false);
    onClose();
  };

  const inputCls = cn(
    'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const labelCls = cn('text-xs font-semibold mb-1', isDark ? 'text-slate-400' : 'text-slate-500');
  const overlayBg = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  const cardCls = cn(
    'relative w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]',
    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  );

  const priorityStyles = {
    low: { on: 'bg-slate-200 text-slate-700 border-slate-400', off: isDark ? 'border-slate-700 text-slate-500 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-slate-50' },
    medium: { on: 'bg-amber-100 text-amber-700 border-amber-400', off: isDark ? 'border-slate-700 text-slate-500 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-slate-50' },
    high: { on: 'bg-red-100 text-red-700 border-red-400', off: isDark ? 'border-slate-700 text-slate-500 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-slate-50' },
  };

  return (
    <div className={overlayBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cardCls}>
        {/* Header */}
        <div className={cn('flex items-center justify-between px-5 py-4 border-b flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-100')}>
          <div className="flex items-center gap-2">
            <ClipboardList className={cn('w-5 h-5', isDark ? 'text-indigo-400' : 'text-indigo-600')} />
            <h2 className={cn('text-base font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>Create Task from Communication Log</h2>
          </div>
          <button onClick={onClose} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <div className={labelCls}>Task Title *</div>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="What needs to be done?" />
          </div>

          {/* Description (narrative) */}
          <div>
            <div className={labelCls}>Description <span className="font-normal text-indigo-500">(auto-generated from log — editable)</span></div>
            <textarea
              rows={6}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={cn(inputCls, 'h-auto resize-none font-mono text-xs leading-relaxed')}
            />
          </div>

          {/* Assignee + Deadline */}
          <div className="grid grid-cols-2 gap-3 relative">
            <div className="relative">
              <div className={labelCls}>Assign To</div>
              <div
                onClick={() => setOpenDropdown(!openDropdown)}
                className={cn(inputCls, 'cursor-pointer flex items-center justify-between')}
              >
                <span className="truncate pr-2">
                  {assignee.length === 0 ? '— Unassigned —' : `${assignee.length} selected`}
                </span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </div>
              
              {openDropdown && (
                <div className={cn('absolute top-full left-0 mt-1 w-full max-h-[200px] overflow-y-auto rounded-lg border shadow-xl z-50', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
                  <div 
                    onClick={() => { setAssignee([]); setOpenDropdown(false); }}
                    className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b', isDark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-slate-50 border-slate-100')}
                  >
                    <span className={cn('text-sm italic', isDark ? 'text-slate-400' : 'text-slate-500')}>— Clear Selection —</span>
                  </div>
                  {users.map((u: any) => {
                    const isSelected = assignee.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => setAssignee(p => isSelected ? p.filter(id => id !== u.id) : [...p, u.id])}
                        className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50')}
                      >
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isDark ? 'border-slate-500' : 'border-slate-300')}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className={cn('text-sm truncate font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>{u.name || u.email}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <div className={labelCls}>Due Date</div>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Priority */}
          <div>
            <div className={labelCls}>Priority</div>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all',
                    priority === p ? priorityStyles[p].on : priorityStyles[p].off
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className={cn('text-xs font-semibold mb-2 flex items-center gap-1.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
              <ListPlus className="w-3.5 h-3.5" /> Subtasks <span className="font-normal">(optional)</span>
            </div>
            {subtasks.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {subtasks.map((s, i) => (
                  <li key={s.id} className={cn('flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border', isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700')}>
                    <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{i + 1}.</span>
                    <span className="flex-1">{s.title}</span>
                    <button onClick={() => removeSubtask(s.id)} className={cn('transition-colors', isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a subtask…"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                className={cn(inputCls, 'flex-1')}
              />
              <Button onClick={addSubtask} variant="outline" className="h-9 px-3 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn('flex gap-2 px-5 py-4 border-t flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-100')}>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1 disabled:opacity-50"
          >
            <ClipboardList className="w-4 h-4" />
            {saving ? 'Creating…' : `Create Task${subtasks.length > 0 ? ` + ${subtasks.length} subtask${subtasks.length > 1 ? 's' : ''}` : ''}`}
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" /> Skip
          </Button>
        </div>
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
      <div className={cn('h-1', log.direction === 'Incoming' ? 'bg-emerald-500' : 'bg-blue-500')} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              log.direction === 'Incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            )}>
              {log.direction === 'Incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn('text-sm font-bold', isDark ? 'text-slate-100' : 'text-slate-900')}>
                  {format(parseISO(log.date), 'dd MMM yyyy')}
                  {log.time && <span className={cn('ml-1 text-xs font-normal', isDark ? 'text-slate-400' : 'text-slate-500')}> at {log.time}</span>}
                </span>
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', channelColor(log.channel))}>
                  {channelIcon(log.channel)} {log.channel}
                </span>
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', contactTypeColor(log.contactType))}>
                  {contactTypeIcon(log.contactType)}
                  {log.contactType === 'Client' ? 'Existing Client' : log.contactType}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', log.direction === 'Incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                  {log.direction}
                </span>
              </div>

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

        {!expanded && log.notes && (
          <p onClick={onToggleExpand} className={cn('mt-2 text-sm line-clamp-2 cursor-pointer', isDark ? 'text-slate-400' : 'text-slate-600')}>
            {log.notes}
          </p>
        )}

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
  const commLogs = useAppStore(s => s.commLogs);
  const addCommLog = useAppStore(s => s.addCommLog);
  const updateCommLog = useAppStore(s => s.updateCommLog);
  const deleteCommLog = useAppStore(s => s.deleteCommLog);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Task-from-log dialog state
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; title: string; description: string }>(
    { open: false, title: '', description: '' }
  );

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

  const allLogClients = useMemo(() => {
    return [...new Set(commLogs.map(l => l.client).filter(Boolean))].sort();
  }, [commLogs]);

  const handleSave = () => {
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.notes.trim()) { toast.error('Notes are required'); return; }
    if (!form.client.trim()) {
      toast.error(form.contactType === 'Potential Client' ? 'Please enter the prospect name' : 'Please select a client');
      return;
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
      if (form.createTask) {
        setTaskDialog({
          open: true,
          title: form.subject.trim() || `Follow-up: ${form.channel} with ${form.client || 'contact'}`,
          description: buildTaskDescription(form),
        });
      }
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
      createTask: false,
    });
    setEditingId(log.id);
    setShowForm(true);
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

  return (
    <>
    <CommLogTaskDialog
      open={taskDialog.open}
      onClose={() => setTaskDialog(d => ({ ...d, open: false }))}
      initialTitle={taskDialog.title}
      initialDescription={taskDialog.description}
      isDark={isDark}
    />
    <div className={cn('flex flex-col h-full min-h-0', panelBg)}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1 pb-4 flex-shrink-0">
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight', isDark ? 'text-slate-100' : 'text-slate-900')}>
            Communication Log
          </h1>
          <p className={cn('mt-0.5 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Track all client, site and prospect interactions.
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" /> New Log
          </Button>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 flex-shrink-0 pb-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Incoming', value: stats.incoming, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Outgoing', value: stats.outgoing, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Follow-ups', value: stats.pendingFollowUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Overdue', value: stats.overdueFollowUp, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Prospects', value: stats.potentialClients, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-lg border p-2 text-center', isDark ? 'bg-slate-900 border-slate-800' : s.bg)}>
            <div className={cn('text-xl font-bold', isDark ? 'text-slate-100' : s.color)}>{s.value}</div>
            <div className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Split Panel (form + log list) ── */}
      <div className={cn('flex gap-4 min-h-0 flex-1', showForm ? 'flex-col lg:flex-row' : 'flex-col')}>

        {/* LEFT: Form panel (visible when showForm) */}
        {showForm && (
          <div className="lg:w-96 xl:w-[420px] flex-shrink-0 flex flex-col min-h-0">
            <LogForm
              form={form}
              onChange={updates => setForm(prev => ({ ...prev, ...updates }))}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }}
              isEdit={!!editingId}
              isDark={isDark}
            />
          </div>
        )}

        {/* RIGHT: Filters + Log list */}
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Filters */}
          <div className={cn('rounded-xl border p-3 space-y-2 flex-shrink-0', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-40">
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
                <option value="Client">Existing Client</option>
                <option value="Potential Client">Potential Client</option>
                <option value="Site">Site</option>
                <option value="Both">Both</option>
              </select>

              <select value={filterFollowUp} onChange={e => setFilterFollowUp(e.target.value)} className={selectCls}>
                <option value="All">All Follow-ups</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
                <option value="Done">Done</option>
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
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>From</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={cn(selectCls, 'w-36')} />
                </div>
                <div className="flex items-center gap-1.5">
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

          {/* Scrollable log list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filtered.length === 0 ? (
              <div className={cn('rounded-xl border py-16 flex flex-col items-center gap-3', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
                <MessageSquare className={cn('w-10 h-10', isDark ? 'text-slate-700' : 'text-slate-200')} />
                <p className={cn('font-medium text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  {commLogs.length === 0 ? 'No communication logs yet' : 'No logs match your filters'}
                </p>
                {commLogs.length === 0 && (
                  <Button onClick={() => setShowForm(true)} className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Log your first communication
                  </Button>
                )}
              </div>
            ) : (
              filtered.map(log => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
