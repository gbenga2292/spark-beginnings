import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/src/store/appStore';
import type { CommLog } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn, generateId } from '@/src/lib/utils';
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
import { useSetPageTitle } from '@/src/contexts/PageContext';

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
    parentId: undefined as string | undefined,
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
  editingId?: string | null;
  isDark: boolean;
}

function LogForm({ form, onChange, onSave, onCancel, isEdit, editingId, isDark }: LogFormProps) {
  const sites = useAppStore(s => s.sites);
  const pendingSites = useAppStore(s => s.pendingSites);
  const storeClients = useAppStore(s => s.clients);
  const commLogs = useAppStore(s => s.commLogs);
  const addPendingSite = useAppStore(s => s.addPendingSite);
  const deletePendingSite = useAppStore(s => s.deletePendingSite);

  const allClients = useMemo(() => {
    // Combine clients from the clients table, existing sites, and pending sites
    const fromStore = storeClients || [];
    const fromSites = sites.map(s => s.client);
    const fromPending = pendingSites.map(ps => ps.clientName);
    return Array.from(new Set([...fromStore, ...fromSites, ...fromPending]))
      .filter(Boolean)
      .sort();
  }, [sites, pendingSites, storeClients]);

  const hasChildren = editingId ? commLogs.some(l => l.parentId === editingId) : false;

  // Onboard-in-background wizard state
  const [onboardBannerFor, setOnboardBannerFor] = useState<string | null>(null);
  const [onboardAddress, setOnboardAddress] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [useContactPerson, setUseContactPerson] = useState(false);
  const [recentlyOnboardedSite, setRecentlyOnboardedSite] = useState<{ id: string; name: string } | null>(null);
  // track sites the user has already decided on (to avoid re-prompting)
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());
  const [isManualSite, setIsManualSite] = useState(false);

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
        <Button variant="ghost" size="icon" onClick={onCancel} className={cn("h-8 w-8", isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {form.parentId && !isEdit && (
        <div className={cn("px-4 py-2 border-b text-xs flex items-center gap-1.5", isDark ? 'bg-indigo-950/30 text-indigo-400 border-slate-800' : 'bg-indigo-50 text-indigo-700 border-slate-100')}>
          <MessageSquare className="w-3.5 h-3.5" />
          Adding a follow-up note. The client and site information have been locked to the parent log.
        </div>
      )}

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
              disabled={!!form.parentId}
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
                disabled={!!form.parentId}
                type="text"
                placeholder="Enter prospect or company name"
                value={form.client}
                onChange={e => onChange({ client: e.target.value })}
                className={inputCls}
              />
            ) : (
              <select
                disabled={!!form.parentId}
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
                <Button disabled={!!form.parentId} variant="ghost" title="Undo new site registration" onClick={handleUndoOnboard} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 px-2 h-9 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : isPotential ? (
              <>
                <input
                  disabled={!!form.parentId}
                  type="text"
                  placeholder="Type site name"
                  value={form.siteName}
                  onChange={e => {
                    onChange({ siteName: e.target.value, siteId: '' });
                    if (onboardBannerFor && e.target.value.toLowerCase() !== onboardBannerFor.toLowerCase()) setOnboardBannerFor(null);
                  }}
                  onBlur={handleSiteInputBlur}
                  className={inputCls}
                />
                {!form.parentId && form.siteName.trim() && isSiteNew(form.siteName) && !onboardBannerFor && (
                  <p className="mt-1.5 text-xs text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Potential site — leave field or click away to get onboarding prompt.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {!isManualSite ? (
                  <select
                    disabled={!!form.parentId}
                    value={filteredSites.some(s => s.name === form.siteName) ? form.siteName : (form.siteName ? '__CUSTOM__' : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__ADD_NEW__') {
                        setIsManualSite(true);
                        onChange({ siteName: '', siteId: '' });
                      } else if (val === '__CUSTOM__') {
                        // Keep current
                      } else {
                        const match = filteredSites.find(s => s.name === val);
                        if (match) {
                          onChange({ siteName: match.name, siteId: match.id, client: form.client || match.client });
                        } else {
                          onChange({ siteName: '', siteId: '' });
                        }
                        setOnboardBannerFor(null);
                      }
                    }}
                    className={selectCls}
                  >
                    <option value="">Select site...</option>
                    {Array.from(new Map(filteredSites.map(s => [s.name, s])).values()).map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.client !== form.client ? ` — ${s.client}` : ''}
                      </option>
                    ))}
                    <option value="__ADD_NEW__">+ Type a new site...</option>
                    {form.siteName && !filteredSites.some(s => s.name === form.siteName) && (
                      <option value="__CUSTOM__">Custom: {form.siteName}</option>
                    )}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type new site name..."
                      value={form.siteName}
                      onChange={e => {
                        onChange({ siteName: e.target.value, siteId: '' });
                        if (onboardBannerFor && e.target.value.toLowerCase() !== onboardBannerFor.toLowerCase()) setOnboardBannerFor(null);
                      }}
                      onBlur={handleSiteInputBlur}
                      className={cn(inputCls, 'flex-1')}
                    />
                    <Button 
                      variant="ghost" 
                      className="h-9 px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" 
                      onClick={() => {
                        setIsManualSite(false);
                        onChange({ siteName: '', siteId: '' });
                        setOnboardBannerFor(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {form.siteName.trim() && isSiteNew(form.siteName) && !onboardBannerFor && isManualSite && (
                  <p className="mt-1.5 text-xs text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> New site — leave field or click away to get onboarding prompt.
                  </p>
                )}
              </div>
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
        {!form.parentId && (
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
        )}

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
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <label htmlFor="follow-up-done" className={cn('text-sm cursor-pointer', isDark ? 'text-slate-300' : 'text-slate-700')}>
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

      {/* Convert to Follow-Up */}
      {isEdit && !hasChildren && (() => {
        const candidates = commLogs.filter(l => {
          if (l.parentId) return false;
          if (l.id === editingId) return false;
          const sameClient = (l.client || '').trim().toLowerCase() === (form.client || '').trim().toLowerCase();
          if (!sameClient) return false;
          const curSite = (form.siteName || '').trim().toLowerCase();
          const candSite = (l.siteName || '').trim().toLowerCase();
          if (curSite && candSite && curSite !== candSite) return false;
          return true;
        });

        return (
          <div className={cn("p-4 rounded-lg border space-y-2", isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
            <div className={labelCls}>Attach as Follow-up to (Optional)</div>
            <select
              value={form.parentId || ''}
              onChange={e => onChange({ parentId: e.target.value || undefined })}
              className={selectCls}
              disabled={candidates.length === 0}
            >
              <option value="">— Keep as Main Log —</option>
              {candidates
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {format(parseISO(l.date), 'MMM d, yyyy')}
                    {l.siteName ? ` · ${l.siteName}` : ''}
                    {' — '}
                    {l.subject || l.notes.substring(0, 40) + (l.notes.length > 40 ? '...' : '')}
                  </option>
                ))}
            </select>
            <p className={cn("text-[10px] font-semibold mt-1", isDark ? 'text-slate-500' : 'text-slate-400')}>
              {candidates.length === 0
                ? `No other logs for ${form.client || 'this client'}${form.siteName ? ` / ${form.siteName}` : ''} to attach to.`
                : `Showing ${candidates.length} log${candidates.length !== 1 ? 's' : ''} for ${form.client || 'this client'}${form.siteName ? ` / ${form.siteName}` : ''}.`
              }
            </p>
          </div>
        );
      })()}
      {isEdit && hasChildren && (
        <div className={cn("p-3 rounded-lg border flex items-start gap-2", isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100')}>
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <span className={cn('font-semibold', isDark ? 'text-amber-500' : 'text-amber-700')}>Thread Anchor:</span> 
            <span className={cn('ml-1', isDark ? 'text-slate-400' : 'text-slate-500')}>This log has follow-up replies attached to it. It cannot be converted into a follow-up of another log.</span>
          </div>
        </div>
      )}

      </div> {/* <-- Moved the closing div for the scrollable container here */}

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
  parentLogSubject?: string;
  isDark: boolean;
}

function CommLogTaskDialog({ open, onClose, initialTitle, initialDescription, parentLogSubject, isDark }: CommLogTaskDialogProps) {
  const { createMainTask, mainTasks, addSubtask, users } = useAppData();
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

  const handleAddSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: t }]);
    setNewSubtask('');
  };

  const removeSubtask = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    
    if (parentLogSubject) {
      // It's a follow-up log, find or create the main task using parentLogSubject
      const existingMainTask = mainTasks.find(m => m.title.trim().toLowerCase() === parentLogSubject.trim().toLowerCase());
      
      const newSubtasks = [
        {
          title: title.trim(),
          description: description.trim(),
          assignedTo: assignee.length > 0 ? assignee[0] : null,
          status: 'not_started',
          deadline: deadline || null,
          priority,
        },
        ...subtasks.map(s => ({
          title: s.title,
          description: null,
          assignedTo: null,
          status: 'not_started',
          deadline: null,
          priority: null,
        }))
      ];

      if (existingMainTask) {
        // Main task exists, add subtasks
        for (const sub of newSubtasks) {
          await addSubtask({ ...sub, mainTaskId: existingMainTask.id });
        }
        toast.success(`Added follow-up task under "${existingMainTask.title}"`);
      } else {
        // Main task does not exist, create it then add subtasks
        const newMainTask = await createMainTask({
          title: parentLogSubject.trim(),
          description: `Automatically created for communication thread: ${parentLogSubject}`,
          createdBy: user?.id,
          teamId: 'dcel-team',
          workspaceId: 'dcel-team',
          is_project: false,
        }, []);
        
        if (newMainTask) {
          for (const sub of newSubtasks) {
            await addSubtask({ ...sub, mainTaskId: newMainTask.id });
          }
          toast.success('Main task and follow-up subtasks created');
        }
      }
    } else {
      // Normal flow (Main log task creation)
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
    }

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
          {parentLogSubject && (
            <div className={cn("p-3 rounded-lg border flex items-start gap-2", isDark ? 'bg-indigo-950/30 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100')}>
              <ClipboardList className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Threaded Follow-up Task:</span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">This will be added as a subtask under the main conversation task: <strong className="text-indigo-700 dark:text-indigo-300">{parentLogSubject}</strong>. If the main task doesn't exist yet, it will be automatically created.</p>
              </div>
            </div>
          )}

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
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                className={cn(inputCls, 'flex-1')}
              />
              <Button onClick={handleAddSubtask} variant="outline" className="h-9 px-3 gap-1 text-xs">
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
  onAddFollowUpNote?: () => void;
  isDark: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  currentUserName: string;
  isAdmin: boolean;
  isChild?: boolean;
  mainTasks: any[];
  onNavigateTask: (taskId: string) => void;
}

function LogCard({ log, onEdit, onDelete, onToggleFollowUp, onAddFollowUpNote, isDark, expanded, onToggleExpand, currentUserName, isAdmin, isChild, mainTasks, onNavigateTask }: LogCardProps) {
  const canDelete = isAdmin || log.loggedBy === currentUserName;
  const isOverdue = log.followUpDate && !log.followUpDone && isBefore(parseISO(log.followUpDate), startOfDay(new Date()));

  const logSubject = (log.subject || '').trim().toLowerCase();
  const linkedTasks = logSubject 
    ? mainTasks.filter(t => t.title.trim().toLowerCase() === logSubject)
    : [];

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-200',
      isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
      'hover:shadow-md',
      isChild && (isDark ? 'ml-8 border-l-2 border-l-slate-600 bg-slate-900/50' : 'ml-8 border-l-2 border-l-slate-300 bg-slate-50')
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
                <span className={cn('inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm', contactTypeColor(log.contactType))}>
                  {contactTypeIcon(log.contactType)}
                  {log.client || (log.contactType === 'Client' ? 'Existing Client' : log.contactType)}
                </span>
                {log.siteName && (
                  <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold shadow-sm', isDark ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100')}>
                    📍 {log.siteName}
                  </span>
                )}
                {log.contactPerson && (
                  <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700')}>
                    👤 {log.contactPerson}
                  </span>
                )}
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', log.direction === 'Incoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                  {log.direction}
                </span>
              </div>

              <div className={cn('text-sm flex flex-wrap items-center gap-2', isDark ? 'text-slate-200' : 'text-slate-800')}>
                {log.subject && <span className="font-semibold">{log.subject}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Follow-up status pill */}
            {log.followUpDate && !log.followUpDone && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFollowUp(); }}
                title="Click to mark follow-up as done"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all select-none',
                  isOverdue
                    ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-600 hover:text-white hover:border-red-600 animate-pulse'
                    : 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                )}
              >
                <CheckCircle2 className="w-3 h-3" />
                {isOverdue ? 'Overdue · Mark Done' : 'Follow-up · Mark Done'}
              </button>
            )}
            {log.followUpDate && log.followUpDone && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            )}
            {canDelete && (
              <button
                onClick={onEdit}
                title={isAdmin && log.loggedBy !== currentUserName ? 'Edit (Admin Override)' : 'Edit your log'}
                className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600')}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                title={isAdmin && log.loggedBy !== currentUserName ? 'Delete (Admin Override)' : 'Delete your log'}
                className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {!isChild && onAddFollowUpNote && (
              <button
                onClick={e => { e.stopPropagation(); onAddFollowUpNote(); }}
                title="Add a follow-up log to this conversation"
                className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-emerald-400' : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600')}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
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

        {/* Linked Tasks prominently displayed */}
        {linkedTasks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {linkedTasks.map(t => (
              <button
                key={t.id}
                onClick={(e) => { e.stopPropagation(); onNavigateTask(t.id); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors shadow-sm',
                  t.status === 'completed' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                    : t.status === 'in_progress'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300',
                  isDark && (
                    t.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50' :
                    t.status === 'in_progress' ? 'bg-blue-900/30 text-blue-400 border-blue-800 hover:bg-blue-900/50' : 
                    'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  )
                )}
              >
                <ClipboardList className="w-3.5 h-3.5 opacity-70" />
                {t.title}
                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[9px] bg-white/50 dark:bg-black/20 border-current/20 font-bold uppercase rounded text-current">
                  {t.status?.replace('_', ' ') || 'pending'}
                </Badge>
              </button>
            ))}
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const commLogs = useAppStore(s => s.commLogs);
  const addCommLog = useAppStore(s => s.addCommLog);
  const updateCommLog = useAppStore(s => s.updateCommLog);
  const deleteCommLog = useAppStore(s => s.deleteCommLog);
  const { mainTasks } = useAppData();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  // expandedIds = card body expanded (shows notes/outcome)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // collapsedThreadIds = parent log is collapsed (hides follow-ups)
  const [collapsedThreadIds, setCollapsedThreadIds] = useState<Set<string>>(new Set());
  // collapsedClients = client section is collapsed
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());

  // Task-from-log dialog state
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; title: string; description: string; parentLogSubject?: string }>(
    { open: false, title: '', description: '' }
  );

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('site') || '');
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

  // Set page title and header button
  useSetPageTitle(
    'Communication Log',
    'Track client & site interactions',
    !showForm && (
      <Button
        onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm h-9 px-4 rounded-lg hidden sm:flex items-center"
      >
        <Plus className="w-4 h-4" /> New Log
      </Button>
    )
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
        parentId: form.parentId || undefined,
      });
      toast.success('Log updated');
      setEditingId(null);
    } else {
      addCommLog({
        id: generateId(),
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
        parentId: form.parentId || undefined,
        createdAt: new Date().toISOString(),
      });
      toast.success('Communication logged');
      if (form.createTask) {
        let parentSubject: string | undefined;
        let initialTitle = form.subject.trim() || `Follow-up: ${form.channel} with ${form.client || 'contact'}`;

        if (form.parentId) {
          const parentLog = commLogs.find(l => l.id === form.parentId);
          if (parentLog) {
            parentSubject = parentLog.subject || `Communication with ${parentLog.client || 'Contact'}`;
          }
        }

        setTaskDialog({
          open: true,
          title: initialTitle,
          description: buildTaskDescription(form),
          parentLogSubject: parentSubject
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
      parentId: log.parentId,
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

  const toggleThread = (id: string) => {
    setCollapsedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleClient = (client: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client); else next.add(client);
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
        parentLogSubject={taskDialog.parentLogSubject}
        isDark={isDark}
      />
      <div className={cn('flex flex-col h-full min-h-0', panelBg)}>

        {/* ── Mobile New Log Button ── */}
        {!showForm && (
          <div className="sm:hidden px-1 pb-4">
            <Button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md h-12"
            >
              <Plus className="w-5 h-5" /> New Communication Log
            </Button>
          </div>
        )}

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
                editingId={editingId}
                isDark={isDark}
              />
            </div>
          )}

          {/* RIGHT: When editing - focused thread + linked tasks; otherwise filters + log list */}
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">

            {editingId ? (() => {
              // Find the log being edited and resolve its thread anchor
              const editingLog = commLogs.find(l => l.id === editingId);
              if (!editingLog) return null;
              const anchorId = editingLog.parentId || editingLog.id;
              const anchorLog = commLogs.find(l => l.id === anchorId) || editingLog;
              const threadChildren = commLogs.filter(l => l.parentId === anchorId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

              // Find linked tasks by matching subject to main task titles
              const logSubject = (anchorLog.subject || '').trim().toLowerCase();
              const linkedTasks = logSubject 
                ? mainTasks.filter(t => t.title.trim().toLowerCase() === logSubject)
                : [];

              return (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                  {/* Thread header */}
                  <div className={cn('flex items-center gap-2 px-1 py-2 border-b', isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500')}>
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Editing thread: <span className={cn('font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>{anchorLog.subject || anchorLog.client || 'Log'}</span>
                    </span>
                  </div>

                  {/* Thread: main log */}
                  <div className="space-y-1.5">
                    <LogCard
                      log={anchorLog}
                      isDark={isDark}
                      expanded={expandedIds.has(anchorLog.id)}
                      onToggleExpand={() => toggleExpand(anchorLog.id)}
                      onEdit={() => handleEdit(anchorLog)}
                      onDelete={() => handleDelete(anchorLog.id)}
                      onToggleFollowUp={() => updateCommLog(anchorLog.id, { followUpDone: !anchorLog.followUpDone })}
                      onAddFollowUpNote={() => {
                        setForm({ ...emptyForm(), parentId: anchorLog.id, client: anchorLog.client || '', siteName: anchorLog.siteName || '', contactType: anchorLog.contactType, channel: anchorLog.channel });
                        setShowForm(true);
                        setEditingId(null);
                      }}
                      currentUserName={currentUser?.name || ''}
                      isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'co-admin'}
                      mainTasks={mainTasks}
                      onNavigateTask={(taskId) => navigate(`/tasks?openTask=${taskId}`)}
                    />

                    {/* Follow-up children */}
                    {threadChildren.map(child => (
                      <LogCard
                        key={child.id}
                        log={child}
                        isChild
                        isDark={isDark}
                        expanded={expandedIds.has(child.id)}
                        onToggleExpand={() => toggleExpand(child.id)}
                        onEdit={() => handleEdit(child)}
                        onDelete={() => handleDelete(child.id)}
                        onToggleFollowUp={() => updateCommLog(child.id, { followUpDone: !child.followUpDone })}
                        currentUserName={currentUser?.name || ''}
                        isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'co-admin'}
                        mainTasks={mainTasks}
                        onNavigateTask={(taskId) => navigate(`/tasks?openTask=${taskId}`)}
                      />
                    ))}
                  </div>

                  {/* Linked Tasks section */}
                  <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
                    <div className={cn('flex items-center gap-2 text-sm font-semibold', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      <ClipboardList className="w-4 h-4 text-indigo-500" />
                      Linked Tasks
                      {linkedTasks.length > 0 && (
                        <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                          {linkedTasks.length}
                        </span>
                      )}
                    </div>

                    {linkedTasks.length === 0 ? (
                      <p className={cn('text-xs italic', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        No tasks created from this log yet. Use the "Create Task" option when saving a log.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {linkedTasks.map(task => (
                          <button
                            key={task.id}
                            onClick={() => navigate('/tasks')}
                            className={cn(
                              'w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm',
                              isDark
                                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-indigo-700'
                                : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                            )}
                          >
                            <CheckCircle2 className={cn('w-4 h-4 flex-shrink-0', task.status === 'completed' ? 'text-emerald-500' : 'text-slate-400')} />
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm font-medium truncate', isDark ? 'text-slate-200' : 'text-slate-800')}>{task.title}</p>
                              {task.deadline && (
                                <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                  Due: {format(parseISO(task.deadline), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                              task.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                : task.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            )}>
                              {task.status?.replace('_', ' ') || 'pending'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <>
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

            {/* Scrollable log list — grouped by client */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
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
                (() => {
                  // ── Build client-grouped thread map ──────────────────────
                  // Collect the unique root (parent) log ids that appear in the
                  // filtered set, then group them by client name.
                  const seenRootIds = new Set<string>();
                  const clientMap = new Map<string, { parentLog: CommLog; children: CommLog[] }[]>();

                  filtered.forEach(log => {
                    const parentId = log.parentId || log.id;
                    if (seenRootIds.has(parentId)) return;
                    seenRootIds.add(parentId);

                    const parentLog = commLogs.find(l => l.id === parentId) || log;
                    const children = commLogs
                      .filter(l => l.parentId === parentId)
                      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

                    const clientKey = parentLog.client || '(No Client)';
                    if (!clientMap.has(clientKey)) clientMap.set(clientKey, []);
                    clientMap.get(clientKey)!.push({ parentLog, children });
                  });

                  // Sort clients alphabetically
                  const sortedClients = Array.from(clientMap.keys()).sort((a, b) => a.localeCompare(b));

                  return sortedClients.map(clientName => {
                    const threads = clientMap.get(clientName)!;
                    const isClientCollapsed = collapsedClients.has(clientName);
                    const threadCount = threads.length;
                    const replyCount = threads.reduce((sum, t) => sum + t.children.length, 0);

                    return (
                      <div key={`client-${clientName}`} className={cn(
                        'rounded-xl border overflow-hidden',
                        isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'
                      )}>
                        {/* Client section header */}
                        <button
                          onClick={() => toggleClient(clientName)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                            isDark
                              ? 'bg-slate-800/60 hover:bg-slate-800 border-b border-slate-700'
                              : 'bg-slate-50 hover:bg-slate-100 border-b border-slate-200'
                          )}
                        >
                          <Building2 className={cn('w-4 h-4 flex-shrink-0', isDark ? 'text-indigo-400' : 'text-indigo-500')} />
                          <span className={cn('font-semibold text-sm flex-1 text-left', isDark ? 'text-slate-100' : 'text-slate-800')}>
                            {clientName}
                          </span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
                            {threadCount} log{threadCount !== 1 ? 's' : ''}{replyCount > 0 ? ` · ${replyCount} follow-up${replyCount !== 1 ? 's' : ''}` : ''}
                          </span>
                          {isClientCollapsed
                            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            : <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                        </button>

                        {/* Client threads — hidden when client section is collapsed */}
                        {!isClientCollapsed && (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {threads.map(({ parentLog, children }) => {
                              const isThreadCollapsed = collapsedThreadIds.has(parentLog.id);
                              const hasChildren = children.length > 0;

                              return (
                                <div key={`thread-${parentLog.id}`} className="">
                                  {/* Parent log — with inline thread-collapse toggle when it has children */}
                                  <div className="relative">
                                    {hasChildren && (
                                      <button
                                        onClick={() => toggleThread(parentLog.id)}
                                        title={isThreadCollapsed ? 'Show follow-ups' : 'Hide follow-ups'}
                                        className={cn(
                                          'absolute left-0 top-0 bottom-0 w-1 z-10 transition-colors',
                                          isThreadCollapsed
                                            ? (isDark ? 'bg-indigo-600/60 hover:bg-indigo-500' : 'bg-indigo-400/60 hover:bg-indigo-500')
                                            : (isDark ? 'bg-indigo-800/40 hover:bg-indigo-700/60' : 'bg-indigo-200 hover:bg-indigo-300')
                                        )}
                                        aria-label={isThreadCollapsed ? 'Expand thread' : 'Collapse thread'}
                                      />
                                    )}
                                    <div className={hasChildren ? 'pl-2' : ''}>
                                      <LogCard
                                        log={parentLog}
                                        isDark={isDark}
                                        expanded={expandedIds.has(parentLog.id)}
                                        onToggleExpand={() => toggleExpand(parentLog.id)}
                                        onEdit={() => handleEdit(parentLog)}
                                        onDelete={() => handleDelete(parentLog.id)}
                                        onToggleFollowUp={() => updateCommLog(parentLog.id, { followUpDone: !parentLog.followUpDone })}
                                        onAddFollowUpNote={() => {
                                          setForm({
                                            ...emptyForm(),
                                            parentId: parentLog.id,
                                            client: parentLog.client || '',
                                            siteName: parentLog.siteName || '',
                                            contactType: parentLog.contactType,
                                            channel: parentLog.channel
                                          });
                                          setShowForm(true);
                                          setEditingId(null);
                                        }}
                                        currentUserName={currentUser?.name || ''}
                                        isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'co-admin'}
                                        mainTasks={mainTasks}
                                        onNavigateTask={(taskId) => navigate(`/tasks?openTask=${taskId}`)}
                                      />
                                    </div>
                                    {/* Thread collapse indicator when has children */}
                                    {hasChildren && isThreadCollapsed && (
                                      <button
                                        onClick={() => toggleThread(parentLog.id)}
                                        className={cn(
                                          'w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors border-t',
                                          isDark
                                            ? 'bg-indigo-950/40 text-indigo-400 border-slate-700 hover:bg-indigo-950/60'
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                                        )}
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                        {children.length} follow-up{children.length !== 1 ? 's' : ''} hidden — click to expand
                                      </button>
                                    )}
                                  </div>

                                  {/* Follow-up children — hidden when thread is collapsed */}
                                  {!isThreadCollapsed && children.map(child => (
                                    <div key={child.id} className={cn(
                                      'pl-2 border-l-2',
                                      isDark ? 'border-indigo-800/60' : 'border-indigo-200'
                                    )}>
                                      <LogCard
                                        log={child}
                                        isChild
                                        isDark={isDark}
                                        expanded={expandedIds.has(child.id)}
                                        onToggleExpand={() => toggleExpand(child.id)}
                                        onEdit={() => handleEdit(child)}
                                        onDelete={() => handleDelete(child.id)}
                                        onToggleFollowUp={() => updateCommLog(child.id, { followUpDone: !child.followUpDone })}
                                        currentUserName={currentUser?.name || ''}
                                        isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'co-admin'}
                                        mainTasks={mainTasks}
                                        onNavigateTask={(taskId) => navigate(`/tasks?openTask=${taskId}`)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
