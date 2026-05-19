import { useMemo, useState, useRef, useEffect } from 'react';
import { parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import {
  ArrowLeft, MapPin, DollarSign, Activity, Wrench, MessagesSquare,
  AlertTriangle, Clock, Fuel, Calendar, FileText, Users, Settings2,
  ChevronDown, Sparkles, RefreshCcw, Send, ChevronUp, Filter, CheckCircle2, Plus, Pencil, ChevronRight
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { Invoice } from '@/src/store/appStore';
import { ClientContactsPanel } from './ClientContactsPanel';
import { TaskDetailSheet } from '@/src/components/tasks/TaskDetailSheet';

type SiteTab = 'financials' | 'operations' | 'maintenance' | 'comms';

interface Props {
  site: Site;
  clientSites: Site[];
  onSiteChange: (site: Site) => void;
  onBack: () => void;
  onEditSite: (site: Site) => void;
}

export function Site360View({ site, clientSites, onSiteChange, onBack, onEditSite }: Props) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<SiteTab>('financials');
  const [showFilters, setShowFilters] = useState(false);
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [isContactsCollapsed, setIsContactsCollapsed] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

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
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
  const { dailyMachineLogs, maintenanceAssets, maintenanceSessions, waybills, assets } = useOperations();
  const { mainTasks, subtasks } = useAppData();

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

    const siteMaintAssets = maintenanceAssets.filter(a => a.site?.trim() === site.name.trim());
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

    const pendingSiteTasks = siteTasks.filter(t => deriveMainTaskStatus(t.id, subtasks) !== 'completed');
    const completedSiteTasks = siteTasks.filter(t => deriveMainTaskStatus(t.id, subtasks) === 'completed');

    const siteComms = commLogs.filter(l =>
      (l.siteId === site.id || l.siteName?.trim() === site.name.trim()) && isWithinFilter(l.date)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 1. Get contacts registered under this client
    const registeredContacts = clientContacts.filter(c =>
      c.clientName?.trim().toLowerCase() === site.client?.trim().toLowerCase()
    );

    // 2. Extract any other contact names mentioned in the client's past communication logs
    const clientComms = commLogs.filter(l =>
      l.client?.trim().toLowerCase() === site.client?.trim().toLowerCase() ||
      l.client?.trim().toLowerCase() === site.name?.trim().toLowerCase()
    );
    const pastCommNames = Array.from(new Set(clientComms.map(l => l.contactPerson).filter(Boolean)));

    // 3. Merge them uniquely
    const mergedContactsMap = new Map<string, { id: string; name: string; position?: string; phone?: string; email?: string }>();

    // Add registered contacts first
    registeredContacts.forEach(c => {
      mergedContactsMap.set(c.name.trim().toLowerCase(), {
        id: c.id,
        name: c.name,
        position: c.position,
        phone: c.phone,
        email: c.email
      });
    });

    // Add past communication contacts if not already present
    pastCommNames.forEach((name, idx) => {
      const trimmed = name.trim();
      const lower = trimmed.toLowerCase();
      if (!mergedContactsMap.has(lower)) {
        mergedContactsMap.set(lower, {
          id: `past-comm-${idx}`,
          name: trimmed,
          position: 'Past Contact',
          phone: undefined,
          email: undefined
        });
      }
    });

    const siteContacts = Array.from(mergedContactsMap.values());

    const alerts: { title: string; type: 'warning' | 'danger' }[] = [];
    if (siteMaintAssets.some(a => a.status === 'overdue')) alerts.push({ title: 'Overdue maintenance on one or more assets', type: 'danger' });
    if (siteTasks.length > 3) alerts.push({ title: `${siteTasks.length} pending tasks`, type: 'warning' });

    return {
      siteInvoices, sitePayments, siteCosts, totalBilled, totalReceived, outstanding, vatGenerated, totalCost,
      periodVatCollected, unpaidVatBroughtForward, periodVatRemitted, totalVatRemitted,
      machineLogs, totalDiesel, activeDays, machineDays, activeMachinesCount, machinesOnSiteCount,
      siteMaintAssets, siteMaintSessions, totalMaintenanceCost,
      siteTasks, pendingSiteTasks, completedSiteTasks, siteComms, siteContacts, alerts,
      profit: totalBilled - totalCost
    };
  }, [site, filterMonth, filterYear, invoices, payments, vatPayments, ledgerEntries, vatRate, dailyMachineLogs, maintenanceAssets, maintenanceSessions, mainTasks, subtasks, commLogs, clientContacts, waybills, assets]);

  const card = cn('p-5 rounded-2xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200');

  const tabs: { id: SiteTab; label: string; icon: React.ElementType }[] = [
    { id: 'financials', label: 'Financials', icon: DollarSign },
    { id: 'operations', label: 'Operations', icon: Activity },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'comms', label: 'Comms & Tasks', icon: MessagesSquare },
  ];

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
    <div className="flex items-center gap-2">
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn("h-8 gap-1.5 px-3 text-xs font-semibold relative", isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")}
        >
          <Filter className="w-3.5 h-3.5" /> Filter
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

      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-colors', isDark ? 'bg-slate-900 border-slate-700 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300')}>
        <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="relative">
          <select
            value={site.id}
            onChange={e => {
              const selected = clientSites.find(s => s.id === e.target.value);
              if (selected) onSiteChange(selected);
            }}
            className={cn('appearance-none bg-transparent font-bold text-sm pr-6 focus:outline-none cursor-pointer max-w-[200px] truncate', isDark ? 'text-white' : 'text-slate-900')}
          >
            {clientSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>
      </div>
    </div>
  );

  useSetPageTitle('Site 360', `Operational command center for ${site.name}`, headerActions, [filterMonth, filterYear, site.name, isDark, showFilters, clientSites], onBack);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 style-scroll">
        <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-500">


          {/* ── Hero: AI Assistant + Site Identity side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">

            {/* AI Chat — wider column (3/5) */}
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

            {/* Site Identity Card — narrower column (2/5) */}
            <div className={cn(
              'lg:col-span-2 p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all duration-300',
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
              isChatCollapsed ? 'lg:h-[72px] h-auto justify-center py-3' : 'lg:h-[300px]'
            )}>
              <div 
                className="flex items-start justify-between cursor-pointer group select-none"
                onClick={() => setIsChatCollapsed(!isChatCollapsed)}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={cn('p-2.5 rounded-2xl shrink-0 mt-0.5 transition-colors', isDark ? 'bg-indigo-900/50 group-hover:bg-indigo-800/60' : 'bg-indigo-50 group-hover:bg-indigo-100')}>
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{site.name}</h1>
                    <p className="text-slate-500 text-xs mt-0.5">Client: <span className="font-semibold text-slate-700 dark:text-slate-300">{site.client}</span></p>
                    
                    {!isChatCollapsed && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <Badge className={cn('text-xs',
                          site.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            site.status === 'Ended' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                        )}>{site.status}</Badge>
                        <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">VAT: <strong>{site.vat}</strong></span>
                        {site.startDate && <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Since {new Date(site.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Visual expand/collapse indicator synced with Left column */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-8 w-8 p-0 shrink-0 ml-2" 
                  onClick={e => { e.stopPropagation(); setIsChatCollapsed(!isChatCollapsed); }}
                >
                  {isChatCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
              </div>

              {/* Quick stats strip inside identity card — animates smoothly on toggle */}
              <AnimatePresence initial={false}>
                {!isChatCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-1 border-t border-slate-100 dark:border-slate-800/50">
                      <div className={cn('rounded-xl p-3 transition-colors', isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Unpaid</p>
                        <p className={cn('text-base font-black truncate', data.outstanding > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                          ₦{Math.round(data.outstanding).toLocaleString()}
                        </p>
                      </div>
                      <div className={cn('rounded-xl p-3 transition-colors', isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Pending Tasks</p>
                        <p className="text-base font-black text-amber-600">{data.siteTasks.length}</p>
                      </div>
                      <div className={cn('rounded-xl p-3 transition-colors', isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Machine Days</p>
                        <p className="text-base font-black text-indigo-600">{data.machineDays}</p>
                      </div>
                      <div className={cn('rounded-xl p-3 transition-colors', isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Contacts</p>
                        <p className="text-base font-black text-slate-700 dark:text-slate-200">{data.siteContacts.length}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Secondary Stats Strip — unique metrics not shown in hero card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'Total Billed', value: `₦${Math.round(data.totalBilled).toLocaleString()}`, subtext: `${data.siteInvoices.length} invoice${data.siteInvoices.length !== 1 ? 's' : ''}`, color: 'text-sky-600' },
              { label: 'Diesel Used', value: `${Math.round(data.totalDiesel).toLocaleString()}L`, subtext: `${data.activeDays} active day${data.activeDays !== 1 ? 's' : ''}`, color: 'text-amber-600' },
              { label: 'Maintenance Cost', value: `₦${Math.round(data.totalMaintenanceCost).toLocaleString()}`, subtext: `${data.siteMaintAssets.length} asset${data.siteMaintAssets.length !== 1 ? 's' : ''} tracked`, color: 'text-rose-500' },
            ].map(k => (
              <div key={k.label} className={cn(card, "p-3 sm:p-5 min-w-0 flex flex-col justify-between")}>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 truncate">{k.label}</p>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className={cn('text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black truncate', k.color)}>{k.value}</p>
                  {k.subtext && <span className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 truncate">{k.subtext}</span>}
                </div>
              </div>
            ))}
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
          <div className={cn('flex items-center justify-between border-b mb-6 gap-4', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <div className="flex items-center gap-1 overflow-x-auto style-scroll pb-px flex-1">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>
            <div className="shrink-0 pb-1 pr-1">
              <Button onClick={() => onEditSite(site)} variant="outline" size="sm" className={cn("h-8 text-xs px-2 sm:px-3 font-medium shadow-sm transition-colors", isDark ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700")}>
                <Settings2 className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Edit Site</span>
              </Button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="animate-in fade-in duration-300 space-y-5">

            {/* FINANCIALS */}
            {activeTab === 'financials' && (
              <>
                {/* Financial Sub-Tabs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { id: 'invoices', label: 'Invoices', count: data.siteInvoices.length, amount: `₦${Math.round(data.totalBilled).toLocaleString()}`, icon: FileText },
                    { id: 'payments', label: 'Payments', count: data.sitePayments.length, amount: `₦${Math.round(data.totalReceived).toLocaleString()}`, icon: DollarSign },
                    { id: 'expenses', label: 'Expenses', count: data.siteCosts.length, amount: `₦${Math.round(data.totalCost).toLocaleString()}`, icon: FileText },
                    { id: 'vat', label: 'VAT Remitted', count: null, amount: `₦${Math.round(data.periodVatRemitted).toLocaleString()}`, icon: CheckCircle2 },
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
                {finTab === 'vat' && (
                  <div className={cn(card, "bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/20 border-indigo-100 dark:border-indigo-900/50 animate-in fade-in duration-200")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg text-indigo-950 dark:text-indigo-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500" /> VAT Intelligence & Compliance
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">VAT Collected (Selected Period)</p>
                          <p className="text-xl font-black text-sky-600 dark:text-sky-400">₦{data.periodVatCollected.toLocaleString()}</p>
                          <p className="text-xs text-slate-400 mt-1">Derived from client payments received</p>
                        </div>
                        <div className="mt-3">
                          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-semibold text-xs py-1 px-2.5">
                            {filterMonth === 'all' && filterYear === 'all' ? 'All-Time Payments' : 'Period Payments'}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Prior Unpaid VAT (Brought Forward)</p>
                          <p className="text-xl font-black text-amber-600 dark:text-amber-400">₦{data.unpaidVatBroughtForward.toLocaleString()}</p>
                          <p className="text-xs text-slate-400 mt-1">Accumulated unpaid VAT from previous periods</p>
                        </div>
                        <div className="mt-3">
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold text-xs py-1 px-2.5">
                            Accumulated Liability
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">VAT Remitted to FIRS (Selected Period)</p>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">₦{data.periodVatRemitted.toLocaleString()}</p>
                          <p className="text-xs text-slate-400 mt-1">Total All-Time Remitted: ₦{data.totalVatRemitted.toLocaleString()}</p>
                        </div>
                        <div className="mt-3">
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-xs py-1 px-2.5">
                            Official Tax Remittance
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {finTab === 'invoices' && (
                  <div className={cn(card, "animate-in fade-in duration-200")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-indigo-500" /> Invoices ({data.siteInvoices.length})</h3>
                    {data.siteInvoices.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.siteInvoices.map(inv => {
                          const { isPaid } = invoicePaymentMap[inv.id] || { paid: 0, isPaid: false };
                          return (
                            <div
                              key={inv.id}
                              onClick={() => setSelectedInvoice(inv)}
                              className="py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{inv.invoiceNumber || inv.id.slice(0, 8)}</p>
                                <p className="text-xs text-slate-500">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '—'} · {inv.billingCycle || 'Custom'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <p className="font-bold text-sm">₦{(inv.totalCharge || inv.amount || 0).toLocaleString()}</p>
                                <Badge className={isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{isPaid ? 'Paid' : 'Unpaid'}</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No invoices for this site in the selected period.</p>}
                  </div>
                )}

                {finTab === 'payments' && (
                  <div className={cn(card, "animate-in fade-in duration-200")}>
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5 text-emerald-500" /> Payments Received ({data.sitePayments.length})</h3>
                    {data.sitePayments.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.sitePayments.map(pay => (
                          <div key={pay.id} className="py-3 flex items-center justify-between gap-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                            <div>
                              <p className="font-semibold text-sm">Payment · {pay.date ? pay.date : '—'}</p>
                              <p className="text-xs text-slate-500">VAT Included: {pay.payVat || 'No'} {pay.vat ? `(₦${pay.vat.toLocaleString()})` : ''}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">₦{(pay.amount || 0).toLocaleString()}</p>
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Received</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No payments recorded for this site in the selected period.</p>}
                  </div>
                )}

                {finTab === 'expenses' && (
                  <div className={cn(card, "animate-in fade-in duration-200")}>
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
                              <p className="font-bold text-sm text-rose-600 dark:text-rose-400">₦{(cost.amount || 0).toLocaleString()}</p>
                              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">Expense</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-slate-500 text-sm text-center py-8">No expenses recorded for this site in the selected period.</p>}
                  </div>
                )}
              </>
            )}

            {/* OPERATIONS */}
            {activeTab === 'operations' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: 'Total Log Days', value: data.machineLogs.length, color: 'text-indigo-600' },
                    { label: 'Active Days', value: data.activeDays, color: 'text-emerald-600' },
                    { label: 'Total Diesel (L)', value: Math.round(data.totalDiesel).toLocaleString(), color: 'text-amber-600' },
                  ].map(k => (
                    <div key={k.label} className={cn(card, "p-3 sm:p-5 min-w-0 flex flex-col justify-between")}>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 truncate">{k.label}</p>
                      <p className={cn('text-sm min-[390px]:text-base sm:text-lg md:text-2xl font-black truncate', k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className={card}>
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><Activity className="w-5 h-5 text-indigo-500" /> Machine Logs</h3>
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
                  ) : <p className="text-slate-500 text-sm text-center py-8">No machine logs in this period.</p>}
                </div>
              </>
            )}

            {/* MAINTENANCE */}
            {activeTab === 'maintenance' && (
              <>
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
                    <h3 className="font-bold mb-4 text-lg flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-500" /> Assets on Site</h3>
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
                    }) : <p className="text-slate-500 text-sm text-center py-8">No maintenance assets tracked.</p>}
                  </div>
                  <div className={card}>
                    <h3 className="font-bold mb-4 text-lg">Recent Sessions</h3>
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
                    )) : <p className="text-slate-500 text-sm text-center py-8">No maintenance sessions.</p>}
                  </div>
                </div>
              </>
            )}

            {/* COMMS & TASKS */}
            {activeTab === 'comms' && (
              <div className="grid grid-cols-1 gap-5">
                <div className={card}>
                  <h3 className="font-bold mb-4 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Pending Tasks ({data.pendingSiteTasks.length})</h3>
                  {data.pendingSiteTasks.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.pendingSiteTasks.map(task => {
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
                                  <p className="font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
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
                                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {task.priority && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                    task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                    task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                                  }`}>{task.priority}</span>
                                )}
                                <Badge variant="outline" className="text-[9px] sm:text-xs px-1.5 sm:px-2.5 whitespace-nowrap">
                                  {task.requiresApproval ? 'Approval' : 'Active'}
                                </Badge>
                              </div>
                            </div>
                            
                            <AnimatePresence initial={false}>
                              {expandedTasks.has(task.id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
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
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                              sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                              sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                                              sub.status === 'pending_approval' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {sub.status.replace('_', ' ')}
                                            </span>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-slate-500 text-sm text-center py-8">No pending tasks.</p>}
                </div>

                {data.completedSiteTasks.length > 0 && (
                  <div className={card}>
                    <h3 className="font-bold mb-4 text-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Completed Tasks ({data.completedSiteTasks.length})</h3>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.completedSiteTasks.map(task => {
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
                                  <p className="font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors text-slate-500 line-through">{task.title}</p>
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
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((completed / taskSubs.length) * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">{completed}/{taskSubs.length} done</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <Badge variant="outline" className="text-[9px] sm:text-xs px-1.5 sm:px-2.5 whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Completed
                                </Badge>
                              </div>
                            </div>
                            
                            <AnimatePresence initial={false}>
                              {expandedTasks.has(task.id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
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
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                              sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                              sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                                              sub.status === 'pending_approval' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {sub.status.replace('_', ' ')}
                                            </span>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={card}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-blue-500" /> Communication Logs ({data.siteComms.length})</h3>
                    <Button onClick={() => setShowCommDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 rounded-xl h-9 px-2.5 sm:px-3 shrink-0">
                      <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Log</span>
                    </Button>
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

                  {data.siteContacts.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div 
                        className="flex justify-between items-center mb-3 cursor-pointer select-none group"
                        onClick={() => setIsContactsCollapsed(!isContactsCollapsed)}
                      >
                        <h4 className="font-bold flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                          <Users className="w-4 h-4 text-indigo-500" /> Site Contacts
                          {isContactsCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400 ml-1" /> : <ChevronUp className="w-4 h-4 text-slate-400 ml-1" />}
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowContactsPanel(true); }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Edit Contacts
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {!isContactsCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-3 pt-1">
                              {data.siteContacts.map(c => (
                                <div key={c.id} className="py-2 flex justify-between items-center border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
                                  <div className="min-w-0 flex-1 pr-3">
                                    <p className="font-semibold text-sm truncate">
                                      {c.name} <span className="text-xs text-indigo-500">· {c.position}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 truncate mt-0.5">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                                  </div>
                                  {c.position !== 'Past Contact' && (
                                    <button
                                      type="button"
                                      onClick={() => setShowContactsPanel(true)}
                                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 bg-transparent border-0 cursor-pointer shrink-0"
                                      title="Edit Contact Details"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
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

          {showContactsPanel && (
            <ClientContactsPanel
              clientName={site.client || site.name}
              onClose={() => setShowContactsPanel(false)}
            />
          )}
        </div>
      </div>
      
      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </div>
  );
}

function ExternalCommDialog({ open, onClose, site, contacts = [], onSave }: { open: boolean; onClose: () => void; site: Site; contacts: any[]; onSave: (log: any) => void }) {
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
      loggedBy: 'Admin',
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
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
