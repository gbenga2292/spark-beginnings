import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, CheckCircle2, XCircle, RefreshCw, Truck, ShoppingCart, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  SiteRequest, SiteRequestUpdate, SiteRequestStatus,
  STATUS_CONFIG, URGENCY_CONFIG, CATEGORY_LABELS, CATEGORY_ICONS,
} from '@/src/types/siteRequests';

interface Props {
  request: SiteRequest;
  canManage: boolean;
  canEditOrDelete?: boolean;
  onClose: () => void;
  onEdit?: (r: SiteRequest) => void;
  onDelete?: (r: SiteRequest) => void;
  onStatusChange: (id: string, status: SiteRequestStatus, note?: string, extra?: any) => Promise<void>;
  onComment: (requestId: string, note: string) => Promise<void>;
  fetchUpdates: (requestId: string) => Promise<SiteRequestUpdate[]>;
  onUpdate: (r: SiteRequest) => void;
}

export function RequestDetailSheet({
  request: r, canManage, canEditOrDelete, onClose, onEdit, onDelete,
  onStatusChange, onComment, fetchUpdates, onUpdate,
}: Props) {
  const navigate = useNavigate();
  const [updates, setUpdates]             = useState<SiteRequestUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [comment, setComment]             = useState('');
  const [sending, setSending]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectMode, setRejectMode]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [fulfillMode, setFulfillMode]     = useState(false);
  const [fulfillNote, setFulfillNote]     = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUpdates(r.id).then(u => { setUpdates(u); setLoadingUpdates(false); });
  }, [r.id, fetchUpdates]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [updates]);

  const handleStatusChange = async (status: SiteRequestStatus, note?: string, extra?: any) => {
    setActionLoading(true);
    await onStatusChange(r.id, status, note, extra);
    const fresh = await fetchUpdates(r.id);
    setUpdates(fresh);
    onUpdate({ ...r, status, ...extra });
    setRejectMode(false);
    setFulfillMode(false);
    setActionLoading(false);
  };

  const handleComment = async () => {
    if (!comment.trim() || sending) return;
    setSending(true);
    await onComment(r.id, comment.trim());
    const fresh = await fetchUpdates(r.id);
    setUpdates(fresh);
    setComment('');
    setSending(false);
  };

  const stCfg  = STATUS_CONFIG[r.status];
  const urgCfg = URGENCY_CONFIG[r.urgency];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="hidden sm:block flex-1 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="w-full sm:w-[420px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 dark:ring-offset-slate-900', urgCfg.dot, urgCfg.ring)} />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
              {CATEGORY_ICONS[r.category]} {CATEGORY_LABELS[r.category]}
            </span>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', stCfg.bg, stCfg.text, stCfg.border)}>
              {stCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {canEditOrDelete && (
              <>
                {onEdit && (
                  <button
                    onClick={() => onEdit(r)}
                    title="Edit Request"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(r)}
                    title="Delete Request"
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Request info */}
          <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <p className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
              {r.item}
              {r.quantity && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  × {r.quantity}{r.unit ? ` ${r.unit}` : ''}
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-slate-400">Requested by</p>
                <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                  {r.requestedByName}
                  {r.requestedByRole && <span className="text-slate-400 font-normal"> · {r.requestedByRole}</span>}
                </p>
              </div>
              {r.siteName && (
                <div>
                  <p className="text-slate-400">Site</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{r.siteName}</p>
                </div>
              )}
              <div>
                <p className="text-slate-400">Urgency</p>
                <p className={cn('font-semibold mt-0.5 flex items-center gap-1')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', urgCfg.dot)} />
                  {urgCfg.label}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Request Date</p>
                <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                  {r.requestDate ? format(new Date(r.requestDate), 'd MMM yyyy') : format(new Date(r.createdAt), 'd MMM yyyy')}
                </p>
              </div>
              {r.neededByDate && (
                <div>
                  <p className="text-slate-400">Needed by</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                    {format(new Date(r.neededByDate), 'd MMM yyyy')}
                  </p>
                </div>
              )}
              {r.assignedToName && (
                <div>
                  <p className="text-slate-400">Assigned to</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{r.assignedToName}</p>
                </div>
              )}
            </div>

            {r.rejectionReason && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                <span className="font-semibold">Rejection reason: </span>{r.rejectionReason}
              </div>
            )}
            {r.fulfilmentNote && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="font-semibold">Fulfilment note: </span>{r.fulfilmentNote}
              </div>
            )}
          </div>

          {/* Manager Actions */}
          {canManage && (
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
              {r.status === 'pending' && !rejectMode && !fulfillMode && (
                <div className="flex gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('approved')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => setRejectMode(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}

              {r.status === 'approved' && !rejectMode && !fulfillMode && (
                <div className="flex gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('in_progress')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Mark In Progress
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => setFulfillMode(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fulfil
                  </button>
                </div>
              )}

              {r.status === 'in_progress' && !fulfillMode && (
                <button
                  disabled={actionLoading}
                  onClick={() => setFulfillMode(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Fulfilled
                </button>
              )}

              {/* Reject inline */}
              {rejectMode && (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="text-xs"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setRejectMode(false)}>Cancel</Button>
                    <Button
                      size="sm" className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                      disabled={actionLoading || !rejectReason.trim()}
                      onClick={() => handleStatusChange('rejected', rejectReason, { rejectionReason: rejectReason })}
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Reject'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Fulfil inline */}
              {fulfillMode && (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={fulfillNote}
                    onChange={e => setFulfillNote(e.target.value)}
                    placeholder="Fulfilment note (optional)..."
                    className="text-xs"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusChange('fulfilled', fulfillNote || undefined, { fulfilmentNote: fulfillNote || undefined })}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Mark as Fulfilled
                    </button>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => navigate('/operations/waybills')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Truck className="h-3 w-3" /> + Waybill
                      </button>
                      <button
                        onClick={() => navigate('/operations/checkout')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ShoppingCart className="h-3 w-3" /> + Checkout
                      </button>
                    </div>
                    <button className="text-[11px] text-slate-400 hover:text-slate-600 text-center" onClick={() => setFulfillMode(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Log */}
          <div ref={logRef} className="px-4 py-3 space-y-3 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activity</p>
            {loadingUpdates ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
            ) : (
              updates.map(u => <UpdateItem key={u.id} update={u} />)
            )}
          </div>
        </div>

        {/* Comment input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add an update..."
            className="text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
          />
          <button
            disabled={!comment.trim() || sending}
            onClick={handleComment}
            className="p-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 transition-opacity hover:opacity-80"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateItem({ update: u }: { update: SiteRequestUpdate }) {
  const isStatusChange = !!u.statusTo;
  return (
    <div className="flex gap-2.5 text-xs">
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <div className={cn(
          'h-5 w-5 rounded-full flex items-center justify-center text-[10px]',
          isStatusChange
            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        )}>
          {u.authorName[0]?.toUpperCase() ?? '?'}
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{u.authorName}</span>
          {isStatusChange && u.statusTo && (
            <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-semibold', STATUS_CONFIG[u.statusTo as SiteRequestStatus]?.bg, STATUS_CONFIG[u.statusTo as SiteRequestStatus]?.text, STATUS_CONFIG[u.statusTo as SiteRequestStatus]?.border)}>
              → {STATUS_CONFIG[u.statusTo as SiteRequestStatus]?.label}
            </span>
          )}
          <span className="text-slate-400 ml-auto text-[10px] whitespace-nowrap">
            {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
          </span>
        </div>
        {u.note && <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{u.note}</p>}
      </div>
    </div>
  );
}
