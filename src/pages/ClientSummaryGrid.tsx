import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Building2, Calendar, FileText, Search, MapPin, LayoutGrid, List, ChevronRight, UserCheck, Trash2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { ClientContactsPanel } from './ClientContactsPanel';
import { toast, showConfirm } from '../components/ui/toast';
import { useUserStore } from '../store/userStore';

export function ClientSummaryGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [contactsFor, setContactsFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const canDeleteClient = !currentUser || currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin' || currentUser.privileges?.clients?.canDelete !== false || currentUser.privileges?.sites?.canDeleteClient !== false;
  
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const invoices = useAppStore(s => s.invoices);
  const commLogs = useAppStore(s => s.commLogs);
  const pendingSites = useAppStore(s => s.pendingSites);
  const clientContacts = useAppStore(s => s.clientContacts);
  const removeClient = useAppStore(s => s.removeClient);
  const deleteClientProfile = useAppStore(s => s.deleteClientProfile);
  const deleteClientContact = useAppStore(s => s.deleteClientContact);
  const deletePendingSite = useAppStore(s => s.deletePendingSite);

  const handleDeleteClient = async (clientName: string) => {
    const nameTrim = clientName.trim();
    const nameLow = nameTrim.toLowerCase();
    
    const clientSites = sites.filter(s => s.client.trim().toLowerCase() === nameLow);
    
    let confirmPrompt = `Are you sure you want to delete client "${nameTrim}"? This will remove the client record.`;
    if (clientSites.length > 0) {
      confirmPrompt = `Client "${nameTrim}" currently has ${clientSites.length} site(s) associated with it. Are you sure you want to permanently delete this client?`;
    }

    const ok = await showConfirm(confirmPrompt, {
      title: `Delete Client — ${nameTrim}`,
      confirmLabel: 'Delete Client',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!ok) return;

    removeClient(nameTrim);

    clientProfiles.forEach(p => {
      if (p.name.trim().toLowerCase() === nameLow) {
        deleteClientProfile(p.id);
      }
    });

    clientContacts.forEach(c => {
      if (c.clientName.trim().toLowerCase() === nameLow) {
        deleteClientContact(c.id);
      }
    });

    pendingSites.forEach(ps => {
      if (ps.clientName.trim().toLowerCase() === nameLow && !ps.siteId) {
        deletePendingSite(ps.id);
      }
    });

    toast.success(`Client "${nameTrim}" deleted successfully.`);
  };

  // Deduplicate profiles by normalized name (trim + lowercase).
  // Prefer the profile with the most complete data (has TIN or startDate).
  // This guards against DB having two rows for the same client (e.g. one old
  // entry without TIN and a newer one created via the full profile form).
  const deduplicatedProfiles = useMemo(() => {
    const seen = new Map<string, any>();
    clientProfiles.forEach(c => {
      const key = c.name.trim().toLowerCase();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { ...c, name: c.name.trim() });
      } else {
        // Prefer profile that has TIN or startDate over an empty one
        const newIsBetter = (c.tinNumber && !existing.tinNumber) || (c.startDate && !existing.startDate);
        if (newIsBetter) {
          seen.set(key, { ...c, name: c.name.trim() });
        }
      }
    });
    return Array.from(seen.values());
  }, [clientProfiles]);

  // TIN lookup: deduplicatedProfiles first, then any pending site onboarding record
  const getTinForClient = (name: string): string => {
    const key = name.trim().toLowerCase();
    const profile = deduplicatedProfiles.find(p => p.name.trim().toLowerCase() === key);
    if (profile?.tinNumber) return profile.tinNumber;
    const pending = pendingSites.find(s => s.clientName.trim().toLowerCase() === key && s.phase4?.clientTinNumber);
    return pending?.phase4?.clientTinNumber || 'Not provided';
  };

  const statsByClient = useMemo(() => {
    const stats: Record<string, { totalSites: number, activeSites: number, totalRevenue: number, id: string }> = {};
    // Use deduplicatedProfiles so two DB rows for the same client don't create two stat buckets
    deduplicatedProfiles.forEach(c => {
      stats[c.name] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: c.id };
    });

    // Normalize site client names so trailing-space variants map to the right bucket
    sites.forEach(s => {
      const clientName = s.client.trim();
      if (!stats[clientName]) {
        stats[clientName] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: clientName };
      }
      stats[clientName].totalSites++;
      if (s.status === 'Active') stats[clientName].activeSites++;
    });

    invoices.forEach(inv => {
      const clientName = inv.client.trim();
      if (!stats[clientName]) {
        stats[clientName] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: clientName };
      }
      if (inv.status === 'Paid') {
        stats[clientName].totalRevenue += (inv.totalCharge || 0);
      }
    });

    return stats;
  }, [deduplicatedProfiles, sites, invoices]);

  const allClients = useMemo(() => {
    // Merge deduplicated profiles with any site-derived clients
    const names = new Set([
      ...deduplicatedProfiles.map(p => p.name),
      ...Object.keys(statsByClient)
    ]);

    return Array.from(names)
      .filter(name => name.trim().toLowerCase() !== 'dcel') // DCEL is the company itself, exclude from Client directory
      .map(name => {
      const key = name.trim().toLowerCase();
      const profile = deduplicatedProfiles.find(p => p.name.trim().toLowerCase() === key);

      // Earliest site start date for this client (normalize site client names too)
      const clientSiteDates = sites
        .filter(s => s.client.trim().toLowerCase() === key && s.startDate)
        .map(s => s.startDate)
        .sort();
      const earliestSiteDate = clientSiteDates[0] || null;

      return {
        id: profile?.id || name,
        name,
        tinNumber: getTinForClient(name),
        startDate: earliestSiteDate || profile?.startDate || 'Unknown',
        stats: statsByClient[name] || { totalSites: 0, activeSites: 0, totalRevenue: 0 }
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [deduplicatedProfiles, statsByClient, sites, pendingSites]);

  // Removed inline detail view since clicking a client now navigates to the unified Sites page.

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tinNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------------------------
  // Master View Rendering (Grid/List)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0 w-full">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80 border-slate-200">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search clients or TIN..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center p-1 bg-slate-100 rounded-lg shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn("px-3 text-slate-500", viewMode === 'grid' && "bg-white text-indigo-600 shadow-sm")}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" /> Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn("px-3 text-slate-500", viewMode === 'list' && "bg-white text-indigo-600 shadow-sm")}
          >
            <List className="w-4 h-4 mr-1.5" /> List
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="flex-1 min-h-0 overflow-y-auto style-scroll pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(client => (
            <div 
              key={client.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-slate-300 cursor-pointer group"
              onClick={() => navigate(`/sites?client=${encodeURIComponent(client.name)}`)}
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                    {client.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <FileText className="h-4 w-4" /> 
                    TIN: <span className="font-medium text-slate-700">{client.tinNumber}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="h-4 w-4" /> 
                    Since: <span className="font-medium text-slate-700">{client.startDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {canDeleteClient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Client"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="p-2 -mr-2 -mt-2 text-slate-300 group-hover:text-indigo-500 transition-colors">
                     <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
              
              <div className="p-5 bg-slate-50/50 flex-1 flex flex-col justify-center gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm group-hover:border-indigo-100 transition-colors">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Total Sites</p>
                    <p className="text-xl font-bold text-slate-800">{client.stats.totalSites}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm group-hover:border-indigo-100 transition-colors">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-emerald-500" /> Active Sites</p>
                    <p className="text-xl font-bold text-emerald-600">{client.stats.activeSites}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-500 font-medium text-lg">No clients found.</h3>
              <p className="text-slate-400 text-sm mt-1">Try a different search term or ensure sites have been created.</p>
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
          <div className="overflow-auto style-scroll flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Client Name</th>
                  <th className="px-6 py-4 whitespace-nowrap">TIN Number</th>
                  <th className="px-6 py-4 whitespace-nowrap">Client Since</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Total Sites</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Active Sites</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-2">
                       <Building2 className="w-4 h-4 text-indigo-500" />
                       {client.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{client.tinNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{client.startDate}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-800">{client.stats.totalSites}</td>
                    <td className="px-6 py-4 text-center font-medium text-emerald-600">{client.stats.activeSites}</td>
                     <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => navigate(`/sites?client=${encodeURIComponent(client.name)}`)}>
                          View Details
                        </Button>
                        {canDeleteClient && (
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete Client" onClick={() => handleDeleteClient(client.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    {/* Client Contacts Modal */}
    {contactsFor && (
      <ClientContactsPanel
        clientName={contactsFor}
        onClose={() => setContactsFor(null)}
      />
    )}
  </div>
  );
}
