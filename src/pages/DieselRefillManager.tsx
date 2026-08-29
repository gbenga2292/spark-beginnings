import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fuel, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Save,
  Building2, Calendar, Droplets, Package, AlertCircle, CheckCircle2,
  Info, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Gauge, BarChart3, List, Link as LinkIcon,
  Sparkles, Receipt, ArrowRight, Zap, Search
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore, LedgerEntry } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { DieselRefill, DieselRefillAllocation } from '@/src/types/operations';

const fmt = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const fmtCurrency = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];

function parseLitresFromText(text?: string): number | undefined {
  if (!text) return undefined;
  // Match patterns like "60ltr", "60 ltr", "60 litres", "60L", "(60ltr)", "60-litre"
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ltrs?|litres?|liters?|l)\b/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return undefined;
}

function useAllActiveMachines(targetDate: string) {
  const { assets, waybills, sitePumpDates, dailyMachineLogs } = useOperations();
  const sites = useAppStore(s => s.sites);
  return useMemo(() => {
    // 1. Map most recent known site for every asset across all historical records
    const historicalSiteMap = new Map<string, string>();
    const locations = new Map<string, number>();

    waybills.forEach(wb => {
      if (wb.siteId) {
        wb.items.forEach(item => {
          historicalSiteMap.set(item.assetId, wb.siteId);
        });
      }

      const dateStr = wb.sentToSiteDate ? wb.sentToSiteDate.substring(0, 10) : (wb.issueDate ? wb.issueDate.substring(0, 10) : '');
      if (!dateStr || (targetDate && dateStr > targetDate)) return;

      if (wb.type === 'waybill' && wb.status !== 'outstanding') {
        wb.items.forEach(item => {
          const key = `${item.assetId}::${wb.siteId || ''}`;
          locations.set(key, (locations.get(key) || 0) + item.quantity);
        });
      } else if (wb.type === 'return' && wb.status === 'return_completed') {
        wb.items.forEach(item => {
          const key = `${item.assetId}::${wb.siteId || ''}`;
          const cur = locations.get(key) || 0;
          locations.set(key, Math.max(0, cur - item.quantity));
        });
      }
    });

    const activePairs = new Map<string, { assetId: string; siteId: string }>();

    locations.forEach((quantity, key) => {
      if (quantity > 0) {
        const [assetId, siteId] = key.split('::');
        activePairs.set(key, { assetId, siteId });
      }
    });

    if (sitePumpDates) {
      sitePumpDates.forEach(pd => {
        if (pd.siteId) historicalSiteMap.set(pd.assetId, pd.siteId);
        const start = pd.pumpStartDate ? pd.pumpStartDate.substring(0, 10) : '';
        const stop = pd.pumpStopDate ? pd.pumpStopDate.substring(0, 10) : '';
        const hasStarted = !start || (targetDate && start <= targetDate);
        const hasNotStopped = !stop || (targetDate && stop >= targetDate);

        if (hasStarted && hasNotStopped) {
          const key = `${pd.assetId}::${pd.siteId}`;
          activePairs.set(key, { assetId: pd.assetId, siteId: pd.siteId });
        }
      });
    }

    if (dailyMachineLogs) {
      dailyMachineLogs.forEach(log => {
        if (log.siteId && log.assetId) historicalSiteMap.set(log.assetId, log.siteId);
        if (targetDate && log.date === targetDate && log.assetId && log.siteId) {
          const key = `${log.assetId}::${log.siteId}`;
          activePairs.set(key, { assetId: log.assetId, siteId: log.siteId });
        }
      });
    }

    // Strictly only machinery and equipment (exclude consumables, materials, tools, pipes, clips, etc.)
    const equipmentAssets = assets.filter(a => {
      if (a.type === 'consumable' || a.type === 'tools' || a.type === 'reusables' || a.type === 'non-consumable') {
        return false;
      }
      return a.type === 'equipment' || !!a.requiresLogging;
    });

    // Active machinery specifically on targetDate
    const activeOnDate = Array.from(activePairs.values())
      .map(pair => {
        const a = assets.find(x => x.id === pair.assetId);
        if (!a) return null;
        if (a.type === 'consumable' || a.type === 'tools' || a.type === 'reusables' || a.type === 'non-consumable') {
          return null;
        }
        if (a.type !== 'equipment' && !a.requiresLogging) return null;

        const site = sites.find(s => s.id === pair.siteId);
        return {
          assetId: a.id,
          assetName: a.name,
          siteId: site?.id || '',
          siteName: site?.name || 'Unknown Site',
          isActiveOnDate: true
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // All company equipment mapped with their best known site
    const allMachinesWithSite = equipmentAssets.map(a => {
      const activeEntry = activeOnDate.find(m => m.assetId === a.id);
      const siteId = activeEntry?.siteId || historicalSiteMap.get(a.id) || (a as any).siteId || '';
      const site = sites.find(s => s.id === siteId);
      return {
        assetId: a.id,
        assetName: a.name,
        siteId: site?.id || '',
        siteName: site?.name || (siteId ? 'Assigned Site' : 'Unassigned'),
        isActiveOnDate: !!activeEntry
      };
    });

    return {
      activeOnDate,
      allMachinesWithSite,
      equipmentAssets,
      historicalSiteMap
    };
  }, [assets, waybills, sitePumpDates, dailyMachineLogs, sites, targetDate]);
}// ── Ledger Remaining Hook ──────────────────────────────────────────────────
function useDieselLedgerRemaining(editingRefillId?: string) {
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const vehicleTrips = useAppStore(s => s.vehicleTrips);
  const { dieselRefills = [], vehicleFuelLogs = [] } = useOperations();

  return useMemo(() => {
    const remaining = new Map<string, number>();
    (ledgerEntries || []).forEach(e => remaining.set(e.id, Number(e.amount) || 0));

    (dieselRefills || []).forEach(refill => {
      if (editingRefillId && refill.id === editingRefillId) return;
      if (!refill.linkedLedgerIds || refill.linkedLedgerIds.length === 0 || !refill.totalCost) return;
      let costToCover = refill.totalCost;
      for (const lid of refill.linkedLedgerIds) {
        if (costToCover <= 0) break;
        const cur = remaining.get(lid) || 0;
        if (cur > 0) {
          const useAmt = Math.min(costToCover, cur);
          remaining.set(lid, cur - useAmt);
          costToCover -= useAmt;
        }
      }
    });

    (vehicleFuelLogs || []).forEach(log => {
      if (!log.linkedLedgerIds || log.linkedLedgerIds.length === 0) return;
      for (const lid of log.linkedLedgerIds) {
        const cur = remaining.get(lid) || 0;
        if (cur > 0) {
          const customAllocated = log.linkedLedgerAmounts?.[lid];
          const useAmt = customAllocated !== undefined ? Math.min(customAllocated, cur) : Math.min(log.total_cost || 0, cur);
          remaining.set(lid, Math.max(0, cur - useAmt));
        }
      }
    });

    (vehicleTrips || []).forEach((trip: any) => {
      const linkedIds = trip.linkedLedgerIds || trip.linked_ledger_ids;
      const totalCost = Number(trip.fuelCost || trip.fuel_cost || trip.totalCost || trip.total_cost || 0);
      if (!linkedIds || !Array.isArray(linkedIds) || linkedIds.length === 0 || !totalCost) return;
      let costToCover = totalCost;
      for (const lid of linkedIds) {
        if (costToCover <= 0) break;
        const cur = remaining.get(lid) || 0;
        if (cur > 0) {
          const useAmt = Math.min(costToCover, cur);
          remaining.set(lid, cur - useAmt);
          costToCover -= useAmt;
        }
      }
    });

    return remaining;
  }, [ledgerEntries, dieselRefills, vehicleFuelLogs, vehicleTrips, editingRefillId]);
}

// ── Refill Form ───────────────────────────────────────────────────────────────
interface RefillFormProps {
  editing?: DieselRefill | null;
  initialLedgerEntry?: LedgerEntry | null;
  onClose: () => void;
  onSave: (refill: Omit<DieselRefill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

function RefillForm({ editing, initialLedgerEntry, onClose, onSave }: RefillFormProps) {
  const { isDark } = useTheme();
  const sites = useAppStore(s => s.sites);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const { assets, waybills, sitePumpDates, dailyMachineLogs, logDailyActivity } = useOperations();

  const ledgerRemainingAmounts = useDieselLedgerRemaining(editing?.id);

  const [date, setDate] = useState(editing?.date || initialLedgerEntry?.date || today());
  const [totalLitres, setTotalLitres] = useState(() => {
    if (editing?.totalLitres) return editing.totalLitres.toString();
    if (initialLedgerEntry) {
      const parsed = parseLitresFromText(initialLedgerEntry.description);
      return parsed ? parsed.toString() : '';
    }
    return '';
  });
  const [pricePerLitre, setPricePerLitre] = useState(() => {
    if (editing?.pricePerLitre) return editing.pricePerLitre.toString();
    if (initialLedgerEntry) {
      const parsed = parseLitresFromText(initialLedgerEntry.description);
      const rem = Number(initialLedgerEntry.amount) || 0;
      if (parsed && parsed > 0 && rem > 0) {
        return (rem / parsed).toFixed(2);
      }
    }
    return '';
  });
  const [costInput, setCostInput] = useState<string>(() => {
    if (editing?.totalCost) return editing.totalCost.toString();
    if (initialLedgerEntry) {
      const rem = Number(initialLedgerEntry.amount) || 0;
      return rem > 0 ? rem.toString() : '';
    }
    return '';
  });

  const handleTotalLitresChange = (newLStr: string) => {
    setTotalLitres(newLStr);
    if (validationErrors.totalLitres) {
      setValidationErrors(prev => ({ ...prev, totalLitres: false }));
    }
    const newL = Number(newLStr) || 0;
    if (newL > 0) {
      if (costInput && Number(costInput) > 0) {
        setPricePerLitre((Number(costInput) / newL).toFixed(2));
      } else if (pricePerLitre && Number(pricePerLitre) > 0) {
        setCostInput((newL * Number(pricePerLitre)).toFixed(2));
      }
    }
  };

  const handlePricePerLitreChange = (newPStr: string) => {
    setPricePerLitre(newPStr);
    const newP = Number(newPStr) || 0;
    const l = Number(totalLitres) || 0;
    if (newP > 0 && l > 0) {
      setCostInput((l * newP).toFixed(2));
    }
  };

  const handleCostInputChange = (newCStr: string) => {
    setCostInput(newCStr);
    const newC = Number(newCStr) || 0;
    const l = Number(totalLitres) || 0;
    if (newC > 0 && l > 0) {
      setPricePerLitre((newC / l).toFixed(2));
    }
  };
  const [purchasedBy, setPurchasedBy] = useState(editing?.purchasedBy || initialLedgerEntry?.enteredBy || '');
  const [supplier, setSupplier] = useState(editing?.supplier || initialLedgerEntry?.vendor || '');
  const [notes, setNotes] = useState(
    editing?.notes || (initialLedgerEntry ? `${initialLedgerEntry.voucherNo ? `[${initialLedgerEntry.voucherNo}] ` : ''}${initialLedgerEntry.description}` : '')
  );
  const [linkedLedgerIds, setLinkedLedgerIds] = useState<string[]>(() => {
    if (editing?.linkedLedgerIds) return editing.linkedLedgerIds;
    if (initialLedgerEntry) return [initialLedgerEntry.id];
    return [];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);

  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);
  const allActiveMachines = useAllActiveMachines(date);

  const [allocations, setAllocations] = useState<DieselRefillAllocation[]>(() => {
    if (editing?.machineAllocations?.length) {
      return editing.machineAllocations.map(a => ({
        ...a,
        refillDate: a.refillDate || editing.date
      }));
    }
    return [];
  });

  // If initialLedgerEntry had a site, auto-load machines on mount
  useEffect(() => {
    if (!editing && initialLedgerEntry?.site && allocations.length === 0) {
      const matchedSite = sites.find(s =>
        s.name.toLowerCase() === initialLedgerEntry.site.toLowerCase() ||
        s.name.toLowerCase().includes(initialLedgerEntry.site.toLowerCase()) ||
        initialLedgerEntry.site.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matchedSite) {
        quickAddFromSite(matchedSite.id);
      }
    }
  }, [initialLedgerEntry, sites, editing]);

  const [selectedMachineToAdd, setSelectedMachineToAdd] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState('');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');

  // Find eligible ledger entries
  const eligibleLedgerEntries = useMemo(() => {
    const filtered = (ledgerEntries || []).filter(e => {
      const desc = (e.description || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      const isDiesel = desc.includes('diesel') || desc.includes('fuel') || desc.includes('ago ') || cat.includes('diesel') || cat.includes('fuel');
      const isRepairOnly = (desc.includes('fuel pump') || desc.includes('brake pad') || desc.includes('repairs')) && !desc.includes('ltr') && !desc.includes('litres');
      return isDiesel && !isRepairOnly;
    });
    
    return filtered.filter(e => {
      const remaining = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
      return remaining > 0.01 || linkedLedgerIds.includes(e.id);
    });
  }, [ledgerEntries, ledgerRemainingAmounts, linkedLedgerIds]);

  // Extract unique months from eligible entries
  const availableLedgerMonths = useMemo(() => {
    const months = new Set<string>();
    eligibleLedgerEntries.forEach(e => {
      if (e.date) months.add(e.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [eligibleLedgerEntries]);

  // Filter eligible ledger entries by search string and date
  const filteredLedgerEntries = useMemo(() => {
    return eligibleLedgerEntries.filter(entry => {
      // Date filters
      if (ledgerMonthFilter && !entry.date.startsWith(ledgerMonthFilter)) return false;
      if (ledgerDateFrom && entry.date < ledgerDateFrom) return false;
      if (ledgerDateTo && entry.date > ledgerDateTo) return false;

      // Text search
      if (!ledgerSearch.trim()) return true;
      const query = ledgerSearch.toLowerCase();
      const matchDesc = entry.description?.toLowerCase().includes(query);
      const matchSite = entry.site?.toLowerCase().includes(query);
      const matchClient = entry.client?.toLowerCase().includes(query);
      const matchVoucher = entry.voucherNo?.toLowerCase().includes(query);
      const matchAmount = (ledgerRemainingAmounts.get(entry.id) || 0).toString().includes(query) || 
                          entry.amount.toString().includes(query);
      return matchDesc || matchSite || matchClient || matchVoucher || matchAmount;
    });
  }, [eligibleLedgerEntries, ledgerSearch, ledgerMonthFilter, ledgerDateFrom, ledgerDateTo, ledgerRemainingAmounts]);

  // Auto-sync total litres, price per litre, and notes whenever linked vouchers change
  const autoSyncLinkedVouchers = (ids: string[]) => {
    const activeEntries = (ledgerEntries || []).filter(e => ids.includes(e.id));
    if (activeEntries.length === 0) {
      return;
    }
    let sumLitres = 0;
    let sumCost = 0;
    const notesArr: string[] = [];
    let detectedVendor = '';
    let detectedPayer = '';

    activeEntries.forEach(entry => {
      const parsedL = parseLitresFromText(entry.description) || 0;
      const remCost = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount) ?? 0;
      sumLitres += parsedL;
      sumCost += remCost;

      if (entry.vendor && !detectedVendor) detectedVendor = entry.vendor;
      if (entry.enteredBy && !detectedPayer) detectedPayer = entry.enteredBy;

      const descTag = entry.voucherNo ? `[${entry.voucherNo}] ${entry.description}` : entry.description;
      if (descTag) notesArr.push(descTag);
    });

    if (sumLitres > 0) {
      setTotalLitres(sumLitres.toString());
      if (sumCost > 0) {
        setCostInput(sumCost.toString());
        setPricePerLitre((sumCost / sumLitres).toFixed(2));
      }
    } else if (sumCost > 0) {
      setCostInput(sumCost.toString());
    }
    if (detectedVendor) setSupplier(detectedVendor);
    if (detectedPayer) setPurchasedBy(detectedPayer);
    if (notesArr.length > 0) {
      setNotes(notesArr.join(' • '));
    }
  };

  const handleToggleLedger = (id: string) => {
    setLinkedLedgerIds(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      autoSyncLinkedVouchers(updated);
      return updated;
    });
  };

  const handleClearAllLinked = () => {
    setLinkedLedgerIds([]);
  };

  const totalLinkedAmount = useMemo(() => {
    return linkedLedgerIds.reduce((sum, id) => {
      return sum + (ledgerRemainingAmounts.get(id) || 0);
    }, 0);
  }, [linkedLedgerIds, ledgerRemainingAmounts]);

  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const linkedEntries = useMemo(() => {
    return (ledgerEntries || []).filter(e => linkedLedgerIds.includes(e.id));
  }, [ledgerEntries, linkedLedgerIds]);

  const syncFromLinkedEntries = (customEntries?: LedgerEntry[]) => {
    const entries = customEntries || linkedEntries;
    if (entries.length === 0) return;

    let sumLitres = 0;
    let sumCost = 0;
    const notesArr: string[] = [];
    let detectedVendor = '';
    let detectedPayer = '';
    let earliestDate = '';
    const siteToLitresMap = new Map<string, number>();

    entries.forEach(entry => {
      const parsedL = parseLitresFromText(entry.description) || 0;
      const remCost = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount) ?? 0;
      sumLitres += parsedL;
      sumCost += remCost;

      if (entry.site && parsedL > 0) {
        const cur = siteToLitresMap.get(entry.site.toLowerCase()) || 0;
        siteToLitresMap.set(entry.site.toLowerCase(), cur + parsedL);
      }

      if (entry.vendor && !detectedVendor) detectedVendor = entry.vendor;
      if (entry.enteredBy && !detectedPayer) detectedPayer = entry.enteredBy;
      if (entry.date && (!earliestDate || entry.date < earliestDate)) earliestDate = entry.date;

      const descTag = entry.voucherNo ? `[${entry.voucherNo}] ${entry.description}` : entry.description;
      if (descTag) notesArr.push(descTag);
    });

    const targetRefillDate = earliestDate || date;
    if (earliestDate) {
      handleDateChange(earliestDate);
    }
    if (sumLitres > 0) {
      setTotalLitres(sumLitres.toString());
      if (sumCost > 0) {
        setCostInput(sumCost.toString());
        setPricePerLitre((sumCost / sumLitres).toFixed(2));
      }
    } else if (sumCost > 0) {
      setCostInput(sumCost.toString());
    }
    if (detectedVendor && !supplier) setSupplier(detectedVendor);
    if (detectedPayer && !purchasedBy) setPurchasedBy(detectedPayer);
    if (notesArr.length > 0) {
      setNotes(notesArr.join(' • '));
    }

    // Automatically load machines from sites mentioned in linked entries and divide litres per site
    const addedAllocs: DieselRefillAllocation[] = [];
    const matchedSitesList: typeof sites = [];

    entries.forEach(entry => {
      if (entry.site) {
        const matchedSite = sites.find(s =>
          s.name.toLowerCase() === entry.site!.toLowerCase() ||
          s.name.toLowerCase().includes(entry.site!.toLowerCase()) ||
          entry.site!.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchedSite && !matchedSitesList.some(s => s.id === matchedSite.id)) {
          matchedSitesList.push(matchedSite);
        }
      }
    });

    // For all matched sites, gather their machines
    const siteMachinesMap = new Map<string, Array<{ assetId: string; assetName: string; siteId: string; siteName: string }>>();
    matchedSitesList.forEach(site => {
      let machines = allActiveMachines.activeOnDate.filter(m => m.siteId === site.id);
      if (machines.length === 0) {
        machines = allActiveMachines.allMachinesWithSite.filter(m => m.siteId === site.id);
      }
      if (machines.length === 0) {
        const assetIdsOnSite = new Set<string>();
        waybills.forEach(wb => {
          if (wb.siteId === site.id) wb.items.forEach(i => assetIdsOnSite.add(i.assetId));
        });
        sitePumpDates?.forEach(pd => {
          if (pd.siteId === site.id) assetIdsOnSite.add(pd.assetId);
        });
        dailyMachineLogs?.forEach(l => {
          if (l.siteId === site.id) assetIdsOnSite.add(l.assetId);
        });
        machines = Array.from(assetIdsOnSite).map(aid => {
          const a = assets.find(x => x.id === aid);
          if (!a || a.type === 'consumable' || a.type === 'tools' || a.type === 'reusables' || a.type === 'non-consumable') return null;
          if (a.type !== 'equipment' && !a.requiresLogging) return null;
          return {
            assetId: a.id,
            assetName: a.name,
            siteId: site.id,
            siteName: site.name,
            isActiveOnDate: false
          };
        }).filter((x): x is NonNullable<typeof x> => x !== null);
      }
      siteMachinesMap.set(site.id, machines);
    });

    // Build allocations with auto-divided litres
    const newAllocations: DieselRefillAllocation[] = [];
    siteMachinesMap.forEach((machines, siteId) => {
      const targetSite = sites.find(s => s.id === siteId);
      const siteNameLower = targetSite?.name.toLowerCase() || '';
      const siteLitres = Array.from(siteToLitresMap.entries()).find(([k]) => siteNameLower.includes(k) || k.includes(siteNameLower))?.[1] || 0;
      
      const litresPerMachine = machines.length > 0 && siteLitres > 0 
        ? Number((siteLitres / machines.length).toFixed(1)) 
        : 0;

      machines.forEach(m => {
        const existingLog = dailyMachineLogs.find(
          l => l.assetId === m.assetId && l.date === targetRefillDate
        );
        newAllocations.push({
          assetId: m.assetId,
          assetName: m.assetName,
          siteId: m.siteId || siteId,
          siteName: m.siteName || targetSite?.name || 'Site',
          allocatedLitres: litresPerMachine,
          actualUsed: existingLog?.dieselUsage ?? 0,
          notes: '',
          refillDate: targetRefillDate
        });
      });
    });

    if (newAllocations.length > 0) {
      setAllocations(newAllocations);
    } else {
      matchedSitesList.forEach(s => quickAddFromSite(s.id));
    }

    toast.success(`Auto-filled purchase & divided litres across ${newAllocations.length} machines from ${entries.length} voucher${entries.length > 1 ? 's' : ''}`);
  };

  // Quick auto-populate from any ledger entry in dialog
  const applyLedgerEntryToForm = (entry: LedgerEntry) => {
    if (!linkedLedgerIds.includes(entry.id)) {
      setLinkedLedgerIds(prev => [...prev, entry.id]);
    }
    syncFromLinkedEntries([entry]);
    setShowLedgerDialog(false);
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setAllocations(prev => prev.map(a => {
      const existingLog = dailyMachineLogs.find(
        l => l.assetId === a.assetId && l.date === newDate
      );
      return {
        ...a,
        refillDate: newDate,
        actualUsed: existingLog?.dieselUsage ?? 0
      };
    }));
  };

  const handleRowDateChange = (idx: number, newRowDate: string) => {
    const alloc = allocations[idx];
    const existingLog = dailyMachineLogs.find(
      l => l.assetId === alloc.assetId && l.date === newRowDate
    );
    setAllocations(prev => prev.map((a, i) => i === idx ? {
      ...a,
      refillDate: newRowDate,
      actualUsed: existingLog?.dieselUsage ?? 0
    } : a));
  };

  const distributeEvenly = () => {
    const total = Number(totalLitres) || 0;
    if (total <= 0) {
      toast.info('Please enter Total Litres first to distribute.');
      return;
    }
    if (allocations.length === 0) {
      toast.info('Add machines first to distribute litres.');
      return;
    }
    const count = allocations.length;
    const base = Math.floor((total / count) * 10) / 10;
    let distributed = 0;
    
    setAllocations(prev => {
      return prev.map((a, i) => {
        let amt = base;
        if (i === count - 1) {
          amt = Number((total - distributed).toFixed(1));
        } else {
          distributed += amt;
        }
        return {
          ...a,
          allocatedLitres: amt
        };
      });
    });
    toast.success(`Distributed ${total}L evenly across ${count} machine${count > 1 ? 's' : ''} (~${base}L each)`);
  };

  const addMachine = (val: string) => {
    if (!val) return;
    const [assetId, siteId] = val.includes('::') ? val.split('::') : (val.includes('-') ? val.split('-') : [val, '']);
    if (allocations.some(a => a.assetId === assetId)) {
      toast.info('This machine is already in the refill list.');
      setSelectedMachineToAdd('');
      return;
    }
    
    const activeMachine = allActiveMachines.activeOnDate.find(m => m.assetId === assetId);
    const knownMachine = allActiveMachines.allMachinesWithSite.find(m => m.assetId === assetId);
    const assetObj = assets.find(a => a.id === assetId);
    if (!assetObj && !knownMachine && !activeMachine) return;

    const resolvedSiteId = siteId || activeMachine?.siteId || knownMachine?.siteId || allocations[0]?.siteId || activeSites[0]?.id || '';
    const resolvedSite = sites.find(s => s.id === resolvedSiteId);

    const existingLog = dailyMachineLogs.find(
      l => l.assetId === assetId && l.date === date
    );

    setAllocations(prev => [...prev, {
      assetId: assetId,
      assetName: assetObj?.name || activeMachine?.assetName || knownMachine?.assetName || 'Equipment',
      siteId: resolvedSiteId,
      siteName: resolvedSite?.name || activeMachine?.siteName || knownMachine?.siteName || 'Site',
      allocatedLitres: 0,
      actualUsed: existingLog?.dieselUsage ?? 0,
      notes: '',
      refillDate: date
    }]);
    setSelectedMachineToAdd('');
  };

  const quickAddFromSite = (siteId: string) => {
    if (!siteId) return;
    const targetSite = sites.find(s => s.id === siteId);

    // 1. Try active machines on this exact date
    let machinesOnSite = allActiveMachines.activeOnDate.filter(m => m.siteId === siteId);

    // 2. If backdating and none found as of targetDate, find machines associated with this site across all history
    if (machinesOnSite.length === 0) {
      machinesOnSite = allActiveMachines.allMachinesWithSite.filter(m => m.siteId === siteId);
    }

    // 3. Fallback: check waybills, pump dates, and daily logs specifically for this site across all time
    if (machinesOnSite.length === 0) {
      const assetIdsOnSite = new Set<string>();
      waybills.forEach(wb => {
        if (wb.siteId === siteId) wb.items.forEach(i => assetIdsOnSite.add(i.assetId));
      });
      sitePumpDates?.forEach(pd => {
        if (pd.siteId === siteId) assetIdsOnSite.add(pd.assetId);
      });
      dailyMachineLogs?.forEach(l => {
        if (l.siteId === siteId) assetIdsOnSite.add(l.assetId);
      });

      machinesOnSite = Array.from(assetIdsOnSite).map(aid => {
        const a = assets.find(x => x.id === aid);
        if (!a || a.type === 'consumable' || a.type === 'tools' || a.type === 'reusables' || a.type === 'non-consumable') return null;
        if (a.type !== 'equipment' && !a.requiresLogging) return null;
        return {
          assetId: a.id,
          assetName: a.name,
          siteId: siteId,
          siteName: targetSite?.name || 'Site',
          isActiveOnDate: false
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null);
    }

    const toAdd = machinesOnSite.filter(m => !allocations.some(a => a.assetId === m.assetId));
    
    // Auto-divide remaining litres if there are unallocated litres
    const curTotalAlloc = allocations.reduce((s, a) => s + (Number(a.allocatedLitres) || 0), 0);
    const unallocatedL = Math.max(0, (Number(totalLitres) || 0) - curTotalAlloc);
    const autoPortion = toAdd.length > 0 && unallocatedL > 0 
      ? Number((unallocatedL / toAdd.length).toFixed(1)) 
      : 0;

    const newAllocs = toAdd.map(m => {
      const existingLog = dailyMachineLogs.find(
        l => l.assetId === m.assetId && l.date === date
      );
      return {
        assetId: m.assetId,
        assetName: m.assetName,
        siteId: m.siteId || siteId,
        siteName: m.siteName || targetSite?.name || 'Site',
        allocatedLitres: autoPortion,
        actualUsed: existingLog?.dieselUsage ?? 0,
        notes: '',
        refillDate: date
      };
    });

    if (newAllocs.length > 0) {
      setAllocations(prev => [...prev, ...newAllocs]);
      toast.success(`Added ${newAllocs.length} machine${newAllocs.length > 1 ? 's' : ''} for ${targetSite?.name || 'site'}${autoPortion > 0 ? ` with ${autoPortion}L each` : ''}`);
    } else if (machinesOnSite.length > 0) {
      toast.info('All machines for this site are already added.');
    } else {
      toast.info(`No machines recorded for ${targetSite?.name || 'this site'}. Use "+ Add Specific Machine" to select any machine.`);
    }
  };

  const totalAllocated = allocations.reduce((s, a) => s + (Number(a.allocatedLitres) || 0), 0);
  const totalActual = allocations.reduce((s, a) => s + (Number(a.actualUsed) || 0), 0);
  const totalL = Number(totalLitres) || 0;
  const remaining = totalL - totalAllocated;
  const totalCost = costInput && Number(costInput) > 0 
    ? Number(costInput) 
    : (totalL > 0 && Number(pricePerLitre) > 0 ? totalL * Number(pricePerLitre) : undefined);

  const updateAlloc = (idx: number, field: keyof DieselRefillAllocation, value: any) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };
  
  const removeAlloc = (idx: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const errs: Record<string, boolean> = {};
    if (!date) errs.date = true;
    if (!totalLitres || Number(totalLitres) <= 0) errs.totalLitres = true;

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      if (errs.date) toast.error('Refill Date is required', { description: 'Please select a valid purchase date.' });
      else if (errs.totalLitres) toast.error('Total Litres is required', { description: 'Please enter total litres bought (e.g. 210).' });
      return;
    }

    if (allocations.length === 0) {
      toast.error('No machines added', { description: 'Please add at least one machine using "+ Quick Add from Site" or "+ Add Specific Machine".' });
      return;
    }

    if (totalAllocated === 0 && totalL > 0) {
      toast.error('No litres allocated', { description: 'Please enter "Bought (L)" for the machines or click "⚡ Distribute Evenly".' });
      return;
    }

    if (remaining < -0.001) {
      toast.error('Over-allocated litres', { description: `You have allocated ${fmt(totalAllocated)}L, which exceeds total purchased (${fmt(totalL)}L) by ${fmt(Math.abs(remaining))}L.` });
      return;
    }

    setValidationErrors({});
    setIsSaving(true);
    try {
      for (const alloc of allocations) {
        const targetDate = alloc.refillDate || date;
        if (alloc.actualUsed > 0 || alloc.allocatedLitres > 0) {
          const existingLog = dailyMachineLogs.find(
            l => l.assetId === alloc.assetId && l.siteId === alloc.siteId && l.date === targetDate
          );
          await logDailyActivity({
            assetId: alloc.assetId,
            assetName: alloc.assetName,
            siteId: alloc.siteId || '',
            siteName: alloc.siteName || '',
            date: targetDate,
            isActive: existingLog?.isActive ?? true,
            operationalDay: existingLog?.operationalDay ?? 'full',
            downtimeEntries: existingLog?.downtimeEntries ?? [],
            maintenanceDetails: existingLog?.maintenanceDetails,
            clientFeedback: existingLog?.clientFeedback,
            issuesOnSite: existingLog?.issuesOnSite,
            dieselUsage: Number(alloc.actualUsed) || 0,
            supervisorOnSite: existingLog?.supervisorOnSite,
            loggedBy: existingLog?.loggedBy,
          });
        }
      }

      const computedSiteId = allocations.every(a => a.siteId === allocations[0].siteId) ? allocations[0].siteId : 'multiple';
      const computedSiteName = allocations.every(a => a.siteId === allocations[0].siteId) ? allocations[0].siteName : 'Multiple Sites';

      await onSave({
        date,
        siteId: computedSiteId || 'multiple',
        siteName: computedSiteName || 'Multiple Sites',
        totalLitres: Number(totalLitres),
        pricePerLitre: pricePerLitre ? Number(pricePerLitre) : undefined,
        totalCost,
        purchasedBy: purchasedBy || undefined,
        supplier: supplier || undefined,
        notes: notes || undefined,
        linkedLedgerIds,
        machineAllocations: allocations.map(a => ({
          assetId: a.assetId,
          assetName: a.assetName,
          siteId: a.siteId,
          siteName: a.siteName,
          allocatedLitres: a.allocatedLitres,
          actualUsed: a.actualUsed,
          notes: a.notes,
          refillDate: a.refillDate
        })),
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const inp = cn(
    'w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors',
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const label = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block';

  return (
    <div className={cn('flex flex-col gap-5 p-6 rounded-2xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Fuel className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className={cn('font-bold text-base', isDark ? 'text-white' : 'text-slate-900')}>
              {editing ? 'Edit Diesel Refill' : 'Log Diesel Refill'}
            </h2>
            <p className="text-xs text-slate-500">Record a bulk diesel purchase and distribute to any machines</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Purchase Details */}
      <div className={cn('p-4 rounded-xl border', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-amber-50/50 border-amber-100')}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Purchase Details</p>
          {initialLedgerEntry && (
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Pre-filled from {initialLedgerEntry.voucherNo}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={label}>Date *</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => handleDateChange(e.target.value)} 
              className={cn(inp, validationErrors.date && 'border-red-500 ring-2 ring-red-500/50 bg-red-50/20')} 
            />
            {validationErrors.date && <p className="text-[11px] text-red-500 mt-1 font-medium">Refill date is required</p>}
          </div>
          <div>
            <label className={label}>Total Litres *</label>
            <input 
              type="number" 
              min="0" 
              step="0.5" 
              value={totalLitres} 
              onChange={e => handleTotalLitresChange(e.target.value)} 
              onFocus={e => e.target.select()}
              placeholder="e.g. 60" 
              className={cn(inp, 'caret-amber-500', validationErrors.totalLitres && 'border-red-500 ring-2 ring-red-500/50 bg-red-50/20')} 
            />
            {validationErrors.totalLitres && <p className="text-[11px] text-red-500 mt-1 font-medium">Total litres required</p>}
          </div>
          <div>
            <label className={label}>Price / Litre (₦)</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              value={pricePerLitre} 
              onChange={e => handlePricePerLitreChange(e.target.value)} 
              onFocus={e => e.target.select()}
              placeholder="e.g. 950" 
              className={cn(inp, 'caret-amber-500')} 
            />
          </div>
          <div>
            <label className={label}>Total Cost (₦)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={costInput}
              onChange={e => handleCostInputChange(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="e.g. 150000"
              className={cn(
                inp,
                'caret-amber-500 font-semibold',
                costInput ? (isDark ? 'text-amber-400' : 'text-amber-700 font-bold') : ''
              )}
            />
          </div>
          <div>
            <label className={label}>Purchased By</label>
            <input type="text" value={purchasedBy} onChange={e => setPurchasedBy(e.target.value)} placeholder="Person / driver" className={inp} />
          </div>
          <div>
            <label className={label}>Supplier / Fuel Station</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Fuel station" className={inp} />
          </div>
          <div className="col-span-2">
            <label className={label}>Reconcile Costs</label>
            <button
              type="button"
              onClick={() => setShowLedgerDialog(true)}
              className={cn(
                "h-10 w-full rounded-xl border px-3 flex items-center justify-between text-sm font-semibold transition-all shadow-sm",
                linkedLedgerIds.length > 0
                  ? (isDark ? "bg-indigo-950/20 border-indigo-800/80 text-indigo-400 hover:bg-indigo-950/30" : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100")
                  : (isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")
              )}
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                <span>Link Financial Ledger</span>
              </div>
              <span className={cn(
                "text-xs px-2.5 py-0.5 rounded-full font-bold",
                linkedLedgerIds.length > 0 
                  ? (isDark ? "bg-indigo-900 text-indigo-300" : "bg-indigo-100 text-indigo-800")
                  : (isDark ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-500")
              )}>
                {linkedLedgerIds.length} Linked ({fmtCurrency(totalLinkedAmount)})
              </span>
            </button>
          </div>

          {/* Linked Vouchers Breakdown & Auto-Fill Action Card */}
          {linkedEntries.length > 0 && (
            <div className="col-span-2 lg:col-span-4 p-3.5 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Linked Vouchers ({linkedEntries.length}) — {fmtCurrency(totalLinkedAmount)}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllLinked}
                    className="text-[10px] font-semibold text-red-500 hover:text-red-700 hover:underline px-1.5 py-0.5 rounded transition-colors"
                    title="Remove all linked vouchers"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowLedgerDialog(true)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-colors"
                  >
                    + Manage Links
                  </button>
                  <button
                    type="button"
                    onClick={() => syncFromLinkedEntries()}
                    className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Auto-Fill Form & Load Site Machines
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {linkedEntries.map(e => {
                  const rem = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
                  const parsedL = parseLitresFromText(e.description);
                  return (
                    <div key={e.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-indigo-100 dark:border-slate-700/80 text-xs flex flex-col justify-between gap-1 shadow-xs group/item hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                      <div>
                        <div className="flex items-center justify-between gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">{e.voucherNo || 'Voucher'}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(rem)}</span>
                            <button
                              type="button"
                              onClick={(evt) => {
                                evt.stopPropagation();
                                handleToggleLedger(e.id);
                              }}
                              title="Deselect / Unlink this voucher"
                              className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">{e.description}</p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-700/60 pt-1.5 mt-1">
                        <span>{new Date(e.date).toLocaleDateString('en-GB')}</span>
                        {parsedL && (
                          <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded">
                            ~{parsedL}L
                          </span>
                        )}
                        {e.site && (
                          <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[100px]">{e.site}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="col-span-2 lg:col-span-4">
            <label className={label}>General Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional global notes" className={inp} />
          </div>
        </div>
      </div>

      {/* Machine Allocations */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Machines Being Refilled</p>
            {totalL > 0 && (
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                remaining < -0.001 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                remaining < 0.001 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              )}>
                {remaining < -0.001 ? `${fmt(Math.abs(remaining))}L over` :
                 remaining < 0.001 ? 'Fully allocated' :
                 `${fmt(remaining)}L remaining to allocate`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {totalL > 0 && allocations.length > 0 && (
              <button
                type="button"
                onClick={distributeEvenly}
                className="h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs"
                title="Distribute total purchased litres evenly across all machines"
              >
                <Zap className="w-3.5 h-3.5" />
                Distribute Evenly ({fmt(totalL)}L ÷ {allocations.length})
              </button>
            )}
            <select
              value=""
              onChange={e => quickAddFromSite(e.target.value)}
              className={cn('h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
            >
              <option value="">+ Quick Add from Site...</option>
              {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={selectedMachineToAdd}
              onChange={e => addMachine(e.target.value)}
              className={cn('h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[240px]', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
            >
              <option value="">+ Add Specific Machine...</option>
              {allActiveMachines.activeOnDate.length > 0 && (
                <optgroup label={`Active on Selected Date (${allActiveMachines.activeOnDate.length})`}>
                  {allActiveMachines.activeOnDate.map(m => (
                    <option key={`act-${m.assetId}-${m.siteId}`} value={`${m.assetId}::${m.siteId}`}>
                      {m.assetName} ({m.siteName})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All Company Equipment / Machinery">
                {allActiveMachines.allMachinesWithSite.map(m => (
                  <option key={`all-${m.assetId}`} value={`${m.assetId}::${m.siteId}`}>
                    {m.assetName} {m.siteName && m.siteName !== 'Unassigned' ? `(${m.siteName})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {allocations.length === 0 ? (
          <div className={cn('flex items-center gap-2 p-4 rounded-xl border text-sm', isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
            <Info className="w-4 h-4 shrink-0" />
            No machines added yet. Select machines or add from a site to log their refill.
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-x-auto', isDark ? 'border-slate-700' : 'border-slate-200')}>
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[750px]">
              <thead className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                <tr>
                  <th className="px-4 py-2">Machine & Site</th>
                  <th className="px-4 py-2 w-32">Refill Date</th>
                  <th className="px-4 py-2 w-28 text-right">Bought (L)</th>
                  <th className="px-4 py-2 w-28 text-right">Actual Used (L)</th>
                  <th className="px-4 py-2 w-24 text-right">Remains (L)</th>
                  <th className="px-4 py-2">Machine Note</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {allocations.map((alloc, idx) => {
                  const bought = Number(alloc.allocatedLitres) || 0;
                  const used = Number(alloc.actualUsed) || 0;
                  const balance = bought - used;
                  return (
                    <tr key={alloc.assetId} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                      <td className="px-4 py-3">
                        <p className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-slate-900')}>{alloc.assetName}</p>
                        <p className="text-[10px] text-slate-400">{alloc.siteName}</p>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={alloc.refillDate || date}
                          onChange={e => handleRowDateChange(idx, e.target.value)}
                          className={cn('rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-full', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number" 
                          min="0" 
                          step="any"
                          value={alloc.allocatedLitres === 0 ? '' : alloc.allocatedLitres}
                          onChange={e => updateAlloc(idx, 'allocatedLitres', e.target.value === '' ? 0 : Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-sm text-right w-full font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 caret-amber-500 transition-all',
                            isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                          )}
                        />
                      </td>
                      <td className="px-4 py-2 relative group">
                        <input
                          type="number" 
                          min="0" 
                          step="any"
                          value={alloc.actualUsed === 0 ? '' : alloc.actualUsed}
                          onChange={e => updateAlloc(idx, 'actualUsed', e.target.value === '' ? 0 : Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-sm text-right w-full font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 caret-emerald-500 transition-all',
                            isDark ? 'bg-slate-800 border-slate-700 text-emerald-400 placeholder:text-slate-600' : 'bg-emerald-50 border-emerald-200 text-emerald-800 placeholder:text-slate-400'
                          )}
                        />
                        <span className="absolute -top-0 -right-0 text-[8px] font-bold bg-emerald-500 text-white rounded-full px-1 py-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity">SYNCS</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={cn('text-sm font-bold', balance > 0 ? 'text-blue-500' : balance < 0 ? 'text-red-500' : 'text-slate-400')}>
                          {balance > 0 ? `+${fmt(balance)}` : fmt(balance)}L
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={alloc.notes || ''}
                          onChange={e => updateAlloc(idx, 'notes', e.target.value)}
                          placeholder="Optional..."
                          className={cn('rounded-lg border px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeAlloc(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className={cn('border-t font-bold text-sm', isDark ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                <tr>
                  <td className="px-4 py-2 text-xs uppercase text-slate-500">Totals</td>
                  <td className="px-4 py-2 text-right">{fmt(totalAllocated)}L</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{fmt(totalActual)}L</td>
                  <td className="px-4 py-2 text-right">{fmt(totalAllocated - totalActual)}L</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className={cn('text-xs mt-2 flex items-center gap-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          "Actual Used" automatically syncs with the Daily Machine Log for the selected date.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">Cancel</Button>
        <Button
          onClick={handleSave} disabled={isSaving}
          className="flex-[2] h-9 text-sm bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-none"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving…' : editing ? 'Update Refill' : 'Save Refill'}
        </Button>
      </div>

      {/* Ledger Linking Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className={cn(
          "max-w-2xl w-full max-h-[88vh] flex flex-col p-5 sm:p-6 rounded-2xl shadow-2xl overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
        )}>
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LinkIcon className="w-4 h-4 text-indigo-500" />
              Link Financial Ledger (Re-embursables)
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select ledger entries matching 'diesel' to reconcile cost or autofill this refill record.
            </p>
          </DialogHeader>
          
          <div className="flex flex-col flex-1 min-h-0 pt-3 space-y-3">
            {totalCost !== undefined && totalCost > 0 && (
              <div className={cn(
                "p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold shrink-0",
                totalLinkedAmount === totalCost ? (isDark ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" : "bg-emerald-50 text-emerald-700 border-emerald-200") :
                totalLinkedAmount > 0 ? (isDark ? "bg-amber-950/40 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-700 border-amber-200") :
                (isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-200")
              )}>
                <span>Refill Cost: {fmtCurrency(totalCost)}</span>
                <span>Linked: {fmtCurrency(totalLinkedAmount)}</span>
              </div>
            )}

            {/* Filter Bar: Text Search + Month / Date Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {/* Search Bar */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  placeholder="Search voucher by description, site, client..."
                  className={cn(
                    "w-full h-9 pl-8 pr-8 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors",
                    isDark ? "bg-slate-800/90 border-slate-700 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  )}
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                {ledgerSearch && (
                  <button
                    type="button"
                    onClick={() => setLedgerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={ledgerMonthFilter}
                  onChange={e => setLedgerMonthFilter(e.target.value)}
                  className={cn(
                    "h-9 rounded-lg text-xs px-2.5 border outline-none font-medium appearance-none cursor-pointer pr-7",
                    isDark ? "bg-slate-800/90 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-700"
                  )}
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="">All Months</option>
                  {availableLedgerMonths.map(m => {
                    const [y, mon] = m.split('-');
                    const d = new Date(Number(y), Number(mon) - 1, 1);
                    return (
                      <option key={m} value={m}>
                        {d.toLocaleString('en-GB', { month: 'short', year: 'numeric' })}
                      </option>
                    );
                  })}
                </select>

                {(ledgerSearch || ledgerMonthFilter || ledgerDateFrom || ledgerDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLedgerSearch('');
                      setLedgerMonthFilter('');
                      setLedgerDateFrom('');
                      setLedgerDateTo('');
                    }}
                    className={cn(
                      "h-9 px-2.5 rounded-lg text-xs border font-medium transition-colors flex items-center gap-1 shrink-0",
                      isDark ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
                    )}
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {eligibleLedgerEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <Receipt className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm italic">No available diesel re-embursable expenses found in ledger.</p>
              </div>
            ) : filteredLedgerEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <Search className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm italic">No matching ledger entries found for selected filter.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1.5 space-y-2.5 style-scroll max-h-[380px] my-1">
                {filteredLedgerEntries.map(entry => {
                  const isLinked = linkedLedgerIds.includes(entry.id);
                  const rem = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount) ?? 0;
                  const total = Number(entry.amount) || 0;
                  const isPartial = rem < total && rem > 0;
                  const parsedL = parseLitresFromText(entry.description);

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 shadow-xs",
                        isLinked
                          ? (isDark ? "bg-indigo-950/30 border-indigo-800/60 ring-1 ring-indigo-500/20" : "bg-indigo-50/70 border-indigo-200 ring-1 ring-indigo-500/20")
                          : (isDark ? "bg-slate-800/80 border-slate-700/80 hover:bg-slate-800" : "bg-white border-slate-200 hover:bg-slate-50")
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={() => handleToggleLedger(entry.id)}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={cn("text-xs font-bold leading-snug", isDark ? "text-slate-100" : "text-slate-800")}>
                              {entry.description}
                            </p>
                            <div className="text-right shrink-0">
                              <p className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                                {fmtCurrency(rem)}
                              </p>
                              {isPartial && (
                                <p className="text-[10px] text-slate-400">Total: {fmtCurrency(total)}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300">
                              {entry.voucherNo}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {entry.client && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-amber-600 dark:text-amber-400">{entry.client}</span>
                              </>
                            )}
                            {entry.site && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{entry.site}</span>
                              </>
                            )}
                            {parsedL && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 text-[10px]">
                                ~{parsedL}L detected
                              </span>
                            )}
                            {isPartial ? (
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium text-[10px]">
                                Partially Used
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                                Full Balance
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick autofill action button */}
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => applyLedgerEntryToForm(entry)}
                          className={cn(
                            "text-[10px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors border shadow-xs",
                            isDark 
                              ? "bg-slate-800 hover:bg-indigo-950/60 text-indigo-300 border-indigo-900/60" 
                              : "bg-slate-50 hover:bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Auto-Fill Form Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dialog Footer with Selection Summary & Action Buttons */}
          <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {linkedLedgerIds.length > 0 ? (
                <span>Linked: <strong className="text-indigo-600 dark:text-indigo-400">{linkedLedgerIds.length} voucher{linkedLedgerIds.length > 1 ? 's' : ''} ({fmtCurrency(totalLinkedAmount)})</strong></span>
              ) : (
                <span>0 vouchers selected</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {linkedLedgerIds.length > 0 && (
                <Button
                  type="button"
                  onClick={() => {
                    syncFromLinkedEntries();
                    setShowLedgerDialog(false);
                  }}
                  className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Apply & Auto-Fill Form
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setShowLedgerDialog(false)}
                className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Refill Card ───────────────────────────────────────────────────────────────
interface RefillCardProps {
  refill: DieselRefill;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

function RefillCard({ refill, onEdit, onDelete, canEdit, canDelete }: RefillCardProps) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { dailyMachineLogs } = useOperations();

  // Read live actualUsed from daily logs for each allocation
  const enrichedAllocations = useMemo(() => {
    return refill.machineAllocations.map(alloc => {
      const targetDate = alloc.refillDate || refill.date;
      const log = dailyMachineLogs.find(
        l => l.assetId === alloc.assetId &&
             (l.siteId === (alloc.siteId || refill.siteId)) &&
             l.date === targetDate
      );
      return { ...alloc, actualUsed: log?.dieselUsage ?? alloc.actualUsed };
    });
  }, [refill, dailyMachineLogs]);

  const totalActual = enrichedAllocations.reduce((s, a) => s + (a.actualUsed || 0), 0);
  const totalAlloc = enrichedAllocations.reduce((s, a) => s + (a.allocatedLitres || 0), 0);
  const usagePercentage = refill.totalLitres > 0 ? Math.min(100, (totalActual / refill.totalLitres) * 100) : 0;
  const allocPercentage = refill.totalLitres > 0 ? Math.min(100, (totalAlloc / refill.totalLitres) * 100) : 0;

  // Derive display site names: expand "Multiple Sites" into actual sites from allocations
  const isMultiple = refill.siteName?.toLowerCase() === 'multiple sites';
  const uniqueSiteNames: string[] = useMemo(() => {
    if (!isMultiple) return [refill.siteName];
    const names = refill.machineAllocations
      .map(a => a.siteName)
      .filter((n): n is string => !!n);
    return [...new Set(names)];
  }, [isMultiple, refill.siteName, refill.machineAllocations]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        'rounded-xl border transition-all duration-150 overflow-hidden',
        isDark
          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          : 'bg-white border-slate-200/90 hover:border-slate-300'
      )}
    >
      {/* Card Header */}
      <div
        className="flex items-start sm:items-center gap-3 p-3 sm:p-3.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0',
          isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600 border border-amber-200/50'
        )}>
          <Fuel className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top Line: Sites + Metrics */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {uniqueSiteNames.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {uniqueSiteNames.map(name => (
                  <span
                    key={name}
                    className={cn(
                      'font-semibold text-xs sm:text-sm px-2 py-0.5 rounded-md',
                      isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800 font-medium'
                    )}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className={cn('font-semibold text-xs sm:text-sm truncate', isDark ? 'text-slate-100' : 'text-slate-800')}>
                {refill.siteName}
              </p>
            )}

            <span className={cn(
              'text-[11px] px-2 py-0.5 rounded-md font-bold tracking-tight border',
              isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
            )}>
              {fmt(refill.totalLitres)}L
            </span>

            {refill.machineAllocations.length > 0 && (
              <span className={cn(
                'text-[11px] px-1.5 py-0.5 rounded-md font-medium border',
                isDark ? 'bg-slate-800/80 text-slate-400 border-slate-700/60' : 'bg-slate-50 text-slate-600 border-slate-200/60'
              )}>
                {refill.machineAllocations.length} {refill.machineAllocations.length === 1 ? 'machine' : 'machines'}
              </span>
            )}

            {refill.linkedLedgerIds && refill.linkedLedgerIds.length > 0 && (
              <span className={cn(
                'text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium border',
                isDark ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200/70'
              )}>
                <LinkIcon className="w-2.5 h-2.5" />
                {refill.linkedLedgerIds.length} {refill.linkedLedgerIds.length === 1 ? 'Ledger' : 'Ledgers'}
              </span>
            )}
          </div>

          {/* Subline: Date, Cost, Buyer & Inline Usage */}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {new Date(refill.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {refill.totalCost ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {fmtCurrency(refill.totalCost)}
              </span>
            ) : null}
            {refill.purchasedBy && (
              <span className="text-slate-400">by {refill.purchasedBy}</span>
            )}

            {refill.totalLitres > 0 && enrichedAllocations.length > 0 && (
              <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">Alloc: <strong className="text-slate-600 dark:text-slate-300">{fmt(totalAlloc)}L</strong></span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-600 dark:text-emerald-400">Used: <strong>{fmt(totalActual)}L</strong></span>
              </span>
            )}
          </div>

          {/* Minimalist Flat Progress Bar */}
          {refill.totalLitres > 0 && enrichedAllocations.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-amber-400/80 rounded-full absolute left-0 top-0 transition-all duration-300"
                  style={{ width: `${allocPercentage}%` }}
                />
                <div
                  className="h-full bg-emerald-500 rounded-full absolute left-0 top-0 transition-all duration-300 opacity-90"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <div className="sm:hidden flex items-center gap-2 text-[9px] text-slate-400 shrink-0 font-medium">
                <span>{fmt(totalActual)}/{fmt(refill.totalLitres)}L</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              title="Edit Refill"
              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              title="Delete Refill"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded: machine breakdown */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className={cn('border-t px-3.5 pb-3.5 pt-2.5', isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50/40')}>
              {enrichedAllocations.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No machine allocations recorded.</p>
              ) : (
                <>
                  <div className={cn('rounded-lg overflow-hidden border text-xs', isDark ? 'border-slate-800' : 'border-slate-200/80')}>
                    <div className={cn('grid grid-cols-[1fr_80px_80px_75px] gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100/70 text-slate-500')}>
                      <span>Machine</span>
                      <span className="text-right">Allocated</span>
                      <span className="text-right text-emerald-600 dark:text-emerald-400">Used</span>
                      <span className="text-right">Balance</span>
                    </div>
                    {enrichedAllocations.map(alloc => {
                      const balance = (alloc.allocatedLitres || 0) - (alloc.actualUsed || 0);
                      return (
                        <div key={alloc.assetId} className={cn('grid grid-cols-[1fr_80px_80px_75px] gap-2 items-center px-3 py-2 border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
                          <div className="min-w-0 pr-1">
                            <p className={cn('font-medium text-xs truncate', isDark ? 'text-slate-200' : 'text-slate-800')}>{alloc.assetName}</p>
                            {alloc.refillDate && alloc.refillDate !== refill.date && (
                              <p className="text-[10px] text-amber-500 font-medium">
                                {new Date(alloc.refillDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                          </div>
                          <span className="text-right text-slate-600 dark:text-slate-400 font-medium">{fmt(alloc.allocatedLitres)}L</span>
                          <span className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(alloc.actualUsed)}L</span>
                          <span className={cn('text-right font-bold text-[11px]', balance > 0 ? 'text-blue-500' : balance < 0 ? 'text-red-500' : 'text-slate-400')}>
                            {balance > 0 ? `+${fmt(balance)}` : fmt(balance)}L
                          </span>
                        </div>
                      );
                    })}
                    <div className={cn('grid grid-cols-[1fr_80px_80px_75px] gap-2 px-3 py-1.5 border-t font-semibold text-xs', isDark ? 'bg-slate-800/80 border-slate-700/80 text-white' : 'bg-slate-100/90 border-slate-200 text-slate-800')}>
                      <span className="text-[10px] uppercase text-slate-400">Total</span>
                      <span className="text-right">{fmt(totalAlloc)}L</span>
                      <span className="text-right text-emerald-600 dark:text-emerald-400">{fmt(totalActual)}L</span>
                      <span className={cn('text-right text-[11px]', (totalAlloc - totalActual) > 0 ? 'text-blue-500' : 'text-slate-500')}>
                        {fmt(totalAlloc - totalActual)}L
                      </span>
                    </div>
                  </div>
                  {(refill.supplier || refill.notes) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      {refill.supplier && <p>Supplier: <span className="font-medium text-slate-600 dark:text-slate-300">{refill.supplier}</span></p>}
                      {refill.notes && <p>Note: <span className="font-medium text-slate-600 dark:text-slate-300">{refill.notes}</span></p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Flat Pagination Component ────────────────────────────────────────────────
interface FlatPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  itemName?: string;
}

function FlatPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemName = 'records'
}: FlatPaginationProps) {
  const { isDark } = useTheme();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems <= pageSize && totalItems <= 10) return null;

  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-colors mt-1',
      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/90'
    )}>
      {/* Left: Summary and Page Size */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span className="text-slate-500 font-medium">
          Showing <span className={cn('font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>{startItem}</span> to{' '}
          <span className={cn('font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>{endItem}</span> of{' '}
          <span className={cn('font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>{totalItems}</span> {itemName}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1 text-slate-400">
            <select
              value={pageSize}
              onChange={e => {
                onPageSizeChange(Number(e.target.value));
              }}
              className={cn(
                'h-6 px-1.5 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors',
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              )}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        )}
      </div>

      {/* Right: Flat Navigation Buttons */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First page"
          className={cn(
            'p-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            isDark
              ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous page"
          className={cn(
            'p-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            isDark
              ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-2 text-[11px] font-semibold text-slate-500">
          Page <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{currentPage}</strong> of{' '}
          <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{totalPages}</strong>
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next page"
          className={cn(
            'p-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            isDark
              ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last page"
          className={cn(
            'p-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            isDark
              ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DieselRefillManager() {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dieselRefills, addDieselRefill, updateDieselRefill, deleteDieselRefill } = useOperations();
  const sites = useAppStore(s => s.sites);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const ledgerRemainingAmounts = useDieselLedgerRemaining();

  const canAdd = currentUser?.privileges?.opsDiesel?.canAdd ?? false;
  const canEdit = currentUser?.privileges?.opsDiesel?.canEdit ?? false;
  const canDelete = currentUser?.privileges?.opsDiesel?.canDelete ?? false;

  const [showForm, setShowForm] = useState(false);
  const [editingRefill, setEditingRefill] = useState<DieselRefill | null>(null);
  const [initialLedgerEntry, setInitialLedgerEntry] = useState<LedgerEntry | null>(null);
  const [showPendingExpenses, setShowPendingExpenses] = useState(true);

  const [filterSite, setFilterSite] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [view, setView] = useState<'logs' | 'analytics'>('logs');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // All diesel expenses from financial ledger (including reconciled)
  const allDieselExpenses = useMemo(() => {
    return (ledgerEntries || [])
      .filter(e => {
        const desc = (e.description || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const isDiesel = desc.includes('diesel') || desc.includes('fuel') || desc.includes('ago ') || cat.includes('diesel') || cat.includes('fuel');
        const isRepairOnly = (desc.includes('fuel pump') || desc.includes('brake pad') || desc.includes('repairs')) && !desc.includes('ltr') && !desc.includes('litres');
        return isDiesel && !isRepairOnly;
      })
      .map(e => ({
        entry: e,
        remaining: ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0,
        total: Number(e.amount) || 0
      }));
  }, [ledgerEntries, ledgerRemainingAmounts]);

  // Calculate pending unallocated or partially allocated diesel expenses
  const pendingDieselExpenses = useMemo(() => {
    return allDieselExpenses.filter(item => item.remaining > 0);
  }, [allDieselExpenses]);

  const totalPendingAmount = useMemo(() => {
    return pendingDieselExpenses.reduce((s, i) => s + i.remaining, 0);
  }, [pendingDieselExpenses]);

  useSetPageTitle(
    showForm ? (editingRefill ? 'Edit Diesel Refill' : 'Log Diesel Refill') : 'Diesel Refill',
    showForm ? 'Record a bulk diesel purchase and distribute to any machines' : 'Track diesel purchases and machine consumption',
    (!showForm && canAdd) ? (
      <Button
        onClick={() => { setEditingRefill(null); setInitialLedgerEntry(null); setShowForm(true); }}
        className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-none rounded-lg"
      >
        <Plus className="w-3.5 h-3.5" /> Log Refill
      </Button>
    ) : undefined,
    [showForm, editingRefill, canAdd]
  );

  const activeSites = useMemo(() => {
    const siteIds = new Set(dieselRefills.map(r => r.siteId));
    return sites.filter(s => siteIds.has(s.id));
  }, [dieselRefills, sites]);

  const filtered = useMemo(() => {
    return dieselRefills.filter(r => {
      if (filterSite && r.siteId !== filterSite) return false;
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [dieselRefills, filterSite, filterMonth]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRefills = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Summary stats
  const totalThisMonth = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return dieselRefills.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.totalLitres, 0);
  }, [dieselRefills]);

  const totalSpentThisMonth = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return dieselRefills.filter(r => r.date.startsWith(m) && r.totalCost).reduce((s, r) => s + (r.totalCost || 0), 0);
  }, [dieselRefills]);

  const inp = cn(
    'h-8 rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors',
    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  );

  if (showForm) {
    return (
      <div className="flex flex-col h-full overflow-y-auto style-scroll p-3 sm:p-5 lg:p-6 max-w-5xl mx-auto">
        <RefillForm
          editing={editingRefill}
          initialLedgerEntry={initialLedgerEntry}
          onClose={() => { setShowForm(false); setEditingRefill(null); setInitialLedgerEntry(null); }}
          onSave={async (data) => {
            if (editingRefill) {
              await updateDieselRefill(editingRefill.id, data);
            } else {
              await addDieselRefill(data);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto style-scroll p-3 sm:p-5 lg:p-6 gap-3.5 max-w-5xl mx-auto">

      {/* Summary Cards - Flat & Minimalist */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { icon: Fuel, label: 'This Month', value: `${fmt(totalThisMonth)}L`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { icon: Droplets, label: 'Total Cost (Mo)', value: totalSpentThisMonth > 0 ? fmtCurrency(totalSpentThisMonth) : '—', color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { icon: Package, label: 'Total Refills', value: dieselRefills.length.toString(), color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { icon: Building2, label: 'Sites Covered', value: new Set(dieselRefills.map(r => r.siteId)).size.toString(), color: 'text-teal-500', bg: 'bg-teal-500/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div
            key={label}
            className={cn(
              'px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2',
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
            )}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 truncate leading-tight">{label}</p>
              <p className={cn('text-base sm:text-lg font-bold tracking-tight truncate mt-0.5', isDark ? 'text-white' : 'text-slate-900')}>{value}</p>
            </div>
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', bg)}>
              <Icon className={cn('w-3.5 h-3.5', color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Financial Ledger Diesel Expenses Banner */}
      {allDieselExpenses.length > 0 && (
        <div className={cn(
          'rounded-xl border transition-all overflow-hidden',
          pendingDieselExpenses.length > 0
            ? (isDark ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-gradient-to-r from-amber-50/70 via-indigo-50/40 to-white border-amber-200/80 shadow-xs')
            : (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/80 shadow-xs')
        )}>
          <div 
            onClick={() => setShowPendingExpenses(s => !s)}
            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', 
                pendingDieselExpenses.length > 0 
                  ? (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-500 text-white')
                  : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-500 text-white')
              )}>
                {pendingDieselExpenses.length > 0 ? <Receipt className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('font-bold text-xs sm:text-sm', isDark ? 'text-white' : 'text-slate-900')}>
                    {pendingDieselExpenses.length > 0 ? 'Pending Diesel Purchases' : 'Financial Ledger Diesel Reconciled'}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-bold',
                    pendingDieselExpenses.length > 0
                      ? (isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-200')
                      : (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                  )}>
                    {pendingDieselExpenses.length > 0 
                      ? `${pendingDieselExpenses.length} unlogged (${fmtCurrency(totalPendingAmount)})`
                      : `All ${allDieselExpenses.length} purchases reconciled`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {pendingDieselExpenses.length > 0
                    ? 'Expenses from the Financial Ledger ready to be assigned to machines'
                    : 'All diesel expenses in the financial ledger have been logged and matched to refills'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                {showPendingExpenses ? 'Collapse' : (pendingDieselExpenses.length > 0 ? 'Expand Queue' : 'View Purchases')}
              </span>
              <div className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                {showPendingExpenses ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showPendingExpenses && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className={cn('border-t p-2.5 sm:p-3 grid grid-cols-1 md:grid-cols-2 gap-2', isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200/80 bg-white/70')}>
                  {(pendingDieselExpenses.length > 0 ? pendingDieselExpenses : allDieselExpenses).map(({ entry, remaining, total }) => {
                    const parsedL = parseLitresFromText(entry.description);
                    const isPartial = remaining < total && remaining > 0;
                    const isReconciled = remaining <= 0;
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          'p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all',
                          isDark ? 'bg-slate-900 border-slate-800 hover:border-indigo-800' : 'bg-white border-slate-200 hover:border-indigo-200 shadow-xs'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('font-semibold truncate text-xs', isDark ? 'text-slate-200' : 'text-slate-800')}>
                              {entry.description}
                            </span>
                            {parsedL && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">
                                {parsedL}L
                              </span>
                            )}
                            {isReconciled && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                Fully Reconciled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 flex-wrap">
                            <span className="font-mono">{entry.voucherNo}</span>
                            <span>•</span>
                            <span>{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            {entry.site && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{entry.site}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <p className={cn('font-bold text-xs', isReconciled ? (isDark ? 'text-slate-400' : 'text-slate-600') : (isDark ? 'text-amber-400' : 'text-amber-700'))}>
                              {isReconciled ? fmtCurrency(total) : fmtCurrency(remaining)}
                            </p>
                            {isPartial && (
                              <p className="text-[9px] text-slate-400">of {fmtCurrency(total)}</p>
                            )}
                          </div>

                          {!isReconciled && canAdd && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setInitialLedgerEntry(entry);
                                setEditingRefill(null);
                                setShowForm(true);
                              }}
                              className="h-7 text-xs px-2.5 bg-amber-500 hover:bg-amber-600 text-white gap-1 shadow-none rounded-md shrink-0"
                            >
                              <Zap className="w-3 h-3" /> Log
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Flat Navigation & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-0.5">
        {/* Flat Tabs Segment */}
        <div className={cn('inline-flex p-1 rounded-lg border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200/70')}>
          <button
            onClick={() => setView('logs')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all',
              view === 'logs'
                ? (isDark ? 'bg-slate-800 text-amber-400 shadow-xs' : 'bg-white text-amber-700 shadow-xs')
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <List className="w-3.5 h-3.5" /> Refill Logs
          </button>
          <button
            onClick={() => setView('analytics')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all',
              view === 'analytics'
                ? (isDark ? 'bg-slate-800 text-amber-400 shadow-xs' : 'bg-white text-amber-700 shadow-xs')
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Machine Analytics
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterSite}
            onChange={e => {
              setFilterSite(e.target.value);
              setPage(1);
            }}
            className={inp}
          >
            <option value="">All Sites</option>
            {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="month"
            value={filterMonth}
            onChange={e => {
              setFilterMonth(e.target.value);
              setPage(1);
            }}
            className={inp}
          />
          {(filterSite || filterMonth) && (
            <button
              onClick={() => { setFilterSite(''); setFilterMonth(''); setPage(1); }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="text-[11px] font-medium text-slate-400 pl-1">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</span>
        </div>
      </div>

      {/* Content */}
      {view === 'logs' ? (
        filtered.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center py-12 rounded-xl border', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
            <div className="p-3 rounded-xl bg-amber-500/10 mb-2.5">
              <Fuel className="w-6 h-6 text-amber-500" />
            </div>
            <p className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-slate-900')}>No diesel refills found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {canAdd ? 'Click "Log Refill" to record a purchase' : 'No refill records match your filters'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {paginatedRefills.map(refill => (
                <RefillCard
                  key={refill.id}
                  refill={refill}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => { setEditingRefill(refill); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  onDelete={async () => {
                    if (confirm(`Delete refill of ${fmt(refill.totalLitres)}L for ${refill.siteName}?`)) {
                      await deleteDieselRefill(refill.id);
                    }
                  }}
                />
              ))}
            </AnimatePresence>

            {/* Pagination Controls */}
            <FlatPagination
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={s => { setPageSize(s); setPage(1); }}
              itemName="refills"
            />
          </div>
        )
      ) : (
        <MachineAnalyticsView refills={filtered} />
      )}
    </div>
  );
}

// ── Machine Analytics View ──────────────────────────────────────────────────
function MachineAnalyticsView({ refills }: { refills: DieselRefill[] }) {
  const { isDark } = useTheme();
  const { dailyMachineLogs } = useOperations();
  const sites = useAppStore(s => s.sites);

  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null);

  // Analytics Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const activeSites = useMemo(() => {
    const set = new Set<string>();
    refills.forEach(r => set.add(r.siteId));
    dailyMachineLogs.forEach(l => { if ((l.dieselUsage || 0) > 0) set.add(l.siteId); });
    return sites.filter(s => set.has(s.id));
  }, [refills, dailyMachineLogs, sites]);

  const analyticsByMachine = useMemo(() => {
    const machineMap = new Map<string, any>();
    
    // First, gather all relevant history entries from refills
    refills.forEach(r => {
      if (selectedSiteId !== 'all' && r.siteId !== selectedSiteId) return;

      r.machineAllocations.forEach(a => {
        const dateStr = a.refillDate || r.date;
        if (dateFrom && dateStr < dateFrom) return;
        if (dateTo && dateStr > dateTo) return;

        if (!machineMap.has(a.assetId)) {
          machineMap.set(a.assetId, {
            assetId: a.assetId,
            assetName: a.assetName,
            activeDays: 0,
            historyMap: new Map(),
          });
        }
        const m = machineMap.get(a.assetId);
        if (!m.historyMap.has(dateStr)) {
            m.historyMap.set(dateStr, { 
                date: dateStr, 
                siteName: r.siteName, 
                allocated: 0, 
                used: 0,
                hasRefillRecord: true 
            });
        } else {
            m.historyMap.get(dateStr).hasRefillRecord = true;
        }
        m.historyMap.get(dateStr).allocated += (a.allocatedLitres || 0);
      });
    });

    // Next, process daily logs
    dailyMachineLogs.forEach(l => {
      if (selectedSiteId !== 'all' && l.siteId !== selectedSiteId) return;
      
      const inDateRange = (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo);
      const isUsage = (l.dieselUsage || 0) > 0;
      
      // Calculate active days for average even if no usage on that day
      const isActiveDay = inDateRange && (l.operationalDay === 'full' || l.operationalDay === 'half' || (!l.operationalDay && l.isActive));

      if (isUsage || isActiveDay) {
        if (!machineMap.has(l.assetId)) {
          machineMap.set(l.assetId, {
            assetId: l.assetId,
            assetName: l.assetName,
            activeDays: 0,
            historyMap: new Map(),
          });
        }
        const m = machineMap.get(l.assetId);

        if (isUsage && inDateRange) {
            const dateStr = l.date;
            if (!m.historyMap.has(dateStr)) {
                // No refill record exists! Auto-set allocated (bought) as used (dieselUsage)
                m.historyMap.set(dateStr, { 
                    date: dateStr, 
                    siteName: l.siteName || '', 
                    allocated: l.dieselUsage || 0,
                    used: l.dieselUsage || 0,
                    hasRefillRecord: false 
                });
            } else {
                const histEntry = m.historyMap.get(dateStr);
                histEntry.used += (l.dieselUsage || 0);
                // If it doesn't have an actual refill record, keep allocated in sync with used
                if (!histEntry.hasRefillRecord) {
                    histEntry.allocated = histEntry.used;
                }
            }
        }
      }
    });

    // Now, calculate the average usage based on active days within the refill/usage range
    return Array.from(machineMap.values())
      .map(m => {
        const history: any[] = Array.from(m.historyMap.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const trackedDates = history
          .filter((h: any) => h.allocated > 0 || h.used > 0)
          .map((h: any) => h.date);

        let activeDaysCount = 0;

        if (trackedDates.length > 0) {
          const minDate = trackedDates.reduce((min, d) => d < min ? d : min, trackedDates[0]);
          const maxDate = trackedDates.reduce((max, d) => d > max ? d : max, trackedDates[0]);

          // Count active days specifically inbetween the refill/usage range [minDate, maxDate]
          dailyMachineLogs.forEach(l => {
            if (l.assetId === m.assetId) {
              if (selectedSiteId !== 'all' && l.siteId !== selectedSiteId) return;
              const inDateRange = (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo);
              if (inDateRange && l.date >= minDate && l.date <= maxDate) {
                const isActiveDay = l.operationalDay === 'full' || l.operationalDay === 'half' || (!l.operationalDay && l.isActive);
                if (isActiveDay) {
                  activeDaysCount += 1;
                }
              }
            }
          });
        }

        const totalAllocated = history.reduce((sum: number, h: any) => sum + h.allocated, 0);
        const totalUsed = history.reduce((sum: number, h: any) => sum + h.used, 0);
        const avgUsage = activeDaysCount > 0 ? (totalUsed / activeDaysCount) : 0;
        
        let currentBalance = 0;
        const historyAsc = [...history].reverse();
        const historyWithBal = historyAsc.map((h: any) => {
            currentBalance += (h.allocated - h.used);
            return { ...h, cumulativeBalance: currentBalance };
        }).reverse();

        return {
          ...m,
          activeDays: activeDaysCount,
          totalAllocated,
          totalUsed,
          balance: totalAllocated - totalUsed,
          avgUsage,
          history: historyWithBal
        };
      })
      .filter(m => m.history.length > 0)
      .sort((a, b) => b.totalUsed - a.totalUsed);

  }, [refills, dailyMachineLogs, selectedSiteId, dateFrom, dateTo]);

  const totalAnalyticsPages = Math.max(1, Math.ceil(analyticsByMachine.length / pageSize));
  const safeAnalyticsPage = Math.min(page, totalAnalyticsPages);

  const paginatedMachines = useMemo(() => {
    const start = (safeAnalyticsPage - 1) * pageSize;
    return analyticsByMachine.slice(start, start + pageSize);
  }, [analyticsByMachine, safeAnalyticsPage, pageSize]);

  const inp = cn(
    'h-8 rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors',
    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  );

  if (analyticsByMachine.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {/* Filter Toolbar */}
        <div className={cn('p-3 rounded-xl border flex flex-wrap gap-2.5 items-center', isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90')}>
          <div className="flex items-center gap-2 mr-auto">
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <Gauge className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
            <h3 className={cn('font-semibold text-xs sm:text-sm', isDark ? 'text-white' : 'text-slate-900')}>Machine Analytics</h3>
          </div>
          <select
            value={selectedSiteId}
            onChange={e => {
              setSelectedSiteId(e.target.value);
              setPage(1);
            }}
            className={inp}
          >
            <option value="all">All Sites</option>
            {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className={inp}
              title="From Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className={inp}
              title="To Date"
            />
          </div>
          {(dateFrom || dateTo || selectedSiteId !== 'all') && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setSelectedSiteId('all'); setPage(1); }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5"
            >
              Clear
            </button>
          )}
        </div>

        <div className={cn('flex flex-col items-center justify-center py-12 rounded-xl border', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
          <div className="p-3 rounded-xl bg-slate-500/10 mb-2">
            <BarChart3 className="w-6 h-6 text-slate-400" />
          </div>
          <p className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-slate-900')}>No machine analytics</p>
          <p className="text-xs text-slate-500 mt-0.5">Adjust your filters or record diesel refills to see analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-8">
      {/* Filter Toolbar */}
      <div className={cn('p-3 rounded-xl border flex flex-wrap gap-2.5 items-center', isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90')}>
        <div className="flex items-center gap-2 mr-auto">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Gauge className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <h3 className={cn('font-semibold text-xs sm:text-sm', isDark ? 'text-white' : 'text-slate-900')}>Machine Analytics</h3>
        </div>
        <select
          value={selectedSiteId}
          onChange={e => {
            setSelectedSiteId(e.target.value);
            setPage(1);
          }}
          className={inp}
        >
          <option value="all">All Sites</option>
          {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={e => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className={inp}
            title="From Date"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className={inp}
            title="To Date"
          />
        </div>
        {(dateFrom || dateTo || selectedSiteId !== 'all') && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setSelectedSiteId('all'); setPage(1); }}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {paginatedMachines.map(machine => {
          const isExpanded = expandedMachine === machine.assetId;
          const toggle = () => setExpandedMachine(isExpanded ? null : machine.assetId);
          
          return (
            <motion.div
              key={machine.assetId}
              layout
              className={cn(
                'rounded-xl border overflow-hidden transition-all duration-150',
                isDark ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/90 hover:border-slate-300'
              )}
            >
              {/* Header */}
              <div onClick={toggle} className="cursor-pointer p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600 border border-indigo-200/50')}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={cn('font-semibold text-xs sm:text-sm', isDark ? 'text-white' : 'text-slate-900')}>{machine.assetName}</h4>
                    <p className="text-[11px] text-slate-500">{machine.history.length} {machine.history.length === 1 ? 'record' : 'records'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 flex-1 md:justify-end">
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bought</span>
                    <span className={cn('font-semibold text-xs sm:text-sm', isDark ? 'text-blue-400' : 'text-blue-600')}>{fmt(machine.totalAllocated)}L</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Used</span>
                    <span className={cn('font-semibold text-xs sm:text-sm', isDark ? 'text-emerald-400' : 'text-emerald-600')}>{fmt(machine.totalUsed)}L</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bal</span>
                    <span className={cn('font-semibold text-xs sm:text-sm', machine.balance > 0 ? 'text-blue-500' : machine.balance < 0 ? 'text-red-500' : 'text-slate-500')}>
                      {machine.balance > 0 ? `+${fmt(machine.balance)}` : fmt(machine.balance)}L
                    </span>
                  </div>
                  <div className={cn('px-2.5 py-1 rounded-md border flex items-center gap-1.5', isDark ? 'bg-amber-950/30 border-amber-900/50' : 'bg-amber-50 border-amber-200/80')}>
                     <Gauge className="w-3 h-3 text-amber-600 dark:text-amber-500" />
                     <div className="flex flex-col text-left">
                        <span className={cn('text-[8px] font-bold uppercase tracking-wider leading-none mb-0.5', isDark ? 'text-amber-500/70' : 'text-amber-700/70')}>Avg Usage</span>
                        <span className={cn('text-[11px] font-black leading-none', isDark ? 'text-amber-400' : 'text-amber-700')}>{fmt(machine.avgUsage)}L/d</span>
                     </div>
                  </div>
                  <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className={cn('border-t', isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50/40')}>
                      <div className="overflow-x-auto max-h-[350px] style-scroll">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[550px]">
                          <thead className={cn('text-[10px] uppercase tracking-wider sticky top-0 z-10 font-bold', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100/90 text-slate-500')}>
                            <tr>
                              <th className="px-4 py-2">Date</th>
                              <th className="px-4 py-2">Site</th>
                              <th className="px-4 py-2 text-right">Bought (L)</th>
                              <th className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">Used (L)</th>
                              <th className="px-4 py-2 text-right">Record Bal</th>
                              <th className="px-4 py-2 text-right text-indigo-500">Cumulative Bal</th>
                            </tr>
                          </thead>
                          <tbody className={cn('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                            {machine.history.map((h: any, i: number) => {
                              const recBal = h.allocated - h.used;
                              return (
                                <tr key={i} className={cn('transition-colors', isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}>
                                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{h.siteName}</td>
                                  <td className="px-4 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                                    {h.allocated > 0 ? `${fmt(h.allocated)}L` : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                    {h.used > 0 ? `${fmt(h.used)}L` : '—'}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={cn('text-[11px] font-medium', recBal > 0 ? 'text-blue-500' : recBal < 0 ? 'text-red-500' : 'text-slate-400')}>
                                      {recBal > 0 ? `+${fmt(recBal)}` : fmt(recBal)}L
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={cn('font-bold text-[11px]', h.cumulativeBalance > 0 ? 'text-indigo-500 dark:text-indigo-400' : h.cumulativeBalance < 0 ? 'text-red-500' : 'text-slate-400')}>
                                      {h.cumulativeBalance > 0 ? `+${fmt(h.cumulativeBalance)}` : fmt(h.cumulativeBalance)}L
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Analytics Pagination */}
        <FlatPagination
          currentPage={safeAnalyticsPage}
          totalItems={analyticsByMachine.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1); }}
          itemName="machines"
        />
      </div>
    </div>
  );
}

