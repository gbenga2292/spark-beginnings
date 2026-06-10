import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { normalizeDate } from '@/src/lib/dateUtils';
import {
  X, MapPin, DollarSign, Activity, Wrench, MessagesSquare,
  CheckCircle2, AlertTriangle, Clock, Fuel, Calendar,
  ChevronRight, Settings2, FileText, Users, Paperclip, ExternalLink, Eye
} from 'lucide-react';
import { DocPreviewModal } from '@/src/components/DocPreviewModal';
import type { SiteAttachment } from '@/src/types/SiteQuestionnaire';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppData, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';

type SiteTab = 'financials' | 'operations' | 'maintenance' | 'comms' | 'attachments';

interface Props {
  site: Site;
  filterMonth: string;
  filterYear: string;
  onClose: () => void;
  onEditSite?: (site: Site) => void;
}

export function SiteDetailDialog({ site, filterMonth, filterYear, onClose, onEditSite }: Props) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<SiteTab>('financials');
  const [previewDoc, setPreviewDoc] = useState<SiteAttachment | null>(null);

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vatRate = useAppStore(s => s.payrollVariables.vatRate);
  const commLogs = useAppStore(s => s.commLogs);
  const clientContacts = useAppStore(s => s.clientContacts);
  const pendingSites = useAppStore(s => s.pendingSites);
  const { dailyMachineLogs, maintenanceAssets, maintenanceSessions } = useOperations();
  const { mainTasks, subtasks } = useAppData();

  // Resolve attachments from the linked onboarding record
  const siteAttachments = useMemo(() => {
    const record = pendingSites.find(
      s => s.siteName?.trim() === site.name.trim() && s.clientName?.trim() === site.client?.trim()
    );
    return record?.attachments ?? [];
  }, [pendingSites, site.name, site.client]);

  const isWithinFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    if (filterMonth === 'all' && filterYear === 'all') return true;
    try {
      const normalized = normalizeDate(dateStr);
      if (!normalized) return false;
      const d = parseISO(normalized);
      if (isNaN(d.getTime())) return false;
      const matchYear = filterYear === 'all' || d.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === 'all' || (d.getMonth() + 1).toString() === filterMonth;
      return matchYear && matchMonth;
    } catch { return false; }
  };

  const data = useMemo(() => {
    // Financials
    const siteInvoices = invoices.filter(i =>
      (i.siteId === site.id || i.siteName?.trim() === site.name.trim()) && isWithinFilter(i.date)
    );
    const totalBilled = siteInvoices.reduce((a, i) => a + (i.totalCharge || i.amount || 0), 0);

    const sitePayments = payments.filter(p =>
      p.site?.trim() === site.name.trim() && isWithinFilter(p.date)
    );
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

    const siteCosts = ledgerEntries.filter(l =>
      l.site?.trim() === site.name.trim() && isWithinFilter(l.date)
    );
    const totalCost = siteCosts.reduce((a, l) => a + (l.amount || 0), 0);

    // Operations
    const machineLogs = dailyMachineLogs.filter(l =>
      l.siteId === site.id && isWithinFilter(l.date)
    );
    const totalDiesel = machineLogs.reduce((a, l) => a + (l.dieselUsage || 0), 0);
    const activeDays = machineLogs.filter(l => l.isActive).length;

    // Maintenance
    const siteMaintAssets = maintenanceAssets.filter(a => {
      const aSite = (a.site || '').trim().toLowerCase();
      return aSite === site.name.trim().toLowerCase() || aSite === site.id.trim().toLowerCase();
    });
    const siteMaintSessions = maintenanceSessions.filter(s_session => {
      const assetNamesInSession = s_session.assets.map(a => a.assetName);
      return assetNamesInSession.some(n => siteMaintAssets.some(a => a.name === n));
    });

    // Tasks
    const siteNameLow = site.name.toLowerCase();
    const siteTasks = mainTasks.filter(t =>
      (t.title?.toLowerCase().includes(siteNameLow) || t.description?.toLowerCase().includes(siteNameLow)) &&
      !t.isDeleted &&
      deriveMainTaskStatus(t.id, subtasks) !== 'completed'
    );

    // Comms
    const siteComms = commLogs.filter(l =>
      (l.siteId === site.id || l.siteName?.trim() === site.name.trim()) && isWithinFilter(l.date)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Site contacts
    const siteContacts = clientContacts.filter(c =>
      c.siteIds?.includes(site.id) || c.siteNames?.includes(site.name)
    );

    return {
      siteInvoices, totalBilled, totalReceived, outstanding, vatGenerated, totalCost,
      machineLogs, totalDiesel, activeDays,
      siteMaintAssets, siteMaintSessions,
      siteTasks, siteComms, siteContacts
    };
  }, [site, filterMonth, filterYear, invoices, payments, ledgerEntries, dailyMachineLogs, maintenanceAssets, maintenanceSessions, mainTasks, subtasks, commLogs, clientContacts]);

  const tabs: { id: SiteTab; label: string; icon: any; count?: number }[] = [
    { id: 'financials', label: 'Financials', icon: DollarSign },
    { id: 'operations', label: 'Operations', icon: Activity, count: data.machineLogs.length },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, count: data.siteMaintAssets.length },
    { id: 'comms', label: 'Comms & Tasks', icon: MessagesSquare, count: data.siteComms.length + data.siteTasks.length },
    { id: 'attachments', label: 'Documents', icon: Paperclip, count: siteAttachments.length },
  ];

  const card = cn('p-5 rounded-2xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200');
  const label = 'text-xs font-bold uppercase tracking-wider text-slate-500 mb-1';
  const row = 'flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative z-10 w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl',
        'max-h-[92vh]',
        isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'
      )}>
        {/* Header */}
        <div className={cn('p-5 border-b shrink-0 flex items-start justify-between gap-4', isDark ? 'border-slate-800' : 'border-slate-200')}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn('p-2.5 rounded-xl shrink-0', isDark ? 'bg-indigo-900/50' : 'bg-indigo-50')}>
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900 dark:text-white truncate">{site.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge className={cn(
                  'text-xs',
                  site.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  site.status === 'Ended' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                  'bg-slate-100 text-slate-600'
                )}>{site.status}</Badge>
                <span className="text-xs text-slate-500">VAT: <strong>{site.vat}</strong></span>
                {site.startDate && <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Since {new Date(site.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEditSite && (
              <Button variant="outline" size="sm" onClick={() => onEditSite(site)} className="h-8 text-xs">
                <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Edit Site
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-xl">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className={cn('flex items-center gap-0.5 px-5 border-b shrink-0 overflow-x-auto', isDark ? 'border-slate-800' : 'border-slate-200')}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-bold',
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                )}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 style-scroll">

          {/* ── FINANCIALS TAB ── */}
          {activeTab === 'financials' && (
            <div className="space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Billed', value: `₦${data.totalBilled.toLocaleString()}`, color: 'text-emerald-600' },
                  { label: 'Payments Received', value: `₦${data.totalReceived.toLocaleString()}`, color: 'text-sky-600' },
                  { label: 'Outstanding', value: `₦${data.outstanding.toLocaleString()}`, color: data.outstanding > 0 ? 'text-rose-500' : 'text-emerald-500' },
                  { label: 'VAT Generated', value: `₦${data.vatGenerated.toLocaleString()}`, color: 'text-amber-600' },
                ].map(k => (
                  <div key={k.label} className={card}>
                    <p className={label}>{k.label}</p>
                    <p className={cn('text-xl font-black', k.color)}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Invoice List */}
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500" /> Invoices ({data.siteInvoices.length})</h3>
                {data.siteInvoices.length > 0 ? (
                  <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                    {data.siteInvoices.map(inv => {
                      const paidForThis = payments.filter(p => p.site?.trim() === site.name.trim() && p.date >= inv.date).reduce((a, p) => a + p.amount, 0);
                      const isPaid = paidForThis >= (inv.totalCharge || inv.amount || 0) * 0.99;
                      return (
                        <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{inv.invoiceNumber || inv.id.slice(0, 8)}</p>
                            <p className="text-xs text-slate-500">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '—'} · {inv.billingCycle || 'Custom'}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <p className="font-bold text-sm">₦{(inv.totalCharge || inv.amount || 0).toLocaleString()}</p>
                            <Badge className={cn('text-xs', isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-8">No invoices for this site in the selected period.</p>}
              </div>

              {/* Costs */}
              <div className={card}>
                <h3 className="font-bold mb-3">Ledger Costs: <span className="text-rose-500">₦{data.totalCost.toLocaleString()}</span></h3>
                <p className="text-sm text-slate-500">Profit Estimate: <span className={cn('font-bold', data.totalBilled - data.totalCost >= 0 ? 'text-emerald-600' : 'text-rose-500')}>₦{(data.totalBilled - data.totalCost).toLocaleString()}</span></p>
              </div>
            </div>
          )}

          {/* ── OPERATIONS TAB ── */}
          {activeTab === 'operations' && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Machine Days', value: data.machineLogs.length, color: 'text-indigo-600' },
                  { label: 'Active Days', value: data.activeDays, color: 'text-emerald-600' },
                  { label: 'Total Diesel (L)', value: data.totalDiesel.toLocaleString(), color: 'text-amber-600' },
                ].map(k => (
                  <div key={k.label} className={card}>
                    <p className={label}>{k.label}</p>
                    <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Machine Log List */}
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Machine Logs ({data.machineLogs.length})</h3>
                {data.machineLogs.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.machineLogs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                      <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{log.assetName}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <Calendar className="w-3 h-3" />{new Date(log.date).toLocaleDateString('en-GB')}
                            <Fuel className="w-3 h-3 ml-1" />{log.dieselUsage}L
                          </p>
                          {log.issuesOnSite && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{log.issuesOnSite}</p>}
                        </div>
                        <Badge className={cn('text-xs shrink-0', log.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {log.isActive ? `Active · ${log.operationalDay || 'full'}` : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-8">No machine logs recorded for this site in the selected period.</p>}
              </div>
            </div>
          )}

          {/* ── MAINTENANCE TAB ── */}
          {activeTab === 'maintenance' && (
            <div className="space-y-5">
              {/* Asset Status */}
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><Wrench className="w-4 h-4 text-amber-500" /> Assets on Site ({data.siteMaintAssets.length})</h3>
                {data.siteMaintAssets.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.siteMaintAssets.map(asset => {
                      const statusColor = asset.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                        asset.status === 'due_soon' ? 'bg-amber-100 text-amber-700' :
                        asset.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-600';
                      return (
                        <div key={asset.id} className="py-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{asset.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Last service: {asset.lastServiceDate ? new Date(asset.lastServiceDate).toLocaleDateString('en-GB') : '—'} ·
                              Next: {asset.nextServiceDate ? new Date(asset.nextServiceDate).toLocaleDateString('en-GB') : '—'}
                            </p>
                          </div>
                          <Badge className={cn('text-xs capitalize shrink-0', statusColor)}>
                            {asset.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-8">No maintenance assets tracked for this site.</p>}
              </div>

              {/* Maintenance Sessions */}
              <div className={card}>
                <h3 className="font-bold mb-4">Recent Maintenance Sessions ({data.siteMaintSessions.length})</h3>
                {data.siteMaintSessions.length > 0 ? (
                  <div className="space-y-3">
                    {data.siteMaintSessions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(session => (
                      <div key={session.id} className={cn('p-3 rounded-xl border', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-semibold text-sm capitalize">{session.type} Maintenance</p>
                          <span className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString('en-GB')}</span>
                        </div>
                        <p className="text-xs text-slate-500">Technician: {session.technician}</p>
                        {session.generalRemark && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{session.generalRemark}</p>}
                        <div className="mt-2 space-y-1">
                          {session.assets.map((a, i) => (
                            <div key={i} className="text-xs flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">{a.assetName}</span>
                              <span className="font-medium">₦{a.cost.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-8">No maintenance sessions recorded.</p>}
              </div>
            </div>
          )}

          {/* ── COMMS & TASKS TAB ── */}
          {activeTab === 'comms' && (
            <div className="space-y-5">
              {/* Pending Tasks */}
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Pending Tasks ({data.siteTasks.length})</h3>
                {data.siteTasks.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.siteTasks.map(task => (
                      <div key={task.id} className="py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{task.title}</p>
                          {task.deadline && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" />Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{task.requiresApproval ? 'Pending Approval' : 'In Progress'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-6">No pending tasks for this site.</p>}
              </div>

              {/* Contacts */}
              {data.siteContacts.length > 0 && (
                <div className={card}>
                  <h3 className="font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Site Contacts</h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.siteContacts.map(c => (
                      <div key={c.id} className="py-3">
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">{c.position}</p>
                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                          {c.phone && <span>{c.phone}</span>}
                          {c.email && <span>{c.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comm Logs */}
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><MessagesSquare className="w-4 h-4 text-blue-500" /> Communication Logs ({data.siteComms.length})</h3>
                {data.siteComms.length > 0 ? (
                  <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-700 space-y-5">
                    {data.siteComms.slice(0, 15).map(log => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[25px] bg-slate-200 dark:bg-slate-700 rounded-full p-1">
                          <MessagesSquare className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm">{log.subject || 'Communication'}</span>
                          <span className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString('en-GB')}</span>
                          <Badge variant="outline" className="text-[10px] h-4">{log.channel}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{log.notes}</p>
                        <p className="text-xs text-slate-400 mt-1">By: {log.loggedBy}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-500 text-sm text-center py-8">No communication logs for this site.</p>}
              </div>
            </div>
          )}

          {/* ── ATTACHMENTS TAB ── */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className={card}>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-500" />
                  Site Documents ({siteAttachments.length})
                </h3>

                {siteAttachments.length === 0 ? (
                  <div className="text-center py-10">
                    <Paperclip className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No documents uploaded yet.</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Open the Site Onboarding record and go to the Documents tab to upload files.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {siteAttachments.map((att, i) => {
                      const isImage = att.fileType?.startsWith('image/');
                      return (
                        <a
                          key={att.id ?? i}
                          href={att.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border transition-all group',
                            att.url
                              ? 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 cursor-pointer'
                              : 'border-slate-100 bg-slate-50 cursor-default opacity-60'
                          )}
                        >
                          <div className={cn(
                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                            isImage ? 'bg-sky-100 text-sky-600' : 'bg-indigo-100 text-indigo-600'
                          )}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                              {att.caption || att.name}
                            </p>
                            {att.caption && (
                              <p className="text-xs text-slate-400 truncate">{att.name}</p>
                            )}
                            <p className="text-xs text-slate-400">
                              {att.uploadedBy && <>{att.uploadedBy} · </>}
                              {att.uploadedAt && !isNaN(new Date(att.uploadedAt).getTime())
                                ? new Date(att.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </p>
                          </div>
                          {att.url && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setPreviewDoc(att); }}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-app document preview */}
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
