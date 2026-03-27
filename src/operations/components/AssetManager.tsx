import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Package, 
  AlertTriangle,
  ChevronRight,
  List,
  Edit2,
  Trash2,
  FileText,
  Tag, 
  AlertCircle, 
  MapPin, 
  Truck, 
  ArrowRightLeft,
  Wrench,
  Download,
  Upload,
  Circle,
  BarChart2,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Asset, AssetCategory, AssetCondition } from '../types';
import { AssetForm } from './AssetForm';
import { RestockModal } from './RestockModal';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Input } from '@/src/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"

export function AssetManager() {
  const { assets, updateAsset, deleteAsset, bulkAddAssets } = useOperations();
  const { isDark } = useTheme();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const assetsToImport = data.map((item: any) => ({
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
    <div className="flex flex-col gap-6 pb-10 px-6 mt-2 animate-in slide-in-from-bottom-2 duration-500">
      {/* Modals */}
      {(showAddForm || editingAsset) && (
        <AssetForm 
          assetToEdit={editingAsset || undefined} 
          onClose={() => {
            setShowAddForm(false);
            setEditingAsset(null);
          }} 
        />
      )}
      {showRestockModal && <RestockModal onClose={() => setShowRestockModal(false)} />}

      {/* Top Utility Bar (Reference App Style) */}
      <div className="flex items-center gap-4">
         <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold flex items-center gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Add Asset
         </Button>
         <Button 
            variant="ghost" 
            className="text-slate-600 font-bold flex items-center gap-2 hover:bg-slate-100 dark:text-slate-400"
            onClick={() => fileInputRef.current?.click()}
         >
            <Upload className="h-4 w-4" />
            Bulk Import
         </Button>
         <input 
           type="file" 
           ref={fileInputRef} 
           onChange={handleBulkImport} 
           className="hidden" 
           accept=".xlsx, .xls, .csv" 
         />
         <Button variant="ghost" className="text-slate-600 font-bold flex items-center gap-2 hover:bg-slate-100 dark:text-slate-400">
            <FileText className="h-4 w-4" />
            Export Report
         </Button>
      </div>

      {/* Title Area (Reference App Style) */}
      <div className="flex items-end justify-between">
        <div>
           <h1 className="text-3xl font-black tracking-tight text-blue-600 uppercase">Inventory</h1>
           <p className="text-slate-500 mt-1 font-medium text-sm">Equipment, tools, and consumables</p>
        </div>
        <div className="flex items-center gap-6">
           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
             {filteredAssets.length} of {assets.length} assets
           </span>
           <Button 
             className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg"
             onClick={() => setShowRestockModal(true)}
           >
             <Package className="h-4 w-4" />
             Restock
           </Button>
        </div>
      </div>

      {/* Search & Filter Bar (Reference App Style) */}
      <Card className="shadow-none border border-slate-100 bg-white dark:bg-slate-900 border-0 p-4">
         <div className="flex flex-col md:flex-row items-center gap-4 w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets..." 
                className="pl-10 bg-slate-50/50 border-transparent dark:bg-slate-950 w-full focus-visible:ring-blue-500 font-medium text-sm h-11 rounded-xl"
              />
            </div>
            
            <div className="flex items-center gap-3">
               {[
                 { label: 'All Categories', options: ['dewatering', 'waterproofing', 'tiling', 'ppe'] },
                 { label: 'All Types', options: ['consumable', 'non-consumable', 'tools', 'equipment'] },
                 { label: 'All Status', options: ['active', 'archived'] },
               ].map((group) => (
                 <div key={group.label} className="bg-slate-50/50 dark:bg-slate-950 rounded-xl px-4 h-11 flex items-center justify-between min-w-[160px] cursor-pointer hover:bg-slate-100 transition-colors border border-transparent">
                    <span className="text-sm font-bold text-slate-500">{group.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 rotate-90" />
                 </div>
               ))}
               <Button variant="ghost" className="h-11 px-4 bg-slate-50/50 rounded-xl border-0 font-bold text-slate-600 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  More
               </Button>
            </div>
         </div>
      </Card>

      {/* Table (Reference App Style) */}
      <div className="rounded-xl border border-slate-100/60 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/40 hover:bg-slate-50/40 border-b-slate-100">
              <TableHead className="w-12 h-14 pl-6 text-center">
                 <Circle className="h-4 w-4 text-blue-500" />
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14">
                 <div className="flex items-center gap-1">Asset Name <ChevronRight className="h-3 w-3 rotate-180" /></div>
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 text-center">Total Stock</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 text-center">Reserved</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 text-center">Available</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 whitespace-nowrap px-4">Stats (M | D | U)</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 px-4">Category | Type</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14">Location</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 text-center">Stock Status</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 h-14 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.map((asset) => (
              <TableRow key={asset.id} className="hover:bg-slate-50/50 border-b-slate-50 h-20">
                <TableCell className="pl-6 text-center">
                   <Circle className="h-4 w-4 text-blue-200" />
                </TableCell>
                <TableCell>
                  <span className="font-bold text-slate-900 text-sm">{asset.name}</span>
                </TableCell>
                <TableCell className="text-center">
                   <span className="font-black text-blue-600 text-sm whitespace-nowrap">
                     {asset.quantity} {asset.unitOfMeasurement}
                   </span>
                </TableCell>
                <TableCell className="text-center font-bold text-slate-700 text-sm">
                   {asset.reservedQuantity || 0}
                </TableCell>
                <TableCell className="text-center font-bold text-slate-700 text-sm">
                   {asset.availableQuantity || 0}
                </TableCell>
                <TableCell className="px-4">
                   <div className="flex flex-col text-[10px] leading-tight select-none">
                      <div className="flex items-center justify-between gap-4">
                         <span className="text-slate-400 font-bold uppercase">Missing:</span>
                         <span className={cn("font-black", asset.missingQuantity > 0 ? "text-red-500" : "text-slate-400")}>{asset.missingQuantity || 0}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                         <span className="text-slate-400 font-bold uppercase">Damaged:</span>
                         <span className={cn("font-black", asset.damagedQuantity > 0 ? "text-amber-500" : "text-slate-400")}>{asset.damagedQuantity || 0}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                         <span className="text-slate-400 font-bold uppercase">Used:</span>
                         <span className={cn("font-black", asset.usedQuantity > 0 ? "text-blue-500" : "text-slate-400")}>{asset.usedQuantity || 0}</span>
                      </div>
                   </div>
                </TableCell>
                <TableCell className="px-4">
                   <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-tighter w-fit px-2 border-0">{asset.category}</Badge>
                      <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-tighter w-fit px-2 border-0">{asset.type}</Badge>
                   </div>
                </TableCell>
                <TableCell>
                   <span className="text-xs font-bold text-slate-500 truncate block max-w-[100px]">{asset.location || 'store'}</span>
                </TableCell>
                <TableCell className="text-center">
                   <Badge className={cn(
                     "rounded-full px-3 py-1 font-bold text-[10px] uppercase border-0",
                     asset.availableQuantity > 100 ? "bg-green-500 text-white" : 
                     asset.availableQuantity > 0 ? "bg-amber-500 text-white" : 
                     "bg-red-500 text-white"
                   )}>
                     {asset.availableQuantity > 100 ? 'In Stock' : asset.availableQuantity > 0 ? 'Critical' : 'Out of Stock'}
                   </Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100 p-2">
                       <DropdownMenuItem 
                         className="gap-2 font-bold text-slate-600 rounded-lg p-3 cursor-pointer"
                         onClick={() => setEditingAsset(asset)}
                       >
                          <Edit2 className="h-4 w-4" />
                          Edit Form
                       </DropdownMenuItem>
                       <DropdownMenuItem className="gap-2 font-bold text-slate-600 rounded-lg p-3 cursor-pointer">
                          <FileText className="h-4 w-4" />
                          Description
                       </DropdownMenuItem>
                       <DropdownMenuItem className="gap-2 font-bold text-slate-600 rounded-lg p-3 cursor-pointer">
                          <BarChart2 className="h-4 w-4" />
                          Analytics
                       </DropdownMenuItem>
                       <DropdownMenuItem className="gap-2 font-bold text-slate-600 rounded-lg p-3 cursor-pointer">
                          <RefreshCw className="h-4 w-4" />
                          Restock History
                       </DropdownMenuItem>
                       <DropdownMenuSeparator className="my-2 bg-slate-50" />
                       <DropdownMenuItem className="gap-2 font-bold text-red-500 hover:bg-red-50 rounded-lg p-3 cursor-pointer" onClick={() => deleteAsset(asset.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                       </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
