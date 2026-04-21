import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/src/store/appStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn, generateId } from '@/src/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, MessageSquare, Plus, Phone, Mail, MessageCircle,
  Users, Car, Bell, CheckCircle2, Pencil, Building2, MapPin,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';

function channelIcon(ch: string) {
  if (ch === 'Call') return <Phone className="w-4 h-4" />;
  if (ch === 'Email') return <Mail className="w-4 h-4" />;
  if (ch === 'WhatsApp') return <MessageCircle className="w-4 h-4" />;
  if (ch === 'Meeting') return <Users className="w-4 h-4" />;
  if (ch === 'SMS') return <MessageSquare className="w-4 h-4" />;
  if (ch === 'Visit') return <Car className="w-4 h-4" />;
  return <MessageSquare className="w-4 h-4" />;
}

export function SiteConversations() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const sites = useAppStore(s => s.sites);
  const commLogs = useAppStore(s => s.commLogs);

  const site = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  // All logs for this site, sorted oldest-first for threading
  const siteLogs = useMemo(() => {
    if (!siteId) return [];
    return commLogs
      .filter(l => l.siteId === siteId)
      .sort((a, b) => {
        const da = a.date + (a.time ? `T${a.time}` : 'T00:00');
        const db = b.date + (b.time ? `T${b.time}` : 'T00:00');
        return new Date(da).getTime() - new Date(db).getTime();
      });
  }, [commLogs, siteId]);

  // Group: parent logs with their follow-ups threaded below, newest-first
  const grouped = useMemo(() => {
    const parents = siteLogs.filter(l => !l.parentId);
    const followUps = siteLogs.filter(l => !!l.parentId);
    return parents
      .map(p => ({
        ...p,
        followUps: followUps
          .filter(fu => fu.parentId === p.id)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [siteLogs]);

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h2 className="text-xl font-bold text-slate-800">Site not found</h2>
        <button onClick={() => navigate(-1)} className="text-indigo-600 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={cn(
        "flex shrink-0 border-b px-6 py-4 shadow-sm items-center gap-4",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white"
      )}>
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            Site Conversations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {site.name}
            <span className="text-slate-300 mx-1">·</span>
            <Building2 className="h-3.5 w-3.5" /> {site.client}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          onClick={() => {
            navigate(`/comm-log?prefill_site=${siteId}&prefill_client=${encodeURIComponent(site.client)}`);
          }}
        >
          <Plus className="w-4 h-4" /> New Log
        </Button>
      </div>

      {/* Body */}
      <div className={cn("flex-1 overflow-auto p-6", isDark ? "bg-slate-950" : "bg-slate-50")}>
        <div className="mx-auto max-w-3xl">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <MessageSquare className="h-16 w-16 text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium text-lg">No conversations logged for this site yet.</p>
              <p className="text-sm text-slate-400 mt-2">Click "New Log" to record the first communication.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-100 dark:border-indigo-900 ml-4 pl-6 space-y-6">
              {grouped.map((log, idx) => {
                const isIncoming = log.direction === 'Incoming';
                const dateObj = new Date(log.date);
                return (
                  <div key={log.id || idx} className="relative">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-[35px] mt-1.5 h-4 w-4 rounded-full border-4 border-slate-50 dark:border-slate-950 shadow-sm ring-1 ring-slate-200",
                      isIncoming ? "bg-emerald-500" : "bg-indigo-500"
                    )} />

                    {/* Main log card */}
                    <div className={cn(
                      "rounded-xl border p-5 shadow-sm",
                      isDark
                        ? isIncoming ? "bg-slate-900 border-emerald-900" : "bg-slate-900 border-indigo-900"
                        : isIncoming ? "bg-white border-emerald-100" : "bg-white border-indigo-100"
                    )}>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center justify-center w-7 h-7 rounded-lg text-white shadow-sm",
                            isIncoming ? "bg-emerald-500" : "bg-indigo-500"
                          )}>
                            {channelIcon(log.channel)}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                            {isIncoming ? 'Received from' : 'Sent to'} {log.contactPerson || 'Client / Site'}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            isIncoming ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          )}>
                            {log.channel} · {isIncoming ? 'Incoming' : 'Outgoing'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {format(dateObj, 'MMM d, yyyy')}{log.time && ` · ${log.time}`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                            onClick={() => navigate(`/comm-log?highlightId=${log.id}`)}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                        </div>
                      </div>

                      {log.subject && (
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-2">{log.subject}</p>
                      )}

                      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        {log.notes}
                      </div>

                      {log.outcome && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm flex gap-2">
                          <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">Outcome:</span>
                          <span className="text-slate-600 dark:text-slate-400">{log.outcome}</span>
                        </div>
                      )}

                      {log.followUpDate && (
                        <div className={cn(
                          "mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-medium",
                          log.followUpDone ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {log.followUpDone
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <Bell className="h-3.5 w-3.5" />}
                          Follow-up: {format(parseISO(log.followUpDate), 'MMM d, yyyy')}
                          {log.followUpDone ? ' (Done)' : ' (Pending)'}
                        </div>
                      )}
                    </div>

                    {/* Follow-up thread */}
                    {log.followUps.length > 0 && (
                      <div className="mt-3 ml-8 pl-4 space-y-3 border-l-2 border-dashed border-slate-200 dark:border-slate-700">
                        {log.followUps.map(fu => (
                          <div key={fu.id} className={cn(
                            "relative rounded-lg border p-3 shadow-sm",
                            isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-100"
                          )}>
                            <div className="absolute -left-[21px] top-3 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-950" />
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={cn(
                                  "inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px]",
                                  fu.direction === 'Incoming' ? "bg-emerald-400" : "bg-indigo-400"
                                )}>
                                  {channelIcon(fu.channel)}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Follow-up · {fu.direction === 'Incoming' ? 'Received' : 'Sent'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {format(new Date(fu.date), 'MMM d, yyyy')}{fu.time && ` · ${fu.time}`}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-slate-400 hover:text-indigo-600 shrink-0"
                                onClick={() => navigate(`/comm-log?highlightId=${fu.id}`)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                            {fu.subject && (
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{fu.subject}</p>
                            )}
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{fu.notes}</p>
                            {fu.outcome && (
                              <p className="text-xs text-slate-500 mt-1.5 italic">→ {fu.outcome}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
