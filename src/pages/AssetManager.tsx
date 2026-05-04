import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useOperations } from '../contexts/OperationsContext';
import {
  Plus, Search, Package, Upload, ListFilter,
  Edit2, Trash2, BarChart2, Clock, FileText, MoreHorizontal,
  ChevronsUpDown, ChevronUp, ChevronDown as ChevronDownIcon,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Asset, AssetCategory } from '../types/operations';
import { AssetForm } from './AssetForm';
import { RestockModal } from './RestockModal';
import { AssetAnalyticsDialog } from './AssetAnalyticsDialog';
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
import { useSetPageTitle } from '@/src/contexts/PageContext';

/* ─────────────────────────────────────────────────────────────── */
/* Inline Description Dialog                                       */
/* ─────────────────────────────────────────────────────────────── */
function DescriptionDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
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
              <DialogTitle className="text-base font-semibold text-foreground leading-none">Description</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{asset.name}</p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Category', value: asset.category },
              { label: 'Type',     value: asset.type },
              { label: 'Location', value: asset.location || 'Not set' },
              { label: 'Condition',value: asset.condition },
              { label: 'Unit',     value: asset.unitOfMeasurement },
              { label: 'Status',   value: asset.status },
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
/* Actions Dropdown                                                */
/* ─────────────────────────────────────────────────────────────── */
type ActionModal = 'edit' | 'description' | 'analytics' | 'restock-history' | 'restock' | null;

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
      <DropdownMenuContent align="end" className="w-44 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-1">
        <DropdownMenuItem
          onClick={() => onAction('edit')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit Form
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
/* Main AssetManager                                               */
/* ─────────────────────────────────────────────────────────────── */
export function AssetManager() {
  const { assets, deleteAsset, bulkAddAssets } = useOperations();
  const [showAddForm, setShowAddForm]       = useState(false);
  const [editingAsset, setEditingAsset]     = useState<Asset | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [search, setSearch]                 = useState('');
  const [filter, setFilter]                 = useState<AssetCategory | 'all'>('all');
  const [activeAsset, setActiveAsset]       = useState<Asset | null>(null);
  const [activeModal, setActiveModal]       = useState<ActionModal>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey]               = useState<string | null>(null);
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('asc');

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

  useSetPageTitle(
    'Inventory Management',
    'Track equipment, tools, and consumables across all sites',
    <div className="hidden sm:flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => fileInputRef.current?.click()}>
        <Upload className="h-4 w-4" /> Bulk Import
      </Button>
      <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setShowRestockModal(true)}>
        <Package className="h-4 w-4" /> Restock
      </Button>
      <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9" onClick={() => setShowAddForm(true)}>
        <Plus className="h-4 w-4" /> Add Asset
      </Button>
    </div>
  );

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        const toImport = rows.map((item: any) => ({
          name: item['Asset Name'] || item['Name'] || item['Asset'] || 'Unnamed Asset',
          description: item['Description'] || '',
          category: (item['Category']?.toLowerCase() || 'dewatering') as AssetCategory,
          type: (item['Type']?.toLowerCase() || 'equipment') as any,
          quantity: Number(item['Quantity'] || 0),
          unitOfMeasurement: item['Unit'] || 'pcs',
          cost: Number(item['Cost'] || 0),
          location: item['Location'] || 'store',
          status: 'active',
          condition: 'good',
        }));
        bulkAddAssets(toImport as any);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Bulk import failed', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const openModal = (asset: Asset, modal: ActionModal) => {
    if (modal === 'edit') { setEditingAsset(asset); return; }
    setActiveAsset(asset);
    setActiveModal(modal);
  };

  const closeModal = () => { setActiveAsset(null); setActiveModal(null); };

  const filtered = useMemo(() => {
    const base = assets.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || a.category === filter;
      return matchSearch && matchFilter;
    });
    if (!sortKey) return base;
    return [...base].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortKey === 'name')      { aVal = a.name; bVal = b.name; }
      else if (sortKey === 'quantity')  { aVal = a.quantity; bVal = b.quantity; }
      else if (sortKey === 'reserved')  { aVal = a.reservedQuantity || 0; bVal = b.reservedQuantity || 0; }
      else if (sortKey === 'available') { aVal = a.availableQuantity || 0; bVal = b.availableQuantity || 0; }
      else if (sortKey === 'status')    { aVal = a.availableQuantity || 0; bVal = b.availableQuantity || 0; }
      else if (sortKey === 'location')  { aVal = a.location || ''; bVal = b.location || ''; }
      else return 0;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, search, filter, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* ── Modals ── */}
      {(showAddForm || editingAsset) && (
        <AssetForm
          assetToEdit={editingAsset || undefined}
          onClose={() => { setShowAddForm(false); setEditingAsset(null); }}
        />
      )}
      {showRestockModal && <RestockModal onClose={() => setShowRestockModal(false)} />}
      {activeModal === 'description'    && activeAsset && <DescriptionDialog    asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'analytics'      && activeAsset && <AssetAnalyticsDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'restock-history'&& activeAsset && <RestockHistoryDialog asset={activeAsset} onClose={closeModal} />}
      {activeModal === 'restock'        && activeAsset && <RestockModal preselectedAssetId={activeAsset.id} onClose={closeModal} />}

      <input type="file" ref={fileInputRef} onChange={handleBulkImport} className="hidden" accept=".xlsx,.xls,.csv" />

      {/* Mobile Actions */}
      <div className="flex sm:hidden flex-wrap gap-2 px-1">
        <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              Assets <span className="text-slate-400 font-normal">({filtered.length})</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
              {(['all', 'dewatering', 'waterproofing', 'tiling', 'ppe'] as const).map(tab => (
                <button key={tab} onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    filter === tab
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search assets..."
                className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm focus-visible:ring-blue-500/50 rounded-lg shadow-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-700 border-b border-blue-800 text-blue-50 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4 whitespace-nowrap cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('name')}>
                  Asset Name <SortIcon col="name" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('quantity')}>
                  Total Stock <SortIcon col="quantity" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('reserved')}>
                  Reserved <SortIcon col="reserved" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('available')}>
                  Available <SortIcon col="available" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap">Stats (M | D | U)</th>
                <th className="px-5 py-4 whitespace-nowrap">Category | Type</th>
                <th className="px-5 py-4 whitespace-nowrap cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('location')}>
                  Location <SortIcon col="location" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap text-center cursor-pointer select-none hover:bg-blue-600 transition-colors" onClick={() => toggleSort('status')}>
                  Status <SortIcon col="status" />
                </th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Actions</th>
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
                filtered.map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    {/* Name */}
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200 text-xs uppercase">{asset.name}</td>

                    {/* Total Stock */}
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{asset.quantity} {asset.unitOfMeasurement}</span>
                    </td>

                    {/* Reserved */}
                    <td className="px-5 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.reservedQuantity || 0}</td>

                    {/* Available */}
                    <td className="px-5 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.availableQuantity || 0}</td>

                    {/* Stats M|D|U */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col text-xs leading-relaxed">
                        {[
                          { label: 'Missing:', val: asset.missingQuantity || 0, cls: (v: number) => v > 0 ? 'text-red-500'   : 'text-slate-400' },
                          { label: 'Damaged:', val: asset.damagedQuantity || 0, cls: (v: number) => v > 0 ? 'text-amber-500' : 'text-slate-400' },
                          { label: 'Used:',    val: asset.usedQuantity    || 0, cls: (v: number) => v > 0 ? 'text-blue-500'  : 'text-slate-400' },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between gap-4">
                            <span className="text-slate-400 font-semibold">{row.label}</span>
                            <span className={cn('font-bold', row.cls(row.val))}>{row.val}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Category | Type */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full capitalize w-fit">{asset.category}</span>
                        <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full capitalize w-fit">{asset.type}</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate block max-w-[100px]">{asset.location || 'store'}</span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'rounded-full px-3 py-0.5 font-semibold text-[11px] border',
                          asset.availableQuantity > 100
                            ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                            : asset.availableQuantity > 0
                            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200'
                            : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200'
                        )}
                      >
                        {asset.availableQuantity > 100 ? 'In Stock' : asset.availableQuantity > 0 ? 'Critical' : 'Out of Stock'}
                      </Badge>
                    </td>

                    {/* Actions — sleek ... dropdown */}
                    <td className="px-5 py-4 text-center">
                      <AssetActionsMenu
                        asset={asset}
                        onAction={modal => openModal(asset, modal)}
                        onDelete={() => deleteAsset(asset.id)}
                      />
                    </td>
                  </tr>
                ))
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
            filtered.map(asset => (
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
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Total Stock</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 mt-1">{asset.quantity}</span>
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
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
