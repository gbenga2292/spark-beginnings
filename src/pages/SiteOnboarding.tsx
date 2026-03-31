import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { useAppStore } from '@/src/store/appStore';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { toast } from '@/src/components/ui/toast';
import { Save, ArrowLeft, CheckCircle2, Building2, MapPin, Calendar, User, LayoutGrid } from 'lucide-react';
import { CreateProjectDialog } from '@/src/components/tasks/CreateProjectDialog';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { generateId } from '@/src/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-800">
        {value || <span className="text-slate-300 font-normal italic">—</span>}
      </p>
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {checked
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        : <div className="h-4 w-4 rounded-full border-2 border-slate-200 flex-shrink-0" />}
      <span className={`text-sm ${checked ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}

// Checkbox that is always editable — but shows as read-only row when headerLocked
function PhaseCheck({
  label, checked, onChange
}: { label: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className={`${checked ? 'text-slate-700' : 'text-slate-500'} group-hover:text-slate-700`}>
        {label}
      </span>
    </label>
  );
}

function PhaseTextField({
  label, value, onChange, type = 'text', placeholder, readOnly
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} />
    </div>
  );
}

// ─── Default blank form ───────────────────────────────────────────────────────

const blankForm = (): SiteQuestionnaire => ({
  id: '',
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
    hydrogeologicalDataAvailable: false, completed: false
  },
  phase2: {
    siteVisited: false, walkthroughCompleted: false, knownObstacles: '',
    dischargeLocation: '', dieselSupplyStrategy: '', completed: false
  },
  phase3: {
    dewateringMethods: [], totalWellpointsRequired: '', totalHeadersRequired: '',
    totalPumpsRequired: '', expectedDailyDieselUsage: '', completed: false
  },
  phase4: {
    quotationSent: false, clientFeedbackReceived: false, proposalAccepted: false,
    clientTaxStatus: '', scopeOfWorkSummary: '', scopeExclusionsSummary: '',
    timelineConfirmed: false, permittingResponsibilityOutlined: false, tinProvided: false, completed: false
  },
  phase5: {
    safetyPlanIntegrated: false, stage1AdvanceReceived: false, stage2InstallationComplete: false,
    stage2FirstInvoiceIssued: false, stage3TimelyBilling: false,
    stage4DemobilizationComplete: false, stage4FinalInvoiceIssued: false, actualEndDate: '', completed: false
  }
});

const phaseLabels = [
  'Initial Inquiry',
  'Site Visit & Assessment',
  'System Design',
  'Commercial Proposal',
  'Kick-off & Handover'
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function SiteOnboarding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const pendingSites = useAppStore(s => s.pendingSites);
  const sites = useAppStore(s => s.sites);
  const clients = useMemo(() => Array.from(new Set(sites.map(s => s.client))).sort(), [sites]);
  const addPendingSite = useAppStore(s => s.addPendingSite);
  const updatePendingSite = useAppStore(s => s.updatePendingSite);
  const addSite = useAppStore(s => s.addSite);
  const updateSite = useAppStore(s => s.updateSite);
  const addClient = useAppStore(s => s.addClient);
  const getServiceTemplates = useAppStore(s => s.getServiceTemplates);

  const [form, setForm] = useState<SiteQuestionnaire>(blankForm());
  const [initialForm, setInitialForm] = useState<SiteQuestionnaire>(blankForm());
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const { createProject, users, projects } = useAppData();
  const { user } = useAuth();

  const [wantsProject, setWantsProject] = useState(true);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  const isNew = id === 'new';
  // Only the identity header (client/site name) is locked once activated
  const headerLocked = form.status === 'Active';

  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    if (!isNew && id) {
      const existing = pendingSites.find(s => s.id === id);
      if (existing) {
        setForm(existing);
        setInitialForm(existing);
        if (existing.status === 'Pending') {
          const next = [1, 2, 3, 4, 5].find(p => !(existing as any)[`phase${p}`].completed) as any ?? 5;
          setActivePhase(next);
        }
      } else {
        toast.error('Onboarding record not found.');
        navigate('/sites');
      }
    } else {
      const linked = location.state?.linkedSite;
      if (linked) {
        const newActive = {
          ...blankForm(),
          id: generateId(),
          siteName: linked.name,
          clientName: linked.client,
          status: 'Active' as const,
          phase1: { ...blankForm().phase1, isNewSite: false, isNewClient: false }
        };
        setForm(newActive);
        setInitialForm(newActive);
      } else {
        const blank = { ...blankForm(), id: generateId() };
        setForm(blank);
        setInitialForm(blank);
      }
    }
  }, [id, pendingSites, navigate, location.state]);

  // ─── Updaters ──────────────────────────────────────────────────────────────
  const upd = (patch: Partial<SiteQuestionnaire>) => setForm(p => ({ ...p, ...patch }));
  const updPhase = <K extends 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5'>(
    key: K, patch: Partial<SiteQuestionnaire[K]>
  ) => setForm(p => ({ ...p, [key]: { ...p[key], ...(patch as any) } }));

  const markDone = (phase: 1 | 2 | 3 | 4 | 5) => {
    updPhase(`phase${phase}` as any, { completed: true });
    if (phase < 5) setActivePhase((phase + 1) as any);
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!form.clientName.trim() || !form.siteName.trim()) {
      toast.error('Client Name and Site Name are required.');
      return;
    }

    if (isNew && wantsProject) {
      // If it's a new site and user checked the "create project" button
      setShowProjectDialog(true);
      return;
    }

    executeSave();
  };

  const executeSave = () => {
    if (isNew) {
      addPendingSite(form);
      navigate(`/sites/onboarding/${form.id}`, { replace: true });
      toast.success('Site onboarding started.');
    } else {
      updatePendingSite(form.id, { ...form, updatedAt: new Date().toISOString() });
      if (form.status === 'Active') {
        const sites = useAppStore.getState().sites;
        const matchingSite = sites.find(s => s.name === form.siteName && s.client === form.clientName);
        if (matchingSite && form.phase5.actualEndDate !== matchingSite.endDate) {
          updateSite(matchingSite.id, { endDate: form.phase5.actualEndDate || '' });
        }
      }
      setInitialForm(form);
      toast.success('Progress saved.');
    }
  };

  const handleProjectSubmit = async (payload: any) => {
    await createProject(payload);
    setShowProjectDialog(false);
    executeSave();
  };

  // ─── Activation ──────────────────────────────────────────────────────────
  const canActivate =
    form.status === 'Pending' &&
    form.phase1.completed &&
    form.phase2.completed &&
    form.phase3.completed &&
    form.phase4.quotationSent &&
    form.phase4.proposalAccepted &&
    form.phase5.stage1AdvanceReceived;

  const handleActivate = () => {
    if (!canActivate) return;
    if (!clients.includes(form.clientName)) addClient(form.clientName);
    addSite({
      id: generateId(),
      name: form.siteName,
      client: form.clientName,
      status: 'Active',
      vat: ((form.phase4.clientTaxStatus as string) || '').includes('Add') ? 'Add' : ((form.phase4.clientTaxStatus as string) || '').includes('Yes') ? 'Yes' : 'No',
      startDate: form.phase1.timelineStartDate || new Date().toISOString().split('T')[0],
      endDate: ''
    });
    const activated = { ...form, status: 'Active' as const, updatedAt: new Date().toISOString() };
    updatePendingSite(form.id, activated);
    setForm(activated);
    setInitialForm(activated);
    toast.success(`ðŸŽ‰ ${form.siteName} is now an Active Site!`);
    navigate('/sites');
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowUnsavedModal(true);
      return;
    }
    navigate('/sites');
  };

  const forceLeave = () => {
    setShowUnsavedModal(false);
    navigate('/sites');
  };

  const completedCount = [1, 2, 3, 4, 5].filter(p => (form as any)[`phase${p}`].completed).length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 h-full max-w-5xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack} className="text-slate-500 mt-0.5">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isNew ? 'Site Onboarding' : `Site Onboarding — ${form.siteName || 'New Site'}`}
            </h1>
            {!isNew && (
              <Badge variant={form.status === 'Active' ? 'success' : 'secondary'}>{form.status}</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {form.status === 'Active'
              ? 'This site is active. Client & site name are locked — all phases remain editable.'
              : 'Fill all phases. Activation unlocks at Phase 4 when quotation is accepted and payment confirmed.'}
          </p>
        </div>
        {/* Save always visible for existing records */}
        {!isNew && (
          <div className="flex gap-2 flex-shrink-0">
            {form.status === 'Active' && projects.some(p => p.name === form.siteName || p.id === form.siteName || p.title === form.siteName) ? (
              <Button onClick={() => navigate(`/tasks?scope=projects&openProject=${encodeURIComponent(form.siteName)}`)}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200 gap-2 font-medium shadow-none">
                <LayoutGrid className="h-4 w-4" /> View Workspace
              </Button>
            ) : form.status === 'Active' ? (
              <Button onClick={() => setShowProjectDialog(true)}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200 gap-2 font-medium shadow-none">
                <LayoutGrid className="h-4 w-4" /> Create Workspace
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" /> Save
            </Button>
            {canActivate && (
              <Button onClick={handleActivate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <CheckCircle2 className="h-4 w-4" /> Activate Site
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Site info summary card — only after created */}
      {!isNew && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 flex-shrink-0">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <InfoField label="Client" value={form.clientName} />
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 flex-shrink-0">
                <MapPin className="h-4 w-4 text-emerald-600" />
              </div>
              <InfoField label="Site Name" value={form.siteName} />
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 flex-shrink-0">
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              <InfoField label="Planned Start" value={form.phase1.timelineStartDate} />
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-50 flex-shrink-0">
                <Building2 className="h-4 w-4 text-slate-600" />
              </div>
              <InfoField label="Client Tax Status" value={form.phase4.clientTaxStatus} />
            </div>
          </div>
          {/* Address + Contact row */}
          {(form.address || form.contactPersonName || form.contactPersonPhone) && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-6">
              {form.address && <InfoField label="Address" value={form.address} />}
              {form.contactPersonName && <InfoField label="Contact Person" value={form.contactPersonName} />}
              {form.contactPersonPhone && <InfoField label="Contact Phone" value={form.contactPersonPhone} />}
            </div>
          )}
          {/* Phase progress bar */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500">Onboarding Progress</p>
              <p className="text-xs font-semibold text-slate-700">{completedCount} / 5 phases complete</p>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(p => {
                const done = (form as any)[`phase${p}`].completed;
                return (
                  <div
                    key={p}
                    className={`h-2 flex-1 rounded-full transition-colors ${done ? 'bg-emerald-500' : p === activePhase ? 'bg-indigo-200' : 'bg-slate-100'}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New-site creation card */}
      {isNew && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Site Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Client Name <span className="text-red-500">*</span>
              </label>
              <Input
                list="clientList"
                placeholder="Select or type client name"
                value={form.clientName}
                onChange={e => upd({ clientName: e.target.value })}
              />
              <datalist id="clientList">{clients.map(c => <option key={c} value={c} />)}</datalist>
              <p className="text-xs text-slate-400">Select existing or type a new name</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Proposed Site Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Louiseville Site"
                value={form.siteName}
                onChange={e => upd({ siteName: e.target.value })}
              />
            </div>
            {/* Address */}
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium text-slate-700">Site / Client Address</label>
              <Input
                placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
                value={form.address || ''}
                onChange={e => upd({ address: e.target.value })}
              />
            </div>
            {/* Initial Contact Person */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Initial Contact Person</label>
              <Input
                placeholder="e.g. Mr. Adeyemi"
                value={form.contactPersonName || ''}
                onChange={e => upd({ contactPersonName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Contact Phone</label>
              <Input
                placeholder="e.g. 08012345678"
                value={form.contactPersonPhone || ''}
                inputMode="numeric"
                onChange={e => {
                  // numbers only
                  const digits = e.target.value.replace(/[^0-9+\-\s]/g, '');
                  upd({ contactPersonPhone: digits });
                }}
              />
              <p className="text-xs text-slate-400">Numbers only</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wantsProject}
                onChange={e => setWantsProject(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              Create a Project Task across the application for this site?
            </label>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Save className="h-4 w-4" /> Save & Start Onboarding
            </Button>
          </div>
        </div>
      )}

      {/* Phase tabs + content — shown after record is created */}
      {!isNew && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 overflow-hidden flex flex-col">

          {/* Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto flex-shrink-0">
            {[1, 2, 3, 4, 5].map(phase => {
              const done = (form as any)[`phase${phase}`].completed;
              return (
                <button
                  key={phase}
                  onClick={() => setActivePhase(phase as any)}
                  className={`flex-1 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap
                    transition-colors flex flex-col items-center gap-0.5 min-w-[90px]
                    ${activePhase === phase
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                      : done
                        ? 'border-emerald-400 text-emerald-700 hover:bg-emerald-50/30'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    {done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    <span>Phase {phase}</span>
                  </div>
                  <span className="text-[10px] leading-tight text-slate-400 font-normal">
                    {phaseLabels[phase - 1]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">

            {/* ── Phase 1 ── */}
            {activePhase === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Phase 1: Initial Inquiry</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Head of Operations — collect first project details</p>
                  </div>
                  {form.phase1.completed && <Badge variant="success">Complete</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Project Service</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={form.phase1.whatIsBeingBuilt || ''}
                      onChange={e => updPhase('phase1', { whatIsBeingBuilt: e.target.value })}
                    >
                      <option value="" disabled>-- Select Service --</option>
                      {getServiceTemplates().map(t => (
                        <option key={t.serviceName} value={t.serviceName}>{t.serviceName}</option>
                      ))}
                    </select>
                  </div>
                  <PhaseTextField
                    label="Depth of excavation (m)"
                    value={form.phase1.excavationDepthMeters}
                    onChange={v => updPhase('phase1', { excavationDepthMeters: v })}
                    type="number" placeholder="e.g. 8"
                  />
                  <PhaseTextField
                    label="Length (m)"
                    value={form.phase1.siteLength}
                    onChange={v => updPhase('phase1', { siteLength: v })}
                    type="number" placeholder="e.g. 40"
                  />
                  <PhaseTextField
                    label="Width (m)"
                    value={form.phase1.siteWidth}
                    onChange={v => updPhase('phase1', { siteWidth: v })}
                    type="number" placeholder="e.g. 30"
                  />
                  <PhaseTextField
                    label="Perimeter (m) (Auto-calculated)"
                    value={
                      form.phase1.siteLength && form.phase1.siteWidth
                        ? String(2 * (Number(form.phase1.siteLength) + Number(form.phase1.siteWidth)))
                        : ''
                    }
                    onChange={() => { }}
                    readOnly={true}
                    placeholder="Auto-calculated"
                  />
                  <PhaseTextField
                    label="Timeline start date"
                    value={form.phase1.timelineStartDate}
                    onChange={v => updPhase('phase1', { timelineStartDate: v })}
                    type="date"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <PhaseCheck
                    label="Geotechnical Report Available"
                    checked={form.phase1.geotechnicalReportAvailable}
                    onChange={v => updPhase('phase1', { geotechnicalReportAvailable: v })}
                  />
                  <PhaseCheck
                    label="Hydrogeological Data Available"
                    checked={form.phase1.hydrogeologicalDataAvailable}
                    onChange={v => updPhase('phase1', { hydrogeologicalDataAvailable: v })}
                  />
                </div>
                <Button
                  onClick={() => markDone(1)}
                  variant={form.phase1.completed ? 'outline' : 'default'}
                  className={form.phase1.completed ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : ''}
                >
                  {form.phase1.completed ? '✓ Phase 1 Complete' : 'Mark Phase 1 Complete'}
                </Button>
              </div>
            )}

            {/* ── Phase 2 ── */}
            {activePhase === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Phase 2: Site Visit & Assessment</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Head of Operations — on-site walkthrough</p>
                  </div>
                  {form.phase2.completed && <Badge variant="success">Complete</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col gap-3">
                    <PhaseCheck label="Site Visited" checked={form.phase2.siteVisited} onChange={v => updPhase('phase2', { siteVisited: v })} />
                    <PhaseCheck label="Walkthrough Completed" checked={form.phase2.walkthroughCompleted} onChange={v => updPhase('phase2', { walkthroughCompleted: v })} />

                    <div className="space-y-1 mt-2">
                      <label className="text-sm font-medium text-slate-700">Diesel Supply Strategy</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={form.phase2.dieselSupplyStrategy || ''}
                        onChange={e => updPhase('phase2', { dieselSupplyStrategy: e.target.value as any })}
                      >
                        <option value="">-- Select --</option>
                        <option value="Client">Client</option>
                        <option value="DCEL">DCEL</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <PhaseTextField
                      label="Known Obstacles"
                      value={form.phase2.knownObstacles}
                      onChange={v => updPhase('phase2', { knownObstacles: v })}
                      placeholder="e.g. Overhead power lines, tight access"
                    />
                    <PhaseTextField
                      label="Discharge Location"
                      value={form.phase2.dischargeLocation}
                      onChange={v => updPhase('phase2', { dischargeLocation: v })}
                      placeholder="e.g. Storm drain, Sanitary sewer, Creek"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => markDone(2)}
                  variant={form.phase2.completed ? 'outline' : 'default'}
                  className={form.phase2.completed ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : ''}
                >
                  {form.phase2.completed ? '✓ Phase 2 Complete' : 'Mark Phase 2 Complete'}
                </Button>
              </div>
            )}

            {/* ── Phase 3 ── */}
            {activePhase === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Phase 3: System Design & Setup</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Head of Operations — engineering calculations</p>
                  </div>
                  {form.phase3.completed && <Badge variant="success">Complete</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Dewatering Method(s)</label>
                    <div className="flex flex-col gap-2">
                      {['Wellpoints', 'Sump Pumping', 'Deep Wells'].map(method => (
                        <PhaseCheck
                          key={method}
                          label={method}
                          checked={(form.phase3.dewateringMethods || []).includes(method)}
                          onChange={checked => {
                            const methods = [...(form.phase3.dewateringMethods || [])];
                            if (checked && !methods.includes(method)) methods.push(method);
                            else if (!checked) methods.splice(methods.indexOf(method), 1);
                            updPhase('phase3', { dewateringMethods: methods });
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <PhaseTextField
                        label="Total Wellpoints Required" type="number"
                        value={form.phase3.totalWellpointsRequired}
                        onChange={v => {
                          const wp = parseInt(v, 10);
                          const h = isNaN(wp) ? '' : Math.ceil(wp / 6).toString();
                          updPhase('phase3', { totalWellpointsRequired: v, totalHeadersRequired: h });
                        }}
                        placeholder="e.g. 60"
                      />
                      <PhaseTextField
                        label="Total Headers Required (Auto-calculated: 6/Header)" type="number"
                        value={form.phase3.totalHeadersRequired}
                        onChange={v => updPhase('phase3', { totalHeadersRequired: v })}
                        readOnly={true}
                        placeholder="Auto-calculated"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <PhaseTextField
                        label="Total Pumps Required" type="number"
                        value={form.phase3.totalPumpsRequired}
                        onChange={v => updPhase('phase3', { totalPumpsRequired: v })}
                        placeholder="e.g. 1"
                      />
                      <PhaseTextField
                        label="Expected Daily Diesel Usage"
                        value={form.phase3.expectedDailyDieselUsage}
                        onChange={v => updPhase('phase3', { expectedDailyDieselUsage: v })}
                        placeholder="e.g. 25 Litres"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => markDone(3)}
                  variant={form.phase3.completed ? 'outline' : 'default'}
                  className={form.phase3.completed ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : ''}
                >
                  {form.phase3.completed ? '✓ Phase 3 Complete' : 'Mark Phase 3 Complete'}
                </Button>
              </div>
            )}

            {/* ── Phase 4 ── */}
            {activePhase === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Phase 4: Commercial Proposal</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Accounts Department — quotation, payment & contracts</p>
                  </div>
                  {form.phase4.completed && <Badge variant="success">Complete</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <PhaseCheck label="Quotation Sent to Client" checked={form.phase4.quotationSent} onChange={v => updPhase('phase4', { quotationSent: v })} />
                    <PhaseCheck label="Client Feedback Received" checked={form.phase4.clientFeedbackReceived} onChange={v => updPhase('phase4', { clientFeedbackReceived: v })} />
                    <PhaseCheck label="Proposal Accepted by Client" checked={form.phase4.proposalAccepted} onChange={v => updPhase('phase4', { proposalAccepted: v })} />
                    <PhaseCheck label="Timeline Confirmed" checked={form.phase4.timelineConfirmed} onChange={v => updPhase('phase4', { timelineConfirmed: v })} />
                    <PhaseCheck label="Permitting Responsibility Outlined" checked={form.phase4.permittingResponsibilityOutlined} onChange={v => updPhase('phase4', { permittingResponsibilityOutlined: v })} />
                    <PhaseCheck label="Client TIN Provided" checked={form.phase4.tinProvided} onChange={v => updPhase('phase4', { tinProvided: v })} />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Client Tax Status</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={form.phase4.clientTaxStatus || ''}
                        onChange={e => updPhase('phase4', { clientTaxStatus: e.target.value as any })}
                      >
                        <option value="">-- Select --</option>
                        <option value="Mainland (Add 7.5% VAT)">Mainland (Add 7.5% VAT)</option>
                        <option value="Mainland (Yes 7.5% VAT)">Mainland (Yes 7.5% VAT)</option>
                        <option value="Free Trade Zone (0% VAT)">Free Trade Zone (0% VAT)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Scope of Work Summary</label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm max-h-32"
                        value={form.phase4.scopeOfWorkSummary || ''}
                        onChange={e => updPhase('phase4', { scopeOfWorkSummary: e.target.value })}
                        placeholder="Install wells, run pumps, monitor water levels..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Scope Exclusions Summary</label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm max-h-32"
                        value={form.phase4.scopeExclusionsSummary || ''}
                        onChange={e => updPhase('phase4', { scopeExclusionsSummary: e.target.value })}
                        placeholder="General construction site power, disposing of hazardous soil..."
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => markDone(4)}
                  variant={form.phase4.completed ? 'outline' : 'default'}
                  className={form.phase4.completed ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : ''}
                >
                  {form.phase4.completed ? '✓ Phase 4 Complete' : 'Mark Phase 4 Complete'}
                </Button>

                {/* Activation CTA — only when conditions met and still pending */}
                {canActivate && (
                  <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-emerald-800">Ready for Activation!</h3>
                        <p className="text-sm text-emerald-700 mt-1">
                          Phases 1–3 complete, quotation accepted, AND 50% mobilization payment confirmed (Stage 1 in Phase 5).
                          Move this site to the <strong>Active Sites</strong> list now.
                        </p>
                        <Button
                          onClick={handleActivate}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white mt-3 gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Convert to Active Site
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Already-active notice */}
                {form.status === 'Active' && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <p className="text-sm text-indigo-800 font-medium">
                      This site was activated via Phase 4. You can still update any phase fields above and save.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Phase 5 ── */}
            {activePhase === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Phase 5: Kick-off & Site Handover</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Ops + Accounts — mobilisation and ongoing billing</p>
                  </div>
                  {form.phase5.completed && <Badge variant="success">Complete</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <PhaseCheck label="Pre-requisite: Site-Specific Safety Plan Integrated" checked={form.phase5.safetyPlanIntegrated} onChange={v => updPhase('phase5', { safetyPlanIntegrated: v })} />
                  <div />

                  <PhaseCheck label="Stage 1: 50% Advance Received (Mobilization)" checked={form.phase5.stage1AdvanceReceived} onChange={v => updPhase('phase5', { stage1AdvanceReceived: v })} />
                  <div />

                  <PhaseCheck label="Stage 2: Installation Complete & System Started Up" checked={form.phase5.stage2InstallationComplete} onChange={v => updPhase('phase5', { stage2InstallationComplete: v })} />
                  <PhaseCheck label="Stage 2: Remaining 50% & First Hire Invoice Issued" checked={form.phase5.stage2FirstInvoiceIssued} onChange={v => updPhase('phase5', { stage2FirstInvoiceIssued: v })} />

                  <PhaseCheck label="Stage 3: Timely Weekly Hire Invoicing Ongoing" checked={form.phase5.stage3TimelyBilling} onChange={v => updPhase('phase5', { stage3TimelyBilling: v })} />
                  <div />

                  <PhaseCheck label="Stage 4: Demobilization Complete" checked={form.phase5.stage4DemobilizationComplete} onChange={v => updPhase('phase5', { stage4DemobilizationComplete: v })} />
                  <PhaseCheck label="Stage 4: Final Invoice Issued & WHT Credit Requested" checked={form.phase5.stage4FinalInvoiceIssued} onChange={v => updPhase('phase5', { stage4FinalInvoiceIssued: v })} />
                </div>
                <div className="pt-2 max-w-xs">
                  <PhaseTextField
                    label="Actual End Date"
                    type="date"
                    value={form.phase5.actualEndDate || ''}
                    onChange={v => updPhase('phase5', { actualEndDate: v })}
                  />
                  <p className="text-xs text-slate-400 mt-1">This will sync to the End Date column on the Active Sites table when saved.</p>
                </div>
                <Button
                  onClick={() => markDone(5)}
                  variant={form.phase5.completed ? 'outline' : 'default'}
                  className={form.phase5.completed ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' : ''}
                >
                  {form.phase5.completed ? '✓ Phase 5 Complete' : 'Mark Phase 5 Complete'}
                </Button>
              </div>
            )}

          </div>
        </div>
      )}

      {showProjectDialog && (
        <CreateProjectDialog
          initialProjectName={form.siteName}
          initialStatus={form.status === 'Active' ? 'Active' : 'Pending'}
          onClose={() => setShowProjectDialog(false)}
          onSubmit={handleProjectSubmit}
          users={users}
          currentUserId={user?.id || ''}
          teamId="dcel-team"
          workspaceId="dcel-team"
        />
      )}

      {showUnsavedModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-slate-500 mb-6">
              You have unsaved changes. Are you sure you want to leave without saving? Your progress will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowUnsavedModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={forceLeave}>
                Leave without saving
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

