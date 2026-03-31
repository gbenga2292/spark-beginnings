import { formatDisplayDate } from '@/src/lib/dateUtils';
import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { Search, CheckCircle2, Clock, AlertCircle, Eye, FileText } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

interface MaintenanceAssetGridProps {
  category: 'machine' | 'vehicle';
}

export function MaintenanceAssetGrid({ category }: MaintenanceAssetGridProps) {
  const { maintenanceAssets } = useOperations();
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredAssets = maintenanceAssets
    .filter(a => a.category === category)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(a => statusFilter === 'all' || a.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok': return <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 font-semibold text-[11px]"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>;
      case 'due_soon': return <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 font-semibold text-[11px]"><Clock className="h-3 w-3 mr-1" /> Due Soon</Badge>;
      case 'overdue': return <Badge variant="outline" className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 font-semibold text-[11px]"><AlertCircle className="h-3 w-3 mr-1" /> Overdue</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder={`Search ${category}s...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-sm focus-visible:ring-teal-500/50" />
        </div>
        <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
          {['all', 'ok', 'due_soon', 'overdue'].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize",
                statusFilter === f
                  ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredAssets.map((asset) => (
          <Card key={asset.id} className={cn(
            "rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all group",
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-teal-600 transition-colors uppercase truncate">{asset.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                    <span>{asset.id}</span>
                    {asset.serialNumber && <span>• S/N: {asset.serialNumber}</span>}
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 font-semibold text-[11px] shrink-0">
                  Active
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-y-3 mb-4">
                {[
                  { label: 'Site', value: asset.site },
                  { label: 'Pattern', value: asset.pattern },
                  { label: 'Interval', value: `${asset.serviceIntervalMonths} months` },
                  { label: 'Records', value: `${asset.totalMaintenanceRecords}` },
                ].map((item, i) => (
                  <div key={i}>
                    <span className="text-xs font-semibold text-slate-400 block mb-0.5">{item.label}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className={cn(
                "rounded-lg p-3 mb-4 border",
                isDark ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"
              )}>
                <div className="flex items-center justify-between">
                  {getStatusBadge(asset.status)}
                  <span className="text-xs font-medium text-slate-400">
                    Next: {formatDisplayDate(asset.nextServiceDate)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-300 gap-1.5 h-9">
                  <Eye className="h-3.5 w-3.5" /> Details
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-300 gap-1.5 h-9">
                  <FileText className="h-3.5 w-3.5" /> Log
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
