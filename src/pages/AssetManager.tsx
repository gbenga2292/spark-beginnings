import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, Search, Filter, Package, AlertTriangle, ChevronRight,
  Edit2, Trash2, FileText, AlertCircle, MapPin, Wrench,
  Download, Upload, Circle, BarChart2, RefreshCw, MoreHorizontal, ListFilter
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Asset, AssetType, AssetCategory, AssetCondition } from '../types/operations';
import { AssetForm } from './AssetForm';
import { RestockModal } from './RestockModal';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Input } from '@/src/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function AssetManager() {
  const { assets, updateAsset, deleteAsset, bulkAddAssets } = useOperations();
  const { isDark } = useTheme();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useSetPageTitle(
    'Inventory Management',
    'Track equipment, tools, and consumables across all sites',
    <div className="hidden sm:flex items-center gap-2">
      <Button 
        variant="outline" size="sm" className="gap-2 h-9"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" /> Bulk Import
      </Button>
      <Button 
        variant="outline" size="sm" className="gap-2 h-9"
        onClick={() => setShowRestockModal(true)}
      >
        <Package className="h-4 w-4" /> Restock
      </Button>
      <Button 
        size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700 text-white h-9"
        onClick={() => setShowAddForm(true)}
      >
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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws);
        const assetsToImport = rows.map((item: any) => ({
          name: item['Asset Name'] || item['Name'] || item['Asset'] || 'Unnamed Asset',
          description: item['Description'] || '',
          category: (item['Category']?.toLowerCase() || 'dewatering') as AssetCategory,
          type: (item['Type']?.toLowerCase() || 'equipment') as AssetType,
          quantity: Number(item['Quantity'] || item['Total Stock'] || 0),
          unitOfMeasurement: item['Unit'] || 'pcs',
          cost: Number(item['Cost'] || 0),
          location: item['Location'] || 'store',
          status: 'active',
          condition: 'good',
        }));
        bulkAddAssets(assetsToImport as any);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error("Bulk Import failed", error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || a.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Modals */}
      {(showAddForm || editingAsset) && (
        <AssetForm 
          assetToEdit={editingAsset || undefined} 
          onClose={() => { setShowAddForm(false); setEditingAsset(null); }} 
        />
      )}
      {showRestockModal && <RestockModal onClose={() => setShowRestockModal(false)} />}
      <input type="file" ref={fileInputRef} onChange={handleBulkImport} className="hidden" accept=".xlsx, .xls, .csv" />

      {/* Mobile Actions */}
      <div className="flex sm:hidden flex-wrap gap-2 px-1">
        <Button className="flex-1 gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Assets <span className="text-slate-400 font-normal">({filteredAssets.length})</span></p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
              {(['all', 'dewatering', 'waterproofing', 'tiling', 'ppe'] as const).map(tab => (
                <button key={tab} onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    filter === tab ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >{tab === 'all' ? 'All' : tab}</button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search assets..." className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm" 
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-700 border-b border-teal-800 text-teal-50 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4 whitespace-nowrap">Asset Name</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Total Stock</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Reserved</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Available</th>
                <th className="px-5 py-4 whitespace-nowrap">Stats (M | D | U)</th>
                <th className="px-5 py-4 whitespace-nowrap">Category | Type</th>
                <th className="px-5 py-4 whitespace-nowrap">Location</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Status</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredAssets.length === 0 ? (
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
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200 text-xs uppercase">{asset.name}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold text-teal-600 dark:text-teal-400 text-sm">{asset.quantity} {asset.unitOfMeasurement}</span>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.reservedQuantity || 0}</td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">{asset.availableQuantity || 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col text-xs leading-relaxed">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-semibold">Missing:</span>
                          <span className={cn("font-bold", asset.missingQuantity > 0 ? "text-red-500" : "text-slate-400")}>{asset.missingQuantity || 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-semibold">Damaged:</span>
                          <span className={cn("font-bold", asset.damagedQuantity > 0 ? "text-amber-500" : "text-slate-400")}>{asset.damagedQuantity || 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400 font-semibold">Used:</span>
                          <span className={cn("font-bold", asset.usedQuantity > 0 ? "text-teal-500" : "text-slate-400")}>{asset.usedQuantity || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-full capitalize w-fit">{asset.category}</span>
                        <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full capitalize w-fit">{asset.type}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate block max-w-[100px]">{asset.location || 'store'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge className={cn(
                        "rounded-full px-3 py-0.5 font-semibold text-[11px] border",
                        asset.availableQuantity > 100
                          ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200"
                          : asset.availableQuantity > 0
                          ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200"
                          : "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200"
                      )} variant="outline">
                        {asset.availableQuantity > 100 ? 'In Stock' : asset.availableQuantity > 0 ? 'Critical' : 'Out of Stock'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20" title="Edit"
                          onClick={() => setEditingAsset(asset)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" title="Delete"
                          onClick={() => deleteAsset(asset.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
