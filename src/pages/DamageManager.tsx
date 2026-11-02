import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useUserStore } from '../store/userStore';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from '../contexts/PageContext';
import {
  DamageLog,
  DamageStatus,
  DamageLocationType,
  DamageItemType,
} from '../types/damage';
import { DamageStatusBadge, DamageSeverityBadge } from '../components/damages/DamageStatusBadge';
import { CreateDamageDialog } from '../components/damages/CreateDamageDialog';
import { DamageDetailDialog } from '../components/damages/DamageDetailDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NairaSign } from '../components/ui/naira-sign';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Plus,
  Download,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  MapPin,
  Calendar,
  Wrench,
  Clock,
  Trash2,
  Eye,
  Camera,
  Search,
  X,
  Filter,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';

export function DamageManager() {
  const currentUser = useUserStore((state) => state.getCurrentUser());
  const sites = useAppStore((state) => state.sites) || [];

  const canCreate = currentUser?.privileges?.opsDamages?.canCreate ?? false;
  const canDelete = currentUser?.privileges?.opsDamages?.canDelete ?? false;
  const canExport = currentUser?.privileges?.opsDamages?.canExport ?? false;

  const [damages, setDamages] = useState<DamageLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [selectedDamage, setSelectedDamage] = useState<DamageLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<DamageStatus | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<DamageLocationType | 'all'>('all');
  const [selectedItemType, setSelectedItemType] = useState<DamageItemType | 'all'>('all');

  // Fetch damages
  const fetchDamages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('damage_logs')
        .select('*')
        .order('incident_date', { ascending: false });

      if (error) throw error;

      // Enhance with site name from appStore
      const enhanced: DamageLog[] = (data || []).map((log: any) => {
        let siteName = undefined;
        if (log.site_id) {
          const site = sites.find((s) => s.id === log.site_id);
          siteName = site ? site.name : undefined;
        }
        return {
          ...log,
          site_name: siteName,
        };
      });

      setDamages(enhanced);
    } catch (err: any) {
      console.error('Failed to load damage logs:', err);
      toast.error('Failed to load damage logs');
    } finally {
      setIsLoading(false);
    }
  }, [sites]);

  useEffect(() => {
    fetchDamages();

    // Realtime channel subscription
    const channel = supabase
      .channel('damage_logs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'damage_logs' },
        () => {
          fetchDamages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDamages]);

  // Handle single item deletion
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this damage incident record?')) {
      return;
    }

    try {
      const { error } = await supabase.from('damage_logs').delete().eq('id', id);
      if (error) throw error;
      setDamages((prev) => prev.filter((d) => d.id !== id));
      toast.success('Damage log deleted');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Filtered dataset
  const filteredDamages = useMemo(() => {
    return damages.filter((log) => {
      if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;
      if (selectedLocation !== 'all' && log.location_type !== selectedLocation) return false;
      if (selectedItemType !== 'all' && log.item_type !== selectedItemType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = log.incident_number?.toLowerCase().includes(q);
        const matchesItem = log.item_name?.toLowerCase().includes(q);
        const matchesSite = log.site_name?.toLowerCase().includes(q);
        const matchesLoc = log.specific_location?.toLowerCase().includes(q);
        const matchesPerson = log.personnel_involved?.toLowerCase().includes(q);
        const matchesDesc = log.description?.toLowerCase().includes(q);

        return matchesNumber || matchesItem || matchesSite || matchesLoc || matchesPerson || matchesDesc;
      }

      return true;
    });
  }, [damages, selectedStatus, selectedLocation, selectedItemType, searchQuery]);

  // Status counts
  const counts = useMemo(() => {
    const res = {
      all: damages.length,
      reported: 0,
      under_assessment: 0,
      in_repair: 0,
      repaired: 0,
      written_off: 0,
      resolved: 0,
    };
    damages.forEach((d) => {
      if (d.status in res) {
        res[d.status as keyof typeof res]++;
      }
    });
    return res;
  }, [damages]);

  // Metrics summary
  const metrics = useMemo(() => {
    const totalEst = damages.reduce((acc, d) => acc + (Number(d.estimated_repair_cost) || 0), 0);
    const pendingReview = damages.filter((d) => d.status === 'reported' || d.status === 'under_assessment').length;
    const inRepairCount = damages.filter((d) => d.status === 'in_repair').length;

    return { totalEst, pendingReview, inRepairCount };
  }, [damages]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedStatus !== 'all' ||
    selectedLocation !== 'all' ||
    selectedItemType !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedLocation('all');
    setSelectedItemType('all');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredDamages.length === 0) {
      toast.info('No data available to export');
      return;
    }

    const headers = [
      'Incident Number',
      'Date',
      'Status',
      'Severity',
      'Location Type',
      'Location Details',
      'Item Category',
      'Item Name',
      'Reported By',
      'Personnel Involved',
      'Cause Category',
      'Estimated Cost (NGN)',
      'Actual Cost (NGN)',
      'Fault Attribution',
      'Photos Count',
      'Signed Off By',
    ];

    const rows = filteredDamages.map((d) => [
      `"${d.incident_number}"`,
      `"${new Date(d.incident_date).toLocaleDateString()}"`,
      `"${d.status}"`,
      `"${d.severity}"`,
      `"${d.location_type}"`,
      `"${d.site_name || d.specific_location || ''}"`,
      `"${d.item_type}"`,
      `"${d.item_name.replace(/"/g, '""')}"`,
      `"${d.reported_by_name || ''}"`,
      `"${d.personnel_involved || ''}"`,
      `"${d.cause_category}"`,
      d.estimated_repair_cost || 0,
      d.actual_repair_cost || 0,
      `"${d.fault_attribution}"`,
      d.photos?.length || 0,
      `"${d.signed_off_by_name || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dcel_damage_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Header buttons injected directly into the application's top navigation bar
  const headerButtons = (
    <div className="flex items-center gap-2">
      {canExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="h-8 text-xs gap-1.5 px-2.5"
          title="Export records to CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={fetchDamages}
        className="h-8 w-8 p-0 text-muted-foreground"
        title="Refresh data"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>

      {canCreate && (
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="h-8 text-xs gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Damage</span>
        </Button>
      )}
    </div>
  );

  useSetPageTitle('Damage Logs', '', headerButtons, [canCreate, canExport, isLoading, filteredDamages.length]);

  return (
    <div className="p-3 sm:p-5 flex flex-col h-[calc(100vh-3.5rem)] space-y-3 max-w-[1750px] mx-auto">
      {/* Clean Toolbar — Modeled after Daily Register */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-1 px-0.5 shrink-0">
        {/* Left: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search damages, items, sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 pr-7 text-xs bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="h-8.5 pl-8 pr-8 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="all">All Statuses ({counts.all})</option>
              <option value="reported">Reported ({counts.reported})</option>
              <option value="under_assessment">Under Assessment ({counts.under_assessment})</option>
              <option value="in_repair">In Repair ({counts.in_repair})</option>
              <option value="repaired">Repaired ({counts.repaired})</option>
              <option value="written_off">Written Off ({counts.written_off})</option>
              <option value="resolved">Resolved ({counts.resolved})</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Location Filter */}
          <div className="relative">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value as any)}
              className="h-8.5 pl-8 pr-8 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="all">All Locations</option>
              <option value="active_site">Active Site</option>
              <option value="old_site">Old Site</option>
              <option value="office">Office</option>
              <option value="warehouse">Warehouse</option>
              <option value="transit">In Transit</option>
              <option value="other">Other</option>
            </select>
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Item Category Filter */}
          <div className="relative">
            <select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value as any)}
              className="h-8.5 pl-8 pr-8 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="all">All Item Types</option>
              <option value="asset">Machinery & Plant</option>
              <option value="vehicle">Fleet Vehicles</option>
              <option value="office_fixture">Office Fixtures</option>
              <option value="tool_equipment">Tools & Equipment</option>
              <option value="property">Client Property</option>
              <option value="other">Other Items</option>
            </select>
            <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 px-2 h-8.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right: Inline Micro Metrics & View Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Micro Status Summary Pills */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm font-medium">
            <span className="flex items-center gap-1">
              <strong className="text-slate-900 dark:text-slate-100 font-bold">{damages.length}</strong> total
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              {metrics.pendingReview} pending
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">
              {metrics.inRepairCount} repair
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center">
              ₦{metrics.totalEst.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Records Workspace — Maximized Height */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0">
        {filteredDamages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No damage incidents recorded</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-0.5">
                {hasActiveFilters
                  ? 'No records match your active search filters.'
                  : 'Get started by clicking "+ Log Damage" in the top bar.'}
              </p>
            </div>
            {hasActiveFilters && (
              <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs h-8 mt-1 rounded-lg border-slate-200 dark:border-slate-700">
                Reset Filters
              </Button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* MAXIMIZED MINIMALIST TABLE VIEW (Daily Register Themed) */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">Incident #</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Date</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Damaged Item / Entity</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Location</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Severity</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Status</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Estimated Cost</th>
                  <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Photos</th>
                  <th className="py-2.5 px-3.5 text-right text-[11px] font-semibold uppercase tracking-wider border-l border-white/10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDamages.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => {
                      setSelectedDamage(log);
                      setDetailDialogOpen(true);
                    }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.incident_number}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.incident_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 max-w-[240px]">
                        {log.item_name}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                        {log.item_type.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          {log.location_type === 'active_site'
                            ? log.site_name || 'Active Site'
                            : log.location_type === 'old_site'
                            ? log.site_name || 'Old Site'
                            : log.location_type === 'office'
                            ? 'Office'
                            : log.location_type === 'warehouse'
                            ? 'Warehouse'
                            : log.location_type === 'transit'
                            ? 'In-Transit'
                            : 'Other'}
                        </span>
                      </div>
                      {log.specific_location && (
                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {log.specific_location}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <DamageSeverityBadge severity={log.severity} />
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <DamageStatusBadge status={log.status} />
                    </td>
                    <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      ₦{(log.estimated_repair_cost || 0).toLocaleString('en-NG')}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {log.photos && log.photos.length > 0 ? (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                          <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{log.photos.length}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedDamage(log);
                            setDetailDialogOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => handleDelete(log.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="flex-1 overflow-auto p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDamages.map((log) => {
                const firstPhoto = log.photos && log.photos[0]?.url;
                return (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedDamage(log);
                      setDetailDialogOpen(true);
                    }}
                    className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-2xs hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all hover:shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {firstPhoto ? (
                        <div className="h-32 w-full relative bg-slate-100 dark:bg-slate-900 overflow-hidden">
                          <img
                            src={firstPhoto}
                            alt={log.item_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2">
                            <DamageStatusBadge status={log.status} />
                          </div>
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full bg-slate-900/70 text-white text-[10px] font-semibold backdrop-blur-xs flex items-center gap-1">
                            <Camera className="w-3 h-3" />
                            <span>{log.photos?.length || 1}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                          <span className="font-bold text-xs font-mono text-slate-900 dark:text-slate-100">
                            {log.incident_number}
                          </span>
                          <DamageStatusBadge status={log.status} />
                        </div>
                      )}

                      <div className="p-3.5 space-y-2">
                        {firstPhoto && (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs font-mono text-slate-900 dark:text-slate-100">
                              {log.incident_number}
                            </span>
                            <DamageSeverityBadge severity={log.severity} />
                          </div>
                        )}

                        <div>
                          <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                            {log.item_name}
                          </h4>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {log.item_type.replace('_', ' ')}
                          </p>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          {log.description}
                        </p>

                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1 line-clamp-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                            {(log.location_type === 'active_site' || log.location_type === 'old_site')
                              ? log.site_name || log.location_type
                              : log.location_type === 'office' ? 'Office'
                              : log.location_type === 'warehouse' ? 'Warehouse'
                              : log.location_type === 'transit' ? 'In-Transit'
                              : 'Other'}
                          </span>
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{new Date(log.incident_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/70 dark:bg-slate-850/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Est. Cost</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          ₦{(log.estimated_repair_cost || 0).toLocaleString('en-NG')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDamage(log);
                            setDetailDialogOpen(true);
                          }}
                          className="h-7 text-xs px-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                        >
                          View
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(log.id, e)}
                            className="h-7 text-xs px-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateDamageDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(newLog) => {
          setDamages((prev) => [newLog, ...prev]);
        }}
      />

      <DamageDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        damage={selectedDamage}
        onUpdate={(updated) => {
          setDamages((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
          setSelectedDamage((prev) => (prev ? { ...prev, ...updated } : null));
        }}
      />
    </div>
  );
}
export default DamageManager;
