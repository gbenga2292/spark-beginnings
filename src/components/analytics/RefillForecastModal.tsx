import React, { useState, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Search, Fuel, ArrowRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table';
import { cn } from '@/src/lib/utils';
import { useRefillForecast, formatLastRefilledDate, RefillForecastItem } from '@/src/hooks/useRefillForecast';

interface RefillForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSite?: (siteId: string) => void;
}

export function RefillForecastModal({ isOpen, onClose, onSelectSite }: RefillForecastModalProps) {
  const navigate = useNavigate();
  const { fleetRefillForecast } = useRefillForecast();

  const [refillForecastSearch, setRefillForecastSearch] = useState('');
  const deferredSearch = useDeferredValue(refillForecastSearch);
  const [refillForecastUrgencyFilter, setRefillForecastUrgencyFilter] = useState<'all' | 'urgent' | 'tomorrow' | 'safe'>('all');

  const activeForecastCounts = useMemo(() => {
    let dueToday = 0;
    let dueTomorrow = 0;
    let safe = 0;

    fleetRefillForecast.forEach(item => {
      if (item.urgency === 'critical' || item.urgency === 'today') {
        dueToday += 1;
      } else if (item.urgency === 'tomorrow') {
        dueTomorrow += 1;
      } else {
        safe += 1;
      }
    });

    return {
      all: fleetRefillForecast.length,
      dueToday,
      dueTomorrow,
      safe,
    };
  }, [fleetRefillForecast]);

  const displayedRefillForecast = useMemo(() => {
    if (!isOpen) return [];

    return fleetRefillForecast.filter(item => {
      // Urgency filtering
      if (refillForecastUrgencyFilter === 'urgent') {
        if (item.urgency !== 'critical' && item.urgency !== 'today') return false;
      } else if (refillForecastUrgencyFilter === 'tomorrow') {
        if (item.urgency !== 'tomorrow') return false;
      } else if (refillForecastUrgencyFilter === 'safe') {
        if (item.urgency === 'critical' || item.urgency === 'today' || item.urgency === 'tomorrow') return false;
      }

      // Search filtering
      if (deferredSearch.trim()) {
        const query = deferredSearch.toLowerCase().trim();
        const matchesMachine = item.machineName.toLowerCase().includes(query) || item.shortName.toLowerCase().includes(query);
        const matchesSite = item.siteName.toLowerCase().includes(query);
        if (!matchesMachine && !matchesSite) return false;
      }

      return true;
    });
  }, [isOpen, fleetRefillForecast, refillForecastUrgencyFilter, deferredSearch]);

  if (!isOpen) return null;

  const handleViewSite = (siteId: string) => {
    onClose();
    if (onSelectSite) {
      onSelectSite(siteId);
    } else {
      navigate(`/site-analytics?siteId=${siteId}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Next Refill Date Forecast
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          
          {/* Scope indicator */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/80 dark:border-slate-700 text-xs overflow-x-auto w-full sm:w-auto">
            <div className="px-3 py-1.5 rounded-md font-semibold text-xs bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-xs flex items-center gap-1.5 shrink-0">
              <span>All Active Sites</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200">
                {fleetRefillForecast.length}
              </span>
            </div>
          </div>

          {/* Filters: Search and Urgency Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search machine or site..."
                value={refillForecastSearch}
                onChange={e => setRefillForecastSearch(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 w-44 sm:w-56"
              />
              {refillForecastSearch && (
                <button
                  onClick={() => setRefillForecastSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Urgency Filter Pills with Count Badges */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setRefillForecastUrgencyFilter('all')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                  refillForecastUrgencyFilter === 'all'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <span>All</span>
                <span className="text-[10px] opacity-70">({activeForecastCounts.all})</span>
              </button>
              <button
                type="button"
                onClick={() => setRefillForecastUrgencyFilter('urgent')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                  refillForecastUrgencyFilter === 'urgent'
                    ? "bg-rose-500 text-white shadow-xs"
                    : "text-rose-600 dark:text-rose-400 hover:text-rose-700"
                )}
              >
                <span>🚨 Today / Overdue</span>
                <span className={cn(
                  "text-[10px] px-1 rounded-full font-bold",
                  refillForecastUrgencyFilter === 'urgent'
                    ? "bg-white/20 text-white"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                )}>
                  {activeForecastCounts.dueToday}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRefillForecastUrgencyFilter('tomorrow')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                  refillForecastUrgencyFilter === 'tomorrow'
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-amber-600 dark:text-amber-400 hover:text-amber-700"
                )}
              >
                <span>⚠️ Tomorrow</span>
                <span className={cn(
                  "text-[10px] px-1 rounded-full font-bold",
                  refillForecastUrgencyFilter === 'tomorrow'
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                )}>
                  {activeForecastCounts.dueTomorrow}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRefillForecastUrgencyFilter('safe')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                  refillForecastUrgencyFilter === 'safe'
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <span>Safe</span>
                <span className="text-[10px] opacity-70">({activeForecastCounts.safe})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Forecast Table List */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-5">
          {displayedRefillForecast.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Fuel className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                No machine refill forecasts found matching this filter.
              </p>
              {(refillForecastSearch || refillForecastUrgencyFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRefillForecastSearch('');
                    setRefillForecastUrgencyFilter('all');
                  }}
                  className="text-xs h-7 mt-1 font-semibold text-cyan-600"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto bg-white dark:bg-slate-900 shadow-xs">
              <Table className="min-w-[760px] w-full">
                <TableHeader className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
                  <TableRow className="bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Site</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Machine / Unit</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Fuel Level & Remaining</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Rated Burn</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Last Refill Date</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Estimated Next Refill</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 text-right bg-slate-100 dark:bg-slate-900">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {displayedRefillForecast.map(item => (
                    <TableRow 
                      key={`${item.siteId}-${item.machineId}`}
                      className={cn(
                        "transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
                        item.urgency === 'critical' || item.urgency === 'today' ? "bg-rose-50/25 dark:bg-rose-950/15" : ""
                      )}
                    >
                      {/* Site Column */}
                      <TableCell className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                          <span className="truncate max-w-[160px] sm:max-w-[200px]" title={item.siteName}>
                            {item.siteName}
                          </span>
                        </div>
                      </TableCell>

                      {/* Machine Column */}
                      <TableCell className="py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{item.shortName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.machineName}>
                          {item.machineName}
                        </div>
                      </TableCell>

                      {/* Fuel Level & Gauge Column */}
                      <TableCell className="py-3 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {item.estimatedRemainingLitres}L <span className="text-slate-400 font-normal">/ {item.tankCapacityLitres}L</span>
                            </span>
                            <span className={cn(
                              "font-bold text-[10px]",
                              item.fuelPercentage <= 15 
                                ? "text-rose-600 dark:text-rose-400" 
                                : item.fuelPercentage <= 35 
                                ? "text-amber-600 dark:text-amber-400" 
                                : "text-emerald-600 dark:text-emerald-400"
                            )}>
                              {item.fuelPercentage}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                item.fuelPercentage <= 15 
                                  ? "bg-rose-500" 
                                  : item.fuelPercentage <= 35 
                                  ? "bg-amber-500" 
                                  : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, Math.max(3, item.fuelPercentage))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              {item.isDipstickVerified ? '✓ Dipstick verified' : (item.lastRefillDate ? 'Refill calculated' : 'No anchor')}
                            </span>
                            <span>Runway: {item.runwayDays}d</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Benchmark Rate Column */}
                      <TableCell className="py-3 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold">{item.benchmarkBurnRate} L/day</div>
                        <div className="text-[10px] text-slate-400">Rated Benchmark</div>
                      </TableCell>

                      {/* Last Refill Date Column */}
                      <TableCell className="py-3">
                        {item.lastRefillDate ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {formatLastRefilledDate(item.lastRefillDate)}
                            </div>
                            {item.lastRefillLitres > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {item.lastRefillLitres}L refilled
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No refill recorded</span>
                        )}
                      </TableCell>

                      {/* Estimated Next Refill Date Column */}
                      <TableCell className="py-3">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.targetRefillFormatted}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 leading-tight",
                            item.urgencyBadgeClass
                          )}>
                            {item.urgencyLabel}
                          </span>
                          {item.daysUntilRefill > 0 && (
                            <span className="text-[10px] text-slate-400">
                              (-1d safety buffer)
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Action Column */}
                      <TableCell className="py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSite(item.siteId)}
                          className="h-7 text-xs px-2.5 font-semibold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 transition-all"
                          title={`Switch view to ${item.siteName}`}
                        >
                          <span>View Site</span>
                          <ArrowRight className="w-3 h-3 ml-1 text-slate-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold px-4 rounded-lg"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
