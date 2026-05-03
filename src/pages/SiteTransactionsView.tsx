import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useOperations } from '../contexts/OperationsContext';
import { Site } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine,
  Package, Truck, MoreVertical, Filter, X,
  ArrowRightLeft, ChevronRight, Search
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SiteTransactionsViewProps {
  site: Site;
  onBack: () => void;
}

type FilterType = 'all' | 'IN' | 'OUT';

export function SiteTransactionsView({ site, onBack }: SiteTransactionsViewProps) {
  const { waybills } = useOperations();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Derive transactions from waybills for this site
  const siteWaybills = useMemo(() =>
    waybills.filter(w =>
      (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
      w.status !== 'outstanding'
    ),
    [waybills, site]
  );

  const allTransactions = useMemo(() => {
    const txs: {
      id: string;
      date: string;
      type: 'IN' | 'OUT';
      asset: string;
      quantity: number;
      reference: string;
      waybillId: string;
      driverName: string;
    }[] = [];

    siteWaybills.forEach(wb => {
      wb.items.forEach((item, index) => {
        txs.push({
          id: `${wb.id}-${index}-${item.assetId}`,
          date: wb.issueDate,
          type: wb.type === 'waybill' ? 'IN' : 'OUT',
          asset: item.assetName,
          quantity: item.quantity,
          reference: `WB-${wb.id.substring(0, 6).toUpperCase()}`,
          waybillId: wb.id,
          driverName: wb.driverName || '—',
        });
      });
    });

    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [siteWaybills]);

  const filtered = useMemo(() => {
    let result = allTransactions;
    if (filterType !== 'all') result = result.filter(t => t.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.asset.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allTransactions, filterType, searchQuery]);

  const inCount = allTransactions.filter(t => t.type === 'IN').length;
  const outCount = allTransactions.filter(t => t.type === 'OUT').length;

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const activeFilters = filterType !== 'all' || searchQuery.trim() !== '';

  useSetPageTitle(
    'Transactions',
    site.name,
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-2"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </Button>

      {/* 3-dot filter menu */}
      <div className="relative" ref={menuRef}>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-8 w-8 sm:h-9 sm:w-9 relative",
            activeFilters && "border-blue-500 text-blue-600"
          )}
          onClick={() => setMenuOpen(v => !v)}
          title="Filter"
        >
          <MoreVertical className="h-4 w-4" />
          {activeFilters && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </Button>

        {menuOpen && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Filter Transactions</span>
            </div>

            <div className="p-3 space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">Type</p>
              {(['all', 'IN', 'OUT'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilterType(f); setMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                    filterType === f
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <span>{f === 'all' ? 'All Transactions' : f === 'IN' ? 'Inbound (IN)' : 'Outbound (OUT)'}</span>
                  {filterType === f && <span className="text-white/70 text-xs">✓</span>}
                </button>
              ))}

              {activeFilters && (
                <button
                  onClick={() => { setFilterType('all'); setSearchQuery(''); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors mt-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    [site.name, filterType, searchQuery, menuOpen, onBack, activeFilters]
  );

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto pb-10 mt-2">

      {/* KPI summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Movements', value: allTransactions.length, icon: ArrowRightLeft, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'Inbound', value: inCount, icon: ArrowDownToLine, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Outbound', value: outCount, icon: ArrowUpFromLine, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mb-1", kpi.bg, kpi.color)}>
              <kpi.icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{kpi.label}</p>
            <p className="text-xl font-black text-slate-800 dark:text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search asset, reference, driver..."
          className="w-full h-10 pl-10 pr-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {filterType !== 'all' && (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
              Type: {filterType}
              <button onClick={() => setFilterType('all')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              "{searchQuery}"
              <button onClick={() => setSearchQuery('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          <span className="text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <ArrowRightLeft className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium text-slate-400">No transactions found</p>
            {activeFilters && (
              <button
                onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                className="mt-3 text-xs font-bold text-blue-500 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group">
                {/* Direction icon */}
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  tx.type === 'IN'
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                )}>
                  {tx.type === 'IN'
                    ? <ArrowDownToLine className="h-4 w-4" />
                    : <ArrowUpFromLine className="h-4 w-4" />
                  }
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{tx.asset}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black px-2 py-0 h-5 shrink-0",
                        tx.type === 'IN'
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                      )}
                    >
                      {tx.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-slate-400">
                      {formatDate(tx.date)} · {formatTime(tx.date)}
                    </p>
                    <span className="text-slate-200 dark:text-slate-700">·</span>
                    <p className="text-xs text-slate-400 font-mono">{tx.reference}</p>
                    {tx.driverName && tx.driverName !== '—' && (
                      <>
                        <span className="text-slate-200 dark:text-slate-700">·</span>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {tx.driverName}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white">
                    {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                  </p>
                  <p className="text-[10px] text-slate-400">units</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
