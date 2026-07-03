import { formatDisplayDate } from '@/src/lib/dateUtils';
import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { Search, CheckCircle2, Clock, AlertCircle, Eye, FileText, Zap, Warehouse, Wrench, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { MaintenanceAsset, OperationalStatus } from '@/src/types/operations';
import { MaintenanceAssetDetailView } from './MaintenanceAssetDetailView';
import { MaintenanceLogView } from './MaintenanceLogView';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';

interface MaintenanceAssetGridProps {
  category: 'machine' | 'vehicle';
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  logViewAssetId: string | null;
  onSetLogViewAssetId: (id: string | null) => void;
  onLogAsset?: (id: string) => void;
  onEditLog?: (sessionId: string) => void;
}

/* ─── Operational-status helpers ─────────────────────────────────────────── */
const OP_STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; icon: React.ReactNode; className: string; dotClass: string }
> = {
  active: {
    label: 'Active',
    icon: <Zap className="h-3 w-3" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    dotClass: 'bg-emerald-500',
  },
  idle: {
    label: 'Idle',
    icon: <Warehouse className="h-3 w-3" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    dotClass: 'bg-amber-500',
  },
  under_maintenance: {
    label: 'Under Maintenance',
    icon: <Wrench className="h-3 w-3" />,
    className: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    dotClass: 'bg-rose-500',
  },
};

const ALL_OP_STATUSES: OperationalStatus[] = ['active', 'idle', 'under_maintenance'];

/* ─── Service-status badge (ok / due_soon / overdue) ─────────────────────── */
function ServiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ok':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[11px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> OK
        </Badge>
      );
    case 'due_soon':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-semibold text-[11px]">
          <Clock className="h-3 w-3 mr-1" /> Due Soon
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-semibold text-[11px]">
          <AlertCircle className="h-3 w-3 mr-1" /> Overdue
        </Badge>
      );
    default:
      return null;
  }
}

/* ─── Clickable operational-status badge + dropdown ─────────────────────── */
function OpStatusBadge({
  asset,
  onChangeRequest,
}: {
  asset: MaintenanceAsset;
  onChangeRequest: (assetId: string, newStatus: OperationalStatus) => void;
}) {
  const current = asset.operationalStatus ?? 'active';
  const cfg = OP_STATUS_CONFIG[current];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold text-[10px] uppercase tracking-wider transition-all cursor-pointer',
            cfg.className,
          )}
          title="Click to change operational status"
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotClass)} />
          {cfg.icon}
          {cfg.label}
          <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {ALL_OP_STATUSES.filter(s => s !== current).map(s => {
          const c = OP_STATUS_CONFIG[s];
          return (
            <DropdownMenuItem
              key={s}
              className="gap-2 cursor-pointer"
              onClick={() => onChangeRequest(asset.id, s)}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', c.dotClass)} />
              {c.icon}
              <span className="font-medium">{c.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── "Log service first" confirmation modal ─────────────────────────────── */
interface ServiceLogPromptProps {
  assetName: string;
  targetStatus: OperationalStatus;
  onLogFirst: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

function ServiceLogPromptModal({ assetName, targetStatus, onLogFirst, onSkip, onCancel }: ServiceLogPromptProps) {
  const cfg = OP_STATUS_CONFIG[targetStatus];
  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full', cfg.dotClass)} />
            Change Status to "{cfg.label}"
          </DialogTitle>
          <DialogDescription className="pt-1">
            <strong>{assetName}</strong> is being taken out of{' '}
            <span className="text-rose-600 font-semibold">Under Maintenance</span>. Before it
            goes back into service, do you want to log the completed maintenance work?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Logging the service record keeps maintenance history accurate and resets the
            service interval counter.
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="order-last sm:order-first">
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={onSkip} className="border-rose-200 text-rose-600 hover:bg-rose-50">
            Skip log — just change status
          </Button>
          <Button size="sm" onClick={onLogFirst} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Log service first
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function MaintenanceAssetGrid({
  category,
  selectedAssetId,
  onSelectAsset,
  logViewAssetId,
  onSetLogViewAssetId,
  onLogAsset,
  onEditLog,
}: MaintenanceAssetGridProps) {
  const { maintenanceAssets, updateAssetOperationalStatus } = useOperations();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pending status-change that requires the service-log prompt
  const [pendingChange, setPendingChange] = useState<{
    assetId: string;
    assetName: string;
    targetStatus: OperationalStatus;
  } | null>(null);

  const filteredAssets = maintenanceAssets
    .filter(a => a.category === category)
    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(a => statusFilter === 'all' || a.status === statusFilter);

  const selectedAsset = maintenanceAssets.find(a => a.id === selectedAssetId);
  const logViewAsset = maintenanceAssets.find(a => a.id === logViewAssetId);

  /* Handle badge status-change requests */
  const handleStatusChangeRequest = (assetId: string, newStatus: OperationalStatus) => {
    const asset = maintenanceAssets.find(a => a.id === assetId);
    if (!asset) return;

    const currentStatus = asset.operationalStatus ?? 'active';

    // Switching OUT of under_maintenance → prompt for service log
    if (currentStatus === 'under_maintenance' && newStatus !== 'under_maintenance') {
      setPendingChange({ assetId, assetName: asset.name, targetStatus: newStatus });
    } else {
      updateAssetOperationalStatus(assetId, newStatus);
    }
  };

  if (logViewAsset) {
    return (
      <MaintenanceLogView
        asset={logViewAsset}
        onBack={() => onSetLogViewAssetId(null)}
        onLogService={() => { onSetLogViewAssetId(null); onLogAsset?.(logViewAsset.id); }}
      />
    );
  }

  if (selectedAsset) {
    return (
      <MaintenanceAssetDetailView
        asset={selectedAsset}
        onBack={() => onSelectAsset(null)}
        onLogService={() => onLogAsset?.(selectedAsset.id)}
        onEditService={onEditLog}
      />
    );
  }

  return (
    <>
      {/* Service log prompt modal */}
      {pendingChange && (
        <ServiceLogPromptModal
          assetName={pendingChange.assetName}
          targetStatus={pendingChange.targetStatus}
          onLogFirst={() => {
            // Open log form, then apply the status change after logging
            const { assetId, targetStatus } = pendingChange;
            setPendingChange(null);
            onLogAsset?.(assetId);
            // Status will be set after the user saves the log form — store it temporarily
            sessionStorage.setItem(`pending-op-status-${assetId}`, targetStatus);
          }}
          onSkip={() => {
            updateAssetOperationalStatus(pendingChange.assetId, pendingChange.targetStatus);
            setPendingChange(null);
          }}
          onCancel={() => setPendingChange(null)}
        />
      )}

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
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize',
                  statusFilter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                )}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map((asset) => {
            const opStatus = asset.operationalStatus ?? 'active';
            const opCfg = OP_STATUS_CONFIG[opStatus];
            return (
              <Card
                key={asset.id}
                className={cn(
                  'rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all group bg-card',
                  opStatus === 'under_maintenance'
                    ? 'border-rose-200/80'
                    : opStatus === 'idle'
                    ? 'border-amber-200/80'
                    : 'border-border/60',
                )}
              >
                {/* Coloured top stripe */}
                <div className={cn('h-0.5 w-full', opCfg.dotClass)} />

                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground uppercase truncate">{asset.name}</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {asset.serialNumber ? `S/N: ${asset.serialNumber}` : asset.category}
                      </p>
                    </div>
                    {/* Clickable operational-status badge */}
                    <OpStatusBadge asset={asset} onChangeRequest={handleStatusChangeRequest} />
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
                    <ServiceStatusBadge status={asset.status} />
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
                      onClick={() => onSetLogViewAssetId(asset.id)}
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-9 font-semibold text-xs gap-1.5 border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="h-3.5 w-3.5" /> Log
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
