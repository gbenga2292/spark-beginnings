import { useState, useEffect } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { format } from 'date-fns';
import { Activity, Search, Server, FileText, Database, ShieldAlert, Settings, HardDrive, RefreshCcw, Plus, Edit2, Trash2 } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';

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
        query = query.eq('action_type', filterAction);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
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

  const getTableFriendlyName = (name: string) => {
    const map: Record<string, string> = {
      profiles: 'User Account',
      employees: 'Employee',
      attendance_records: 'Attendance',
      leaves: 'Leave Request',
      invoices: 'Invoice',
      pending_invoices: 'Pending Invoice',
      disciplinary_records: 'Disciplinary',
      evaluations: 'Evaluation',
      salary_advances: 'Salary Advance',
      loans: 'Loan',
      payments: 'Payment',
      sites: 'Site',
      clients: 'Client'
    };
    return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getRecordIdentifier = (data: any) => {
    if (!data) return 'N/A';
    const idDesc = data.name || data.email || data.title || data.invoice_number || data.employee_code ||
      (data.firstname && data.surname ? `${data.firstname} ${data.surname}` : null);
    if (idDesc) return idDesc;
    if (data.id) return String(data.id).slice(0, 8) + '...';
    return 'Unknown Record';
  };

  const formatVal = (v: any) => {
    if (v === null || v === undefined || v === '') return 'empty';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const renderChanges = (log: any) => {
    const ignoreKeys = ['id', 'created_at', 'updated_at', 'avatar', 'inserted_at', 'passphrase', 'password'];
    
    if (log.action_type === 'UPDATE') {
      const oldData = log.old_data || {};
      const newData = log.new_data || {};
      const diffs = [];
      for (const key of Object.keys(newData)) {
        if (ignoreKeys.includes(key)) continue;
        const oldVal = oldData[key];
        const newVal = newData[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diffs.push({ key: key.replace(/_/g, ' '), oldVal, newVal });
        }
      }
      if (diffs.length === 0) return <span className="text-slate-400 italic font-mono text-xs">No trackable business fields modified.</span>;
      return (
        <ul className="space-y-1.5 mt-1">
          {diffs.map((d, i) => (
            <li key={i} className="text-[13px] text-slate-600">
              <span className="font-semibold text-slate-700 capitalize">{d.key}</span> changed from{' '}
              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-mono text-xs line-through">
                {formatVal(d.oldVal)}
              </span>{' '}
              to{' '}
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-xs shadow-sm">
                {formatVal(d.newVal)}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    if (log.action_type === 'INSERT') {
      const data = log.new_data || {};
      const fields = Object.entries(data).filter(([k, v]) => !ignoreKeys.includes(k) && v !== null && v !== '');
      return (
        <ul className="space-y-1 mt-1">
          {fields.slice(0, 5).map(([k, v], i) => (
            <li key={i} className="text-[13px] text-slate-600">
              <span className="font-semibold capitalize text-slate-700">{k.replace(/_/g, ' ')}:</span> <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1 rounded">{formatVal(v)}</span>
            </li>
          ))}
          {fields.length > 5 && <li className="text-[11px] text-slate-400 italic mt-1">...and {fields.length - 5} more fields recorded.</li>}
        </ul>
      );
    }

    if (log.action_type === 'DELETE') {
      return <span className="text-red-500 text-[13px] font-medium italic">This record and all its data was deleted permanently.</span>;
    }

    return null;
  };

  const filteredLogs = logs.filter(l => 
    l.table_name.toLowerCase().includes(search.toLowerCase()) || 
    getUserName(l.user_id).toLowerCase().includes(search.toLowerCase())
  );

  useSetPageTitle(
    'System Activity Log',
    'Automated enterprise audit trail — who modified what and when',
    <div className="hidden sm:flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => fetchLogs()} className="gap-2 h-9">
        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6">

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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin flex flex-col gap-6">
        {loading ? (
          <p className="text-center text-slate-400 py-12">Loading audit trail...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No activity logs found.</p>
        ) : (
          <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[1.1rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {filteredLogs.map((log, index) => {
              const uName = getUserName(log.user_id);
              const tName = getTableFriendlyName(log.table_name);
              const rId = getRecordIdentifier(log.new_data || log.old_data);
              const time = format(new Date(log.created_at || new Date()), 'MMM d, yyyy h:mm a');
              
              const isInsert = log.action_type === 'INSERT';
              const isUpdate = log.action_type === 'UPDATE';
              const isDelete = log.action_type === 'DELETE';

              return (
                <div key={log.id} className="relative flex items-start gap-4 md:gap-6 group">
                  <div className="hidden md:block w-32 shrink-0 text-right pt-2.5">
                    <span className="text-xs font-medium text-slate-400 block">{format(new Date(log.created_at || new Date()), 'MMM d, yyyy')}</span>
                    <span className="text-xs font-semibold text-slate-500 block">{format(new Date(log.created_at || new Date()), 'h:mm a')}</span>
                  </div>
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm ring-1 ring-slate-100 z-10 transition-transform group-hover:scale-110 
                    ${isInsert ? 'bg-emerald-100 text-emerald-600' : isUpdate ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                    {isInsert && <Plus className="w-4 h-4" />}
                    {isUpdate && <Edit2 className="w-4 h-4" />}
                    {isDelete && <Trash2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 relative top-1">
                     <p className="text-[14px] text-slate-800 leading-snug">
                       <span className="font-bold text-slate-900">{uName}</span>{' '}
                       {isInsert ? 'created a new' : isUpdate ? 'updated the' : 'deleted the'}{' '}
                       <span className="font-semibold">{tName.toLowerCase()}</span>{' '}
                       record for <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{rId}</span>.
                     </p>
                     <p className="text-xs text-slate-400 mt-1 mb-3 md:hidden">{time}</p>
                     
                     <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-3">
                       {renderChanges(log)}
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="bg-white border text-center border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
        <p className="text-xs text-slate-500">Showing page {page + 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
