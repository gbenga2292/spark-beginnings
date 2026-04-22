import { BarChart2, Cpu, Wrench, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Package, Clock, Zap, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { Asset } from '../types/operations';
import { cn } from '@/src/lib/utils';

interface AssetAnalyticsDialogProps {
  asset: Asset;
  onClose: () => void;
}

function StatCard({ label, value, sub, color = 'slate' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    slate:   'bg-muted/40 border-border text-foreground',
    blue:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    rose:    'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400',
    amber:   'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    blue:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  };
  return (
    <div className={cn('rounded-xl border p-3.5 flex flex-col gap-1', colors[color] || colors.slate)}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-xl font-black leading-none">{value}</p>
      {sub && <p className="text-[10px] font-semibold opacity-50">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function ProgressBar({ value, max, color = 'teal' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar: Record<string, string> = {
    blue:    'bg-blue-500',
    rose:    'bg-rose-500',
    amber:   'bg-amber-500',
    emerald: 'bg-emerald-500',
    blue:    'bg-blue-500',
  };
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', bar[color] || bar.teal)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── EQUIPMENT ANALYTICS ─────────────────────────────────────── */
function EquipmentAnalytics({ asset }: { asset: Asset }) {
  const total = asset.quantity;
  const available = asset.availableQuantity || 0;
  const reserved  = asset.reservedQuantity  || 0;
  const damaged   = asset.damagedQuantity   || 0;
  const missing   = asset.missingQuantity   || 0;
  const utilRate  = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
  const healthRate = total > 0 ? Math.round(((total - damaged - missing) / total) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div>
        <SectionTitle icon={<TrendingUp className="h-4 w-4" />} label="Performance Metrics" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Utilization Rate" value={`${utilRate}%`} sub="of total fleet deployed" color={utilRate > 70 ? 'rose' : utilRate > 40 ? 'amber' : 'blue'} />
          <StatCard label="Fleet Health" value={`${healthRate}%`} sub="units in good condition" color={healthRate >= 90 ? 'emerald' : healthRate >= 70 ? 'amber' : 'rose'} />
          <StatCard label="Reserved" value={reserved} sub={`${total > 0 ? Math.round((reserved/total)*100) : 0}% of total`} color="blue" />
          <StatCard label="Available Now" value={available} sub="units ready to deploy" color="blue" />
        </div>
      </div>

      {/* Stock breakdown */}
      <div>
        <SectionTitle icon={<Package className="h-4 w-4" />} label="Stock Breakdown" />
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          {[
            { label: 'Available',  val: available, max: total, color: 'blue'   },
            { label: 'Reserved',   val: reserved,  max: total, color: 'blue'   },
            { label: 'Damaged',    val: damaged,   max: total, color: 'amber'  },
            { label: 'Missing',    val: missing,   max: total, color: 'rose'   },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{row.label}</span>
                <span className="font-black text-foreground">{row.val} <span className="text-muted-foreground font-normal">/ {total}</span></span>
              </div>
              <ProgressBar value={row.val} max={total} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Equipment details */}
      <div>
        <SectionTitle icon={<Cpu className="h-4 w-4" />} label="Equipment Details" />
        <div className="grid grid-cols-2 gap-2">
          {asset.powerSource && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Power Source</p>
                <p className="text-sm font-bold text-foreground">{asset.powerSource}</p>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Location</p>
              <p className="text-sm font-bold text-foreground">{asset.location || 'Not set'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Daily Logging</p>
              <p className="text-sm font-bold text-foreground">{asset.requiresLogging ? 'Required' : 'Not Required'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Condition</p>
              <p className="text-sm font-bold text-foreground capitalize">{asset.condition}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TOOLS ANALYTICS ─────────────────────────────────────────── */
function ToolsAnalytics({ asset }: { asset: Asset }) {
  const total   = asset.quantity;
  const used    = asset.usedQuantity    || 0;
  const missing = asset.missingQuantity || 0;
  const damaged = asset.damagedQuantity || 0;
  const available = asset.availableQuantity || 0;
  const reserved  = asset.reservedQuantity  || 0;
  const lossRate   = total > 0 ? Math.round(((missing + damaged) / total) * 100) : 0;
  const checkoutRate = total > 0 ? Math.round((reserved / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div>
        <SectionTitle icon={<TrendingUp className="h-4 w-4" />} label="Usage Metrics" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Checkout Rate"  value={`${checkoutRate}%`} sub="currently checked out" color={checkoutRate > 80 ? 'rose' : 'blue'} />
          <StatCard label="Loss Rate"      value={`${lossRate}%`}     sub="missing or damaged"    color={lossRate > 10 ? 'rose' : lossRate > 5 ? 'amber' : 'emerald'} />
          <StatCard label="Times Used"     value={used}               sub="cumulative usage"       color="blue" />
          <StatCard label="Available"      value={available}           sub="in stock now"           color="blue" />
        </div>
      </div>

      {/* Checkout state breakdown */}
      <div>
        <SectionTitle icon={<Wrench className="h-4 w-4" />} label="Inventory State" />
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          {[
            { label: 'Available', val: available, max: total, color: 'blue'   },
            { label: 'Reserved',  val: reserved,  max: total, color: 'blue'   },
            { label: 'Used',      val: used,       max: total, color: 'emerald'},
            { label: 'Missing',   val: missing,    max: total, color: 'rose'   },
            { label: 'Damaged',   val: damaged,    max: total, color: 'amber'  },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{row.label}</span>
                <span className="font-black text-foreground">{row.val}</span>
              </div>
              <ProgressBar value={row.val} max={total} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Stock alert thresholds */}
      <div>
        <SectionTitle icon={<AlertTriangle className="h-4 w-4" />} label="Stock Alert Thresholds" />
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Low Stock Alert</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">{asset.lowStockLevel ?? '—'}</p>
            <p className="text-[10px] text-amber-500/70 font-semibold">units trigger</p>
          </div>
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Critical Alert</p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400">{asset.criticalStockLevel ?? '—'}</p>
            <p className="text-[10px] text-rose-500/70 font-semibold">units trigger</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── REUSABLES ANALYTICS ─────────────────────────────────────── */
function ReusablesAnalytics({ asset }: { asset: Asset }) {
  const total       = asset.quantity;
  const available   = asset.availableQuantity || 0;
  const reserved    = asset.reservedQuantity  || 0;
  const used        = asset.usedQuantity       || 0;
  const missing     = asset.missingQuantity   || 0;
  const cycleCount  = used;
  const returnRate  = (reserved + available) > 0 ? Math.round((available / (reserved + available)) * 100) : 100;
  const circulation = total > 0 ? Math.round((reserved / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Cycle KPIs */}
      <div>
        <SectionTitle icon={<RefreshCw className="h-4 w-4" />} label="Cycle Metrics" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Cycle Count"    value={cycleCount}       sub="total usage cycles"     color="blue" />
          <StatCard label="In Circulation" value={`${circulation}%`} sub="currently checked out" color={circulation > 80 ? 'amber' : 'blue'} />
          <StatCard label="Return Rate"    value={`${returnRate}%`}  sub="returned vs outstanding" color={returnRate >= 80 ? 'emerald' : returnRate >= 50 ? 'amber' : 'rose'} />
          <StatCard label="Available"      value={available}          sub="ready to issue"        color="blue" />
        </div>
      </div>

      {/* Flow breakdown */}
      <div>
        <SectionTitle icon={<Package className="h-4 w-4" />} label="Circulation Breakdown" />
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          {[
            { label: 'Available (in)',    val: available, max: total, color: 'blue'   },
            { label: 'Out / Reserved',    val: reserved,  max: total, color: 'blue'   },
            { label: 'Cycles Completed',  val: used,       max: Math.max(total, used, 1), color: 'emerald' },
            { label: 'Missing / Lost',    val: missing,   max: total, color: 'rose'   },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{row.label}</span>
                <span className="font-black text-foreground">{row.val}</span>
              </div>
              <ProgressBar value={row.val} max={row.max} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Location + condition */}
      <div>
        <SectionTitle icon={<MapPin className="h-4 w-4" />} label="Location & Condition" />
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Location</p>
            <p className="text-sm font-bold text-foreground mt-1">{asset.location || 'Not set'}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Condition</p>
            <p className={cn(
              'text-sm font-bold mt-1 capitalize',
              asset.condition === 'good' || asset.condition === 'fair' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}>{asset.condition}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 col-span-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Restock History</p>
            <p className="text-sm font-bold text-foreground">
              {asset.restockHistory?.length ?? 0} restock event(s) recorded
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CONSUMABLE ANALYTICS ────────────────────────────────────── */
function ConsumableAnalytics({ asset }: { asset: Asset }) {
  const total     = asset.quantity;
  const available = asset.availableQuantity || 0;
  const used      = asset.usedQuantity       || 0;
  const depletion = total > 0 ? Math.round((used / total) * 100) : 0;
  const latest    = asset.restockHistory?.slice(-1)[0];

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle icon={<TrendingUp className="h-4 w-4" />} label="Consumption Metrics" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Used" value={used}                sub="units consumed" color="amber" />
          <StatCard label="Remaining"  value={available}            sub="units left"     color={available < (asset.criticalStockLevel ?? 5) ? 'rose' : 'blue'} />
          <StatCard label="Depletion"  value={`${depletion}%`}      sub="of original stock" color={depletion > 80 ? 'rose' : depletion > 50 ? 'amber' : 'emerald'} />
          <StatCard label="Restocked"  value={asset.restockHistory?.length ?? 0} sub="times" color="blue" />
        </div>
      </div>

      <div>
        <SectionTitle icon={<Package className="h-4 w-4" />} label="Stock Level" />
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          {[
            { label: 'Available',   val: available, max: total, color: 'blue'  },
            { label: 'Consumed',    val: used,       max: total, color: 'amber' },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{row.label}</span>
                <span className="font-black text-foreground">{row.val}</span>
              </div>
              <ProgressBar value={row.val} max={total} color={row.color} />
            </div>
          ))}
        </div>
      </div>

      {latest && (
        <div>
          <SectionTitle icon={<Clock className="h-4 w-4" />} label="Last Restock" />
          <div className="rounded-xl border border-border bg-muted/20 p-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Qty Added</p>
              <p className="text-lg font-black text-foreground">{latest.quantity}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Cost</p>
              <p className="text-lg font-black text-foreground">₦{latest.unitCost.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</p>
              <p className="text-sm font-bold text-foreground">
                {new Date(latest.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TYPE CONFIG ─────────────────────────────────────────────── */
const typeConfig = {
  equipment:        { icon: <Cpu className="h-4 w-4 text-primary" />,      bg: 'bg-primary/10',    label: 'Equipment Analytics'  },
  tools:            { icon: <Wrench className="h-4 w-4 text-blue-600" />,   bg: 'bg-blue-500/10',   label: 'Tools Analytics'      },
  reusables:        { icon: <RefreshCw className="h-4 w-4 text-emerald-600" />, bg: 'bg-emerald-500/10', label: 'Reusables Analytics' },
  consumable:       { icon: <Package className="h-4 w-4 text-amber-600" />, bg: 'bg-amber-500/10',  label: 'Consumable Analytics' },
  'non-consumable': { icon: <Package className="h-4 w-4 text-muted-foreground" />, bg: 'bg-muted', label: 'Asset Analytics' },
};

/* ─── MAIN DIALOG ─────────────────────────────────────────────── */
export function AssetAnalyticsDialog({ asset, onClose }: AssetAnalyticsDialogProps) {
  const cfg = typeConfig[asset.type] ?? typeConfig['non-consumable'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cfg.bg)}>
              {cfg.icon}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-none">
                {cfg.label}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[230px]">{asset.name}</p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>

        {/* Body */}
        <div className="overflow-y-auto max-h-[75vh] no-scrollbar p-5">
          {asset.type === 'equipment'  && <EquipmentAnalytics  asset={asset} />}
          {asset.type === 'tools'      && <ToolsAnalytics      asset={asset} />}
          {asset.type === 'reusables'  && <ReusablesAnalytics  asset={asset} />}
          {(asset.type === 'consumable' || asset.type === 'non-consumable') && <ConsumableAnalytics asset={asset} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
