import React, { useMemo, useState } from 'react';
import type { MainTask, SubTask, AppUser } from '@/src/types/tasks';
import { format, differenceInDays, eachDayOfInterval, addDays, startOfDay, isToday, isBefore, isAfter, max, min, addWeeks, startOfWeek, eachWeekOfInterval, endOfWeek, isValid } from 'date-fns';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2, Hourglass, CalendarRange, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';

interface TaskGanttViewProps {
  mainTasks: MainTask[];
  subtasks: SubTask[];
  users: AppUser[];
  onOpenSubtask: (id: string) => void;
  onOpenMainTask: (id: string) => void;
}

type ZoomLevel = 'days' | 'weeks';

export function TaskGanttView({ mainTasks, subtasks, users, onOpenSubtask, onOpenMainTask }: TaskGanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('days');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (mtId: string) => {
    setExpandedRows(prev => ({ ...prev, [mtId]: !prev[mtId] }));
  };

  // 1. Process data to determine min and max dates across all tasks
  const { processedMainTasks, globalMinDate, globalMaxDate } = useMemo(() => {
    let minD = new Date();
    let maxD = new Date();
    let isFirst = true;

    const pm: any[] = [];

    mainTasks.forEach(mt => {
      const mtSubs = subtasks.filter(s => s.mainTaskId === mt.id);
      
      const safeMtCreated = parseDateSafe(mt.createdAt, new Date());
      let mtStart = new Date(safeMtCreated);
      let mtEnd = mt.deadline ? parseDateSafe(mt.deadline, safeMtCreated) : new Date(safeMtCreated);

      const processedSubs = mtSubs.map(sub => {
        const safeSubCreated = parseDateSafe(sub.createdAt, safeMtCreated);
        const start = new Date(safeSubCreated);
        const end = sub.deadline ? parseDateSafe(sub.deadline, addDays(start, 1)) : addDays(start, 1);
        
        if (isFirst) { minD = start; maxD = end; isFirst = false; }
        if (isBefore(start, minD)) minD = start;
        if (isAfter(end, maxD)) maxD = end;

        return { ...sub, start, end };
      }).sort((a, b) => a.start.getTime() - b.start.getTime());

      if (processedSubs.length > 0) {
        const earliest = processedSubs[0].start;
        const latest = processedSubs.reduce((acc, curr) => isAfter(curr.end, acc) ? curr.end : acc, processedSubs[0].end);
        if (isBefore(earliest, mtStart)) mtStart = earliest;
        if (isAfter(latest, mtEnd)) mtEnd = latest;
      }

      if (isFirst) { minD = mtStart; maxD = mtEnd; isFirst = false; }
      if (isBefore(mtStart, minD)) minD = mtStart;
      if (isAfter(mtEnd, maxD)) maxD = mtEnd;

      pm.push({
        ...mt,
        start: mtStart,
        end: mtEnd,
        subs: processedSubs,
        progress: mtSubs.length ? (mtSubs.filter(s => s.status === 'completed').length / mtSubs.length) * 100 : 0
      });
    });

    // Add some padding to the timeline view
    if (zoom === 'days') {
      minD = addDays(minD, -2);
      maxD = addDays(maxD, 5);
    } else {
      minD = addWeeks(startOfWeek(minD), -1);
      maxD = addWeeks(endOfWeek(maxD), 2);
    }

    return { processedMainTasks: pm, globalMinDate: minD, globalMaxDate: maxD };
  }, [mainTasks, subtasks, zoom]);

  // 2. Build the exact timeline intervals based on zoom level
  const timelineColumns = useMemo(() => {
    if (zoom === 'days') {
      return eachDayOfInterval({ start: globalMinDate, end: globalMaxDate }).map(d => ({
        date: d,
        label: format(d, 'd'),
        subLabel: format(d, 'eee'),
        isToday: isToday(d),
      }));
    } else {
      return eachWeekOfInterval({ start: globalMinDate, end: globalMaxDate }).map(d => ({
        date: d,
        label: `Week ${format(d, 'w')}`,
        subLabel: format(d, 'MMM d'),
        isToday: isToday(d) || (isBefore(new Date(), endOfWeek(d)) && isAfter(new Date(), d)),
      }));
    }
  }, [globalMinDate, globalMaxDate, zoom]);

  const totalRange = zoom === 'days' 
    ? timelineColumns.length 
    : timelineColumns.length * 7 || 1;

  // CSS positioning logic
  const getStyleForBar = (start: Date, end: Date) => {
    const sDiff = Math.max(0, differenceInDays(start, globalMinDate));
    const eDiff = Math.max(0, differenceInDays(end, globalMinDate));
    const duration = Math.max(1, eDiff - sDiff); // minimum 1 day width
    const leftPx = (sDiff / totalRange) * 100;
    const widthPx = (duration / totalRange) * 100;
    return { left: `${Math.min(100, Math.max(0, leftPx))}%`, width: `${Math.min(100, Math.max(0.5, widthPx))}%` };
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (status === 'completed') return 'bg-gradient-to-r from-emerald-500 to-emerald-400 border-emerald-600/50 shadow-emerald-500/20';
    if (status === 'pending_approval') return 'bg-gradient-to-r from-amber-500 to-amber-400 border-amber-600/50 shadow-amber-500/20';
    if (status === 'in_progress') return isOverdue ? 'bg-gradient-to-r from-red-500 to-red-400 border-red-600/50 shadow-red-500/20' : 'bg-gradient-to-r from-indigo-500 to-blue-500 border-indigo-600/50 shadow-indigo-500/20';
    return isOverdue ? 'bg-gradient-to-r from-red-500 to-red-400 border-red-600/50 shadow-red-500/20' : 'bg-gradient-to-r from-slate-400 to-slate-300 dark:from-slate-600 dark:to-slate-500 border-slate-400/50 shadow-slate-500/20';
  };

  if (mainTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-border mt-4">
        <CalendarRange className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">No Tasks Yet</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">Create some tasks and subtasks to see them plotted on the Gantt chart timeline.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[500px]">
      
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Project Timeline</h2>
        </div>
        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border/50">
          <button onClick={() => setZoom('days')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${zoom === 'days' ? 'bg-card text-primary shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground'}`}>Days</button>
          <button onClick={() => setZoom('weeks')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${zoom === 'weeks' ? 'bg-card text-primary shadow-sm ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground'}`}>Weeks</button>
        </div>
      </div>

      {/* ── Chart Container ── */}
      <div className="flex flex-1 overflow-x-auto overflow-y-auto">
        
        {/* Left Panel: Task List */}
        <div className="w-[320px] flex-shrink-0 border-r border-border bg-card sticky left-0 z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)]">
          <div className="h-14 border-b border-r border-border/50 flex items-center px-4 bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-card px-2 py-1 rounded shadow-sm border border-border/50">Tasks & Assignments</span>
          </div>
          <div className="pb-10">
            {processedMainTasks.map(mt => {
              const isOpen = expandedRows[mt.id];
              return (
                <div key={mt.id}>
                  {/* Main Task Row */}
                  <div className="h-14 border-b border-border/50 flex items-center px-2 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group bg-muted/10">
                    <button onClick={() => toggleExpand(mt.id)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-card shadow-sm text-foreground bg-white/50 dark:bg-black/50 border border-border/50 mr-2 transition-all group-hover:border-indigo-200">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={() => onOpenMainTask(mt.id)}>
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                        {mt.title}
                        {mt.progress === 100 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </p>
                      <div className="w-full bg-border/40 h-[2px] mt-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${mt.progress}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Subtask Rows */}
                  <AnimatePresence>
                    {isOpen && mt.subs.map((sub: any) => {
                      const isSubOverdue = sub.deadline && isPastDay(sub.deadline) && sub.status !== 'completed';
                      const assignee = users.find(u => u.id === sub.assignedTo?.split(',')[0]);
                      return (
                          <motion.div
                            key={sub.id}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 40, opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-b border-border/30 flex items-center pl-9 pr-3 bg-card hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer overflow-hidden group transition-colors"
                            onClick={() => onOpenSubtask(sub.id)}
                          >
                          <div className="w-5 h-5 rounded-md border border-border/50 bg-white dark:bg-black/20 flex items-center justify-center mr-2 flex-shrink-0">
                            {sub.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : sub.status === 'in_progress' ? <Loader2 className="w-3 h-3 text-indigo-500" /> : <Circle className="w-3 h-3 text-muted-foreground/50" />}
                          </div>
                          <div className="flex-1 min-w-0 pr-2 flex items-center justify-between">
                            <p className={`text-[11px] font-medium truncate group-hover:text-indigo-600 transition-colors ${sub.status === 'completed' ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}>
                              {sub.title}
                            </p>
                            {isSubOverdue && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 ml-1" />}
                          </div>
                          {assignee && (
                            <Avatar className="w-5 h-5 flex-shrink-0 ml-2 border border-border">
                              <AvatarImage src={assignee.avatarUrl || (assignee as any).avatar} />
                              <AvatarFallback className={`text-[8px] text-white font-bold ${assignee.avatarColor}`}>
                                {assignee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Timeline Grid */}
        <div className="flex-1 min-w-[500px] bg-card relative">
          
          {/* Header Axis */}
          <div className="h-14 border-b border-border sticky top-0 z-10 flex bg-card/95 backdrop-blur-sm shadow-sm">
            {timelineColumns.map((col, idx) => (
              <div key={idx} className={`flex-1 min-w-[40px] border-r border-border/40 flex flex-col items-center justify-center py-1 ${col.isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                <span className={`text-[9px] uppercase tracking-wider font-bold ${col.isToday ? 'text-indigo-500' : 'text-muted-foreground/70'}`}>{col.subLabel}</span>
                <span className={`text-sm tracking-tight font-black ${col.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground/80'}`}>{col.label}</span>
              </div>
            ))}
          </div>

          {/* Grid Area */}
          <div className="relative pb-10">
            {/* Vertical grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {timelineColumns.map((col, idx) => (
                <div key={idx} className={`flex-1 border-r ${col.isToday ? 'border-solid border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-dashed border-border/60'}`} />
              ))}
            </div>

            {/* Timelines Bars */}
            <div className="relative z-10 w-full pt-[0px]">
              {processedMainTasks.map(mt => {
                const isOpen = expandedRows[mt.id];
                const mainStyle = getStyleForBar(mt.start, mt.end);
                
                return (
                  <div key={mt.id}>
                    {/* Main Task Bar */}
                    <div className="h-14 border-b border-transparent relative w-full group cursor-pointer" onClick={() => onOpenMainTask(mt.id)}>
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-black/5 dark:border-white/5 overflow-hidden shadow-sm transition-all group-hover:scale-y-150 group-hover:brightness-105"
                        style={mainStyle}
                      >
                         <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500/80 relative transition-all duration-500" style={{ width: `${mt.progress}%` }}>
                            {/* Inner gloss/shine effect for realism */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent mix-blend-overlay" />
                         </div>
                      </div>
                    </div>

                    {/* Subtask Bars */}
                    <AnimatePresence>
                      {isOpen && mt.subs.map((sub: any) => {
                        const subStyle = getStyleForBar(sub.start, sub.end);
                        const isSubOverdue = sub.deadline && isPastDay(sub.deadline) && sub.status !== 'completed';
                        const barColor = getStatusColor(sub.status, isSubOverdue);
                        
                        return (
                          <motion.div
                            key={sub.id}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 40, opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="relative w-full border-b border-transparent cursor-pointer group overflow-hidden"
                            onClick={() => onOpenSubtask(sub.id)}
                          >
                            <div 
                               className={`absolute top-1/2 -translate-y-1/2 h-[22px] rounded-md border shadow-sm flex items-center px-2.5 transition-all group-hover:-translate-y-[60%] group-hover:shadow-md ${barColor}`}
                               style={subStyle}
                            >
                               {/* Inner gloss overlay */}
                               <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent mix-blend-overlay rounded-md pointer-events-none" />
                               <span className="text-[10px] font-bold text-white truncate drop-shadow-md select-none relative z-10 lg:inline-block md:hidden">{sub.title}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function isPastDay(dateString: string) {
  const d = parseDateSafe(dateString, new Date());
  return isBefore(d, startOfDay(new Date()));
}

function parseDateSafe(val: any, fallback: Date): Date {
  if (!val) return fallback;
  if (typeof val === 'object' && val.seconds) {
    return new Date(val.seconds * 1000);
  }
  const d = new Date(val);
  return isValid(d) ? d : fallback;
}
