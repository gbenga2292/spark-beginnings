import { formatDisplayDate } from '@/src/lib/dateUtils';
import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { Search, CheckCircle2, Clock, AlertCircle, Eye, FileText } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { MaintenanceAsset } from '@/src/types/operations';
import { MaintenanceAssetDetailView } from './MaintenanceAssetDetailView';
import { MaintenanceLogView } from './MaintenanceLogView';

interface MaintenanceAssetGridProps {
  category: 'machine' | 'vehicle';
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onLogAsset?: (id: string) => void;
}


export function MaintenanceAssetGrid({ category, selectedAssetId, onSelectAsset, onLogAsset }: MaintenanceAssetGridProps) {
  const { maintenanceAssets } = useOperations();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [logViewAssetId, setLogViewAssetId] = useState<string | null>(null);

  const filteredAssets = maintenanceAssets
    .filter(a => a.category === category)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(a => statusFilter === 'all' || a.status === statusFilter);

  const selectedAsset = maintenanceAssets.find(a => a.id === selectedAssetId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[11px]"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>;
      case 'due_soon':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-semibold text-[11px]"><Clock className="h-3 w-3 mr-1" /> Due Soon</Badge>;
      case 'overdue':
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-semibold text-[11px]"><AlertCircle className="h-3 w-3 mr-1" /> Overdue</Badge>;
      default: return null;
    }
  };

  const logViewAsset = maintenanceAssets.find(a => a.id === logViewAssetId);

  if (logViewAsset) {
    return (
      <MaintenanceLogView
        asset={logViewAsset}
        onBack={() => setLogViewAssetId(null)}
        onLogService={() => { setLogViewAssetId(null); onLogAsset?.(logViewAsset.id); }}
      />
    );
  }

  if (selectedAsset) {
    return (
      <MaintenanceAssetDetailView
        asset={selectedAsset}
        onBack={() => onSelectAsset(null)}
        onLogService={() => onLogAsset?.(selectedAsset.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${category}s...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-card border-border shadow-sm text-sm"
          />
        </div>
        <div className="flex bg-secondary p-1 rounded-lg">
          {['all', 'ok', 'due_soon', 'overdue'].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize',
                statusFilter === f
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssets.map((asset) => (
          <Card key={asset.id} className="rounded-xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-all group bg-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground uppercase truncate">{asset.name}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {asset.serialNumber ? `S/N: ${asset.serialNumber}` : asset.category}
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[10px] shrink-0 uppercase tracking-wider">
                  Active
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Site', value: asset.site },
                  { label: 'Pattern', value: asset.pattern },
                  { label: 'Interval', value: `${asset.serviceIntervalMonths} months` },
                  { label: 'Records', value: `${asset.totalMaintenanceRecords}` },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground mt-0.5 block">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3.5 py-2.5 mb-4 border border-border/40">
                {getStatusBadge(asset.status)}
                <span className="text-xs font-medium text-muted-foreground">
                  Next: <span className="font-semibold text-foreground">{formatDisplayDate(asset.nextServiceDate)}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => onSelectAsset(asset.id)}
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-9 font-semibold text-xs gap-1.5 border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                >
                  <Eye className="h-3.5 w-3.5" /> Details
                </Button>
                <Button
                  onClick={() => setLogViewAssetId(asset.id)}
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-9 font-semibold text-xs gap-1.5 border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
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
