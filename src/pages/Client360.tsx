import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Building2, MapPin, AlertTriangle, FileText, CheckCircle2, Clock, 
  Calendar, Sparkles, ChevronDown, ChevronUp, Users, Phone, DollarSign,
  Activity, Briefcase, MessagesSquare, RefreshCcw, Filter, Send,
  ShieldAlert, ShieldCheck, Settings2, X, Edit2, ChevronRight, CheckSquare,
  Plus, Trash2, Circle, Eye, Search, Receipt, BookOpen, MessageSquare, Pencil, MoreVertical
} from 'lucide-react';
import { toast, showConfirm } from '@/src/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
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
import { GlobalSearch } from '@/src/components/common/GlobalSearch';
import { ClientContactsPanel } from './ClientContactsPanel';
import { CreateTaskDialog } from './Tasks/CreateTaskDialog';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';

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
  const deleteSite = useAppStore(s => s.deleteSite);
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
  const [siteEditTarget, setSiteEditTarget] = useState<Site | null>(null);
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

  // ── Permission checks & narrative state ──
  const sitePriv = currentUser?.privileges?.sites;
  const canEditSite   = !currentUser || (sitePriv?.canView === true && sitePriv?.canEditSite === true);
  const canDeleteSite = !currentUser || (sitePriv?.canView === true && sitePriv?.canDeleteSite === true);
  const canViewComm   = !currentUser || currentUser?.privileges?.commLog?.canView === true;

  const [narrativeSite, setNarrativeSite] = useState<{ site: Site; q: any | null } | null>(null);

  const handleDeleteSite = async (id: string) => {
    const ok = await showConfirm('Delete this site?', { variant: 'danger', confirmLabel: 'Delete' });
    if (ok) { 
      deleteSite(id); 
      toast.success('Site deleted.'); 
    }
  };

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

  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedClient, setRawSelectedClient] = useState<string>(() => {
    const queryClient = new URLSearchParams(window.location.search).get('client');
    return queryClient || '';
  });

  const [activeTab, setRawActiveTab] = useState<TabType>(() => {
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    return (queryTab as TabType) || 'overview';
  });

  const setSelectedClient = (clientName: string | ((prev: string) => string)) => {
    const nextClient = typeof clientName === 'function' ? clientName(selectedClient) : clientName;
    setRawSelectedClient(nextClient);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('client', nextClient);
      return next;
    });
  };

  const setActiveTab = (tabId: TabType | ((prev: TabType) => TabType)) => {
    const nextTab = typeof tabId === 'function' ? tabId(activeTab) : tabId;
    setRawActiveTab(nextTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextTab);
      return next;
    });
  };

  useEffect(() => {
    const queryClient = searchParams.get('client');
    const queryTab = searchParams.get('tab');

    if (queryClient && allClients.includes(queryClient) && queryClient !== selectedClient) {
      setRawSelectedClient(queryClient);
    } else if (!queryClient && allClients.length > 0 && !selectedClient) {
      const defaultClient = allClients[0];
      setRawSelectedClient(defaultClient);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('client', defaultClient);
        return next;
      });
    }

    if (queryTab && queryTab !== activeTab) {
      setRawActiveTab(queryTab as TabType);
    } else if (!queryTab && activeTab) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', activeTab);
        return next;
      });
    }
  }, [allClients, searchParams, setSearchParams, selectedClient, activeTab]);

  const clientPendingSites = useMemo(() => {
    return pendingSites.filter(ps =>
      ps.clientName?.trim().toLowerCase() === selectedClient?.trim().toLowerCase() &&
      ps.status === 'Pending'
    );
  }, [pendingSites, selectedClient]);

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
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<any>(null);
  const [financialsSubTab, setFinancialsSubTab] = useState<'invoices' | 'payments'>('invoices');
  const [hideFullySettled, setHideFullySettled] = useState(false);
  const [showOnlyUnpaidInvoices, setShowOnlyUnpaidInvoices] = useState(false);
  const [invoiceSort, setInvoiceSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  // ── Global Header Search Navigation Handler ──────────────────────────────
  const handleSearchNavigation = (result: any) => {
    let targetClient = selectedClient;
    // Find matching client case-insensitively to prevent mismatches
    if (result.clientName) {
      const trimmedClientName = result.clientName.trim().toLowerCase();
      const matchedClient = allClients.find(c => c.trim().toLowerCase() === trimmedClientName);
      if (matchedClient) {
        targetClient = matchedClient;
      }
    }
    
    // Update local state and URL parameters in a single batch to avoid race conditions
    setRawSelectedClient(targetClient);
    setRawActiveTab(result.tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('client', targetClient);
      next.set('tab', result.tab);
      return next;
    });
    
    if (result.type === 'site' && result.rawSite) {
      setSelectedSite(result.rawSite);
    } else {
      setSelectedSite(null);
      if (result.type === 'subtask' && result.subtaskId) {
        setOpenSubtaskId(result.subtaskId);
      } else if (result.type === 'task') {
        setExpandedTasks(prev => {
          const next = new Set(prev);
          next.add(result.id);
          return next;
        });
      } else if (result.type === 'comm_log' && result.commLogId) {
        setExpandedLogs(prev => {
          const next = new Set(prev);
          next.add(result.commLogId);
          return next;
        });
      }
    }

    if (result.type === 'vat' || result.type === 'vat_payment') {
      setTimeout(() => {
        const card = document.getElementById('vat-deficit-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('ring-2', 'ring-indigo-600', 'ring-offset-2', 'dark:ring-offset-slate-900');
          setTimeout(() => {
            card.classList.remove('ring-2', 'ring-indigo-600', 'ring-offset-2', 'dark:ring-offset-slate-900');
          }, 3000);
        }
      }, 200);
    }
    
    toast.success(`Navigated to ${result.type}: ${result.title}`);
  };


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

    const contacts = clientContacts.filter(c => c.clientName?.trim().toLowerCase() === selectedClient?.trim().toLowerCase());
    const logs = commLogs.filter(c => c.client?.trim().toLowerCase() === selectedClient?.trim().toLowerCase() && isWithinTimeFilter(c.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
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

    const allClientPaymentsForCheck = payments.filter(p => p.client?.trim() === selectedClient);

    const rawClientInvoices = invoices.filter(i => i.client?.trim() === selectedClient);
    const latestInvoicesBySite = new Map();
    rawClientInvoices.forEach(inv => {
      const siteIdKey = inv.siteId || inv.siteName || 'unknown';
      const existing = latestInvoicesBySite.get(siteIdKey);
      if (!existing) {
        latestInvoicesBySite.set(siteIdKey, inv);
      } else {
        const invDate = inv.date ? new Date(normalizeDate(inv.date)).getTime() : 0;
        const existingMapDate = existing.date ? new Date(normalizeDate(existing.date)).getTime() : 0;
        if (invDate > existingMapDate) {
          latestInvoicesBySite.set(siteIdKey, inv);
        }
      }
    });

    const clientInvoices = rawClientInvoices.map(inv => {
      const site = clientSites.find(s => s.id === inv.siteId || s.name === inv.siteName);
      let nextBillingDate = null;
      let siteStatus = site?.status || 'Ended'; 
      if (siteStatus !== 'Ended' && (inv.dueDate || inv.date)) {
        const d = new Date(normalizeDate(inv.dueDate || inv.date));
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + 1);
          nextBillingDate = d.toISOString().split('T')[0];
        }
      }

      let intelligentStatus = inv.status;
      if (intelligentStatus !== 'Paid') {
        const invAmount = inv.totalCharge || inv.amount || 0;
        const invDateNum = inv.date ? new Date(normalizeDate(inv.date)).getTime() : 0;
        
        // Find if there's a payment on the same site with a similar amount made around or after the invoice date
        const matchingPayment = allClientPaymentsForCheck.find(p => {
          const siteMatch = (p.site?.trim() === inv.siteName?.trim() || p.site === inv.siteId);
          const diff = Math.abs((p.amount || 0) - invAmount);
          const isSimilarAmount = invAmount > 0 && (diff / invAmount) <= 0.05; // Within 5% tolerance for Withholding Tax/deductions
          const pDateNum = p.date ? new Date(normalizeDate(p.date)).getTime() : 0;
          const isDateValid = pDateNum >= (invDateNum - (7 * 24 * 60 * 60 * 1000)); // Payment made no more than 7 days prior, or after
          
          return siteMatch && isSimilarAmount && isDateValid;
        });

        if (matchingPayment) {
          intelligentStatus = 'Paid';
        }
      }

      return { ...inv, nextBillingDate, siteStatus, status: intelligentStatus };
    }).sort((a, b) => {
      const dateA = a.date ? new Date(normalizeDate(a.date)).getTime() : 0;
      const dateB = b.date ? new Date(normalizeDate(b.date)).getTime() : 0;
      return dateB - dateA;
    });

    return {
      clientSites, activeSites: activeSites.length, totalSites: clientSites.length,
      clientInvoices,
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      {/* Search Input and Dropdown */}
      <GlobalSearch 
        isDark={isDark} 
        allClients={allClients} 
        onSelectResult={handleSearchNavigation} 
      />

      {/* Filters Dropdown */}
      {clientData && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={cn(
              "h-9 w-9 p-0 flex items-center justify-center border shadow-sm rounded-lg transition-colors",
              isDark ? "bg-slate-900 border-slate-700 text-white hover:bg-slate-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
              (filterMonth !== 'all' || filterYear !== 'all') && "border-indigo-500 text-indigo-650 dark:text-indigo-400"
            )}
            title="Filter by period"
          >
            <div className="relative flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
              {(filterMonth !== 'all' || filterYear !== 'all') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              )}
            </div>
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
      <div className={cn("flex items-center gap-1.5 px-2 py-1 h-8 rounded-lg border shadow-sm transition-colors shrink-0 order-first md:order-last w-full md:w-auto", 
        isDark ? "bg-slate-900 border-slate-700 hover:border-indigo-500" : "bg-white border-slate-200 hover:border-indigo-300"
      )}>
        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <div className="relative flex items-center w-full">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className={cn(
              "appearance-none bg-transparent font-bold text-xs pr-5 focus:outline-none cursor-pointer w-full md:max-w-[150px] truncate",
              isDark ? "text-white bg-slate-900" : "text-slate-900 bg-white"
            )}
          >
            {allClients.map(client => (
              <option key={client} value={client} className="font-semibold text-xs">{client}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-0 pointer-events-none text-slate-400" />
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
              <div className="max-w-6xl mx-auto space-y-4">


            {currentUser?.privileges?.clients?.canViewDecisionIntelligence && (
              <div className={cn("bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-lg relative overflow-hidden group border border-indigo-700/50 flex flex-col transition-all duration-300", isChatCollapsed ? "h-auto" : "h-[350px]")}>
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles className="w-48 h-48" /></div>
                
                <div className="flex items-center justify-between p-4 border-b border-indigo-800/50 relative z-10 shrink-0 cursor-pointer hover:bg-indigo-800/20 transition-colors" onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Sparkles className="w-4 h-4 text-indigo-300" /></div>
                    <span className="text-sm font-bold uppercase tracking-wider text-indigo-200">Decision Intelligence Assistant</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isChatCollapsed && messages.length === 0 && (
                      <div className="flex items-center gap-1.5">
                        <Button onClick={(e) => { e.stopPropagation(); sendChatMessage(true); }} disabled={isGeneratingBrief} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 h-8 text-xs px-2 sm:px-3">
                          {isGeneratingBrief ? <RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 sm:mr-1.5" />}
                          <span className="hidden sm:inline">{isGeneratingBrief ? 'Analyzing...' : 'Generate Brief'}</span>
                        </Button>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="text-indigo-200 hover:text-white hover:bg-indigo-800/50 h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setIsChatCollapsed(!isChatCollapsed); }}>
                      {isChatCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                {!isChatCollapsed && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 style-scroll relative z-10">
                      {messages.length === 0 && !isGeneratingBrief && (
                         <p className="text-sm text-indigo-300 italic text-center mt-8">Click "Generate Brief" or ask a question to analyze {selectedClient}'s data.</p>
                      )}
                      {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[85%] rounded-xl p-3 text-sm",
                            msg.role === 'user' ? "bg-indigo-600 text-white rounded-br-none" : "bg-slate-800/80 text-indigo-50 rounded-bl-none border border-indigo-700/30"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isGeneratingBrief && (
                        <div className="flex justify-start">
                          <div className="bg-slate-800/80 text-indigo-200 rounded-xl rounded-bl-none border border-indigo-700/30 p-3 text-sm flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4 animate-spin" /> Thinking...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 bg-slate-900/80 border-t border-indigo-800/50 shrink-0 relative z-10 flex items-center gap-2">
                      <input 
                        type="text" 
                        value={chatInput} 
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Ask about invoices, staff, or machines..." 
                        className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 text-sm rounded-lg h-9 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Button size="icon" onClick={() => sendChatMessage()} disabled={!chatInput.trim() || isGeneratingBrief} className="h-9 w-9 bg-indigo-600 hover:bg-indigo-500 shrink-0">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mb-6 gap-2 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 overflow-x-auto style-scroll pb-px flex-1 min-w-0">
                {[
                  { id: 'overview', label: 'Overview', icon: Activity, show: currentUser?.privileges?.clients?.canView },
                  { id: 'financials', label: 'Financials', icon: DollarSign, show: currentUser?.privileges?.billing?.canView || currentUser?.privileges?.payments?.canView },
                  { id: 'operations', label: 'Site 360', icon: Briefcase, show: currentUser?.privileges?.sites?.canView },
                  { id: 'contacts', label: 'Contacts', icon: Users, show: currentUser?.privileges?.clients?.canView },
                  { id: 'activity', label: 'Comms', icon: MessagesSquare, show: currentUser?.privileges?.commLog?.canView },
                  { id: 'tasks', label: 'Tasks', icon: CheckSquare, show: currentUser?.privileges?.tasks?.canView || currentUser?.privileges?.tasks?.canViewMyTasks }
                ].filter(tab => tab.show !== false).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "flex flex-1 justify-center items-center px-1.5 sm:px-4 py-3 text-[11px] min-[400px]:text-xs sm:text-sm font-semibold border-b-2 transition-colors",
                      activeTab === tab.id 
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}>
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {tab.id === 'operations' && clientPendingSites.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shrink-0 shadow-sm animate-in scale-in-50 duration-200">
                        {clientPendingSites.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0 pb-1">
                {currentUser?.privileges?.sites?.canView && (
                  <Button 
                    onClick={() => navigate('/sites')} 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "h-8 text-xs px-2 font-medium shadow-sm transition-colors flex items-center gap-1", 
                      isDark ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    )}
                    title="Client Overview"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="hidden min-[600px]:inline">Client Overview</span>
                  </Button>
                )}

              </div>
            </div>

            {/* Tab Content */}
            <div className="">
              
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className={cn("p-3 sm:p-5 rounded-2xl border shadow-sm min-w-0", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 truncate"><DollarSign className="w-3.5 h-3.5 shrink-0"/> Total Revenue</p>
                      <p className="text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black text-emerald-600 truncate" title={`₦${clientData.totalRevenue.toLocaleString()}`}>
                        ₦{currentUser?.privileges?.billing?.canViewAmounts ? Math.round(clientData.totalRevenue).toLocaleString() : '***'}
                      </p>
                    </div>
                    <div id="vat-deficit-card" className={cn("p-3 sm:p-5 rounded-2xl border shadow-sm flex flex-col justify-between min-w-0 transition-all duration-300", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 truncate"><AlertTriangle className="w-3.5 h-3.5 shrink-0"/> VAT Deficit</p>
                        <p className={cn("text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black truncate", clientData.vatDeficit > 0 ? "text-rose-500" : "text-emerald-500")} title={`₦${clientData.vatDeficit.toLocaleString()}`}>
                          ₦{currentUser?.privileges?.billing?.canViewAmounts ? Math.round(clientData.vatDeficit).toLocaleString() : '***'}
                        </p>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-2 font-medium bg-slate-100 dark:bg-slate-800 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 truncate max-w-full block" title={clientData.vatMonthsIncluded.length > 0 ? `Payments include: ${clientData.vatMonthsIncluded.join(', ')}` : 'No VAT payments in this period'}>
                        {clientData.vatMonthsIncluded.length > 0 ? `Paid for: ${clientData.vatMonthsIncluded.join(', ')}` : 'No VAT payments'}
                      </p>
                    </div>
                    <div className={cn("p-3 sm:p-5 rounded-2xl border shadow-sm min-w-0", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 truncate"><CheckCircle2 className="w-3.5 h-3.5 shrink-0"/> Active Sites</p>
                      <p className="text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black text-indigo-600 truncate">
                        {clientData.activeSites} <span className="text-xs sm:text-sm font-medium text-slate-400">/ {clientData.totalSites}</span>
                      </p>
                    </div>
                    <div className={cn("p-3 sm:p-5 rounded-2xl border shadow-sm min-w-0", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 truncate"><Users className="w-3.5 h-3.5 shrink-0"/> Deployed Staff</p>
                      <p className="text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black text-sky-600 truncate">
                        {clientData.deployedStaffCount} <span className="text-xs sm:text-sm font-medium text-slate-400">Today</span>
                      </p>
                    </div>
                  </div>

                  {/* Proactive Alerts & Health Score */}
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div className={cn("p-5 sm:p-6 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 sm:gap-6", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24">
                        <svg viewBox="0 0 128 128" className="w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12" className={isDark ? "text-slate-800" : "text-slate-100"} />
                          <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12" 
                            strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * clientData.healthScore) / 100}
                            className={clientData.healthScore > 80 ? "text-emerald-500" : clientData.healthScore > 50 ? "text-amber-500" : "text-rose-500"} 
                            strokeLinecap="round" 
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn("text-2xl sm:text-3xl font-black", clientData.healthScore > 80 ? "text-emerald-600" : clientData.healthScore > 50 ? "text-amber-600" : "text-rose-600")}>
                            {clientData.healthScore}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">Client Health Score</h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs">Based on financial, operational, and workflow metrics</p>
                      </div>
                    </div>

                    <div className={cn("p-4 sm:p-6 rounded-2xl border shadow-sm flex-1", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        {clientData.alerts.length > 0 ? <ShieldAlert className="w-5 h-5 text-amber-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />} 
                        Proactive Alerts
                      </h3>
                      {clientData.alerts.length > 0 ? (
                        <div className="space-y-3">
                          {clientData.alerts.map((alert, idx) => (
                            <div key={idx} className={cn("p-3 rounded-lg border flex items-start gap-3", 
                              alert.type === 'danger' ? (isDark ? "bg-rose-900/20 border-rose-800/50" : "bg-rose-50 border-rose-200") :
                              (isDark ? "bg-amber-900/20 border-amber-800/50" : "bg-amber-50 border-amber-200")
                            )}>
                              <AlertTriangle className={cn("w-5 h-5 shrink-0 mt-0.5", alert.type === 'danger' ? "text-rose-500" : "text-amber-500")} />
                              <div>
                                <p className={cn("font-bold text-sm", alert.type === 'danger' ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400")}>
                                  {alert.title}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center text-slate-500">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 opacity-50" />
                          <p>No active alerts. Client is in good standing.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FINANCIALS TAB */}
              {activeTab === 'financials' && (
                <div className="space-y-6 animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Revenue & Profit (Accrual Basis) */}
                    <div className={cn("p-6 rounded-3xl border shadow-sm flex flex-col justify-between", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500"/> Revenue & Accrued Profit</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Billed Revenue</span>
                              <span className="text-xs text-slate-400">Total amount invoiced to the client</span>
                            </div>
                            <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{currentUser?.privileges?.billing?.canViewAmounts ? `₦${clientData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '***'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Project Costs</span>
                              <span className="text-xs text-slate-400">Expenses logged for this client's sites</span>
                            </div>
                            <span className="font-bold text-lg text-rose-500">{currentUser?.privileges?.billing?.canViewAmounts ? `₦${clientData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '***'}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Cash Flow & Collection Status */}
                    <div className={cn("p-6 rounded-3xl border shadow-sm flex flex-col justify-between", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-sm">₦</span> Cash Flow & Collection
                        </h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Payments Received</span>
                              <span className="text-xs text-slate-400">Cash cleared in bank from this client</span>
                            </div>
                            <span className="font-bold text-lg text-emerald-600">{currentUser?.privileges?.billing?.canViewAmounts ? `₦${clientData.paymentsCleared.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '***'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Outstanding Balance</span>
                              <span className="text-xs text-slate-400">Invoiced amount awaiting payment</span>
                            </div>
                            <span className={cn("font-bold text-lg", (clientData.totalRevenue - clientData.paymentsCleared) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>
                              {currentUser?.privileges?.billing?.canViewAmounts ? `₦${(clientData.totalRevenue - clientData.paymentsCleared).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '***'}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Secondary Tab Switcher */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 mb-2 overflow-x-auto style-scroll pb-px gap-1">
                    {[
                      { id: 'invoices', label: 'Invoice Issuance Registry', icon: FileText },
                      { id: 'payments', label: 'Payments & VAT Settlement Registry', icon: CheckCircle2 }
                    ].map(subTab => {
                      const isActive = financialsSubTab === subTab.id;
                      return (
                        <button
                          key={subTab.id}
                          onClick={() => setFinancialsSubTab(subTab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all relative shrink-0",
                            isActive
                              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <subTab.icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                          <span>{subTab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Invoices Registry */}
                  {financialsSubTab === 'invoices' && (
                    <div className={cn("p-6 rounded-3xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-500" />
                          Invoice Issuance Registry
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Registry of all invoices sent to this client and upcoming billing schedules.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowOnlyUnpaidInvoices(!showOnlyUnpaidInvoices)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            showOnlyUnpaidInvoices 
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                          )}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          Unpaid Only
                        </button>
                      </div>
                    </div>

                    {(() => {
                      let displayedInvoices = clientData.clientInvoices?.filter(inv => !showOnlyUnpaidInvoices || inv.status !== 'Paid') || [];
                      
                      displayedInvoices.sort((a, b) => {
                        let valA: any = a[invoiceSort.key as keyof typeof a];
                        let valB: any = b[invoiceSort.key as keyof typeof b];
                        
                        if (invoiceSort.key === 'date' || invoiceSort.key === 'dueDate' || invoiceSort.key === 'nextBillingDate') {
                          valA = valA ? new Date(normalizeDate(valA)).getTime() : 0;
                          valB = valB ? new Date(normalizeDate(valB)).getTime() : 0;
                        } else if (invoiceSort.key === 'totalCharge') {
                          valA = a.totalCharge || a.amount || 0;
                          valB = b.totalCharge || b.amount || 0;
                        } else if (typeof valA === 'string' && typeof valB === 'string') {
                          valA = valA.toLowerCase();
                          valB = valB.toLowerCase();
                        }
                        
                        if (valA < valB) return invoiceSort.direction === 'asc' ? -1 : 1;
                        if (valA > valB) return invoiceSort.direction === 'asc' ? 1 : -1;
                        return 0;
                      });

                      return displayedInvoices.length > 0 ? (
                      <div className="overflow-x-auto style-scroll rounded-xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                          <thead>
                            <tr className={cn("border-b font-bold text-slate-500 uppercase tracking-wider text-[10px]", isDark ? "bg-slate-800/40 border-slate-800" : "bg-slate-50 border-slate-100")}>
                              {[
                                { key: 'invoiceNumber', label: 'Invoice No', align: 'left' },
                                { key: 'date', label: 'Date Sent', align: 'left' },
                                { key: 'siteName', label: 'Site', align: 'left' },
                                { key: 'duration', label: 'Duration', align: 'right' },
                                { key: 'totalCharge', label: 'Amount', align: 'right' },
                                { key: 'status', label: 'Status', align: 'center' },
                                { key: 'dueDate', label: 'Due Date', align: 'center' },
                                { key: 'nextBillingDate', label: 'Next Billing Date', align: 'center' }
                              ].map(col => (
                                <th 
                                  key={col.key} 
                                  className={`p-3 cursor-pointer select-none hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors ${
                                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                  }`}
                                  onClick={() => {
                                    if (invoiceSort.key === col.key) {
                                      setInvoiceSort({ key: col.key, direction: invoiceSort.direction === 'asc' ? 'desc' : 'asc' });
                                    } else {
                                      setInvoiceSort({ key: col.key, direction: 'desc' });
                                    }
                                  }}
                                >
                                  <div className={`flex items-center gap-1.5 inline-flex ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                    {col.label}
                                    {invoiceSort.key === col.key ? (
                                      invoiceSort.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />
                                    ) : (
                                      <div className="flex flex-col opacity-30">
                                        <ChevronUp className="w-2 h-2 -mb-[3px]" />
                                        <ChevronDown className="w-2 h-2" />
                                      </div>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {displayedInvoices.map((inv, idx) => (
                              <tr key={inv.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedInvoiceForDetail(inv); }}>
                                <td className="p-3 font-medium text-slate-900 dark:text-white">
                                  {inv.invoiceNumber || '-'}
                                </td>
                                <td className="p-3 text-slate-650 dark:text-slate-350">
                                  {inv.date ? new Date(normalizeDate(inv.date)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                                  {inv.siteName || '-'}
                                </td>
                                <td className="p-3 text-right text-slate-650 dark:text-slate-350">
                                  {inv.duration ? `${inv.duration} days` : '—'}
                                </td>
                                <td className="p-3 text-right font-bold text-slate-850 dark:text-slate-150">
                                  ₦{(inv.totalCharge || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] sm:text-[10px] px-1.5 py-0.5",
                                    inv.status === 'Paid' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' :
                                    inv.status === 'Overdue' ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900' :
                                    'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                                  )}>
                                    {inv.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center text-slate-650 dark:text-slate-350">
                                  {inv.dueDate ? new Date(normalizeDate(inv.dueDate)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="p-3 text-center font-medium">
                                  {inv.siteStatus === 'Ended' ? (
                                    <span className="text-slate-400 italic text-[10px]">Site Ended</span>
                                  ) : inv.nextBillingDate ? (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                      {new Date(inv.nextBillingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                        <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="font-semibold text-sm">No Invoices Found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {showOnlyUnpaidInvoices ? "No unpaid invoices found for this client." : "No invoices have been recorded for this client within the selected filter period."}
                        </p>
                      </div>
                    );
                  })()}
                  </div>
                  )}

                  {/* Payments & VAT Settlement Registry */}
                  {financialsSubTab === 'payments' && (
                  <div className={cn("p-6 rounded-3xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                          Payments & VAT Settlement Registry
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Registry of all payments received from this client, calculated VAT due, and VAT remittance settlement status by period.
                        </p>
                      </div>
                    </div>

                    {clientData.paymentsWithVatStatus && clientData.paymentsWithVatStatus.length > 0 ? (() => {
                      const allVatPayments = [...clientData.paymentsWithVatStatus]
                        .filter(p => p.payVat !== 'No')
                        .sort((a, b) => new Date(normalizeDate(a.date) || a.date).getTime() - new Date(normalizeDate(b.date) || b.date).getTime());
                      const filteredPayments = hideFullySettled
                        ? allVatPayments.filter(p => p.settlementStatus !== 'Fully Settled')
                        : allVatPayments;
                      return allVatPayments.length > 0 ? (
                      <div className="overflow-x-auto style-scroll rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Showing:</span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">VAT-Applicable Payments (Excluding No VAT)</span>
                          <button
                            onClick={() => setHideFullySettled(prev => !prev)}
                            className={cn(
                              "ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-200",
                              hideFullySettled
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                          >
                            <span className={cn(
                              "inline-block w-2 h-2 rounded-full transition-colors",
                              hideFullySettled ? "bg-emerald-500" : "bg-slate-400"
                            )} />
                            {hideFullySettled ? "Showing Unsettled Only" : "Hide Fully Settled"}
                          </button>
                          <span className="ml-auto text-[10px] font-semibold text-indigo-500">{filteredPayments.length} record{filteredPayments.length !== 1 ? 's' : ''} · Sorted by Date ↓</span>
                        </div>
                        <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                          <thead>
                            <tr className={cn("border-b font-bold text-slate-500 uppercase tracking-wider text-[10px]", isDark ? "bg-slate-800/40 border-slate-800" : "bg-slate-50 border-slate-100")}>
                              <th className="p-3">Payment Date</th>
                              <th className="p-3">Site</th>
                              <th className="p-3 text-right">Amount Received</th>
                              <th className="p-3 text-center">VAT Rate</th>
                              <th className="p-3 text-right">VAT on payments</th>
                              <th className="p-3 text-center">VAT Period</th>
                              <th className="p-3 text-center">Filing Settlement Status</th>
                              <th className="p-3 text-right">Amount for VAT Owe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredPayments.map((p, idx) => {
                              const settlementColor = 
                                p.settlementStatus === 'Fully Settled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' :
                                p.settlementStatus === 'Partially Settled' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50' :
                                'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50';

                              return (
                                <tr key={p.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="p-3 font-medium text-slate-900 dark:text-white">
                                    {new Date(normalizeDate(p.date) || p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td className="p-3 text-slate-650 dark:text-slate-350 font-semibold">{p.site}</td>
                                  <td className="p-3 text-right font-bold text-slate-850 dark:text-slate-150">
                                    ₦{(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center">
                                    <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] px-1.5 sm:px-2 whitespace-nowrap", 
                                      p.payVat === 'Add' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900' :
                                      p.payVat === 'Yes' ? 'text-teal-650 bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900' :
                                      'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-800'
                                    )}>
                                      {p.payVat === 'Add' ? `Add ${vatRate}%` : p.payVat === 'Yes' ? `Incl. ${vatRate}%` : <><span className="inline sm:hidden">Exempt</span><span className="hidden sm:inline">Exempt / No VAT</span></>}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                                    ₦{(p.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center text-slate-650 dark:text-slate-350 font-medium">
                                    {p.monthName} {p.yearStr}
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge className={cn("text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 font-bold whitespace-nowrap", settlementColor)}>
                                        {p.settlementStatus}
                                      </Badge>
                                      {p.key && (
                                        <span className="text-[10px] text-slate-400 font-semibold">
                                          Remitted: ₦{p.totalPaidForMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ₦{p.totalDueForMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-450">
                                    ₦{Math.max(0, p.totalDueForMonth - p.totalPaidForMonth).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className={cn("border-t-2 font-bold text-xs", isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50")}>
                              <td className="p-3 text-slate-500 uppercase tracking-wider text-[10px]" colSpan={2}>Totals</td>
                              <td className="p-3 text-right font-black text-slate-800 dark:text-slate-100">
                                ₦{filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center text-slate-400 text-[10px]">—</td>
                              <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                ₦{filteredPayments.reduce((sum, p) => sum + (p.vatAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Total VAT Due
                              </td>
                              <td className="p-3 text-center">
                                {(() => {
                                  const uniquePeriods = Array.from(
                                    new Map(
                                      filteredPayments
                                        .filter(p => p.key)
                                        .map(p => [p.key, { due: p.totalDueForMonth || 0, paid: p.totalPaidForMonth || 0 }])
                                    ).values()
                                  );

                                  const totalRemitted = uniquePeriods.reduce((sum, period) => sum + period.paid, 0);
                                  const totalDue = uniquePeriods.reduce((sum, period) => sum + period.due, 0);

                                  let totalSettlementStatus: 'Fully Settled' | 'Partially Settled' | 'Unsettled' = 'Unsettled';
                                  if (totalRemitted >= totalDue && totalDue > 0) {
                                    totalSettlementStatus = 'Fully Settled';
                                  } else if (totalRemitted > 0) {
                                    totalSettlementStatus = 'Partially Settled';
                                  }

                                  const totalSettlementColor = 
                                    totalSettlementStatus === 'Fully Settled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' :
                                    totalSettlementStatus === 'Partially Settled' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50' :
                                    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50';

                                  return (
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge className={cn("text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 font-bold whitespace-nowrap", totalSettlementColor)}>
                                        {totalSettlementStatus}
                                      </Badge>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                        Remitted: ₦{totalRemitted.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ₦{totalDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="p-3 text-right font-black text-rose-600 dark:text-rose-450 text-sm">
                                ₦{(() => {
                                  const uniquePeriods = Array.from(
                                    new Map(
                                      filteredPayments
                                        .filter(p => p.key)
                                        .map(p => [p.key, { due: p.totalDueForMonth || 0, paid: p.totalPaidForMonth || 0 }])
                                    ).values()
                                  );
                                  const totalOwed = uniquePeriods.reduce((sum, period) => sum + Math.max(0, period.due - period.paid), 0);
                              
                                  return totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                          <DollarSign className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                          <p className="font-semibold text-sm">No VAT-Applicable Payments</p>
                          <p className="text-xs text-slate-400 mt-1">All payments for this client have a 'No VAT' policy, or none have been recorded in the selected period.</p>
                        </div>
                      );
                    })() : (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                        <DollarSign className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="font-semibold text-sm">No Payments Logged</p>
                        <p className="text-xs text-slate-400 mt-1">No payments have been recorded for this client within the selected filter period.</p>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}

              {/* CONTACTS TAB */}
              {activeTab === 'contacts' && (
                <div className="space-y-4 col-span-full animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Contacts Directory</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Manage contact details, positions, phone, email and status for {selectedClient}.</p>
                    </div>
                    <Button
                      onClick={() => setShowContactsPanel(true)}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Manage Contacts</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clientData.contacts.length > 0 ? clientData.contacts.map(contact => (
                      <div key={contact.id} className={cn("p-5 rounded-2xl border shadow-sm relative group", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{contact.name}</h4>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{contact.position || 'No Position Specified'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={contact.isActive ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}>
                              {contact.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => setShowContactsPanel(true)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 bg-transparent border-0 cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Edit Contact"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 mt-4 text-sm text-slate-600 dark:text-slate-400">
                          {contact.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5"/> {contact.phone}</p>}
                          {contact.email && <p className="flex items-center gap-2"><FileText className="w-3.5 h-3.5"/> {contact.email}</p>}
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center text-slate-500">No contacts recorded for this client.</div>
                    )}
                  </div>
                </div>
              )}

              {/* OPERATIONS TAB */}
              {activeTab === 'operations' && (
                <div className="space-y-6 w-full animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                  {/* Secondary Tab Switcher */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 mb-2 overflow-x-auto style-scroll pb-px gap-1">
                    {[
                      { id: 'portfolio', label: 'Active Sites', count: clientData.clientSites.length, color: 'text-indigo-650 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400', icon: MapPin },
                      { id: 'onboarding', label: 'Onboarding Progress', count: clientPendingSites.length, color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400', icon: Clock }
                    ].map(subTab => {
                      const isActive = sitesSubTab === subTab.id;
                      return (
                        <button
                          key={subTab.id}
                          onClick={() => setSitesSubTab(subTab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all relative shrink-0",
                            isActive
                              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <subTab.icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                          <span>{subTab.label}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                            isActive ? subTab.color : "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {subTab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-tab: Active Sites */}
                  {sitesSubTab === 'portfolio' && (
                    <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-500"/> Site Portfolio ({clientData.clientSites.length})</h3>
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] style-scroll pr-2">
                        {clientData.clientSites.length > 0 ? clientData.clientSites.map(site => (
                          <div key={site.id}
                            className={cn('p-3 rounded-lg border cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md group relative', isDark ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-100 bg-slate-50 hover:bg-white')}
                            onClick={() => setSelectedSite(site)}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="font-semibold text-sm">{site.name}</span>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Badge className={site.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>{site.status}</Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg flex items-center justify-center shrink-0 border-0 bg-transparent cursor-pointer"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[180px]">
                                    <DropdownMenuItem 
                                      onClick={() => setNarrativeSite({ site, q: pendingSites.find(ps => ps.siteName === site.name && ps.clientName === site.client) || null })}
                                      className="gap-2"
                                    >
                                      <FileText className="h-4 w-4 text-slate-400" />
                                      <span>Site Summary</span>
                                    </DropdownMenuItem>
                                    
                                    {canEditSite && (
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          const linkedQ = pendingSites.find(ps => ps.siteName === site.name && ps.clientName === site.client);
                                          if (linkedQ) navigate(`/sites/onboarding/${linkedQ.id}`);
                                          else navigate('/sites/onboarding/new', { state: { linkedSite: site } });
                                        }}
                                        className="gap-2"
                                      >
                                        <Eye className="h-4 w-4 text-slate-400" />
                                        <span>View Onboarding</span>
                                      </DropdownMenuItem>
                                    )}
                                    {canViewComm && (
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          navigate(`/sites/conversations/${site.id}`);
                                        }}
                                        className="gap-2"
                                      >
                                        <MessageSquare className="h-4 w-4 text-slate-400" />
                                        <span>Site Conversations</span>
                                      </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem 
                                      onClick={() => {
                                        navigate(`/sites/diary/${site.id}`);
                                      }}
                                      className="gap-2 text-emerald-600 focus:text-emerald-700"
                                    >
                                      <BookOpen className="h-4 w-4" />
                                      <span>Site Diary</span>
                                    </DropdownMenuItem>
    
                                    {canEditSite && (
                                      <DropdownMenuItem 
                                        onClick={() => openSiteEdit(site)}
                                        className="gap-2 text-indigo-700 focus:text-indigo-700 focus:bg-indigo-50"
                                      >
                                        <Pencil className="h-4 w-4" />
                                        <span>Edit Site</span>
                                      </DropdownMenuItem>
                                    )}
    
                                    {canDeleteSite && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onClick={() => handleDeleteSite(site.id)}
                                          className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          <span>Delete</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            {site.startDate && <p className="text-xs text-slate-400 mt-1.5 ml-5.5">Since {new Date(site.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>}
                          </div>
                        )) : (
                          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                            <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                            <p className="font-semibold text-sm">No Active Sites</p>
                            <p className="text-xs text-slate-400 mt-1">There are no active sites logged for this client.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-tab: Onboarding Progress */}
                  {sitesSubTab === 'onboarding' && (
                    <div className={cn("p-6 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-500"/> Site Onboarding Progress
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">Track multi-phase onboarding workflows for new site proposals.</p>
                        </div>
                      </div>

                      {clientPendingSites.length === 0 ? (
                        <div className="text-center py-12">
                          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">No Pending Onboardings</h4>
                          <p className="text-xs text-slate-400 mt-1">No pending site onboarding records exist for {selectedClient}.</p>
                          {currentUser?.privileges?.commLog?.canAdd && (
                            <Button
                              onClick={() => {
                                setActiveTab('activity');
                                setCommDialogOpen(true);
                                setCommForm(f => ({ ...f, siteOption: 'NEW_ONBOARDING' }));
                              }}
                              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white gap-2 text-xs font-bold shadow-sm"
                              size="sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Log Comm to Start Onboarding
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {clientPendingSites.map(site => {
                            const phases = [1,2,3,4,5] as const;
                            const completedCount = phases.filter(p => !!(site as any)[`phase${p}`]?.completed).length;
                            return (
                              <div
                                key={site.id}
                                className={cn("rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
                              >
                                <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                                <div className="p-4 flex flex-col gap-3 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center shrink-0">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-slate-808 dark:text-slate-100 uppercase truncate leading-tight" title={site.siteName}>{site.siteName}</h4>
                                        <p className="text-[11px] text-slate-500 truncate">{site.createdAt ? new Date(site.createdAt).toLocaleDateString('en-GB') : '—'}</p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 whitespace-nowrap shrink-0">
                                      {completedCount}/5 done
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-5 gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                                    {phases.map(phase => {
                                      const isDone = !!(site as any)[`phase${phase}`]?.completed;
                                      return (
                                        <div key={phase} className="flex flex-col items-center gap-1">
                                          <span className="text-[9px] font-bold text-slate-400">P{phase}</span>
                                          {isDone
                                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-50 duration-200" />
                                            : <Circle className="h-3.5 w-3.5 text-slate-200 dark:text-slate-700" />}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-300"
                                      style={{ width: `${(completedCount / 5) * 100}%` }}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    {currentUser?.privileges?.sites?.canDeleteSite && (
                                      <button
                                        onClick={() => handleDeletePendingOnboarding(site)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-700 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2.5 py-1.5 transition-all"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                      </button>
                                    )}
                                    <button
                                      onClick={() => navigate(`/sites/onboarding/${site.id}`)}
                                      className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg px-2.5 py-1.5 transition-all"
                                    >
                                      <Eye className="h-3.5 w-3.5" /> View Form
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* COMMUNICATIONS TAB */}
              {activeTab === 'activity' && (
                <div className={cn("p-6 rounded-2xl border shadow-sm animate-in fade-in zoom-in-[0.98] duration-200 ease-out", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <MessagesSquare className="w-5 h-5 text-indigo-500"/> Interaction History
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Record client interactions and communication logs.</p>
                    </div>
                    {currentUser?.privileges?.commLog?.canAdd && (
                      <Button 
                        onClick={() => setCommDialogOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" /> Log Communication
                      </Button>
                    )}
                  </div>

                  <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-6 mt-4">
                    {clientData.logs.length > 0 ? clientData.logs.slice(0, 20).map(log => {
                      const isExpanded = expandedLogs.has(log.id);
                      return (
                        <div key={log.id} className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="absolute -left-[31px] bg-slate-200 dark:bg-slate-700 rounded-full p-1.5 border border-slate-200 dark:border-slate-750">
                            <MessagesSquare className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          </div>
                          <div className="bg-slate-50/50 dark:bg-slate-805/20 p-4 rounded-xl border border-slate-150/40 dark:border-slate-800">
                            <div 
                              className="flex justify-between items-start gap-4 cursor-pointer select-none group"
                              onClick={() => {
                                const next = new Set(expandedLogs);
                                if (next.has(log.id)) {
                                  next.delete(log.id);
                                } else {
                                  next.add(log.id);
                                }
                                setExpandedLogs(next);
                              }}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.subject || 'No Subject'}</span>
                                  <span className={cn("text-[9px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider", 
                                    log.direction === 'Incoming' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-405 dark:border-blue-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-405 dark:border-indigo-900/50'
                                  )}>
                                    {log.direction}
                                  </span>
                                  <span className={cn("text-[9px] px-2 py-0.5 font-bold rounded-full uppercase tracking-wider bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400")}>
                                    {log.channel}
                                  </span>
                                  {log.siteName && (
                                    <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold bg-indigo-50/60 dark:bg-indigo-950/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {log.siteName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-450 font-medium font-mono">Logged by {log.loggedBy} on {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                              </div>
                              <div className="text-slate-400 group-hover:text-indigo-500 transition-colors p-1 rounded-lg">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-2 text-xs">
                                    <p className="text-slate-650 dark:text-slate-350 leading-relaxed font-medium whitespace-pre-wrap">{log.notes}</p>
                                    {(log.contactPerson || log.outcome) && (
                                      <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                                        {log.contactPerson && (
                                          <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contact Person</span>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{log.contactPerson}</span>
                                          </div>
                                        )}
                                        {log.outcome && (
                                          <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Outcome</span>
                                            <span className="font-semibold text-slate-750 dark:text-slate-305">{log.outcome}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                        <MessagesSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="font-semibold text-sm">No History Recorded</p>
                        <p className="text-xs text-slate-400 mt-1">There are no interaction logs recorded for this client yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-4 animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                  {/* Secondary Tab Switcher */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 mb-2 overflow-x-auto style-scroll pb-px gap-1">
                    {[
                      { id: 'pending', label: 'Pending / Active', count: clientData.pendingTasks.length, color: 'text-indigo-650 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400', icon: CheckSquare },
                      { id: 'approval', label: 'Pending Approval', count: clientData.approvalTasks.length, color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400', icon: ShieldAlert },
                      { id: 'completed', label: 'Completed', count: clientData.completedTasks.length, color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400', icon: CheckCircle2 }
                    ].map(subTab => {
                      const isActive = taskSubTab === subTab.id;
                      return (
                        <button
                          key={subTab.id}
                          onClick={() => setTaskSubTab(subTab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all relative shrink-0",
                            isActive
                              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <subTab.icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                          <span>{subTab.label}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                            isActive ? subTab.color : "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {subTab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Contents */}
                  {taskSubTab === 'pending' && (
                    <div className={cn("p-4 sm:p-6 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-indigo-500" /> Pending Tasks ({clientData.pendingTasks.length})
                        </h3>
                      </div>
                      {clientData.pendingTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {clientData.pendingTasks.map(task => {
                            const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
                            const completed = taskSubs.filter(s => s.status === 'completed').length;
                            const isExpanded = expandedTasks.has(task.id);
                            return (
                              <div key={task.id} className="py-3 flex flex-col gap-3 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
                                <div className="flex justify-between items-start gap-3 cursor-pointer group" onClick={() => { const next = new Set(expandedTasks); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); setExpandedTasks(next); }}>
                                  <div className="flex-shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-500 transition-colors">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
                                    {task.deadline && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
                                    {taskSubs.length > 0 && (<div className="mt-1.5 flex items-center gap-2"><div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} /></div><span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span></div>)}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {task.priority && (<span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-650'}`}>{task.priority}</span>)}
                                    <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 whitespace-nowrap bg-indigo-50/50 text-indigo-700 border-indigo-200">Active</Badge>
                                  </div>
                                </div>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                      <div className="pl-7 pr-2 space-y-2 pt-1 pb-2">
                                        {taskSubs.length === 0 ? <p className="text-xs text-slate-500 italic">No subtasks.</p> : taskSubs.map(sub => (
                                          <div key={sub.id} onClick={(e) => { e.stopPropagation(); setOpenSubtaskId(sub.id!); }} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group/sub">
                                            <p className={`text-[13px] font-medium truncate group-hover/sub:text-indigo-600 transition-colors flex-1 min-w-0 ${sub.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{sub.title}</p>
                                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ml-2 ${sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : sub.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' : 'bg-slate-150 text-slate-600'}`}>{sub.status === 'not_started' ? 'To Start' : sub.status === 'in_progress' ? 'In Progress' : sub.status === 'pending_approval' ? 'Pending Approval' : 'Completed'}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <CheckSquare className="w-12 h-12 text-slate-350 mx-auto mb-3 opacity-60" />
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No pending tasks</h3>
                          <p className="text-xs text-slate-500 mt-1">There are no active or to-start tasks logged for this client.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {taskSubTab === 'approval' && (
                    <div className={cn("p-4 sm:p-6 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-amber-500" /> Pending Approvals ({clientData.approvalTasks.length})
                        </h3>
                      </div>
                      {clientData.approvalTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {clientData.approvalTasks.map(task => {
                            const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
                            const completed = taskSubs.filter(s => s.status === 'completed').length;
                            const isExpanded = expandedTasks.has(task.id);
                            return (
                              <div key={task.id} className="py-3 flex flex-col gap-3 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
                                <div className="flex justify-between items-start gap-3 cursor-pointer group" onClick={() => { const next = new Set(expandedTasks); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); setExpandedTasks(next); }}>
                                  <div className="flex-shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-500 transition-colors">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
                                    {task.deadline && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
                                    {taskSubs.length > 0 && (<div className="mt-1.5 flex items-center gap-2"><div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} /></div><span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span></div>)}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {task.priority && (<span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-650'}`}>{task.priority}</span>)}
                                    <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200">Needs Approval</Badge>
                                  </div>
                                </div>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                      <div className="pl-7 pr-2 space-y-2 pt-1 pb-2">
                                        {taskSubs.length === 0 ? <p className="text-xs text-slate-500 italic">No subtasks.</p> : taskSubs.map(sub => (
                                          <div key={sub.id} onClick={(e) => { e.stopPropagation(); setOpenSubtaskId(sub.id!); }} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group/sub">
                                            <p className={`text-[13px] font-medium truncate group-hover/sub:text-indigo-600 transition-colors flex-1 min-w-0 ${sub.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{sub.title}</p>
                                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ml-2 ${sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : sub.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' : 'bg-slate-150 text-slate-600'}`}>{sub.status === 'not_started' ? 'To Start' : sub.status === 'in_progress' ? 'In Progress' : sub.status === 'pending_approval' ? 'Pending Approval' : 'Completed'}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No pending approvals</h3>
                          <p className="text-xs text-slate-500 mt-1">All review requests are completed or fully resolved.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {taskSubTab === 'completed' && (
                    <div className={cn("p-4 sm:p-6 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Completed Tasks ({clientData.completedTasks.length})
                        </h3>
                      </div>
                      {clientData.completedTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {clientData.completedTasks.map(task => {
                            const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
                            const completed = taskSubs.filter(s => s.status === 'completed').length;
                            const isExpanded = expandedTasks.has(task.id);
                            return (
                              <div key={task.id} className="py-3 flex flex-col gap-3 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
                                <div className="flex justify-between items-start gap-3 cursor-pointer group" onClick={() => { const next = new Set(expandedTasks); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); setExpandedTasks(next); }}>
                                  <div className="flex-shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-500 transition-colors">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors text-slate-500 line-through">{task.title}</p>
                                    {task.deadline && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
                                    {taskSubs.length > 0 && (<div className="mt-1.5 flex items-center gap-2"><div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} /></div><span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span></div>)}
                                  </div>
                                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2.5 whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0 font-bold">Completed</Badge>
                                </div>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                      <div className="pl-7 pr-2 space-y-2 pt-1 pb-2">
                                        {taskSubs.length === 0 ? <p className="text-xs text-slate-500 italic">No subtasks.</p> : taskSubs.map(sub => (
                                          <div key={sub.id} onClick={(e) => { e.stopPropagation(); setOpenSubtaskId(sub.id!); }} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group/sub">
                                            <p className={`text-[13px] font-medium truncate group-hover/sub:text-indigo-600 transition-colors flex-1 min-w-0 line-through text-slate-400`}>{sub.title}</p>
                                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ml-2 bg-emerald-100 text-emerald-700`}>Completed</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-65" />
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No completed tasks</h3>
                          <p className="text-xs text-slate-500 mt-1">There are no completed tasks recorded for this client yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          ) : null}
        </div>
      </div>
    )}




      {/* Site Edit Dialog */}
      {siteEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
      <InvoiceDetailDialog
        invoice={selectedInvoiceForDetail}
        invoiceList={clientData?.clientInvoices || []}
        open={!!selectedInvoiceForDetail}
        onClose={() => setSelectedInvoiceForDetail(null)}
        onNavigate={(inv) => setSelectedInvoiceForDetail(inv)}
        onEdit={(inv) => { /* handle edit if needed */ }}
        onPrint={(inv) => { /* handle print if needed */ }}
      />
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

      {/* ── Site Narrative Info Modal ── */}
      {narrativeSite && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setNarrativeSite(null)} />
          <div className={cn("relative bg-white h-full sm:h-auto sm:max-h-[90vh] w-full max-w-xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300", isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900")}>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 sm:px-6 py-4 sm:py-5 flex items-start justify-between shrink-0">
              <div className="pr-8 text-left">
                <h2 className="text-white font-bold text-lg leading-tight truncate">{narrativeSite.site.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-indigo-100 text-xs font-medium bg-white/10 px-2 py-0.5 rounded uppercase tracking-wider">{narrativeSite.site.status}</p>
                  <span className="text-indigo-300 text-xs">•</span>
                  <p className="text-indigo-100 text-xs truncate max-w-[150px] sm:max-w-none">{narrativeSite.site.client}</p>
                </div>
              </div>
              <button 
                onClick={() => setNarrativeSite(null)} 
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors shrink-0 border-0 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 sm:p-6 overflow-y-auto style-scroll flex-1 text-left">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className={cn("p-3 sm:p-4 rounded-xl border group hover:border-indigo-100 transition-colors", isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-md text-indigo-600 dark:text-indigo-400">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site Address</p>
                  </div>
                  <p className="text-sm font-semibold">{narrativeSite.q?.address || 'Address not listed'}</p>
                </div>

                <div className={cn("p-3 sm:p-4 rounded-xl border group hover:border-indigo-100 transition-colors", isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-md text-emerald-600 dark:text-emerald-400">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</p>
                  </div>
                  <p className="text-sm font-semibold">
                    {narrativeSite.q?.contactPersonName || 'Contact not listed'}
                    {narrativeSite.q?.contactPersonPhone && (
                      <span className={cn("block text-[11px] font-medium mt-1 inline-block px-1.5 py-0.5 rounded border", isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-100 text-slate-500")}>
                        {narrativeSite.q.contactPersonPhone}
                      </span>
                    )}
                  </p>
                </div>

                <div className={cn("p-3 sm:p-4 rounded-xl border group hover:border-indigo-100 transition-colors", isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-md text-amber-600 dark:text-amber-400">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Name</p>
                  </div>
                  <p className="text-sm font-semibold truncate">{narrativeSite.q?.phase1?.whatIsBeingBuilt || 'Dewatering Operations'}</p>
                </div>

                <div className={cn("p-3 sm:p-4 rounded-xl border group hover:border-indigo-100 transition-colors", isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-md text-blue-600 dark:text-blue-400">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Status</p>
                  </div>
                  <p className="text-sm font-semibold">{narrativeSite.q?.phase4?.clientTaxStatus || 'Standard'}</p>
                </div>
              </div>

              {/* Narrative Section */}
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-50 dark:bg-indigo-950 rounded-full" />
                <div className="pl-5">
                  <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    Project Narrative
                  </h3>
                  <div className={cn("text-sm leading-relaxed whitespace-pre-line font-medium", isDark ? "text-slate-300" : "text-slate-650")}>
                    {buildNarrative(narrativeSite.site, narrativeSite.q)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={cn("px-5 sm:px-6 py-4 border-t flex justify-end shrink-0", isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-150")}>
              <Button 
                onClick={() => setNarrativeSite(null)}
                className={cn("w-full sm:w-auto shadow-sm", isDark ? "bg-slate-800 hover:bg-slate-750 text-white border-slate-750" : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200")}
              >
                Close Summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const toDisplayDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildNarrative = (site: any, q: any | null): string => {
  const lines: string[] = [];
  const isEnded = site.status === 'Ended';
  const name = site.name || 'this site';
  const client = site.client || 'the client';

  // Helper for tense-aware verbs
  const getVerb = (present: string, past: string) => isEnded ? past : present;

  // Opening
  lines.push(`${name} ${getVerb('is', 'was')} a dewatering project undertaken by DCEL on behalf of ${client}.`);

  if (q) {
    // Phase 1 — Project Scope
    const p1 = q.phase1;
    if (p1?.whatIsBeingBuilt) {
      lines.push(`The project ${getVerb('involves', 'involved')} ${p1.whatIsBeingBuilt.toLowerCase()}.`);
    }
    if (p1?.excavationDepthMeters) {
      lines.push(`Excavation ${getVerb('is planned', 'was')} to a depth of ${p1.excavationDepthMeters} metres.`);
    }
    if (p1?.siteLength && p1?.siteWidth) {
      lines.push(`The site ${getVerb('measures', 'measured')} approximately ${p1.siteLength}m by ${p1.siteWidth}m.`);
    }
    if (p1?.timelineStartDate) {
      lines.push(`Works ${getVerb('are scheduled to commence', 'commenced')} on ${p1.timelineStartDate}.`);
    }
    
    const dataAvail = [
      p1?.geotechnicalReportAvailable && 'geotechnical report', 
      p1?.hydrogeologicalDataAvailable && 'hydrogeological data'
    ].filter(Boolean);
    
    if (dataAvail.length) {
      lines.push(`Background data available at inquiry: ${dataAvail.join(' and ')}.`);
    }

    // Phase 2 — Site Assessment
    const p2 = q.phase2;
    const visited = p2?.siteVisited || p2?.walkthroughCompleted;
    if (visited) {
      lines.push(`A site visit and walkthrough were conducted to assess site conditions.`);
    }
    if (p2?.knownObstacles) {
      lines.push(`Known site obstacles ${getVerb('include', 'included')}: ${p2.knownObstacles}.`);
    }
    if (p2?.dischargeLocation) {
      lines.push(`Dewatering discharge ${getVerb('will be', 'was')} directed to ${p2.dischargeLocation}.`);
    }
    if (p2?.dieselSupplyStrategy) {
      lines.push(`Diesel supply ${getVerb('is to be', 'was')} provided by ${p2.dieselSupplyStrategy}.`);
    }

    // Phase 3 — Engineering
    const p3 = q.phase3;
    const methods = (p3?.dewateringMethods || []);
    if (methods.length) {
      lines.push(`The approved dewatering method(s) for this site: ${methods.join(', ')}.`);
    }
    if (p3?.totalWellpointsRequired) {
      lines.push(`The system ${getVerb('requires', 'required')} ${p3.totalWellpointsRequired} wellpoints across ${p3.totalHeadersRequired || '—'} header pipes.`);
    }
    if (p3?.totalPumpsRequired) {
      lines.push(`A total of ${p3.totalPumpsRequired} pump(s) ${getVerb('will be', 'were')} deployed.`);
    }
    if (p3?.expectedDailyDieselUsage) {
      lines.push(`${getVerb('Estimated daily', 'Actual')} diesel consumption ${getVerb('is', 'was')} ${p3.expectedDailyDieselUsage}.`);
    }

    // Phase 4 — Commercial
    const p4 = q.phase4;
    if (p4?.scopeOfWorkSummary) lines.push(`Scope of work: ${p4.scopeOfWorkSummary}`);
    if (p4?.scopeExclusionsSummary) lines.push(`Exclusions from scope: ${p4.scopeExclusionsSummary}`);
    if (p4?.clientTaxStatus) lines.push(`Client tax classification is ${p4.clientTaxStatus}.`);
    if (p4?.proposalAccepted) lines.push(`The client formally accepted the proposal.`);

    // Phase 5 — Handover
    const p5 = q.phase5;
    const milestones: string[] = [];
    if (p5?.safetyPlanIntegrated) milestones.push('site safety plan integrated');
    if (p5?.stage1AdvanceReceived) milestones.push('50% advance payment received');
    if (p5?.stage2InstallationComplete) milestones.push(isEnded ? 'installation completed' : 'installation complete and system started');
    if (p5?.stage2FirstInvoiceIssued) milestones.push('first hire invoice issued');
    if (p5?.stage3TimelyBilling) milestones.push(isEnded ? 'billing cycle completed' : 'regular hire invoicing ongoing');
    if (p5?.stage4DemobilizationComplete) milestones.push('demobilisation complete');
    if (p5?.stage4FinalInvoiceIssued) milestones.push('final invoice and WHT credit issued');
    
    if (milestones.length) {
      lines.push(`Project milestones achieved: ${milestones.join(', ')}.`);
    }
    if (p5?.actualEndDate) {
      lines.push(`The project concluded on ${p5.actualEndDate}.`);
    }
  } else {
    lines.push(`No detailed onboarding record has been linked to this site yet.`);
  }

  lines.push(`Current site status: ${site.status}. VAT: ${site.vat}.`);
  if (site.startDate) {
    lines.push(`${getVerb('Start date', 'Project started')}: ${site.startDate}${site.endDate ? `. Concluded: ${site.endDate}` : ''}.`);
  }
  return lines.join(' ');
};
