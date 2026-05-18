import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, MapPin, AlertTriangle, FileText, CheckCircle2, Clock, 
  Calendar, Sparkles, ChevronDown, ChevronUp, Users, Phone, DollarSign,
  Activity, Briefcase, MessagesSquare, RefreshCcw, Filter, Send,
  ShieldAlert, ShieldCheck, Settings2, X, Edit2, ChevronRight
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { useAppStore, Site, ClientProfile } from '@/src/store/appStore';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { parseISO } from 'date-fns';
import { normalizeDate } from '@/src/lib/dateUtils';
import { Site360View } from './Site360View';

type TabType = 'overview' | 'contacts' | 'financials' | 'operations' | 'activity';

export function Client360() {
  const { isDark } = useTheme();
  
  // Connect to global stores
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
  const { mainTasks, subtasks } = useAppData();
  const { dailyMachineLogs, assets, waybills } = useOperations();

  // Dialog state
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [siteEditTarget, setSiteEditTarget] = useState<Site | null>(null);
  const [clientEditForm, setClientEditForm] = useState<Partial<ClientProfile>>({});
  const [siteEditForm, setSiteEditForm] = useState<Partial<Site>>({});

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

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

    const clientTasks = mainTasks.filter(t => t.title?.toLowerCase().includes(clientNameLow) || (t.description && t.description.toLowerCase().includes(clientNameLow)));
    const pendingTasks = clientTasks.filter(t => deriveMainTaskStatus(t.id, subtasks) !== 'completed' && !t.isDeleted && isWithinTimeFilter(t.deadline || t.createdAt));

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
      pendingTasks, contacts, logs, 
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

  // ── Handlers for edit dialogs ──
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
              <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-500">



            
            {/* AI Intelligence Assistant Chat */}
            <div className={cn("bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-lg relative overflow-hidden group border border-indigo-700/50 flex flex-col transition-all duration-300", isChatCollapsed ? "h-auto" : "h-[350px]")}>
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles className="w-48 h-48" /></div>
              
              <div className="flex items-center justify-between p-4 border-b border-indigo-800/50 relative z-10 shrink-0 cursor-pointer hover:bg-indigo-800/20 transition-colors" onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Sparkles className="w-4 h-4 text-indigo-300" /></div>
                  <span className="text-sm font-bold uppercase tracking-wider text-indigo-200">Decision Intelligence Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isChatCollapsed && messages.length === 0 && (
                    <div className="flex items-center gap-2">
                      <Button onClick={(e) => { e.stopPropagation(); openClientEdit(); }} variant="outline" size="sm" className="h-8 text-xs bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 border-indigo-700">
                        <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit Client
                      </Button>
                      <Button onClick={(e) => { e.stopPropagation(); sendChatMessage(true); }} disabled={isGeneratingBrief} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 h-8 text-xs">
                        {isGeneratingBrief ? <RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                        {isGeneratingBrief ? 'Analyzing...' : 'Generate Brief'}
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

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto style-scroll pb-px">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'financials', label: 'Financials', icon: DollarSign },
                { id: 'operations', label: 'Operations & Sites', icon: Briefcase },
                { id: 'contacts', label: 'Contacts Directory', icon: Users },
                { id: 'activity', label: 'Interaction History', icon: MessagesSquare }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                    activeTab === tab.id 
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400" 
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in duration-300">
              
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={cn("p-5 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Total Revenue</p>
                      <p className="text-2xl font-black text-emerald-600">₦{clientData.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className={cn("p-5 rounded-2xl border shadow-sm flex flex-col justify-between", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> VAT Deficit</p>
                        <p className={cn("text-2xl font-black", clientData.vatDeficit > 0 ? "text-rose-500" : "text-emerald-500")}>
                          ₦{clientData.vatDeficit.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 font-medium bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 truncate" title={clientData.vatMonthsIncluded.length > 0 ? `Payments include: ${clientData.vatMonthsIncluded.join(', ')}` : 'No VAT payments in this period'}>
                        {clientData.vatMonthsIncluded.length > 0 ? `Paid for: ${clientData.vatMonthsIncluded.join(', ')}` : 'No VAT payments'}
                      </p>
                    </div>
                    <div className={cn("p-5 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Active Sites</p>
                      <p className="text-2xl font-black text-indigo-600">{clientData.activeSites} <span className="text-sm font-medium text-slate-400">/ {clientData.totalSites}</span></p>
                    </div>
                    <div className={cn("p-5 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Deployed Staff</p>
                      <p className="text-2xl font-black text-sky-600">{clientData.deployedStaffCount} <span className="text-sm font-medium text-slate-400">Today</span></p>
                    </div>
                  </div>

                  {/* Proactive Alerts & Health Score */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="mb-4 relative">
                        <svg className="w-32 h-32 transform -rotate-90">
                          <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12" className={isDark ? "text-slate-800" : "text-slate-100"} />
                          <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12" 
                            strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * clientData.healthScore) / 100}
                            className={clientData.healthScore > 80 ? "text-emerald-500" : clientData.healthScore > 50 ? "text-amber-500" : "text-rose-500"} 
                            strokeLinecap="round" 
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn("text-3xl font-black", clientData.healthScore > 80 ? "text-emerald-600" : clientData.healthScore > 50 ? "text-amber-600" : "text-rose-600")}>
                            {clientData.healthScore}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Client Health Score</h3>
                      <p className="text-sm text-slate-500 mt-1">Based on financial, operational, and workflow metrics</p>
                    </div>

                    <div className={cn("p-6 rounded-2xl border shadow-sm lg:col-span-2", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
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
                <div className="space-y-6">
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
                            <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">₦{clientData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Project Costs</span>
                              <span className="text-xs text-slate-400">Expenses logged for this client's sites</span>
                            </div>
                            <span className="font-bold text-lg text-rose-500">₦{clientData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-850 dark:text-slate-150">Estimated Profit / Margin</span>
                          <span className="text-xs text-slate-400">Total Billed Revenue - Project Costs</span>
                        </div>
                        <span className={cn("font-black text-xl tracking-tight", clientData.profit >= 0 ? "text-emerald-600" : "text-rose-500")}>
                          ₦{clientData.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
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
                            <span className="font-bold text-lg text-emerald-600">₦{clientData.paymentsCleared.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Outstanding Balance</span>
                              <span className="text-xs text-slate-400">Invoiced amount awaiting payment</span>
                            </div>
                            <span className={cn("font-bold text-lg", (clientData.totalRevenue - clientData.paymentsCleared) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>
                              ₦{(clientData.totalRevenue - clientData.paymentsCleared).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-850 dark:text-slate-150">Actual Cash Profit</span>
                          <span className="text-xs text-slate-400">Cash Received - Project Costs</span>
                        </div>
                        <span className={cn("font-black text-xl tracking-tight", (clientData.paymentsCleared - clientData.totalCost) >= 0 ? "text-emerald-600" : "text-rose-500")}>
                          ₦{(clientData.paymentsCleared - clientData.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payments & VAT Settlement Registry */}
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

                    {clientData.paymentsWithVatStatus && clientData.paymentsWithVatStatus.length > 0 ? (
                      <div className="overflow-x-auto style-scroll rounded-xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className={cn("border-b font-bold text-slate-500 uppercase tracking-wider text-[10px]", isDark ? "bg-slate-800/40 border-slate-800" : "bg-slate-50 border-slate-100")}>
                              <th className="p-3">Payment Date</th>
                              <th className="p-3">Site</th>
                              <th className="p-3 text-right">Amount Received</th>
                              <th className="p-3 text-center">VAT Rate</th>
                              <th className="p-3 text-right">VAT Due</th>
                              <th className="p-3 text-center">VAT Period</th>
                              <th className="p-3 text-center">Filing Settlement Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {clientData.paymentsWithVatStatus.map((p, idx) => {
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
                                    <Badge variant="outline" className={cn("text-[10px]", 
                                      p.payVat === 'Add' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900' :
                                      p.payVat === 'Yes' ? 'text-teal-650 bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900' :
                                      'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-800'
                                    )}>
                                      {p.payVat === 'Add' ? `Add ${vatRate}%` : p.payVat === 'Yes' ? `Incl. ${vatRate}%` : 'Exempt / No VAT'}
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
                                      <Badge className={cn("text-[10px] py-0.5 px-2 font-bold", settlementColor)}>
                                        {p.settlementStatus}
                                      </Badge>
                                      {p.key && (
                                        <span className="text-[10px] text-slate-400 font-semibold">
                                          Remitted: ₦{p.totalPaidForMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ₦{p.totalDueForMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                        <DollarSign className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="font-semibold text-sm">No Payments Logged</p>
                        <p className="text-xs text-slate-400 mt-1">No payments have been recorded for this client within the selected filter period.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CONTACTS TAB */}
              {activeTab === 'contacts' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clientData.contacts.length > 0 ? clientData.contacts.map(contact => (
                    <div key={contact.id} className={cn("p-5 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200">{contact.name}</h4>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{contact.position || 'No Position Specified'}</p>
                        </div>
                        <Badge variant="outline" className={contact.isActive ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}>
                          {contact.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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
              )}

              {/* OPERATIONS TAB */}
              {activeTab === 'operations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-500"/> Site Portfolio ({clientData.clientSites.length})</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] style-scroll pr-2">
                      {clientData.clientSites.map(site => (
                        <div key={site.id}
                          className={cn('p-3 rounded-lg border cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md group', isDark ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-100 bg-slate-50 hover:bg-white')}
                          onClick={() => setSelectedSite(site)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="font-semibold text-sm">{site.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={site.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>{site.status}</Badge>
                              <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          {site.startDate && <p className="text-xs text-slate-400 mt-1.5 ml-5.5">Since {new Date(site.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500"/> Active Workflows ({clientData.pendingTasks.length})</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] style-scroll pr-2">
                      {clientData.pendingTasks.length > 0 ? clientData.pendingTasks.map(task => (
                        <div key={task.id} className={cn("p-3 rounded-lg border", isDark ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50")}>
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-semibold text-sm block mb-1">{task.title}</span>
                              <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3"/> Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{task.requiresApproval ? "Pending Approval" : "In Progress"}</Badge>
                          </div>
                        </div>
                      )) : <p className="text-slate-500 text-sm text-center py-8">No active workflow tasks.</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVITY TAB */}
              {activeTab === 'activity' && (
                <div className={cn("p-6 rounded-2xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-blue-500"/> Interaction History</h3>
                  <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700 space-y-6">
                    {clientData.logs.length > 0 ? clientData.logs.slice(0, 20).map(log => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[31px] bg-slate-200 dark:bg-slate-700 rounded-full p-1.5">
                          <MessagesSquare className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{log.subject || 'Communication'}</span>
                            <span className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString()}</span>
                            <Badge variant="outline" className="text-[10px] h-5">{log.channel}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{log.notes}</p>
                          <p className="text-xs font-medium text-slate-500">Logged by: {log.loggedBy} {log.contactPerson && `• Contacted: ${log.contactPerson}`}</p>
                        </div>
                      </div>
                    )) : <p className="text-slate-500 text-sm">No communication logs recorded.</p>}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : null}
      </div>
    </div>
      )}

      {/* Client Edit Dialog */}
      {clientEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClientEditOpen(false)} />
          <div className={cn('relative z-10 w-full max-w-md rounded-3xl shadow-2xl p-6', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200')}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black">Edit Client</h2>
              <Button variant="ghost" size="icon" onClick={() => setClientEditOpen(false)} className="h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Client Name</label>
                <input value={clientEditForm.name || ''} readOnly disabled className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">TIN Number</label>
                <input value={clientEditForm.tinNumber || ''} readOnly disabled placeholder="Optional" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Address</label>
                <textarea value={clientEditForm.address || ''} onChange={e => setClientEditForm(f => ({ ...f, address: e.target.value }))} rows={2} placeholder="e.g. 5 Marina Road, Lagos Island" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Main Contact Person</label>
                <input value={clientEditForm.mainContactPerson || ''} onChange={e => setClientEditForm(f => ({ ...f, mainContactPerson: e.target.value }))} placeholder="e.g. John Doe" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Phone Number</label>
                <input value={clientEditForm.contactPhone || ''} onChange={e => setClientEditForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="e.g. +234 801 234 5678" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Start Date</label>
                <input type="date" value={clientEditForm.startDate || ''} readOnly disabled className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none cursor-not-allowed opacity-70', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-500')} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setClientEditOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={saveClientEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Site Edit Dialog */}
      {siteEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSiteEditTarget(null)} />
          <div className={cn('relative z-10 w-full max-w-md rounded-3xl shadow-2xl p-6', isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200')}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black">Edit Site</h2>
              <Button variant="ghost" size="icon" onClick={() => setSiteEditTarget(null)} className="h-8 w-8"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Address</label>
                <textarea value={siteEditForm.address || ''} onChange={e => setSiteEditForm(f => ({ ...f, address: e.target.value }))} rows={2} placeholder="e.g. 5 Marina Road, Lagos Island" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Main Contact Person</label>
                <input value={siteEditForm.mainContactPerson || ''} onChange={e => setSiteEditForm(f => ({ ...f, mainContactPerson: e.target.value }))} placeholder="e.g. John Doe" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Phone Number</label>
                <input value={siteEditForm.contactPhone || ''} onChange={e => setSiteEditForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="e.g. +234 801 234 5678" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Position</label>
                <input value={siteEditForm.position || ''} onChange={e => setSiteEditForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Site Manager" className={cn('w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200')} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setSiteEditTarget(null)} className="flex-1">Cancel</Button>
              <Button onClick={saveSiteEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
