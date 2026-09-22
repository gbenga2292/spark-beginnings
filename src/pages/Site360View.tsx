import { useMemo, useState, useRef, useEffect } from 'react';
import { parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

import {
  Building2, ArrowLeft, MapPin, DollarSign, Activity, Wrench, MessagesSquare,
  AlertTriangle, Clock, Fuel, Calendar, FileText, Users, Settings2,
  ChevronDown, Sparkles, RefreshCcw, Send, ChevronUp, Filter, CheckCircle2, Plus, Pencil, ChevronRight,
  CheckSquare, ShieldAlert, ShieldCheck, ClipboardList, Package, Truck, X, Phone, Mail, Droplets,
  PauseCircle, PlayCircle, History, RotateCcw,
  Zap, ListPlus, Check, ListTodo,
} from 'lucide-react';

import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { toast } from 'sonner';
import { useAppStore, Site, Invoice } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle, useAutoCollapseSidebar } from '@/src/contexts/PageContext';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { ClientContactsPanel } from './ClientContactsPanel';
import { TaskDetailSheet } from '@/src/components/tasks/TaskDetailSheet';
import { AddSubtaskInline } from './Tasks/AddSubtaskInline';
import { CreateTaskDialog } from './Tasks/CreateTaskDialog';
import { QuickTaskDialog } from '@/src/components/tasks/QuickTaskDialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/src/components/ui/dropdown-menu';
import { SiteGanttStoryboard } from '@/src/components/sites/SiteGanttStoryboard';
import { SiteMilestonesCard } from '@/src/components/sites/SiteMilestonesCard';
import { buildSettlementMap } from '@/src/lib/settlementUtils';


type SiteTab = 'timeline' | 'financials' | 'operations' | 'maintenance' | 'comms' | 'tasks' | 'contacts';

interface Props {
  site: Site;
  clientSites: Site[];
  onSiteChange: (site: Site) => void;
  onBack?: () => void;
  onEditSite?: (site: Site) => void;
}

interface LogEntry {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  metadata?: any;
}

const renderFormattedChatMessage = (content: string) => {
  if (!content) return null;

  const renderInlineText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|#[^#\s]+)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('#')) {
            return (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/50 mx-0.5">
                {part}
              </span>
            );
          }
          const cleanPart = part.replace(/\*\*/g, '').replace(/#/g, '');
          return <span key={i}>{cleanPart}</span>;
        })}
      </>
    );
  };

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed font-sans">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('#') || (/^\*\*[^*]+\*\*:?$/.test(trimmed) && trimmed.length < 60)) {
          const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/#/g, '').trim();
          return (
            <div key={idx} className="text-xs font-black tracking-wider text-blue-700 dark:text-blue-300 uppercase mt-3.5 mb-1.5 border-b border-slate-200 dark:border-slate-700/50 pb-1 flex items-center gap-1.5">
              <span>{cleanHeader}</span>
            </div>
          );
        }

        if (/^[-*•](\s+|$)/.test(trimmed) || /^\d+[\.\)](\s+|$)/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
          if (!bulletText) return null;
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 my-1 text-slate-800 dark:text-slate-100">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm select-none leading-none mt-0.5">•</span>
              <div className="flex-1">
                {renderInlineText(bulletText)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="my-1 text-slate-700 dark:text-slate-100">
            {renderInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export function Site360View({ site, clientSites, onSiteChange, onBack, onEditSite }: Props) {
  useAutoCollapseSidebar();
  const { isDark } = useTheme();
  const { createMainTask, users, addSubtask, updateSubtask } = useAppData();
  const { user: authUser } = useAuth();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const allSites = useAppStore(s => s.sites);
  const workspaceId = useAppStore(s => (s as any).workspaceId || 'default');
  const allClients = useMemo(() => {
    const names = new Set<string>();
    allSites.forEach(s => { 
      const name = s.client?.trim();
      if (name && name.toUpperCase() !== 'DCEL') names.add(name); 
    });
    return Array.from(names).sort();
  }, [allSites]);

  // Client sites sorted newest first by default
  const sortedClientSites = useMemo(() => {
    return [...(clientSites || [])].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const timeB = b.startDate ? new Date(b.startDate).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      if (timeA !== timeB) return timeB - timeA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [clientSites]);

  const handleSearchNavigation = (result: any) => {
    navigate(`/client-360?client=${encodeURIComponent(result.clientName)}&tab=${result.tab}`);
  };

  const navigate = useNavigate();
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showQuickTaskDialog, setShowQuickTaskDialog] = useState(false);


  const matchingClient = useMemo(() => {
    return clientProfiles?.find(c => c.name?.trim().toLowerCase() === site.client?.trim().toLowerCase());
  }, [clientProfiles, site.client]);
  const derivedClientId = matchingClient ? matchingClient.id : null;

  const [activeTab, setActiveTab] = useState<SiteTab>('timeline');
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
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isQuickStatsOpen, setIsQuickStatsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq'>('groq');
  const [selectedModel, setSelectedModel] = useState<string>('llama-3.1-8b-instant');
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: keysData } = await supabase
          .from('api_keys')
          .select('*')
          .eq('workspace_id', workspaceId);
        if (keysData) {
          setApiKeys(keysData);
          const defaultKey = keysData.find(k => k.is_default);
          if (defaultKey) {
            const prov = (defaultKey.provider === 'gemini' || defaultKey.provider === 'groq') ? defaultKey.provider : 'groq';
            setSelectedProvider(prov);
            setSelectedModel(defaultKey.default_model || (prov === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant'));
          } else if (keysData.length > 0) {
            const firstKey = keysData[0];
            const prov = (firstKey.provider === 'gemini' || firstKey.provider === 'groq') ? firstKey.provider : 'groq';
            setSelectedProvider(prov);
            setSelectedModel(firstKey.default_model || (prov === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant'));
          }
        }
      } catch {}
    })();
  }, [workspaceId]);

  const handleProviderChange = (p: 'gemini' | 'groq') => {
    setSelectedProvider(p);
    const matchingKey = apiKeys.find(k => k.provider === p);
    if (matchingKey && matchingKey.default_model) {
      setSelectedModel(matchingKey.default_model);
    } else {
      setSelectedModel(p === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.1-8b-instant');
    }
  };

  // Dynamic model options with a star for the default model configured in settings
  const modelOptions = useMemo(() => {
    const geminiDefaults = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const groqDefaults = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'];
    
    const defaults = selectedProvider === 'gemini' ? geminiDefaults : groqDefaults;
    
    const keyForProvider = apiKeys.find(k => k.provider === selectedProvider);
    const defaultModel = keyForProvider?.default_model || '';

    const modelsSet = new Set(defaults);
    if (defaultModel) {
      modelsSet.add(defaultModel);
    }

    const formatModelName = (model: string) => {
      if (model === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
      if (model === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';
      if (model === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
      if (model === 'llama-3.1-8b-instant') return 'Llama 3.1 8B';
      if (model === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B';
      if (model === 'mixtral-8x7b-32768') return 'Mixtral 8x7B';
      return model.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return Array.from(modelsSet).map(model => {
      const isDefault = model === defaultModel;
      return {
        value: model,
        label: isDefault ? `⭐ ${formatModelName(model)} (Default)` : formatModelName(model)
      };
    });
  }, [selectedProvider, apiKeys]);

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



  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [finTab, setFinTab] = useState<'invoices' | 'payments' | 'expenses' | 'vat'>('invoices');

  const { dailyMachineLogs, maintenanceAssets, maintenanceSessions, waybills, assets, sitePumpDates, siteHoldPeriods, addSiteHold, endSiteHold } = useOperations();
  const { mainTasks, subtasks } = useAppData();

  // ── Site Hold state & handlers ───────────────────────────────────────────
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdModalNote, setHoldModalNote] = useState('');
  const [holdModalDate, setHoldModalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);
  const [holdModalError, setHoldModalError] = useState('');

  const activeHold = useMemo(() => {
    return siteHoldPeriods.find(h => h.siteId === site.id && !h.holdEnd);
  }, [siteHoldPeriods, site.id]);
  const isOnHold = !!activeHold;

  const currentHoldDays = useMemo(() => {
    if (!activeHold) return 0;
    const s = new Date(activeHold.holdStart).getTime();
    const now = new Date().getTime();
    return Math.max(1, Math.round((now - s) / 86400000));
  }, [activeHold]);

  const handleConfirmHoldToggle = async () => {
    if (!holdModalNote.trim()) {
      setHoldModalError('A note is required.');
      return;
    }
    setIsSubmittingHold(true);
    setHoldModalError('');
    try {
      const actorName = currentUser?.name || authUser?.email || 'User';
      if (isOnHold && activeHold) {
        await endSiteHold(activeHold.id, holdModalNote.trim(), actorName, holdModalDate);
      } else {
        await addSiteHold(site.id, site.name, holdModalNote.trim(), actorName, holdModalDate);
      }
      setShowHoldModal(false);
      setHoldModalNote('');
    } catch (err: any) {
      console.error('Failed to toggle site hold:', err);
      setHoldModalError(err.message || 'Failed to update site hold status.');
    } finally {
      setIsSubmittingHold(false);
    }
  };

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const vatPayments = useAppStore(s => s.vatPayments);

  const settlementMap = useMemo(() => {
    return buildSettlementMap(invoices, payments);
  }, [invoices, payments]);

  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vatRate = useAppStore(s => s.payrollVariables.vatRate);
  const commLogs = useAppStore(s => s.commLogs);
  const addCommLog = useAppStore(s => s.addCommLog);
  const clientContacts = useAppStore(s => s.clientContacts);
  const dailyJournals = useAppStore(s => s.dailyJournals);
  const siteJournalEntries = useAppStore(s => s.siteJournalEntries);

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
    const totalDiscounts = sitePayments.reduce((a, p) => a + (p.discount || 0), 0);
    const totalWht = sitePayments.reduce((a, p) => a + (p.withholdingTax || 0), 0);
    const outstanding = Math.max(0, totalBilled - totalReceived - totalDiscounts - totalWht);

    const vatGenerated = 0; // VAT is only on payments, not invoices

    const getPaymentVatAmount = (p: any) => {
      if (p.vat !== undefined && p.vat !== null) return p.vat;
      // Proportional fallback if linked to an invoice with itemized VAT
      if (p.invoiceId) {
        const inv = invoices.find(i => i.id === p.invoiceId);
        if (inv) {
          const invTotal = Number((inv as any).totalCharge || (inv as any).amount || 0);
          const invVat = Number((inv as any).vat || 0);
          if (invTotal > 0 && invVat > 0) {
            return Math.round(((p.amount || 0) * (invVat / invTotal)) * 100) / 100;
          }
          if ((inv as any).vatInc === 'No') return 0;
        }
      }
      const baseAmount = (p.amount || 0) - (p.damages || 0);
      const payVat = p.payVat || 'No';
      let vatVal = 0;
      if (payVat === 'Add') vatVal = ((baseAmount * vatRate) / (100 + vatRate));
      else if (payVat === 'Yes') vatVal = ((baseAmount / (100 + vatRate)) * vatRate);
      return Math.round(vatVal * 100) / 100;
    };

    const periodVatCollected = sitePayments.reduce((sum, p) => sum + getPaymentVatAmount(p), 0);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const clientVatPayments = vatPayments.filter(vp => vp.client?.trim() === site.client?.trim());

    const prevPayments = payments.filter(p => (p.site?.trim() === site.name.trim() || p.client?.trim() === site.name.trim()) && isBeforeFilter(p.date));
    const prevVatCollected = prevPayments.reduce((sum, p) => sum + getPaymentVatAmount(p), 0);

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
      stats.active += dayVal;
      if (l.operationalDay === 'none' || !l.isActive) {
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

    // 1. All contacts registered under this client (filtered to this site or Principal, matching ClientContactsPanel)
    const allClientContacts = clientContacts.filter(c =>
      c.clientName?.trim().toLowerCase() === (site.client || site.name).trim().toLowerCase()
    );
    const siteFilteredContacts = allClientContacts.filter(c =>
      c.isPrincipal || (c.siteIds || []).includes(site.id)
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
      ...siteFilteredContacts.map(c => ({
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

  const card = cn('p-4 sm:p-5 rounded-md border shadow-none', isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200');

  const tabs: { id: SiteTab; label: string; count?: number | string; show?: boolean }[] = [
    { id: 'timeline', label: 'Timeline', show: true },
    { id: 'financials', label: 'Financials', count: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalBilled).toLocaleString()}` : undefined, show: currentUser?.privileges?.billing?.canView || currentUser?.privileges?.payments?.canView },
    { id: 'operations', label: 'Operations', count: data.machinesOnSiteCount + data.pumpsOnSite.length, show: currentUser?.privileges?.sites?.canView },
    { id: 'maintenance', label: 'Maintenance', count: data.siteMaintAssets.length, show: currentUser?.privileges?.sites?.canView },
    { id: 'comms', label: 'Comms', count: data.siteComms.length, show: currentUser?.privileges?.commLog?.canView },
    { id: 'tasks', label: 'Tasks', count: data.pendingSiteTasks.length, show: currentUser?.privileges?.tasks?.canView || currentUser?.privileges?.tasks?.canViewMyTasks },
    { id: 'contacts', label: 'Contacts', count: data.siteContacts.length, show: currentUser?.privileges?.clients?.canView },
  ].filter(tab => tab.show !== false) as { id: SiteTab; label: string; count?: number | string }[];

  // AI Chat
  const sendChatMessage = async (isInitialBrief = false) => {
    if (!isInitialBrief && !chatInput.trim()) return;

    let apiKey = '';
    let provider = selectedProvider;
    let model = selectedModel;

    try {
      const { data: keys } = await supabase
        .from('api_keys')
        .select('key_value,provider,default_model,is_default')
        .eq('workspace_id', workspaceId);
      if (keys && keys.length > 0) {
        const defaultKey = keys.find(k => k.is_default) || keys.find(k => k.provider === selectedProvider) || keys[0];
        if (defaultKey) {
          apiKey = defaultKey.key_value;
          provider = (defaultKey.provider === 'gemini' || defaultKey.provider === 'groq') ? defaultKey.provider : ((defaultKey.key_value?.startsWith('AIza') || defaultKey.key_value?.startsWith('AQ.')) ? 'gemini' : 'groq');
          if (defaultKey.default_model) model = defaultKey.default_model;
        }
      }
    } catch (err) {
      console.error('Failed to load API key from DB:', err);
    }

    if (!apiKey) {
      apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY') || '';
    }

    if (!apiKey) {
      apiKey = window.prompt(`Enter your ${provider === 'gemini' ? 'Gemini' : 'Groq'} API Key:`) || '';
      if (!apiKey) return;
      localStorage.setItem('GROQ_API_KEY', apiKey);
    }

    const newUserMessage = isInitialBrief ? 'Provide an Executive Intelligence Brief for this site covering financial health, field progress & dewatering stage, equipment/diesel status, and immediate priorities.' : chatInput;
    if (!isInitialBrief) { setMessages(prev => [...prev, { role: 'user', content: newUserMessage }]); setChatInput(''); }
    setIsGeneratingBrief(true);
    try {
      // Collect relevant site journal entries (matching site.id or site.name)
      const siteJournals = siteJournalEntries
        .filter(e => e.siteId === site.id || e.siteName?.trim().toLowerCase() === site.name?.trim().toLowerCase())
        .map(e => {
          const parentJournal = dailyJournals.find(j => j.id === e.journalId);
          const date = parentJournal?.date || e.createdAt?.split('T')[0] || 'Unknown Date';
          return {
            date,
            stage: e.dewateringStage || 'operational',
            progress: e.progressPercentage !== undefined ? `${e.progressPercentage}%` : 'N/A',
            narration: e.narration || 'No narrative logged',
            loggedBy: e.loggedBy || parentJournal?.loggedBy || 'Site Team'
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const siteJournalsSummary = siteJournals.slice(0, 15).map(j =>
        `[${j.date}] Stage: ${j.stage} | Progress: ${j.progress} | Logged by: ${j.loggedBy} -> "${j.narration}"`
      ).join('\n') || 'No site journal entries recorded yet.';

      const systemPrompt = `You are a Site 360 Intelligence Assistant for DCEL. Site: ${site.name} (${site.client}). Status: ${site.status}.
Financials: Billed ₦${data.totalBilled.toLocaleString()}, Received ₦${data.totalReceived.toLocaleString()}, Outstanding ₦${data.outstanding.toLocaleString()}, Profit ₦${data.profit.toLocaleString()}.
Operations: ${data.machineLogs.length} log days, ${data.activeDays} active days, ${data.totalDiesel}L diesel used.
Maintenance: ${data.siteMaintAssets.length} assets tracked. Overdue: ${data.siteMaintAssets.filter(a => a.status === 'overdue').map(a => a.name).join(', ') || 'None'}.
Pending Tasks: ${data.siteTasks.length}. Alerts: ${data.alerts.map(a => a.title).join('; ') || 'None'}.

📖 RECENT SITE JOURNALS & FIELD PROGRESS:
${siteJournalsSummary}

Answer site-specific questions and field progress accurately using this context. Be concise, structured, and insightful.`;

      let reply = '';
      if (provider === 'gemini') {
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        contents.push({ role: 'user', parts: [{ text: newUserMessage }] });
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          })
        });
        if (!res.ok) throw new Error('Gemini API Error');
        const resData = await res.json();
        reply = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, ...messages, { role: 'user', content: newUserMessage }], temperature: 0.3, max_tokens: 2048 }),
        });
        if (!res.ok) throw new Error('Groq API Error');
        const resData = await res.json();
        reply = resData.choices[0].message.content;
      }

      if (isInitialBrief) setMessages([{ role: 'assistant', content: reply }]);
      else setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch { if (!isInitialBrief) setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to connect to intelligence API.' }]); }
    finally { setIsGeneratingBrief(false); }
  };

  // Header actions with Filters dropdown, Site Selector, AI Assistant & Quick Stats
  const headerActions = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full justify-end">
      {/* Site Selector - Order First on Mobile */}
      <div className={cn('flex items-center gap-1.5 px-2 py-1 h-8 rounded-md border transition-colors order-first sm:order-last w-full sm:w-auto', isDark ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-300 hover:border-slate-400')}>
        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="relative flex items-center w-full">
          <select
            value={site.id}
            onChange={e => {
              const selected = sortedClientSites.find(s => s.id === e.target.value);
              if (selected) onSiteChange(selected);
            }}
            className={cn('appearance-none bg-transparent font-bold text-xs pr-5 focus:outline-none cursor-pointer w-full sm:max-w-[150px] truncate', isDark ? 'text-white' : 'text-slate-900')}
          >
            {sortedClientSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-0 pointer-events-none text-slate-400" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 justify-end">
        {/* Quick Stats Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsQuickStatsOpen(prev => !prev)}
          className={cn(
            "h-8 px-2.5 text-xs font-semibold flex items-center gap-1.5 rounded-md transition-colors",
            isQuickStatsOpen 
              ? (isDark ? "bg-slate-800 border-blue-500 text-blue-300" : "bg-slate-100 border-blue-400 text-blue-700")
              : (isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")
          )}
          title="Toggle Site Overview & Key Metrics"
        >
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden min-[480px]:inline">Quick Stats</span>
        </Button>

        {/* AI Assistant Trigger Button */}
        {currentUser?.privileges?.sites?.canViewDecisionIntelligence && (
          <Button
            size="sm"
            onClick={() => setIsAiDrawerOpen(true)}
            className="h-8 px-3 text-xs font-bold flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-[0_2px_12px_rgba(14,165,233,0.35)] transition-all border-0"
            title="Open Site Intelligence Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="hidden min-[480px]:inline">AI Brief</span>
          </Button>
        )}

        {/* Date Filter Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("h-8 w-8 p-0 flex items-center justify-center relative shrink-0 rounded-md", isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")}
            title="Filter by Month/Year"
          >
            <Filter className="w-3.5 h-3.5" />
            {(filterMonth !== 'all' || filterYear !== 'all') && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-950" />
            )}
          </Button>

          {showFilters && (
            <div className={cn("absolute right-0 top-full mt-2 p-3 rounded-lg border shadow-xl z-50 flex flex-col gap-3 w-56", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month</label>
                <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setShowFilters(false); }} className={cn('w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500', isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200')}>
                  <option value="all">All Months</option>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Year</label>
                <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setShowFilters(false); }} className={cn('w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500', isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200')}>
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

  useSetPageTitle('Site 360', `Operational command center for ${site.name}`, headerActions, [filterMonth, filterYear, site.name, isDark, showFilters, clientSites, isQuickStatsOpen, isAiDrawerOpen], onBack);



  const renderTaskRow = (task: any, statusType: 'pending' | 'approval' | 'completed') => {
    const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
    const completed = taskSubs.filter(s => s.status === 'completed').length;
    const isTagged = task.siteId === site.id;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div 
        key={task.id} 
        className={cn(
          "rounded-xl border transition-all duration-200 overflow-hidden",
          isDark 
            ? "bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm" 
            : "bg-white border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-sm"
        )}
      >
        <div 
          className="p-3.5 sm:p-4 flex items-start justify-between gap-3 cursor-pointer group"
          onClick={() => {
            const next = new Set(expandedTasks);
            if (next.has(task.id)) next.delete(task.id);
            else next.add(task.id);
            setExpandedTasks(next);
          }}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-200",
              isExpanded 
                ? "rotate-90 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" 
                : "text-slate-400 group-hover:text-blue-600 group-hover:bg-slate-50 dark:group-hover:bg-slate-800"
            )}>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn(
                  "font-semibold text-sm tracking-tight transition-colors group-hover:text-blue-600",
                  statusType === 'completed' ? "text-slate-400 line-through" : "text-slate-900 dark:text-slate-100"
                )}>
                  {task.title}
                </p>

                {isTagged && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                    <MapPin className="w-2.5 h-2.5 text-blue-500" />
                    <span>This Site</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                {task.deadline && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Due {new Date(task.deadline).toLocaleDateString('en-GB')}</span>
                  </span>
                )}
                {task.requestedBy && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span>By {task.requestedBy}</span>
                  </span>
                )}
                {taskSubs.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          completed === taskSubs.length ? "bg-emerald-500" : "bg-blue-500"
                        )} 
                        style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} 
                      />
                    </div>
                    <span>{completed}/{taskSubs.length} done</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            {task.priority && (
              <span className={cn(
                "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                task.priority === 'urgent' ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" :
                task.priority === 'high' ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" :
                task.priority === 'medium' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              )}>
                {task.priority}
              </span>
            )}
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-2 py-0.5 font-semibold uppercase tracking-wider",
                statusType === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60" :
                statusType === 'approval' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60" :
                "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60"
              )}
            >
              {statusType === 'completed' ? 'Completed' : statusType === 'approval' ? 'Approval' : 'Active'}
            </Badge>
          </div>
        </div>
        
        {/* Expanded Subtasks Checklist */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40"
            >
              <div className="p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between pb-1 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Checklist ({completed}/{taskSubs.length} completed)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 italic">Click checkbox to complete</span>
                </div>

                {taskSubs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2 py-1">No to-do subtasks logged.</p>
                ) : (
                  taskSubs.map(sub => {
                    const isDone = sub.status === 'completed';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => setOpenSubtaskId(sub.id!)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer group/item",
                          isDark 
                            ? "bg-slate-900 border-slate-800 hover:border-slate-700" 
                            : "bg-white border-slate-200/70 hover:border-blue-300 shadow-2xs hover:shadow-xs"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextStatus = isDone ? 'not_started' : 'completed';
                              updateSubtask(sub.id!, { status: nextStatus });
                            }}
                            className={cn(
                              "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                              isDone
                                ? "bg-blue-600 border-blue-600 text-white"
                                : isDark ? "border-slate-600 hover:border-blue-400 bg-slate-800" : "border-slate-300 hover:border-blue-500 bg-white"
                            )}
                            title={isDone ? "Mark incomplete" : "Mark completed"}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          
                          <p className={cn(
                            "text-xs sm:text-[13px] font-medium truncate transition-colors",
                            isDone 
                              ? "line-through text-slate-400 dark:text-slate-500" 
                              : "text-slate-700 dark:text-slate-200 group-hover/item:text-blue-600"
                          )}>
                            {sub.title}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                            isDone ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60" :
                            sub.status === 'in_progress' ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60" :
                            sub.status === 'pending_approval' ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60" :
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60"
                          )}>
                            {isDone ? 'Completed' : sub.status === 'in_progress' ? 'In Progress' : sub.status === 'pending_approval' ? 'Pending Approval' : 'To Start'}
                          </span>
                        </div>
                      </div>
                    );
                  })
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
    <div 
      className="flex flex-col h-full min-h-0 overflow-hidden relative"
      style={isDark ? {
        background: 'radial-gradient(circle at 15% 10%, rgba(14, 165, 233, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(13, 148, 136, 0.06) 0%, transparent 40%), #050d1a',
      } : {
        background: 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.06) 0%, transparent 35%), radial-gradient(circle at 90% 90%, rgba(16, 185, 129, 0.05) 0%, transparent 35%), #f0f6ff',
      }}
    >
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 sm:px-4 lg:px-5 pb-6 style-scroll">
        <div className="max-w-6xl mx-auto space-y-3 pt-2">

          {/* ── Compact Site Identity & Controls Strip ── */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_2px_10px_rgba(14,165,233,0.35)] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  {site.name}
                </h1>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn(
                  'text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                  (site.status === 'Active' && !site.startDate) ? 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50 shadow-[0_1px_8px_rgba(245,158,11,0.15)]' :
                  site.status === 'Active' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50 shadow-[0_1px_8px_rgba(16,185,129,0.15)]' :
                  site.status === 'Ended' ? 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50 shadow-[0_1px_8px_rgba(244,63,94,0.15)]' :
                  'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                )}>
                  {(site.status === 'Active' && !site.startDate) ? 'Pending' : site.status}
                </span>

                {isOnHold && activeHold && (
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 shadow-[0_1px_8px_rgba(245,158,11,0.15)]"
                    title={`On Hold since ${new Date(activeHold.holdStart).toLocaleDateString('en-GB')}: "${activeHold.holdNote}"`}
                  >
                    <PauseCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Hold ({currentHoldDays}d)</span>
                  </span>
                )}

                <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                  VAT: {site.vat}
                </span>

                {site.client && (
                  <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 max-w-[150px] truncate">
                    {site.client}
                  </span>
                )}

                {/* Date span */}
                <div className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ml-1">
                  <Calendar className="w-3 h-3 text-sky-500 shrink-0" />
                  {site.startDate ? (
                    site.endDate ? (
                      <span>{formatDisplayDate(site.startDate)} – {formatDisplayDate(site.endDate)}</span>
                    ) : (
                      <span>Since {formatDisplayDate(site.startDate)}</span>
                    )
                  ) : site.endDate ? (
                    <span>Ended {formatDisplayDate(site.endDate)}</span>
                  ) : (
                    <span>No Date Logged</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons Right */}
            <div className="flex items-center gap-1.5 shrink-0">
              {currentUser?.privileges?.sites?.canEditSite && (() => {
                const activeHold = siteHoldPeriods.find(h => h.siteId === site.id && !h.holdEnd);
                const isOnHold = !!activeHold;
                return (
                  <Button
                    onClick={() => {
                      setHoldModalNote('');
                      setHoldModalError('');
                      setHoldModalDate(new Date().toISOString().split('T')[0]);
                      setShowHoldModal(true);
                    }}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-7.5 text-xs px-2.5 font-bold rounded-xl transition-all flex items-center gap-1 border shadow-xs',
                      isOnHold
                        ? (isDark ? 'bg-slate-900 border-emerald-600 hover:bg-emerald-950/30 text-emerald-400' : 'bg-white border-emerald-500 hover:bg-emerald-50 text-emerald-700')
                        : (isDark ? 'bg-slate-900 border-amber-600 hover:bg-amber-950/30 text-amber-400' : 'bg-white border-amber-400 hover:bg-amber-50 text-amber-700')
                    )}
                  >
                    {isOnHold ? <PlayCircle className="w-3.5 h-3.5 shrink-0" /> : <PauseCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{isOnHold ? 'Resume Site' : 'Hold Site'}</span>
                  </Button>
                );
              })()}
              {currentUser?.privileges?.sites?.canEditSite && (
                <Button onClick={() => onEditSite(site)} variant="outline" size="sm" title="Edit Site" className={cn("h-7.5 text-xs px-2.5 font-bold rounded-xl transition-all flex items-center gap-1 border shadow-xs", isDark ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200" : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700")}>
                  <Settings2 className="w-3.5 h-3.5 shrink-0" /><span>Edit Site</span>
                </Button>
              )}
            </div>
          </div>

          {/* ── Expandable Quick Stats Strip ── */}
          <AnimatePresence>
            {isQuickStatsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-1 animate-in fade-in-50 duration-150">
                  {[
                    {
                      label: 'TOTAL BILLED',
                      value: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalBilled).toLocaleString()}` : '₦***',
                      sub: `${data.siteInvoices.length} Invoices`,
                      bg: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
                      glow: 'rgba(16, 185, 129, 0.35)',
                    },
                    {
                      label: 'UNPAID BALANCE',
                      value: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.outstanding).toLocaleString()}` : '₦***',
                      sub: data.outstanding > 0 ? 'Outstanding' : 'Fully Paid',
                      bg: data.outstanding > 0 ? 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)' : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                      glow: data.outstanding > 0 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(20, 184, 166, 0.3)',
                    },
                    {
                      label: 'MACHINE DAYS',
                      value: `${data.machineDays}d`,
                      sub: `${data.machinesOnSiteCount} Machines on Site`,
                      bg: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                      glow: 'rgba(56, 189, 248, 0.35)',
                    },
                    {
                      label: 'DIESEL USED',
                      value: `${Math.round(data.totalDiesel).toLocaleString()}L`,
                      sub: `${data.machineLogs.length} Delivery Logs`,
                      bg: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
                      glow: 'rgba(245, 158, 11, 0.35)',
                    },
                    {
                      label: 'MAINTENANCE',
                      value: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalMaintenanceCost).toLocaleString()}` : '₦***',
                      sub: `${data.siteMaintAssets.length} Plant Assets`,
                      bg: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
                      glow: 'rgba(239, 68, 68, 0.35)',
                    },
                    {
                      label: 'PUMPS ON SITE',
                      value: `${data.activePumpsCount} Active`,
                      sub: `${data.pumpsOnSite.length} Total Units`,
                      bg: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
                      glow: 'rgba(6, 182, 212, 0.35)',
                    },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-2xl p-3.5 text-white transition-all duration-200 hover:-translate-y-0.5 cursor-default flex flex-col justify-between group"
                      style={{
                        background: card.bg,
                        boxShadow: `0 8px 24px -4px ${card.glow}`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-25 transition-opacity group-hover:opacity-40"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)',
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 opacity-5"
                        style={{
                          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                        }}
                      />

                      <div className="relative z-10">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase mb-1.5" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
                          {card.label}
                        </span>
                        <p className="text-base sm:text-lg font-black font-mono tracking-tight text-white truncate drop-shadow-xs">
                          {card.value}
                        </p>
                      </div>

                      <div className="relative z-10 mt-2 pt-1 border-t border-white/15 flex items-center justify-between text-[10px] text-white/80 font-medium">
                        <span>{card.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Alerts ── */}
          {data.alerts.length > 0 && (
            <div className="space-y-1.5">
              {data.alerts.map((alert, i) => (
                <div key={i} className={cn('p-2.5 rounded-xl border flex items-center gap-2.5 text-xs shadow-xs',
                  alert.type === 'danger'
                    ? (isDark ? 'bg-rose-950/30 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800')
                    : (isDark ? 'bg-amber-950/30 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800')
                )}>
                  <AlertTriangle className={cn('w-4 h-4 shrink-0', alert.type === 'danger' ? 'text-rose-500' : 'text-amber-500')} />
                  <p className="font-semibold">{alert.title}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Flat Main Navigation Tabs (Sticky Header Strip) ── */}
          <div className="sticky top-0 z-20 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x scroll-smooth py-2 border-b border-slate-200/80 dark:border-slate-800">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 border shrink-0',
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-transparent shadow-[0_2px_12px_rgba(14,165,233,0.35)] translate-y-[-1px]'
                      : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count !== null && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold transition-colors',
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">

            {/* TIMELINE & MILESTONES */}
            {activeTab === 'timeline' && (
              <div className="space-y-4 transition-opacity duration-150">
                <SiteMilestonesCard site={site} />
                <SiteGanttStoryboard site={site} />
              </div>
            )}

            {/* FINANCIALS */}
            {activeTab === 'financials' && (
              <div className="space-y-3 transition-opacity duration-150">
                {/* Flat Financial Segmented Pills */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
                  {[
                    { id: 'invoices', label: 'Invoices', count: data.siteInvoices.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalBilled).toLocaleString()}` : '***', icon: FileText },
                    { id: 'payments', label: 'Payments', count: data.sitePayments.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalReceived).toLocaleString()}` : '***', icon: DollarSign },
                    { id: 'expenses', label: 'Expenses', count: data.siteCosts.length, amount: currentUser?.privileges?.billing?.canViewAmounts ? `₦${Math.round(data.totalCost).toLocaleString()}` : '***', icon: FileText },
                  ].map(t => {
                    const isSubActive = finTab === t.id;
                    const SubIcon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setFinTab(t.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap outline-none",
                          isSubActive
                            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        <SubIcon className="w-3.5 h-3.5" />
                        <span>{t.label} ({t.count})</span>
                        <span className="font-mono text-[11px] opacity-90">{t.amount}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content */}


                {finTab === 'invoices' && (
                  <div className={cn(card, "")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-blue-600" /> Invoices ({data.siteInvoices.length})</h3>
                    {data.siteInvoices.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.siteInvoices.map(inv => {
                          const settlement = settlementMap[inv.id];
                          const status = settlement?.status ?? (inv.status || 'Sent');
                          const isPaid = settlement?.isPaid ?? false;
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
                                <div className="text-right">
                                  <p className="font-bold text-sm">
                                    {currentUser?.privileges?.billing?.canViewAmounts ? `₦${(inv.totalCharge || inv.amount || 0).toLocaleString()}` : '***'}
                                  </p>
                                  {settlement && settlement.balanceRemaining > 0 && settlement.totalSettled > 0 && (
                                    <p className="text-[11px] text-amber-600 font-mono">
                                      Bal: ₦{settlement.balanceRemaining.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <Badge className={cn(
                                  'text-xs font-semibold',
                                  status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                                  status === 'Partially Paid' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                                  status === 'Overdue' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                                  'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                )}>
                                  {status}
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
              <div className="space-y-5 transition-opacity duration-150">

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
                      <Activity className="w-5 h-5 text-blue-600" /> Operational Hub
                    </h3>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl overflow-x-auto style-scroll max-w-full">
                      {[
                        { id: 'logs', label: 'Machine Logs', count: data.machineLogs.length, icon: ClipboardList, activeColor: 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm' },
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
                              ? (subTab.id === 'logs' ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
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
                                  wb.type === 'waybill' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
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
              <div className="space-y-5 transition-opacity duration-150">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: 'Assets Tracked', value: data.siteMaintAssets.length, color: 'text-blue-600' },
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
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-7 px-2.5 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
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
                          className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-950/30 text-xs font-bold"
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
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 text-xs font-bold"
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
                            className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-950/30 text-xs font-bold"
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

            {/* HOLD HISTORY — inside Operations tab */}
            {activeTab === 'operations' && (() => {
              const holdHistory = siteHoldPeriods.filter(h => h.siteId === site.id);
              if (holdHistory.length === 0) return null;
              return (
                <div className={cn(card, 'border-amber-200 dark:border-amber-900/60')}>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-amber-100 dark:border-amber-900/40">
                    <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-bold text-sm text-amber-700 dark:text-amber-300 uppercase tracking-wider">Hold History</h3>
                    <span className={cn('text-xs font-extrabold px-2 py-0.5 rounded-full', isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700')}>
                      {holdHistory.length}
                    </span>
                  </div>
                  <div className="divide-y divide-amber-50 dark:divide-amber-900/20">
                    {holdHistory.map(h => {
                      const isActive = !h.holdEnd;
                      const days = h.holdDays ?? Math.max(1, Math.round((new Date().getTime() - new Date(h.holdStart).getTime()) / 86400000));
                      return (
                        <div key={h.id} className="py-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded-sm',
                                isActive
                                  ? 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                              )}>
                                {isActive ? 'On Hold' : 'Resumed'}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                {new Date(h.holdStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {' → '}
                                {h.holdEnd
                                  ? new Date(h.holdEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : <span className="text-amber-600 dark:text-amber-400 font-bold">Ongoing</span>}
                              </span>
                            </div>
                            <span className={cn(
                              'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
                              isActive ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            )}>
                              {days} day{days !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-amber-700 dark:text-amber-400">Hold reason: </span>
                            {h.holdNote}
                          </p>
                          {h.resumeNote && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Resume note: </span>
                              {h.resumeNote}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400">Recorded by {h.createdBy || 'unknown'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}


            {activeTab === 'tasks' && (
              <div className="space-y-5 transition-opacity duration-150">
                <div className={card}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" /> Tasks Dashboard
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl overflow-x-auto style-scroll max-w-full">
                        {[
                          { id: 'pending', label: 'Pending', count: data.pendingSiteTasks.length, icon: CheckSquare, activeColor: 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm' },
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
                                ? (subTab.id === 'pending' ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                                   subTab.id === 'approval' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                                   'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300')
                                : "bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            )}>
                              {subTab.count}
                            </span>
                          </button>
                        ))}
                      </div>
                      {currentUser?.privileges?.tasks?.canCreateTasks !== false && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-7 px-2.5 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Task</span>
                              <ChevronDown className="w-3 h-3 opacity-80" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border border-slate-250 dark:border-slate-800">
                            <DropdownMenuItem
                              onClick={() => setShowQuickTaskDialog(true)}
                              className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40 group"
                            >
                              <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 group-hover:scale-105 transition-transform mt-0.5 shrink-0">
                                <Zap className="w-3.5 h-3.5 fill-blue-600 dark:fill-blue-400 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Quick Task</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Fast creation with to-do list</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowCreateTaskDialog(true)}
                              className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 group mt-1"
                            >
                              <div className="p-1.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 group-hover:scale-105 transition-transform mt-0.5 shrink-0">
                                <ListPlus className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Detailed Task</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Full options, budget, approval</span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Task list based on tab */}
                  {taskSubTab === 'pending' && (
                    <div>
                      {data.pendingSiteTasks.length > 0 ? (
                        <div className="space-y-2.5">
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
                    <div>
                      {data.approvalSiteTasks.length > 0 ? (
                        <div className="space-y-2.5">
                          {data.approvalSiteTasks.map(task => renderTaskRow(task, 'approval'))}
                        </div>
                      ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                          <ShieldCheck className="w-10 h-10 text-blue-600 mb-2 opacity-80" />
                          <p className="text-slate-500 font-medium text-sm">No tasks pending approval</p>
                          <p className="text-slate-400 text-xs mt-0.5">Everything is up to date and verified.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {taskSubTab === 'completed' && (
                    <div>
                      {data.completedSiteTasks.length > 0 ? (
                        <div className="space-y-2.5">
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
              <div className="space-y-5 transition-opacity duration-150">
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
              <div className="transition-opacity duration-150">
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

          {/* Site Hold / Resume Dialog */}
          <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
            <DialogContent className="sm:max-w-[480px] p-6">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "p-2 rounded-xl",
                    isOnHold ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  )}>
                    {isOnHold ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
                      {isOnHold ? `Resume Operations on ${site.name}` : `Place ${site.name} On Hold`}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isOnHold
                        ? `This will end the current hold period (${currentHoldDays} days) and resume normal tracking.`
                        : 'This records a hold start date and preserves all machine and site history.'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 my-2">
                {isOnHold && activeHold && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">Current Hold Summary:</p>
                    <p>• Started: <span className="font-semibold">{new Date(activeHold.holdStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span> ({currentHoldDays} day{currentHoldDays !== 1 ? 's' : ''} on hold)</p>
                    <p className="mt-0.5">• Initial Reason: <span className="italic">"{activeHold.holdNote}"</span></p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {isOnHold ? 'Resume Date *' : 'Hold Start Date *'}
                  </label>
                  <input
                    type="date"
                    value={holdModalDate}
                    onChange={e => setHoldModalDate(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {isOnHold ? 'Resume Reason / Outcome Note *' : 'Reason for Placing Site On Hold *'}
                  </label>
                  <textarea
                    rows={3}
                    value={holdModalNote}
                    onChange={e => {
                      setHoldModalNote(e.target.value);
                      if (holdModalError) setHoldModalError('');
                    }}
                    placeholder={isOnHold
                      ? 'E.g., Client approved resumption of works; all site permits active.'
                      : 'E.g., Heavy rainfall / client requested temporary pause during excavation phase.'
                    }
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-900 dark:text-white"
                  />
                  {holdModalError && (
                    <p className="text-xs font-semibold text-rose-500 mt-1">{holdModalError}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowHoldModal(false)}
                  disabled={isSubmittingHold}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmHoldToggle}
                  disabled={!holdModalNote.trim() || isSubmittingHold}
                  className={cn(
                    "text-xs font-bold text-white",
                    isOnHold ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {isSubmittingHold ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    isOnHold ? 'Confirm & Resume Site' : 'Confirm & Place On Hold'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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

      {/* ── Slide-Over AI Assistant Drawer ── */}
      <AnimatePresence>
        {isAiDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={cn(
                "fixed top-0 right-0 h-full w-full max-w-md shadow-2xl border-l z-50 flex flex-col transition-colors",
                isDark ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-slate-900 border-slate-200"
              )}
            >
              {/* Drawer Header */}
              <div className={cn(
                "flex items-center justify-between p-3.5 border-b shrink-0 transition-colors",
                isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-md shrink-0",
                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                  )}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className={cn(
                      "text-xs font-bold uppercase tracking-wider truncate",
                      isDark ? "text-blue-200" : "text-slate-900"
                    )}>Site Intelligence</h2>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{site.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedModel && (
                    <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                      {selectedModel}
                    </span>
                  )}
                  {messages.length > 0 && (
                    <Button
                      onClick={() => {
                        setMessages([]);
                        toast.success('Chat history cleared!');
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                      title="Clear chat history"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAiDrawerOpen(false)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Drawer Body / Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 style-scroll">
                {messages.length === 0 && !isGeneratingBrief && (
                  <div className="text-center py-10 space-y-3">
                    <div className={cn(
                      "w-10 h-10 mx-auto rounded-full flex items-center justify-center border",
                      isDark ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200"
                    )}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">Site 360 AI Assistant</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[260px] mx-auto">Instant intelligence on diesel consumption, active machines, pending tasks, and financial risks.</p>
                    </div>
                    <Button
                      onClick={() => sendChatMessage(true)}
                      disabled={isGeneratingBrief}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md shadow-sm h-8 font-semibold"
                    >
                      {isGeneratingBrief ? <RefreshCcw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                      Generate Intelligence Brief
                    </Button>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[90%] rounded-lg p-3 text-xs shadow-xs',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-slate-950 text-blue-50 border border-slate-800'
                          : 'bg-slate-50 text-slate-800 border border-slate-200'
                    )}>
                      {msg.role === 'user' ? <p className="whitespace-pre-wrap">{msg.content}</p> : renderFormattedChatMessage(msg.content)}
                    </div>
                  </div>
                ))}

                {isGeneratingBrief && (
                  <div className="flex justify-start">
                    <div className={cn(
                      "rounded-lg border p-2.5 text-xs flex items-center gap-2",
                      isDark ? "bg-slate-950 text-blue-200 border-slate-800" : "bg-slate-50 text-slate-900 border-slate-200"
                    )}>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" /> Analyzing site telemetry...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Drawer Footer Input */}
              <div className={cn(
                "p-3 border-t shrink-0 flex items-center gap-2 transition-colors",
                isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about invoices, machines, pumps..."
                  className={cn(
                    "flex-1 text-xs rounded-md h-8.5 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 border transition-colors",
                    isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                  )}
                />
                <Button
                  size="icon"
                  onClick={() => sendChatMessage()}
                  disabled={!chatInput.trim() || isGeneratingBrief}
                  className="h-8.5 w-8.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showCreateTaskDialog && (
        <CreateTaskDialog
          onClose={() => setShowCreateTaskDialog(false)}
          users={users}
          currentUserId={currentUser?.id || authUser?.id || ""}
          teamId={workspaceId || "dcel-team"}
          workspaceId={workspaceId || "dcel-team"}
          initialClientId={derivedClientId || ""}
          initialSiteId={site.id || ""}
          initialTagToSite={true}
          isDarkTheme={isDark}
        />
      )}
      {showQuickTaskDialog && (
        <QuickTaskDialog
          open={showQuickTaskDialog}
          onClose={() => setShowQuickTaskDialog(false)}
          clientName={site.client}
          clientId={derivedClientId || ""}
          siteName={site.name}
          siteId={site.id}
          users={users}
          currentUserId={currentUser?.id || authUser?.id || ""}
          teamId={workspaceId || "dcel-team"}
          workspaceId={workspaceId || "dcel-team"}
          isDarkTheme={isDark}
        />
      )}
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
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Existing Contact...</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.position ? `(${c.position})` : ''}
                </option>
              ))}
              <option value="ADD_NEW" className="text-blue-600 font-bold dark:text-blue-400">+ Add New Contact</option>
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
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Outcome / Next Steps (Optional)</label>
            <input
              type="text"
              placeholder="E.g. Client to approve quotation by Friday"
              value={form.outcome}
              onChange={e => setForm({ ...form, outcome: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Follow-up Date (Optional)</label>
            <input
              type="date"
              value={form.followUpDate}
              onChange={e => setForm({ ...form, followUpDate: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">Save Log</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

{/* ── This closing brace ends the Site360View component ── */}
