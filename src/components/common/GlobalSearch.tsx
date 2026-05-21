import { useState, useMemo, useEffect, useRef } from 'react';
import { Building2, MapPin, CheckSquare, Circle, MessagesSquare, Receipt, Search, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';

interface Client360SearchProps {
  isDark: boolean;
  allClients: string[];
  onSelectResult: (result: any) => void;
}

export const GlobalSearch: React.FC<Client360SearchProps> = ({ isDark, allClients, onSelectResult }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const clientContacts = useAppStore(s => s.clientContacts);
  const commLogs = useAppStore(s => s.commLogs);
  const vatPayments = useAppStore(s => s.vatPayments);
  const { mainTasks, subtasks } = useAppData();

  const getClientNameById = (clientId: string) => {
    return clientProfiles.find(p => p.id === clientId)?.name || '';
  };

  const getClientNameBySiteId = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.client || '';
  };

  // Precompute client name mapping for tasks so we don't do expensive subtask filters & string matching on every single keystroke.
  const taskClientMap = useMemo(() => {
    const map = new Map<string, string>();
    mainTasks.forEach((task: any) => {
      if (task.isDeleted) return;
      if (task.clientId) {
        map.set(task.id, getClientNameById(task.clientId));
        return;
      }
      if (task.siteId) {
        map.set(task.id, getClientNameBySiteId(task.siteId));
        return;
      }
      
      const titleLow = task.title?.toLowerCase() || '';
      const descLow = task.description?.toLowerCase() || '';
      for (const clientName of allClients) {
        const cLow = clientName.toLowerCase();
        if (titleLow.includes(cLow) || descLow.includes(cLow)) {
          map.set(task.id, clientName);
          return;
        }
      }

      const taskSubs = subtasks.filter(s => s.mainTaskId === task.id);
      for (const sub of taskSubs) {
        if (sub.clientId) {
          map.set(task.id, getClientNameById(sub.clientId));
          return;
        }
        if (sub.siteId) {
          map.set(task.id, getClientNameBySiteId(sub.siteId));
          return;
        }
        const subTitleLow = sub.title?.toLowerCase() || '';
        for (const clientName of allClients) {
          if (subTitleLow.includes(clientName.toLowerCase())) {
            map.set(task.id, clientName);
            return;
          }
        }
      }
    });
    return map;
  }, [mainTasks, subtasks, clientProfiles, sites, allClients]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: any[] = [];

    // 1. Clients
    clientProfiles.forEach(p => {
      if (p.name?.toLowerCase().includes(q) || p.tinNumber?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) || p.mainContactPerson?.toLowerCase().includes(q) || p.contactPhone?.toLowerCase().includes(q)) {
        results.push({
          id: p.id,
          type: 'client',
          title: p.name,
          subtitle: p.address || 'No address details',
          secondaryInfo: p.mainContactPerson ? `Contact: ${p.mainContactPerson} (${p.contactPhone || 'No phone'})` : undefined,
          clientName: p.name,
          tab: 'overview'
        });
      }
    });

    // 2. Sites
    sites.forEach(s => {
      if (s.name?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q) || s.mainContactPerson?.toLowerCase().includes(q) || s.contactPhone?.toLowerCase().includes(q)) {
        results.push({
          id: s.id,
          type: 'site',
          title: s.name,
          subtitle: `Site for ${s.client} • ${s.address || 'No address'}`,
          secondaryInfo: s.mainContactPerson ? `Contact: ${s.mainContactPerson} (${s.contactPhone || 'No phone'})` : undefined,
          clientName: s.client,
          tab: 'operations',
          siteId: s.id,
          rawSite: s
        });
      }
    });

    // 3. Contacts
    clientContacts.forEach(c => {
      if (c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.note?.toLowerCase().includes(q) || c.position?.toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          type: 'contact',
          title: c.name,
          subtitle: `${c.position || 'Contact'} for ${c.clientName}`,
          secondaryInfo: `${c.email || 'No email'} • ${c.phone || 'No phone'}`,
          clientName: c.clientName,
          tab: 'contacts'
        });
      }
    });

    // 4. Tasks & Subtasks
    mainTasks.forEach((t: any) => {
      if (t.isDeleted) return;
      const clientName = taskClientMap.get(t.id);
      if (!clientName) return;

      if (t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          type: 'task',
          title: t.title,
          subtitle: `Task for ${clientName}`,
          secondaryInfo: t.description || undefined,
          clientName,
          tab: 'tasks'
        });
      }
    });

    subtasks.forEach((s: any) => {
      if (s.isDeleted) return;
      const mainT = mainTasks.find(t => t.id === s.mainTaskId);
      if (mainT?.isDeleted) return;

      const clientName = s.clientId ? getClientNameById(s.clientId) : (s.mainTaskId ? taskClientMap.get(s.mainTaskId) : '');
      if (!clientName) return;

      if (s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) {
        results.push({
          id: s.id,
          type: 'subtask',
          title: s.title,
          subtitle: `Subtask for ${clientName}`,
          secondaryInfo: s.description || undefined,
          clientName,
          tab: 'tasks',
          subtaskId: s.id
        });
      }
    });

    // 5. Comm Logs
    commLogs.forEach(log => {
      if (!log.client) return;

      if (log.subject?.toLowerCase().includes(q) || log.notes?.toLowerCase().includes(q) || log.contactPerson?.toLowerCase().includes(q) || log.outcome?.toLowerCase().includes(q)) {
        results.push({
          id: log.id,
          type: 'comm_log',
          title: log.subject || 'Interaction Log',
          subtitle: `Communication with ${log.client} (${log.channel})`,
          secondaryInfo: log.notes || undefined,
          clientName: log.client,
          tab: 'activity',
          commLogId: log.id
        });
      }
    });

    // 6. VAT Deficit / Overview search
    if (q.includes('vat')) {
      const queryWithoutVat = q.replace('vat', '').trim();
      allClients.forEach(clientName => {
        if (!queryWithoutVat || clientName.toLowerCase().includes(queryWithoutVat)) {
          results.push({
            id: `vat-${clientName}`,
            type: 'vat',
            title: `VAT Deficit & Overview - ${clientName}`,
            subtitle: `View generated vs paid VAT status and deficits for ${clientName}`,
            clientName,
            tab: 'overview'
          });
        }
      });
    }

    // 7. VAT payments matching
    vatPayments.forEach((vp: any) => {
      if (!vp.client) return;
      const amountStr = vp.amount?.toString() || '';
      const notesLow = vp.notes?.toLowerCase() || '';
      const clientLow = vp.client.toLowerCase();
      
      if (amountStr.includes(q) || notesLow.includes(q) || clientLow.includes(q)) {
        if (q.length > 2 && (amountStr.includes(q) || notesLow.includes(q) || (q.includes('vat') && (() => {
            let stripped = q.replace(/\bvat\b/g, '').replace(/\bdue\b/g, '').replace(/\bfor\b/g, '').replace(/\bof\b/g, '').replace(/\bon\b/g, '').replace(/\bis\b/g, '').replace(/\bthe\b/g, '').replace(/\bclient\b/g, '').replace(/\s+/g, ' ').trim();
            return !stripped || clientLow.includes(stripped) || stripped.includes(clientLow);
          })()))) {
          results.push({
            id: vp.id,
            type: 'vat_payment',
            title: `VAT Payment: ₦${vp.amount?.toLocaleString()} - ${vp.client}`,
            subtitle: `Period: ${vp.month} ${vp.year} • Notes: ${vp.notes || 'None'}`,
            clientName: vp.client,
            tab: 'overview'
          });
        }
      }
    });

    return results.slice(0, 25);
  }, [searchQuery, clientProfiles, sites, clientContacts, mainTasks, subtasks, commLogs, vatPayments, taskClientMap, allClients]);

  const handleSelectResult = (result: any) => {
    setSearchFocused(false);
    searchInputRef.current?.blur();
    setSearchQuery('');
    onSelectResult(result);
  };

  // Keyboard shortcut listener to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setSearchFocused(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard navigation for search results
  useEffect(() => {
    if (!searchFocused) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedResultIndex(prev => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedResultIndex(prev => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[selectedResultIndex]) {
          handleSelectResult(searchResults[selectedResultIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchFocused, searchResults, selectedResultIndex]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset index when query changes
  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchQuery]);

  return (
    <div ref={searchContainerRef} className="relative w-full md:w-auto">
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-300 w-full md:w-64 focus-within:md:w-80",
        isDark 
          ? "bg-slate-900 border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20" 
          : "bg-white border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"
      )}>
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          className={cn(
            "bg-transparent border-0 outline-none p-0 text-xs font-semibold leading-none placeholder-slate-400 focus:ring-0 focus:outline-none w-full",
            isDark ? "text-white animate-in" : "text-slate-900"
          )}
        />
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[9px] font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800 shrink-0">
          ⌘K
        </kbd>
      </div>

      {/* Inline Autocomplete Suggestions Dropdown */}
      {searchFocused && (
        <div className={cn(
          "absolute left-0 top-full mt-2 w-full md:w-[480px] rounded-2xl border shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in-50 zoom-in-95 duration-200 max-h-[420px]",
          isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 style-scroll">
            {searchResults.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-500">
                  {searchQuery.trim() ? "No records match your search query." : "Type to search clients, sites, contacts, tasks..."}
                </p>
              </div>
            ) : (
              searchResults.map((result, idx) => {
                const isSelected = idx === selectedResultIndex;
                const Icon = (() => {
                  switch (result.type) {
                    case 'client': return Building2;
                    case 'site': return MapPin;
                    case 'contact': return Users;
                    case 'task': return CheckSquare;
                    case 'subtask': return Circle;
                    case 'comm_log': return MessagesSquare;
                    case 'vat': return Receipt;
                    case 'vat_payment': return Receipt;
                    default: return Search;
                  }
                })();

                const typeLabel = (() => {
                  switch (result.type) {
                    case 'client': return 'Client';
                    case 'site': return 'Site';
                    case 'contact': return 'Contact';
                    case 'task': return 'Task';
                    case 'subtask': return 'Subtask';
                    case 'comm_log': return 'Comm Log';
                    case 'vat': return 'VAT Registry';
                    case 'vat_payment': return 'VAT Payment';
                    default: return '';
                  }
                })();

                const badgeColors = (() => {
                  switch (result.type) {
                    case 'client': return isDark ? 'bg-emerald-950/40 text-emerald-450 border-emerald-900/40' : 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    case 'site': return isDark ? 'bg-indigo-950/40 text-indigo-405 border-indigo-900/40' : 'bg-indigo-50 text-indigo-750 border-indigo-100';
                    case 'contact': return isDark ? 'bg-cyan-950/40 text-cyan-405 border-cyan-900/40' : 'bg-cyan-50 text-cyan-705 border-cyan-100';
                    case 'task': return isDark ? 'bg-amber-950/40 text-amber-405 border-amber-900/40' : 'bg-amber-50 text-amber-705 border-amber-100';
                    case 'subtask': return isDark ? 'bg-amber-950/40 text-amber-405 border-amber-900/40' : 'bg-amber-50 text-amber-755 border-amber-100';
                    case 'comm_log': return isDark ? 'bg-purple-950/40 text-purple-405 border-purple-900/40' : 'bg-purple-50 text-purple-705 border-purple-100';
                    case 'vat': return isDark ? 'bg-rose-950/40 text-rose-450 border-rose-900/40' : 'bg-rose-50 text-rose-700 border-rose-100';
                    case 'vat_payment': return isDark ? 'bg-rose-950/40 text-rose-450 border-rose-900/40' : 'bg-rose-50 text-rose-700 border-rose-100';
                    default: return '';
                  }
                })();

                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedResultIndex(idx)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border border-transparent select-none text-left w-full",
                      isSelected
                        ? (isDark ? "bg-indigo-950/40 border-indigo-900/30 text-white" : "bg-indigo-50/70 border-indigo-100/50 text-indigo-900")
                        : (isDark ? "hover:bg-slate-900/50 text-slate-300" : "hover:bg-slate-50 text-slate-700")
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                      isSelected 
                        ? (isDark ? "bg-indigo-900/50 border-indigo-850" : "bg-indigo-100 border-indigo-200 text-indigo-600")
                        : (isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500")
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate max-w-[200px] sm:max-w-[280px]">
                          {result.title}
                        </span>
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wide shrink-0",
                          badgeColors
                        )}>
                          {typeLabel}
                        </span>
                      </div>
                      <p className={cn(
                        "text-[10px] truncate mt-0.5",
                        isSelected ? "text-indigo-600/80 dark:text-indigo-400/80" : "text-slate-400"
                      )}>
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dropdown Footer bar */}
          <div className={cn(
            "px-3 py-2 border-t flex justify-between items-center text-[10px] font-semibold text-slate-400 shrink-0 select-none",
            isDark ? "bg-slate-900/50 border-slate-850" : "bg-slate-50 border-slate-100"
          )}>
            <span className="flex items-center gap-1">
              <span>↑↓</span>
              <span>to navigate</span>
              <span className="mx-1">•</span>
              <span>↵</span>
              <span>to select</span>
            </span>
            <span>
              Esc to clear
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
