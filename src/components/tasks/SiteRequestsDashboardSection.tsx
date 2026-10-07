import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteRequests } from '@/src/hooks/useSiteRequests';
import {
  SiteRequest, SiteRequestStatus,
  STATUS_CONFIG, URGENCY_CONFIG, CATEGORY_ICONS,
} from '@/src/types/siteRequests';
import { NewRequestDialog } from '@/src/components/site-requests/NewRequestDialog';
import { RequestDetailSheet } from '@/src/components/site-requests/RequestDetailSheet';
import { DeleteRequestDialog } from '@/src/components/site-requests/DeleteRequestDialog';
import { useUserStore } from '@/src/store/userStore';
import { cn } from '@/src/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ClipboardList, Plus, ArrowUpRight, Calendar,
  Loader2, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';

interface Props {
  maxItems?: number;
  showManageLink?: boolean;
}

export function SiteRequestsDashboardSection({ maxItems = 10, showManageLink = true }: Props) {
  const navigate = useNavigate();
  const {
    requests, loading, createRequest, editRequest, deleteRequest,
    updateStatus, addComment, fetchUpdates,
  } = useSiteRequests();

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const canManage = currentUser?.privileges?.opsSiteRequests?.canManage ?? currentUser?.privileges?.users?.canManage ?? true;

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'fulfilled'>('all');
  const [selected, setSelected] = useState<SiteRequest | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SiteRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<SiteRequest | null>(null);

  const canEditOrDelete = (r: SiteRequest) => {
    if (canManage) return true;
    if (currentUser?.id && r.loggedById === currentUser.id) return true;
    if (currentUser?.name && r.loggedByName === currentUser.name) return true;
    if (!r.loggedById && !r.loggedByName) return true;
    return false;
  };

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      in_progress: requests.filter(r => r.status === 'in_progress').length,
      fulfilled: requests.filter(r => r.status === 'fulfilled').length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let list = requests;
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }
    return list.slice(0, maxItems);
  }, [requests, statusFilter, maxItems]);

  return (
    <div className="flex flex-col h-full">
      {/* Metrics / Status quick filter pills */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === 'all'
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === 'pending'
                ? "bg-amber-600 text-white font-semibold shadow-xs"
                : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            )}
          >
            Pending ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === 'in_progress'
                ? "bg-orange-600 text-white font-semibold shadow-xs"
                : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
            )}
          >
            In Progress ({counts.in_progress})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('fulfilled')}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === 'fulfilled'
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            )}
          >
            Fulfilled ({counts.fulfilled})
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNew(true)}
            className="h-7 text-xs gap-1 px-2.5 shadow-none"
          >
            <Plus className="w-3.5 h-3.5" /> New Request
          </Button>
          {showManageLink && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/operations/site-requests')}
              className="h-7 text-xs gap-1 px-2 text-primary hover:text-primary"
            >
              Full Manager <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 divide-y divide-border/40 overflow-y-auto">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading site requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 text-center px-4">
            <div className="w-9 h-9 rounded-md bg-muted/60 flex items-center justify-center mx-auto mb-2 text-muted-foreground">
              <ClipboardList className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-foreground">No site requests found</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs mx-auto">
              {statusFilter === 'all'
                ? 'There are currently no active requests from site personnel.'
                : `No requests with status "${statusFilter}" were found.`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNew(true)}
              className="mt-3 h-7 text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create Request
            </Button>
          </div>
        ) : (
          filteredRequests.map((r, i) => {
            const stCfg = STATUS_CONFIG[r.status];
            const urgCfg = URGENCY_CONFIG[r.urgency];
            const reqDateRaw = r.requestDate || (r.createdAt ? r.createdAt.split('T')[0] : '');
            const formattedReqDate = reqDateRaw
              ? (reqDateRaw.length === 10 ? format(new Date(`${reqDateRaw}T00:00:00`), 'dd MMM yyyy') : format(new Date(reqDateRaw), 'dd MMM yyyy'))
              : format(new Date(r.createdAt), 'dd MMM yyyy');

            return (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors group"
              >
                <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums hidden sm:block flex-shrink-0">
                  {i + 1}
                </span>

                {/* Urgency indicator strip */}
                <div
                  className={cn(
                    "w-1 h-9 rounded-full flex-shrink-0 hidden sm:block",
                    r.urgency === 'critical' ? 'bg-red-500' :
                    r.urgency === 'urgent' ? 'bg-amber-500' :
                    r.status === 'in_progress' ? 'bg-orange-500' :
                    r.status === 'approved' ? 'bg-blue-500' :
                    r.status === 'fulfilled' ? 'bg-emerald-500' :
                    'bg-slate-300 dark:bg-slate-700'
                  )}
                />

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{CATEGORY_ICONS[r.category]}</span>
                      <span className="truncate">{r.item}</span>
                      {r.quantity && (
                        <span className="text-xs text-muted-foreground font-normal">
                          × {r.quantity}{r.unit ? ` ${r.unit}` : ''}
                        </span>
                      )}
                    </p>

                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0',
                        stCfg.bg, stCfg.text, stCfg.border
                      )}
                    >
                      {stCfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-x-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {r.requestedByName}
                    </span>
                    {r.siteName && <span>· {r.siteName}</span>}
                    <span className="inline-flex items-center gap-1 text-[11px] bg-muted/60 px-1.5 py-0.2 rounded font-medium">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      Req: {formattedReqDate}
                    </span>
                    {r.neededByDate && (
                      <span className="text-[11px] text-muted-foreground">
                        Needed: {format(new Date(r.neededByDate), 'dd MMM')}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
              </div>
            );
          })
        )}
      </div>

      {/* New Request Modal */}
      {showNew && (
        <NewRequestDialog
          onClose={() => setShowNew(false)}
          onCreate={createRequest}
        />
      )}

      {/* Edit Request Modal */}
      {editingRequest && (
        <NewRequestDialog
          initialRequest={editingRequest}
          onClose={() => setEditingRequest(null)}
          onUpdate={editRequest}
        />
      )}

      {/* Delete Confirmation Modal */}
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
