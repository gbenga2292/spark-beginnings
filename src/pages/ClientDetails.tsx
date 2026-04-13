import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from '../contexts/PageContext';
import { Users, Building2, Calendar, FileText, Search, MapPin } from 'lucide-react';
import { Input } from '../components/ui/input';

export function ClientDetails() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const invoices = useAppStore(s => s.invoices);

  useSetPageTitle(
    'Clients Summary',
    'View all clients, total sites, revenue, and details.',
    undefined,
    []
  );

  const statsByClient = useMemo(() => {
    const stats: Record<string, { totalSites: number, activeSites: number, totalRevenue: number, id: string }> = {};
    clientProfiles.forEach(c => {
      stats[c.name] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: c.id };
    });
    
    // Fallback for clients in `sites` that lack a profile
    sites.forEach(s => {
      if (!stats[s.client]) {
         stats[s.client] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: s.client };
      }
      stats[s.client].totalSites++;
      if (s.status === 'Active') stats[s.client].activeSites++;
    });

    invoices.forEach(inv => {
      if (!stats[inv.client]) {
        stats[inv.client] = { totalSites: 0, activeSites: 0, totalRevenue: 0, id: inv.client };
      }
      if (inv.status === 'Paid') {
        stats[inv.client].totalRevenue += (inv.totalCharge || 0);
      }
    });

    return stats;
  }, [clientProfiles, sites, invoices]);

  const allClients = useMemo(() => {
    // Merge actual profiles with derived clients
    const names = new Set([
      ...clientProfiles.map(p => p.name),
      ...Object.keys(statsByClient)
    ]);
    
    return Array.from(names).map(name => {
      const profile = clientProfiles.find(p => p.name === name);
      return {
        id: profile?.id || name,
        name,
        tinNumber: profile?.tinNumber || 'Pending',
        startDate: profile?.startDate || 'Unknown',
        stats: statsByClient[name] || { totalSites: 0, activeSites: 0, totalRevenue: 0 }
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [clientProfiles, statsByClient]);

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tinNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full max-w-7xl mx-auto w-full">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            type="text"
            placeholder="Search clients or TIN..." 
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-slate-300">
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
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
            </div>
            
            <div className="p-5 bg-slate-50/50 flex-1 flex flex-col justify-center gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Total Sites</p>
                  <p className="text-xl font-bold text-slate-800">{client.stats.totalSites}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
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
  );
}
