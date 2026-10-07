import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { SiteRequest, SiteRequestUpdate, STATUS_CONFIG } from '../../types/siteRequests';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  request: SiteRequest;
  onClose: () => void;
  onConfirm: (id: string) => Promise<any>;
  fetchUpdates: (id: string) => Promise<SiteRequestUpdate[]>;
}

export function DeleteRequestDialog({ request, onClose, onConfirm, fetchUpdates }: Props) {
  const [updates, setUpdates] = useState<SiteRequestUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchUpdates(request.id).then(res => {
      if (active) {
        setUpdates(res);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [request.id, fetchUpdates]);

  const hasActivity = updates.length > 1 || request.status !== 'pending';

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm(request.id);
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Delete Site Request</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          <div>
            <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
              Are you sure you want to delete this request?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{request.item}</span>
              {request.quantity && <span> (Qty: {request.quantity} {request.unit || ''})</span>}
              {request.siteName && <span> · Site: {request.siteName}</span>}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking request history...
            </div>
          ) : hasActivity ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold">
                    Warning: This request already has activity logged!
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                    It has <span className="font-bold">{updates.length}</span> update/audit entries and current status is <span className="font-semibold uppercase">{STATUS_CONFIG[request.status]?.label || request.status}</span>.
                  </p>
                </div>
              </div>

              {updates.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/50 max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {updates.map(u => (
                    <div key={u.id} className="text-[11px] text-amber-900/80 dark:text-amber-300/80 flex items-start justify-between gap-2">
                      <span className="truncate">
                        • {u.authorName}: {u.note || (u.statusTo ? `Changed to ${u.statusTo}` : 'Update')}
                      </span>
                      <span className="text-[10px] text-amber-700/60 dark:text-amber-400/60 flex-shrink-0">
                        {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 pt-1">
                Deleting it will permanently erase the request and all logged notes and updates.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This request currently has no ongoing progress notes. Deleting will permanently remove it.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDelete}
            disabled={deleting || loading}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
