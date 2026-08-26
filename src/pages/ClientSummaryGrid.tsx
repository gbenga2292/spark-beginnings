import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Building2, Calendar, FileText, Search, MapPin, LayoutGrid, List, ChevronRight, UserCheck, Trash2, Receipt, CreditCard, Activity, Maximize2, ExternalLink, Wallet } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { ClientContactsPanel } from './ClientContactsPanel';
import { toast, showConfirm } from '../components/ui/toast';
import { useUserStore } from '../store/userStore';
import { normalizeDate } from '../lib/dateUtils';
import { useOperations } from '../contexts/OperationsContext';

function StatAmount({ 
  amount, 
  colorClass = "text-slate-900", 
  canView = true 
}: { 
  amount: number; 
  colorClass?: string; 
  canView?: boolean;
}) {
  if (!canView) return <span className={cn("text-xs sm:text-sm font-black truncate", colorClass)}>***</span>;
  
  const formatted = `₦${Math.round(amount || 0).toLocaleString()}`;
  const textClass = formatted.length > 13
    ? 'text-[10px] sm:text-[11px] tracking-tighter'
    : formatted.length > 10
      ? 'text-[11px] sm:text-xs tracking-tight'
      : 'text-xs sm:text-sm';

  return (
    <span 
      title={formatted} 
      className={cn("font-black leading-tight block truncate whitespace-nowrap font-mono", textClass, colorClass)}
    >
      {formatted}
    </span>
  );
}

export function ClientSummaryGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [contactsFor, setContactsFor] = useState<string | null>(null);
  const [breakdownModalClient, setBreakdownModalClient] = useState<{ name: string; stats: any } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const canDeleteClient = !currentUser || currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin' || currentUser.privileges?.clients?.canDelete !== false || currentUser.privileges?.sites?.canDeleteClient !== false;
  
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const commLogs = useAppStore(s => s.commLogs);
  const pendingSites = useAppStore(s => s.pendingSites);
  const clientContacts = useAppStore(s => s.clientContacts);
  const removeClient = useAppStore(s => s.removeClient);
  const deleteClientProfile = useAppStore(s => s.deleteClientProfile);
  const deleteClientContact = useAppStore(s => s.deleteClientContact);
  const deletePendingSite = useAppStore(s => s.deletePendingSite);
  const { dailyMachineLogs } = useOperations();

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    invoices.forEach(inv => {
      const d = (inv as any).startDate || inv.date;
      if (d && d.length >= 4) {
        const y = d.substring(0, 4);
        if (/^\d{4}$/.test(y)) yearSet.add(y);
      }
    });
    payments.forEach(p => {
      if (p.date && p.date.length >= 4) {
        const y = p.date.substring(0, 4);
        if (/^\d{4}$/.test(y)) yearSet.add(y);
      }
    });
    sites.forEach(s => {
      if (s.startDate && s.startDate.length >= 4) {
        const y = s.startDate.substring(0, 4);
        if (/^\d{4}$/.test(y)) yearSet.add(y);
      }
    });
    const currentYearStr = new Date().getFullYear().toString();
    yearSet.add(currentYearStr);
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [invoices, payments, sites]);

  const handleDeleteClient = async (clientName: string) => {
    const nameTrim = clientName.trim();
    const nameLow = nameTrim.toLowerCase();
    
    const clientSites = sites.filter(s => s.client.trim().toLowerCase() === nameLow);
    
    let confirmPrompt = `Are you sure you want to delete client "${nameTrim}"? This will remove the client record.`;
    if (clientSites.length > 0) {
      confirmPrompt = `Client "${nameTrim}" currently has ${clientSites.length} site(s) associated with it. Are you sure you want to permanently delete this client?`;
    }

    const ok = await showConfirm(confirmPrompt, {
      title: `Delete Client — ${nameTrim}`,
      confirmLabel: 'Delete Client',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!ok) return;

    removeClient(nameTrim);

    clientProfiles.forEach(p => {
      if (p.name.trim().toLowerCase() === nameLow) {
        deleteClientProfile(p.id);
      }
    });

    clientContacts.forEach(c => {
      if (c.clientName.trim().toLowerCase() === nameLow) {
        deleteClientContact(c.id);
      }
    });

    pendingSites.forEach(ps => {
      if (ps.clientName.trim().toLowerCase() === nameLow && !ps.siteId) {
        deletePendingSite(ps.id);
      }
    });

    toast.success(`Client "${nameTrim}" deleted successfully.`);
  };

  // Deduplicate profiles by normalized name (trim + lowercase).
  const deduplicatedProfiles = useMemo(() => {
    const seen = new Map<string, any>();
    clientProfiles.forEach(c => {
      const key = c.name.trim().toLowerCase();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { ...c, name: c.name.trim() });
      } else {
        const newIsBetter = (c.tinNumber && !existing.tinNumber) || (c.startDate && !existing.startDate);
        if (newIsBetter) {
          seen.set(key, { ...c, name: c.name.trim() });
        }
      }
    });
    return Array.from(seen.values());
  }, [clientProfiles]);

  // TIN lookup: deduplicatedProfiles first, then any pending site onboarding record
  const getTinForClient = (name: string): string => {
    const key = name.trim().toLowerCase();
    const profile = deduplicatedProfiles.find(p => p.name.trim().toLowerCase() === key);
    if (profile?.tinNumber) return profile.tinNumber;
    const pending = pendingSites.find(s => s.clientName.trim().toLowerCase() === key && s.phase4?.clientTinNumber);
    return pending?.phase4?.clientTinNumber || 'Not provided';
  };

  const statsByClient = useMemo(() => {
    const stats: Record<string, { 
      totalSites: number; 
      activeSites: number; 
      totalInvoiced: number; 
      totalPaid: number; 
      totalUsed: number; 
      breakdown: {
        mobDemob: number;
        installation: number;
        damages: number;
        runtime: number;
        rentalUsed: number;
        dieselUsed: number;
        labourUsed: number;
        invoicesCount: number;
        bySite: Record<string, {
          siteName: string;
          mobDemob: number;
          installation: number;
          damages: number;
          runtime: number;
          rentalUsed: number;
          dieselUsed: number;
          labourUsed: number;
          consumedDays: number;
          duration: number;
          totalUsed: number;
          invoicesCount: number;
        }>;
      };
      id: string 
    }> = {};

    const createEmptyStats = (id: string) => ({
      totalSites: 0,
      activeSites: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      totalUsed: 0,
      breakdown: {
        mobDemob: 0,
        installation: 0,
        damages: 0,
        runtime: 0,
        rentalUsed: 0,
        dieselUsed: 0,
        labourUsed: 0,
        invoicesCount: 0,
        bySite: {} as Record<string, {
          siteName: string;
          mobDemob: number;
          installation: number;
          damages: number;
          runtime: number;
          rentalUsed: number;
          dieselUsed: number;
          labourUsed: number;
          consumedDays: number;
          duration: number;
          totalUsed: number;
          invoicesCount: number;
        }>
      },
      id
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Canonical client name lookup map to prevent case/spacing mismatches
    const canonicalNameMap = new Map<string, string>();
    deduplicatedProfiles.forEach(p => canonicalNameMap.set(p.name.trim().toLowerCase(), p.name.trim()));
    sites.forEach(s => {
      if (s.client) {
        const k = s.client.trim().toLowerCase();
        if (!canonicalNameMap.has(k)) canonicalNameMap.set(k, s.client.trim());
      }
    });
    invoices.forEach(inv => {
      if (inv.client) {
        const k = inv.client.trim().toLowerCase();
        if (!canonicalNameMap.has(k)) canonicalNameMap.set(k, inv.client.trim());
      }
    });
    payments.forEach(p => {
      if (p.client) {
        const k = p.client.trim().toLowerCase();
        if (!canonicalNameMap.has(k)) canonicalNameMap.set(k, p.client.trim());
      }
    });

    deduplicatedProfiles.forEach(c => {
      stats[c.name] = createEmptyStats(c.id);
    });

    // 1. Sites
    sites.forEach(s => {
      if (!s.client || s.client.trim().toUpperCase() === 'DCEL') return;
      const clientKey = s.client.trim().toLowerCase();
      const clientName = canonicalNameMap.get(clientKey) || s.client.trim();
      if (!stats[clientName]) {
        stats[clientName] = createEmptyStats(clientName);
      }

      const siteStartDate = s.startDate ? normalizeDate(s.startDate) : null;
      const siteEndDate = s.endDate ? normalizeDate(s.endDate) : null;

      if (selectedYear !== 'all') {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        if (siteStartDate && siteStartDate > yearEnd) return;
        if (siteEndDate && siteEndDate < yearStart) return;
      }

      stats[clientName].totalSites++;
      const isSiteStarted = !siteStartDate || siteStartDate <= todayStr;
      if (s.status === 'Active' && isSiteStarted) {
        stats[clientName].activeSites++;
      }
    });

    // 2. Invoices & Machine Runtime Usage
    invoices.forEach(inv => {
      if (!inv.client || inv.client.trim().toUpperCase() === 'DCEL') return;
      const clientKey = inv.client.trim().toLowerCase();
      const clientName = canonicalNameMap.get(clientKey) || inv.client.trim();

      const startDateStr = normalizeDate((inv as any).startDate || inv.date || (inv as any).issueDate || (inv as any).created_at || (inv as any).createdAt);
      if (selectedYear !== 'all' && startDateStr && !startDateStr.startsWith(selectedYear)) {
        return;
      }

      if (!stats[clientName]) {
        stats[clientName] = createEmptyStats(clientName);
      }

      const invTotal = inv.totalCharge || inv.amount || 0;
      stats[clientName].totalInvoiced += invTotal;

      // Runtime & Machine usage calculation
      const duration = inv.duration || 0;

      const siteName = ((inv as any).site || inv.siteName || '').trim();
      const realSite = sites.find(s => s.id === inv.siteId) ||
                       sites.find(s => s.name === siteName && s.client === inv.client) ||
                       sites.find(s => s.name === siteName);
      const siteId = realSite?.id || inv.siteId;

      const siteStatus = ((realSite?.status as string) || '').trim();
      const isSiteActive = siteStatus === 'Active';
      const isSiteEnded = siteStatus === 'Ended';
      const isSiteInOnboardingOrPending = siteStatus.toLowerCase() === 'onboarding' || siteStatus.toLowerCase() === 'pending' || siteStatus.toLowerCase() === 'draft' || siteStatus.toLowerCase() === 'inactive';
      const isFutureInvoice = Boolean(startDateStr && startDateStr > todayStr);
      const isFutureSite = Boolean(realSite?.startDate && normalizeDate(realSite.startDate) > todayStr);

      // Has site actually commenced operations?
      const hasSiteStarted = (isSiteActive || isSiteEnded) && !isFutureInvoice && !isFutureSite && !isSiteInOnboardingOrPending;

      // Fixed one-off charges incurred as long as machine is on site (mob/demob, installation, damages)
      const mobDemob = Number(inv.mobDemob) || 0;
      const installation = Number(inv.installation) || 0;
      const damages = Number(inv.damages) || 0;
      const fixedFees = mobDemob + installation + damages;

      const effectiveFixed = Math.min(invTotal, fixedFees);
      const recurringTotal = Math.max(0, invTotal - effectiveFixed);

      // Look up operational logs for this site/machine
      const normalizedSiteName = siteName.toLowerCase();
      const linkedAssets = inv.linkedAssetIds || [];
      const relevantLogs = dailyMachineLogs.filter(l => {
        const matchesSiteId = siteId && l.siteId === siteId;
        const logSite = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
        const matchesSiteName = logSite && (logSite === normalizedSiteName || (logSite.length > 3 && normalizedSiteName.includes(logSite)) || (normalizedSiteName.length > 3 && logSite.includes(normalizedSiteName)));
        const matchesDate = startDateStr ? (l.date >= startDateStr && l.date <= todayStr) : (l.date <= todayStr);
        const matchesAsset = linkedAssets.length === 0 || linkedAssets.includes(l.assetId);
        return (matchesSiteId || matchesSiteName) && matchesDate && matchesAsset;
      });

      let consumedDays = 0;
      if (hasSiteStarted && duration > 0) {
        if (relevantLogs.length > 0) {
          // Calculate exact operational days from active machine logs
          const logsByDate = new Map<string, typeof dailyMachineLogs>();
          relevantLogs.forEach(l => {
            if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
            logsByDate.get(l.date)!.push(l);
          });

          let counted = 0;
          logsByDate.forEach((dateLogs) => {
            const contributions = dateLogs.map(l => {
              const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
              if (status === 'full') return 1.0;
              if (status === 'half') return 0.5;
              return 0.0;
            });
            counted += Math.min(...contributions);
          });
          consumedDays = Math.max(0, Math.min(duration, counted));
        } else if (isSiteEnded) {
          // Completed historical site
          consumedDays = duration;
        } else if (inv.countOffDays !== false && isSiteActive && startDateStr && startDateStr <= todayStr && (realSite?.startDate && normalizeDate(realSite.startDate) <= todayStr)) {
          // Fallback calendar count ONLY if site is actively running and has commenced
          // But if site has 0 machine logs recorded yet, machine has not started operating -> 0 consumed days
          const start = new Date(startDateStr);
          const today = new Date(todayStr);
          if (!isNaN(start.getTime())) {
            const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            // Only count diffDays if site has at least one active machine log, otherwise machine hasn't started
            consumedDays = relevantLogs.length > 0 ? Math.max(0, Math.min(duration, diffDays)) : 0;
          }
        }
      }

      // Machine is on site if site has started and is not in onboarding/pending
      const isMachineOnSite = hasSiteStarted;

      let invUsed = 0;
      let usedMobDemob = 0;
      let usedInstallation = 0;
      let usedDamages = 0;
      let usedRuntime = 0;

      if (!isMachineOnSite) {
        // Site hasn't started yet / in onboarding / in future: 0 used
        invUsed = 0;
        usedMobDemob = 0;
        usedInstallation = 0;
        usedDamages = 0;
        usedRuntime = 0;
      } else if (duration > 0 && consumedDays >= duration) {
        // Duration has fully elapsed
        invUsed = invTotal;
        usedMobDemob = mobDemob;
        usedInstallation = installation;
        usedDamages = damages;
        usedRuntime = Math.max(0, invTotal - (mobDemob + installation + damages));
      } else {
        // Ongoing on site: mob/demob & installation recognized once on site; runtime only counts when machine has operated
        const recurringUsed = duration > 0 ? (consumedDays / duration) * recurringTotal : 0;
        invUsed = Math.min(invTotal, effectiveFixed + recurringUsed);
        usedMobDemob = mobDemob;
        usedInstallation = installation;
        usedDamages = damages;
        usedRuntime = recurringUsed;
      }

      // Proportional sub-breakdown of usedRuntime into machine rental, diesel, and labour/technicians
      const grossRental = Number(inv.rentalCost) || 0;
      const grossDiesel = Number(inv.dieselCost) || 0;
      const grossLabour = Number(inv.techniciansCost) || 0;
      const grossRecurring = grossRental + grossDiesel + grossLabour;

      let usedRental = 0;
      let usedDiesel = 0;
      let usedLabour = 0;

      if (grossRecurring > 0 && usedRuntime > 0) {
        usedRental = (grossRental / grossRecurring) * usedRuntime;
        usedDiesel = (grossDiesel / grossRecurring) * usedRuntime;
        usedLabour = (grossLabour / grossRecurring) * usedRuntime;
      } else if (usedRuntime > 0) {
        usedRental = usedRuntime;
      }

      stats[clientName].totalUsed += invUsed;
      stats[clientName].breakdown.mobDemob += usedMobDemob;
      stats[clientName].breakdown.installation += usedInstallation;
      stats[clientName].breakdown.damages += usedDamages;
      stats[clientName].breakdown.runtime += usedRuntime;
      stats[clientName].breakdown.rentalUsed += usedRental;
      stats[clientName].breakdown.dieselUsed += usedDiesel;
      stats[clientName].breakdown.labourUsed += usedLabour;
      stats[clientName].breakdown.invoicesCount += 1;

      const displaySiteName = (inv.siteName || (inv as any).site || realSite?.name || 'General / Unassigned').trim();
      if (!stats[clientName].breakdown.bySite[displaySiteName]) {
        stats[clientName].breakdown.bySite[displaySiteName] = {
          siteName: displaySiteName,
          mobDemob: 0,
          installation: 0,
          damages: 0,
          runtime: 0,
          rentalUsed: 0,
          dieselUsed: 0,
          labourUsed: 0,
          consumedDays: 0,
          duration: 0,
          totalUsed: 0,
          invoicesCount: 0
        };
      }
      stats[clientName].breakdown.bySite[displaySiteName].mobDemob += usedMobDemob;
      stats[clientName].breakdown.bySite[displaySiteName].installation += usedInstallation;
      stats[clientName].breakdown.bySite[displaySiteName].damages += usedDamages;
      stats[clientName].breakdown.bySite[displaySiteName].runtime += usedRuntime;
      stats[clientName].breakdown.bySite[displaySiteName].rentalUsed += usedRental;
      stats[clientName].breakdown.bySite[displaySiteName].dieselUsed += usedDiesel;
      stats[clientName].breakdown.bySite[displaySiteName].labourUsed += usedLabour;
      stats[clientName].breakdown.bySite[displaySiteName].consumedDays += consumedDays;
      stats[clientName].breakdown.bySite[displaySiteName].duration += duration;
      stats[clientName].breakdown.bySite[displaySiteName].totalUsed += invUsed;
      stats[clientName].breakdown.bySite[displaySiteName].invoicesCount += 1;
    });

    // 3. Payments
    payments.forEach(p => {
      if (!p.client || p.client.trim().toUpperCase() === 'DCEL') return;
      const clientKey = p.client.trim().toLowerCase();
      const clientName = canonicalNameMap.get(clientKey) || p.client.trim();
      const pDate = normalizeDate(p.date || (p as any).paymentDate || (p as any).createdAt || (p as any).created_at);
      if (selectedYear !== 'all' && pDate && !pDate.startsWith(selectedYear)) {
        return;
      }
      if (!stats[clientName]) {
        stats[clientName] = createEmptyStats(clientName);
      }
      stats[clientName].totalPaid += (p.amount || 0);
    });

    return stats;
  }, [deduplicatedProfiles, sites, invoices, payments, dailyMachineLogs, selectedYear]);

  const allClients = useMemo(() => {
    const names = new Set([
      ...deduplicatedProfiles.map(p => p.name),
      ...Object.keys(statsByClient)
    ]);

    return Array.from(names)
      .filter(name => name.trim().toUpperCase() !== 'DCEL')
      .map(name => {
      const key = name.trim().toLowerCase();
      const profile = deduplicatedProfiles.find(p => p.name.trim().toLowerCase() === key);

      const clientSiteDates = sites
        .filter(s => s.client.trim().toLowerCase() === key && s.startDate)
        .map(s => s.startDate)
        .sort();
      const earliestSiteDate = clientSiteDates[0] || null;

      return {
        id: profile?.id || name,
        name,
        tinNumber: getTinForClient(name),
        startDate: earliestSiteDate || profile?.startDate || 'Unknown',
        stats: statsByClient[name] || {
          totalSites: 0,
          activeSites: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalUsed: 0,
          breakdown: { mobDemob: 0, installation: 0, damages: 0, runtime: 0, rentalUsed: 0, dieselUsed: 0, labourUsed: 0, invoicesCount: 0, bySite: {} }
        }
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [deduplicatedProfiles, statsByClient, sites, pendingSites]);

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tinNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------------------------
  // Master View Rendering (Grid/List)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80 border-slate-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              type="text"
              placeholder="Search clients or TIN..." 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center p-1 bg-slate-100 rounded-lg shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn("px-3 text-slate-500", viewMode === 'grid' && "bg-white text-indigo-600 shadow-sm")}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" /> Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn("px-3 text-slate-500", viewMode === 'list' && "bg-white text-indigo-600 shadow-sm")}
          >
            <List className="w-4 h-4 mr-1.5" /> List
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="w-full pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(client => (
            <div 
              key={client.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md hover:border-slate-300 cursor-pointer group relative hover:z-30"
              onClick={() => navigate(`/sites?client=${encodeURIComponent(client.name)}`)}
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-start rounded-t-xl bg-white">
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                    {client.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <FileText className="h-4 w-4" /> 
                    TIN: <span className="font-medium text-slate-700">{client.tinNumber}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="h-4 w-4" /> 
                    Since: <span className="font-medium text-slate-700">{client.startDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <div className="p-2 -mr-2 -mt-2 text-slate-300 group-hover:text-indigo-500 transition-colors">
                     <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50/60 flex-1 flex flex-col justify-between gap-3 border-t border-slate-100 rounded-b-xl">
                {/* Sites Badge Row */}
                <div className="flex items-center justify-between text-xs px-1 text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Sites:</span>
                    <strong className="text-slate-800">{client.stats.totalSites}</strong>
                    {client.stats.activeSites > 0 ? (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {client.stats.activeSites} active
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        0 active
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Metric Minimalist Financial Strip */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                  <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-xs flex flex-col justify-center min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate flex items-center gap-1">
                      <Receipt className="w-2.5 h-2.5 text-slate-400 shrink-0" /> Invoiced
                    </span>
                    <StatAmount 
                      amount={client.stats.totalInvoiced} 
                      colorClass="text-slate-900" 
                      canView={currentUser?.privileges?.billing?.canViewAmounts !== false} 
                    />
                  </div>

                  <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-xs flex flex-col justify-center min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5 truncate flex items-center gap-1">
                      <CreditCard className="w-2.5 h-2.5 text-emerald-500 shrink-0" /> Paid
                    </span>
                    <StatAmount 
                      amount={client.stats.totalPaid} 
                      colorClass="text-emerald-600" 
                      canView={currentUser?.privileges?.billing?.canViewAmounts !== false} 
                    />
                  </div>

                  <div className="relative group/used bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-xs flex flex-col justify-center min-w-0 cursor-default">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-0.5 truncate flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-indigo-500 shrink-0" /> Used
                    </span>
                    <StatAmount 
                      amount={client.stats.totalUsed} 
                      colorClass="text-indigo-600" 
                      canView={currentUser?.privileges?.billing?.canViewAmounts !== false} 
                    />

                    {/* Hover Breakdown Popover */}
                    {currentUser?.privileges?.billing?.canViewAmounts !== false && (
                      <div 
                        className="absolute top-full right-0 pt-1.5 w-72 sm:w-80 pointer-events-none opacity-0 group-hover/used:opacity-100 group-hover/used:pointer-events-auto transition-all duration-150 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/80 text-xs text-left max-h-80 overflow-y-auto style-scroll relative">
                          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
                            <span className="font-bold text-indigo-300 text-[11px] uppercase tracking-wider flex items-center gap-1">
                              <Activity className="w-3 h-3 text-indigo-400" /> Used Breakdown by Site
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {Object.keys(client.stats.breakdown.bySite).length} site(s)
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBreakdownModalClient({ name: client.name, stats: client.stats });
                                }}
                                title="Expand to full breakdown modal"
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded transition-colors"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Per-Site Breakdown List */}
                          <div className="space-y-2">
                            {Object.values(client.stats.breakdown.bySite).length > 0 ? (
                              Object.values(client.stats.breakdown.bySite).map((siteItem) => (
                                <div key={siteItem.siteName} className="bg-slate-800/70 rounded-lg p-2 border border-slate-700/60">
                                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700/40">
                                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1 truncate max-w-[160px]" title={siteItem.siteName}>
                                      <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                      {siteItem.siteName}
                                    </span>
                                    <span className="font-mono font-bold text-indigo-300 text-[11px]">
                                      ₦{Math.round(siteItem.totalUsed).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[10.5px]">
                                    {siteItem.mobDemob > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">🚚 Mob / Demob</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.mobDemob).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {siteItem.installation > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">🔧 Installation</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.installation).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {siteItem.runtime > 0 && (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-slate-300">
                                          <span className="text-slate-400 flex items-center gap-1.5">
                                            ⚡ Daily Runtime
                                            {siteItem.duration > 0 && (
                                              <span className="text-[9.5px] text-indigo-300 font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/50">
                                                {Number(siteItem.consumedDays.toFixed(1))} / {siteItem.duration}d
                                              </span>
                                            )}
                                          </span>
                                          <span className="font-mono text-slate-100 font-medium">₦{Math.round(siteItem.runtime).toLocaleString()}</span>
                                        </div>
                                        
                                        {/* Sub-breakdown of Daily Runtime */}
                                        <div className="ml-3.5 space-y-0.5 border-l border-slate-700/70 pl-2 text-[10px]">
                                          {siteItem.rentalUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">🚜 Machine Rental</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.rentalUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                          {siteItem.dieselUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">⛽ Diesel Usage</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.dieselUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                          {siteItem.labourUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">👷 Labour / Techs</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.labourUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {siteItem.damages > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">💥 Damages</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.damages).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {siteItem.mobDemob === 0 && siteItem.installation === 0 && siteItem.runtime === 0 && siteItem.damages === 0 && (
                                      <div className="text-slate-400 italic text-[10px]">No billable used runtime or fees yet.</div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-400 text-center py-2 italic text-[11px]">No active site usage recorded.</div>
                            )}
                          </div>

                          {/* Grand Total */}
                          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
                            <span className="text-slate-300 text-[11px]">Total Client Used</span>
                            <span className="font-mono text-sm text-indigo-400">₦{Math.round(client.stats.totalUsed).toLocaleString()}</span>
                          </div>
                          {/* Tooltip Arrow */}
                          <div className="absolute bottom-full right-6 -mb-1 border-4 border-transparent border-b-slate-900" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-500 font-medium text-lg">No clients found.</h3>
              <p className="text-slate-400 text-sm mt-1">Try a different search term or ensure sites have been created.</p>
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-x-auto">
          <div className="w-full">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">Client Name</th>
                  <th className="px-4 py-4 whitespace-nowrap">TIN Number</th>
                  <th className="px-4 py-4 whitespace-nowrap">Client Since</th>
                  <th className="px-4 py-4 whitespace-nowrap text-center">Sites (Act/Tot)</th>
                  <th className="px-4 py-4 whitespace-nowrap text-right">Invoiced</th>
                  <th className="px-4 py-4 whitespace-nowrap text-right">Paid</th>
                  <th className="px-4 py-4 whitespace-nowrap text-right">Used (Machines)</th>
                  <th className="px-5 py-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800 flex items-center gap-2">
                       <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                       <span className="truncate max-w-[200px]">{client.name}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{client.tinNumber}</td>
                    <td className="px-4 py-4 text-slate-600">{client.startDate}</td>
                    <td className="px-4 py-4 text-center font-medium text-slate-800">
                      <span className="text-emerald-600 font-bold">{client.stats.activeSites}</span> / {client.stats.totalSites}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">
                      {currentUser?.privileges?.billing?.canViewAmounts !== false
                        ? `₦${Math.round(client.stats.totalInvoiced).toLocaleString()}`
                        : '***'}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">
                      {currentUser?.privileges?.billing?.canViewAmounts !== false
                        ? `₦${Math.round(client.stats.totalPaid).toLocaleString()}`
                        : '***'}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-indigo-600 relative group/used cursor-default">
                      {currentUser?.privileges?.billing?.canViewAmounts !== false
                        ? `₦${Math.round(client.stats.totalUsed).toLocaleString()}`
                        : '***'}

                      {/* Hover Breakdown Popover for List View */}
                      {currentUser?.privileges?.billing?.canViewAmounts !== false && (
                        <div 
                          className="absolute top-full right-4 pt-1.5 w-72 sm:w-80 pointer-events-none opacity-0 group-hover/used:opacity-100 group-hover/used:pointer-events-auto transition-all duration-150 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-3.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/80 text-xs text-left max-h-80 overflow-y-auto style-scroll relative">
                            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
                              <span className="font-bold text-indigo-300 text-[11px] uppercase tracking-wider flex items-center gap-1">
                                <Activity className="w-3 h-3 text-indigo-400" /> Used Breakdown by Site
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {Object.keys(client.stats.breakdown.bySite).length} site(s)
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBreakdownModalClient({ name: client.name, stats: client.stats });
                                  }}
                                  title="Expand to full breakdown modal"
                                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded transition-colors"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {Object.values(client.stats.breakdown.bySite).map((siteItem) => (
                                <div key={siteItem.siteName} className="bg-slate-800/70 rounded-lg p-2 border border-slate-700/60">
                                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700/40">
                                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1 truncate max-w-[160px]" title={siteItem.siteName}>
                                      <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                      {siteItem.siteName}
                                    </span>
                                    <span className="font-mono font-bold text-indigo-300 text-[11px]">
                                      ₦{Math.round(siteItem.totalUsed).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[10.5px]">
                                    {siteItem.mobDemob > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">🚚 Mob / Demob</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.mobDemob).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {siteItem.installation > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">🔧 Installation</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.installation).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {siteItem.runtime > 0 && (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-slate-300">
                                          <span className="text-slate-400 flex items-center gap-1.5">
                                            ⚡ Daily Runtime
                                            {siteItem.duration > 0 && (
                                              <span className="text-[9.5px] text-indigo-300 font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/50">
                                                {Number(siteItem.consumedDays.toFixed(1))} / {siteItem.duration}d
                                              </span>
                                            )}
                                          </span>
                                          <span className="font-mono text-slate-100 font-medium">₦{Math.round(siteItem.runtime).toLocaleString()}</span>
                                        </div>
                                        
                                        {/* Sub-breakdown of Daily Runtime */}
                                        <div className="ml-3.5 space-y-0.5 border-l border-slate-700/70 pl-2 text-[10px]">
                                          {siteItem.rentalUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">🚜 Machine Rental</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.rentalUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                          {siteItem.dieselUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">⛽ Diesel Usage</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.dieselUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                          {siteItem.labourUsed > 0 && (
                                            <div className="flex items-center justify-between text-slate-400">
                                              <span className="flex items-center gap-1">👷 Labour / Techs</span>
                                              <span className="font-mono text-slate-200">₦{Math.round(siteItem.labourUsed).toLocaleString()}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {siteItem.damages > 0 && (
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="text-slate-400">💥 Damages</span>
                                        <span className="font-mono text-slate-100">₦{Math.round(siteItem.damages).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
                              <span className="text-slate-300 text-[11px]">Total Used</span>
                              <span className="font-mono text-sm text-indigo-400">₦{Math.round(client.stats.totalUsed).toLocaleString()}</span>
                            </div>
                            <div className="absolute bottom-full right-8 -mb-1 border-4 border-transparent border-b-slate-900" />
                          </div>
                        </div>
                      )}
                    </td>
                     <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => navigate(`/sites?client=${encodeURIComponent(client.name)}`)}>
                          View Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    {/* Client Contacts Modal */}
    {contactsFor && (
      <ClientContactsPanel
        clientName={contactsFor}
        onClose={() => setContactsFor(null)}
      />
    )}

    {/* Expanded Used Breakdown Modal */}
    {breakdownModalClient && (
      <Dialog
        open={Boolean(breakdownModalClient)}
        onClose={() => setBreakdownModalClient(null)}
        title={
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span className="font-bold">{breakdownModalClient.name} — Used Breakdown</span>
          </div>
        }
        className="max-w-3xl"
      >
        <div className="space-y-6">
          {/* Top Overview Metric Cards */}
          {(() => {
            const invoiced = breakdownModalClient.stats.totalInvoiced || 0;
            const paid = breakdownModalClient.stats.totalPaid || 0;
            const balanceDue = invoiced - paid;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-500" /> Invoiced
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                    ₦{Math.round(invoiced).toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Paid
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                    ₦{Math.round(paid).toLocaleString()}
                  </span>
                </div>

                <div className={cn(
                  "p-3.5 rounded-xl border",
                  balanceDue > 0 
                    ? "bg-rose-50/70 border-rose-200" 
                    : "bg-emerald-50/40 border-emerald-200/80"
                )}>
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-wider block mb-1 flex items-center gap-1.5",
                    balanceDue > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    <Wallet className="w-3.5 h-3.5" /> Balance Due
                  </span>
                  <span className={cn(
                    "text-base sm:text-lg font-black font-mono",
                    balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  )}>
                    ₦{Math.round(Math.max(0, balanceDue)).toLocaleString()}
                    {balanceDue < 0 && <span className="text-[10px] ml-1 font-normal text-emerald-600">(Credit)</span>}
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200">
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Used</span>
                    {invoiced > 0 && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                        {Math.round((breakdownModalClient.stats.totalUsed / invoiced) * 100)}% of Invoiced
                      </span>
                    )}
                  </span>
                  <span className="text-base sm:text-lg font-black text-indigo-700 font-mono">
                    ₦{Math.round(breakdownModalClient.stats.totalUsed).toLocaleString()}
                  </span>
                  <span className="text-[10.5px] text-slate-500 block mt-0.5 font-medium">
                    out of ₦{Math.round(invoiced).toLocaleString()} invoiced
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Sites List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Site-by-Site Breakdown ({Object.keys(breakdownModalClient.stats.breakdown.bySite).length} site{Object.keys(breakdownModalClient.stats.breakdown.bySite).length !== 1 ? 's' : ''})
              </h4>
            </div>

            {Object.values(breakdownModalClient.stats.breakdown.bySite).length > 0 ? (
              Object.values(breakdownModalClient.stats.breakdown.bySite).map((siteItem: any) => (
                <div 
                  key={siteItem.siteName} 
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                      <h5 className="font-bold text-slate-800 text-sm">{siteItem.siteName}</h5>
                      {siteItem.invoicesCount > 0 && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {siteItem.invoicesCount} invoice(s)
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block font-medium">Site Total Used</span>
                      <span className="font-mono text-base font-black text-indigo-600">
                        ₦{Math.round(siteItem.totalUsed).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Cost Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                        🚚 Mob & Demob
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        ₦{Math.round(siteItem.mobDemob).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                        🔧 Installation
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        ₦{Math.round(siteItem.installation).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10.5px] text-indigo-700 font-semibold flex items-center gap-1">
                          ⚡ Daily Runtime
                          {siteItem.duration > 0 && (
                            <span className="text-[9.5px] text-indigo-600 font-mono bg-indigo-100 px-1.5 py-0.5 rounded font-bold">
                              {Number(siteItem.consumedDays.toFixed(1))} / {siteItem.duration} days ({Math.round((siteItem.consumedDays / siteItem.duration) * 100)}%)
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-indigo-800">
                          ₦{Math.round(siteItem.runtime).toLocaleString()}
                        </span>
                      </div>
                      {/* Sub-items */}
                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-indigo-100/70 text-[10px] text-slate-600 font-medium">
                        <div>
                          <span className="text-slate-400 block">🚜 Machine</span>
                          <span className="font-mono font-semibold text-slate-800">₦{Math.round(siteItem.rentalUsed).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">⛽ Diesel</span>
                          <span className="font-mono font-semibold text-slate-800">₦{Math.round(siteItem.dieselUsed).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">👷 Labour</span>
                          <span className="font-mono font-semibold text-slate-800">₦{Math.round(siteItem.labourUsed).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {siteItem.damages > 0 && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        💥 Damages / Deductions
                      </span>
                      <span className="font-mono font-bold text-rose-800">
                        ₦{Math.round(siteItem.damages).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium text-sm">No active site usage recorded for this client.</p>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setBreakdownModalClient(null)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                const clientName = breakdownModalClient.name;
                setBreakdownModalClient(null);
                navigate(`/sites?client=${encodeURIComponent(clientName)}`);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              View Client Sites <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Dialog>
    )}
  </div>
  );
}
