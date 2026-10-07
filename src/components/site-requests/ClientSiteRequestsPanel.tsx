import { useState, useMemo } from 'react';
import { useSiteRequests } from '@/src/hooks/useSiteRequests';
import { useUserStore } from '@/src/store/userStore';
import { useAppStore, Site } from '@/src/store/appStore';
import {
  SiteRequest, SiteRequestStatus,
  STATUS_CONFIG, URGENCY_CONFIG, CATEGORY_ICONS, CATEGORY_LABELS,
} from '@/src/types/siteRequests';
import { NewRequestDialog } from './NewRequestDialog';
import { RequestDetailSheet } from './RequestDetailSheet';
import { DeleteRequestDialog } from './DeleteRequestDialog';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ClipboardList, Plus, Search, Calendar, Clock,
  Filter, CheckCircle2, ChevronRight, X, Loader2,
  Building2, User, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Props {
  siteId?: string;
  siteName?: string;
  clientName?: string;
  clientSites?: Site[];
}

export function ClientSiteRequestsPanel({ siteId, siteName, clientName, clientSites }: Props) {
  const navigate = useNavigate();
  const {
    requests, loading, createRequest, editRequest, deleteRequest,
    updateStatus, addComment, fetchUpdates,
  } = useSiteRequests();
  const { sites } = useAppStore();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const canManage = currentUser?.privileges?.opsSiteRequests?.canManage ?? currentUser?.privileges?.users?.canManage ?? true;

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'in_progress' | 'fulfilled' | 'rejected'>('all');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [showNew, setShowNew]           = useState(false);
  const [selected, setSelected]         = useState<SiteRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<SiteRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<SiteRequest | null>(null);

  const canEditOrDelete = (r: SiteRequest) => {
    if (canManage) return true;
    if (currentUser?.id && r.loggedById === currentUser.id) return true;
    if (currentUser?.name && r.loggedByName === currentUser.name) return true;
    if (!r.loggedById && !r.loggedByName) return true;
    return false;
  };

  // Determine site ID set relevant to this panel
  const relevantSiteIds = useMemo(() => {
    if (siteId) return new Set([siteId]);
    if (clientSites && clientSites.length > 0) {
      return new Set(clientSites.map(s => s.id));
    }
    if (clientName && clientName !== 'ALL' && clientName !== 'All Clients') {
      const cLow = clientName.trim().toLowerCase();
      const matched = sites.filter(s => s.client?.trim().toLowerCase() === cLow).map(s => s.id);
      return new Set(matched);
    }
    return null; // All sites if no specific client or 'ALL'
  }, [siteId, clientSites, clientName, sites]);

  const relevantSiteNames = useMemo(() => {
    if (siteName) return new Set([siteName.trim().toLowerCase()]);
    if (clientSites && clientSites.length > 0) {
      return new Set(clientSites.map(s => (s.name || '').trim().toLowerCase()));
    }
    if (clientName && clientName !== 'ALL' && clientName !== 'All Clients') {
      const cLow = clientName.trim().toLowerCase();
      const matched = sites.filter(s => s.client?.trim().toLowerCase() === cLow).map(s => (s.name || '').trim().toLowerCase());
      return new Set(matched);
    }
    return null;
  }, [siteName, clientSites, clientName, sites]);

  // Filter requests belonging to this site or client's sites
  const scopedRequests = useMemo(() => {
    return requests.filter(r => {
      // 1. Direct Site360 matching
      if (siteId && r.siteId === siteId) return true;
      if (siteName && r.siteName?.trim().toLowerCase() === siteName.trim().toLowerCase()) return true;

      // 2. Client360 matching
      if (relevantSiteIds && r.siteId && relevantSiteIds.has(r.siteId)) return true;
      if (relevantSiteNames && r.siteName && relevantSiteNames.has(r.siteName.trim().toLowerCase())) return true;

      // 3. Fallback: if all clients
      if (!siteId && !siteName && (!clientName || clientName === 'ALL' || clientName === 'All Clients')) {
        return true;
      }

      return false;
    });
  }, [requests, siteId, siteName, clientName, relevantSiteIds, relevantSiteNames]);

  // Summary counts
  const counts = useMemo(() => {
    return {
      all: scopedRequests.length,
      pending: scopedRequests.filter(r => r.status === 'pending').length,
      approved: scopedRequests.filter(r => r.status === 'approved').length,
      in_progress: scopedRequests.filter(r => r.status === 'in_progress').length,
      fulfilled: scopedRequests.filter(r => r.status === 'fulfilled').length,
      rejected: scopedRequests.filter(r => r.status === 'rejected').length,
    };
  }, [scopedRequests]);

  // Sub-filtering (search, status, site)
  const filteredList = useMemo(() => {
    let list = scopedRequests;
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }
    if (selectedSiteFilter !== 'all') {
      list = list.filter(r => r.siteId === selectedSiteFilter || r.siteName === selectedSiteFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r =>
        r.item.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        (r.siteName || '').toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [scopedRequests, statusFilter, selectedSiteFilter, search]);

  // Sites available in this scope for secondary dropdown filter (in Client360)
  const scopedSiteOptions = useMemo(() => {
    if (siteId) return [];
    const map = new Map<string, string>();
    scopedRequests.forEach(r => {
      if (r.siteName) {
        map.set(r.siteId || r.siteName, r.siteName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [siteId, scopedRequests]);

  // Pre-seed site for New Request modal
  const initialSiteProp = useMemo(() => {
    if (siteId && siteName) {
      return { id: siteId, name: siteName };
    }
    if (clientSites && clientSites.length === 1) {
      return { id: clientSites[0].id, name: clientSites[0].name };
    }
    return undefined;
  }, [siteId, siteName, clientSites]);

  return (
    <div className="space-y-3 animate-in fade-in-50 duration-150">
      {/* Filter Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap justify-between">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px] flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items, requesters, categories..."
              className="pl-9 h-8.5 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-8.5 text-xs px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">All Statuses ({counts.all})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="approved">Approved ({counts.approved})</option>
              <option value="in_progress">In Progress ({counts.in_progress})</option>
              <option value="fulfilled">Fulfilled ({counts.fulfilled})</option>
              <option value="rejected">Rejected ({counts.rejected})</option>
            </select>
          </div>

          {/* Secondary Site Dropdown (when viewed from Client360 with multiple sites) */}
          {!siteId && scopedSiteOptions.length > 1 && (
            <div className="relative shrink-0">
              <select
                value={selectedSiteFilter}
                onChange={e => setSelectedSiteFilter(e.target.value)}
                className="h-8.5 text-xs px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="all">All Project Sites</option>
                {scopedSiteOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Button: New Request */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowNew(true)}
            className="h-8.5 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Request</span>
          </Button>
        </div>
      </div>

      {/* Requests Card List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {search || statusFilter !== 'all' ? 'No matching requests found' : 'No site requests recorded'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            {search || statusFilter !== 'all'
              ? 'Try resetting the filters or searching with different keywords.'
              : 'Submit a requisition for equipment, diesel fuel, personnel, or spare parts.'}
          </p>
          <Button
            size="sm"
            onClick={() => setShowNew(true)}
            className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Site Request
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredList.map((req) => {
            const cfg = STATUS_CONFIG[req.status];
            const urg = URGENCY_CONFIG[req.urgency];
            const dateStr = req.requestDate
              ? (() => { try { return format(new Date(req.requestDate), 'MMM d, yyyy'); } catch { return req.requestDate; } })()
              : req.createdAt
              ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })
              : '';

            return (
              <div
                key={req.id}
                onClick={() => setSelected(req)}
                className="group relative bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left: Indicator bar & item details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center shrink-0 text-base">
                    {CATEGORY_ICONS[req.category] || '📦'}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {req.item}
                      </p>
                      {req.quantity !== undefined && req.quantity !== null && (
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {req.quantity} {req.unit || 'units'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="capitalize font-medium text-slate-600 dark:text-slate-300">
                        {CATEGORY_LABELS[req.category] || req.category}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200 truncate">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        {req.siteName || 'No site specified'}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        {req.requestedByName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Date, Urgency & Status pills */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                  {dateStr && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium hidden md:flex">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{dateStr}</span>
                    </div>
                  )}

                  {/* Urgency Pill */}
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border",
                    urg.bg, urg.text, urg.border
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", urg.dot)} />
                    {urg.label}
                  </span>

                  {/* Status Pill */}
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border whitespace-nowrap",
                    cfg.bg, cfg.text, cfg.border
                  )}>
                    {cfg.label}
                  </span>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Request Modal */}
      {showNew && (
        <NewRequestDialog
          initialRequest={initialSiteProp ? ({ siteId: initialSiteProp.id, siteName: initialSiteProp.name } as any) : undefined}
          onClose={() => setShowNew(false)}
          onCreate={async (p) => { await createRequest(p); }}
        />
      )}

      {/* Edit Request Modal */}
      {editingRequest && (
        <NewRequestDialog
          initialRequest={editingRequest}
          onClose={() => setEditingRequest(null)}
          onUpdate={async (id, p) => { await editRequest(id, p); }}
        />
      )}

      {/* Request Details Sheet */}
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
          onUpdate={(r) => setSelected(r)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRequest && (
        <DeleteRequestDialog
          request={deletingRequest}
          onClose={() => setDeletingRequest(null)}
          onConfirm={async () => {
            await deleteRequest(deletingRequest.id);
            setDeletingRequest(null);
            if (selected?.id === deletingRequest.id) setSelected(null);
          }}
          fetchUpdates={fetchUpdates}
        />
      )}
    </div>
  );
}
