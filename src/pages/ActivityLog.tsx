import { useState, useEffect } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { format } from 'date-fns';
import { Activity, Search, Server, FileText, Database, ShieldAlert, Settings, HardDrive, RefreshCcw } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { useUserStore } from '@/src/store/userStore';

export function ActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const users = useUserStore(s => s.users); // To map auth.uid() to user pretty name

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase.from('audit_logs').select('*');
      
      if (filterAction !== 'ALL') {
        query = query.eq('action', filterAction);
      }
      
      const { data, error } = await query
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction, page]);

  const getUserName = (uid: string) => {
    if (!uid) return 'System / Unknown';
    const found = users.find(u => u.id === uid);
    return found ? found.name : 'Unknown User';
  };

  const getActionColor = (action: string) => {
    switch(action.toUpperCase()) {
      case 'INSERT': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const filteredLogs = logs.filter(l => 
    l.table_name.toLowerCase().includes(search.toLowerCase()) || 
    getUserName(l.changed_by).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-500" /> System Activity Log
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Automated enterprise audit trail detailing who modified what and when.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => fetchLogs()} className="gap-2">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
             value={search} 
             onChange={e => setSearch(e.target.value)} 
             placeholder="Search by user or table name..." 
             className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" 
          />
        </div>
        
        <div className="flex gap-2">
          {['ALL', 'INSERT', 'UPDATE', 'DELETE'].map(act => (
            <button
              key={act}
              onClick={() => { setFilterAction(act); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filterAction === act ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Record ID</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No activity logs found.</td>
                </tr>
              ) : filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                    {format(new Date(log.changed_at), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {getUserName(log.changed_by)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-indigo-600 bg-indigo-50/50 rounded px-2 w-max inline-block mt-2 ml-4">
                    {log.table_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {log.record_id ? String(log.record_id).slice(0, 12) + (String(log.record_id).length > 12 ? '...' : '') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[400px] max-h-24 overflow-y-auto text-xs font-mono bg-slate-900 text-slate-300 p-2 rounded-lg scrollbar-thin">
                      {log.action === 'UPDATE' && (
                        <div>
                           <span className="text-slate-500 block mb-1">{"// Changes:"}</span>
                           {JSON.stringify(log.new_data, null, 2)}
                        </div>
                      )}
                      {log.action === 'INSERT' && JSON.stringify(log.new_data, null, 2)}
                      {log.action === 'DELETE' && JSON.stringify(log.old_data, null, 2)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing page {page + 1}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
