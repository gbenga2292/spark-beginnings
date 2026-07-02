import { useMemo, useState, useRef, useEffect } from 'react';
import { parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

import {
  Building2, ArrowLeft, MapPin, DollarSign, Activity, Wrench, MessagesSquare,
  AlertTriangle, Clock, Fuel, Calendar, FileText, Users, Settings2,
  ChevronDown, Sparkles, RefreshCcw, Send, ChevronUp, Filter, CheckCircle2, Plus, Pencil, ChevronRight,
  CheckSquare, ShieldAlert, ShieldCheck, ClipboardList, Package, Truck, X, Phone, Mail, Droplets
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { Invoice } from '@/src/store/appStore';
import { ClientContactsPanel } from './ClientContactsPanel';
import { TaskDetailSheet } from '@/src/components/tasks/TaskDetailSheet';
import { AddSubtaskInline } from './Tasks/AddSubtaskInline';


type SiteTab = 'financials' | 'operations' | 'maintenance' | 'comms' | 'tasks' | 'contacts';

interface Props {
  site: Site;
  clientSites: Site[];
  onSiteChange: (site: Site) => void;
  onBack: () => void;
  onEditSite: (site: Site) => void;
}

export function Site360View({ site, clientSites, onSiteChange, onBack, onEditSite }: Props) {
  const { isDark } = useTheme();
  const { createMainTask, users, addSubtask } = useAppData();
  const { user: authUser } = useAuth();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const allSites = useAppStore(s => s.sites);
  const allClients = useMemo(() => {
    const names = new Set<string>();
    allSites.forEach(s => { 
      const name = s.client?.trim();
      if (name && name.toUpperCase() !== 'DCEL') names.add(name); 
    });
    return Array.from(names).sort();
  }, [allSites]);

  const handleSearchNavigation = (result: any) => {
    navigate(`/client-360?client=${encodeURIComponent(result.clientName)}&tab=${result.tab}`);
  };

  const navigate = useNavigate();
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskRequiresApproval, setTaskRequiresApproval] = useState(false);
  const [taskApprover, setTaskApprover] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const matchingClient = useMemo(() => {
    return clientProfiles?.find(c => c.name?.trim().toLowerCase() === site.client?.trim().toLowerCase());
  }, [clientProfiles, site.client]);
  const derivedClientId = matchingClient ? matchingClient.id : null;

  const [activeTab, setActiveTab] = useState<SiteTab>('financials');
  const [showFilters, setShowFilters] = useState(false);
  const [isContactsCollapsed, setIsContactsCollapsed] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [taskSubTab, setTaskSubTab] = useState<'pending' | 'approval' | 'completed'>('pending');
  const [operationsSubTab, setOperationsSubTab] = useState<'logs' | 'materials' | 'waybills'>('logs');

  // Own filter state
  const currentYear = new Date().getFullYear();
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  // AI Chat State
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [isSiteInfoCollapsed, setIsSiteInfoCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [site.id]);

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || isSubmittingTask) return;
    setIsSubmittingTask(true);

    try {
      await createMainTask({
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        createdBy: authUser?.id,
        teamId: 'dcel-team',
        workspaceId: 'dcel-team',
        assignedTo: taskAssignees.length > 0 ? taskAssignees.join(',') : null,
        deadline: taskDeadline || null,
        priority: taskPriority,
        requiresApproval: taskRequiresApproval,
        approverId: taskRequiresApproval && taskApprover ? taskApprover : null,
        clientId: derivedClientId || undefined,
        siteId: site.id || undefined,
        is_hr_task: false,
        skipAutoSubtask: true
      }, []);

      // Reset form
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignees([]);
      setTaskDeadline('');
      setTaskPriority('medium');
      setTaskRequiresApproval(false);
      setTaskApprover('');
      setShowAddTaskForm(false);
    } catch (error) {
      console.error('Failed to create site task:', error);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [finTab, setFinTab] = useState<'invoices' | 'payments' | 'expenses' | 'vat'>('invoices');

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const vatPayments = useAppStore(s => s.vatPayments);

  const invoicePaymentMap = useMemo(() => {
    const allSiteInvoices = invoices.filter(i => i.siteId === site.id || i.siteName?.trim() === site.name.trim()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const allSitePayments = payments.filter(p => p.site?.trim() === site.name.trim() || p.client?.trim() === site.name.trim()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalPaymentAvailable = allSitePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const map: Record<string, { paid: number; isPaid: boolean }> = {};

    allSiteInvoices.forEach(inv => {
      const invAmount = inv.totalCharge || inv.amount || 0;
      const allocated = Math.min(totalPaymentAvailable, invAmount);
      totalPaymentAvailable -= allocated;
      map[inv.id] = {
        paid: allocated,
        isPaid: allocated >= invAmount * 0.99
      };
    });

    return map;
  }, [invoices, payments, site]);

  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vatRate = useAppStore(s => s.payrollVariables.vatRate);
  const commLogs = useAppStore(s => s.commLogs);
  const addCommLog = useAppStore(s => s.addCommLog);
  const clientContacts = useAppStore(s => s.clientContacts);
  const { dailyMachineLogs, maintenanceAssets, maintenanceSessions, waybills, assets, sitePumpDates } = useOperations();
  const { mainTasks, subtasks } = useAppData();

  const getInvoiceDates = (inv: any) => {
    const startDate = normalizeDate(inv.startDate || inv.date);
    const duration = parseFloat(inv.duration) || 0;
    const countOffDays = inv.countOffDays ?? true;
    const siteId = inv.siteId;

    let projectedEndDateStr = '';
    if (startDate && duration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setDate(start.getDate() + duration - 1);
        projectedEndDateStr = start.toISOString().split('T')[0];
      }
    } else {
      projectedEndDateStr = normalizeDate(inv.endDate || inv.dueDate);
    }

    let actualEndDateStr = '';
    if (startDate && duration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        if (countOffDays === false && siteId) {
          let daysCounted = 0;
          let currentDate = new Date(start);
          const linkedAssets = inv.linkedAssetIds || [];

          while (daysCounted < duration) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const logsForDate = dailyMachineLogs.filter(l => l.siteId === siteId && l.date === dateStr);
            
            let dayContribution = 1.0;
            if (logsForDate.length > 0) {
              const relevantLogs = linkedAssets && linkedAssets.length > 0 
                ? logsForDate.filter(l => linkedAssets.includes(l.assetId))
                : logsForDate;
              
              if (relevantLogs.length > 0) {
                const contributions = relevantLogs.map(l => {
                  const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                  if (status === 'full') return 1.0;
                  if (status === 'half') return 0.5;
                  return 0.0;
                });
                dayContribution = Math.min(...contributions);
              }
            }

            daysCounted += dayContribution;
            if (daysCounted < duration) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
          actualEndDateStr = currentDate.toISOString().split('T')[0];
        } else {
          const startD = new Date(startDate);
          startD.setDate(startD.getDate() + duration - 1);
          actualEndDateStr = startD.toISOString().split('T')[0];
        }
      }
    } else {
      actualEndDateStr = normalizeDate(inv.endDate || inv.dueDate);
    }

    return {
      startDate,
      projectedEndDate: projectedEndDateStr,
      actualEndDate: actualEndDateStr,
      duration
    };
  };

  const isWithinFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    if (filterMonth === 'all' && filterYear === 'all') return true;
    let year = '';
    let month = '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        year = parts[0];
        month = parseInt(parts[1], 10).toString();
      }
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 3) {
        year = parts[2];
        month = parseInt(parts[1], 10).toString();
      }
    }
    if (!year || !month) return false;
    const matchYear = filterYear === 'all' || year === filterYear;
    const matchMonth = filterMonth === 'all' || month === filterMonth;
    return matchYear && matchMonth;
  };

  const isBeforeFilter = (dateStr?: string) => {
    if (!dateStr || filterMonth === 'all' || filterYear === 'all') return false;
    let year = '';
    let month = '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 2) { year = parts[0]; month = parts[1]; }
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 3) { year = parts[2]; month = parts[1]; }
    }
    if (!year || !month) return false;
    const curYM = `${filterYear}-${parseInt(filterMonth, 10).toString().padStart(2, '0')}`;
    const dateYM = `${year}-${parseInt(month, 10).toString().padStart(2, '0')}`;
    return dateYM < curYM;
  };

  const data = useMemo(() => {
    const siteInvoices = invoices.filter(i =>
      (i.siteId === site.id || i.siteName?.trim() === site.name.trim()) && isWithinFilter(i.date)
    );
    const totalBilled = siteInvoices.reduce((a, i) => a + (i.totalCharge || i.amount || 0), 0);
    const sitePayments = payments.filter(p => (p.site?.trim() === site.name.trim() || p.client?.trim() === site.name.trim()) && isWithinFilter(p.date));
    const totalReceived = sitePayments.reduce((a, p) => a + (p.amount || 0), 0);
    const outstanding = totalBilled - totalReceived;

    const vatGenerated = 0; // VAT is only on payments, not invoices

    const periodVatCollected = sitePayments.reduce((sum, p) => {
      if (p.vat !== undefined && p.vat > 0) return sum + p.vat;
      const baseAmount = (p.amount || 0) - (p.damages || 0);
      const payVat = p.payVat || 'No';
      let vatVal = 0;
      if (payVat === 'Add') vatVal = ((baseAmount * vatRate) / (100 + vatRate));
      else if (payVat === 'Yes') vatVal = ((baseAmount / (100 + vatRate)) * vatRate);
      return sum + Math.round(vatVal * 100) / 100;
    }, 0);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const clientVatPayments = vatPayments.filter(vp => vp.client?.trim() === site.client?.trim());

    const prevPayments = payments.filter(p => (p.site?.trim() === site.name.trim() || p.client?.trim() === site.name.trim()) && isBeforeFilter(p.date));
    const prevVatCollected = prevPayments.reduce((sum, p) => {
      if (p.vat !== undefined && p.vat > 0) return sum + p.vat;
      const baseAmount = (p.amount || 0) - (p.damages || 0);
      const payVat = p.payVat || 'No';
      let vatVal = 0;
      if (payVat === 'Add') vatVal = ((baseAmount * vatRate) / (100 + vatRate));
      else if (payVat === 'Yes') vatVal = ((baseAmount / (100 + vatRate)) * vatRate);
      return sum + Math.round(vatVal * 100) / 100;
    }, 0);

    const prevVatRemitted = clientVatPayments.filter(vp => {
      if (filterMonth === 'all' || filterYear === 'all') return false;
      if (!vp.year) return false;
      if (vp.year < filterYear) return true;
      const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === vp.month?.toLowerCase());
      if (vp.year === filterYear && monthIndex !== -1 && monthIndex < (parseInt(filterMonth, 10) - 1)) return true;
      return false;
    }).reduce((sum, vp) => sum + (vp.amount || 0), 0);

    const unpaidVatBroughtForward = Math.max(0, prevVatCollected - prevVatRemitted);

    const periodVatRemitted = clientVatPayments.filter(vp => {
      if (filterMonth === 'all' && filterYear === 'all') return true;
      const matchYear = filterYear === 'all' || vp.year === filterYear;
      const monthName = filterMonth !== 'all' ? MONTHS[parseInt(filterMonth, 10) - 1] : null;
      const matchMonth = filterMonth === 'all' || vp.month?.toLowerCase() === monthName?.toLowerCase();
      return matchYear && matchMonth;
    }).reduce((sum, vp) => sum + (vp.amount || 0), 0);

    const totalVatRemitted = clientVatPayments.reduce((sum, vp) => sum + (vp.amount || 0), 0);

    const siteCosts = ledgerEntries.filter(l => (l.site?.trim() === site.name.trim() || l.client?.trim() === site.name.trim()) && isWithinFilter(l.date));
    const totalCost = siteCosts.reduce((a, l) => a + (l.amount || 0), 0);

    const machineLogs = dailyMachineLogs.filter(l => l.siteId === site.id && isWithinFilter(l.date));
    const totalDiesel = machineLogs.reduce((a, l) => a + (l.dieselUsage || 0), 0);
    const activeDays = machineLogs.filter(l => l.isActive).length;

    const machineDaysBreakdown = Array.from(machineLogs.reduce((acc, l) => {
      const asset = l.assetName || 'Unknown Machine';
      if (!acc.has(asset)) {
        acc.set(asset, { name: asset, active: 0, off: 0, total: 0 });
      }
      const stats = acc.get(asset)!;
      let dayVal = 0;
      if (l.operationalDay === 'half') dayVal = 0.5;
      else if (l.operationalDay === 'full') dayVal = 1;
      else if (l.operationalDay === 'none') dayVal = 0;
      else dayVal = l.isActive ? 1 : 0;

      stats.total += dayVal;
      if (dayVal > 0) {
        stats.active += 1; // Count as an active day occurrence
      } else if (l.operationalDay === 'none' || !l.isActive) {
        stats.off += 1;
      }
      return acc;
    }, new Map<string, { name: string; active: number; off: number; total: number }>()).values());

    const machineDays = machineLogs.reduce((sum, l) => {
      if (l.operationalDay === 'half') return sum + 0.5;
      if (l.operationalDay === 'none') return sum + 0;
      if (l.operationalDay === 'full') return sum + 1;
      return sum + (l.isActive ? 1 : 0);
    }, 0);

    const activeMachinesCount = new Set(machineLogs.filter(l => l.isActive || l.operationalDay === 'full' || l.operationalDay === 'half').map(l => l.assetId)).size;

    const siteWaybills = waybills.filter(w =>
      (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
      w.status !== 'outstanding'
    );
    const inventoryMap = new Map<string, number>();
    siteWaybills.filter(w => w.type === 'waybill' && w.status !== 'outstanding').forEach(wb => {
      wb.items.forEach(item => {
        inventoryMap.set(item.assetId, (inventoryMap.get(item.assetId) || 0) + item.quantity);
      });
    });
    siteWaybills.filter(w => w.type === 'return').forEach(wb => {
      wb.items.forEach(item => {
        const cur = inventoryMap.get(item.assetId) || 0;
        inventoryMap.set(item.assetId, Math.max(0, cur - item.quantity));
      });
    });
    const machinesOnSiteCount = assets.filter(a => a.type === 'equipment' && a.requiresLogging && (inventoryMap.get(a.id) || 0) > 0).length;

    const siteMaintAssets = maintenanceAssets.filter(a => {
      const aSite = (a.site || '').trim().toLowerCase();
      return aSite === site.name.trim().toLowerCase() || aSite === site.id.trim().toLowerCase();
    });
    const siteMaintSessions = maintenanceSessions.filter(s_session =>
      s_session.assets.some(a => siteMaintAssets.some(ma => ma.name === a.assetName))
    );
    const totalMaintenanceCost = siteMaintSessions.reduce((acc, s) =>
      acc + s.assets.reduce((a, asset) => a + (asset.cost || 0), 0), 0
    );

    const siteNameLow = site.name.toLowerCase();
    const siteTasks = mainTasks.filter(t => {
      if (t.isDeleted) return false;

      // Check main task properties
      if (t.siteId === site.id) return true;
      if (t.title?.toLowerCase().includes(siteNameLow)) return true;
      if (t.description?.toLowerCase().includes(siteNameLow)) return true;

      // Check subtasks properties
      const tSubs = subtasks.filter(s => s.mainTaskId === t.id);
      if (tSubs.some(s => 
        s.siteId === site.id || 
        s.title?.toLowerCase().includes(siteNameLow) || 
        s.description?.toLowerCase().includes(siteNameLow)
      )) return true;

      return false;
    });

    const pendingSiteTasks = siteTasks.filter(t => {
      const s = deriveMainTaskStatus(t.id, subtasks);
      return s === 'not_started' || s === 'in_progress';
    });
    const approvalSiteTasks = siteTasks.filter(t => deriveMainTaskStatus(t.id, subtasks) === 'pending_approval');
    const completedSiteTasks = siteTasks.filter(t => deriveMainTaskStatus(t.id, subtasks) === 'completed');

    const siteComms = commLogs.filter(l =>
      (l.siteId === site.id || l.siteName?.trim() === site.name.trim()) && isWithinFilter(l.date)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 1. All contacts registered under this client (matches ClientContactsPanel)
    const allClientContacts = clientContacts.filter(c =>
      c.clientName?.trim().toLowerCase() === (site.client || site.name).trim().toLowerCase()
    );

    // 2. Extract any contact names from this site's comm logs not already in the registered list
    const registeredNames = new Set(allClientContacts.map(c => c.name.trim().toLowerCase()));
    const pastCommNames = Array.from(new Set(siteComms.map(l => l.contactPerson).filter(Boolean)))
      .filter(name => !registeredNames.has(name.trim().toLowerCase()));

    // 3. Build final list: registered contacts first, then unregistered past-comm contacts
    const siteContacts: {
      id: string; name: string; position?: string; phone?: string; email?: string;
      note?: string; isActive?: boolean; siteIds?: string[]; siteNames?: string[]; isRegistered: boolean;
    }[] = [
      ...allClientContacts.map(c => ({
        id: c.id,
        name: c.name,
        position: c.position,
        phone: c.phone,
        email: c.email,
        note: c.note,
        isActive: c.isActive,
        siteIds: c.siteIds,
        siteNames: c.siteNames,
        isRegistered: true,
      })),
      ...pastCommNames.map((name, idx) => ({
        id: `past-comm-${idx}`,
        name: name.trim(),
        position: 'Past Comm Contact',
        phone: undefined,
        email: undefined,
        note: undefined,
        isActive: true,
        siteIds: [],
        siteNames: [],
        isRegistered: false,
      })),
    ];

    const alerts: { title: string; type: 'warning' | 'danger' }[] = [];
    if (siteMaintAssets.some(a => a.status === 'overdue')) alerts.push({ title: 'Overdue maintenance on one or more assets', type: 'danger' });
    if (siteTasks.length > 3) alerts.push({ title: `${siteTasks.length} pending tasks`, type: 'warning' });

    // ── Pump summary for this site ──────────────────────────────────────
    const physicalPumpsOnSite = assets.filter(a => 
      a.type === 'equipment' && 
      a.requiresLogging && 
      /pump/i.test(a.name || '') &&
      (inventoryMap.get(a.id) || 0) > 0
    );

    const sitePumps = sitePumpDates.filter(pd => pd.siteId === site.id);

    const mergedPumpsMap = new Map<string, {
      id: string;
      assetId: string;
      name: string;
      pumpStartDate: string | null;
      pumpStopDate: string | null;
      isPhysical: boolean;
    }>();

    physicalPumpsOnSite.forEach(p => {
      const configured = sitePumps.find(pd => pd.assetId === p.id);
      
      const machineLogs = dailyMachineLogs.filter(l => l.assetId === p.id && l.siteId === site.id);
      const earliestLogDate = machineLogs.length > 0
        ? machineLogs.reduce((acc, log) => log.date < acc ? log.date : acc, machineLogs[0].date)
        : null;

      const pumpWaybills = siteWaybills.filter(w => w.type === 'waybill' && w.items.some(i => i.assetId === p.id));
      const earliestWaybillDate = pumpWaybills.length > 0
        ? pumpWaybills.reduce((acc, wb) => {
            const date = wb.sentToSiteDate || wb.issueDate;
            if (!date) return acc;
            if (!acc) return date;
            return date < acc ? date : acc;
          }, null as string | null)
        : null;

      const fallbackStart = earliestLogDate || earliestWaybillDate;

      mergedPumpsMap.set(p.id, {
        id: configured?.id || `temp-${p.id}`,
        assetId: p.id,
        name: p.name,
        pumpStartDate: configured?.pumpStartDate || fallbackStart,
        pumpStopDate: configured?.pumpStopDate || null,
        isPhysical: true,
      });
    });

    sitePumps.forEach(pd => {
      if (!mergedPumpsMap.has(pd.assetId)) {
        const asset = assets.find(a => a.id === pd.assetId);
        mergedPumpsMap.set(pd.assetId, {
          id: pd.id,
          assetId: pd.assetId,
          name: asset?.name || 'Unknown Pump',
          pumpStartDate: pd.pumpStartDate,
          pumpStopDate: pd.pumpStopDate,
          isPhysical: false,
        });
      }
    });

    const pumpsOnSite = Array.from(mergedPumpsMap.values());

    const pumpsWithStart = pumpsOnSite.filter(p => p.pumpStartDate);
    const earliestPumpStart = pumpsWithStart.length > 0
      ? pumpsWithStart.reduce((min, p) => (p.pumpStartDate! < min ? p.pumpStartDate! : min), pumpsWithStart[0].pumpStartDate!)
      : null;

    const latestPumpStop = pumpsOnSite.length > 0
      ? pumpsOnSite.reduce((latest, p) => {
          if (!p.pumpStopDate) return null; // null means still running → no overall stop
          if (latest === null) return null;
          return p.pumpStopDate > latest ? p.pumpStopDate : latest;
        }, pumpsOnSite[0].pumpStopDate as string | null)
      : null;

    const activePumpsCount = pumpsOnSite.filter(p => !p.pumpStopDate).length;

    return {
      siteInvoices, sitePayments, siteCosts, totalBilled, totalReceived, outstanding, vatGenerated, totalCost,
      periodVatCollected, unpaidVatBroughtForward, periodVatRemitted, totalVatRemitted,
      machineLogs, totalDiesel, activeDays, machineDays, machineDaysBreakdown, activeMachinesCount, machinesOnSiteCount,
      siteWaybills, materialsOnSite: assets.filter(a => (inventoryMap.get(a.id) || 0) > 0).map(a => ({ ...a, quantity: inventoryMap.get(a.id) || 0 })),
      siteMaintAssets, siteMaintSessions, totalMaintenanceCost,
      siteTasks, pendingSiteTasks, approvalSiteTasks, completedSiteTasks, siteComms, siteContacts, alerts,
      profit: totalBilled - totalCost,
      pumpsOnSite, earliestPumpStart, latestPumpStop, activePumpsCount,
    };
  }, [site, filterMonth, filterYear, invoices, payments, vatPayments, ledgerEntries, vatRate, dailyMachineLogs, maintenanceAssets, maintenanceSessions, mainTasks, subtasks, commLogs, clientContacts, waybills, assets, sitePumpDates]);

  const card = cn('p-5 rounded-2xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200');

  const tabs: { id: SiteTab; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: 'financials', label: 'Financials', icon: DollarSign, show: currentUser?.privileges?.billing?.canView || currentUser?.privileges?.payments?.canView },
    { id: 'operations', label: 'Operations', icon: Activity, show: currentUser?.privileges?.sites?.canView },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, show: currentUser?.privileges?.sites?.canView },
    { id: 'comms', label: 'Comms', icon: MessagesSquare, show: currentUser?.privileges?.commLog?.canView },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, show: currentUser?.privileges?.tasks?.canView || currentUser?.privileges?.tasks?.canViewMyTasks },
    { id: 'contacts', label: 'Contacts', icon: Users, show: currentUser?.privileges?.clients?.canView },
  ].filter(tab => tab.show !== false) as { id: SiteTab; label: string; icon: React.ElementType }[];

  // AI Chat
  const sendChatMessage = async (isInitialBrief = false) => {
    if (!isInitialBrief && !chatInput.trim()) return;
    let apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY');
    if (!apiKey) {
      apiKey = window.prompt('Enter your Groq API Key:');
      if (!apiKey) return;
      localStorage.setItem('GROQ_API_KEY', apiKey);
    }
    const newUserMessage = isInitialBrief ? 'Provide a 3-sentence intelligence brief for this site.' : chatInput;
    if (!isInitialBrief) { setMessages(prev => [...prev, { role: 'user', content: newUserMessage }]); setChatInput(''); }
    setIsGeneratingBrief(true);
    try {
      const systemPrompt = `You are a Site 360 Intelligence Assistant for DCEL. Site: ${site.name} (${site.client}). Status: ${site.status}.
Financials: Billed ₦${data.totalBilled.toLocaleString()}, Received ₦${data.totalReceived.toLocaleString()}, Outstanding ₦${data.outstanding.toLocaleString()}, Profit ₦${data.profit.toLocaleString()}.
Operations: ${data.machineLogs.length} log days, ${data.activeDays} active days, ${data.totalDiesel}L diesel used.
Maintenance: ${data.siteMaintAssets.length} assets tracked. Overdue: ${data.siteMaintAssets.filter(a => a.status === 'overdue').map(a => a.name).join(', ') || 'None'}.
Pending Tasks: ${data.siteTasks.length}. Alerts: ${data.alerts.map(a => a.title).join('; ') || 'None'}.
Answer site-specific questions using this context only. Be concise.`;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: systemPrompt }, ...messages, { role: 'user', content: newUserMessage }], temperature: 0.3, max_tokens: 300 }),
      });
      if (!res.ok) throw new Error('API Error');
      const resData = await res.json();
      const reply = resData.choices[0].message.content;
      if (isInitialBrief) setMessages([{ role: 'assistant', content: reply }]);
      else setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch { if (!isInitialBrief) setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to connect to intelligence API.' }]); }
    finally { setIsGeneratingBrief(false); }
  };

  // Header actions with Filters dropdown and Site Selector
  const headerActions = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full justify-end">
      {/* Site Selector - Order First on Mobile */}
      <div className={cn('flex items-center gap-1.5 px-2 py-1 h-8 rounded-lg border shadow-sm transition-colors order-first sm:order-last w-full sm:w-auto', isDark ? 'bg-slate-900 border-slate-700 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300')}>
        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <div className="relative flex items-center w-full">
          <select
            value={site.id}
            onChange={e => {
              const selected = clientSites.find(s => s.id === e.target.value);
              if (selected) onSiteChange(selected);
            }}
            className={cn('appearance-none bg-transparent font-bold text-xs pr-5 focus:outline-none cursor-pointer w-full sm:max-w-[150px] truncate', isDark ? 'text-white' : 'text-slate-900')}
          >
            {clientSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-0 pointer-events-none text-slate-400" />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("h-8 w-8 p-0 flex items-center justify-center relative shrink-0", isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")}
          >
            <Filter className="w-3.5 h-3.5" />
            {(filterMonth !== 'all' || filterYear !== 'all') && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white dark:border-slate-950" />
            )}
          </Button>

          {showFilters && (
            <div className={cn("absolute right-0 top-full mt-2 p-4 rounded-2xl border shadow-xl z-50 flex flex-col gap-3 w-56", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month</label>
                <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setShowFilters(false); }} className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}>
                  <option value="all">All Months</option>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Year</label>
                <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setShowFilters(false); }} className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')}>
                  <option value="all">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  useSetPageTitle('Site 360', `Operational command center for ${site.name}`, headerActions, [filterMonth, filterYear, site.name, isDark, showFilters, clientSites], onBack);

  const renderTaskRow = (task: any, statusType: 'pending' | 'approval' | 'completed') => {
    const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
    const completed = taskSubs.filter(s => s.status === 'completed').length;
    const isTagged = task.siteId === site.id;
    return (
      <div key={task.id} className="py-3 flex flex-col gap-3 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
        <div 
          className="flex justify-between items-start gap-3 cursor-pointer group"
          onClick={() => {
            const next = new Set(expandedTasks);
            if (next.has(task.id)) next.delete(task.id);
            else next.add(task.id);
            setExpandedTasks(next);
          }}
        >
          <div className="flex-shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-500 transition-colors">
            {expandedTasks.has(task.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn(
                "font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors",
                statusType === 'completed' ? "text-slate-500 line-through" : "text-slate-700 dark:text-slate-200"
              )}>{task.title}</p>
              {isTagged && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 flex items-center gap-1 shrink-0">
                  <MapPin className="w-2.5 h-2.5" /> Tagged
                </span>
              )}
            </div>
            {task.deadline && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
            {taskSubs.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full",
                    statusType === 'completed' ? "bg-emerald-500" : "bg-indigo-500"
                  )} style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {statusType !== 'completed' && task.priority && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                task.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300' :
                task.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300' :
                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300' :
                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}>{task.priority}</span>
            )}
            <Badge variant="outline" className={cn(
              "text-[9px] sm:text-xs px-1.5 sm:px-2.5 whitespace-nowrap uppercase tracking-wider",
              statusType === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50" :
              statusType === 'approval' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50" :
              "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/50"
            )}>
              {statusType === 'completed' ? 'Completed' : statusType === 'approval' ? 'Approval' : 'Active'}
            </Badge>
          </div>
        </div>
        
        <AnimatePresence initial={false}>
          {expandedTasks.has(task.id) && (
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: "hidden" }}
              animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: "visible" } }}
              exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              transition={{ duration: 0.2 }}
            >
              <div className="pl-7 pr-2 space-y-2 pt-1 pb-2">
                {taskSubs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No subtasks.</p>
                ) : (
                  taskSubs.map(sub => (
                    <div 
                      key={sub.id} 
                      onClick={(e) => { e.stopPropagation(); setOpenSubtaskId(sub.id!); }}
                      className="flex items-start justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group/sub"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-medium truncate group-hover/sub:text-indigo-600 transition-colors ${sub.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {sub.title}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${
                          sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 
                          sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 
                          sub.status === 'pending_approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {sub.status === 'not_started' ? 'To Start' : sub.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                  <AddSubtaskInline mainTaskId={task.id} users={users} onAdd={sub => addSubtask(sub)} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 style-scroll">
        <div className="max-w-6xl mx-auto space-y-4">


          {/* ── Hero: AI Assistant + Site Identity side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">

            {/* AI Chat — conditionally shown based on privileges */}
            {currentUser?.privileges?.sites?.canViewDecisionIntelligence && (
              <div className={cn('lg:col-span-3 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-lg relative overflow-hidden border border-indigo-700/50 flex flex-col transition-all duration-300', isChatCollapsed ? 'h-auto' : 'lg:h-[300px] h-[260px]')}>
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles className="w-48 h-48" /></div>
              <div className="flex items-center justify-between p-4 border-b border-indigo-800/50 relative z-10 shrink-0 cursor-pointer hover:bg-indigo-800/20 transition-colors" onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Sparkles className="w-4 h-4 text-indigo-300" /></div>
                  <span className="text-sm font-bold uppercase tracking-wider text-indigo-200">Site Intelligence Assistant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isChatCollapsed && messages.length === 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button onClick={e => { e.stopPropagation(); sendChatMessage(true); }} disabled={isGeneratingBrief} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 h-8 text-xs px-2 sm:px-3">
                        {isGeneratingBrief ? <RefreshCcw className="w-3.5 h-3.5 animate-spin sm:mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 sm:mr-1.5" />}
                        <span className="hidden sm:inline">{isGeneratingBrief ? 'Analyzing...' : 'Generate Brief'}</span>
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="text-indigo-200 hover:text-white hover:bg-indigo-800/50 h-8 w-8 p-0" onClick={e => { e.stopPropagation(); setIsChatCollapsed(!isChatCollapsed); }}>
                    {isChatCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {!isChatCollapsed && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 style-scroll relative z-10">
                    {messages.length === 0 && !isGeneratingBrief && <p className="text-sm text-indigo-300 italic text-center mt-6">Click "Generate Brief" to get a site intelligence summary.</p>}
                    {messages.map((msg, idx) => (
                      <div key={idx} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[85%] rounded-xl p-3 text-sm', msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800/80 text-indigo-50 rounded-bl-none border border-indigo-700/30')}>{msg.content}</div>
                      </div>
                    ))}
                    {isGeneratingBrief && <div className="flex justify-start"><div className="bg-slate-800/80 text-indigo-200 rounded-xl rounded-bl-none border border-indigo-700/30 p-3 text-sm flex items-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin" /> Thinking...</div></div>}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 bg-slate-900/80 border-t border-indigo-800/50 shrink-0 relative z-10 flex items-center gap-2">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} placeholder="Ask about invoices, machines, maintenance..." className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 text-sm rounded-lg h-9 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <Button size="icon" onClick={() => sendChatMessage()} disabled={!chatInput.trim() || isGeneratingBrief} className="h-9 w-9 bg-indigo-600 hover:bg-indigo-500 shrink-0"><Send className="w-4 h-4" /></Button>
                  </div>
                </>
              )}
              </div>
            )}

            {/* Site Identity Card */}
            <div className={cn(
              currentUser?.privileges?.sites?.canViewDecisionIntelligence ? 'lg:col-span-2' : 'lg:col-span-5',
              'p-5 rounded-sm border shadow-sm flex flex-col transition-all duration-300 overflow-x-hidden relative',
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300',
              // On mobile: use independent isSiteInfoCollapsed state
              // On desktop (lg): use linked isChatCollapsed state
              isMobile
                ? (isSiteInfoCollapsed ? 'h-auto py-3 justify-center' : 'h-auto justify-start')
                : (isChatCollapsed ? 'h-auto py-3 justify-center' : 'lg:h-[300px] justify-between overflow-y-auto style-scroll')
            )}>
              {/* Industrial Accent Line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 dark:bg-slate-100" />
              
              <div 
                className="flex flex-col sm:flex-row sm:items-start justify-between cursor-pointer group select-none gap-3 shrink-0"
                onClick={() => {
                  // On mobile: toggle site info independently
                  // On desktop: toggle linked chat state
                  if (isMobile) setIsSiteInfoCollapsed(!isSiteInfoCollapsed);
                  else setIsChatCollapsed(!isChatCollapsed);
                }}
              >
                <div className="flex flex-col gap-2 min-w-0 flex-1 relative shrink-0">
                  {/* Status Badges Overlayed Top */}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border',
                      (site.status === 'Active' && !site.startDate) ? 'bg-amber-50 text-amber-700 border-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                      site.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' :
                        site.status === 'Ended' ? 'bg-rose-50 text-rose-700 border-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600 border-slate-400 dark:bg-slate-800'
                    )}>{(site.status === 'Active' && !site.startDate) ? 'Pending' : site.status}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 border border-slate-300 dark:border-slate-700">VAT: {site.vat}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 border border-slate-300 dark:border-slate-700 max-w-[150px] sm:max-w-[200px] truncate">
                      CLIENT: {site.client}
                    </span>
                  </div>

                  {/* Massive Typographic Hero */}
                  <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight truncate group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors mt-0.5">
                    {site.name}
                  </h1>

                  {/* Date range below title */}
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {site.startDate ? (
                      site.endDate ? (
                        <span>
                          {new Date(site.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} — {new Date(site.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : (
                        <span>SINCE {new Date(site.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      )
                    ) : site.endDate ? (
                      <span>ENDED {new Date(site.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    ) : <span>NO DATE LOGGED</span>}
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-8 w-8 p-0 shrink-0 self-start sm:ml-2 mt-1" 
                  onClick={e => {
                    e.stopPropagation();
                    if (isMobile) setIsSiteInfoCollapsed(!isSiteInfoCollapsed);
                    else setIsChatCollapsed(!isChatCollapsed);
                  }}
                >
                  {(isMobile ? isSiteInfoCollapsed : isChatCollapsed) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>

              {/* Fragmented Stats Strip */}
              <AnimatePresence initial={false}>
                {/* On mobile: show when site info is expanded; On desktop: show when chat is expanded */}
                {(isMobile ? !isSiteInfoCollapsed : !isChatCollapsed) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden shrink-0"
                  >
                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t-2 border-slate-200/60 dark:border-slate-800">
                      {/* Dominant Financial Plane */}
                      <div className="flex gap-2 w-full">
                        <div className={cn('flex-1 border p-3 transition-transform hover:-translate-y-0.5 duration-200', isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-300')}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total Billed</p>
                          <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                            {currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalBilled).toLocaleString()}` : '***'}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {data.siteInvoices.length} INVOICE{data.siteInvoices.length !== 1 ? 'S' : ''}
                          </span>
                        </div>
                        <div className={cn('flex-1 border p-3 transition-transform hover:-translate-y-0.5 duration-200', isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-300')}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Unpaid</p>
                          <p className={cn('text-base sm:text-lg font-black truncate', data.outstanding > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500')}>
                            {currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.outstanding).toLocaleString()}` : '***'}
                          </p>
                        </div>
                      </div>

                      {/* Dense Operational Data Block */}
                      <div className="flex flex-col gap-2">
                        <details className={cn('border p-2 sm:p-2.5 group transition-all duration-200 relative', isDark ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-400')}>
                          <summary className="outline-none list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                Machine Days
                              </p>
                              {data.machineDaysBreakdown.length > 0 && (
                                <span className="text-[8px] whitespace-nowrap bg-slate-200 dark:bg-slate-700 px-1 rounded text-slate-600 dark:text-slate-300 group-hover:bg-slate-300 dark:group-hover:bg-slate-600 transition-colors">Click for Detail ▼</span>
                              )}
                            </div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">{data.machineDays}</p>
                          </summary>
                          {data.machineDaysBreakdown.length > 0 && (
                            <div className="mt-2 flex flex-col gap-0.5 w-full text-[10px] max-h-32 overflow-y-auto style-scroll pt-1 border-t border-slate-200 dark:border-slate-700">
                              {data.machineDaysBreakdown.map((m, idx) => (
                                <div key={idx} className="flex justify-between pb-0.5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate pr-2">{m.name}</span>
                                  <span className="text-slate-500 shrink-0">{m.total}d</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </details>

                        <div className="grid grid-cols-3 gap-2">
                          <div className={cn('border p-2 sm:p-2.5 group transition-all duration-200', isDark ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-400')}>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Tasks</p>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">{data.siteTasks.length}</p>
                          </div>
                          <div className={cn('border p-2 sm:p-2.5 group transition-all duration-200', isDark ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-400')}>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Diesel</p>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">{Math.round(data.totalDiesel).toLocaleString()}L</p>
                            <p className="text-[8px] font-mono text-slate-400 truncate hidden sm:block mt-0.5">{data.machineLogs.length} LOGS</p>
                          </div>
                          <div className={cn('border p-2 sm:p-2.5 group transition-all duration-200', isDark ? 'border-slate-700 hover:border-slate-500' : 'border-slate-200 hover:border-slate-400')}>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Maint.</p>
                            <p className="text-sm font-black text-rose-600 dark:text-rose-500 mt-0.5 truncate">
                              {currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalMaintenanceCost).toLocaleString()}` : '***'}
                            </p>
                            <p className="text-[8px] font-mono text-slate-400 truncate hidden sm:block mt-0.5">{data.siteMaintAssets.length} ASSETS</p>
                          </div>
                        </div>

                        {/* Pumps Full Width Row */}
                        <div 
                          onClick={() => setActiveTab('operations')}
                          className={cn('border p-3 group transition-all duration-200 cursor-pointer hover:-translate-y-0.5 flex flex-col gap-2', isDark ? 'border-cyan-900/60 hover:border-cyan-700 bg-slate-900/30' : 'border-cyan-200 hover:border-cyan-400 bg-cyan-50/20')}
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 rounded-lg shrink-0">
                                <Droplets className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Pumps on Site</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 leading-none">
                                    {data.pumpsOnSite.length}
                                  </span>
                                  <Badge className={cn(
                                    "text-[8px] font-bold uppercase tracking-wider px-1 py-0 border shrink-0",
                                    data.activePumpsCount > 0 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50"
                                      : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800"
                                  )}>
                                    {data.activePumpsCount > 0 ? `${data.activePumpsCount} Active` : 'Inactive'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900/50 px-2.5 py-1 rounded-xl text-cyan-600 dark:text-cyan-400 font-extrabold group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800 transition-colors">Details</span>
                          </div>
                          
                          {data.pumpsOnSite.length > 0 && (
                            <div className="flex items-center justify-between w-full border-t border-slate-100 dark:border-slate-800/40 pt-2 mt-0.5">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Operation Window</span>
                              <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                {data.earliestPumpStart ? formatDisplayDate(data.earliestPumpStart) : '—'}
                                {' → '}
                                {data.latestPumpStop ? formatDisplayDate(data.latestPumpStop) : 'Running'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert, i) => (
                <div key={i} className={cn('p-3 rounded-xl border flex items-center gap-3',
                  alert.type === 'danger'
                    ? (isDark ? 'bg-rose-900/20 border-rose-800/50' : 'bg-rose-50 border-rose-200')
                    : (isDark ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-50 border-amber-200')
                )}>
                  <AlertTriangle className={cn('w-4 h-4 shrink-0', alert.type === 'danger' ? 'text-rose-500' : 'text-amber-500')} />
                  <p className={cn('text-sm font-semibold', alert.type === 'danger' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>{alert.title}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className={cn('flex items-center justify-between border-b mb-6 gap-2 min-w-0 overflow-hidden', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <div className="flex items-center gap-1 overflow-x-auto style-scroll pb-px flex-1 min-w-0">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 min-[480px]:gap-1.5 px-3 min-[480px]:px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors shrink-0',
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="shrink-0 pb-1">
              {currentUser?.privileges?.sites?.canEditSite && (
                <Button onClick={() => onEditSite(site)} variant="outline" size="sm" title="Edit Site" className={cn("h-8 text-xs px-2 font-medium shadow-sm transition-colors flex items-center gap-1", isDark ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700")}>
                  <Settings2 className="w-3.5 h-3.5 shrink-0" /><span className="hidden min-[600px]:inline">Edit Site</span>
                </Button>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-5">

            {/* FINANCIALS */}
            {activeTab === 'financials' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out space-y-5">
                {/* Financial Sub-Tabs */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { id: 'invoices', label: 'Invoices', count: data.siteInvoices.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalBilled).toLocaleString()}` : '***', icon: FileText },
                    { id: 'payments', label: 'Payments', count: data.sitePayments.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalReceived).toLocaleString()}` : '***', icon: DollarSign },
                    { id: 'expenses', label: 'Expenses', count: data.siteCosts.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalCost).toLocaleString()}` : '***', icon: FileText },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setFinTab(t.id as any)}
                      className={cn(
                        "flex flex-col items-start p-3 sm:p-4 rounded-xl border text-left transition-all duration-200 outline-none w-full",
                        finTab === t.id
                          ? "bg-blue-50/50 border-blue-500 shadow-sm dark:bg-blue-900/20 dark:border-blue-500"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1 sm:mb-2">
                        <span className={cn(
                          "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                          finTab === t.id ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                        )}>
                          <t.icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.label} {t.count !== null && `(${t.count})`}</span>
                        </span>
                        {finTab === t.id && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className={cn(
                        "text-sm sm:text-lg lg:text-xl font-black truncate w-full",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}>{t.amount}</p>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}


                {finTab === 'invoices' && (
                  <div className={cn(card, "")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-indigo-500" /> Invoices ({data.siteInvoices.length})</h3>
                    {data.siteInvoices.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.siteInvoices.map(inv => {
                          const { isPaid } = invoicePaymentMap[inv.id] || { paid: 0, isPaid: false };
                          return (
                            <div
                              key={inv.id}
                              onClick={() => setSelectedInvoice(inv)}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-3 rounded-xl transition-colors"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                    {inv.invoiceNumber || inv.id.slice(0, 8)}
                                  </span>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">
                                    {inv.billingCycle || 'Custom'}
                                  </span>
                                </div>
                                
                                {/* Dates breakdown */}
                                {(() => {
                                  const { startDate, projectedEndDate, actualEndDate, duration } = getInvoiceDates(inv);
                                  return (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                      <span>
                                        <span className="font-medium text-slate-400">Start:</span> {formatDisplayDate(startDate)}
                                      </span>
                                      <span>
                                        <span className="font-medium text-slate-400">Duration:</span> {duration} {duration === 1 ? 'day' : 'days'}
                                      </span>
                                      <span>
                                        <span className="font-medium text-slate-400">Projected End:</span> {formatDisplayDate(projectedEndDate)}
                                      </span>
                                      {actualEndDate && (
                                        <span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-50/80 dark:bg-amber-950/20 px-1 rounded border border-amber-100 dark:border-amber-900/50">
                                          <span className="text-slate-400 font-normal">Actual End:</span> {formatDisplayDate(actualEndDate)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                                <p className="font-bold text-sm">
                                  {currentUser?.privileges?.billing?.canViewAmounts ? `₦${(inv.totalCharge || inv.amount || 0).toLocaleString()}` : '***'}
                                </p>
                                <Badge className={isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                  {isPaid ? 'Paid' : 'Unpaid'}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No invoices for this site in the selected period.</p>}
                  </div>
                )}

                {finTab === 'payments' && (
                  <div className={cn(card, "")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5 text-emerald-500" /> Payments Received ({data.sitePayments.length})</h3>
                    {data.sitePayments.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.sitePayments.map(pay => (
                          <div key={pay.id} className="py-3 flex items-center justify-between gap-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                            <div>
                              <p className="font-semibold text-sm">Payment · {pay.date ? pay.date : '—'}</p>
                              <p className="text-xs text-slate-500">VAT Included: {pay.payVat || 'No'} {pay.vat ? (currentUser?.privileges?.billing?.canViewAmounts ? `(₦${pay.vat.toLocaleString()})` : '(***)') : ''}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{currentUser?.privileges?.billing?.canViewAmounts ? `₦${(pay.amount || 0).toLocaleString()}` : '***'}</p>
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Received</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No payments recorded for this site in the selected period.</p>}
                  </div>
                )}

                {finTab === 'expenses' && (
                  <div className={cn(card, "")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-rose-500" /> Site Expenses ({data.siteCosts.length})</h3>
                    {data.siteCosts.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.siteCosts.map(cost => (
                          <div key={cost.id} className="py-3 flex items-center justify-between gap-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                            <div>
                              <p className="font-semibold text-sm">{cost.description || cost.category || 'Expense'}</p>
                              <p className="text-xs text-slate-500">{cost.date ? cost.date : '—'} · {cost.category} {cost.vendor ? `· ${cost.vendor}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-sm text-rose-600 dark:text-rose-400">{currentUser?.privileges?.billing?.canViewAmounts ? `₦${(cost.amount || 0).toLocaleString()}` : '***'}</p>
                              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">Expense</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No expenses recorded for this site in the selected period.</p>}
                  </div>
                )}
              </div>
            )}

            {/* OPERATIONS */}
            {activeTab === 'operations' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out space-y-5">

                {/* ── Pumps on Site Panel ── */}
                <div className={cn(card, 'border-cyan-200 dark:border-cyan-900/60')}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-cyan-100 dark:border-cyan-900/40 flex-wrap gap-2">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                      <Droplets className="w-5 h-5" /> Pumps on Site
                      <span className={cn(
                        'text-xs font-extrabold px-2 py-0.5 rounded-full',
                        isDark ? 'bg-cyan-900/50 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                      )}>{data.pumpsOnSite.length}</span>
                    </h3>
                    {/* Site-wide operation window */}
                    {data.pumpsOnSite.length > 0 && (
                      <div className={cn(
                        'flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border',
                        isDark ? 'bg-cyan-950/30 border-cyan-900/60 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                      )}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {data.earliestPumpStart
                            ? new Date(data.earliestPumpStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                          {' → '}
                          {data.latestPumpStop
                            ? new Date(data.latestPumpStop).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span className="text-emerald-600 dark:text-emerald-400 font-bold">Running</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {data.pumpsOnSite.length > 0 ? (
                    <div className="divide-y divide-cyan-50 dark:divide-cyan-900/30">
                      {data.pumpsOnSite.map(pump => {
                        const isRunning = !pump.pumpStopDate;
                        return (
                          <div key={pump.id} className="py-3 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={cn(
                                'mt-0.5 p-1.5 rounded-lg shrink-0',
                                isRunning
                                  ? (isDark ? 'bg-emerald-900/40' : 'bg-emerald-50')
                                  : (isDark ? 'bg-slate-800' : 'bg-slate-100')
                              )}>
                                <Droplets className={cn('w-4 h-4', isRunning ? 'text-emerald-500' : 'text-slate-400')} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{pump.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                  <span className="text-slate-400">Start:</span>
                                  <span className="font-medium">
                                    {pump.pumpStartDate ? new Date(pump.pumpStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <span className="text-slate-400">Stop:</span>
                                  {pump.pumpStopDate
                                    ? <span className="font-medium">{new Date(pump.pumpStopDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    : <span className="font-bold text-emerald-600 dark:text-emerald-400">Ongoing</span>}
                                </p>
                              </div>
                            </div>
                            <Badge className={cn(
                              'shrink-0 text-[10px] font-bold uppercase tracking-wide',
                              isRunning
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            )}>
                              {isRunning ? 'Active' : 'Stopped'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 flex flex-col items-center gap-2">
                      <Droplets className="w-10 h-10 text-cyan-300 opacity-50" />
                      <p className="text-slate-500 font-medium text-sm">No pumps configured for this site</p>
                      <p className="text-slate-400 text-xs">Pump dates are set in the Site Inventory view.</p>
                    </div>
                  )}
                </div>

                <div className={card}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-500" /> Operational Hub
                    </h3>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl overflow-x-auto style-scroll max-w-full">
                      {[
                        { id: 'logs', label: 'Machine Logs', count: data.machineLogs.length, icon: ClipboardList, activeColor: 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' },
                        { id: 'materials', label: 'Materials on Site', count: data.materialsOnSite.length, icon: Package, activeColor: 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold shadow-sm' },
                        { id: 'waybills', label: 'Waybills', count: data.siteWaybills.length, icon: Truck, activeColor: 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' },
                      ].map(subTab => (
                        <button
                          key={subTab.id}
                          type="button"
                          onClick={() => setOperationsSubTab(subTab.id as any)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border-0 cursor-pointer whitespace-nowrap",
                            operationsSubTab === subTab.id
                              ? subTab.activeColor
                              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <subTab.icon className="w-3.5 h-3.5" />
                          <span>{subTab.label}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-extrabold",
                            operationsSubTab === subTab.id
                              ? (subTab.id === 'logs' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' :
                                 subTab.id === 'materials' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                                 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300')
                              : "bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          )}>
                            {subTab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operational Sub-Tabs Content */}
                  {operationsSubTab === 'logs' && (
                    <div className="space-y-1">
                      {data.machineLogs.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.machineLogs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                            <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm">{log.assetName}</p>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                  <Calendar className="w-3 h-3" />{new Date(log.date).toLocaleDateString('en-GB')}
                                  <Fuel className="w-3 h-3 ml-1" />{log.dieselUsage}L
                                </p>
                                {log.issuesOnSite && <p className="text-xs text-amber-600 mt-1">{log.issuesOnSite}</p>}
                                {log.maintenanceDetails && <p className="text-xs text-slate-400 mt-1">{log.maintenanceDetails}</p>}
                              </div>
                              <Badge className={log.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                                {log.isActive ? `Active · ${log.operationalDay || 'full'}` : 'Inactive'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <ClipboardList className="w-10 h-10 text-slate-400 mb-2 opacity-60" />
                          <p className="text-slate-500 font-medium text-sm">No machine logs in this period</p>
                          <p className="text-slate-400 text-xs mt-0.5">Machine activity registers here daily.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {operationsSubTab === 'materials' && (
                    <div className="space-y-1">
                      {data.materialsOnSite.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.materialsOnSite.map(item => (
                            <div key={item.id} className="py-3 flex items-center justify-between gap-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                              <div>
                                <p className="font-semibold text-sm">{item.name}</p>
                                <p className="text-xs text-slate-500">Asset Ref: {item.id.slice(0, 8)} · Type: {item.category || 'Material'}</p>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                  Qty: {item.quantity}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <Package className="w-10 h-10 text-slate-400 mb-2 opacity-60" />
                          <p className="text-slate-500 font-medium text-sm">No materials on site</p>
                          <p className="text-slate-400 text-xs mt-0.5">Use waybills to dispatch materials or equipment to this site.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {operationsSubTab === 'waybills' && (
                    <div className="space-y-1">
                      {data.siteWaybills.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.siteWaybills.map(wb => (
                            <div key={wb.id} className="py-3 flex flex-col gap-2 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-sm capitalize">{wb.type} · REF-{wb.id.substring(0, 8).toUpperCase()}</p>
                                  <p className="text-xs text-slate-500">Date: {wb.issueDate ? new Date(wb.issueDate).toLocaleDateString('en-GB') : '—'} · Driver: {wb.driverName || 'Admin'}</p>
                                </div>
                                <Badge className={cn('text-xs capitalize', 
                                  wb.type === 'waybill' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                )}>
                                  {wb.type}
                                </Badge>
                              </div>
                              {wb.items && wb.items.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pl-2 mt-1">
                                  {wb.items.map((it: any, index: number) => (
                                    <span key={index} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">
                                      {it.assetName} ({it.quantity})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <Truck className="w-10 h-10 text-slate-400 mb-2 opacity-60" />
                          <p className="text-slate-500 font-medium text-sm">No waybills recorded</p>
                          <p className="text-slate-400 text-xs mt-0.5">Waybill documentation will appear here once registered.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MAINTENANCE */}
            {activeTab === 'maintenance' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: 'Assets Tracked', value: data.siteMaintAssets.length, color: 'text-indigo-600' },
                    { label: 'Sessions', value: data.siteMaintSessions.length, color: 'text-amber-600' },
                    { label: 'Total Cost', value: `₦${Math.round(data.totalMaintenanceCost).toLocaleString()}`, color: 'text-rose-500' },
                  ].map(k => (
                    <div key={k.label} className={cn(card, "p-3 sm:p-5 min-w-0 flex flex-col justify-between")}>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 truncate">{k.label}</p>
                      <p className={cn('text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black truncate', k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-5')}>
                  <div className={card}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-amber-500" /> Assets on Site
                      </h3>
                      {currentUser?.privileges?.opsMaintenance?.canAdd && (
                        <Button
                          onClick={() => navigate('/operations/maintenance')}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-7 px-2.5 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Log Maintenance</span>
                        </Button>
                      )}
                    </div>
                    {data.siteMaintAssets.length > 0 ? data.siteMaintAssets.map(asset => {
                      const color = asset.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : asset.status === 'due_soon' ? 'bg-amber-100 text-amber-700' : asset.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';
                      return (
                        <div key={asset.id} className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">{asset.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Last: {asset.lastServiceDate ? new Date(asset.lastServiceDate).toLocaleDateString('en-GB') : '—'} · Next: {asset.nextServiceDate ? new Date(asset.nextServiceDate).toLocaleDateString('en-GB') : '—'}</p>
                          </div>
                          <Badge className={cn('text-xs capitalize', color)}>{asset.status.replace('_', ' ')}</Badge>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <p className="text-slate-500 text-sm">No maintenance assets tracked.</p>
                        <Button
                          onClick={() => navigate('/operations/maintenance')}
                          size="sm"
                          variant="outline"
                          className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-400 dark:hover:bg-indigo-950/30 text-xs font-bold"
                        >
                          Go to Maintenance Manager
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className={card}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-lg">Recent Sessions</h3>
                      {data.siteMaintSessions.length > 0 && (
                        <Button
                          onClick={() => navigate('/operations/maintenance')}
                          size="sm"
                          variant="ghost"
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 text-xs font-bold"
                        >
                          View All
                        </Button>
                      )}
                    </div>
                    {data.siteMaintSessions.length > 0 ? data.siteMaintSessions.slice(0, 8).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => (
                      <div key={session.id} className={cn('p-3 rounded-xl border mb-3', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                        <div className="flex justify-between mb-1">
                          <p className="font-semibold text-sm capitalize">{session.type} Maintenance</p>
                          <span className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString('en-GB')}</span>
                        </div>
                        <p className="text-xs text-slate-500">Tech: {session.technician}</p>
                        {session.generalRemark && <p className="text-xs text-slate-400 mt-1">{session.generalRemark}</p>}
                        <p className="text-xs font-bold mt-1 text-rose-500">Cost: ₦{session.assets.reduce((a, x) => a + (x.cost || 0), 0).toLocaleString()}</p>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <p className="text-slate-500 text-sm">No maintenance sessions.</p>
                        {currentUser?.privileges?.opsMaintenance?.canAdd && (
                          <Button
                            onClick={() => navigate('/operations/maintenance')}
                            size="sm"
                            variant="outline"
                            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-400 dark:hover:bg-indigo-950/30 text-xs font-bold"
                          >
                            Log Maintenance Session
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TASKS */}
            {activeTab === 'tasks' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out space-y-5">
                <div className={card}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" /> Tasks Dashboard
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl overflow-x-auto style-scroll max-w-full">
                        {[
                          { id: 'pending', label: 'Pending', count: data.pendingSiteTasks.length, icon: CheckSquare, activeColor: 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' },
                          { id: 'approval', label: 'Approval', count: data.approvalSiteTasks.length, icon: ShieldAlert, activeColor: 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold shadow-sm' },
                          { id: 'completed', label: 'Completed', count: data.completedSiteTasks.length, icon: CheckCircle2, activeColor: 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' },
                        ].map(subTab => (
                          <button
                            key={subTab.id}
                            type="button"
                            onClick={() => setTaskSubTab(subTab.id as any)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border-0 cursor-pointer whitespace-nowrap",
                              taskSubTab === subTab.id
                                ? subTab.activeColor
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                          >
                            <subTab.icon className="w-3.5 h-3.5" />
                            <span>{subTab.label}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-extrabold",
                              taskSubTab === subTab.id
                                ? (subTab.id === 'pending' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' :
                                   subTab.id === 'approval' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                                   'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300')
                                : "bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            )}>
                              {subTab.count}
                            </span>
                          </button>
                        ))}
                      </div>
                      {currentUser?.privileges?.tasks?.canCreateTasks && (
                        <Button
                          onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-7 px-2.5 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Task</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline Task Form */}
                  {showAddTaskForm && (
                    <div className="mb-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 space-y-4 animate-in slide-in-from-top duration-200">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">Create New Site Task</h4>
                        <button
                          type="button"
                          onClick={() => setShowAddTaskForm(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 bg-transparent border-0 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateTaskSubmit} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Task Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="What needs to be done?"
                            value={taskTitle}
                            onChange={e => setTaskTitle(e.target.value)}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                              isDark ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                            )}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Description</label>
                          <textarea
                            placeholder="Provide details about the task..."
                            value={taskDesc}
                            onChange={e => setTaskDesc(e.target.value)}
                            rows={2}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none",
                              isDark ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Assignee(s)</label>
                            <div className={cn(
                              "w-full rounded-lg border p-1.5 overflow-y-auto h-24 space-y-0.5 focus-within:ring-2 focus-within:ring-indigo-500",
                              isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-800"
                            )}>
                              {users.filter(u => u.isActive !== false).map(u => {
                                const isChecked = taskAssignees.includes(u.id);
                                return (
                                  <label
                                    key={u.id}
                                    className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-colors text-xs"
                                  >
                                    <span>{u.name || u.email}</span>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setTaskAssignees(taskAssignees.filter(id => id !== u.id));
                                        } else {
                                          setTaskAssignees([...taskAssignees, u.id]);
                                        }
                                      }}
                                      className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer ml-2"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Select one or more assignees.</p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Deadline</label>
                              <input
                                type="date"
                                value={taskDeadline}
                                onChange={e => setTaskDeadline(e.target.value)}
                                className={cn(
                                  "w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                  isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-800"
                                )}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Priority</label>
                              <div className="flex gap-2">
                                {(['low', 'medium', 'high'] as const).map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setTaskPriority(p)}
                                    className={cn(
                                      "flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border capitalize transition-all cursor-pointer",
                                      taskPriority === p
                                        ? p === 'low'
                                          ? "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                          : p === 'medium'
                                          ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300"
                                          : "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300"
                                        : isDark
                                        ? "bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-850/80 pt-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="task-approval-toggle"
                                checked={taskRequiresApproval}
                                onChange={e => setTaskRequiresApproval(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <label htmlFor="task-approval-toggle" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                Requires Completion Approval
                              </label>
                            </div>

                            {taskRequiresApproval && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Approver:</span>
                                  <select
                                    value={taskApprover}
                                    onChange={e => setTaskApprover(e.target.value)}
                                    className={cn(
                                      "rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                      isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-200 text-slate-800"
                                    )}
                                  >
                                    <option value="">Select User</option>
                                    {users.filter(u => u.isActive !== false).map(u => (
                                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                    ))}
                                  </select>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            type="submit"
                            disabled={isSubmittingTask}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 rounded-xl h-9 text-xs font-bold"
                          >
                            {isSubmittingTask ? 'Creating...' : 'Create Task'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddTaskForm(false)}
                            className="rounded-xl h-9 text-xs px-4"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Task list based on tab */}
                  {taskSubTab === 'pending' && (
                    <div className="space-y-1">
                      {data.pendingSiteTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.pendingSiteTasks.map(task => renderTaskRow(task, 'pending'))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                          <p className="text-slate-500 font-medium text-sm">All pending tasks completed!</p>
                          <p className="text-slate-400 text-xs mt-0.5">There are no active or pending tasks for this site.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {taskSubTab === 'approval' && (
                    <div className="space-y-1">
                      {data.approvalSiteTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.approvalSiteTasks.map(task => renderTaskRow(task, 'approval'))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <ShieldCheck className="w-10 h-10 text-indigo-500 mb-2 opacity-80" />
                          <p className="text-slate-500 font-medium text-sm">No tasks pending approval</p>
                          <p className="text-slate-400 text-xs mt-0.5">Everything is up to date and verified.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {taskSubTab === 'completed' && (
                    <div className="space-y-1">
                      {data.completedSiteTasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.completedSiteTasks.map(task => renderTaskRow(task, 'completed'))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <Clock className="w-10 h-10 text-slate-400 mb-2 opacity-60" />
                          <p className="text-slate-500 font-medium text-sm">No completed tasks yet</p>
                          <p className="text-slate-400 text-xs mt-0.5">Tasks will appear here once they are finished.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* COMMS */}
            {activeTab === 'comms' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out space-y-5">
                <div className={card}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-blue-500" /> Communication Logs ({data.siteComms.length})</h3>
                    {currentUser?.privileges?.commLog?.canAdd && (
                      <Button onClick={() => setShowCommDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 rounded-xl h-9 px-2.5 sm:px-3 shrink-0">
                        <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Log</span>
                      </Button>
                    )}
                  </div>
                  {data.siteComms.length > 0 ? (
                    <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-700 space-y-4">
                      {data.siteComms.slice(0, 10).map(log => (
                        <div key={log.id} className="relative">
                          <div className="absolute -left-[25px] bg-slate-200 dark:bg-slate-700 rounded-full p-1">
                            <MessagesSquare className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </div>
                          <p className="font-semibold text-sm">{log.subject || 'Communication'} <span className="text-xs text-slate-400 font-normal ml-1">{new Date(log.date).toLocaleDateString('en-GB')}</span></p>
                          <p className="text-xs text-slate-500 mt-0.5">{log.notes}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm text-center py-8">No communication logs.</p>}
                </div>
              </div>
            )}

            {/* CONTACTS */}
            {activeTab === 'contacts' && (
              <div className="animate-in fade-in zoom-in-[0.98] duration-200 ease-out">
                <ClientContactsPanel
                  clientName={site.client || site.name}
                  onClose={() => setActiveTab('financials')}
                  siteId={site.id}
                  inline
                />
              </div>
            )}

          </div>

          <InvoiceDetailDialog
            invoice={selectedInvoice}
            invoiceList={data.siteInvoices}
            open={!!selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onNavigate={setSelectedInvoice}
            onEdit={() => alert('To edit this invoice, please visit the Invoices & Billing module.')}
            onPrint={() => alert('To print this invoice, please visit the Invoices & Billing module.')}
          />

          <ExternalCommDialog
            open={showCommDialog}
            onClose={() => setShowCommDialog(false)}
            site={site}
            contacts={data.siteContacts}
            onSave={(log) => {
              addCommLog(log);
              alert('External communication log added successfully!');
            }}
          />
        </div>
      </div>
      
      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </div>
  );
}

function ExternalCommDialog({ open, onClose, site, contacts = [], onSave }: { open: boolean; onClose: () => void; site: Site; contacts: any[]; onSave: (log: any) => void }) {
  const { user: authUser } = useAuth();
  const [form, setForm] = useState({
    subject: '',
    notes: '',
    direction: 'Outgoing' as 'Incoming' | 'Outgoing',
    channel: 'Email' as 'Email' | 'Phone' | 'WhatsApp' | 'In-Person' | 'Official Letter',
    contactPerson: '',
    outcome: '',
    followUpDate: '',
  });
  const [isAddingNewContact, setIsAddingNewContact] = useState(false);
  const [selectedContactVal, setSelectedContactVal] = useState('');

  // Reset form states cleanly when modal is toggled
  useEffect(() => {
    if (open) {
      setForm({
        subject: '',
        notes: '',
        direction: 'Outgoing',
        channel: 'Email',
        contactPerson: '',
        outcome: '',
        followUpDate: '',
      });
      setIsAddingNewContact(false);
      setSelectedContactVal('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.notes.trim()) {
      alert('Please enter communication notes');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      date: today,
      direction: form.direction,
      channel: form.channel,
      contactType: 'Client',
      client: site.client || site.name,
      siteId: site.id,
      siteName: site.name,
      contactPerson: form.contactPerson.trim() || undefined,
      subject: form.subject.trim() || undefined,
      notes: form.notes,
      outcome: form.outcome.trim() || undefined,
      followUpDate: form.followUpDate || undefined,
      followUpDone: false,
      loggedBy: authUser?.user_metadata?.name || authUser?.email || 'Admin',
      createdAt: new Date().toISOString(),
      isInternal: false,
    });
    onClose();
    setForm({
      subject: '',
      notes: '',
      direction: 'Outgoing',
      channel: 'Email',
      contactPerson: '',
      outcome: '',
      followUpDate: '',
    });
    setIsAddingNewContact(false);
    setSelectedContactVal('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Log External Communication</h3>
            <p className="text-xs text-slate-500">For {site.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-semibold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Direction</label>
              <select
                value={form.direction}
                onChange={e => setForm({ ...form, direction: e.target.value as any })}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Outgoing">Outgoing</option>
                <option value="Incoming">Incoming</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Channel</label>
              <select
                value={form.channel}
                onChange={e => setForm({ ...form, channel: e.target.value as any })}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="In-Person">In-Person</option>
                <option value="Official Letter">Official Letter</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Subject / Summary</label>
            <input
              type="text"
              placeholder="E.g. Quotation sent, Site inspection meeting..."
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Contact Person (Optional)</label>
            <select
              value={selectedContactVal}
              onChange={e => {
                const val = e.target.value;
                setSelectedContactVal(val);
                if (val === 'ADD_NEW') {
                  setIsAddingNewContact(true);
                  setForm(f => ({ ...f, contactPerson: '' }));
                } else {
                  setIsAddingNewContact(false);
                  setForm(f => ({ ...f, contactPerson: val }));
                }
              }}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Existing Contact...</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.position ? `(${c.position})` : ''}
                </option>
              ))}
              <option value="ADD_NEW" className="text-indigo-600 font-bold dark:text-indigo-400">+ Add New Contact</option>
            </select>

            {isAddingNewContact && (
              <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">New Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter contact name..."
                  value={form.contactPerson}
                  onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Notes *</label>
            <textarea
              rows={3}
              required
              placeholder="Details of the conversation or interaction..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Outcome / Next Steps (Optional)</label>
            <input
              type="text"
              placeholder="E.g. Client to approve quotation by Friday"
              value={form.outcome}
              onChange={e => setForm({ ...form, outcome: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Follow-up Date (Optional)</label>
            <input
              type="date"
              value={form.followUpDate}
              onChange={e => setForm({ ...form, followUpDate: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Save Log</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
