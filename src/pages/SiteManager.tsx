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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const [inventorySite, setInventorySite] = useState<{ site: Site; q: SiteQuestionnaire | null } | null>(null);

  const activeCount = sites.filter(s => s.status === 'Active').length;
  const totalCount = sites.length;

  useSetPageTitle(
    inventorySite ? null : 'Site Management',
    inventorySite ? '' : `${activeCount} of ${totalCount} sites currently active`
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
    const siteWaybills = waybills.filter(w => 
      (w.siteName ?? '').toLowerCase().includes(siteId.toLowerCase()) && 
      w.status !== 'outstanding'
    );
    const uniqueItemsCount = new Set(siteWaybills.flatMap(w => w.items.map(i => i.assetId))).size;
    return { waybills: siteWaybills.length, items: uniqueItemsCount };
  };

  if (inventorySite) {
    return (
      <SiteInventoryView
        site={inventorySite.site}
        questionnaire={inventorySite.q}
        onBack={() => {
          setInventorySite(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Filter Bar */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-blue-50 dark:bg-blue-950/50 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ListFilter className="h-5 w-5" />
          </div>
          <span className="font-semibold text-foreground text-base">Sites ({totalCount})</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex bg-slate-50/80 dark:bg-secondary p-1 rounded-xl border border-border">
            {(['All', 'Active', 'Inactive'] as const).map(tab => (
              <button key={tab} onClick={() => setStatusFilter(tab)}
                className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === tab 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                }`}
              >{tab}</button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search site name or client..." 
              className="pl-9 bg-background border-border h-10 text-sm focus-visible:ring-blue-500/50 rounded-xl shadow-sm font-medium"
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* Site Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSites.map((site) => {
          const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
          const stats = getSiteStats(site.name);
          
          return (
            <Card key={site.id} className="border-border shadow-sm hover:shadow-md transition-all bg-card group overflow-hidden rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-3 items-center">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-base font-bold text-foreground uppercase truncate leading-tight" title={site.name}>{site.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 font-medium text-muted-foreground text-sm">
                        <Building2 className="h-3.5 w-3.5" /> <span className="truncate" title={site.client}>{site.client}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] uppercase font-bold shrink-0 ml-2 px-2.5 py-0.5 rounded-full border", site.status === 'Ended' ? 'text-muted-foreground border-border' : site.status === 'Active' ? 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20' : 'text-orange-500 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20')}>
                    {site.status}
                  </Badge>
                </div>

                <div className="mb-4 text-sm text-muted-foreground leading-relaxed min-h-[40px] line-clamp-2">
                  {q?.phase4?.scopeOfWorkSummary || "Project assessment and technical proposal pending detailed documentation."}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">{stats.items}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">{stats.waybills}</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                      onClick={(e) => { e.stopPropagation(); setInventorySite({ site, q: q || null }); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
