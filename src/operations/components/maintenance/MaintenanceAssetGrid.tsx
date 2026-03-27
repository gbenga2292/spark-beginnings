import React, { useState } from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { 
  Search, 
  MapPin, 
  RefreshCw, 
  ChevronRight, 
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { MaintenanceAsset } from '../../types';

interface MaintenanceAssetGridProps {
  category: 'machine' | 'vehicle';
}

export function MaintenanceAssetGrid({ category }: MaintenanceAssetGridProps) {
  const { maintenanceAssets } = useOperations();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredAssets = maintenanceAssets
    .filter(a => a.category === category)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(a => statusFilter === 'all' || a.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-[10px] font-black uppercase"><CheckCircle2 className="h-3 w-3" /> OK</span>;
      case 'due_soon': return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-black uppercase"><Clock className="h-3 w-3" /> Due Soon</span>;
      case 'overdue': return <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[10px] font-black uppercase"><AlertCircle className="h-3 w-3" /> Overdue</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <Input 
            placeholder={`Search ${category}s...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-14 rounded-2xl bg-white border-slate-100 shadow-sm font-medium text-slate-600"
          />
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
          {['all', 'ok', 'due_soon', 'overdue'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                statusFilter === f ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredAssets.map((asset) => (
          <Card key={asset.id} className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white hover:shadow-xl transition-all border hover:border-blue-100 group">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase truncate">{asset.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{asset.id}</span>
                    {asset.serialNumber && <span>• S/N: {asset.serialNumber}</span>}
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-600 border-0 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">
                  Active
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-y-6 mb-8">
                 <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Site:</span>
                    <span className="text-sm font-black text-slate-700">{asset.site}</span>
                 </div>
                 <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pattern:</span>
                    <span className="text-sm font-black text-slate-700">{asset.pattern}</span>
                 </div>
                 <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Interval:</span>
                    <span className="text-sm font-black text-slate-700">{asset.serviceIntervalMonths} months</span>
                 </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-6 mb-8 border border-slate-50">
                 <div className="flex items-center justify-between mb-2">
                    {getStatusBadge(asset.status)}
                    <span className="text-[10px] font-bold text-slate-400">Next Service in {asset.nextServiceDate}</span>
                 </div>
                 <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Due: {new Date(asset.nextServiceDate).toLocaleDateString()}</span>
                 </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                 <span className="text-xs font-bold text-slate-400">Total Maintenance:</span>
                 <span className="text-xs font-black text-slate-900">{asset.totalMaintenanceRecords} records</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <Button variant="outline" className="rounded-xl border-slate-100 font-black text-[10px] uppercase tracking-widest text-slate-600 gap-2 h-12 shadow-sm bg-white hover:bg-slate-50">
                    <Eye className="h-4 w-4" /> View Details
                 </Button>
                 <Button variant="outline" className="rounded-xl border-slate-100 font-black text-[10px] uppercase tracking-widest text-slate-600 gap-2 h-12 shadow-sm bg-white hover:bg-slate-50">
                    <FileText className="h-4 w-4" /> Equipment Log
                 </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
