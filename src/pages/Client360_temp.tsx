import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, MapPin, AlertTriangle, FileText, CheckCircle2, Clock, 
  Calendar, Sparkles, ChevronDown, ChevronUp, Users, Phone, DollarSign,
  Activity, Briefcase, MessagesSquare, RefreshCcw, Filter, Send,
  ShieldAlert, ShieldCheck, Settings2, X, Edit2, ChevronRight, CheckSquare,
  Plus, Trash2, Circle, Eye
} from 'lucide-react';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskDetailSheet } from '@/src/components/tasks/TaskDetailSheet';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { useAppStore, Site, ClientProfile } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { parseISO } from 'date-fns';
import { normalizeDate } from '@/src/lib/dateUtils';
import { Site360View } from './Site360View';
import { ClientContactsPanel } from './ClientContactsPanel';
import { CreateTaskDialog } from './Tasks/CreateTaskDialog';

type TabType = 'overview' | 'contacts' | 'financials' | 'operations' | 'activity' | 'tasks' | 'onboarding';

export function Client360() {
  const { isDark } = useTheme();
  
  // Connect to global stores
  const { user: authUser } = useAuth();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const activeUserName = currentUser?.name || authUser?.user_metadata?.name || authUser?.email || 'Admin';
  const sites = useAppStore(s => s.sites);
  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const vatPayments = useAppStore(s => s.vatPayments);
  const clientContacts = useAppStore(s => s.clientContacts);
  const commLogs = useAppStore(s => s.commLogs);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vatRate = useAppStore(s => s.payrollVariables.vatRate);
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const updateSite = useAppStore(s => s.updateSite);
  const updateClientProfile = useAppStore(s => s.updateClientProfile);
  const addClientProfile = useAppStore(s => s.addClientProfile);
  const pendingSites = useAppStore(s => s.pendingSites);
  const deletePendingSite = useAppStore(s => s.deletePendingSite);
  const addCommLog = useAppStore(s => s.addCommLog);
  const addPendingSite = useAppStore(s => s.addPendingSite);
  const { mainTasks, subtasks, users } = useAppData();
  const { dailyMachineLogs, assets, waybills } = useOperations();
  const navigate = useNavigate();

  // Dialog state
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [siteEditTarget, setSiteEditTarget] = useState<Site | null>(null);
  const [clientEditForm, setClientEditForm] = useState<Partial<ClientProfile>>({});
  const [siteEditForm, setSiteEditForm] = useState<Partial<Site>>({});
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [commForm, setCommForm] = useState({
    subject: '',
    notes: '',
    direction: 'Outgoing' as 'Incoming' | 'Outgoing',
    channel: 'Email' as 'Email' | 'Phone' | 'WhatsApp' | 'In-Person' | 'Official Letter',
    siteOption: '',
    newSiteName: '',
    contactPerson: '',
    outcome: '',
    followUpDate: '',
    createTask: false,
  });
  const [isManualContact, setIsManualContact] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    clientId?: string;
    siteId?: string;
  }>({ open: false, title: '', description: '' });

  // Pending Onboarding: delete with guard
  const handleDeletePendingOnboarding = async (site: { id: string; siteName: string; clientName: string }) => {
    const linkedLogs = commLogs.filter(l =>
      l.client?.toLowerCase().trim() === site.clientName?.toLowerCase().trim() &&
      (l.siteName?.toLowerCase().trim() === site.siteName?.toLowerCase().trim())
    );
    const linkedTasks = mainTasks.filter((t: any) =>
      (t.title?.toLowerCase().includes(site.siteName?.toLowerCase())) ||
      (t.description?.toLowerCase().includes(site.siteName?.toLowerCase()))
    );
    if (linkedLogs.length > 0 || linkedTasks.length > 0) {
      const parts: string[] = [];
      if (linkedTasks.length > 0) parts.push(`${linkedTasks.length} task(s)`);
      if (linkedLogs.length > 0) parts.push(`${linkedLogs.length} comm log(s)`);
      const ok = await showConfirm(
        `"${site.siteName}" has linked ${parts.join(' and ')}. These will NOT be deleted. Permanently remove this onboarding record?`,
        { variant: 'danger', confirmLabel: 'Delete Onboarding', cancelLabel: 'Keep It' }
      );
      if (!ok) return;
    } else {
      const ok = await showConfirm(
        `Permanently delete the pending onboarding for "${site.siteName}"? This cannot be undone.`,
        { variant: 'danger', confirmLabel: 'Delete', cancelLabel: 'Cancel' }
      );
      if (!ok) return;
    }
    deletePendingSite(site.id);
    toast.success(`Onboarding for "${site.siteName}" deleted.`);
  };

  // Extract unique client names, excluding internal 'DCEL'
  const allClients = useMemo(() => {
    const names = new Set<string>();
    sites.forEach(s => { 
      const name = s.client?.trim();
      if (name && name.toUpperCase() !== 'DCEL') names.add(name); 
    });
    return Array.from(names).sort();
  }, [sites]);

  const [selectedClient, setSelectedClient] = useState<string>(allClients[0] || '');
  const clientPendingSites = useMemo(() => {
    return pendingSites.filter(ps =>
      ps.clientName?.trim().toLowerCase() === selectedClient?.trim().toLowerCase() &&
      ps.status === 'Pending'
    );
  }, [pendingSites, selectedClient]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activitySubTab, setActivitySubTab] = useState<'history' | 'onboarding'>('history');
  const [sitesSubTab, setSitesSubTab] = useState<'portfolio' | 'onboarding'>('portfolio');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [taskSubTab, setTaskSubTab] = useState<'pending' | 'approval' | 'completed'>('pending');

  const handleSaveComm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commForm.notes.trim()) {
      toast.error('Please enter notes');
      return;
    }
    
    let resolvedSiteId: string | undefined = undefined;
    let resolvedSiteName: string | undefined = undefined;
    let isNewOnboarding = false;

    if (commForm.siteOption === 'NEW_ONBOARDING') {
      if (!commForm.newSiteName.trim()) {
        toast.error('Please enter the proposed site name');
        return;
      }
      resolvedSiteName = commForm.newSiteName.trim();
      isNewOnboarding = true;
    } else if (commForm.siteOption) {
      const existing = clientData?.clientSites.find((s: any) => s.id === commForm.siteOption);
      if (existing) {
        resolvedSiteId = existing.id;
        resolvedSiteName = existing.name;
      }
    }

    const commLogId = Math.random().toString(36).substr(2, 9);
    
    // Map custom UI channels to store union type ("Call" | "Email" | "WhatsApp" | "Meeting" | "SMS" | "Visit" | "Other")
    const mappedChannel = (() => {
      switch (commForm.channel) {
        case 'Phone': return 'Call';
        case 'In-Person': return 'Visit';
        case 'Official Letter': return 'Other';
        case 'Email': return 'Email';
        case 'WhatsApp': return 'WhatsApp';
        default: return 'Other';
      }
    })();

    // Save communication log
    addCommLog({
      id: commLogId,
      date: new Date().toISOString().split('T')[0],
      direction: commForm.direction,
      channel: mappedChannel,
      contactType: 'Client',
      client: selectedClient,
      siteId: resolvedSiteId,
      siteName: resolvedSiteName,
      contactPerson: commForm.contactPerson.trim() || undefined,
      subject: commForm.subject.trim() || undefined,
      notes: commForm.notes,
      outcome: commForm.outcome.trim() || undefined,
      followUpDate: commForm.followUpDate || undefined,
      followUpDone: false,
      loggedBy: activeUserName,
      createdAt: new Date().toISOString(),
      isInternal: false,
    });

    // If new site onboarding, automatically trigger it
    if (isNewOnboarding && resolvedSiteName) {
      const pendingSiteId = crypto.randomUUID();
      addPendingSite({
        id: pendingSiteId,
        clientName: selectedClient,
        siteName: resolvedSiteName,
        status: 'Pending',
        phase1: {
          isNewSite: true,
          isNewClient: false,
          whatIsBeingBuilt: '',
          excavationDepthMeters: '',
          siteLength: '',
          siteWidth: '',
          timelineStartDate: '',
          geotechnicalReportAvailable: false,
          hydrogeologicalDataAvailable: false,
          completed: false
        },
        phase2: {
          siteVisited: false,
          walkthroughCompleted: false,
          knownObstacles: '',
          dischargeLocation: '',
          dieselSupplyStrategy: '',
          completed: false
        },
        phase3: {
          dewateringMethods: [],
          totalWellpointsRequired: '',
          totalHeadersRequired: '',
          totalPumpsRequired: '',
          expectedDailyDieselUsage: '',
          completed: false
        },
        phase4: {
          quotationSent: false,
          clientFeedbackReceived: false,
          proposalAccepted: false,
          clientTaxStatus: '',
          scopeOfWorkSummary: '',
          scopeExclusionsSummary: '',
          timelineConfirmed: false,
          permittingResponsibilityOutlined: false,
          tinProvided: false,
          completed: false
        },
        phase5: {
          safetyPlanIntegrated: false,
          stage1AdvanceReceived: false,
          stage2InstallationComplete: false,
          stage2FirstInvoiceIssued: false,
          stage3TimelyBilling: false,
          stage4DemobilizationComplete: false,
          stage4FinalInvoiceIssued: false,
          actualEndDate: '',
          completed: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success(`Communication logged & onboarding initiated for site "${resolvedSiteName}"!`);
      // Automatically switch to the onboarding sub-tab to see the new card
      setActiveTab('operations');
      setSitesSubTab('onboarding');
    } else {
      toast.success('Communication logged successfully!');
    }

    if (commForm.createTask) {
      const initialTitle = commForm.subject.trim() || `Follow-up: ${commForm.channel} with ${selectedClient}`;
      
      const buildTaskDescriptionLocal = () => {
        const lines: string[] = [];
        const dir = commForm.direction === 'Incoming' ? 'Received' : 'Made';
        const date = new Date().toISOString().split('T')[0];
        const who = commForm.contactPerson ? ` with ${commForm.contactPerson}` : '';
        const via = commForm.channel;
        const clientPart = ` — ${selectedClient}`;
        const sitePart = resolvedSiteName ? ` / ${resolvedSiteName}` : '';

        lines.push(
          `${dir} a ${via} communication${clientPart}${sitePart}${who} on ${date}.`,
          '',
        );

        if (commForm.notes) {
          lines.push('📋 Notes:', commForm.notes, '');
        }
        if (commForm.outcome) {
          lines.push('✅ Outcome / Next Steps:', commForm.outcome, '');
        }
        if (commForm.followUpDate) {
          lines.push(`🔔 Follow-up scheduled: ${commForm.followUpDate}`);
        }

        return lines.join('\n').trim();
      };

      const matchedClient = clientProfiles.find(
        c => c.name.trim().toLowerCase() === selectedClient.trim().toLowerCase()
      );

      setTaskDialog({
        open: true,
        title: initialTitle,
        description: buildTaskDescriptionLocal(),
        clientId: matchedClient?.id || "",
        siteId: resolvedSiteId || "",
      });
    }

    setCommDialogOpen(false);
    // Reset form
    setCommForm({
      subject: '',
      notes: '',
      direction: 'Outgoing',
      channel: 'Email',
      siteOption: '',
      newSiteName: '',
      contactPerson: '',
      outcome: '',
      followUpDate: '',
      createTask: false,
    });
  };

  useEffect(() => {
    if (!commDialogOpen) {
      setIsManualContact(false);
    }
  }, [commDialogOpen]);

  const activeClientContacts = useMemo(() => {
    const clientStr = (selectedClient || '').trim().toLowerCase();
    const uniqueContacts = new Map<string, typeof clientContacts[0]>();
    clientContacts.forEach(c => {
      if (c.isActive && (c.clientName || '').trim().toLowerCase() === clientStr) {
        const lower = c.name.trim().toLowerCase();
        if (!uniqueContacts.has(lower)) {
          uniqueContacts.set(lower, c);
        }
      }
    });
    return Array.from(uniqueContacts.values());
  }, [clientContacts, selectedClient]);

  const hasAnyOptions = activeClientContacts.length > 0;
  const isKnownOption = (name: string) => activeClientContacts.some(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  const clientData = useMemo(() => {
    if (!selectedClient) return null;
    const clientNameLow = selectedClient.toLowerCase();

    const isWithinTimeFilter = (dateString?: string) => {
      if (!dateString) return false;
      if (filterMonth === 'all' && filterYear === 'all') return true;
      try {
        const normalized = normalizeDate(dateString);
        if (!normalized) return false;
        const d = parseISO(normalized);
        if (isNaN(d.getTime())) return false;
        
        const matchesYear = filterYear === 'all' || d.getFullYear().toString() === filterYear;
        const matchesMonth = filterMonth === 'all' || (d.getMonth() + 1).toString() === filterMonth;
        
        return matchesYear && matchesMonth;
      } catch (e) {
        return false;
      }
    };

    const isSiteActiveInFilter = (s: Site) => {
      if (filterMonth === 'all' && filterYear === 'all') return true;
      if (!s.startDate) return true;
      try {
        const start = parseISO(s.startDate);
        if (isNaN(start.getTime())) return true;

        if (filterYear !== 'all') {
          const filterY = parseInt(filterYear, 10);
          if (start.getFullYear() > filterY) return false; // started after filter year
          if (s.endDate) {
            const end = parseISO(s.endDate);
            if (!isNaN(end.getTime()) && end.getFullYear() < filterY) return false; // ended before filter year
          }
        }

        if (filterMonth !== 'all' && filterYear !== 'all') {
          const filterY = parseInt(filterYear, 10);
          const filterM = parseInt(filterMonth, 10);
          const filterDateStart = new Date(filterY, filterM - 1, 1);
          const filterDateEnd = new Date(filterY, filterM, 0, 23, 59, 59);

          if (start > filterDateEnd) return false; // started after filter month ended
          if (s.endDate) {
            const end = parseISO(s.endDate);
            if (!isNaN(end.getTime()) && end < filterDateStart) return false; // ended before filter month started
          }
        }

        return true;
      } catch {
        return true;
      }
    };

    const clientSites = sites.filter(s => s.client.trim() === selectedClient && isSiteActiveInFilter(s));
    const activeSites = clientSites.filter(s => s.status === 'Active');

    // Financial calculations
    const clientPayments = payments.filter(p => p.client?.trim() === selectedClient && isWithinTimeFilter(p.date));
    const paymentsCleared = clientPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    const clientInvoicesFiltered = invoices.filter(i => i.client?.trim() === selectedClient && isWithinTimeFilter(i.date));
    const totalRevenue = clientInvoicesFiltered.reduce((acc, i) => acc + (i.totalCharge || i.amount || 0), 0);

    const totalVatGenerated = clientInvoicesFiltered.reduce((acc, i) => {
      if (i.vat !== undefined) return acc + i.vat;
      const baseAmount = (i.totalCost || i.amount || 0) - (i.damages || 0);
      const vatInc = i.vatInc || 'No';
      let vat = 0;
      if (vatInc === 'Yes') {
        vat = (baseAmount / (100 + vatRate)) * vatRate;
      } else if (vatInc === 'Add') {
        vat = baseAmount * (vatRate / 100);
      }
      return acc + Math.round(vat * 100) / 100;
    }, 0);

    const clientVatPayments = vatPayments.filter(vp => vp.client?.trim() === selectedClient && isWithinTimeFilter(vp.date));
    const totalVatPaid = clientVatPayments.reduce((acc, vp) => acc + (vp.amount || 0), 0);
    const vatDeficit = totalVatGenerated - totalVatPaid;
    
    // Capture the months the VAT payments cover
    const vatMonthsIncluded = Array.from(new Set(clientVatPayments.map(vp => `${vp.month} ${vp.year}`)));

    // Detailed payment and VAT registry mapping
    const vatDueByMonthYear: Record<string, number> = {};
    const vatPaymentsByMonthYear: Record<string, number> = {};

    // 1. Calculate VAT due for each month-year from ALL client payments
    const allClientPayments = payments.filter(p => p.client?.trim() === selectedClient);
    allClientPayments.forEach(p => {
      const normalized = normalizeDate(p.date);
      if (!normalized) return;
      const d = parseISO(normalized);
      if (isNaN(d.getTime())) return;
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      const yearStr = d.getFullYear().toString();
      const key = `${monthName.toLowerCase()}-${yearStr}`;

      let vatAmount = p.vat || 0;
      if (!vatAmount && p.payVat && p.payVat !== 'No') {
        const base = (p.amount || 0) - (p.damages || 0);
        if (p.payVat === 'Add') {
          vatAmount = base * (vatRate / 100);
        } else if (p.payVat === 'Yes') {
          vatAmount = (base / (100 + vatRate)) * vatRate;
        }
      }
      vatDueByMonthYear[key] = (vatDueByMonthYear[key] || 0) + vatAmount;
    });

    // 2. Calculate VAT paid for each month-year from ALL client VAT payments
    const allClientVatPayments = vatPayments.filter(vp => vp.client?.trim() === selectedClient);
    allClientVatPayments.forEach(vp => {
      if (!vp.month || !vp.year) return;
      const key = `${vp.month.trim().toLowerCase()}-${vp.year.trim()}`;
      vatPaymentsByMonthYear[key] = (vatPaymentsByMonthYear[key] || 0) + (vp.amount || 0);
    });

    // 3. Map filtered clientPayments with their individual VAT details and the monthly status
    const paymentsWithVatStatus = clientPayments.map(p => {
      const normalized = normalizeDate(p.date);
      let monthName = 'Unknown';
      let yearStr = 'Unknown';
      let key = '';
      if (normalized) {
        const d = parseISO(normalized);
        if (!isNaN(d.getTime())) {
          monthName = d.toLocaleString('en-US', { month: 'long' });
          yearStr = d.getFullYear().toString();
          key = `${monthName.toLowerCase()}-${yearStr}`;
        }
      }

      let vatAmount = p.vat || 0;
      if (!vatAmount && p.payVat && p.payVat !== 'No') {
        const base = (p.amount || 0) - (p.damages || 0);
        if (p.payVat === 'Add') {
          vatAmount = base * (vatRate / 100);
        } else if (p.payVat === 'Yes') {
          vatAmount = (base / (100 + vatRate)) * vatRate;
        }
      }

      const totalDueForMonth = key ? (vatDueByMonthYear[key] || 0) : 0;
      const totalPaidForMonth = key ? (vatPaymentsByMonthYear[key] || 0) : 0;

      let settlementStatus: 'Fully Settled' | 'Partially Settled' | 'Unsettled' = 'Unsettled';
      if (totalPaidForMonth >= totalDueForMonth && totalDueForMonth > 0) {
        settlementStatus = 'Fully Settled';
      } else if (totalPaidForMonth > 0) {
        settlementStatus = 'Partially Settled';
      }

      return {
        ...p,
        vatAmount,
        monthName,
        yearStr,
        key,
        totalDueForMonth,
        totalPaidForMonth,
        settlementStatus
      };
    });

    const clientCosts = ledgerEntries.filter(l => l.client?.trim() === selectedClient && isWithinTimeFilter(l.date));
    const totalCost = clientCosts.reduce((acc, l) => acc + (l.amount || 0), 0);

    const clientId = clientProfiles.find(c => c.name.trim() === selectedClient)?.id;
    const clientSiteIds = new Set(clientSites.map(s => s.id));
    const clientTasks = mainTasks.filter(t => {
      if (t.title?.toLowerCase().includes(clientNameLow)) return true;
      if (t.description && t.description.toLowerCase().includes(clientNameLow)) return true;
      if (clientId && t.clientId === clientId) return true;
      if (t.siteId && clientSiteIds.has(t.siteId)) return true;

      const tSubs = subtasks.filter(s => s.mainTaskId === t.id);
      if (tSubs.some(s => 
        (s.title?.toLowerCase().includes(clientNameLow)) || 
        (s.description?.toLowerCase().includes(clientNameLow)) ||
        (s.siteId && clientSiteIds.has(s.siteId)) ||
        (clientId && s.clientId === clientId)
      )) return true;

      return false;
    });
    const pendingTasks = clientTasks.filter(t => {
      const status = deriveMainTaskStatus(t.id, subtasks);
      return (status === 'not_started' || status === 'in_progress') && !t.isDeleted && isWithinTimeFilter(t.deadline || t.createdAt);
    });
    const approvalTasks = clientTasks.filter(t => {
      const status = deriveMainTaskStatus(t.id, subtasks);
      return status === 'pending_approval' && !t.isDeleted && isWithinTimeFilter(t.deadline || t.createdAt);
    });
    const completedTasks = clientTasks.filter(t => {
      const status = deriveMainTaskStatus(t.id, subtasks);
      return status === 'completed' && !t.isDeleted && isWithinTimeFilter(t.deadline || t.createdAt);
    });

    const contacts = clientContacts.filter(c => c.clientName?.trim() === selectedClient && isWithinTimeFilter(c.createdAt));
    const logs = commLogs.filter(c => c.client?.trim() === selectedClient && isWithinTimeFilter(c.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Find deployed staff
    const clientAttendance = attendanceRecords.filter(a => isWithinTimeFilter(a.date) && (a.dayClient?.trim() === selectedClient || a.nightClient?.trim() === selectedClient));
    const uniqueStaffIds = new Set(clientAttendance.map(a => a.staffId));
    
    // Machine Logs & Deployed Machines
    const siteIds = new Set(clientSites.map(s => s.id));
    const siteNames = new Set(clientSites.map(s => s.name));
    const clientMachineLogs = dailyMachineLogs.filter(l => siteIds.has(l.siteId) && isWithinTimeFilter(l.date));
    
    const deployedMachines = assets.filter(a => 
      a.type === 'equipment' && a.status === 'active' && a.location && siteNames.has(a.location)
    );

    const clientWaybills = waybills.filter(w => siteIds.has(w.siteId) && isWithinTimeFilter(w.issueDate));

    // Health Score & Alerts Calculation
    let healthScore = 100;
    const alerts: { title: string; type: 'danger' | 'warning' | 'info' }[] = [];

    // Financial Health
    if (vatDeficit > 50000) { healthScore -= 15; alerts.push({ title: `High VAT Deficit: ₦${vatDeficit.toLocaleString()}`, type: 'danger' }); }
    else if (vatDeficit > 0) { healthScore -= 5; alerts.push({ title: `Pending VAT: ₦${vatDeficit.toLocaleString()}`, type: 'warning' }); }

    const outstandingBalance = totalRevenue - paymentsCleared;
    if (outstandingBalance > 0) {
      healthScore -= 10;
      alerts.push({ title: `Unpaid Balance: ₦${outstandingBalance.toLocaleString()}`, type: 'warning' });
    }

    // Operational Health
    if (clientSites.length > 0 && activeSites.length === 0) {
      healthScore -= 20;
      alerts.push({ title: `No active sites currently operating`, type: 'danger' });
    }

    // Workflow Health
    if (pendingTasks.length > 5) {
      healthScore -= 10;
      alerts.push({ title: `High volume of pending tasks (${pendingTasks.length})`, type: 'warning' });
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      clientSites, activeSites: activeSites.length, totalSites: clientSites.length,
      clientInvoices: invoices.filter(i => i.client?.trim() === selectedClient),
      vatDeficit, paymentsCleared, totalRevenue, totalCost, profit: totalRevenue - totalCost,
      paymentsWithVatStatus,
      pendingTasks, completedTasks, approvalTasks, contacts, logs, 
      deployedStaffCount: uniqueStaffIds.size,
      machineLogs: clientMachineLogs,
      activeMachinesCount: deployedMachines.length,
      deployedMachines,
      waybills: clientWaybills,
      healthScore,
      alerts,
      vatMonthsIncluded
    };
  }, [selectedClient, filterMonth, filterYear, sites, invoices, payments, vatPayments, ledgerEntries, mainTasks, clientContacts, commLogs, attendanceRecords, dailyMachineLogs, assets, waybills]);

  // AI Chat State
  const [messages, setMessages] = useState<{role: 'user' | 'assistant' | 'system', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChatMessage = async (isInitialBrief = false) => {
    if (!clientData || !selectedClient) return;
    if (!isInitialBrief && !chatInput.trim()) return;

    let apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY');
    if (!apiKey) {
      apiKey = window.prompt('Please enter your Groq API Key for the Intelligence Assistant:');
      if (!apiKey) return;
      localStorage.setItem('GROQ_API_KEY', apiKey);
    }

    const newUserMessage = isInitialBrief ? "Please provide an initial 3-sentence Intelligence Brief for this client." : chatInput;
    if (!isInitialBrief) {
      setMessages(prev => [...prev, { role: 'user', content: newUserMessage }]);
      setChatInput('');
    }
    
    setIsGeneratingBrief(true);

    try {
      const invoiceContext = clientData.clientInvoices.map(i => `Invoice ${i.invoiceNumber}: ₦${i.totalCharge}, Status: ${i.status}, Date: ${i.date}`).join(' | ');
      const machineContext = clientData.machineLogs.slice(0, 10).map(m => `${m.assetName} on ${m.date}: ${m.dieselUsage}L used, Issues: ${m.issuesOnSite || 'None'}`).join(' | ');
      const commContext = clientData.logs.slice(0, 5).map(l => `[${l.date}] ${l.channel} - ${l.notes}`).join(' | ');
      const waybillContext = clientData.waybills.slice(0, 5).map(w => `${w.type} Waybill ${w.id.substring(0,6)}: ${w.items.map(i => `${i.quantity}x ${i.assetName}`).join(', ')} (${w.status})`).join(' | ');
      const deployedMachinesList = clientData.deployedMachines.map(m => m.name).join(', ');
      
      const systemPrompt = `You are a Client 360 Decision Intelligence Assistant for DCEL.
Your goal is to answer questions strictly based on the following context for client: ${selectedClient}.
Context:
- Active Sites: ${clientData.activeSites} out of ${clientData.totalSites}
- Total Active Machines on Site: ${clientData.activeMachinesCount} ${deployedMachinesList ? `(${deployedMachinesList})` : ''}
- VAT Deficit: ₦${clientData.vatDeficit}
- Total Revenue Paid: ₦${clientData.paymentsCleared}
- Profit Margin: ₦${clientData.profit}
- Pending Workflow Tasks: ${clientData.pendingTasks.length}
- Unique Staff Deployed in this period: ${clientData.deployedStaffCount}
- Recent Invoices: ${invoiceContext || 'None'}
- Recent Machine Logs: ${machineContext || 'None'}
- Recent Communications/Comments: ${commContext || 'None'}
- Recent Waybills/Materials: ${waybillContext || 'None'}

When asked to provide the initial intelligence brief, give a 3-sentence summary highlighting operational health, financial risk (VAT and Invoices), and workflow bottlenecks.
Be extremely concise. If the user asks about invoices, machines, staff, materials, or comments, refer to the context provided.`;

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system'),
        { role: 'user', content: newUserMessage }
      ];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: apiMessages,
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      if (isInitialBrief) {
        setMessages([{ role: 'assistant', content: data.choices[0].message.content }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }]);
      }
    } catch (err) {
      console.error(err);
      if (!isInitialBrief) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to reach Groq API. Check your network or API key.' }]);
      }
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  useEffect(() => {
    setMessages([]);
  }, [selectedClient, filterMonth, filterYear]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  const headerActions = (
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
      {/* Filters Dropdown */}
      {clientData && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={cn(
              "h-9 px-3 gap-2 border shadow-sm font-medium text-xs rounded-lg transition-colors w-full md:w-auto justify-between md:justify-center",
              isDark ? "bg-slate-900 border-slate-700 text-white hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
              (filterMonth !== 'all' || filterYear !== 'all') && "border-indigo-500 text-indigo-600 dark:text-indigo-400"
            )}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </div>
            {(filterMonth !== 'all' || filterYear !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            )}
          </Button>

          {showFilterMenu && (
            <div className={cn(
              "absolute right-0 top-full mt-2 w-64 p-4 rounded-2xl border shadow-xl z-50 space-y-3 animate-in fade-in-50 zoom-in-95 duration-200",
              isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter By Period</span>
                {(filterMonth !== 'all' || filterYear !== 'all') && (
                  <button 
                    onClick={() => { setFilterMonth('all'); setFilterYear('all'); }} 
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Month</label>
                <div className={cn("flex items-center px-2 py-1.5 rounded-lg border shadow-sm transition-colors", 
                  isDark ? "bg-slate-800 border-slate-700 focus-within:border-indigo-500" : "bg-slate-50 border-slate-200 focus-within:border-indigo-300"
                )}>
                  <div className="relative w-full">
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className={cn(
                        "appearance-none bg-transparent font-medium text-xs pr-6 focus:outline-none cursor-pointer w-full",
                        isDark ? "text-white" : "text-slate-900"
                      )}
                    >
                      <option value="all">All Months</option>
                      {months.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Year</label>
                <div className={cn("flex items-center px-2 py-1.5 rounded-lg border shadow-sm transition-colors", 
                  isDark ? "bg-slate-800 border-slate-700 focus-within:border-indigo-500" : "bg-slate-50 border-slate-200 focus-within:border-indigo-300"
                )}>
                  <div className="relative w-full">
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className={cn(
                        "appearance-none bg-transparent font-medium text-xs pr-6 focus:outline-none cursor-pointer w-full",
                        isDark ? "text-white" : "text-slate-900"
                      )}
                    >
                      <option value="all">All Years</option>
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
              </div>

              <Button 
                size="sm" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 mt-2" 
                onClick={() => setShowFilterMenu(false)}
              >
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Client Selector */}
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-colors", 
        isDark ? "bg-slate-900 border-slate-700 hover:border-indigo-500" : "bg-white border-slate-200 hover:border-indigo-300"
      )}>
        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="relative w-full md:w-auto">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className={cn(
              "appearance-none bg-transparent font-bold text-sm pr-6 focus:outline-none cursor-pointer w-full md:w-auto",
              isDark ? "text-white" : "text-slate-900"
            )}
          >
            {allClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>
      </div>
    </div>
  );

  useSetPageTitle(
    selectedSite ? null : 'Client 360 Dashboard', 
    selectedSite ? '' : 'Unified view of financial, operational, and relationship health', 
    selectedSite ? null : headerActions, 
    [selectedClient, filterMonth, filterYear, clientData, allClients, isDark, selectedSite, showFilterMenu]
  );

  if (allClients.length === 0) {
    return (
      <div className="flex h-full min-h-0 overflow-hidden items-center justify-center p-8">
         <div className="text-center">
           <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-slate-700">No Clients Found</h2>
           <p className="text-sm text-slate-500">Create sites and assign them to clients to populate this dashboard.</p>
         </div>
      </div>
    );
  }

  // â”€â”€ Handlers for edit dialogs â”€â”€
  const openClientEdit = () => {
    const profile = clientProfiles.find(p => p.name.trim() === selectedClient);
    setClientEditForm(profile ? { ...profile } : { name: selectedClient });
    setClientEditOpen(true);
  };

  const saveClientEdit = () => {
    const profile = clientProfiles.find(p => p.name.trim() === selectedClient);
    if (profile && clientEditForm.id) {
      updateClientProfile(profile.id, clientEditForm);
    } else {
      const newProfile: ClientProfile = {
        id: crypto.randomUUID(),
        name: selectedClient,
        tinNumber: clientEditForm.tinNumber,
        address: clientEditForm.address,
        mainContactPerson: clientEditForm.mainContactPerson,
        contactPhone: clientEditForm.contactPhone,
        startDate: clientEditForm.startDate || new Date().toISOString().split('T')[0],
      };
      addClientProfile(newProfile);
    }
    setClientEditOpen(false);
  };

  const openSiteEdit = (site: Site) => {
    setSiteEditForm({ ...site });
    setSiteEditTarget(site);
  };

  const saveSiteEdit = () => {
    if (siteEditTarget) {
      updateSite(siteEditTarget.id, siteEditForm);
      // Also update selectedSite if it's open
      if (selectedSite?.id === siteEditTarget.id) {
        setSelectedSite({ ...siteEditTarget, ...siteEditForm } as Site);
      }
    }
    setSiteEditTarget(null);
    setSiteEditForm({});
  };

  return (
    <>
      {selectedSite ? (
        <Site360View
          site={selectedSite}
          clientSites={clientData?.clientSites || [selectedSite]}
          onSiteChange={setSelectedSite}
          onBack={() => setSelectedSite(null)}
          onEditSite={openSiteEdit}
        />
      ) : (
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 style-scroll">
            {clientData ? (
<div>Mocked Client Content</div>

















































































































































































































































































































































































































































































































































































































































































































































































































































































































) : null}
        </div>
      </div>
    )}


      {/* Client Edit Dialog */}
      {clientEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClientEditOpen(false)} />
          <div className={cn('relative z-10 w-full max-w-md rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200')}>
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><Edit2 className="w-5 h-5 text-indigo-600" /> Edit Client</h2>
              <Button variant="ghost" size="icon" onClick={() => setClientEditOpen(false)} className="h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 style-scroll mb-4">
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Client Name</label><input value={clientEditForm.name || ''} readOnly disabled className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">TIN Number</label><input value={clientEditForm.tinNumber || ''} readOnly disabled placeholder="Optional" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Address</label><textarea value={clientEditForm.address || ''} onChange={e => setClientEditForm(f => ({ ...f, address: e.target.value }))} rows={2} placeholder="e.g. 5 Marina Road, Lagos Island" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Main Contact Person</label><input value={clientEditForm.mainContactPerson || ''} onChange={e => setClientEditForm(f => ({ ...f, mainContactPerson: e.target.value }))} placeholder="e.g. John Doe" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Phone Number</label><input value={clientEditForm.contactPhone || ''} onChange={e => setClientEditForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="e.g. +234 801 234 5678" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Start Date</label><input type="date" value={clientEditForm.startDate || ''} readOnly disabled className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} /></div>
            </div>
            <div className="flex gap-3 shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setClientEditOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={saveClientEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Site Edit Dialog */}
      {siteEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSiteEditTarget(null)} />
          <div className={cn('relative z-10 w-full max-w-md rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200')}>
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><Edit2 className="w-5 h-5 text-indigo-600" /> Edit Site</h2>
              <Button variant="ghost" size="icon" onClick={() => setSiteEditTarget(null)} className="h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 style-scroll mb-4">
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Address</label><textarea value={siteEditForm.address || ''} onChange={e => setSiteEditForm(f => ({ ...f, address: e.target.value }))} rows={2} placeholder="e.g. 5 Marina Road, Lagos Island" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Main Contact Person</label><input value={siteEditForm.mainContactPerson || ''} onChange={e => setSiteEditForm(f => ({ ...f, mainContactPerson: e.target.value }))} placeholder="e.g. John Doe" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Phone Number</label><input value={siteEditForm.contactPhone || ''} onChange={e => setSiteEditForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="e.g. +234 801 234 5678" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
              <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Position</label><input value={siteEditForm.position || ''} onChange={e => setSiteEditForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Site Manager" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} /></div>
            </div>
            <div className="flex gap-3 shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setSiteEditTarget(null)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={saveSiteEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Log Communication Dialog */}
      {commDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCommDialogOpen(false)} />
          <div className={cn('relative z-10 w-full max-w-lg rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[92vh] flex flex-col', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200')}>
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-indigo-600" /> Log Communication</h2>
              <Button variant="ghost" size="icon" onClick={() => setCommDialogOpen(false)} className="h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            
            <form onSubmit={handleSaveComm} className="space-y-4 overflow-y-auto pr-1 flex-1 style-scroll mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Direction *</label>
                  <select 
                    value={commForm.direction} 
                    onChange={e => setCommForm(f => ({ ...f, direction: e.target.value as any }))}
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                  >
                    <option value="Incoming">📥 Incoming</option>
                    <option value="Outgoing">📤 Outgoing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Channel *</label>
                  <select 
                    value={commForm.channel} 
                    onChange={e => setCommForm(f => ({ ...f, channel: e.target.value as any }))}
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                  >
                    <option value="Phone">📞 Phone Call</option>
                    <option value="WhatsApp">💬 WhatsApp</option>
                    <option value="Email">✉️ Email</option>
                    <option value="In-Person">👥 In-Person Visit</option>
                    <option value="Official Letter">✉️ Official Letter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Linked To *</label>
                  <select 
                    disabled
                    value="Existing Client" 
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-75', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-600')}
                  >
                    <option value="Existing Client">🏢 Existing Client</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Client *</label>
                  <select 
                    disabled
                    value={selectedClient} 
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-75', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-600')}
                  >
                    <option value={selectedClient}>{selectedClient}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Site Name — select existing or type a new one *</label>
                <select 
                  value={commForm.siteOption} 
                  onChange={e => setCommForm(f => ({ ...f, siteOption: e.target.value }))}
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                >
                  <option value="">Select site...</option>
                  <option value="NEW_ONBOARDING">+ Create new site onboarding...</option>
                  {clientData?.clientSites?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {commForm.siteOption === 'NEW_ONBOARDING' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-250">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">Proposed Site Name *</label>
                  <input 
                    type="text" 
                    value={commForm.newSiteName} 
                    onChange={e => setCommForm(f => ({ ...f, newSiteName: e.target.value }))}
                    placeholder="e.g. Warri Refinery Site B"
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500', isDark ? 'bg-slate-800 border-amber-900/40 text-white' : 'bg-white border-amber-200')}
                  />
                  <p className="text-[10px] text-amber-500/80 font-semibold leading-normal">
                    This will automatically create a pending site onboarding record for {selectedClient} inside the Onboarding Progress tab!
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Subject</label>
                <input 
                  type="text" 
                  value={commForm.subject} 
                  onChange={e => setCommForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Onboarding kickoff, Site update"
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Notes / Description *</label>
                <textarea 
                  value={commForm.notes} 
                  onChange={e => setCommForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} 
                  required
                  placeholder="Details of the conversation..."
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Person</label>
                  {!hasAnyOptions ? (
                    <input 
                      type="text" 
                      value={commForm.contactPerson} 
                      onChange={e => setCommForm(f => ({ ...f, contactPerson: e.target.value }))}
                      placeholder="e.g. Mr. Adeyemi, Site Manager"
                      className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                    />
                  ) : !isManualContact ? (
                    <select
                      value={isKnownOption(commForm.contactPerson) ? (activeClientContacts.find(c => c.name.trim().toLowerCase() === (commForm.contactPerson || '').trim().toLowerCase())?.name || commForm.contactPerson) : (commForm.contactPerson ? '__CUSTOM__' : '')}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__ADD_NEW__') {
                          setIsManualContact(true);
                          setCommForm(f => ({ ...f, contactPerson: '' }));
                        } else if (val === '__CUSTOM__') {
                          // Do nothing
                        } else {
                          setCommForm(f => ({ ...f, contactPerson: val }));
                        }
                      }}
                      className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                    >
                      <option value="">Select contact...</option>
                      {activeClientContacts.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name} {c.position ? `— ${c.position}` : ''}
                        </option>
                      ))}
                      <option value="__ADD_NEW__">+ Type a new contact...</option>
                      {commForm.contactPerson && !isKnownOption(commForm.contactPerson) && (
                        <option value="__CUSTOM__">Custom: {commForm.contactPerson}</option>
                      )}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        autoFocus
                        value={commForm.contactPerson} 
                        onChange={e => setCommForm(f => ({ ...f, contactPerson: e.target.value }))}
                        placeholder="Type contact name..."
                        className={cn('flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                      />
                      <Button 
                        type="button"
                        variant="ghost" 
                        className="h-9 px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        onClick={() => {
                          setIsManualContact(false);
                          setCommForm(f => ({ ...f, contactPerson: '' }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Outcome</label>
                  <input 
                    type="text" 
                    value={commForm.outcome} 
                    onChange={e => setCommForm(f => ({ ...f, outcome: e.target.value }))}
                    placeholder="e.g. Move to site next week"
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Follow-Up Date</label>
                <input 
                  type="date" 
                  value={commForm.followUpDate} 
                  onChange={e => setCommForm(f => ({ ...f, followUpDate: e.target.value }))}
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}
                />
              </div>

              {/* Create Task checkbox */}
              <label className={cn(
                'flex items-center gap-2.5 text-sm cursor-pointer select-none px-3 py-2.5 rounded-xl border transition-colors',
                commForm.createTask
                  ? (isDark ? 'bg-indigo-950/40 border-indigo-700/80 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700')
                  : (isDark ? 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-900/50' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50/50')
              )}>
                <input
                  type="checkbox"
                  checked={commForm.createTask}
                  onChange={e => setCommForm(f => ({ ...f, createTask: e.target.checked }))}
                  className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">Create a task from this communication log</span>
                {commForm.createTask && (
                  <span className={cn('text-xs ml-1 font-medium', isDark ? 'text-indigo-400' : 'text-indigo-500')}>
                    — task dialog opens after saving
                  </span>
                )}
              </label>

              <div className="flex gap-3 shrink-0 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setCommDialogOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Save Log</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
      {showContactsPanel && (
        <ClientContactsPanel
          clientName={selectedClient}
          onClose={() => setShowContactsPanel(false)}
        />
      )}
      {taskDialog.open && (
        <CreateTaskDialog
          onClose={() => setTaskDialog(d => ({ ...d, open: false }))}
          users={users}
          currentUserId={currentUser?.id ?? ""}
          teamId="dcel-team"
          workspaceId="dcel-team"
          initialTitle={taskDialog.title}
          initialDescription={taskDialog.description}
          initialClientId={taskDialog.clientId}
          initialSiteId={taskDialog.siteId}
        />
      )}
    </>
  );
}
