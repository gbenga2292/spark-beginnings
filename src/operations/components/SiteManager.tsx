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
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';

export function SiteManager() {
  const sites = useAppStore(s => s.sites);
  const pendingSites = useAppStore(s => s.pendingSites);
  const deleteSite = useAppStore(s => s.deleteSite);
  const { waybills, getSiteAnalytics } = useOperations();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSite, setSelectedSite] = useState<{ site: Site; q: SiteQuestionnaire | null } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredSites = sites.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSiteStats = (siteId: string) => {
    // In current logic, siteId in Waybill might be matching site name or a specific ID
    // Let's assume matching by Name for now as it's common in this app
    const siteWaybills = waybills.filter(w => w.siteName.toLowerCase().includes(siteId.toLowerCase()));
    const uniqueItemsCount = new Set(siteWaybills.flatMap(w => w.items.map(i => i.assetId))).size;
    return { waybills: siteWaybills.length, items: uniqueItemsCount };
  };

  const activeCount = sites.filter(s => s.status === 'Active').length;
  const totalCount = sites.length;

  return (
    <div className="flex flex-col gap-10 pb-20 px-8 mt-4 h-full animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-black tracking-tight text-blue-600">Site Management</h1>
          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mt-1">
            {activeCount} of {totalCount} active
          </span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-100 shadow-sm">
             <select 
               className="bg-transparent px-6 h-12 text-sm font-bold text-slate-600 outline-none appearance-none cursor-pointer"
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
             >
               <option value="all">All Sites</option>
               <option value="active">Active Only</option>
               <option value="inactive">Inactive Only</option>
             </select>
             <div className="h-12 w-12 flex items-center justify-center border-l border-slate-100">
                <ChevronDown className="h-4 w-4 text-slate-400" />
             </div>
           </div>

           <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-100 shadow-sm">
             <select 
               className="bg-transparent px-6 h-12 text-sm font-bold text-slate-600 outline-none appearance-none cursor-pointer"
             >
               <option value="az">Name A-Z</option>
               <option value="za">Name Z-A</option>
               <option value="recent">Most Recent</option>
             </select>
             <div className="h-12 w-12 flex items-center justify-center border-l border-slate-100">
                <ChevronDown className="h-4 w-4 text-slate-400" />
             </div>
           </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300" />
        <Input 
          placeholder="Search site name or client..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-16 h-16 rounded-3xl bg-white border-slate-100 shadow-lg shadow-slate-200/50 font-medium text-lg border-0 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Site Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredSites.map((site) => {
          const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
          const stats = getSiteStats(site.name);
          
          return (
            <Card key={site.id} className="rounded-[2.5rem] border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all bg-white group border hover:border-blue-100">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                   <div className="flex gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors shrink-0">
                         <MapPin className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="overflow-hidden">
                         <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase truncate">{site.name}</h3>
                         {q?.address && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase truncate">{q.address}</p>}
                         <div className="flex items-center gap-1.5 mt-1 font-bold text-blue-400 text-[10px] uppercase tracking-widest whitespace-nowrap">
                            <Building2 className="h-2.5 w-2.5" /> {site.client}
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "font-black uppercase text-[9px] tracking-widest px-3 py-1 rounded-full border-0",
                        site.status === 'Active' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-slate-100 text-slate-400"
                      )}>
                        {site.status}
                      </Badge>
                      <div className="relative">
                        <button 
                          onClick={() => setOpenMenuId(openMenuId === site.id ? null : site.id)}
                          className="h-8 w-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-all"
                        >
                           <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === site.id && (
                           <>
                           <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                           <div className="absolute top-10 right-0 z-50 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 overflow-hidden animate-in slide-in-from-top-2">
                              <button 
                                onClick={() => { setSelectedSite({ site, q: q || null }); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-4 px-6 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                              >
                                 <Eye className="h-4 w-4 text-blue-600" /> View Details
                              </button>
                              <button className="w-full flex items-center gap-4 px-6 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50">
                                 <Package className="h-4 w-4 text-slate-400" /> View Items
                              </button>
                              <button 
                                onClick={() => { deleteSite(site.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-4 px-6 py-3 text-xs font-black uppercase text-rose-500 hover:bg-rose-50"
                              >
                                 <Trash2 className="h-4 w-4 text-rose-400" /> Delete
                              </button>
                           </div>
                           </>
                        )}
                      </div>
                   </div>
                </div>

                <div className="mb-8 min-h-[4rem]">
                  <p className="text-[11px] font-bold text-slate-400 leading-relaxed line-clamp-3 italic opacity-80 group-hover:opacity-100 transition-opacity">
                    {q?.phase4?.scopeOfWorkSummary || "This project covers dewatering services and site preparation work as outlined in the initial engineering assessment and technical proposal."}
                  </p>
                </div>

                <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                       <Package className="h-4 w-4 text-slate-300" />
                       <span className="text-sm font-black text-slate-700">{stats.items}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <FileText className="h-4 w-4 text-slate-300" />
                       <span className="text-sm font-black text-slate-700">{stats.waybills}</span>
                    </div>
                    {q?.contactPersonName && (
                       <div className="hidden xl:flex items-center gap-2 border-l border-slate-100 pl-4 ml-4">
                          <span className="text-[10px] font-black uppercase text-slate-400 max-w-[60px] truncate">{q.contactPersonName}</span>
                       </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setSelectedSite({ site, q: q || null })}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:translate-x-1 transition-transform"
                  >
                    View <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Details Modal */}
      {selectedSite && (
        <Dialog open={!!selectedSite} onOpenChange={() => setSelectedSite(null)}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-0 shadow-2xl bg-white animate-in zoom-in-95 duration-500">
            <DialogHeader className="p-10 pb-4 border-b border-slate-50 bg-white sticky top-0 z-10 flex flex-row items-center justify-between">
               <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-3xl bg-blue-50 flex items-center justify-center">
                     <MapPin className="h-10 w-10 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase">{selectedSite.site.name}</h2>
                    <p className="text-slate-400 font-bold text-sm mt-1">{selectedSite.site.client}</p>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-4">
                  <Badge className="bg-blue-600 text-white border-0 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-blue-100">active</Badge>
                  <DialogClose className="h-12 w-12 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all">
                     <Plus className="h-6 w-6 rotate-45" />
                  </DialogClose>
               </div>
            </DialogHeader>

            <div className="p-10 space-y-10 max-h-[60vh] overflow-y-auto no-scrollbar">
               {/* Site Info Sections */}
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Activity className="h-3 w-3" /> Services</label>
                     <div className="flex flex-wrap gap-2">
                        {(selectedSite.q?.phase3?.dewateringMethods || ['Dewatering']).map((m: string) => (
                          <span key={m} className="bg-slate-50 text-slate-700 px-4 py-1.5 rounded-full text-xs font-black uppercase border border-slate-100">
                             {m}
                          </span>
                        ))}
                     </div>
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Building2 className="h-3 w-3" /> Client</label>
                     <p className="text-base font-black text-slate-900">{selectedSite.site.client}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Info className="h-3 w-3" /> Description</label>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed italic border-l-4 border-blue-500 pl-6 py-2 bg-blue-50/20 rounded-r-3xl">
                     {selectedSite.q?.phase4?.scopeOfWorkSummary || "The project covers jetting and installing a single-stage well-point dewatering system to reach a 3-meter excavation depth for basement construction. It involves setting up wellpoint pipes, header pipes, pumps, and discharge hoses connected to the discharge channel."}
                  </p>
               </div>

               <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><User className="h-3 w-3" /> Contact Person</label>
                     <p className="text-sm font-black text-slate-900">{selectedSite.q?.contactPersonName || 'CHIAKA'}</p>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Phone className="h-3 w-3" /> Phone</label>
                     <p className="text-sm font-black text-slate-900">{selectedSite.q?.contactPersonPhone || '08129999850'}</p>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Calendar className="h-3 w-3" /> Created</label>
                     <p className="text-sm font-black text-slate-900">18 February 2026</p>
                  </div>
               </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/10">
               <Button className="w-full h-16 rounded-3xl bg-white border-2 border-blue-600 font-black uppercase text-xs tracking-widest text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-3">
                  Edit Site
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
