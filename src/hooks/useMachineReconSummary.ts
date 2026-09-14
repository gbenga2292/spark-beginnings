import { useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { isInternalSite } from '@/src/lib/siteUtils';

export interface ReconPumpOnSite {
  id: string;
  name: string;
  lastLogStatus: 'Full Day' | 'Half Day' | 'Off' | null;
  lastLogDate: string | null;
}

export interface ReconSiteAllocation {
  siteId: string;
  siteName: string;
  clientName: string;
  pumpsOnSite: number;
  pumpsExpected: number;
  delta: number;
  currentProgress: number;
  pumps: ReconPumpOnSite[];
  isStalled: boolean;
  stalledDays: number;
}

export interface ReconDiscrepancy {
  siteName: string;
  clientName: string;
  actual: number;
  expected: number;
  delta: number;
}

export interface MachineReconSummary {
  totalFleet: number;
  deployedOnSite: number;
  idleInWarehouse: number;
  underMaintenance: number;
  serviceOverdue: number;
  overdueNames: string[];
  siteAllocations: ReconSiteAllocation[];
  discrepancies: ReconDiscrepancy[];
  stalledSites: ReconSiteAllocation[];
  pendingSitesCount: number;
  pendingPumpsRequired: number;
  idleAvailableForDeploy: number;
  pipelineGap: number;
}

function isDewateringMachine(m: any): boolean {
  if (!m) return false;
  const nameLow = (m.name || '').toLowerCase();
  const categoryLow = (m.category || '').toLowerCase();
  const typeLow = (m.type || '').toLowerCase();
  if (typeLow === 'consumable' || typeLow === 'tools' || typeLow === 'reusables') return false;
  if (nameLow.includes('hose') || nameLow.includes('pipe') || nameLow.includes('fitting') || nameLow.includes('clamp') || nameLow.includes('coupling')) return false;
  const hasDewWord = nameLow.includes('dewatering') || (m.description || '').toLowerCase().includes('dewatering') || categoryLow === 'dewatering';
  const isEquip = categoryLow === 'machine' || typeLow === 'equipment' || !!m.requiresLogging;
  return isEquip && hasDewWord;
}

export function useMachineReconSummary(): MachineReconSummary {
  const { sites, pendingSites, invoices } = useAppStore();
  const { maintenanceAssets = [], dailyMachineLogs = [], assets = [] } = useOperations();

  return useMemo(() => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    const machines = maintenanceAssets.filter(m => isDewateringMachine(m) && m.isActive);
    const totalFleet = machines.length;

    const deployedOnSite = machines.filter(m => {
      const op = m.operationalStatus ?? 'active';
      return op !== 'under_maintenance' && !isInternalSite({ name: m.site || '' }) && m.site !== 'Warehouse' && !!m.site;
    }).length;

    const idleInWarehouse = machines.filter(m => {
      const op = m.operationalStatus ?? 'active';
      return op !== 'under_maintenance' && (isInternalSite({ name: m.site || '' }) || m.site === 'Warehouse' || !m.site);
    }).length;

    const underMaintenance = machines.filter(m => (m.operationalStatus ?? 'active') === 'under_maintenance').length;

    const overdueM = machines.filter(m => m.status === 'overdue');
    const serviceOverdue = overdueM.length;
    const overdueNames = overdueM.map(m => m.name as string);

    const latestInvoiceForSite = new Map<string, number>();
    [...invoices].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(inv => {
      const key = (inv.siteName || '').toLowerCase().trim();
      if (key && !latestInvoiceForSite.has(key)) latestInvoiceForSite.set(key, inv.noOfMachine || 0);
    });

    const activeDewSites = sites.filter(s => {
      if (s.status !== 'Active' || !s.startDate || isInternalSite(s)) return false;
      const onb = pendingSites.find(p =>
        p.siteId === s.id || p.id === s.id ||
        (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
         p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
      );
      if (onb?.phase1?.whatIsBeingBuilt && onb.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') return false;
      return true;
    });

    const statusMap: Record<string, 'Full Day' | 'Half Day' | 'Off'> = {
      full: 'Full Day', half: 'Half Day', off: 'Off', none: 'Off',
    };

    const siteAllocations: ReconSiteAllocation[] = activeDewSites.map(s => {
      const siteMachines = machines.filter(m =>
        (m.operationalStatus ?? 'active') !== 'under_maintenance' &&
        m.site?.toLowerCase().trim() === s.name.toLowerCase().trim()
      );

      const pumps: ReconPumpOnSite[] = siteMachines.map(m => {
        const mLogs = dailyMachineLogs.filter(l => l.assetId === m.id && l.isActive)
          .sort((a, b) => b.date.localeCompare(a.date));
        const latest = mLogs[0];
        return {
          id: m.id,
          name: m.name,
          lastLogStatus: latest ? (statusMap[latest.operationalDay] ?? null) : null,
          lastLogDate: latest?.date ?? null,
        };
      });

      const recentActive = dailyMachineLogs.filter(l =>
        l.siteName?.toLowerCase() === s.name.toLowerCase() && l.isActive &&
        l.date >= threeDaysAgoStr && (l.operationalDay === 'full' || l.operationalDay === 'half')
      );
      const isStalled = siteMachines.length > 0 && recentActive.length === 0;

      let stalledDays = 0;
      if (isStalled) {
        const allActive = dailyMachineLogs
          .filter(l => l.siteName?.toLowerCase() === s.name.toLowerCase() && l.isActive &&
            (l.operationalDay === 'full' || l.operationalDay === 'half'))
          .sort((a, b) => b.date.localeCompare(a.date));
        stalledDays = allActive.length > 0
          ? Math.floor((new Date().getTime() - new Date(allActive[0].date).getTime()) / 86400000)
          : 3;
      }

      const pumpsOnSite = siteMachines.length;
      const pumpsExpected = latestInvoiceForSite.get(s.name.toLowerCase().trim()) ?? 0;

      return {
        siteId: s.id, siteName: s.name, clientName: s.client || '',
        pumpsOnSite, pumpsExpected, delta: pumpsOnSite - pumpsExpected,
        currentProgress: s.currentProgressPercentage ?? 0,
        pumps, isStalled, stalledDays,
      };
    });

    siteAllocations.sort((a, b) => {
      if (a.isStalled && !b.isStalled) return -1;
      if (!a.isStalled && b.isStalled) return 1;
      const aD = a.pumpsExpected > 0 && a.delta !== 0;
      const bD = b.pumpsExpected > 0 && b.delta !== 0;
      if (aD && !bD) return -1;
      if (!aD && bD) return 1;
      return a.siteName.localeCompare(b.siteName);
    });

    const discrepancies: ReconDiscrepancy[] = siteAllocations
      .filter(s => s.pumpsExpected > 0 && s.delta !== 0)
      .map(s => ({ siteName: s.siteName, clientName: s.clientName, actual: s.pumpsOnSite, expected: s.pumpsExpected, delta: s.delta }));

    const stalledSites = siteAllocations.filter(s => s.isStalled);

    const pendingList = pendingSites.filter(s =>
      s.status === 'Pending' && s.phase1?.whatIsBeingBuilt?.trim().toLowerCase() === 'dewatering'
    );
    const pendingSitesCount = pendingList.length;
    const pendingPumpsRequired = pendingList.reduce((acc, s) => acc + (parseInt(s.phase3?.totalPumpsRequired || '0', 10) || 0), 0);
    const pipelineGap = pendingPumpsRequired - idleInWarehouse;

    return {
      totalFleet, deployedOnSite, idleInWarehouse, underMaintenance, serviceOverdue, overdueNames,
      siteAllocations, discrepancies, stalledSites,
      pendingSitesCount, pendingPumpsRequired,
      idleAvailableForDeploy: idleInWarehouse,
      pipelineGap,
    };
  }, [maintenanceAssets, dailyMachineLogs, sites, pendingSites, invoices, assets]);
}
