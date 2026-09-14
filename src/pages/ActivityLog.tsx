import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { format, subDays, startOfMonth, parseISO, isValid } from 'date-fns';
import { 
  Search, 
  RefreshCcw, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  Layers, 
  ArrowRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export type CategoryKey = 'ALL' | 'FINANCE' | 'STAFF' | 'OPERATIONS';

interface CategoryMeta {
  label: string;
  tables: string[];
  badgeColor: string;
}

const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  ALL: {
    label: 'All Categories',
    tables: [],
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  FINANCE: {
    label: 'Finance & Accounts',
    tables: [
      'invoices', 
      'pending_invoices', 
      'payments', 
      'salary_advances', 
      'loans', 
      'ledger_entries', 
      'daily_financial_reports', 
      'petty_cash', 
      'expenses'
    ],
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  STAFF: {
    label: 'Staff & HR',
    tables: [
      'profiles', 
      'employees', 
      'attendance_records', 
      'leaves', 
      'disciplinary_records', 
      'evaluations', 
      'salaries'
    ],
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  OPERATIONS: {
    label: 'Site & Operations',
    tables: [
      'sites', 
      'clients', 
      'main_tasks', 
      'subtasks', 
      'task_updates', 
      'daily_journals', 
      'site_journal_entries', 
      'dewatering_records', 
      'fuel_logs'
    ],
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  }
};

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export function ActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const PAGE_SIZE = 50;

  const users = useUserStore(s => s.users);

  // Quick date presets calculation
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(0);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yestStr = format(subDays(today, 1), 'yyyy-MM-dd');
      setFromDate(yestStr);
      setToDate(yestStr);
    } else if (preset === 'LAST_7_DAYS') {
      setFromDate(format(subDays(today, 6), 'yyyy-MM-dd'));
      setToDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      setFromDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setToDate(todayStr);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase.from('audit_logs').select('*');

      if (filterAction !== 'ALL') {
        query = query.eq('action_type', filterAction);
      }
      if (filterUser !== 'ALL') {
        query = query.eq('user_id', filterUser);
      }
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate + 'T23:59:59.999Z');
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
  }, [filterAction, filterUser, fromDate, toDate, page]);

  const getUserName = (uid: string) => {
    if (!uid) return 'System Automated';
    const found = users.find(u => u.id === uid);
    return found ? found.name : 'System User';
  };

  const getTableFriendlyName = (name: string) => {
    const map: Record<string, string> = {
      profiles: 'User Account',
      employees: 'Staff Member',
      attendance_records: 'Attendance Record',
      leaves: 'Leave Request',
      invoices: 'Invoice',
      pending_invoices: 'Pending Invoice',
      disciplinary_records: 'Disciplinary Record',
      evaluations: 'Staff Evaluation',
      salary_advances: 'Salary Advance',
      loans: 'Staff Loan',
      payments: 'Payment Record',
      sites: 'Work Site',
      clients: 'Client Profile',
      main_tasks: 'Project Task',
      subtasks: 'Subtask Item',
      task_updates: 'Task Progress Note',
      daily_journals: 'Daily Journal',
      site_journal_entries: 'Site Operation Entry',
      ledger_entries: 'Ledger Entry',
      daily_financial_reports: 'Financial Report',
      expenses: 'Expense Record'
    };
    return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryForTable = (tableName: string): { label: string; badgeColor: string } => {
    if (CATEGORIES.FINANCE.tables.includes(tableName)) {
      return { label: 'Finance', badgeColor: CATEGORIES.FINANCE.badgeColor };
    }
    if (CATEGORIES.STAFF.tables.includes(tableName)) {
      return { label: 'Staff & HR', badgeColor: CATEGORIES.STAFF.badgeColor };
    }
    if (CATEGORIES.OPERATIONS.tables.includes(tableName)) {
      return { label: 'Site Operations', badgeColor: CATEGORIES.OPERATIONS.badgeColor };
    }
    return { label: 'General', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return '₦' + num.toLocaleString();
  };

  const isCurrencyField = (k: string) => {
    return /amount|salary|price|total|balance|cost|fee|credit|debit|vat|deposit/i.test(k);
  };

  const getRecordIdentifier = (data: any, _tableName?: string) => {
    if (!data) return 'Record';

    if (data.firstname && data.surname) return `${data.firstname} ${data.surname}`;
    if (data.name) return data.name;
    if (data.invoice_number) return `Invoice #${data.invoice_number}`;
    if (data.client_name) return data.client_name;
    if (data.site_name) return data.site_name;
    if (data.email) return data.email;
    if (data.title) return data.title;
    if (data.employee_code) return `Staff Code: ${data.employee_code}`;

    // Financial context
    if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
      const amtStr = formatCurrency(data.amount);
      const subInfo = data.client || data.bank || data.site;
      return subInfo ? `${amtStr} (${subInfo})` : amtStr;
    }

    if (data.client && data.site) return `${data.client} @ ${data.site}`;
    if (data.site) return `Site: ${data.site}`;
    if (data.client) return `Client: ${data.client}`;
    if (data.bank) return `Bank: ${data.bank}`;
    if (data.description) return String(data.description).slice(0, 35);

    if (data.id) return `#${String(data.id).slice(0, 8)}`;
    return 'Item';
  };

  const formatVal = (v: any, key: string = '') => {
    if (v === null || v === undefined || v === '') return 'None';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
    if (typeof v === 'object') return 'Complex data';

    if (isCurrencyField(key) && !isNaN(Number(v))) {
      return formatCurrency(v);
    }

    // Check if ISO date string (YYYY-MM-DD)
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      try {
        const parsed = parseISO(v);
        if (isValid(parsed)) {
          return format(parsed, 'MMM d, yyyy');
        }
      } catch {}
    }

    return String(v);
  };

  // Succinct 1-line summary for the minimalist list item
  const getSuccinctSummary = (log: any): string => {
    const ignoreKeys = ['id', 'created_at', 'updated_at', 'avatar', 'inserted_at', 'passphrase', 'password', 'user_id'];

    if (log.action_type === 'UPDATE') {
      const oldData = log.old_data || {};
      const newData = log.new_data || {};
      const diffNotes: string[] = [];

      for (const key of Object.keys(newData)) {
        if (ignoreKeys.includes(key)) continue;
        const o = oldData[key];
        const n = newData[key];
        if (JSON.stringify(o) !== JSON.stringify(n)) {
          const prettyKey = key.replace(/_/g, ' ');

          if (Array.isArray(n)) {
            diffNotes.push(`${prettyKey} updated (${n.length} items)`);
          } else if (typeof n === 'object' && n !== null) {
            diffNotes.push(`${prettyKey} updated`);
          } else {
            const oldStr = formatVal(o, key);
            const newStr = formatVal(n, key);
            if (oldStr.length < 25 && newStr.length < 25) {
              diffNotes.push(`${prettyKey}: ${oldStr} → ${newStr}`);
            } else {
              diffNotes.push(`${prettyKey} updated`);
            }
          }
        }
      }

      if (diffNotes.length === 0) return 'Background status or timestamp synced';
      if (diffNotes.length <= 2) return diffNotes.join(' • ');
      return `Updated ${diffNotes.length} fields (${diffNotes.slice(0, 2).join(' • ')} + ${diffNotes.length - 2} more)`;
    }

    if (log.action_type === 'INSERT') {
      const data = log.new_data || {};
      const parts: string[] = [];
      if (data.amount) parts.push(formatCurrency(data.amount));
      if (data.client || data.client_name) parts.push(String(data.client || data.client_name));
      if (data.site || data.site_name) parts.push(String(data.site || data.site_name));
      if (data.bank || data.bank_name) parts.push(String(data.bank || data.bank_name));
      if (parts.length > 0) return parts.join(' • ');

      const validKeys = Object.keys(data).filter(k => !ignoreKeys.includes(k) && data[k] !== null && data[k] !== '');
      return `New entry recorded with ${validKeys.length} details`;
    }

    if (log.action_type === 'DELETE') {
      return 'Record permanently removed from database';
    }

    return '';
  };

  // Comprehensive Filter & Search
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      // 1. Category Filter
      if (selectedCategory !== 'ALL') {
        const catConfig = CATEGORIES[selectedCategory];
        if (catConfig && !catConfig.tables.includes(l.table_name)) {
          return false;
        }
      }

      // 2. Search Filter
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();

      const userName = getUserName(l.user_id).toLowerCase();
      const tableName = getTableFriendlyName(l.table_name).toLowerCase();
      const identifier = getRecordIdentifier(l.new_data || l.old_data, l.table_name).toLowerCase();

      if (userName.includes(q) || tableName.includes(q) || identifier.includes(q)) {
        return true;
      }

      // Search inside data contents (amounts, bank, client, etc.)
      const rawDataString = JSON.stringify(l.new_data || {}) + ' ' + JSON.stringify(l.old_data || {});
      return rawDataString.toLowerCase().includes(q);
    });
  }, [logs, selectedCategory, search, users]);

  useSetPageTitle(
    'System Activity Log',
    'Track updates, financial entries, and operational records across the business',
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => fetchLogs()} 
        className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all active:scale-95"
      >
        <RefreshCcw className={`h-3.5 w-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        <span>Refresh</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-28 max-w-7xl mx-auto w-full">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-3 sm:p-4 flex flex-col gap-3">
        
        {/* Row 1: Search & Dropdowns */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by staff, client, site, bank, or amount..." 
              className="w-full h-9 pl-9 pr-3 rounded-sm border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" 
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Category Selector */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryKey)}
              aria-label="Filter activities by category"
              className="h-9 px-3 rounded-sm border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {Object.entries(CATEGORIES).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>

            {/* Staff Selector */}
            <select
              value={filterUser}
              onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
              aria-label="Filter activities by staff member"
              className="h-9 px-3 rounded-sm border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Staff Members</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Quick Date Presets & Action Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between pt-2 border-t border-slate-100">
          
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
            {(['ALL', 'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'THIS_MONTH', 'CUSTOM'] as DatePreset[]).map(preset => {
              const labels: Record<DatePreset, string> = {
                ALL: 'All Time',
                TODAY: 'Today',
                YESTERDAY: 'Yesterday',
                LAST_7_DAYS: 'Last 7 Days',
                THIS_MONTH: 'This Month',
                CUSTOM: 'Custom Range'
              };
              const active = datePreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => applyDatePreset(preset)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                    active 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {/* Action Types: Added, Edited, Deleted */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-sm shrink-0">
            {[
              { key: 'ALL', label: 'All Actions', icon: Layers },
              { key: 'INSERT', label: 'Added', icon: Plus },
              { key: 'UPDATE', label: 'Edited', icon: Edit2 },
              { key: 'DELETE', label: 'Deleted', icon: Trash2 }
            ].map(act => {
              const active = filterAction === act.key;
              const Icon = act.icon;
              return (
                <button
                  key={act.key}
                  onClick={() => { setFilterAction(act.key); setPage(0); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    active 
                      ? 'bg-white text-blue-700  font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Row */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
            <span className="text-xs font-medium text-slate-500">Select Range:</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(0); }}
              aria-label="Filter starting date"
              className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-700" 
            />
            <span className="text-slate-400 text-xs">to</span>
            <input 
              type="date" 
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(0); }}
              aria-label="Filter ending date"
              className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-700" 
            />
          </div>
        )}
      </div>

      {/* Main Succinct & Minimalist Feed */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        
        {/* Feed Header */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing <strong>{filteredLogs.length}</strong> activity event{filteredLogs.length === 1 ? '' : 's'}</span>
          {loading && <span className="text-blue-600 font-medium animate-pulse">Syncing logs...</span>}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCcw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Loading activity records...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No activity events found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Try clearing your search term, switching categories, or broadening the date range.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const userName = getUserName(log.user_id);
              const tableFriendly = getTableFriendlyName(log.table_name);
              const category = getCategoryForTable(log.table_name);
              const targetLabel = getRecordIdentifier(log.new_data || log.old_data, log.table_name);
              const summaryText = getSuccinctSummary(log);
              const dateObj = new Date(log.created_at || new Date());
              const formattedDate = format(dateObj, 'MMM d, yyyy');
              const formattedTime = format(dateObj, 'h:mm a');

              const isInsert = log.action_type === 'INSERT';
              const isUpdate = log.action_type === 'UPDATE';
              const isDelete = log.action_type === 'DELETE';

              return (
                <div 
                  key={log.id} 
                  className="px-4 py-3 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex items-start sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Action Icon + Minimalist Description */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 sm:mt-0 ${
                      isInsert 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' 
                        : isUpdate 
                        ? 'bg-amber-50 text-amber-600 border border-amber-200/60' 
                        : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                    }`}>
                      {isInsert && <Plus className="w-4 h-4 stroke-[2.5]" />}
                      {isUpdate && <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />}
                      {isDelete && <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </span>

                    <div className="flex flex-col min-w-0 flex-1">
                      {/* Main Title Row */}
                      <div className="flex items-center gap-1.5 flex-wrap text-sm leading-snug">
                        <strong className="text-slate-900 font-semibold">{userName}</strong>
                        <span className="text-slate-500 font-normal">
                          {isInsert ? 'created' : isUpdate ? 'updated' : 'deleted'}
                        </span>
                        <span className="font-medium text-slate-700">{tableFriendly}:</span>
                        <span className="font-semibold text-slate-800 bg-blue-50/70 px-1.5 py-0.5 rounded text-xs truncate max-w-[200px] sm:max-w-md">
                          {targetLabel}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1 ${category.badgeColor}`}>
                          {category.label}
                        </span>
                      </div>

                      {/* Succinct Minimalist 1-Line Summary */}
                      {summaryText && (
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {summaryText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Date & Details Button */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-xs font-medium text-slate-600">{formattedDate}</span>
                      <span className="text-[11px] text-slate-400">{formattedTime}</span>
                    </div>
                    <span className="sm:hidden text-xs text-slate-400">{formattedDate}</span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                      className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md font-medium"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Pagination Bar */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <p>
            Page <strong>{page + 1}</strong>
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 0} 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="h-8 px-3 text-xs"
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={logs.length < PAGE_SIZE} 
              onClick={() => setPage(p => p + 1)}
              className="h-8 px-3 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Clean Detail Inspection Dialog */}
      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Activity Event Details"
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            {/* Summary Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 text-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-slate-700">
                  By: <strong className="text-slate-900">{getUserName(selectedLog.user_id)}</strong>
                </span>
                <span className="text-slate-500 font-medium">
                  {format(new Date(selectedLog.created_at || new Date()), 'MMM d, yyyy h:mm:ss a')}
                </span>
              </div>
              <div className="text-slate-600">
                Action: <strong className="capitalize">{selectedLog.action_type?.toLowerCase()}</strong> on{' '}
                <strong className="text-slate-800">{getTableFriendlyName(selectedLog.table_name)}</strong> (
                {getRecordIdentifier(selectedLog.new_data || selectedLog.old_data, selectedLog.table_name)})
              </div>
            </div>

            {/* Formatted Changes / Fields */}
            {selectedLog.action_type === 'UPDATE' ? (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Modified Fields</h4>
                {(() => {
                  const ignoreKeys = ['id', 'created_at', 'updated_at', 'avatar', 'inserted_at', 'passphrase', 'password', 'user_id'];
                  const oldData = selectedLog.old_data || {};
                  const newData = selectedLog.new_data || {};
                  const diffs: { key: string; o: any; n: any }[] = [];

                  for (const key of Object.keys(newData)) {
                    if (ignoreKeys.includes(key)) continue;
                    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                      diffs.push({ key: key.replace(/_/g, ' '), o: oldData[key], n: newData[key] });
                    }
                  }

                  if (diffs.length === 0) {
                    return <p className="text-xs text-slate-400 italic">No business field changes recorded.</p>;
                  }

                  return (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-sm overflow-hidden text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-100/70 px-3 py-2 font-bold text-slate-700">
                        <div>Field Name</div>
                        <div>Previous Value</div>
                        <div>New Value</div>
                      </div>
                      {diffs.map((d, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-3 px-3 py-2.5 gap-2 items-start bg-white">
                          <div className="font-semibold text-slate-800 capitalize">{d.key}</div>
                          <div className="text-slate-500 bg-slate-50 p-2 rounded max-h-36 overflow-y-auto">
                            {formatModalValue(d.o, d.key)}
                          </div>
                          <div className="text-slate-800 bg-slate-50 p-2 rounded font-medium max-h-36 overflow-y-auto">
                            {formatModalValue(d.n, d.key)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : selectedLog.action_type === 'INSERT' ? (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recorded Values</h4>
                <div className="border border-slate-200 rounded-sm divide-y divide-slate-100 text-xs overflow-hidden">
                  {Object.entries(selectedLog.new_data || {})
                    .filter(([k, v]) => !['id', 'created_at', 'updated_at', 'avatar', 'user_id'].includes(k) && v !== null && v !== '')
                    .map(([k, v], i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-3 px-3 py-2 gap-2 bg-white">
                        <div className="font-semibold text-slate-600 capitalize">{k.replace(/_/g, ' ')}</div>
                        <div className="sm:col-span-2 text-slate-800 font-medium">
                          {formatModalValue(v, k)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-sm text-xs font-medium">
                This record was deleted permanently.
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

// Modal Formatter that handles arrays, objects, and currency without ugly JSON dumps
function formatModalValue(val: any, key: string = '') {
  if (val === null || val === undefined || val === '') return <span className="text-slate-400 italic">None</span>;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';

  // Handle arrays (e.g. task checklist items)
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-400 italic">Empty list</span>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {val.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const title = item.title || item.name || item.text || item.description || `Item #${idx + 1}`;
            const status = item.status ? ` [${item.status}]` : '';
            return <li key={idx}><span className="font-semibold text-slate-700">{title}</span>{status}</li>;
          }
          return <li key={idx}>{String(item)}</li>;
        })}
      </ul>
    );
  }

  // Handle objects
  if (typeof val === 'object') {
    return (
      <div className="space-y-1">
        {Object.entries(val).map(([k, v], idx) => (
          <div key={idx}>
            <span className="font-semibold capitalize text-slate-700">{k.replace(/_/g, ' ')}:</span> {String(v)}
          </div>
        ))}
      </div>
    );
  }

  const isCurrency = /amount|salary|price|total|balance|cost|fee|credit|debit|vat|deposit/i.test(key);
  if (isCurrency && !isNaN(Number(val))) {
    return <span className="font-bold text-emerald-700">₦{Number(val).toLocaleString()}</span>;
  }

  return String(val);
}

