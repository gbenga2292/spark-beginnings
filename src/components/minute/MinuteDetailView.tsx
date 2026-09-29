import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  ListTodo,
  ExternalLink,
  MapPin,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { MeetingMinute, MeetingActionItem } from '@/src/types/minute';

interface MinuteDetailViewProps {
  minute: MeetingMinute;
  onEdit: () => void;
  onConvertToTasks: (selectedItems: MeetingActionItem[]) => void;
  onOpenTask: (taskId: string) => void;
  isConverting?: boolean;
}

export function MinuteDetailView({
  minute,
  onEdit,
  onConvertToTasks,
  onOpenTask,
  isConverting = false,
}: MinuteDetailViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const uncoverted = minute.actionItems.filter((a) => !a.convertedToTaskId);
    if (selectedIds.size === uncoverted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uncoverted.map((a) => a.id)));
    }
  };

  const handleConvert = () => {
    const itemsToConvert = minute.actionItems.filter((a) => selectedIds.has(a.id) && !a.convertedToTaskId);
    if (itemsToConvert.length === 0) return;
    onConvertToTasks(itemsToConvert);
  };

  return (
    <div className="space-y-6">
      {/* Title & Metadata Card */}
      <div className="rounded-xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold px-2.5 py-0.5 border-teal-500/30 text-teal-700 dark:text-teal-300 bg-teal-500/10"
          >
            {minute.meetingType} Meeting
          </Badge>
          <Badge variant="outline" className="text-[11px] text-muted-foreground uppercase">
            {minute.status || 'Draft'}
          </Badge>
          {minute.engineUsed && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase">
              Engine: {minute.engineUsed}
            </Badge>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {minute.title}
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground block">Date</span>
              <span className="font-semibold text-foreground">{minute.date}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground block">Time</span>
              <span className="font-semibold text-foreground">{minute.time || 'Not specified'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            <User className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Chair / Organizer</span>
              <span className="font-semibold text-foreground truncate block">{minute.chairPerson || 'HR Admin'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Location</span>
              <span className="font-semibold text-foreground truncate block">{minute.location || 'Conference Room'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendees Section */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          Attendees Present ({minute.attendees?.length || 0})
        </h2>
        <div className="flex flex-wrap gap-2 pt-1">
          {minute.attendees && minute.attendees.length > 0 ? (
            minute.attendees.map((att, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-xs py-1 px-3 bg-muted/30 border-border font-medium"
              >
                {att}
              </Badge>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">No attendees recorded.</p>
          )}
        </div>

        {minute.absentees && minute.absentees.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Apologies / Absent:</span>
            <div className="flex flex-wrap gap-2">
              {minute.absentees.map((abs, i) => (
                <Badge key={i} variant="outline" className="text-xs py-0.5 px-2 text-muted-foreground bg-muted/20">
                  {abs}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Executive Summary */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Executive Summary
        </h2>
        <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
          {minute.executiveSummary || 'No executive summary recorded for this minute.'}
        </p>
      </div>

      {/* Key Decisions */}
      {minute.keyDecisions && minute.keyDecisions.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Key Decisions &amp; Resolutions
          </h2>
          <div className="space-y-2 pt-1">
            {minute.keyDecisions.map((dec, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/40 text-xs">
                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-foreground leading-relaxed">{dec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items & Company HR Tasks */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ListTodo className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Action Items &amp; Assigned Deliverables ({minute.actionItems?.length || 0})
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Click &quot;View Task&quot; on any converted item to open the live HR task details, comments, and status.
            </p>
          </div>

          {minute.actionItems && minute.actionItems.some((a) => !a.convertedToTaskId) && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="h-8 text-xs"
              >
                {selectedIds.size === minute.actionItems.filter((a) => !a.convertedToTaskId).length
                  ? 'Deselect All'
                  : 'Select Unconverted'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConvert}
                disabled={selectedIds.size === 0 || isConverting}
                className="h-8 px-3 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isConverting ? 'Converting...' : `Convert (${selectedIds.size}) to Tasks`}</span>
              </Button>
            </div>
          )}
        </div>

        {minute.actionItems && minute.actionItems.length > 0 ? (
          <div className="space-y-2.5">
            {minute.actionItems.map((item, idx) => {
              const isConverted = Boolean(item.convertedToTaskId);
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id || idx}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isConverted
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : isSelected
                      ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30'
                      : 'border-border/70 bg-card hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {!isConverted ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {item.assigneeName && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {item.assigneeName}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            Due: {item.dueDate}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase px-1.5 py-0 font-bold border-border/60"
                        >
                          {item.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Task Link Action */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isConverted ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onOpenTask(item.convertedToTaskId!)}
                        className="h-7 text-xs bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-2.5 transition-colors gap-1 border border-emerald-500/30"
                      >
                        <span>View Task</span>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground bg-muted/20">
                        Not converted
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No action items logged for this meeting.</p>
        )}
      </div>

      {/* Agenda Topics */}
      {minute.agendaTopics && minute.agendaTopics.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Agenda Topics &amp; Discussions
          </h2>
          <div className="space-y-4">
            {minute.agendaTopics.map((topic, i) => (
              <div key={topic.id || i} className="p-3.5 rounded-lg bg-muted/20 border border-border/60 space-y-2">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {topic.topic}
                </h3>
                {topic.discussion && (
                  <p className="text-xs text-muted-foreground leading-relaxed pl-7 whitespace-pre-line">
                    {topic.discussion}
                  </p>
                )}
                {topic.decisions && topic.decisions.length > 0 && (
                  <div className="pl-7 pt-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1">
                      Topic Resolutions:
                    </span>
                    <ul className="list-disc list-inside text-xs text-foreground space-y-0.5">
                      {topic.decisions.map((d, dIdx) => (
                        <li key={dIdx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MinuteDetailView;
