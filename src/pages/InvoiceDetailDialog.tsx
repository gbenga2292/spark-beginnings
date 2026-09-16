import React, { useMemo } from 'react';
import { X, Printer, Edit, Clock, Calendar, TrendingUp, Fuel, Package, DollarSign, CheckCircle, FileText, ChevronLeft, ChevronRight, CreditCard, ArrowRight } from 'lucide-react';
import { Invoice } from '@/src/store/appStore';
import { DailyMachineLog } from '@/src/types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { getInvoiceSettlement } from '@/src/lib/settlementUtils';

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  invoiceList: any[];
  open: boolean;
  onClose: () => void;
  onNavigate: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onPrint: (inv: Invoice) => void;
}

function dayValue(log: DailyMachineLog): number {
  const d = log.operationalDay ?? (log.isActive ? 'full' : 'none');
  if (d === 'full') return 1;
  if (d === 'half') return 0.5;
  return 0;
}

function dayLabel(log: DailyMachineLog): string {
  const d = log.operationalDay ?? (log.isActive ? 'full' : 'none');
  if (d === 'full') return 'Full';
  if (d === 'half') return 'Half';
  return 'None';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Math.ceil(days));
  return d.toISOString().split('T')[0];
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceDetailDialog({ invoice, invoiceList, open, onClose, onNavigate, onEdit, onPrint }: InvoiceDetailDialogProps) {
  const { maintenanceAssets, dailyMachineLogs, waybills, assets, sitePumpDates } = useOperations();
  const payments = useAppStore(state => state.payments);
  const invoices = useAppStore(state => state.invoices);
  const sites = useAppStore(state => state.sites);
  const openPaymentModalForInvoice = useAppStore(state => state.openPaymentModalForInvoice);

  const inv = invoice as any;

  const settlement = useMemo(() => {
    if (!invoice) return null;
    return getInvoiceSettlement(invoice, invoices, payments);
  }, [invoice, invoices, payments]);

  const liveEndDate = useMemo(() => {
    if (!invoice) return '';
    const startDateStr = inv.startDate || invoice.date;
    const duration = invoice.duration ?? 0;
    const linkedAssets = inv.linkedAssetIds || [];

    if (!startDateStr || duration <= 0) return inv.endDate || invoice.dueDate || '';

    // If countOffDays is not false, use standard date calculation
    if (inv.countOffDays !== false) {
      const start = new Date(startDateStr);
      if (isNaN(start.getTime())) return inv.endDate || invoice.dueDate || '';
      start.setDate(start.getDate() + duration - 1);
      return start.toISOString().split('T')[0];
    }

    // Dynamic end-date calculation when countOffDays is false
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return inv.endDate || invoice.dueDate || '';

    const siteName = (inv.site || invoice.siteName || '').trim();
    const clientName = (invoice.client || '').trim();
    const realSite = sites.find(s => s.name === siteName && s.client === clientName) || 
                     sites.find(s => s.name === clientName && s.client === siteName);
    const siteId = realSite?.id;

    if (!siteId) {
      const startCopy = new Date(start);
      startCopy.setDate(startCopy.getDate() + duration - 1);
      return startCopy.toISOString().split('T')[0];
    }

    let daysCounted = 0;
    let currentDate = new Date(start);

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

    return currentDate.toISOString().split('T')[0];
  }, [invoice, dailyMachineLogs, sites]);

  // Navigation
  const currentIndex = invoiceList.findIndex(i => i.id === invoice?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < invoiceList.length - 1;


  const invoiceSiteName = (invoice?.siteName || inv?.site || '').trim().toLowerCase();
  const invoiceSiteId = (invoice?.siteId || '').trim().toLowerCase();
  const invoiceDuration = invoice?.duration ?? 0;
  const invoiceStartDate = inv?.startDate || invoice?.date || '';

  // -- Match logs by site name directly or flexibly (most reliable)
  const relevantLogs = useMemo(() => {
    if (!invoiceSiteName || !invoiceStartDate || !invoice) return [];
    return dailyMachineLogs
      .filter(l => {
        const logSite = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
        const isSiteMatch = logSite === invoiceSiteName || 
                            logSite === invoiceSiteId || 
                            (logSite.length > 3 && invoiceSiteName.includes(logSite)) || 
                            (invoiceSiteName.length > 3 && logSite.includes(invoiceSiteName));
        return isSiteMatch && l.date >= invoiceStartDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyMachineLogs, invoiceSiteName, invoiceSiteId, invoiceStartDate, invoice]);

  const displayStatus = settlement ? settlement.status : (invoice?.status ?? 'Sent');

  const statusColor = {
    'Paid': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    'Partially Paid': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    'Sent': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'Overdue': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  }[displayStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  const siteMachines = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; serialNumber?: string }>();

    // 1. Get all machines currently assigned to this site in Operations
    maintenanceAssets.forEach(a => {
      const aSite = (a.site || '').trim().toLowerCase();
      const match = aSite === invoiceSiteName || 
             aSite === invoiceSiteId || 
             (aSite.length > 3 && invoiceSiteName.includes(aSite)) || 
             (invoiceSiteName.length > 3 && aSite.includes(invoiceSiteName));
      if (match) {
        seen.set(a.id, { id: a.id, name: a.name, serialNumber: a.serialNumber });
      }
    });

    // 2. Get machines assigned via Waybills (the source of truth for Site Inventory)
    const siteWaybills = waybills.filter(w => {
      const wSite = (w.siteName || '').trim().toLowerCase();
      return (wSite === invoiceSiteName || 
              w.siteId === invoiceSiteId ||
              (wSite.length > 3 && invoiceSiteName.includes(wSite)) ||
              (invoiceSiteName.length > 3 && wSite.includes(invoiceSiteName))) && 
             w.status !== 'outstanding';
    });

    const inventoryMap = new Map<string, number>();
    siteWaybills.filter(w => w.type === 'waybill').forEach(wb => {
      wb.items.forEach(item => {
        inventoryMap.set(item.assetId, (inventoryMap.get(item.assetId) || 0) + item.quantity);
      });
    });
    siteWaybills.filter(w => w.type === 'return').forEach(wb => {
      wb.items.forEach(item => {
        const qty = inventoryMap.get(item.assetId) || 0;
        inventoryMap.set(item.assetId, Math.max(0, qty - item.quantity));
      });
    });

    Array.from(inventoryMap.entries()).forEach(([id, qty]) => {
      if (qty > 0 && !seen.has(id)) {
        const asset = assets.find(a => a.id === id);
        // Only include equipment that requires logging
        if (asset && asset.type === 'equipment' && asset.requiresLogging) {
          seen.set(id, { id: asset.id, name: asset.name, serialNumber: asset.serialNumber });
        }
      }
    });

    // 3. Add machines that have historical logs for this site during the invoice period
    relevantLogs.forEach(l => {
      if (!seen.has(l.assetId)) {
        const asset = assets.find(a => a.id === l.assetId);
        seen.set(l.assetId, { id: l.assetId, name: l.assetName, serialNumber: asset?.serialNumber });
      }
    });
    
    const list = Array.from(seen.values()).map(m => {
      const pumpDateRec = (sitePumpDates || []).find(pd => 
        (pd.siteId === invoiceSiteId || (invoiceSiteName && pd.siteId === invoice?.siteId)) && pd.assetId === m.id
      );
      const isStopped = Boolean(pumpDateRec?.pumpStopDate);
      const stopDate = pumpDateRec?.pumpStopDate || undefined;
      return { ...m, isStopped, stopDate };
    });

    list.sort((a, b) => {
      if (a.isStopped && !b.isStopped) return 1;
      if (!a.isStopped && b.isStopped) return -1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [maintenanceAssets, waybills, assets, invoiceSiteName, invoiceSiteId, relevantLogs, sitePumpDates, invoice?.siteId]);

  const machineConfigs: any[] = invoice?.machineConfigs ?? [];
  const totalContractedDays = useMemo(() => {
    if (machineConfigs.length > 0) {
      const firstDur = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || invoiceDuration;
      let total = machineConfigs.reduce((sum, c) => {
        const d = c.sameDurationAsFirst ? firstDur : (parseFloat(String(c.duration ?? 0)) || firstDur || invoiceDuration);
        return sum + d;
      }, 0);
      if (invoice?.noOfMachine && invoice.noOfMachine > machineConfigs.length) {
        total += (invoice.noOfMachine - machineConfigs.length) * (firstDur || invoiceDuration);
      }
      return total;
    }
    const count = invoice?.noOfMachine || 1;
    return count * invoiceDuration;
  }, [machineConfigs, invoice?.noOfMachine, invoiceDuration]);

  const consumedDays = useMemo(() =>
    relevantLogs.reduce((acc, l) => acc + dayValue(l), 0)
  , [relevantLogs]);

  const remainingDays = Math.max(0, totalContractedDays - consumedDays);
  const progressPct = totalContractedDays > 0 ? Math.min(100, (consumedDays / totalContractedDays) * 100) : 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const invoicedCount = invoice?.noOfMachine || machineConfigs.length || 1;
  const activeMachines = siteMachines.filter(m => !m.isStopped);
  const activeMachineCount = Math.max(1, activeMachines.length || invoicedCount);
  const projectedEndDate = remainingDays > 0 ? addDays(todayStr, Math.ceil(remainingDays / activeMachineCount)) : todayStr;

  const totalCharge = invoice?.totalCharge ?? invoice?.amount ?? 0;

  if (!open || !invoice) return null;

  return (
    <>
      <div className="fixed inset-0 z-[130] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-[140] w-full md:w-[600px] lg:w-[700px] flex flex-col bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="bg-blue-600 dark:bg-slate-900 px-6 py-5 text-white flex-shrink-0 border-b border-blue-700 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 opacity-80" />
                <span className="text-blue-100 text-xs font-bold uppercase tracking-widest">Invoice</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">{inv.invoiceNo || invoice.invoiceNumber}</h2>
              <p className="text-blue-100 text-sm mt-1 truncate">{invoice.client} &mdash; <span className="italic">{invoice.siteName || inv.site}</span></p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn("border font-bold text-[11px] px-2.5", statusColor)}>{displayStatus}</Badge>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Action strip + navigation */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-blue-500/40 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                disabled={Boolean(settlement && settlement.isPaid)}
                className={cn(
                  "gap-1.5 h-8 text-xs",
                  settlement?.isPaid 
                    ? "opacity-50 cursor-not-allowed text-white/50 bg-white/5" 
                    : "text-white/90 hover:text-white hover:bg-white/15 bg-white/10"
                )}
                title={settlement?.isPaid ? "This invoice is already fully paid" : "Record Payment"}
                onClick={() => {
                  if (invoice && (!settlement || !settlement.isPaid)) {
                    openPaymentModalForInvoice({
                      client: invoice.client,
                      site: invoice.siteName || inv.site || '',
                      invoiceId: invoice.id,
                      invoiceNumber: invoice.invoiceNumber || (invoice as any).invoiceNo || invoice.id,
                      amount: settlement ? settlement.remainingBalance : Number(invoice.totalCharge || (invoice as any).amount || 0),
                    });
                    onClose();
                  }
                }}
              >
                <CreditCard className="h-3.5 w-3.5" /> {settlement?.isPaid ? 'Fully Paid' : 'Record Payment'}
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-white/90 hover:text-white hover:bg-white/15 h-8 text-xs" onClick={() => onEdit(invoice)}>
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-white/90 hover:text-white hover:bg-white/15 h-8 text-xs" onClick={() => onPrint(invoice)}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <button
                disabled={!hasPrev}
                onClick={() => hasPrev && onNavigate(invoiceList[currentIndex - 1])}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous invoice"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-blue-100 text-xs font-medium tabular-nums px-1">
                {currentIndex + 1} / {invoiceList.length}
              </span>
              <button
                disabled={!hasNext}
                onClick={() => hasNext && onNavigate(invoiceList[currentIndex + 1])}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next invoice"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Period & Summary */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <SectionTitle icon={<Calendar className="h-4 w-4" />} title="Period & Summary" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <StatCard label="Start Date" value={formatDisplayDate(inv.startDate || invoice.date)} />
              
              <div className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2.5 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</p>
                <div className="mt-0.5">
                  <p className="font-bold text-sm text-slate-700 truncate">
                    {formatDisplayDate(
                      (() => {
                        const startDateStr = inv.startDate || invoice.date;
                        const duration = invoice.duration ?? 0;
                        if (!startDateStr || duration <= 0) return inv.endDate || invoice.dueDate || '';
                        const start = new Date(startDateStr);
                        if (!isNaN(start.getTime())) {
                          start.setDate(start.getDate() + duration - 1);
                          return start.toISOString().split('T')[0];
                        }
                        return inv.endDate || invoice.dueDate || '';
                      })()
                    )}
                  </p>
                  {inv.countOffDays === false && liveEndDate && (
                    <div className="mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 inline-block truncate max-w-full">
                        Actual: {formatDisplayDate(liveEndDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <StatCard label="Duration" value={`${invoice.duration ?? 0} Days`} highlight />
              <StatCard label="Billing Cycle" value={invoice.billingCycle ?? '—'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <StatCard 
                label="VAT Status" 
                value={invoice.vatScope === 'per_section' ? `${invoice.vatInc ?? 'No VAT'} (Itemized)` : (invoice.vatInc ?? 'No VAT')} 
              />
              <StatCard label="Reminder Date" value={invoice.reminderDate ? formatDisplayDate(invoice.reminderDate) : '—'} />
              <StatCard label="Status" value={invoice.status} />
            </div>
          </div>

          {/* Equipment & Rates */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <SectionTitle icon={<Package className="h-4 w-4" />} title="Equipment & Rates" />
            <div className="mt-3 space-y-2">
              {machineConfigs.length > 0 ? (
                machineConfigs.map((cfg: any, i: number) => {
                  const firstRate  = parseFloat(String(machineConfigs[0]?.rate ?? 0)) || 0;
                  const firstDur   = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || 0;
                  const firstUsage = parseFloat(String(machineConfigs[0]?.dailyUsage ?? invoice.dailyUsage ?? 0)) || 0;
                  const rate  = cfg.sameRateAsFirst ? firstRate : (parseFloat(String(cfg.rate ?? 0)) || 0);
                  const dur   = cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || 0);
                  const usage = cfg.sameUsageAsFirst ? firstUsage : (parseFloat(String(cfg.dailyUsage ?? invoice.dailyUsage ?? 0)) || 0);
                  return (
                    <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-sm bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-black font-mono">M{i+1}</div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">Machine {i + 1}</span>
                          {usage > 0 && <span className="text-[10px] text-orange-600 font-semibold">{usage} L/day fuel usage</span>}
                        </div>
                        {cfg.name && <span className="text-xs text-slate-400">({cfg.name})</span>}
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-800 text-sm">₦{fmt(rate)}<span className="text-xs font-normal text-slate-400">/day</span></div>
                        {dur > 0 && <div className="text-xs text-slate-500">{dur} days contracted</div>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-sm bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-black font-mono">M</div>
                    <span className="text-sm font-medium text-slate-700">{invoice.noOfMachine ?? 0} × Machine(s)</span>
                  </div>
                  <div className="font-mono font-bold text-slate-800 text-sm">₦{fmt(invoice.dailyRentalCost ?? 0)}<span className="text-xs font-normal text-slate-400">/day</span></div>
                </div>
              )}
              {(invoice.noOfTechnician ?? 0) > 0 && (() => {
                const hasNightOrAccommodation = 'technicianNightFee' in inv || 'technicianAccommodation' in inv;
                const dayRate = invoice.techniciansDailyRate || 0;
                const nightRate = parseFloat(inv.technicianNightFee) || 0;
                const accommodationRate = parseFloat(inv.technicianAccommodation) || 0;
                
                const noOfTechnician = invoice.noOfTechnician || 0;
                const noOfTechnicianNight = inv.technicianNightCountSameAsDay !== false
                  ? noOfTechnician
                  : (parseFloat(inv.noOfTechnicianNight) || 0);
                const countsDiffer = noOfTechnician !== noOfTechnicianNight;
                const accommodatedTechs = Math.max(noOfTechnician, noOfTechnicianNight);

                const totalRate = dayRate + nightRate + accommodationRate;
                
                const actualTechDuration = inv.technicianDurationSameAsMachine !== false 
                  ? invoiceDuration 
                  : (parseFloat(inv.technicianDuration) || invoiceDuration);
                const actualNightDuration = inv.technicianNightDurationSameAsMachine !== false 
                  ? invoiceDuration 
                  : (parseFloat(inv.technicianNightDuration) || invoiceDuration);

                return (
                  <div className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-black">T</div>
                        <span className="text-sm font-semibold text-slate-700">
                          {countsDiffer ? `${noOfTechnician} Day / ${noOfTechnicianNight} Night Crew` : `${noOfTechnician} × Technician(s)`}
                        </span>
                      </div>
                      <div className="text-right">
                        {!countsDiffer && <div className="font-mono font-bold text-slate-800 text-sm">₦{fmt(totalRate)}<span className="text-xs font-normal text-slate-400">/day total</span></div>}
                        <div className="text-xs text-slate-500 font-medium">Cost: ₦{fmt(invoice.techniciansCost ?? 0)}</div>
                      </div>
                    </div>
                    
                    {hasNightOrAccommodation && (
                      <div className="pl-9 pt-2 border-t border-slate-200/40 space-y-1 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span>Day Rate: {countsDiffer ? `${noOfTechnician} × ` : ''}₦{fmt(dayRate)}/day</span>
                          <span className="font-medium text-slate-400">Duration: {actualTechDuration} days</span>
                        </div>
                        {nightRate > 0 && (
                          <div className="flex justify-between">
                            <span>Night Rate: {countsDiffer ? `${noOfTechnicianNight} × ` : ''}₦{fmt(nightRate)}/night</span>
                            <span className="font-medium text-slate-400">Duration: {actualNightDuration} nights</span>
                          </div>
                        )}
                        {accommodationRate > 0 && (
                          <div className="flex justify-between">
                            <span>Accommodation: {countsDiffer ? `${accommodatedTechs} × ` : ''}₦{fmt(accommodationRate)}/day</span>
                            <span className="font-medium text-slate-400">Duration: {actualTechDuration} days</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {(invoice.dailyUsage ?? 0) > 0 && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-slate-700">Diesel</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-800 text-sm">₦{fmt(invoice.dieselCostPerLtr ?? 0)}/L</div>
                    <div className="text-xs text-slate-500">{invoice.dailyUsage}L/day</div>
                  </div>
                </div>
              )}

              {invoice.auxiliaryEquipment && invoice.auxiliaryEquipment.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Auxiliary Leased Assets (No Fuel)
                  </div>
                  {invoice.auxiliaryEquipment.map((item, idx) => {
                    const q = item.quantity || 1;
                    const r = item.rate || 0;
                    const d = item.duration || 0;
                    const total = q * r * d;
                    return (
                      <div key={item.id || idx} className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-sm bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-black font-mono">
                              A
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-slate-800">{item.name || `Auxiliary Item #${idx + 1}`}</span>
                              <span className="text-xs text-slate-400 ml-1.5">({q} unit{q !== 1 ? 's' : ''})</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-800 text-sm">₦{fmt(total)}</div>
                            <div className="text-[11px] text-slate-400">₦{fmt(r)}/day × {d} days</div>
                          </div>
                        </div>
                        {item.note && (
                          <div className="pl-9 text-xs text-slate-500 bg-white/70 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                            <span className="font-semibold text-slate-600">Note:</span> {item.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Runtime Tracker — auto-detected from site machines */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <SectionTitle icon={<Clock className="h-4 w-4" />} title="Runtime Tracker" />
            {siteMachines.length === 0 ? (
              <div className="mt-3 bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-4 py-3 text-slate-400 text-sm">
                No machines found on site <span className="font-semibold text-slate-500">{invoice.siteName || inv.site}</span> in Operations.
              </div>
            ) : invoiceDuration === 0 ? (
              <div className="mt-3 bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-4 py-3 text-slate-400 text-sm">
                Invoice has no duration set — unable to calculate runtime progress.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-500">Days Consumed</span>
                    <span className="font-bold text-slate-700 tabular-nums">{consumedDays.toFixed(1)} / {totalContractedDays} days ({progressPct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700",
                        progressPct >= 100 ? "bg-emerald-500" : progressPct >= 70 ? "bg-amber-500" : "bg-blue-600"
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-sm p-3 text-center">
                    <p className="text-xl font-black font-mono tabular-nums text-blue-700 dark:text-blue-300">{consumedDays.toFixed(1)}</p>
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">Used</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm p-3 text-center">
                    <p className="text-xl font-black text-slate-700">{remainingDays.toFixed(1)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Remaining</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm p-3 text-center">
                    <p className="text-xl font-black text-slate-700">{totalContractedDays}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Contracted</p>
                  </div>
                </div>

                {/* Projected end */}
                <div className="bg-white border border-slate-200 rounded-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-500" /> Projected Completion
                  </div>
                  <span className="font-bold text-slate-800 text-sm">{formatDisplayDate(projectedEndDate)}</span>
                </div>

                {/* Actual end date — only shown when off-days extend the invoice */}
                {inv.countOffDays === false && liveEndDate && (
                  <div className="bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-amber-500" /> Actual End Date
                      <span className="text-[10px] font-bold bg-amber-200/60 text-amber-800 px-1.5 py-0.5 rounded uppercase tracking-wide">Off-days excluded</span>
                    </div>
                    <span className="font-black text-amber-800 text-sm">{formatDisplayDate(liveEndDate)}</span>
                  </div>
                )}

                {/* Site machines list */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Site Machines ({siteMachines.length})</p>
                  <div className="space-y-1">
                    {siteMachines.map((a, idx) => {
                      const machineLogs = relevantLogs.filter(l => l.assetId === a.id);
                      const machineConsumed = machineLogs.reduce((s, l) => s + dayValue(l), 0);
                      const invoicedCount = invoice?.noOfMachine || machineConfigs.length || 1;
                      const hasSwaps = siteMachines.length > invoicedCount || siteMachines.some(m => (m as any).isStopped);
                      const firstDur = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || invoiceDuration;
                      const cfg = !hasSwaps ? machineConfigs[idx] : undefined;
                      const machineDuration = cfg
                        ? (cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || firstDur || invoiceDuration))
                        : invoiceDuration;
                      const isOver = machineDuration > 0 && machineConsumed > machineDuration;
                      const overDays = isOver ? machineConsumed - machineDuration : 0;
                      const isStopped = (a as any).isStopped;

                      return (
                        <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("text-sm font-medium truncate", isStopped ? "text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200")}>
                              {a.name}
                            </span>
                            {a.serialNumber && <span className="text-xs text-slate-400 ml-1">S/N: {a.serialNumber}</span>}
                            {isStopped && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                                Swapped Out
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                              {hasSwaps 
                                ? `${machineConsumed.toFixed(1)}d logged` 
                                : `${machineConsumed.toFixed(1)} / ${machineDuration} days logged`}
                            </span>
                            {isOver && !hasSwaps && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                +{overDays.toFixed(1)}d
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Log breakdown */}
                {relevantLogs.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Daily Log Breakdown</p>
                    <div className="border border-slate-200 rounded-sm overflow-hidden text-xs">
                      <div className="grid grid-cols-3 bg-slate-50 px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                        <span>Date</span><span>Machine</span><span className="text-right">Day Type</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
                        {relevantLogs.map(log => {
                          const d = (log as any).operationalDay ?? (log.isActive ? 'full' : 'none');
                          return (
                            <div key={log.id} className="grid grid-cols-3 px-3 py-2 bg-white hover:bg-slate-50 transition-colors">
                              <span className="text-slate-600 font-medium">{formatDisplayDate(log.date)}</span>
                              <span className="text-slate-500 truncate">{log.assetName}</span>
                              <span className="text-right">
                                <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold",
                                  d === 'full' ? "bg-emerald-50 text-emerald-700" :
                                  d === 'half' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                )}>
                                  {dayLabel(log)} {d !== 'none' && <span className="opacity-60">+{dayValue(log)}</span>}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No machine logs recorded since invoice start date ({formatDisplayDate(invoiceStartDate)}).</p>
                )}
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <SectionTitle icon={<DollarSign className="h-4 w-4" />} title="Cost Breakdown" />
            <div className="mt-3 space-y-2">
              <CostRow label="Rental Cost" value={invoice.rentalCost ?? 0} />
              {(invoice.auxiliaryCost ?? 0) > 0 && <CostRow label="Auxiliary Equipment Lease" value={invoice.auxiliaryCost ?? 0} />}
              <CostRow label="Diesel Cost" value={invoice.dieselCost ?? 0} />
              <CostRow label="Technicians Cost" value={invoice.techniciansCost ?? 0} />
              {(invoice.mobDemob ?? 0) > 0 && <CostRow label="Mob / Demob" value={invoice.mobDemob ?? 0} />}
              {(invoice.installation ?? 0) > 0 && <CostRow label="Installation" value={invoice.installation ?? 0} />}
              {(invoice.damages ?? 0) > 0 && <CostRow label="Damages" value={invoice.damages ?? 0} />}
              {(invoice.discount ?? 0) > 0 && <CostRow label="Discount / Concession" value={-(invoice.discount ?? 0)} />}
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <CostRow label="Gross Total" value={invoice.totalCost ?? 0} muted />
              {invoice.vatScope === 'per_section' && (
                <>
                  <CostRow label="Vatable Subtotal" value={invoice.vatableAmount ?? 0} muted />
                  <CostRow label="Exempt Subtotal" value={invoice.nonVatableAmount ?? 0} muted />
                </>
              )}
              <CostRow label={`VAT (${invoice.vatInc === 'Yes' ? 'Inclusive' : invoice.vatInc === 'Add' ? 'Added' : 'Excluded'}${invoice.vatScope === 'per_section' ? ' • Itemized' : ''})`} value={invoice.vat ?? 0} muted />
              <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-sm px-4 py-3 mt-2">
                <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">TOTAL CHARGE</span>
                <span className="font-black text-xl text-emerald-400 font-mono tabular-nums">₦{fmt(totalCharge)}</span>
              </div>
            </div>
          </div>

          {/* Settlement & Payment Status */}
          {settlement && (
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle icon={<CreditCard className="h-4 w-4" />} title="Payment Settlement" />
                <Badge className={cn("border font-bold text-[11px] px-2.5", statusColor)}>{displayStatus}</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Billed</p>
                  <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100 mt-0.5">₦{fmt(settlement.totalBilled)}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cash Paid</p>
                  <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">₦{fmt(settlement.cashPaid)}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WHT Credited</p>
                  <p className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">₦{fmt(settlement.whtDeducted)}</p>
                </div>
                <div className={cn(
                  "border rounded-sm p-3",
                  settlement.balanceRemaining <= 0
                    ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                )}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining Balance</p>
                  <p className={cn(
                    "font-mono font-black text-sm mt-0.5",
                    settlement.balanceRemaining <= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                  )}>
                    ₦{fmt(settlement.balanceRemaining)}
                  </p>
                </div>
              </div>

              {/* Allocations History */}
              {settlement.allocations.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Applied Payments & Credits</p>
                  <div className="space-y-1.5">
                    {settlement.allocations.map((alloc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {alloc.paymentReference || `Payment #${alloc.paymentId.slice(0, 8)}`}
                          </span>
                          <span className="text-slate-400">({formatDisplayDate(alloc.paymentDate)})</span>
                          {alloc.isAdvanceOrHistoricalFifo && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                              FIFO Settled
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          ₦{fmt(alloc.settledAmount)}
                          {alloc.whtAmount > 0 && (
                            <span className="text-[10px] text-indigo-600 font-normal ml-1">
                              (incl. ₦{fmt(alloc.whtAmount)} WHT)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-sm p-3">
                  <span className="text-xs text-slate-500 italic">No payments applied to this invoice yet.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      if (invoice) {
                        openPaymentModalForInvoice({
                          client: invoice.client,
                          site: invoice.siteName || inv.site || '',
                          invoiceId: invoice.id,
                          invoiceNumber: invoice.invoiceNumber || (invoice as any).invoiceNo || invoice.id,
                          amount: settlement ? settlement.remainingBalance : Number(invoice.totalCharge || (invoice as any).amount || 0),
                        });
                        onClose();
                      }
                    }}
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Record Payment
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-600 dark:text-blue-400">{icon}</span>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={cn("font-bold text-sm mt-0.5 truncate", highlight ? "text-blue-600 dark:text-blue-400 font-mono tabular-nums" : "text-slate-700 dark:text-slate-300 font-mono tabular-nums")}>{value}</p>
    </div>
  );
}

function CostRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className={cn("text-sm", muted ? "text-slate-400" : "text-slate-600")}>{label}</span>
      <span className={cn("font-mono font-semibold text-sm tabular-nums", muted ? "text-slate-500" : "text-slate-700")}>
        ₦{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
