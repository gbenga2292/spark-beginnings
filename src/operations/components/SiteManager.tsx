import React, { useState } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  MapPin, 
  Building2, 
  Search, 
  MoreVertical, 
  Eye, 
  Package, 
  FileText, 
  Trash2, 
  ChevronRight,
  Info,
  Calendar,
  Phone,
  User,
  Activity,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function SiteManager() {
  const sites = useAppStore(s => s.sites);
  const pendingSites = useAppStore(s => s.pendingSites);
  const deleteSite = useAppStore(s => s.deleteSite);
  const { waybills, getSiteAnalytics } = useOperations();
  const { isDark } = useTheme();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSite, setSelectedSite] = useState<{ site: Site; q: SiteQuestionnaire | null } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const activeCount = sites.filter(s => s.status === 'Active').length;
  const totalCount = sites.length;

  useSetPageTitle(
    'Site Management',
    `${activeCount} of ${totalCount} sites currently active`,
    <div className="flex items-center gap-2">
       <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-9">
         <select 
           className="bg-transparent px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 outline-none appearance-none cursor-pointer h-full"
           value={statusFilter}
           onChange={(e) => setStatusFilter(e.target.value)}
         >
           <option value="all">All Sites</option>
           <option value="active">Active Only</option>
           <option value="inactive">Inactive Only</option>
         </select>
         <div className="h-full px-2 flex items-center justify-center border-l border-slate-100 dark:border-slate-800 pointer-events-none">
            <ChevronDown className="h-3 w-3 text-slate-300" />
         </div>
       </div>
       <Button 
         size="sm" 
         variant="outline"
         className="gap-2 h-9 border-slate-200"
       >
         <Building2 className="h-4 w-4" /> New Site
       </Button>
    </div>
  );

  const filteredSites = sites.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSiteStats = (siteId: string) => {
    const siteWaybills = waybills.filter(w => w.siteName.toLowerCase().includes(siteId.toLowerCase()));
    const uniqueItemsCount = new Set(siteWaybills.flatMap(w => w.items.map(i => i.assetId))).size;
    return { waybills: siteWaybills.length, items: uniqueItemsCount };
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {/* Search Bar */}
      <Card className="shadow-sm border border-slate-100 bg-white dark:bg-slate-900 p-4">
        <div className="relative w-full max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <Input 
            placeholder="Search site name or client..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent focus-visible:ring-blue-500 font-medium text-sm"
          />
        </div>
      </Card>

      {/* Site Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSites.map((site) => {
          const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
          const stats = getSiteStats(site.name);
          
          return (
            <Card key={site.id} className="rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/20 transition-all bg-white dark:bg-slate-900 group border overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                   <div className="flex gap-3">
                      <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-600 transition-all shrink-0">
                         <MapPin className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="overflow-hidden">
                         <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase truncate leading-tight mt-1">{site.name}</h3>
                         <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-400 text-[9px] uppercase tracking-wider whitespace-nowrap">
                            <Building2 className="h-2.5 w-2.5" /> {site.client}
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "font-black uppercase text-[8px] tracking-widest px-2 py-0 border",
                        site.status === 'Active' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-400 border-slate-200"
                      )}>
                        {site.status}
                      </Badge>
                   </div>
                </div>

                <div className="mb-4 h-11">
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed line-clamp-2 italic opacity-80 group-hover:opacity-100 transition-opacity">
                    {q?.phase4?.scopeOfWorkSummary || "Project assessment and technical proposal pending detailed documentation."}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                       <Package className="h-3.5 w-3.5 text-slate-300" />
                       <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{stats.items}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <FileText className="h-3.5 w-3.5 text-slate-300" />
                       <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{stats.waybills}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                      onClick={() => setSelectedSite({ site, q: q || null })}
                    >
                       <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                      onClick={() => deleteSite(site.id)}
                    >
                       <Trash2 className="h-4 w-4" />
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
          <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] border-0 shadow-2xl bg-white dark:bg-slate-900 animate-in zoom-in-95 duration-500">
            <DialogHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-row items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                     <MapPin className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-tight">{selectedSite.site.name}</h2>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{selectedSite.site.client}</p>
                  </div>
               </div>
               <DialogClose className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-all">
                  <Plus className="h-5 w-5 rotate-45" />
               </DialogClose>
            </DialogHeader>

            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Activity className="h-3 w-3" /> Services</label>
                     <div className="flex flex-wrap gap-1.5">
                        {(selectedSite.q?.phase3?.dewateringMethods || ['Dewatering']).map((m: string) => (
                          <span key={m} className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-slate-100 dark:border-slate-800">
                             {m}
                          </span>
                        ))}
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Building2 className="h-3 w-3" /> Client</label>
                     <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedSite.site.client}</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Info className="h-3 w-3" /> Scope of Work</label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed italic border-l-4 border-blue-500 pl-4 py-2 bg-blue-50/10 dark:bg-blue-900/10 rounded-r-2xl">
                     {selectedSite.q?.phase4?.scopeOfWorkSummary || "Detailed proposal and engineering assessment pending."}
                  </p>
               </div>

               <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><User className="h-2.5 w-2.5" /> Person</label>
                     <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase">{selectedSite.q?.contactPersonName || 'CHIAKA'}</p>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Phone className="h-2.5 w-2.5" /> Phone</label>
                     <p className="text-[11px] font-bold text-slate-900 dark:text-white">{selectedSite.q?.contactPersonPhone || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Calendar className="h-2.5 w-2.5" /> Created</label>
                     <p className="text-[11px] font-bold text-slate-900 dark:text-white">18 Feb 2026</p>
                  </div>
               </div>
            </div>

            <div className="p-6 border-t border-slate-50 dark:border-slate-800">
               <Button className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">
                  Edit Site Specifications
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

