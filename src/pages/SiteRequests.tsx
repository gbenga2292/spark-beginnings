import { useState, useMemo } from 'react';
import { useSetPageTitle } from '../contexts/PageContext';
import { useSiteRequests } from '../hooks/useSiteRequests';
import { useAppStore } from '../store/appStore';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, ChevronDown, ChevronRight, Loader2, Calendar, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { SiteRequest, SiteRequestStatus, STATUS_CONFIG, URGENCY_CONFIG, CATEGORY_LABELS, CATEGORY_ICONS } from '../types/siteRequests';
import { NewRequestDialog } from '../components/site-requests/NewRequestDialog';
import { RequestDetailSheet } from '../components/site-requests/RequestDetailSheet';
import { DeleteRequestDialog } from '../components/site-requests/DeleteRequestDialog';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_ORDER: SiteRequestStatus[] = ['pending', 'approved', 'in_progress', 'fulfilled', 'rejected', 'cancelled'];
const COLLAPSED_BY_DEFAULT: SiteRequestStatus[] = ['fulfilled', 'rejected', 'cancelled'];

export function SiteRequests() {
  const { requests, loading, createRequest, editRequest, deleteRequest, updateStatus, addComment, fetchUpdates } = useSiteRequests();
  const { sites } = useAppStore();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const canManage = currentUser?.privileges?.opsSiteRequests?.canManage ?? currentUser?.privileges?.users?.canManage ?? true;

  const [search, setSearch]             = useState('');
  const [siteFilter, setSiteFilter]     = useState('');
  const [dateFilter, setDateFilter]     = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [customDate, setCustomDate]     = useState('');
  const [showNew, setShowNew]           = useState(false);
  const [editingRequest, setEditingRequest] = useState<SiteRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<SiteRequest | null>(null);
  const [selected, setSelected]         = useState<SiteRequest | null>(null);
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set(COLLAPSED_BY_DEFAULT));

  useSetPageTitle(
    'Site Requests',
    'Internal requisitions from employees',
    <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
      <Plus className="h-3.5 w-3.5" /> New Request
    </Button>
  );

  const canEditOrDelete = (r: SiteRequest) => {
    if (canManage) return true;
    if (currentUser?.id && r.loggedById === currentUser.id) return true;
    if (currentUser?.name && r.loggedByName === currentUser.name) return true;
    if (!r.loggedById && !r.loggedByName) return true;
    return false;
  };

  const filtered = useMemo(() => {
    let res = requests;
    if (siteFilter) res = res.filter(r => r.siteId === siteFilter || r.siteName === siteFilter);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        r.item.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        (r.siteName ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFilter !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      res = res.filter(r => {
        const itemDate = r.requestDate || (r.createdAt ? r.createdAt.split('T')[0] : '');
        if (!itemDate) return false;
        if (dateFilter === 'today') return itemDate === todayStr;
        if (dateFilter === 'custom') return customDate ? itemDate === customDate : true;
        if (dateFilter === 'this_week') {
          const d = new Date(itemDate);
          const diffDays = (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 7;
        }
        if (dateFilter === 'this_month') {
          const d = new Date(itemDate);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        return true;
      });
    }
    return res;
  }, [requests, siteFilter, search, dateFilter, customDate]);

  const grouped = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      acc[s] = filtered.filter(r => r.status === s);
      return acc;
    }, {} as Record<SiteRequestStatus, SiteRequest[]>),
  [filtered]);

  const toggleCollapse = (s: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const siteOptions = useMemo(() =>
    Array.from(new Set(requests.map(r => r.siteName).filter(Boolean))) as string[],
  [requests]);

  return (
    <div className="flex flex-col h-full">
      {/* Filters bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search requests..."
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Site filter */}
        {siteOptions.length > 0 && (
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            className="h-8 text-xs px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Sites</option>
            {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            className="h-8 text-xs px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Pick Specific Date...</option>
          </select>

          {dateFilter === 'custom' && (
            <Input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="h-8 text-xs w-36 px-2"
            />
          )}

          {dateFilter !== 'all' && (
            <button
              onClick={() => { setDateFilter('all'); setCustomDate(''); }}
              title="Clear date filter"
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState onNew={() => setShowNew(true)} />
        ) : (
          STATUS_ORDER.map(status => {
            const group = grouped[status];
            if (group.length === 0) return null;
            const isCollapsed = collapsed.has(status);
            const cfg = STATUS_CONFIG[status];
            return (
              <section key={status}>
                <button
                  onClick={() => toggleCollapse(status)}
                  className="flex items-center gap-2 mb-2 w-full text-left group"
                >
                  <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                  <span className={cn('text-xs font-bold tracking-wide uppercase', cfg.text)}>
                    {cfg.label}
                  </span>
                  <span className={cn('text-[11px] font-semibold px-1.5 py-0.2 rounded-full', cfg.bg, cfg.text)}>
                    {group.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2 pl-5">
                    {group.map(r => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        canManage={canManage}
                        canEditOrDelete={canEditOrDelete(r)}
                        onView={() => setSelected(r)}
                        onEdit={() => setEditingRequest(r)}
                        onDelete={() => setDeletingRequest(r)}
                        onApprove={() => updateStatus(r.id, 'approved', 'Approved')}
                        onReject={() => updateStatus(r.id, 'rejected', 'Rejected')}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* New Request Dialog */}
      {showNew && (
        <NewRequestDialog
          onClose={() => setShowNew(false)}
          onCreate={createRequest}
        />
      )}

      {/* Edit Request Dialog */}
      {editingRequest && (
        <NewRequestDialog
          initialRequest={editingRequest}
          onClose={() => setEditingRequest(null)}
          onUpdate={editRequest}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRequest && (
        <DeleteRequestDialog
          request={deletingRequest}
          onClose={() => setDeletingRequest(null)}
          onConfirm={deleteRequest}
          fetchUpdates={fetchUpdates}
        />
      )}

      {/* Detail Sheet */}
      {selected && (
        <RequestDetailSheet
          request={selected}
          canManage={canManage}
          canEditOrDelete={canEditOrDelete(selected)}
          onClose={() => setSelected(null)}
          onEdit={(r) => { setSelected(null); setEditingRequest(r); }}
          onDelete={(r) => { setSelected(null); setDeletingRequest(r); }}
          onStatusChange={updateStatus}
          onComment={addComment}
          fetchUpdates={fetchUpdates}
          onUpdate={(updated) => setSelected(updated)}
        />
      )}
    </div>
  );
}

/* ── Request Card ──────────────────────────────────────────────────────────── */
function RequestCard({
  request: r, canManage, canEditOrDelete, onView, onEdit, onDelete, onApprove, onReject,
}: {
  request: SiteRequest;
  canManage: boolean;
  canEditOrDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const urgCfg = URGENCY_CONFIG[r.urgency];
  const stCfg  = STATUS_CONFIG[r.status];

  const reqDateRaw = r.requestDate || (r.createdAt ? r.createdAt.split('T')[0] : '');
  const formattedReqDate = reqDateRaw
    ? (reqDateRaw.length === 10 ? format(new Date(`${reqDateRaw}T00:00:00`), 'dd MMM yyyy') : format(new Date(reqDateRaw), 'dd MMM yyyy'))
    : format(new Date(r.createdAt), 'dd MMM yyyy');

  return (
    <div
      onClick={onView}
      className={cn(
        'group relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150',
        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
        'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm',
        r.urgency === 'critical' && 'border-l-2 border-l-red-500'
      )}
    >
      {/* Urgency dot */}
      <div className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 dark:ring-offset-slate-900', urgCfg.dot, urgCfg.ring)} />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {r.item}
              {r.quantity && <span className="ml-1 text-slate-400 font-normal">× {r.quantity}{r.unit ? ` ${r.unit}` : ''}</span>}
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                <span className="mr-1">{CATEGORY_ICONS[r.category]}</span>
                {r.requestedByName}
              </span>
              {r.siteName && <span className="text-slate-400">· {r.siteName}</span>}
              <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                <Calendar className="h-3 w-3 text-slate-400" />
                Req: {formattedReqDate}
              </span>
              {r.neededByDate && (
                <span className="text-slate-400 text-[11px]">
                  Needed: {format(new Date(r.neededByDate), 'dd MMM')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEditOrDelete && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity" onClick={e => e.stopPropagation()}>
                <button
                  onClick={onEdit}
                  title="Edit Request"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={onDelete}
                  title="Delete Request"
                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', stCfg.bg, stCfg.text, stCfg.border)}>
              {stCfg.label}
            </span>
          </div>
        </div>

        {/* Quick actions for pending — manager only */}
        {r.status === 'pending' && canManage && (
          <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={onApprove}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────────────────── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="text-4xl">📋</div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No requests found</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
        No requisitions match your current search or date filters.
      </p>
      <Button size="sm" variant="outline" onClick={onNew} className="mt-1">
        <Plus className="h-3.5 w-3.5 mr-1.5" /> New Request
      </Button>
    </div>
  );
}
