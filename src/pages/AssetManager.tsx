import { useState, useRef, useMemo, useDeferredValue, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { useOperations } from '../contexts/OperationsContext';
import {
  Plus, Search, Package, Upload, ListFilter,
  Edit2, Trash2, BarChart2, Clock, FileText, MoreHorizontal,
  ChevronsUpDown, ChevronUp, ChevronDown as ChevronDownIcon,
  Download, History, Layers, AlertCircle, CheckCircle, Calendar,
  ArrowUpRight, ArrowDownLeft, ArrowLeft, Filter, Building2, User,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  MapPin, Truck, ExternalLink, RotateCcw, ShieldAlert, Boxes, ArrowUpDown
} from 'lucide-react';
import { cn, formatUnit } from '@/src/lib/utils';
import { Asset, AssetCategory, AssetBatch, AssetMovement, MovementType } from '../types/operations';
import { formatDualUnit, getDualUnitBreakdown } from '@/src/lib/unitConversions';
import { AssetForm } from './AssetForm';
import { RestockModal } from './RestockModal';
import { AssetAnalyticsDialog } from './AssetAnalyticsDialog';
import { BulkImportAssetsDialog } from './BulkImportAssetsDialog';
import { ExportAssetsDialog } from './ExportAssetsDialog';
import { CreateReturnWaybill } from './CreateReturnWaybill';
import { usePriv } from '../hooks/usePriv';
import { useAppStore, Site } from '../store/appStore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '@/src/components/ui/dialog';
import { useSetPageTitle, useAutoCollapseSidebar } from '@/src/contexts/PageContext';

/* ─────────────────────────────────────────────────────────────── */
/* Inline Description Dialog                                       */
/* ─────────────────────────────────────────────────────────────── */
function DescriptionDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const dualUnit = getDualUnitBreakdown(asset.quantity, asset.unitOfMeasurement, asset.packUnit, asset.packSize);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-none">Asset Details</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{asset.name}</p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Category', value: asset.category },
              { label: 'Type', value: asset.type },
              { label: 'Location', value: asset.location || 'Not set' },
              { label: 'Condition', value: asset.condition },
              { label: 'Unit', value: formatUnit(asset.unitOfMeasurement) },
              { label: 'Packaging', value: dualUnit.hasPackaging ? `${asset.packSize} ${formatUnit(asset.unitOfMeasurement)} / ${asset.packUnit}` : 'Singles' },
              { label: 'Total Stock', value: dualUnit.displayText },
              { label: 'Status', value: asset.status },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted/40 p-3 border border-border">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-bold text-foreground capitalize mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
          {asset.description ? (
            <div className="rounded-xl bg-muted/40 p-4 border border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{asset.description}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">No description added.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Inline Restock History Dialog                                   */
/* ─────────────────────────────────────────────────────────────── */
function RestockHistoryDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const history = asset.restockHistory ?? [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-none">Restock History</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{asset.name}</p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>
        <div className="overflow-y-auto max-h-[60vh] no-scrollbar p-5">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">No restock records yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...history].reverse().map((record, idx) => (
                <div key={record.id} className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                    #{history.length - idx}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-foreground">+{record.quantity} units</p>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {new Date(record.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {record.batchNumber && (
                      <p className="text-[10px] text-primary font-bold">Batch: {record.batchNumber}</p>
                    )}
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        Unit: <span className="font-bold text-foreground">₦{record.unitCost.toFixed(2)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        Total: <span className="font-bold text-primary">₦{record.totalCost.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Inline Batches & Expiry Dialog                                  */
/* ─────────────────────────────────────────────────────────────── */
function AssetBatchesDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const batches = asset.batches ?? [];
  const now = new Date();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-xl p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-none">FIFO Batches & Expiry</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{asset.name}</p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] no-scrollbar p-5 space-y-3">
          {batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">No batches recorded for this asset yet.</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm">New batches are automatically created and tracked when you restock this asset.</p>
            </div>
          ) : (
            batches.map((batch, idx) => {
              let isExpired = false;
              let isNearExpiry = false;
              let daysLeft: number | null = null;

              if (batch.expiryDate) {
                const exp = new Date(batch.expiryDate);
                const diffTime = exp.getTime() - now.getTime();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (daysLeft <= 0) isExpired = true;
                else if (daysLeft <= 30) isNearExpiry = true;
              }

              return (
                <div key={batch.id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{batch.batchNumber || `Batch #${idx + 1}`}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-bold px-2 py-0 rounded-full',
                            batch.status === 'depleted'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300'
                              : isExpired
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300'
                                : isNearExpiry
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300'
                          )}
                        >
                          {batch.status === 'depleted' ? 'Depleted' : isExpired ? 'Expired' : isNearExpiry ? `Expiring in ${daysLeft}d` : 'Active'}
                        </Badge>
                      </div>
                      {batch.supplier && (
                        <p className="text-xs text-muted-foreground mt-0.5">Supplier: <span className="font-medium text-foreground">{batch.supplier}</span></p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-primary">
                        {batch.remainingQuantity} / {batch.initialQuantity} {formatUnit(asset.unitOfMeasurement)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">₦{batch.unitCost.toFixed(2)}/unit</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40 text-muted-foreground">
                    <div>
                      <span>Received: </span>
                      <span className="font-medium text-foreground">{new Date(batch.receivedDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="text-right">
                      <span>Expiry: </span>
                      <span className={cn('font-semibold', isExpired ? 'text-red-500' : isNearExpiry ? 'text-amber-500' : 'text-foreground')}>
                        {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Movement Type Badge Helper                                      */
/* ─────────────────────────────────────────────────────────────── */
function MovementTypeBadge({ type }: { type: MovementType }) {
  switch (type) {
    case 'restock':
    case 'initial':
      return <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 font-bold">Inbound Restock</Badge>;
    case 'waybill_dispatch':
      return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 font-bold">Waybill Dispatch</Badge>;
    case 'checkout':
      return <Badge className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-300 font-bold">Quick Checkout</Badge>;
    case 'checkout_return':
      return <Badge className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-300 font-bold">Checkout Return</Badge>;
    case 'consumable_burn':
      return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 font-bold">Consumable Burn</Badge>;
    case 'waybill_return':
      return <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 font-bold">Site Return</Badge>;
    case 'damage_writeoff':
    case 'missing_writeoff':
      return <Badge className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-300 font-bold">Write-off</Badge>;
    default:
      return <Badge variant="outline" className="font-bold">Adjustment</Badge>;
  }
}

/* ─────────────────────────────────────────────────────────────── */
/* Actions Dropdown                                                */
/* ─────────────────────────────────────────────────────────────── */
type ActionModal = 'edit' | 'description' | 'analytics' | 'restock-history' | 'restock' | 'batches' | 'movements' | null;

function AssetActionsMenu({
  asset,
  onAction,
  onDelete,
}: {
  asset: Asset;
  onAction: (modal: ActionModal) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-all shadow-sm hover:shadow-md focus:outline-none">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-1">
        <DropdownMenuItem
          onClick={() => onAction('edit')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit Form
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('batches')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Layers className="h-3.5 w-3.5" />
          FIFO Batches & Expiry
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('movements')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <History className="h-3.5 w-3.5" />
          View Movements
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('description')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Description
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('analytics')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Analytics
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('restock-history')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
          Restock History
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
        <DropdownMenuItem
          onClick={onDelete}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Main AssetManager Component                                     */
/* ─────────────────────────────────────────────────────────────── */
export function AssetManager() {
  useAutoCollapseSidebar();
  const { assets, deleteAsset, bulkAddAssets, assetMovements, waybills } = useOperations();
  const sites = useAppStore(s => s.sites);
  const consumableLogs = useAppStore(s => s.consumableLogs);
  const priv = usePriv('opsInventory');
  const canExport = priv?.canExport ?? false;
  const canImport = priv?.canImport ?? false;

  // View state: 'catalog' | 'deployed' | 'ledger'
  const [activeTab, setActiveTab] = useState<'catalog' | 'deployed' | 'ledger'>('catalog');
  const [, startTransition] = useTransition();
  const [returnSite, setReturnSite] = useState<Site | null>(null);

  // Pagination for Catalog
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(25);

  // Deployed On-Site Filter & Pagination State
  const [deployedSearch, setDeployedSearch] = useState('');
  const [deployedSiteFilter, setDeployedSiteFilter] = useState('all');
  const [deployedCategoryFilter, setDeployedCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [deployedViewMode, setDeployedViewMode] = useState<'table' | 'bySite'>('table');
  const [deployedSortKey, setDeployedSortKey] = useState<'days' | 'name' | 'site' | 'qty' | 'date'>('days');
  const [deployedSortDir, setDeployedSortDir] = useState<'asc' | 'desc'>('desc');
  const [deployedPage, setDeployedPage] = useState(1);
  const [deployedPageSize, setDeployedPageSize] = useState(15);

  // Pagination for Movements Ledger
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(15);

  // Modals state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Ledger Filter State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('all');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<'all' | '7d' | '30d' | 'thisMonth'>('all');

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50 inline-block" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 inline-block" />
      : <ChevronDownIcon className="h-3 w-3 ml-1 inline-block" />;
  };

  // ── Compute Deployed On-Site Inventory across all sites ──────────────
  const deployedItems = useMemo(() => {
    interface DeployedMapEntry {
      key: string;
      siteId: string;
      siteName: string;
      assetId: string;
      assetName: string;
      category: AssetCategory;
      type: string;
      unit: string;
      unreturnedQuantity: number;
      totalDispatched: number;
      totalReturned: number;
      firstDispatchDate: string;
      latestDispatchDate: string;
      daysOnSite: number;
      waybillRefs: string[];
      drivers: string[];
      unitCost?: number;
      totalValue?: number;
    }

    const map = new Map<string, DeployedMapEntry>();

    // 1. Scan outbound waybills
    (waybills || [])
      .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
      .forEach(wb => {
        const sId = wb.siteId || 'unknown';
        const sName = wb.siteName || sites.find(s => s.id === sId)?.name || 'Unknown Site';
        const dateStr = wb.sentToSiteDate || wb.issueDate || '';

        wb.items?.forEach(item => {
          if (!item.assetId || item.quantity <= 0) return;
          const key = `${sId}::${item.assetId}`;
          const assetMeta = assets.find(a => a.id === item.assetId);
          const existing = map.get(key);

          if (existing) {
            existing.totalDispatched += item.quantity;
            existing.unreturnedQuantity += item.quantity;
            if (wb.id && !existing.waybillRefs.includes(wb.id)) existing.waybillRefs.push(wb.id);
            if (wb.driverName && !existing.drivers.includes(wb.driverName)) existing.drivers.push(wb.driverName);
            if (dateStr && (!existing.firstDispatchDate || dateStr < existing.firstDispatchDate)) {
              existing.firstDispatchDate = dateStr;
            }
            if (dateStr && (!existing.latestDispatchDate || dateStr > existing.latestDispatchDate)) {
              existing.latestDispatchDate = dateStr;
            }
          } else {
            map.set(key, {
              key,
              siteId: sId,
              siteName: sName,
              assetId: item.assetId,
              assetName: item.assetName || assetMeta?.name || 'Unknown Asset',
              category: (assetMeta?.category as AssetCategory) || 'dewatering',
              type: assetMeta?.type || 'equipment',
              unit: assetMeta?.unitOfMeasurement || 'pcs',
              unreturnedQuantity: item.quantity,
              totalDispatched: item.quantity,
              totalReturned: 0,
              firstDispatchDate: dateStr,
              latestDispatchDate: dateStr,
              daysOnSite: 0,
              waybillRefs: wb.id ? [wb.id] : [],
              drivers: wb.driverName ? [wb.driverName] : [],
              unitCost: assetMeta?.cost,
              totalValue: 0
            });
          }
        });
      });

    // 2. Subtract completed returns
    (waybills || [])
      .filter(w => w.type === 'return')
      .forEach(wb => {
        const sId = wb.siteId || 'unknown';
        wb.items?.forEach(item => {
          if (!item.assetId) return;
          const key = `${sId}::${item.assetId}`;
          const existing = map.get(key);
          if (existing) {
            if (wb.status === 'return_completed') {
              existing.totalReturned += item.quantity;
              existing.unreturnedQuantity = Math.max(0, existing.unreturnedQuantity - item.quantity);
            }
          }
        });
      });

    // 3. Subtract consumed usages
    (consumableLogs || []).forEach(log => {
      const key = `${log.siteId}::${log.assetId}`;
      const existing = map.get(key);
      if (existing) {
        existing.unreturnedQuantity = Math.max(0, existing.unreturnedQuantity - (log.quantityUsed || 0));
      }
    });

    const now = new Date();
    const result: DeployedMapEntry[] = [];

    map.forEach(row => {
      if (row.unreturnedQuantity > 0) {
        if (row.firstDispatchDate) {
          const d = new Date(row.firstDispatchDate);
          row.daysOnSite = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
        }
        if (row.unitCost) {
          row.totalValue = row.unitCost * row.unreturnedQuantity;
        }
        result.push(row);
      }
    });

    return result;
  }, [waybills, assets, sites, consumableLogs]);

  // Filtered Deployed Items
  const filteredDeployedItems = useMemo(() => {
    const list = deployedItems.filter(item => {
      if (deployedSiteFilter !== 'all' && item.siteId !== deployedSiteFilter) return false;
      if (deployedCategoryFilter !== 'all' && item.category !== deployedCategoryFilter) return false;
      if (deployedSearch.trim()) {
        const query = deployedSearch.toLowerCase().trim();
        const matchName = item.assetName.toLowerCase().includes(query);
        const matchSite = item.siteName.toLowerCase().includes(query);
        const matchWb = item.waybillRefs.some(ref => ref.toLowerCase().includes(query));
        const matchDriver = item.drivers.some(d => d.toLowerCase().includes(query));
        if (!matchName && !matchSite && !matchWb && !matchDriver) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let comparison = 0;
      switch (deployedSortKey) {
        case 'name':
          comparison = a.assetName.localeCompare(b.assetName);
          break;
        case 'site':
          comparison = a.siteName.localeCompare(b.siteName);
          break;
        case 'qty':
          comparison = a.unreturnedQuantity - b.unreturnedQuantity;
          break;
        case 'date': {
          const tA = new Date(a.latestDispatchDate || 0).getTime();
          const tB = new Date(b.latestDispatchDate || 0).getTime();
          comparison = tA - tB;
          break;
        }
        case 'days':
        default:
          comparison = a.daysOnSite - b.daysOnSite;
          break;
      }
      return deployedSortDir === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [deployedItems, deployedSiteFilter, deployedCategoryFilter, deployedSearch, deployedSortKey, deployedSortDir]);

  // Summary Metrics for Deployed Items
  const deployedMetrics = useMemo(() => {
    const totalUnits = filteredDeployedItems.reduce((acc, row) => acc + row.unreturnedQuantity, 0);
    const totalVal = filteredDeployedItems.reduce((acc, row) => acc + (row.totalValue || 0), 0);
    const activeSitesSet = new Set(filteredDeployedItems.map(row => row.siteId));
    const uniqueAssetsSet = new Set(filteredDeployedItems.map(row => row.assetId));

    return {
      totalUnits,
      totalVal,
      totalSites: activeSitesSet.size,
      totalUniqueAssets: uniqueAssetsSet.size,
      totalRows: filteredDeployedItems.length
    };
  }, [filteredDeployedItems]);

  // Sites dropdown options for Deployed filter
  const deployedSitesOptions = useMemo(() => {
    const siteMap = new Map<string, { id: string; name: string; count: number }>();
    deployedItems.forEach(item => {
      const existing = siteMap.get(item.siteId);
      if (existing) {
        existing.count += item.unreturnedQuantity;
      } else {
        siteMap.set(item.siteId, { id: item.siteId, name: item.siteName, count: item.unreturnedQuantity });
      }
    });
    return Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [deployedItems]);

  // Grouped by Site view
  const deployedGroupedBySite = useMemo(() => {
    const grouped = new Map<string, { siteId: string; siteName: string; siteObj?: Site; items: typeof deployedItems; totalUnits: number }>();
    filteredDeployedItems.forEach(item => {
      const existing = grouped.get(item.siteId);
      if (existing) {
        existing.items.push(item);
        existing.totalUnits += item.unreturnedQuantity;
      } else {
        const siteObj = sites.find(s => s.id === item.siteId || s.name.toLowerCase() === item.siteName.toLowerCase());
        grouped.set(item.siteId, {
          siteId: item.siteId,
          siteName: item.siteName,
          siteObj,
          items: [item],
          totalUnits: item.unreturnedQuantity
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.totalUnits - a.totalUnits);
  }, [filteredDeployedItems, sites]);

  // Pagination for Deployed Table View
  const totalDeployedPages = Math.max(1, Math.ceil(filteredDeployedItems.length / deployedPageSize));
  const paginatedDeployedItems = useMemo(() => {
    return filteredDeployedItems.slice((deployedPage - 1) * deployedPageSize, deployedPage * deployedPageSize);
  }, [filteredDeployedItems, deployedPage, deployedPageSize]);

  // Export Deployed to Excel
  const handleExportDeployed = () => {
    if (filteredDeployedItems.length === 0) return;
    const exportData = filteredDeployedItems.map(row => ({
      'Site Name': row.siteName,
      'Asset Name': row.assetName,
      'Category': row.category,
      'Type': row.type,
      'Unreturned Qty': `${row.unreturnedQuantity} ${row.unit}`,
      'Total Dispatched': row.totalDispatched,
      'Total Returned': row.totalReturned,
      'Days on Site': `${row.daysOnSite} days`,
      'First Dispatched': row.firstDispatchDate ? new Date(row.firstDispatchDate).toLocaleDateString('en-GB') : 'N/A',
      'Latest Dispatched': row.latestDispatchDate ? new Date(row.latestDispatchDate).toLocaleDateString('en-GB') : 'N/A',
      'Origin Waybill(s)': row.waybillRefs.join(', '),
      'Driver(s)': row.drivers.join(', '),
      'Unit Cost (NGN)': row.unitCost || 0,
      'Total Value on Site (NGN)': row.totalValue || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deployed On Site');
    XLSX.writeFile(wb, `Deployed_Assets_OnSite_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filtered Movements for Full-Page Ledger
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const seenIds = new Set<string>();
    const seenCompositeKeys = new Set<string>();

    return assetMovements.filter(m => {
      // Deduplication safeguard
      const compositeKey = `${m.referenceId || m.id}_${m.assetId}_${m.movementType}_${m.quantityDelta}_${m.createdAt}`;
      if (seenIds.has(m.id) || seenCompositeKeys.has(compositeKey)) return false;
      seenIds.add(m.id);
      seenCompositeKeys.add(compositeKey);

      if (ledgerTypeFilter !== 'all' && m.movementType !== ledgerTypeFilter) return false;
      
      // Date filter
      if (ledgerDateFilter !== 'all') {
        const mDate = new Date(m.createdAt);
        const diffDays = (now.getTime() - mDate.getTime()) / (1000 * 3600 * 24);
        if (ledgerDateFilter === '7d' && diffDays > 7) return false;
        if (ledgerDateFilter === '30d' && diffDays > 30) return false;
        if (ledgerDateFilter === 'thisMonth' && (mDate.getMonth() !== now.getMonth() || mDate.getFullYear() !== now.getFullYear())) return false;
      }

      // Search filter
      if (ledgerSearch) {
        const term = ledgerSearch.toLowerCase();
        const matchName = m.assetName.toLowerCase().includes(term);
        const matchRef = m.referenceId?.toLowerCase().includes(term);
        const matchSite = m.siteName?.toLowerCase().includes(term);
        const matchReason = m.reasonCode?.toLowerCase().includes(term);
        const matchBatch = m.batchNumber?.toLowerCase().includes(term);
        const matchActor = m.actorName?.toLowerCase().includes(term);
        if (!matchName && !matchRef && !matchSite && !matchReason && !matchBatch && !matchActor) return false;
      }
      return true;
    });
  }, [assetMovements, ledgerTypeFilter, ledgerDateFilter, ledgerSearch]);

  // Total Ledger Pages & Paginated Movements
  const totalLedgerPages = Math.max(1, Math.ceil(filteredMovements.length / ledgerPageSize));
  const paginatedMovements = useMemo(() => {
    return filteredMovements.slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize);
  }, [filteredMovements, ledgerPage, ledgerPageSize]);

  // Ledger Summary Metrics (Conforms directly to active search & filters)
  const ledgerMetrics = useMemo(() => {
    let totalInbound = 0;
    let totalDispatched = 0;
    let totalBurned = 0;
    let totalValue = 0;

    filteredMovements.forEach(m => {
      if (m.quantityDelta > 0) totalInbound += m.quantityDelta;
      if (m.movementType === 'waybill_dispatch') totalDispatched += Math.abs(m.quantityDelta);
      if (m.movementType === 'consumable_burn') totalBurned += Math.abs(m.quantityDelta);
      if (m.totalCost) totalValue += m.totalCost;
    });

    const netBalance = totalInbound - totalDispatched - totalBurned;

    return { totalInbound, totalDispatched, totalBurned, totalValue, netBalance };
  }, [filteredMovements]);

  // Export Ledger to Excel
  const handleExportLedger = () => {
    if (filteredMovements.length === 0) return;
    const exportData = filteredMovements.map(m => ({
      'Date & Time': new Date(m.createdAt).toLocaleString('en-NG'),
      'Asset Name': m.assetName,
      'Movement Type': m.movementType,
      'Batch Number': m.batchNumber || 'N/A',
      'Quantity Delta': m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
      'Previous Qty': m.previousQuantity,
      'New Qty': m.newQuantity,
      'Unit Cost (NGN)': m.unitCost || 0,
      'Total Value (NGN)': m.totalCost || 0,
      'Site': m.siteName || 'N/A',
      'Reference ID': m.referenceId || 'N/A',
      'Actor / Recorded By': m.actorName || 'N/A',
      'Reason / Notes': m.reasonCode || m.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Movements');
    XLSX.writeFile(wb, `Stock_Movements_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const headerButtons = useMemo(() => (
    <div className="flex items-center gap-2 md:gap-3 select-none">
      {/* Top View Toggle Tabs with Spring Sliding Indicator */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 mr-1 relative">
        <button
          type="button"
          onClick={() => startTransition(() => { setActiveTab('catalog'); setLedgerSearch(''); })}
          className={cn(
            "relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 cursor-pointer z-10 select-none active:scale-95",
            activeTab === 'catalog'
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          {activeTab === 'catalog' && (
            <motion.div
              layoutId="inventoryTabIndicator"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm -z-10"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <Package className="h-3.5 w-3.5" />
          <span>Catalog</span>
        </button>

        <button
          type="button"
          onClick={() => startTransition(() => { setActiveTab('deployed'); })}
          className={cn(
            "relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 cursor-pointer z-10 select-none active:scale-95",
            activeTab === 'deployed'
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          {activeTab === 'deployed' && (
            <motion.div
              layoutId="inventoryTabIndicator"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm -z-10"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <MapPin className="h-3.5 w-3.5" />
          <span>Deployed on Site</span>
          {deployedItems.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              {deployedItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => startTransition(() => { setActiveTab('ledger'); })}
          className={cn(
            "relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 cursor-pointer z-10 select-none active:scale-95",
            activeTab === 'ledger'
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          {activeTab === 'ledger' && (
            <motion.div
              layoutId="inventoryTabIndicator"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm -z-10"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <History className="h-3.5 w-3.5" />
          <span>Movements Ledger</span>
        </button>
      </div>

      {activeTab === 'deployed' ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9 px-3 text-slate-700 hover:text-slate-900 border-slate-200 font-semibold" onClick={handleExportDeployed}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9 px-3 text-slate-700 hover:text-slate-900 border-slate-200 font-semibold" onClick={handleExportLedger}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>
      ) : (
        <>
          {canExport && (
            <Button variant="outline" size="sm" className="gap-2 h-9 px-2 sm:px-3 text-slate-700 hover:text-slate-900 border-slate-200" onClick={() => setShowExportModal(true)}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </Button>
          )}
          {canImport && (
            <Button variant="outline" size="sm" className="gap-2 h-9 px-2 sm:px-3 text-slate-700 hover:text-slate-900 border-slate-200" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Bulk Import</span>
            </Button>
          )}
        </>
      )}
    </div>
  ), [activeTab, canExport, canImport, deployedItems.length, filteredDeployedItems.length, filteredMovements.length]);

  useSetPageTitle(
    activeTab === 'deployed'
      ? 'Deployed Assets (On-Site)'
      : activeTab === 'ledger'
      ? 'Stock Movements Ledger'
      : 'Inventory',
    activeTab === 'deployed'
      ? 'Live consolidated registry of all dispatched equipment, tools, and materials currently unreturned across client sites'
      : activeTab === 'ledger'
      ? 'Immutable audit history of all stock additions, waybill dispatches, returns, and burns'
      : 'Track equipment, tools, and consumables across all sites',
    headerButtons,
    [activeTab, canExport, canImport, deployedItems.length, filteredDeployedItems.length]
  );

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openModal = (asset: Asset, modal: ActionModal) => {
    if (modal === 'edit') { setEditingAsset(asset); return; }
    if (modal === 'movements') {
      setActiveTab('ledger');
      setLedgerSearch(asset.name);
      return;
    }
    setActiveAsset(asset);
    setActiveModal(modal);
  };

  const closeModal = () => { setActiveAsset(null); setActiveModal(null); };

  // Filtered Assets for Catalog
  const filtered = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    const base = assets.filter(a => {
      const matchSearch = !term || a.name.toLowerCase().includes(term);
      const matchFilter = filter === 'all' || a.category === filter;
      return matchSearch && matchFilter;
    });
    if (!sortKey) return base;
    return [...base].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortKey === 'name') { aVal = a.name; bVal = b.name; }
      else if (sortKey === 'quantity') { aVal = a.quantity; bVal = b.quantity; }
      else if (sortKey === 'reserved') { aVal = a.reservedQuantity || 0; bVal = b.reservedQuantity || 0; }
      else if (sortKey === 'available') { aVal = a.availableQuantity || 0; bVal = b.availableQuantity || 0; }
      else if (sortKey === 'status') { aVal = a.availableQuantity || 0; bVal = b.availableQuantity || 0; }
      else if (sortKey === 'location') { aVal = a.location || ''; bVal = b.location || ''; }
      else return 0;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, deferredSearch, filter, sortKey, sortDir]);

  // Total Catalog Pages & Paginated Assets
  const totalCatalogPages = Math.max(1, Math.ceil(filtered.length / catalogPageSize));
  const paginatedAssets = useMemo(() => {
    return filtered.slice((catalogPage - 1) * catalogPageSize, catalogPage * catalogPageSize);
  }, [filtered, catalogPage, catalogPageSize]);



  if (returnSite) {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 w-full">
        <CreateReturnWaybill
          site={returnSite}
          onBack={() => setReturnSite(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 w-full">
      {/* ── Modals ── */}
      {(showAddForm || editingAsset) && (
        <AssetForm
          assetToEdit={editingAsset || undefined}
          onClose={() => { setShowAddForm(false); setEditingAsset(null); }}
        />
      )}
      {showRestockModal && <RestockModal onClose={() => setShowRestockModal(false)} />}
      {showExportModal && <ExportAssetsDialog onClose={() => setShowExportModal(false)} />}
      {importFile && <BulkImportAssetsDialog file={importFile} onClose={() => setImportFile(null)} />}
      {activeModal === 'description' && activeAsset && <DescriptionDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'analytics' && activeAsset && <AssetAnalyticsDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'batches' && activeAsset && <AssetBatchesDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'restock-history' && activeAsset && <RestockHistoryDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'restock' && activeAsset && <RestockModal preselectedAssetId={activeAsset.id} onClose={closeModal} />}

      <input type="file" ref={fileInputRef} onChange={handleBulkImport} className="hidden" accept=".xlsx,.xls,.csv" />

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* TAB 1: ASSETS CATALOG VIEW (CONDITIONAL MOUNT FOR INSTANT 60FPS) */}
      {/* ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'catalog' && (
        <div className="w-full flex-col flex-1 flex">
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
          {/* Toolbar */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2 ml-1 w-full justify-between sm:w-auto">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <ListFilter className="h-4 w-4" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  Assets <span className="text-slate-400 font-normal">({filtered.length})</span>
                </p>
              </div>

              {/* Mobile Sort Dropdown */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-slate-200 dark:border-slate-700 p-1">
                    <DropdownMenuItem onClick={() => toggleSort('name')} className="text-xs font-medium cursor-pointer rounded-lg mb-0.5 justify-between">
                      Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort('quantity')} className="text-xs font-medium cursor-pointer rounded-lg mb-0.5 justify-between">
                      Total Stock {sortKey === 'quantity' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort('reserved')} className="text-xs font-medium cursor-pointer rounded-lg mb-0.5 justify-between">
                      Reserved {sortKey === 'reserved' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort('available')} className="text-xs font-medium cursor-pointer rounded-lg mb-0.5 justify-between">
                      Available {sortKey === 'available' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort('location')} className="text-xs font-medium cursor-pointer rounded-lg mb-0.5 justify-between">
                      Location {sortKey === 'location' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort('status')} className="text-xs font-medium cursor-pointer rounded-lg justify-between">
                      Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative">
                <select
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg h-9 pl-3 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium capitalize cursor-pointer w-full sm:w-40"
                  value={filter}
                  onChange={e => { setFilter(e.target.value as any); setCatalogPage(1); }}
                >
                  {(['all', 'dewatering', 'waterproofing', 'tiling', 'ppe', 'office'] as const).map(opt => (
                    <option key={opt} value={opt} className="capitalize">{opt === 'all' ? 'All Categories' : opt}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search assets..."
                    className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm focus-visible:ring-blue-500/50 rounded-lg shadow-sm"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setCatalogPage(1); }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9 px-3 text-slate-700 dark:text-slate-200 hover:text-slate-900 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm whitespace-nowrap font-medium"
                  onClick={() => setShowRestockModal(true)}
                >
                  <Package className="h-4 w-4 text-slate-500" /> Restock
                </Button>
                <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-sm whitespace-nowrap" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4" /> Add Asset
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="hidden md:block overflow-auto max-h-[calc(100vh-210px)] relative border-b border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="bg-blue-700 border-b border-blue-800 text-blue-50 uppercase text-[11px] tracking-wider font-bold">
                  <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('name')}>
                    Asset Name <SortIcon col="name" />
                  </th>
                  <th className="px-2 py-3 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('quantity')}>
                    Total Stock & Packaging <SortIcon col="quantity" />
                  </th>
                  <th className="px-2 py-3 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('reserved')}>
                    Rsvd <SortIcon col="reserved" />
                  </th>
                  <th className="px-2 py-3 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('available')}>
                    Avail <SortIcon col="available" />
                  </th>
                  <th className="px-2 py-3 whitespace-nowrap text-center sticky top-0 bg-blue-700 z-20">Stats (M|D|U)</th>
                  <th className="px-2 py-3 whitespace-nowrap sticky top-0 bg-blue-700 z-20">Category/Type</th>
                  <th className="px-2 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('location')}>
                    Location <SortIcon col="location" />
                  </th>
                  <th className="px-2 py-3 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors sticky top-0 bg-blue-700 z-20" onClick={() => toggleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                  <th className="px-2 py-3 text-center sticky top-0 bg-blue-700 z-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border dark:border-slate-700">
                          <Package className="h-5 w-5 text-slate-400" />
                        </div>
                        <p>No assets found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAssets.map(asset => {
                    const dualUnit = getDualUnitBreakdown(asset.quantity, asset.unitOfMeasurement, asset.packUnit, asset.packSize);

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                        {/* Name */}
                        <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200 text-xs uppercase max-w-[170px]">
                          <span className="truncate block" title={asset.name}>{asset.name}</span>
                          {asset.hasExpiry && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                              FIFO Batches
                            </span>
                          )}
                        </td>

                        {/* Total Stock & Dual Unit */}
                        <td className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center">
                            {dualUnit.hasPackaging ? (
                              <>
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                                  {dualUnit.packs} {asset.packUnit}s {dualUnit.singles > 0 ? `+ ${dualUnit.singles} ${formatUnit(asset.unitOfMeasurement)}` : ''}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">({asset.quantity} {formatUnit(asset.unitOfMeasurement)})</span>
                              </>
                            ) : (
                              <div>
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{asset.quantity}</span>
                                <span className="text-[10px] text-slate-400 ml-1">{formatUnit(asset.unitOfMeasurement)}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Reserved */}
                        <td className="px-2 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.reservedQuantity || 0}</td>

                        {/* Available */}
                        <td className="px-2 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.availableQuantity || 0}</td>

                        {/* Stats M|D|U */}
                        <td className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-1 text-xs font-semibold">
                            <span title="Missing" className={asset.missingQuantity && asset.missingQuantity > 0 ? 'text-red-500' : 'text-slate-400'}>M: {asset.missingQuantity || 0}</span>
                            <span title="Damaged" className={asset.damagedQuantity && asset.damagedQuantity > 0 ? 'text-amber-500' : 'text-slate-400'}>D: {asset.damagedQuantity || 0}</span>
                            <span title="Used" className={asset.usedQuantity && asset.usedQuantity > 0 ? 'text-blue-500' : 'text-slate-400'}>U: {asset.usedQuantity || 0}</span>
                          </div>
                        </td>

                        {/* Category | Type */}
                        <td className="px-2 py-3">
                          <div className="flex flex-col gap-1 w-fit">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded capitalize text-center">{asset.category}</span>
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded capitalize text-center">{asset.type}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-2 py-3">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate block max-w-[80px]" title={asset.location || 'store'}>{asset.location || 'store'}</span>
                        </td>

                        {/* Status */}
                        <td className="px-2 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              'rounded-full px-2 py-0.5 font-semibold text-[10px] border whitespace-nowrap',
                              asset.availableQuantity <= 0
                                ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200'
                                : (asset.criticalStockLevel && asset.criticalStockLevel > 0 && asset.availableQuantity <= asset.criticalStockLevel)
                                  ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200'
                                  : (asset.lowStockLevel && asset.lowStockLevel > 0 && asset.availableQuantity <= asset.lowStockLevel)
                                    ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200'
                                    : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                            )}
                          >
                            {asset.availableQuantity <= 0 ? 'Out' : (asset.criticalStockLevel && asset.criticalStockLevel > 0 && asset.availableQuantity <= asset.criticalStockLevel) ? 'Critical' : (asset.lowStockLevel && asset.lowStockLevel > 0 && asset.availableQuantity <= asset.lowStockLevel) ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-3 text-center">
                          <AssetActionsMenu
                            asset={asset}
                            onAction={modal => openModal(asset, modal)}
                            onDelete={() => deleteAsset(asset.id)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Cards */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-500">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border dark:border-slate-700">
                    <Package className="h-5 w-5 text-slate-400" />
                  </div>
                  <p>No assets found.</p>
                </div>
              </div>
            ) : (
              paginatedAssets.map(asset => {
                const dualUnit = getDualUnitBreakdown(asset.quantity, asset.unitOfMeasurement, asset.packUnit, asset.packSize);

                return (
                  <div key={`mobile-${asset.id}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase">{asset.name}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full capitalize">{asset.category}</span>
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full capitalize">{asset.type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-2 py-0 text-[10px] border font-semibold whitespace-nowrap',
                            asset.availableQuantity > 100
                              ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                              : asset.availableQuantity > 0
                                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200'
                                : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200'
                          )}
                        >
                          {asset.availableQuantity > 100 ? 'In Stock' : asset.availableQuantity > 0 ? 'Critical' : 'Out of Stock'}
                        </Badge>
                        <AssetActionsMenu
                          asset={asset}
                          onAction={modal => openModal(asset, modal)}
                          onDelete={() => deleteAsset(asset.id)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm mt-1">
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Stock</span>
                        {dualUnit.hasPackaging ? (
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-xs mt-1">
                            {dualUnit.packs} {asset.packUnit}s
                          </span>
                        ) : (
                          <span className="font-bold text-blue-600 dark:text-blue-400 mt-1">{asset.quantity}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Reserved</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 mt-1">{asset.reservedQuantity || 0}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Available</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 mt-1">{asset.availableQuantity || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-xs px-1">
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1 text-slate-500"><span className="text-[10px] font-bold text-slate-400 uppercase">M:</span> <span className={asset.missingQuantity && asset.missingQuantity > 0 ? 'text-red-500 font-bold' : ''}>{asset.missingQuantity || 0}</span></span>
                        <span className="flex items-center gap-1 text-slate-500"><span className="text-[10px] font-bold text-slate-400 uppercase">D:</span> <span className={asset.damagedQuantity && asset.damagedQuantity > 0 ? 'text-amber-500 font-bold' : ''}>{asset.damagedQuantity || 0}</span></span>
                        <span className="flex items-center gap-1 text-slate-500"><span className="text-[10px] font-bold text-slate-400 uppercase">U:</span> <span className={asset.usedQuantity && asset.usedQuantity > 0 ? 'text-blue-500 font-bold' : ''}>{asset.usedQuantity || 0}</span></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Loc:</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[80px]">{asset.location || 'store'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Catalog Pagination Footer */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-medium cursor-pointer"
                  value={catalogPageSize}
                  onChange={e => { setCatalogPageSize(Number(e.target.value)); setCatalogPage(1); }}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400 ml-2">
                  Showing {Math.min((catalogPage - 1) * catalogPageSize + 1, filtered.length)} - {Math.min(catalogPage * catalogPageSize, filtered.length)} of {filtered.length} assets
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage(1)}
                  title="First Page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                  Page {catalogPage} of {totalCatalogPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={catalogPage >= totalCatalogPages}
                  onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))}
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={catalogPage >= totalCatalogPages}
                  onClick={() => setCatalogPage(totalCatalogPages)}
                  title="Last Page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )}

    {/* ─────────────────────────────────────────────────────────────── */}
    {/* TAB 2: DEPLOYED ASSETS (ON-SITE / UNRETURNED MASTER VIEW)        */}
    {/* ─────────────────────────────────────────────────────────────── */}
    {activeTab === 'deployed' && (
      <div className="w-full flex-col flex-1 flex">
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
          {/* Flat Compact Toolbar Header */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-3 sm:p-4 flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center bg-slate-50/50 dark:bg-slate-800/30">
            {/* Left: Title + Space-Conserving Flat Stat Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-1">
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-none whitespace-nowrap">
                  On-Site Assets
                </p>
              </div>

              {/* Ultra-compact Flat Metric Chips */}
              <div className="flex items-center gap-1.5 flex-wrap select-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Sites:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">{deployedMetrics.totalSites}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-400 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-600">Items:</span>
                  <span className="font-extrabold">{deployedMetrics.totalUniqueAssets}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-600">Field Units:</span>
                  <span className="font-extrabold">{deployedMetrics.totalUnits.toLocaleString()}</span>
                </div>
                {deployedMetrics.totalVal > 0 && (
                  <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-purple-600">Field Value:</span>
                    <span className="font-extrabold">₦{deployedMetrics.totalVal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search item, site, waybill, driver..."
                  className="pl-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-8 text-xs focus-visible:ring-blue-500/50 rounded-lg shadow-none"
                  value={deployedSearch}
                  onChange={e => { setDeployedSearch(e.target.value); setDeployedPage(1); }}
                />
                {deployedSearch && (
                  <button
                    onClick={() => { setDeployedSearch(''); setDeployedPage(1); }}
                    className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Site Filter */}
              <div className="relative">
                <select
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg h-8 pl-2.5 pr-7 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer max-w-[170px] truncate"
                  value={deployedSiteFilter}
                  onChange={e => { setDeployedSiteFilter(e.target.value); setDeployedPage(1); }}
                >
                  <option value="all">All Sites ({deployedItems.length})</option>
                  {deployedSitesOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg h-8 pl-2.5 pr-7 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  value={deployedCategoryFilter}
                  onChange={e => { setDeployedCategoryFilter(e.target.value as any); setDeployedPage(1); }}
                >
                  <option value="all">All Categories</option>
                  <option value="dewatering">Dewatering</option>
                  <option value="waterproofing">Waterproofing</option>
                  <option value="tiling">Tiling</option>
                  <option value="ppe">PPE</option>
                  <option value="office">Office</option>
                </select>
                <ChevronDownIcon className="absolute right-2 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDeployedViewMode('table')}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                    deployedViewMode === 'table'
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setDeployedViewMode('bySite')}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                    deployedViewMode === 'bySite'
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  By Site
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: FLAT ITEM TABLE */}
          {deployedViewMode === 'table' && (
            <div className="flex-1 flex flex-col justify-between overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50" onClick={() => { setDeployedSortKey('name'); setDeployedSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                      Asset Name & Category {deployedSortKey === 'name' ? (deployedSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50" onClick={() => { setDeployedSortKey('site'); setDeployedSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                      Current Site / Location {deployedSortKey === 'site' ? (deployedSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50" onClick={() => { setDeployedSortKey('qty'); setDeployedSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                      Qty on Site {deployedSortKey === 'qty' ? (deployedSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-2.5 px-3">
                      Origin Waybill & Driver
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50" onClick={() => { setDeployedSortKey('date'); setDeployedSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                      Dispatched {deployedSortKey === 'date' ? (deployedSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/50" onClick={() => { setDeployedSortKey('days'); setDeployedSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                      Days on Site {deployedSortKey === 'days' ? (deployedSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {paginatedDeployedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-semibold">No dispatched items found on site matching your criteria</p>
                          <p className="text-xs text-slate-400">All dispatched items may have been fully returned or none match the active filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDeployedItems.map(item => {
                      const daysWarning = item.daysOnSite > 30 
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-300'
                        : item.daysOnSite > 14
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200';

                      return (
                        <tr key={item.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Asset Name & Category */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-tight">
                                {item.assetName}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 capitalize">
                                  {item.category}
                                </span>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {item.type}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Site Name / Location */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                              <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="truncate max-w-[200px]" title={item.siteName}>{item.siteName}</span>
                            </div>
                          </td>

                          {/* Quantity on Site */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 w-fit">
                                {item.unreturnedQuantity} {item.unit}
                              </span>
                              {item.totalReturned > 0 && (
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  (Disp: {item.totalDispatched} • Ret: {item.totalReturned})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Origin Waybills & Drivers */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {item.waybillRefs.map(wbRef => (
                                  <span key={wbRef} className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {wbRef}
                                  </span>
                                ))}
                              </div>
                              {item.drivers.length > 0 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] flex items-center gap-1">
                                  <Truck className="h-2.5 w-2.5 opacity-60" />
                                  {item.drivers.join(', ')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* First Dispatched */}
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                            {item.firstDispatchDate ? new Date(item.firstDispatchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>

                          {/* Days on Site */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border", daysWarning)}>
                              <Clock className="h-3 w-3" />
                              {item.daysOnSite} {item.daysOnSite === 1 ? 'day' : 'days'}
                            </span>
                          </td>

                          {/* Action: Initiate Return */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 rounded-md"
                              onClick={() => {
                                const siteObj = sites.find(s => s.id === item.siteId || s.name.toLowerCase() === item.siteName.toLowerCase()) || { id: item.siteId, name: item.siteName } as Site;
                                setReturnSite(siteObj);
                              }}
                            >
                              <RotateCcw className="h-3 w-3" /> Return
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Table Pagination Footer */}
              {filteredDeployedItems.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-medium"
                      value={deployedPageSize}
                      onChange={e => { setDeployedPageSize(Number(e.target.value)); setDeployedPage(1); }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-slate-400 ml-2">
                      Showing {Math.min((deployedPage - 1) * deployedPageSize + 1, filteredDeployedItems.length)} - {Math.min(deployedPage * deployedPageSize, filteredDeployedItems.length)} of {filteredDeployedItems.length} items
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={deployedPage <= 1}
                      onClick={() => setDeployedPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
                      Page {deployedPage} of {totalDeployedPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={deployedPage >= totalDeployedPages}
                      onClick={() => setDeployedPage(p => Math.min(totalDeployedPages, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: GROUPED BY SITE */}
          {deployedViewMode === 'bySite' && (
            <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
              {deployedGroupedBySite.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">No sites with deployed items match the current filters.</p>
                </div>
              ) : (
                deployedGroupedBySite.map(siteGroup => (
                  <div 
                    key={siteGroup.siteId} 
                    className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                  >
                    {/* Site Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {siteGroup.siteName}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {siteGroup.items.length} distinct item{siteGroup.items.length === 1 ? '' : 's'} • {siteGroup.totalUnits} total unit{siteGroup.totalUnits === 1 ? '' : 's'} on site
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                          onClick={() => {
                            const siteObj = siteGroup.siteObj || { id: siteGroup.siteId, name: siteGroup.siteName } as Site;
                            setReturnSite(siteObj);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Create Return Waybill
                        </Button>
                      </div>
                    </div>

                    {/* Site Card Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30 dark:bg-slate-800/20">
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Unreturned Qty</th>
                            <th className="py-2 px-3">Waybill(s)</th>
                            <th className="py-2 px-3">First Sent</th>
                            <th className="py-2 px-3">Days on Site</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {siteGroup.items.map(item => (
                            <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                                {item.assetName}
                              </td>
                              <td className="py-2 px-3 capitalize text-slate-500">
                                {item.category}
                              </td>
                              <td className="py-2 px-3 font-extrabold text-blue-600 dark:text-blue-400">
                                {item.unreturnedQuantity} {item.unit}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex gap-1 flex-wrap">
                                  {item.waybillRefs.map(wb => (
                                    <span key={wb} className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800 font-bold border dark:border-slate-700">
                                      {wb}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                {item.firstDispatchDate ? new Date(item.firstDispatchDate).toLocaleDateString('en-GB') : '—'}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                  item.daysOnSite > 30 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                )}>
                                  {item.daysOnSite} days
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    )}

    {/* ─────────────────────────────────────────────────────────────── */}
    {/* TAB 3: FULL-PAGE MOVEMENTS LEDGER VIEW (FLAT MINIMALIST UI)     */}
    {/* ─────────────────────────────────────────────────────────────── */}
    {activeTab === 'ledger' && (
      <div className="w-full flex-col flex-1 flex">
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
          {/* Flat Compact Toolbar Header */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-3 sm:p-4 flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center bg-slate-50/50 dark:bg-slate-800/30">
            {/* Left: Title + Space-Conserving Flat Stat Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-1">
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <History className="h-3.5 w-3.5" />
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-none whitespace-nowrap">
                  Movements
                </p>
              </div>

              {/* Ultra-compact Flat Metric Chips (Conform directly to active search & filters) */}
              <div className="flex items-center gap-1.5 flex-wrap select-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">{filteredMovements.length}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Inbound:</span>
                  <span className="font-extrabold">+{ledgerMetrics.totalInbound.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-400 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-600">Dispatched:</span>
                  <span className="font-extrabold">-{ledgerMetrics.totalDispatched.toLocaleString()}</span>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-xs",
                  ledgerMetrics.netBalance === 0
                    ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    : ledgerMetrics.netBalance > 0
                      ? "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300"
                      : "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                )}>
                  <span className="text-[10px] uppercase font-bold opacity-75">Net Flow:</span>
                  <span className="font-extrabold">
                    {ledgerMetrics.netBalance > 0 ? `+${ledgerMetrics.netBalance.toLocaleString()}` : ledgerMetrics.netBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-600">Burn:</span>
                  <span className="font-extrabold">-{ledgerMetrics.totalBurned.toLocaleString()}</span>
                </div>
                {ledgerMetrics.totalValue > 0 && (
                  <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-purple-600">Value:</span>
                    <span className="font-extrabold">₦{ledgerMetrics.totalValue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search asset, site, batch..."
                  className="pl-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-8 text-xs focus-visible:ring-blue-500/50 rounded-lg shadow-none"
                  value={ledgerSearch}
                  onChange={e => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                />
                {ledgerSearch && (
                  <button
                    onClick={() => { setLedgerSearch(''); setLedgerPage(1); }}
                    className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Movement Type Filter */}
              <div className="relative">
                <select
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg h-8 pl-2.5 pr-7 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  value={ledgerTypeFilter}
                  onChange={e => { setLedgerTypeFilter(e.target.value); setLedgerPage(1); }}
                >
                  <option value="all">All Types</option>
                  <option value="restock">Restock (Inbound)</option>
                  <option value="waybill_dispatch">Waybill Dispatch</option>
                  <option value="waybill_return">Waybill Return</option>
                  <option value="checkout">Quick Checkout</option>
                  <option value="checkout_return">Checkout Return</option>
                  <option value="consumable_burn">Consumable Burn</option>
                  <option value="adjustment">Adjustments</option>
                  <option value="damage_writeoff">Damage Write-off</option>
                  <option value="missing_writeoff">Missing Write-off</option>
                  <option value="initial">Initial Stock</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Date Filter */}
              <div className="relative">
                <select
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg h-8 pl-2.5 pr-7 shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  value={ledgerDateFilter}
                  onChange={e => { setLedgerDateFilter(e.target.value as any); setLedgerPage(1); }}
                >
                  <option value="all">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="thisMonth">This Month</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table View — Consistent Flat Blue Header */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-700 border-b border-blue-800 text-blue-50 uppercase text-[11px] tracking-wider font-bold">
                  <th className="px-3 py-2.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Asset Name</th>
                  <th className="px-2 py-2.5 whitespace-nowrap text-center">Movement Type</th>
                  <th className="px-2 py-2.5 whitespace-nowrap text-center">Batch #</th>
                  <th className="px-2 py-2.5 whitespace-nowrap text-center">Qty Delta</th>
                  <th className="px-2 py-2.5 whitespace-nowrap text-center">Balance Flow</th>
                  <th className="px-2.5 py-2.5 whitespace-nowrap text-right">Value (₦)</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Site / Reference</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Actor & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                          <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="font-bold text-xs text-slate-700 dark:text-slate-200">No stock movements found matching your filters.</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Every restock delivery, waybill dispatch, return, quick checkout, and consumable burn is automatically tracked here in real time.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map(mov => {
                    const isPositive = mov.quantityDelta > 0;
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                        {/* Timestamp */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                            {new Date(mov.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(mov.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Asset Name */}
                        <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200 uppercase max-w-[170px] truncate text-xs" title={mov.assetName}>
                          {mov.assetName}
                        </td>

                        {/* Movement Type */}
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <MovementTypeBadge type={mov.movementType} />
                        </td>

                        {/* Batch # */}
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          {mov.batchNumber ? (
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              {mov.batchNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px]">—</span>
                          )}
                        </td>

                        {/* Qty Delta */}
                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                          <span className={cn(
                            'font-black text-xs inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md',
                            isPositive
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          )}>
                            {isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta}
                          </span>
                        </td>

                        {/* Balance Flow */}
                        <td className="px-2 py-2.5 text-center whitespace-nowrap font-medium text-slate-500 dark:text-slate-400 text-xs">
                          <span>{mov.previousQuantity}</span>
                          <span className="mx-1 text-slate-300 dark:text-slate-600">→</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">{mov.newQuantity}</strong>
                        </td>

                        {/* Total Value */}
                        <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                          {mov.totalCost !== undefined && mov.totalCost > 0 ? (
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">₦{mov.totalCost.toLocaleString()}</span>
                              {mov.unitCost !== undefined && (
                                <span className="text-[10px] text-slate-400 block font-medium">@ ₦{mov.unitCost.toFixed(2)}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Site / Ref */}
                        <td className="px-3 py-2.5 max-w-[180px]">
                          {mov.siteName && (
                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate block text-xs" title={mov.siteName}>
                              {mov.siteName}
                            </span>
                          )}
                          {mov.referenceId && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Ref: {mov.referenceId}
                            </span>
                          )}
                          {!mov.siteName && !mov.referenceId && <span className="text-slate-400">—</span>}
                        </td>

                        {/* Actor & Reason */}
                        <td className="px-3 py-2.5 max-w-[200px]">
                          {mov.actorName && (
                            <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px]">
                              {mov.actorName}
                            </span>
                          )}
                          {mov.reasonCode && (
                            <span className="text-[10.5px] text-slate-500 italic block truncate" title={mov.reasonCode}>
                              {mov.reasonCode}
                            </span>
                          )}
                          {!mov.actorName && !mov.reasonCode && <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Cards */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {filteredMovements.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <p className="font-semibold text-xs text-slate-700 dark:text-slate-200">No stock movements found.</p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Stock additions, deliveries, dispatches, checkouts, and returns are tracked here automatically.
                </p>
              </div>
            ) : (
              paginatedMovements.map(mov => {
                const isPositive = mov.quantityDelta > 0;
                return (
                  <div key={`mob-mov-${mov.id}`} className="p-3.5 flex flex-col gap-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase block">{mov.assetName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(mov.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <span className={cn(
                        'font-black text-xs px-2 py-0.5 rounded-md',
                        isPositive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      )}>
                        {isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <MovementTypeBadge type={mov.movementType} />
                      {mov.batchNumber && (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.2 rounded">
                          {mov.batchNumber}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-medium">
                        Balance: {mov.previousQuantity} → <strong className="text-slate-800 dark:text-slate-200">{mov.newQuantity}</strong>
                      </span>
                    </div>

                    {(mov.siteName || mov.referenceId || mov.reasonCode) && (
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                        {mov.siteName && <p>Site: <strong className="text-slate-800 dark:text-slate-200">{mov.siteName}</strong></p>}
                        {mov.referenceId && <p className="font-mono text-[10px]">Ref: {mov.referenceId}</p>}
                        {mov.reasonCode && <p className="italic text-[11px]">{mov.reasonCode}</p>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Flat Minimalist Pagination Footer */}
          {filteredMovements.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-2.5 sm:px-4 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 select-none">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(ledgerPage - 1) * ledgerPageSize + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(ledgerPage * ledgerPageSize, filteredMovements.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{filteredMovements.length}</strong>
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-[11px] text-slate-400">Rows:</span>
                  <select
                    value={ledgerPageSize}
                    onChange={e => { setLedgerPageSize(Number(e.target.value)); setLedgerPage(1); }}
                    className="h-6.5 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  >
                    {[10, 15, 25, 50, 100].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Page Nav Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLedgerPage(1)}
                  disabled={ledgerPage <= 1}
                  className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                  disabled={ledgerPage <= 1}
                  className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <span className="px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                  Page {ledgerPage} of {totalLedgerPages}
                </span>

                <button
                  onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                  disabled={ledgerPage >= totalLedgerPages}
                  className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setLedgerPage(totalLedgerPages)}
                  disabled={ledgerPage >= totalLedgerPages}
                  className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )}
  </div>
);
}

function FlameIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}
