import React, { useState } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, MapPin, Building2, Search, Eye, Package, FileText,
  Info, Calendar, Phone, User, Activity, ChevronDown, ListFilter
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { SiteInventoryView } from './SiteInventoryView';

export function SiteManager() {
  const sites = useAppStore(s => s.sites);
  const pendingSites = useAppStore(s => s.pendingSites);
  const { waybills, getSiteAnalytics } = useOperations();
  const { isDark } = useTheme();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedSite, setSelectedSite] = useState<{ site: Site; q: SiteQuestionnaire | null } | null>(null);
  const [inventorySite, setInventorySite] = useState<{ site: Site; q: SiteQuestionnaire | null } | null>(null);

  const activeCount = sites.filter(s => s.status === 'Active').length;
  const totalCount = sites.length;

  useSetPageTitle(
    'Site Management',
    `${activeCount} of ${totalCount} sites currently active`
  );

  const filteredSites = sites.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.client.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === 'All') {
      matchesStatus = true;
    } else if (statusFilter === 'Inactive') {
      matchesStatus = s.status.toLowerCase() === 'inactive' || s.status.toLowerCase() === 'ended';
    } else {
      matchesStatus = s.status.toLowerCase() === statusFilter.toLowerCase();
    }

    return matchesSearch && matchesStatus;
  });

  const getSiteStats = (siteId: string) => {
    const siteWaybills = waybills.filter(w => (w.siteName ?? '').toLowerCase().includes(siteId.toLowerCase()));
    const uniqueItemsCount = new Set(siteWaybills.flatMap(w => w.items.map(i => i.assetId))).size;
    return { waybills: siteWaybills.length, items: uniqueItemsCount };
  };

  if (inventorySite) {
    return (
      <SiteInventoryView
        site={inventorySite.site}
        questionnaire={inventorySite.q}
        onBack={() => {
          setSelectedSite(inventorySite);
          setInventorySite(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Filter Bar */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Sites <span className="text-slate-400 font-normal">({filteredSites.length})</span></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
              {(['All', 'Active', 'Inactive'] as const).map(tab => (
                <button key={tab} onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === tab ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >{tab}</button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search site name or client..." className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Site Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSites.map((site) => {
          const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
          const stats = getSiteStats(site.name);
          
          return (
            <Card key={site.id} className="border-none shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 group overflow-hidden">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center group-hover:bg-teal-600 transition-all shrink-0">
                      <MapPin className="h-5 w-5 text-teal-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-teal-600 transition-colors uppercase truncate leading-tight">{site.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-400 dark:text-slate-500 text-xs">
                        <Building2 className="h-3 w-3" /> {site.client}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "font-semibold text-[11px] px-2 py-0.5",
                    site.status === 'Active'
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200"
                  )}>
                    {site.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2 mb-4">
                  {q?.phase4?.scopeOfWorkSummary || "Project assessment and technical proposal pending detailed documentation."}
                </p>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{stats.items}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{stats.waybills}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
                      onClick={(e) => { e.stopPropagation(); setSelectedSite({ site, q: q || null }); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Details Modal */}
      {selectedSite && (
        <Dialog open={!!selectedSite} onOpenChange={() => setSelectedSite(null)}>
          <DialogContent aria-describedby={undefined} className="max-w-2xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-900 animate-in zoom-in-95 duration-500">
            <DialogHeader className="p-6 sm:p-8 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white uppercase leading-tight">{selectedSite.site.name}</DialogTitle>
                  <p className="text-slate-400 font-semibold text-xs">{selectedSite.site.client}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSite(null)} className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-all">
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </DialogHeader>

            <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><Activity className="h-3 w-3" /> Services</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSite.q?.phase3?.dewateringMethods || ['Dewatering']).map((m: string) => (
                      <span key={m} className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 capitalize">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><Building2 className="h-3 w-3" /> Client</label>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedSite.site.client}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><Info className="h-3 w-3" /> Scope of Work</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-l-4 border-teal-500 pl-4 py-2 bg-teal-50/20 dark:bg-teal-900/10 rounded-r-xl">
                  {selectedSite.q?.phase4?.scopeOfWorkSummary || "Detailed proposal and engineering assessment pending."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><User className="h-3 w-3" /> Person</label>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">{selectedSite.q?.contactPersonName || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><Phone className="h-3 w-3" /> Phone</label>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">{selectedSite.q?.contactPersonPhone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2"><Calendar className="h-3 w-3" /> Created</label>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">—</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800">
              <Button 
                onClick={() => {
                  setInventorySite(selectedSite);
                  setSelectedSite(null);
                }}
                className="w-full h-11 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all gap-2"
              >
                <Package className="h-4 w-4" /> View Site Inventory
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
