import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardCheck, Wrench, Truck, Activity, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, ArrowRight, ChevronDown, ChevronUp,
  Package, Fuel, Zap, Plus, ExternalLink, PauseCircle, PlayCircle,
  FileText, ShieldAlert, Sparkles, Droplets
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Site, Invoice } from '@/src/store/appStore';
import { Waybill, SiteHoldPeriod } from '@/src/types/operations';
import { SiteRequest } from '@/src/types/siteRequests';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';

export type StageId = 'p1_plan' | 'p2_resources' | 'p3_mobilize' | 'p4_execute' | 'p5_closure';

export interface StageStatus {
  id: StageId;
  sopRange: string;
  title: string;
  shortTitle: string;
  icon: any;
  state: 'completed' | 'active' | 'warning' | 'pending' | 'blocked';
  headline: string;
  details: {
    label: string;
    value: string | number;
    tone?: 'default' | 'success' | 'warning' | 'danger';
  }[];
  primaryAction?: {
    label: string;
    icon: any;
    onClick: () => void;
  };
  targetTab: 'timeline' | 'financials' | 'operations' | 'maintenance' | 'comms' | 'tasks' | 'requests';
  targetSubTab?: string;
}

interface SiteLifecycleStepperProps {
  site: Site;
  siteWaybills: Waybill[];
  siteRequests?: SiteRequest[];
  machineLogs: any[];
  pumpsOnSite: any[];
  materialsOnSite: any[];
  siteMaintAssets: any[];
  siteTasks: any[];
  pendingTasksCount: number;
  activeHold?: SiteHoldPeriod;
  totalDiesel: number;
  totalBilled: number;
  outstanding: number;
  onNavigateTab: (tab: any, subTab?: string) => void;
  onOpenHoldModal?: () => void;
  onQuickTask?: () => void;
  className?: string;
}

export function SiteLifecycleStepper({
  site,
  siteWaybills,
  siteRequests = [],
  machineLogs,
  pumpsOnSite,
  materialsOnSite,
  siteMaintAssets,
  siteTasks,
  pendingTasksCount,
  activeHold,
  totalDiesel,
  totalBilled,
  outstanding,
  onNavigateTab,
  onOpenHoldModal,
  onQuickTask,
  className
}: SiteLifecycleStepperProps) {
  const [expandedStage, setExpandedStage] = useState<StageId | null>(null);

  // ── 1. Calculate Live Stage States ──────────────────────────────────────────

  // Stage 1: P100 - P160 (Work Order & Planning)
  const stage1Status = useMemo((): StageStatus => {
    const siteAny = site as any;
    const hasMilestones = (siteAny.milestones && siteAny.milestones.length > 0) || (siteAny.timeline && siteAny.timeline.length > 0);
    const hasTasks = siteTasks.length > 0;
    const isCompleted = hasMilestones || (site.startDate && hasTasks);

    return {
      id: 'p1_plan',
      sopRange: 'P100 – P160',
      title: 'Order & Work Plan',
      shortTitle: 'Plan (P100-160)',
      icon: ClipboardCheck,
      state: isCompleted ? 'completed' : (site.startDate ? 'active' : 'warning'),
      headline: isCompleted ? 'Work plan & scope initialized' : 'Scope pending full definition',
      details: [
        { label: 'Start Date', value: site.startDate ? new Date(site.startDate).toLocaleDateString('en-GB') : 'Not Set' },
        { label: 'Work Milestones', value: siteAny.milestones?.length || siteAny.timeline?.length || 0 },
        { label: 'Linked Tasks', value: siteTasks.length },
        { label: 'Open Blockers', value: pendingTasksCount, tone: pendingTasksCount > 0 ? 'warning' : 'default' },
      ],
      primaryAction: {
        label: 'View Timeline & Milestones',
        icon: ExternalLink,
        onClick: () => onNavigateTab('timeline'),
      },
      targetTab: 'timeline',
    };
  }, [site, siteTasks, pendingTasksCount, onNavigateTab]);

  // Stage 2: P170 - P210 (Material Needs & Machine Readiness)
  const stage2Status = useMemo((): StageStatus => {
    const pendingReqs = siteRequests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    const urgentReqs = pendingReqs.filter(r => r.urgency === 'urgent' || r.urgency === 'critical');
    
    // Check if any machine on site or assigned needs maintenance
    const badMachines = siteMaintAssets.filter(m => m.status === 'overdue' || m.status === 'in_service' || m.operationalStatus === 'under_maintenance');
    const isBlocked = urgentReqs.length > 0 || badMachines.length > 0;
    const hasFulfilledMaterials = materialsOnSite.length > 0 || siteRequests.some(r => r.status === 'fulfilled');

    let state: StageStatus['state'] = 'completed';
    if (isBlocked) state = 'warning';
    else if (pendingReqs.length > 0) state = 'active';
    else if (!hasFulfilledMaterials && !site.startDate) state = 'pending';

    return {
      id: 'p2_resources',
      sopRange: 'P170 – P210',
      title: 'Materials & Machine Prep',
      shortTitle: 'Prep (P170-210)',
      icon: Wrench,
      state,
      headline: badMachines.length > 0 
        ? `${badMachines.length} machine(s) require maintenance`
        : pendingReqs.length > 0
          ? `${pendingReqs.length} pending material requisition(s)`
          : 'All equipment & resources cleared',
      details: [
        { label: 'Pending Requests', value: pendingReqs.length, tone: pendingReqs.length > 0 ? 'warning' : 'default' },
        { label: 'Urgent Requisitions', value: urgentReqs.length, tone: urgentReqs.length > 0 ? 'danger' : 'default' },
        { label: 'Assigned Machines', value: siteMaintAssets.length },
        { label: 'Service Alerts', value: badMachines.length, tone: badMachines.length > 0 ? 'danger' : 'default' },
      ],
      primaryAction: {
        label: pendingReqs.length > 0 ? 'Manage Requisitions' : 'Check Maintenance Assets',
        icon: ExternalLink,
        onClick: () => pendingReqs.length > 0 ? onNavigateTab('requests') : onNavigateTab('maintenance'),
      },
      targetTab: pendingReqs.length > 0 ? 'requests' : 'maintenance',
    };
  }, [siteRequests, siteMaintAssets, materialsOnSite, site, onNavigateTab]);

  // Stage 3: P220 - P240 (Waybill & Mobilization)
  const stage3Status = useMemo((): StageStatus => {
    const outgoingWaybills = siteWaybills.filter(w => w.type === 'waybill');
    const inTransitWaybills = outgoingWaybills.filter(w => w.status === 'sent_to_site' || w.status === 'open');
    const isDelivered = outgoingWaybills.some(w => w.status !== 'outstanding');
    const isOnHold = !!activeHold;

    let state: StageStatus['state'] = 'pending';
    if (isOnHold) state = 'blocked';
    else if (isDelivered) state = 'completed';
    else if (inTransitWaybills.length > 0) state = 'active';

    return {
      id: 'p3_mobilize',
      sopRange: 'P220 – P240',
      title: 'Waybill & Mobilization',
      shortTitle: 'Mobilize (P220-240)',
      icon: Truck,
      state,
      headline: isOnHold 
        ? `Site on HOLD: ${activeHold.holdNote || 'Readiness re-evaluation'}`
        : isDelivered 
          ? `${outgoingWaybills.length} delivery waybill(s) processed`
          : inTransitWaybills.length > 0 
            ? 'Waybill dispatched / in transit to site'
            : 'Pending dispatch waybill generation',
      details: [
        { label: 'Site Readiness', value: isOnHold ? 'ON HOLD' : 'READY', tone: isOnHold ? 'danger' : 'success' },
        { label: 'Outgoing Waybills', value: outgoingWaybills.length },
        { label: 'Items on Site', value: materialsOnSite.length },
        { label: 'Hold Days', value: activeHold ? `${Math.max(1, Math.round((Date.now() - new Date(activeHold.holdStart).getTime()) / 86400000))}d` : 'None', tone: activeHold ? 'warning' : 'default' },
      ],
      primaryAction: {
        label: 'View Site Waybills',
        icon: ExternalLink,
        onClick: () => onNavigateTab('operations', 'waybills'),
      },
      targetTab: 'operations',
      targetSubTab: 'waybills',
    };
  }, [siteWaybills, materialsOnSite, activeHold, onNavigateTab]);

  // Stage 4: P250 - P280 (Execution & Issue Monitoring)
  const stage4Status = useMemo((): StageStatus => {
    const runningPumps = pumpsOnSite.filter(p => !p.pumpStopDate);
    const hasLogs = machineLogs.length > 0;
    const isOngoing = runningPumps.length > 0 || hasLogs;

    return {
      id: 'p4_execute',
      sopRange: 'P250 – P280',
      title: 'Operations & Monitoring',
      shortTitle: 'Execution (P250-280)',
      icon: Activity,
      state: isOngoing ? 'active' : (materialsOnSite.length > 0 ? 'warning' : 'pending'),
      headline: runningPumps.length > 0
        ? `${runningPumps.length} pump unit(s) actively running`
        : hasLogs
          ? `${machineLogs.length} machine operational logs recorded`
          : 'Awaiting first operational log entry',
      details: [
        { label: 'Active Pumps', value: `${runningPumps.length} / ${pumpsOnSite.length}`, tone: runningPumps.length > 0 ? 'success' : 'default' },
        { label: 'Diesel Consumed', value: `${Math.round(totalDiesel).toLocaleString()} L` },
        { label: 'Operational Logs', value: machineLogs.length },
        { label: 'Open Issues', value: pendingTasksCount, tone: pendingTasksCount > 0 ? 'warning' : 'default' },
      ],
      primaryAction: {
        label: 'View Machine & Run Logs',
        icon: ExternalLink,
        onClick: () => onNavigateTab('operations', 'logs'),
      },
      targetTab: 'operations',
      targetSubTab: 'logs',
    };
  }, [pumpsOnSite, machineLogs, materialsOnSite, totalDiesel, pendingTasksCount, onNavigateTab]);

  // Stage 5: P290 - P330 (Demobilization & Reconciliation)
  const stage5Status = useMemo((): StageStatus => {
    const returnWaybills = siteWaybills.filter(w => w.type === 'return');
    const returnedCompleted = returnWaybills.filter(w => w.status === 'return_completed');
    const remainingMaterials = materialsOnSite.length;
    const isClosed = site.status === 'Ended' && remainingMaterials === 0;

    let state: StageStatus['state'] = 'pending';
    if (isClosed) state = 'completed';
    else if (returnWaybills.length > 0 || remainingMaterials > 0) state = 'active';

    return {
      id: 'p5_closure',
      sopRange: 'P290 – P330',
      title: 'Demob & Reconciliation',
      shortTitle: 'Closure (P290-330)',
      icon: ShieldCheck,
      state,
      headline: isClosed 
        ? 'Site demobilized & fully reconciled'
        : remainingMaterials > 0 
          ? `${remainingMaterials} asset item(s) currently remaining on site`
          : returnWaybills.length > 0
            ? `${returnWaybills.length} return waybill(s) processed`
            : 'Pre-demobilization standby',
      details: [
        { label: 'Site Status', value: site.status?.toUpperCase() || 'ACTIVE', tone: site.status === 'Ended' ? 'success' : 'default' },
        { label: 'Remaining Assets', value: remainingMaterials, tone: remainingMaterials > 0 ? 'warning' : 'default' },
        { label: 'Return Waybills', value: returnWaybills.length },
        { label: 'Unpaid Balance', value: `₦${Math.round(outstanding).toLocaleString()}`, tone: outstanding > 0 ? 'warning' : 'success' },
      ],
      primaryAction: {
        label: 'Financials & Invoicing',
        icon: ExternalLink,
        onClick: () => onNavigateTab('financials'),
      },
      targetTab: 'financials',
    };
  }, [siteWaybills, materialsOnSite, site, outstanding, onNavigateTab]);

  const stages = [stage1Status, stage2Status, stage3Status, stage4Status, stage5Status];

  // Helper for badge colors
  const getStateBadge = (state: StageStatus['state']) => {
    switch (state) {
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">COMPLETED</Badge>;
      case 'active':
        return <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[10px] font-bold animate-pulse">ACTIVE</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">ATTENTION</Badge>;
      case 'blocked':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold">ON HOLD</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20 text-[10px] font-bold">STANDBY</Badge>;
    }
  };

  const getStepIconBg = (state: StageStatus['state'], isSelected: boolean) => {
    if (isSelected) {
      return 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md';
    }
    switch (state) {
      case 'completed':
        return 'bg-emerald-600 text-white shadow-xs';
      case 'active':
        return 'bg-sky-500 text-white shadow-xs ring-2 ring-sky-400/30';
      case 'warning':
        return 'bg-amber-500 text-white shadow-xs';
      case 'blocked':
        return 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/40';
      default:
        return 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
    }
  };

  return (
    <div className={cn("rounded-2xl border bg-white/95 dark:bg-slate-900/90 shadow-sm overflow-hidden border-slate-200/90 dark:border-slate-800/90", className)}>
      {/* ── Top Header Strip: Context & Hold Gate ── */}
      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
            SOP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black tracking-wide uppercase text-slate-900 dark:text-slate-100">
                Site Operations Lifecycle
              </h4>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                (Flowchart P100 – P330)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cross-departmental operational gates and live status audit
            </p>
          </div>
        </div>

        {/* Quick Operations Controls */}
        <div className="flex items-center gap-2">
          {onOpenHoldModal && (
            <Button
              size="sm"
              variant={activeHold ? "destructive" : "outline"}
              onClick={onOpenHoldModal}
              className={cn("h-7 px-2.5 text-[11px] font-semibold gap-1.5 rounded-md", 
                activeHold 
                  ? "bg-rose-600 hover:bg-rose-700 text-white" 
                  : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {activeHold ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span>{activeHold ? "Resume Site (P230)" : "Put On Hold (P230)"}</span>
            </Button>
          )}

          {onQuickTask && (
            <Button
              size="sm"
              variant="outline"
              onClick={onQuickTask}
              className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 rounded-md border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span>Log Action</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Stepper Nodes Strip ── */}
      <div className="p-3 sm:p-4 bg-slate-50/40 dark:bg-slate-900/40">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isExpanded = expandedStage === stage.id;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                className={cn(
                  "relative text-left p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between group",
                  isExpanded
                    ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs"
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
                )}
              >
                {/* Step Index & Range */}
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-[10px] font-extrabold font-mono tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    GATE 0{idx + 1}
                  </span>
                  {getStateBadge(stage.state)}
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all", getStepIconBg(stage.state, isExpanded))}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {stage.title}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                      {stage.sopRange}
                    </p>
                  </div>
                </div>

                {/* Subtext headline */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{stage.headline}</span>
                  <div className="shrink-0 text-slate-400 group-hover:text-blue-500 ml-1">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Expandable Stage Diagnostic & Synergy Handshake Drawer ── */}
      <AnimatePresence>
        {expandedStage && (() => {
          const activeStageData = stages.find(s => s.id === expandedStage);
          if (!activeStageData) return null;
          const StageIcon = activeStageData.icon;

          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-4 py-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <StageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {activeStageData.title}
                      </h3>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        [{activeStageData.sopRange}]
                      </span>
                      {getStateBadge(activeStageData.state)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeStageData.headline}
                    </p>
                  </div>
                </div>

                {/* Primary Action Button to Jump to Tab */}
                {activeStageData.primaryAction && (
                  <Button
                    size="sm"
                    onClick={activeStageData.primaryAction.onClick}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 rounded-lg shadow-xs"
                  >
                    <span>{activeStageData.primaryAction.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Metric Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                {activeStageData.details.map((item, dIdx) => (
                  <div 
                    key={dIdx}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {item.label}
                    </span>
                    <p className={cn("text-sm sm:text-base font-extrabold font-mono mt-0.5",
                      item.tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                      item.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                      item.tone === 'danger' ? 'text-rose-600 dark:text-rose-400' :
                      'text-slate-900 dark:text-slate-100'
                    )}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
