import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, ArrowUpRight, Clock, CheckCircle2,
  XCircle, Loader2, Circle, ThumbsUp, LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSiteRequests } from '@/src/hooks/useSiteRequests';
import { SiteRequest, SiteRequestStatus, STATUS_CONFIG } from '@/src/types/siteRequests';
import { RequestDetailSheet } from '@/src/components/site-requests/RequestDetailSheet';
import { useUserStore } from '@/src/store/userStore';

const STATUS_ICON: Record<SiteRequestStatus, LucideIcon> = {
  pending:     Clock,
  approved:    ThumbsUp,
  in_progress: Loader2,
  fulfilled:   CheckCircle2,
  rejected:    XCircle,
  cancelled:   Circle,
};

const STATUS_DOT: Record<SiteRequestStatus, string> = {
  pending:     'bg-amber-500',
  approved:    'bg-blue-500',
  in_progress: 'bg-orange-500',
  fulfilled:   'bg-emerald-500',
  rejected:    'bg-red-500',
  cancelled:   'bg-muted-foreground',
};

interface Props {
  canView: boolean;
}

export function SiteRequestsDashboardSection({ canView }: Props) {
  const navigate = useNavigate();
  const { requests, loading, updateStatus, addComment, fetchUpdates } = useSiteRequests();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const canManage = currentUser?.privileges?.opsSiteRequests?.canManage ?? currentUser?.privileges?.users?.canManage ?? true;

  const [selected, setSelected] = useState<SiteRequest | null>(null);

  const canEditOrDelete = (r: SiteRequest) => {
    if (canManage) return true;
    if (currentUser?.id && r.loggedById === currentUser.id) return true;
    if (currentUser?.name && r.loggedByName === currentUser.name) return true;
    if (!r.loggedById && !r.loggedByName) return true;
    return false;
  };

  const counts = useMemo(() => {
    const c: Record<SiteRequestStatus, number> = {
      pending: 0, approved: 0, in_progress: 0, fulfilled: 0, rejected: 0, cancelled: 0,
    };
    requests.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [requests]);

  const preview = useMemo(() => {
    const active = requests.filter(r =>
      r.status === 'pending' || r.status === 'approved' || r.status === 'in_progress'
    );
    return (active.length > 0 ? active : requests).slice(0, 5);
  }, [requests]);

  if (!canView) return null;

  const activeCount = counts.pending + counts.approved + counts.in_progress;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-card border border-border rounded-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">Site Requests</h3>
              <p className="text-[11px] text-muted-foreground">
                {loading ? 'Loading…' : `${requests.length} total · ${activeCount} active`}
              </p>
            </div>
            {activeCount > 0 && !loading && (
              <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {activeCount}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/operations/site-requests')}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors shrink-0 pl-2 cursor-pointer"
          >
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary pills */}
        {!loading && (
          <div className="flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-b border-border/60">
            {(Object.keys(STATUS_CONFIG) as SiteRequestStatus[]).map(s => {
              const cfg = STATUS_CONFIG[s];
              const count = counts[s];
              if (count === 0) return null;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                  {cfg.label} · {count}
                </span>
              );
            })}
            {requests.length === 0 && (
              <span className="text-[11px] text-muted-foreground">No requests yet.</span>
            )}
          </div>
        )}

        {/* Preview list */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : preview.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <p className="text-xs text-muted-foreground">All requests fulfilled.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {preview.map(req => {
              const cfg = STATUS_CONFIG[req.status];
              const Icon = STATUS_ICON[req.status];
              const dotCls = STATUS_DOT[req.status];
              const dateStr = req.requestDate
                ? (() => { try { return format(new Date(req.requestDate), 'MMM d'); } catch { return ''; } })()
                : '';

              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelected(req)}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors group text-left cursor-pointer"
                >
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${dotCls}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {req.item}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[req.category, req.siteName, req.requestedByName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {dateStr && (
                      <span className="text-[11px] text-muted-foreground hidden sm:block">{dateStr}</span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Detail Sheet modal when clicked */}
      {selected && (
        <RequestDetailSheet
          request={selected}
          canManage={canManage}
          canEditOrDelete={canEditOrDelete(selected)}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onComment={addComment}
          fetchUpdates={fetchUpdates}
          onUpdate={(r) => setSelected(r)}
        />
      )}
    </>
  );
}



