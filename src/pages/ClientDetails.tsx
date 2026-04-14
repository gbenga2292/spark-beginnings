import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useLocation } from 'react-router-dom';
import { useSetPageTitle } from '../contexts/PageContext';
import { Users, Building2, Calendar, FileText, Search, MapPin, LayoutGrid, List, ArrowLeft, Phone, Mail, MessageCircle, MessageSquare, Car, ExternalLink, ChevronRight } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

export function ClientDetails() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const location = useLocation();
  
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const invoices = useAppStore(s => s.invoices);
  const commLogs = useAppStore(s => s.commLogs);
  const pendingSites = useAppStore(s => s.pendingSites);

  // TIN lookup: clientProfiles first, then any pending site onboarding record
  const getTinForClient = (name: string): string => {
    const profile = clientProfiles.find(p => p.name === name);
    if (profile?.tinNumber) return profile.tinNumber;
    const pending = pendingSites.find(s => s.clientName === name && s.phase4?.clientTinNumber);
    return pending?.phase4?.clientTinNumber || 'Not provided';
  };

  // When a specific client is selected, change the header title.
  useSetPageTitle(
    selectedClientId ? 'Client Details' : 'Clients Summary',
    selectedClientId ? 'View client performance and external communications.' : 'View all clients, total sites, revenue, and details.',
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

      // Earliest site start date for this client
      const clientSiteDates = sites
        .filter(s => s.client === name && s.startDate)
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
  }, [clientProfiles, statsByClient, sites, pendingSites]);

  // Auto-select client when navigated from SiteOnboarding link
  useEffect(() => {
    const targetName: string | undefined = (location.state as any)?.selectClient;
    if (!targetName || !allClients.length) return;
    const match = allClients.find(c => c.name === targetName);
    if (match) setSelectedClientId(match.id);
  }, [location.state, allClients]);

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tinNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return allClients.find(c => c.id === selectedClientId) || null;
  }, [selectedClientId, allClients]);

  const clientLogs = useMemo(() => {
    if (!selectedClient) return [];
    return commLogs
      .filter(l => l.client === selectedClient.name)
      .sort((a, b) => {
        const dateA = a.date + (a.time ? `T${a.time}` : 'T00:00');
        const dateB = b.date + (b.time ? `T${b.time}` : 'T00:00');
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [commLogs, selectedClient]);

  const getChannelIcon = (ch: string) => {
    if (ch === 'Call') return <Phone className="w-4 h-4" />;
    if (ch === 'Email') return <Mail className="w-4 h-4" />;
    if (ch === 'WhatsApp') return <MessageCircle className="w-4 h-4" />;
    if (ch === 'Meeting') return <Users className="w-4 h-4" />;
    if (ch === 'SMS') return <MessageSquare className="w-4 h-4" />;
    if (ch === 'Visit') return <Car className="w-4 h-4" />;
    return <MessageSquare className="w-4 h-4" />;
  };

  // ----------------------------------------------------
  // Detail View Rendering
  // ----------------------------------------------------
  if (selectedClient) {
    return (
      <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedClientId(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            {selectedClient.name}
          </h2>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5"><FileText className="w-4 h-4" /> TIN Number</p>
            <p className="text-lg font-semibold text-slate-800">{selectedClient.tinNumber}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Client Since</p>
            <p className="text-lg font-semibold text-slate-800">{selectedClient.startDate}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> Total Sites</p>
            <p className="text-2xl font-bold text-slate-800">{selectedClient.stats.totalSites}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-500" /> Active Sites</p>
            <p className="text-2xl font-bold text-emerald-600">{selectedClient.stats.activeSites}</p>
          </div>
        </div>

        {/* Timeline of Logs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex-1">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            External Communication Logs
          </h3>
          
          {clientLogs.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">No communications logged yet.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-100 ml-4 pl-6 space-y-8 mt-4 pb-8">
              {clientLogs.map((log, idx) => {
                const isIncoming = log.direction === 'Incoming';
                const dateObj = new Date(log.date);
                return (
                  <div key={log.id || idx} className="relative">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-[35px] mt-1.5 h-4 w-4 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200",
                      isIncoming ? "bg-emerald-500" : "bg-indigo-500"
                    )} />
                    
                    <div className={cn(
                      "rounded-lg border p-4 shadow-sm",
                      isIncoming ? "bg-emerald-50/30 border-emerald-100" : "bg-indigo-50/30 border-indigo-100"
                    )}>
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-md text-white shadow-sm",
                            isIncoming ? "bg-emerald-500" : "bg-indigo-500"
                          )}>
                            {getChannelIcon(log.channel)}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {isIncoming ? 'Received from' : 'Sent to'} {log.contactPerson || 'Client / Site'}
                          </span>
                          {log.siteName && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                              {log.siteName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-100">
                          {format(dateObj, 'MMM d, yyyy')} {log.time && `• ${log.time}`}
                        </div>
                      </div>
                      
                      {log.subject && (
                        <div className="font-medium text-slate-800 text-sm mb-1">{log.subject}</div>
                      )}
                      
                      <div className="text-sm text-slate-600 leading-relaxed bg-white/60 p-3 rounded-md border border-slate-100/50 mt-2">
                        {log.notes}
                      </div>
                      
                      {log.outcome && (
                        <div className="mt-3 text-sm flex gap-2 pt-3 border-t border-slate-200/50">
                          <span className="font-medium text-slate-700">Outcome:</span>
                          <span className="text-slate-600">{log.outcome}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Master View Rendering (Grid/List)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col gap-6 h-full max-w-7xl mx-auto w-full">
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
              onClick={() => setSelectedClientId(client.id)}
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
                <div className="p-2 -mr-2 -mt-2 text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100">
                   <ChevronRight className="w-5 h-5" />
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
                      <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => setSelectedClientId(client.id)}>
                        View Details
                      </Button>
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
    </div>
  );
}
