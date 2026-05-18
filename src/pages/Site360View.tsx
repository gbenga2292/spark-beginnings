import { useMemo, useState, useRef, useEffect } from 'react';
import { parseISO } from 'date-fns';
import {
  ArrowLeft, MapPin, DollarSign, Activity, Wrench, MessagesSquare,
  AlertTriangle, Clock, Fuel, Calendar, FileText, Users, Settings2,
  ChevronDown, Sparkles, RefreshCcw, Send, ChevronUp, Filter
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';

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
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vatRate = useAppStore(s => s.payrollVariables.vatRate);
  const commLogs = useAppStore(s => s.commLogs);
  const clientContacts = useAppStore(s => s.clientContacts);
  const { dailyMachineLogs, maintenanceAssets, maintenanceSessions } = useOperations();
  const { mainTasks, subtasks } = useAppData();

  const isWithinFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    if (filterMonth === 'all' && filterYear === 'all') return true;
    try {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return false;
      const matchYear = filterYear === 'all' || d.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'all' || (d.getMonth() + 1).toString() === filterMonth;
      return matchYear && matchMonth;
    } catch { return false; }
  };

  const data = useMemo(() => {
    const siteInvoices = invoices.filter(i =>
      (i.siteId === site.id || i.siteName?.trim() === site.name.trim()) && isWithinFilter(i.date)
    );
    const totalBilled = siteInvoices.reduce((a, i) => a + (i.totalCharge || i.amount || 0), 0);
    const sitePayments = payments.filter(p => p.site?.trim() === site.name.trim() && isWithinFilter(p.date));
    const totalReceived = sitePayments.reduce((a, p) => a + (p.amount || 0), 0);
    const outstanding = totalBilled - totalReceived;

    const vatGenerated = siteInvoices.reduce((acc, i) => {
      if (i.vat !== undefined) return acc + i.vat;
      const base = (i.totalCost || i.amount || 0) - (i.damages || 0);
      const vatInc = i.vatInc || 'No';
      let vat = 0;
      if (vatInc === 'Yes') vat = (base / (100 + vatRate)) * vatRate;
      else if (vatInc === 'Add') vat = base * (vatRate / 100);
      return acc + Math.round(vat * 100) / 100;
    }, 0);

    const siteCosts = ledgerEntries.filter(l => l.site?.trim() === site.name.trim() && isWithinFilter(l.date));
    const totalCost = siteCosts.reduce((a, l) => a + (l.amount || 0), 0);

    const machineLogs = dailyMachineLogs.filter(l => l.siteId === site.id && isWithinFilter(l.date));
    const totalDiesel = machineLogs.reduce((a, l) => a + (l.dieselUsage || 0), 0);
    const activeDays = machineLogs.filter(l => l.isActive).length;

    const siteMaintAssets = maintenanceAssets.filter(a => a.site?.trim() === site.name.trim());
    const siteMaintSessions = maintenanceSessions.filter(s_session =>
      s_session.assets.some(a => siteMaintAssets.some(ma => ma.name === a.assetName))
    );
    const totalMaintenanceCost = siteMaintSessions.reduce((acc, s) =>
      acc + s.assets.reduce((a, asset) => a + (asset.cost || 0), 0), 0
    );

    const siteNameLow = site.name.toLowerCase();
    const siteTasks = mainTasks.filter(t =>
      (t.title?.toLowerCase().includes(siteNameLow) || t.description?.toLowerCase().includes(siteNameLow)) &&
      !t.isDeleted && deriveMainTaskStatus(t.id, subtasks) !== 'completed'
    );

    const siteComms = commLogs.filter(l =>
      (l.siteId === site.id || l.siteName?.trim() === site.name.trim()) && isWithinFilter(l.date)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const siteContacts = clientContacts.filter(c =>
      c.siteIds?.includes(site.id) || c.siteNames?.includes(site.name)
    );

    const alerts: { title: string; type: 'warning' | 'danger' }[] = [];
    if (outstanding > 0) alerts.push({ title: `Unpaid Balance: ₦${outstanding.toLocaleString()}`, type: 'warning' });
    if (siteMaintAssets.some(a => a.status === 'overdue')) alerts.push({ title: 'Overdue maintenance on one or more assets', type: 'danger' });
    if (siteTasks.length > 3) alerts.push({ title: `${siteTasks.length} pending tasks`, type: 'warning' });

    return {
      siteInvoices, totalBilled, totalReceived, outstanding, vatGenerated, totalCost,
      machineLogs, totalDiesel, activeDays,
      siteMaintAssets, siteMaintSessions, totalMaintenanceCost,
      siteTasks, siteComms, siteContacts, alerts,
      profit: totalBilled - totalCost
    };
  }, [site, filterMonth, filterYear, invoices, payments, ledgerEntries, vatRate, dailyMachineLogs, maintenanceAssets, maintenanceSessions, mainTasks, subtasks, commLogs, clientContacts]);

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


          <div className={cn('bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl shadow-lg relative overflow-hidden border border-indigo-700/50 flex flex-col transition-all duration-300', isChatCollapsed ? 'h-auto' : 'h-[300px]')}>
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles className="w-48 h-48" /></div>
            <div className="flex items-center justify-between p-4 border-b border-indigo-800/50 relative z-10 shrink-0 cursor-pointer hover:bg-indigo-800/20 transition-colors" onClick={() => setIsChatCollapsed(!isChatCollapsed)}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Sparkles className="w-4 h-4 text-indigo-300" /></div>
                <span className="text-sm font-bold uppercase tracking-wider text-indigo-200">Site Intelligence Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                {!isChatCollapsed && messages.length === 0 && (
                  <div className="flex items-center gap-2">
                    <Button onClick={(e) => { e.stopPropagation(); onEditSite(site); }} variant="outline" size="sm" className="h-8 text-xs bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 border-indigo-700">
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Edit Site
                    </Button>
                    <Button onClick={e => { e.stopPropagation(); sendChatMessage(true); }} disabled={isGeneratingBrief} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 h-8 text-xs">
                      {isGeneratingBrief ? <RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                      {isGeneratingBrief ? 'Analyzing...' : 'Generate Brief'}
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

          {/* Site Identity Card */}
          <div className={cn('p-6 rounded-3xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className={cn('p-3 rounded-2xl shrink-0', isDark ? 'bg-indigo-900/50' : 'bg-indigo-50')}>
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">{site.name}</h1>
                  <p className="text-slate-500 text-sm mt-0.5">Client: <span className="font-semibold text-slate-700 dark:text-slate-300">{site.client}</span></p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge className={cn('text-xs',
                      site.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      site.status === 'Ended' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                    )}>{site.status}</Badge>
                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">VAT: <strong>{site.vat}</strong></span>
                    {site.startDate && <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Since {new Date(site.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Billed', value: `₦${data.totalBilled.toLocaleString()}`, color: 'text-emerald-600' },
              { label: 'Outstanding', value: `₦${data.outstanding.toLocaleString()}`, color: data.outstanding > 0 ? 'text-rose-500' : 'text-emerald-500' },
              { label: 'Machine Days', value: data.machineLogs.length.toString(), color: 'text-indigo-600' },
              { label: 'Pending Tasks', value: data.siteTasks.length.toString(), color: 'text-amber-600' },
            ].map(k => (
              <div key={k.label} className={card}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
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
          <div className={cn('flex items-center gap-1 border-b overflow-x-auto style-scroll pb-px', isDark ? 'border-slate-800' : 'border-slate-200')}>
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

          {/* Tab Content */}
          <div className="animate-in fade-in duration-300 space-y-5">

            {/* FINANCIALS */}
            {activeTab === 'financials' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Payments Received', value: `₦${data.totalReceived.toLocaleString()}`, color: 'text-sky-600' },
                    { label: 'VAT Generated', value: `₦${data.vatGenerated.toLocaleString()}`, color: 'text-amber-600' },
                    { label: 'Profit Estimate', value: `₦${data.profit.toLocaleString()}`, color: data.profit >= 0 ? 'text-emerald-600' : 'text-rose-500' },
                  ].map(k => (
                    <div key={k.label} className={card}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                      <p className={cn('text-xl font-black', k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className={card}>
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-indigo-500" /> Invoices ({data.siteInvoices.length})</h3>
                  {data.siteInvoices.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.siteInvoices.map(inv => {
                        const paid = payments.filter(p => p.site?.trim() === site.name.trim() && p.date >= inv.date).reduce((a, p) => a + p.amount, 0);
                        const isPaid = paid >= (inv.totalCharge || inv.amount || 0) * 0.99;
                        return (
                          <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm">{inv.invoiceNumber || inv.id.slice(0, 8)}</p>
                              <p className="text-xs text-slate-500">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '—'} · {inv.billingCycle || 'Custom'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-sm">₦{(inv.totalCharge || inv.amount || 0).toLocaleString()}</p>
                              <Badge className={isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{isPaid ? 'Paid' : 'Unpaid'}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-slate-500 text-sm text-center py-8">No invoices for this site in the selected period.</p>}
                </div>
              </>
            )}

            {/* OPERATIONS */}
            {activeTab === 'operations' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Log Days', value: data.machineLogs.length, color: 'text-indigo-600' },
                    { label: 'Active Days', value: data.activeDays, color: 'text-emerald-600' },
                    { label: 'Total Diesel (L)', value: data.totalDiesel.toLocaleString(), color: 'text-amber-600' },
                  ].map(k => (
                    <div key={k.label} className={card}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                      <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
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
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Assets Tracked', value: data.siteMaintAssets.length, color: 'text-indigo-600' },
                    { label: 'Sessions', value: data.siteMaintSessions.length, color: 'text-amber-600' },
                    { label: 'Total Cost', value: `₦${data.totalMaintenanceCost.toLocaleString()}`, color: 'text-rose-500' },
                  ].map(k => (
                    <div key={k.label} className={card}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{k.label}</p>
                      <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className={card}>
                  <h3 className="font-bold mb-4 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Pending Tasks ({data.siteTasks.length})</h3>
                  {data.siteTasks.length > 0 ? data.siteTasks.map(task => (
                    <div key={task.id} className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold text-sm">{task.title}</p>
                        {task.deadline && <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{task.requiresApproval ? 'Approval' : 'In Progress'}</Badge>
                    </div>
                  )) : <p className="text-slate-500 text-sm text-center py-8">No pending tasks.</p>}
                </div>
                <div className={card}>
                  <h3 className="font-bold mb-4 text-lg flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-blue-500" /> Communication Logs ({data.siteComms.length})</h3>
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
                      <h4 className="font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Site Contacts</h4>
                      {data.siteContacts.map(c => (
                        <div key={c.id} className="py-2">
                          <p className="font-semibold text-sm">{c.name} <span className="text-xs text-indigo-500">· {c.position}</span></p>
                          <p className="text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
