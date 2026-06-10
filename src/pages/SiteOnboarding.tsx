import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { useAppStore } from '@/src/store/appStore';
import { SiteQuestionnaire, SiteAttachment } from '@/src/types/SiteQuestionnaire';
import { toast } from '@/src/components/ui/toast';
import { Save, ArrowLeft, CheckCircle2, Building2, MapPin, Calendar, User, LayoutGrid, ChevronDown, ChevronUp, Edit2, Paperclip, UploadCloud, Trash2, ExternalLink, Loader2, FileText as FileTextIcon, X, Eye } from 'lucide-react';
import { DocPreviewModal } from '@/src/components/DocPreviewModal';
import { CreateProjectDialog } from '@/src/components/tasks/CreateProjectDialog';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useUserStore } from '@/src/store/userStore';
import { generateId } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';

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
    timelineConfirmed: false, permittingResponsibilityOutlined: false, tinProvided: false,
    clientTinNumber: '', mobilizationAdvancePercentage: '70', completed: false
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
  const isNew = id === 'new';
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const pendingSites = useAppStore(s => s.pendingSites);
  const sites = useAppStore(s => s.sites);
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const clients = useMemo(() => Array.from(new Set(sites.map(s => s.client))).sort(), [sites]);
  const addPendingSite = useAppStore(s => s.addPendingSite);
  const updatePendingSite = useAppStore(s => s.updatePendingSite);
  const addSite = useAppStore(s => s.addSite);
  const updateSite = useAppStore(s => s.updateSite);
  const addClient = useAppStore(s => s.addClient);
  const getServiceTemplates = useAppStore(s => s.getServiceTemplates);
  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const addClientProfile = useAppStore(s => s.addClientProfile);
  const updateClientProfile = useAppStore(s => s.updateClientProfile);
  const addClientContact = useAppStore(s => s.addClientContact);
  const updateClientContact = useAppStore(s => s.updateClientContact);

  const [form, setForm] = useState<SiteQuestionnaire>(blankForm());
  const [initialForm, setInitialForm] = useState<SiteQuestionnaire>(blankForm());
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ file: File; caption: string }[]>([]);
  const [previewDoc, setPreviewDoc] = useState<SiteAttachment | null>(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editCaptionText, setEditCaptionText] = useState<string>('');
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<SiteAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createProject, users, projects } = useAppData();
  const { user } = useAuth();

  const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

  // ─── File Selection & Validation ─────────────────────────────────────────────
  const handleFileSelection = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length || !form.id || isNew) return;

    const validFiles: { file: File; caption: string }[] = [];
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExts = ['pdf', 'doc', 'docx'];

    for (const file of fileArray) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (allowedMimes.includes(file.type) || allowedExts.includes(ext || '')) {
        validFiles.push({ file, caption: '' });
      } else {
        toast.error(`"${file.name}" is not allowed. Only PDF and Word Documents (.doc, .docx) are accepted.`);
      }
    }

    if (validFiles.length > 0) {
      setPendingUploads(prev => [...prev, ...validFiles]);
    }
  }, [form.id, isNew]);

  // ─── File Upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (uploads: { file: File; caption: string }[]) => {
    if (!uploads.length || !form.id || isNew) return;
    setIsUploadingFile(true);

    const uploaded: SiteAttachment[] = [];
    for (const item of uploads) {
      const { file, caption } = item;
      const fd = new FormData();
      fd.append('media', file);
      fd.append('site_id', form.id);
      fd.append('asset_id', '0');
      fd.append('site_name', form.siteName);
      fd.append('log_date', new Date().toISOString().split('T')[0]);
      fd.append('uploaded_by', currentUser?.id || 'unknown');
      fd.append('uploaded_by_name', currentUser?.name || 'Unknown');
      if (caption.trim()) {
        fd.append('asset_name', caption.trim());
      }
      try {
        const res = await fetch(`${MEDIA_SERVER_URL}/upload_doc.php`, { method: 'POST', body: fd });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${res.status}`);
        }
        const json = await res.json();
        uploaded.push({
          id: json.id ? String(json.id) : generateId(),
          name: file.name,
          url: json.url || json.file_url || '',
          fileType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser?.name || 'Unknown',
          caption: caption.trim() || undefined,
        });
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    if (uploaded.length > 0) {
      const newAttachments = [...(form.attachments || []), ...uploaded];
      const updatedForm = { ...form, attachments: newAttachments };
      setForm(updatedForm);
      setInitialForm(updatedForm);
      updatePendingSite(form.id, updatedForm);
      toast.success(`${uploaded.length} file(s) uploaded successfully`);
    }
    setIsUploadingFile(false);
    setPendingUploads([]);
  }, [form, isNew, currentUser, MEDIA_SERVER_URL, updatePendingSite]);

  const handleSaveCaption = useCallback((attId: string, captionText: string) => {
    setEditingAttachmentId(null);
    const updatedAttachments = (form.attachments || []).map(a => 
      a.id === attId ? { ...a, caption: captionText.trim() || undefined } : a
    );
    const updatedForm = { ...form, attachments: updatedAttachments };
    setForm(updatedForm);
    setInitialForm(updatedForm);
    updatePendingSite(form.id, updatedForm);
    toast.success('Caption updated.');
  }, [form, updatePendingSite]);
  const handleDeleteAttachment = useCallback((att: SiteAttachment) => {
    setDeleteConfirmDoc(att);
  }, []);

  const executeDeleteAttachment = useCallback(async () => {
    if (!deleteConfirmDoc) return;
    const att = deleteConfirmDoc;
    setDeleteConfirmDoc(null);

    // Delete from media server if we have an id
    if (att.id && !att.id.includes('-')) { // numeric IDs come from the server; UUIDs are local
      try {
        await fetch(`${MEDIA_SERVER_URL}/delete.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(att.id) }),
        });
      } catch { /* ignore – remove from store anyway */ }
    }
    const newAttachments = (form.attachments || []).filter(a => a.id !== att.id);
    const updatedForm = { ...form, attachments: newAttachments };
    setForm(updatedForm);
    setInitialForm(updatedForm);
    updatePendingSite(form.id, updatedForm);
    toast.success('File removed');
  }, [deleteConfirmDoc, form, MEDIA_SERVER_URL, updatePendingSite]);
  const { clientBalanceStatus } = useMemo(() => {
    // 1. Never show for pending sites (per user request)
    // 2. Only show if we have both client and site names
    if (form.status === 'Pending' || !form.clientName || !form.siteName) {
      return { clientBalanceStatus: null };
    }

    // Filter to the specific site+client combo
    const cInvoices = invoices.filter(i => 
      i.client === form.clientName && 
      (i.siteName === form.siteName || i.project === form.siteName)
    );
    const cPayments = payments.filter(p => 
      p.client === form.clientName && 
      p.site === form.siteName
    );

    // No invoices at all → no badge (nothing to judge)
    if (cInvoices.length === 0) return { clientBalanceStatus: null };

    const clientBilled = cInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const clientCleared = cPayments.reduce((sum, p) => sum + (p.amount || 0) + (p.withholdingTax || 0) + (p.discount || 0), 0);
    const clientBalance = clientBilled - clientCleared;

    // "Fully Paid" only if real billed amount > 0 AND at least one payment exists AND balance is settled
    if (clientBilled > 0 && cPayments.length > 0 && clientBalance <= 0.01) {
      return { clientBalanceStatus: 'Fully Paid' };
    }
    // "Owing" if billed > 0 and still has outstanding balance
    if (clientBilled > 0 && clientBalance > 0.01) {
      return { clientBalanceStatus: 'Owing' };
    }

    return { clientBalanceStatus: null };
  }, [invoices, payments, form.clientName, form.siteName, form.status]);


  const [wantsProject, setWantsProject] = useState(true);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

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

  // Track if we have already loaded the initial data for the current ID to prevent overwriting local state
  const [hasLoadedInitial, setHasLoadedInitial] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id && id !== hasLoadedInitial) {
      const existing = pendingSites.find(s => s.id === id);
      if (existing) {
        let loadedForm = { ...existing };
        
        // Auto-populate TIN if it's currently empty but we have it on record
        if (!loadedForm.phase4?.clientTinNumber && loadedForm.clientName) {
          const profile = clientProfiles.find(p => p.name === loadedForm.clientName);
          let assumedTin = profile?.tinNumber || '';
          if (!assumedTin) {
            const prevSite = pendingSites.find(s => s.clientName === loadedForm.clientName && s.phase4?.clientTinNumber);
            if (prevSite) assumedTin = prevSite.phase4?.clientTinNumber || '';
          }
          if (assumedTin) {
            loadedForm = { ...loadedForm, phase4: { ...loadedForm.phase4, clientTinNumber: assumedTin } };
          }
        }

        setForm(loadedForm);
        setInitialForm(loadedForm);
        setHasLoadedInitial(id); // Mark this specific ID as loaded

        if (loadedForm.status === 'Pending') {
          const next = [1, 2, 3, 4, 5].find(p => !(loadedForm as any)[`phase${p}`].completed) as any ?? 5;
          setActivePhase(next);
        }
      } else {
        // If we're here, we might be waiting for the initial fetch to complete
        // but if we have sites and still can't find it, then it's actually missing
        if (pendingSites.length > 0) {
          toast.error('Onboarding record not found.');
          navigate('/sites');
        }
      }
    } else if (isNew && hasLoadedInitial !== 'new') {
      const linked = location.state?.linkedSite;
      const prefillClient = location.state?.prefillClient as string | undefined;
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
        const blank = { ...blankForm(), id: generateId(), ...(prefillClient ? { clientName: prefillClient } : {}) };
        setForm(blank);
        setInitialForm(blank);
      }
      setHasLoadedInitial('new');
    }
  }, [id, pendingSites, navigate, location.state, isNew, hasLoadedInitial]);

  // Reset the "hasLoaded" flag if the ID in the URL actually changes (e.g. going from one site to another)
  useEffect(() => {
    if (id && id !== hasLoadedInitial) {
      setHasLoadedInitial(null);
    }
  }, [id]);

  // ─── Updaters ──────────────────────────────────────────────────────────────
  const upd = (patch: Partial<SiteQuestionnaire>) => setForm(p => ({ ...p, ...patch }));
  const updPhase = <K extends 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5'>(
    key: K, patch: Partial<SiteQuestionnaire[K]>
  ) => setForm(p => ({ ...p, [key]: { ...p[key], ...(patch as any) } }));

  const markDone = (phase: 1 | 2 | 3 | 4 | 5) => {
    const updatedForm = {
      ...form,
      [`phase${phase}`]: { ...form[`phase${phase}` as keyof SiteQuestionnaire] as any, completed: true },
      updatedAt: new Date().toISOString()
    };
    
    setForm(updatedForm);
    setInitialForm(updatedForm);
    
    // Explicitly save the progress when a phase is marked done
    updatePendingSite(form.id, updatedForm);
    
    if (phase < 5) setActivePhase((phase + 1) as any);
    toast.success(`Phase ${phase} complete and saved.`);
  };

  const syncOnboardingToAllStores = useCallback((updatedForm: SiteQuestionnaire) => {
    if (!updatedForm.clientName) return;

    // 1. Sync ClientProfile
    const existingProfile = clientProfiles.find(
      p => p.name.trim().toLowerCase() === updatedForm.clientName.trim().toLowerCase()
    );
    if (existingProfile) {
      updateClientProfile(existingProfile.id, {
        address: updatedForm.address || existingProfile.address,
        mainContactPerson: updatedForm.contactPersonName || existingProfile.mainContactPerson,
        contactPhone: updatedForm.contactPersonPhone || existingProfile.contactPhone,
      });
    } else {
      addClientProfile({
        id: generateId(),
        name: updatedForm.clientName,
        address: updatedForm.address || '',
        mainContactPerson: updatedForm.contactPersonName || '',
        contactPhone: updatedForm.contactPersonPhone || '',
        startDate: updatedForm.phase1.timelineStartDate || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Sync ClientContact
    if (updatedForm.contactPersonName) {
      const clientContacts = useAppStore.getState().clientContacts;
      const existingContact = clientContacts.find(
        c => c.clientName.trim().toLowerCase() === updatedForm.clientName.trim().toLowerCase() &&
             c.name.trim().toLowerCase() === updatedForm.contactPersonName.trim().toLowerCase()
      );
      if (existingContact) {
        updateClientContact(existingContact.id, {
          phone: updatedForm.contactPersonPhone || existingContact.phone,
          position: updatedForm.contactPersonPosition || existingContact.position,
        });
      } else {
        addClientContact({
          id: generateId(),
          name: updatedForm.contactPersonName,
          phone: updatedForm.contactPersonPhone || '',
          position: updatedForm.contactPersonPosition || '',
          clientName: updatedForm.clientName,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [clientProfiles, updateClientProfile, addClientProfile, updateClientContact, addClientContact]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const executeSave = useCallback(() => {
    // Ensure we have a clean copy of the form to save
    const dataToSave = { ...form, updatedAt: new Date().toISOString() };
    
    // Sync client profile and contact details
    syncOnboardingToAllStores(dataToSave);

    if (isNew) {
      addPendingSite(dataToSave);
      navigate(`/sites/onboarding/${form.id}`, { replace: true });
      toast.success('Site onboarding started.');
    } else {
      updatePendingSite(form.id, dataToSave);
      
      // Update the real site if it's already active
      if (form.status === 'Active') {
        const sites = useAppStore.getState().sites;
        // Find matching site by siteId (preferred) or name/client
        const matchingSite = sites.find(s => s.id === form.siteId) || 
                           sites.find(s => s.name === form.siteName && s.client === form.clientName);
        
        if (matchingSite) {
          const updates: any = {};
          if (form.phase1.timelineStartDate && form.phase1.timelineStartDate !== matchingSite.startDate) {
            updates.startDate = form.phase1.timelineStartDate;
          }

          if (form.phase5.actualEndDate !== matchingSite.endDate) {
            updates.endDate = form.phase5.actualEndDate || '';
          }
          
          const taxStatus = (form.phase4.clientTaxStatus as string) || '';
          const newVat = taxStatus === 'Add' ? 'Add' : taxStatus === 'Yes' ? 'Yes' : 'No';
          
          if (newVat !== matchingSite.vat) {
            updates.vat = newVat;
          }

          if (form.address !== matchingSite.address) {
            updates.address = form.address || '';
          }
          if (form.contactPersonName !== matchingSite.mainContactPerson) {
            updates.mainContactPerson = form.contactPersonName || '';
          }
          if (form.contactPersonPhone !== matchingSite.contactPhone) {
            updates.contactPhone = form.contactPersonPhone || '';
          }
          if (form.contactPersonPosition !== matchingSite.position) {
            updates.position = form.contactPersonPosition || '';
          }

          if (Object.keys(updates).length > 0) {
            updateSite(matchingSite.id, updates);
          }
        }
      }
      setInitialForm(form);
      toast.success('Progress saved.');
    }
  }, [form, isNew, addPendingSite, updatePendingSite, updateSite, navigate, syncOnboardingToAllStores]);

  const handleSave = useCallback(() => {
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
  }, [form, isNew, wantsProject, executeSave]);

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
      vat: (() => { const ts = (form.phase4.clientTaxStatus as string) || ''; return ts === 'Add' ? 'Add' : ts === 'Yes' ? 'Yes' : 'No'; })() as 'Yes' | 'No' | 'Add',
      startDate: form.phase1.timelineStartDate || new Date().toISOString().split('T')[0],
      endDate: '',
      address: form.address || '',
      mainContactPerson: form.contactPersonName || '',
      contactPhone: form.contactPersonPhone || '',
      position: form.contactPersonPosition || ''
    });
    const activated = { ...form, status: 'Active' as const, updatedAt: new Date().toISOString() };
    updatePendingSite(form.id, activated);
    // Sync contact and client profile as well
    syncOnboardingToAllStores(activated);
    setForm(activated);
    setInitialForm(activated);
    toast.success(`🎉 ${form.siteName} is now an Active Site!`);
    navigate('/sites');
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowUnsavedModal(true);
      return;
    }
    navigate(-1);
  };

  const forceLeave = () => {
    setShowUnsavedModal(false);
    navigate(-1);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      {!isNew && (
        <>
          {form.status === 'Active' && projects.some(p => p.name === form.siteName || p.id === form.siteName || p.title === form.siteName) ? (
            <Button onClick={() => navigate(`/tasks?scope=projects&openProject=${encodeURIComponent(form.siteName)}`)}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200 gap-2 font-medium shadow-none h-9">
              <LayoutGrid className="h-4 w-4" /> View Workspace
            </Button>
          ) : form.status === 'Active' ? (
            <Button onClick={() => setShowProjectDialog(true)}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-200 gap-2 font-medium shadow-none h-9">
              <LayoutGrid className="h-4 w-4" /> Create Workspace
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleSave} className="gap-2 h-9">
            <Save className="h-4 w-4" /> Save Progress
          </Button>
          {canActivate && (
            <Button onClick={handleActivate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-9">
              <CheckCircle2 className="h-4 w-4" /> Activate Site
            </Button>
          )}
        </>
      )}
    </div>
  );

  useSetPageTitle(
    isNew ? 'New Site Onboarding' : `Site Onboarding — ${form.siteName}`,
    isNew ? 'Start a new project inquiry' : `${form.status === 'Active' ? 'Site Active' : 'Activation Pending'} • Fill all phases. Activation unlocks at Phase 4.`,
    headerActions,
    [form.siteName, form.status, canActivate, isNew, form],
    handleBack
  );

  const completedCount = [1, 2, 3, 4, 5].filter(p => (form as any)[`phase${p}`].completed).length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 h-full max-w-5xl mx-auto w-full">

      {/* Site info summary card — only after created */}
      {!isNew && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition-all">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Site Information & Progress</h2>
              {isInfoCollapsed && <Badge variant="outline" className="text-xs bg-slate-50">{completedCount} / 5 phases done</Badge>}
              {clientBalanceStatus === 'Fully Paid' && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 text-xs shadow-none" title="Client is wholly fully paid across all sites">
                  Client Fully Paid
                </Badge>
              )}
              {clientBalanceStatus === 'Owing' && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 text-xs shadow-none" title="Client has outstanding balances">
                  Client Owes
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full">
              {isInfoCollapsed ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
            </Button>
          </div>
          
          {!isInfoCollapsed && (
            <div className="mt-5">
              {isEditingHeader ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client Name</label>
                      <Input
                        list="clientList"
                        value={form.clientName}
                        onChange={e => upd({ clientName: e.target.value })}
                        disabled={headerLocked}
                      />
                      <datalist id="clientList">{clients.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Site Name</label>
                      <Input
                        value={form.siteName}
                        onChange={e => upd({ siteName: e.target.value })}
                        disabled={headerLocked}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Site / Client Address</label>
                      <Input
                        placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
                        value={form.address || ''}
                        onChange={e => upd({ address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Person</label>
                      <Input
                        placeholder="e.g. Mr. Adeyemi"
                        value={form.contactPersonName || ''}
                        onChange={e => upd({ contactPersonName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Phone</label>
                      <Input
                        placeholder="e.g. 08012345678"
                        value={form.contactPersonPhone || ''}
                        onChange={e => {
                          const digits = e.target.value.replace(/[^0-9+\-\s]/g, '');
                          upd({ contactPersonPhone: digits });
                        }}
                      />
                    </div>
                    <div className="space-y-1 col-span-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Position</label>
                      <Input
                        placeholder="e.g. Project Manager"
                        value={form.contactPersonPosition || ''}
                        onChange={e => upd({ contactPersonPosition: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <Button variant="outline" size="sm" onClick={() => { setForm(initialForm); setIsEditingHeader(false); }} className="h-8 text-xs font-semibold">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => { executeSave(); setIsEditingHeader(false); }} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                      Save Details
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => setIsEditingHeader(true)}
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 h-8 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-650" />
                      <span>Edit Info</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 flex-shrink-0">
                        <User className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Client</p>
                        {form.clientName ? (
                          <button
                            onClick={() => navigate(`/sites?client=${encodeURIComponent(form.clientName)}`)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                          >
                            {form.clientName}
                          </button>
                        ) : (
                          <span className="text-slate-300 font-normal italic text-sm">—</span>
                        )}
                      </div>
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
                  {(form.address || form.contactPersonName || form.contactPersonPhone || form.contactPersonPosition) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {form.address && <div className="col-span-1 sm:col-span-2"><InfoField label="Address" value={form.address} /></div>}
                      {form.contactPersonName && <InfoField label="Contact Person" value={form.contactPersonName} />}
                      {form.contactPersonPhone && <InfoField label="Contact Phone" value={form.contactPersonPhone} />}
                      {form.contactPersonPosition && <InfoField label="Contact Position" value={form.contactPersonPosition} />}
                    </div>
                  )}
                </>
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
        </div>
      )}

      {/* New-site creation card */}
      {isNew && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Site Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Client Name <span className="text-red-500">*</span>
              </label>
              <Input
                list="clientList"
                placeholder="Select or type client name"
                value={form.clientName}
                onChange={e => {
                  const newName = e.target.value;
                  const profile = clientProfiles.find(p => p.name === newName);
                  let assumedTin = profile?.tinNumber || '';
                  if (!assumedTin) {
                    const prevSite = pendingSites.find(s => s.clientName === newName && s.phase4?.clientTinNumber);
                    if (prevSite) assumedTin = prevSite.phase4?.clientTinNumber || '';
                  }
                  
                  if (assumedTin) {
                    setForm(p => ({
                      ...p,
                      clientName: newName,
                      phase4: { ...p.phase4, clientTinNumber: assumedTin }
                    }));
                  } else {
                    upd({ clientName: newName });
                  }
                }}
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Contact Position</label>
              <Input
                placeholder="e.g. Project Manager"
                value={form.contactPersonPosition || ''}
                onChange={e => upd({ contactPersonPosition: e.target.value })}
              />
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
          <div className="flex border-b border-slate-200 overflow-x-auto style-scroll flex-shrink-0">
            {[1, 2, 3, 4, 5].map(phase => {
              const done = (form as any)[`phase${phase}`].completed;
              return (
                <button
                  key={phase}
                  onClick={() => { setShowDocuments(false); setActivePhase(phase as any); }}
                  className={`flex-1 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap
                    transition-colors flex flex-col items-center gap-0.5 min-w-[100px] sm:min-w-[120px]
                    ${!showDocuments && activePhase === phase
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

            {/* Documents tab */}
            <button
              onClick={() => setShowDocuments(true)}
              className={`flex-1 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap
                transition-colors flex flex-col items-center gap-0.5 min-w-[100px] sm:min-w-[120px]
                ${showDocuments
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                <span>Documents</span>
                {(form.attachments?.length ?? 0) > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 rounded-full">
                    {form.attachments!.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight text-slate-400 font-normal">Site Files</span>
            </button>
          </div>

          {/* Documents Panel */}
          {showDocuments && (
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Site Documents</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Upload soil reports, permits, contracts, drawings, and any site-related files.</p>
                  </div>
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={e => { e.preventDefault(); setIsDraggingOver(false); handleFileSelection(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDraggingOver
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={e => e.target.files && handleFileSelection(e.target.files)}
                  />
                  {isUploadingFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                      <p className="text-sm font-medium text-indigo-600">Uploading files…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <UploadCloud className="h-9 w-9 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">Drag & drop files here, or click to browse</p>
                      <p className="text-xs text-slate-400">Only PDF and Word Documents (.doc, .docx) are accepted</p>
                    </div>
                  )}
                </div>

                {/* File List */}
                {(form.attachments?.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No files uploaded yet for this site.</p>
                ) : (
                  <div className="space-y-2">
                    {form.attachments!.map(att => {
                      const isImage = att.fileType?.startsWith('image/');
                      return (
                        <div
                          key={att.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all group"
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isImage ? 'bg-sky-100 text-sky-600' : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            <FileTextIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {att.caption || att.name}
                            </p>
                            {att.caption && (
                              <p className="text-xs text-slate-400 truncate">{att.name}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {att.uploadedBy} · {new Date(att.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            {/* Inline Caption Editor */}
                            <div className="mt-1.5 flex items-center gap-2">
                              {editingAttachmentId === att.id ? (
                                <div className="flex items-center gap-1.5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    placeholder="Enter caption..."
                                    value={editCaptionText}
                                    autoFocus
                                    onChange={e => setEditCaptionText(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleSaveCaption(att.id, editCaptionText);
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingAttachmentId(null);
                                      }
                                    }}
                                    className="text-[11px] border border-indigo-200 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium text-slate-700 animate-in fade-in slide-in-from-top-1 duration-100"
                                  />
                                  <button
                                    onClick={() => handleSaveCaption(att.id, editCaptionText)}
                                    className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                                    title="Save"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingAttachmentId(null)}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs">
                                  {att.caption ? (
                                    <span className="text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                      Caption: {att.caption}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">
                                      No caption added
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAttachmentId(att.id);
                                      setEditCaptionText(att.caption || '');
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title="Edit Caption"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {att.url && (
                              <button
                                onClick={e => { e.stopPropagation(); setPreviewDoc(att); }}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {att.url && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Open in new tab"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttachment(att)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload Captions Modal */}
                {pendingUploads.length > 0 && (
                  <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-lg w-full max-h-[85vh] flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                        <h3 className="text-base font-black text-slate-850 flex items-center gap-2">
                          <UploadCloud className="h-5 w-5 text-indigo-600" />
                          Caption & Upload Files
                        </h3>
                        <button
                          onClick={() => setPendingUploads([])}
                          className="text-slate-450 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"
                          disabled={isUploadingFile}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto style-scroll space-y-4 pr-1">
                        {pendingUploads.map((item, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-left">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                <FileTextIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-850 truncate">{item.file.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Caption</label>
                              <Input
                                type="text"
                                placeholder="e.g. Soil Geotech Report, Signed Dewatering Contract..."
                                value={item.caption}
                                onChange={e => {
                                  const val = e.target.value;
                                  setPendingUploads(prev => prev.map((p, i) => i === idx ? { ...p, caption: val } : p));
                                }}
                                className="h-8 text-xs bg-white"
                                disabled={isUploadingFile}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {isUploadingFile && (
                        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200 text-left">
                          <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-indigo-950">Uploading to media server...</p>
                            <p className="text-[10px] text-indigo-600 mt-0.5">Please wait, saving document securely.</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 pt-3 border-t border-slate-100 flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setPendingUploads([])}
                          className="flex-1 text-xs font-semibold"
                          disabled={isUploadingFile}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleFileUpload(pendingUploads)}
                          className="flex-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5"
                          disabled={isUploadingFile}
                        >
                          {isUploadingFile ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            `Upload ${pendingUploads.length} File${pendingUploads.length > 1 ? 's' : ''}`
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          {!showDocuments && <div className="p-6 overflow-y-auto flex-1">

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                {form.phase1.whatIsBeingBuilt?.toLowerCase().includes('dewatering') ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <PhaseTextField
                          label="Total Headers Required" type="number"
                          value={form.phase3.totalHeadersRequired}
                          onChange={v => {
                            const h = parseFloat(v);
                            const wp = isNaN(h) ? '' : (h * 6).toString();
                            updPhase('phase3', { totalHeadersRequired: v, totalWellpointsRequired: wp });
                          }}
                          placeholder="e.g. 10"
                        />
                        <PhaseTextField
                          label="Total Wellpoints Required (Auto-calculated: 6/Header)"
                          value={form.phase3.totalWellpointsRequired}
                          onChange={() => {}}
                          readOnly={true}
                          placeholder="Auto-calculated"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center">
                    <LayoutGrid className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-slate-600">No Engineering Setup Required</h3>
                    <p className="text-xs text-slate-400 mt-1">Specific calculations are only required for Dewatering services.</p>
                  </div>
                )}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <PhaseCheck label="Quotation Sent to Client" checked={form.phase4.quotationSent} onChange={v => updPhase('phase4', { quotationSent: v })} />
                    <PhaseCheck label="Client Feedback Received" checked={form.phase4.clientFeedbackReceived} onChange={v => updPhase('phase4', { clientFeedbackReceived: v })} />
                    <PhaseCheck label="Proposal Accepted by Client" checked={form.phase4.proposalAccepted} onChange={v => updPhase('phase4', { proposalAccepted: v })} />
                    <PhaseCheck label="Timeline Confirmed" checked={form.phase4.timelineConfirmed} onChange={v => updPhase('phase4', { timelineConfirmed: v })} />
                    <PhaseCheck label="Permitting Responsibility Outlined" checked={form.phase4.permittingResponsibilityOutlined} onChange={v => updPhase('phase4', { permittingResponsibilityOutlined: v })} />
                    <PhaseCheck label="Client TIN Provided" checked={form.phase4.tinProvided} onChange={v => updPhase('phase4', { tinProvided: v })} />
                    {form.phase4.tinProvided && (
                      <PhaseTextField
                        label="Client TIN Number"
                        value={form.phase4.clientTinNumber || ''}
                        onChange={v => updPhase('phase4', { clientTinNumber: v })}
                        placeholder="e.g. 19283746-0001"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Client Tax Status (VAT)</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={form.phase4.clientTaxStatus || ''}
                        onChange={e => updPhase('phase4', { clientTaxStatus: e.target.value as any })}
                      >
                        <option value="">-- Select --</option>
                        <option value="Add">Add (Add 7.5% VAT on top)</option>
                        <option value="Yes">Yes (VAT Inclusive)</option>
                        <option value="No">No (VAT Exempt)</option>
                      </select>
                    </div>

                    <PhaseTextField
                      label="Mobilization Advance Percentage (%)"
                      type="number"
                      value={form.phase4.mobilizationAdvancePercentage || ''}
                      onChange={v => updPhase('phase4', { mobilizationAdvancePercentage: v })}
                      placeholder="e.g. 50"
                    />

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
                          Phases 1–3 complete, quotation accepted, AND {Number(form.phase4.mobilizationAdvancePercentage) > 0 ? `${form.phase4.mobilizationAdvancePercentage}%` : '70%'} mobilization payment confirmed (Stage 1 in Phase 5).
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  <PhaseCheck label="Pre-requisite: Site-Specific Safety Plan Integrated" checked={form.phase5.safetyPlanIntegrated} onChange={v => updPhase('phase5', { safetyPlanIntegrated: v })} />
                  <div />

                  {/* Stage 1: Only shown when advance % > 0 */}
                  {Number(form.phase4.mobilizationAdvancePercentage) > 0 && (
                    <>
                      <PhaseCheck label={`Stage 1: ${form.phase4.mobilizationAdvancePercentage}% Advance Received (Proceed to Work)`} checked={form.phase5.stage1AdvanceReceived} onChange={v => updPhase('phase5', { stage1AdvanceReceived: v })} />
                      <div />
                    </>
                  )}
                  {Number(form.phase4.mobilizationAdvancePercentage) === 0 && (
                    <>
                      <div className="col-span-2 text-xs text-slate-400 italic bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                        No mobilization advance — first payment collected at installation (see Stage 2 below).
                      </div>
                    </>
                  )}

                  <PhaseCheck label="Stage 2: Installation Complete & System Started Up" checked={form.phase5.stage2InstallationComplete} onChange={v => updPhase('phase5', { stage2InstallationComplete: v })} />
                  <PhaseCheck
                    label={
                      Number(form.phase4.mobilizationAdvancePercentage) === 0
                        ? `Stage 2: 70% First Payment & First Hire Invoice Issued`
                        : `Stage 2: Remaining ${100 - (Number(form.phase4.mobilizationAdvancePercentage) || 70)}% & First Hire Invoice Issued`
                    }
                    checked={form.phase5.stage2FirstInvoiceIssued}
                    onChange={v => updPhase('phase5', { stage2FirstInvoiceIssued: v })}
                  />

                  {/* Stage 3 label changes when no advance to show 30% remaining */}
                  <PhaseCheck
                    label={
                      Number(form.phase4.mobilizationAdvancePercentage) === 0
                        ? `Stage 3: Remaining 30% & Timely Weekly Hire Invoicing Ongoing`
                        : `Stage 3: Timely Weekly Hire Invoicing Ongoing`
                    }
                    checked={form.phase5.stage3TimelyBilling}
                    onChange={v => updPhase('phase5', { stage3TimelyBilling: v })}
                  />
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

          </div>}
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

      {deleteConfirmDoc && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Document</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to remove <span className="font-semibold text-slate-800">"{deleteConfirmDoc.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmDoc(null)} className="h-9">
                Cancel
              </Button>
              <Button variant="destructive" onClick={executeDeleteAttachment} className="h-9">
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && previewDoc.url && (
        <DocPreviewModal
          url={previewDoc.url}
          name={previewDoc.name}
          caption={previewDoc.caption}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

export default SiteOnboarding;

