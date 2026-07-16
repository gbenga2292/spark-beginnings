import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from '../contexts/PageContext';
import { supabase } from '../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { isInternalSite } from '../lib/siteUtils';
import {
  Activity, Wrench, Package, Building2, MapPin, AlertCircle,
  AlertTriangle, TrendingDown, TrendingUp, ChevronDown, ChevronUp,
  CalendarDays, Fuel, Clock, FileText, X, Filter, Loader2,
  Bot, FlaskConical, Cpu, CheckCircle2, CircleDot, Circle, Zap, ArrowRight,
  BarChart3, Settings2, Lightbulb, ShieldAlert,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusBadge = (status: string) => {
  switch (status) {
    case 'overdue': return <Badge className="bg-rose-100 text-rose-700 border-rose-200 border">Overdue</Badge>;
    case 'due_soon': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">Due Soon</Badge>;
    case 'in_service': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">In Service</Badge>;
    default: return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">OK</Badge>;
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

// ─── Rolling velocity helper ──────────────────────────────────────────────────
function computeVelocity(siteId: string, entries: any[]): { velocity: number; progress: number; daysLeft: number | null; estDate: string | null } {
  const siteLogs = entries
    .filter((e: any) => e.siteId === siteId && e.progressPercentage != null)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (siteLogs.length === 0) return { velocity: 0, progress: 0, daysLeft: null, estDate: null };
  const progress = Math.max(...siteLogs.map((e: any) => e.progressPercentage!));
  if (progress >= 100) return { velocity: 0, progress: 100, daysLeft: 0, estDate: 'Completed' };
  const recent = siteLogs.slice(-6);
  let totalGain = 0; let intervals = 0;
  for (let i = 1; i < recent.length; i++) {
    const daysDiff = Math.max(1, (new Date(recent[i].createdAt).getTime() - new Date(recent[i-1].createdAt).getTime()) / 86400000);
    const gain = (recent[i].progressPercentage! - recent[i-1].progressPercentage!) / daysDiff;
    if (gain >= 0) { totalGain += gain; intervals++; }
  }
  const velocity = intervals > 0 ? totalGain / intervals : 0;
  if (velocity <= 0) return { velocity: 0, progress, daysLeft: null, estDate: null };
  const daysLeft = Math.ceil((100 - progress) / velocity);
  const d = new Date(); d.setDate(d.getDate() + daysLeft);
  return { velocity: Math.round(velocity * 10) / 10, progress, daysLeft, estDate: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) };
}

// ─── Recon Dialog ─────────────────────────────────────────────────────────────

interface ReconPhase {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'running' | 'done' | 'error';
  findings: string[];
  risks: string[];
}

interface ReconResult {
  phases: ReconPhase[];
  recommendations: string[];
  aiInsight?: string;
  summary: { activeSites: number; stalledSites: number; machinesAvailableSoon: number; pendingNeed: number; breachRisk: number };
}

interface ReconDialogProps {
  open: boolean;
  onClose: () => void;
  sites: any[];
  pendingSites: any[];
  maintenanceAssets: any[];
  dailyMachineLogs: any[];
  siteJournalEntries: any[];
  waybills: any[];
  dieselRefills: any[];
  workspaceId: string;
}

function ReconDialog({ open, onClose, sites, pendingSites, maintenanceAssets, dailyMachineLogs, siteJournalEntries, waybills, dieselRefills, workspaceId }: ReconDialogProps) {
  const [phases, setPhases] = useState<ReconPhase[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [summary, setSummary] = useState<ReconResult['summary'] | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [mode, setMode] = useState<'analytic' | 'hybrid'>('analytic');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Structured analysis results state
  const [analysedSites, setAnalysedSites] = useState<any[]>([]);
  const [fleetStats, setFleetStats] = useState<any>(null);
  const [progressStats, setProgressStats] = useState<any>(null);
  const [pipelineStats, setPipelineStats] = useState<any>(null);

  // Load workspace mode
  useEffect(() => {
    if (!open) return;
    supabase.from('workspace_settings').select('resource_allocation_mode').eq('workspace_id', workspaceId).maybeSingle()
      .then(({ data }) => { if (data?.resource_allocation_mode) setMode(data.resource_allocation_mode as any); });
  }, [open, workspaceId]);

  const updatePhase = useCallback((id: string, update: Partial<ReconPhase>) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runRecon = useCallback(async () => {
    setRunning(true); setDone(false); setAiInsight(null);
    const today = new Date().toISOString().split('T')[0];
    const activeSites = sites.filter(s => {
      if (s.status !== 'Active' || !s.startDate || isInternalSite(s)) return false;
      const onboarding = pendingSites.find(p =>
        p.siteId === s.id ||
        p.id === s.id ||
        (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
          p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
      );
      if (onboarding && onboarding.phase1?.whatIsBeingBuilt && onboarding.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') {
        return false;
      }
      return true;
    });

    const pendingDewatering = [
      ...pendingSites
        .filter(s => s.status === 'Pending' && s.phase1?.whatIsBeingBuilt?.trim().toLowerCase() === 'dewatering')
        .map(s => ({
          ...s,
          totalPumpsRequired: parseInt(s.phase3?.totalPumpsRequired || '0', 10) || 0,
        })),
      ...sites
        .filter(s => {
          if (s.status !== 'Active' || isInternalSite(s) || (s.startDate && s.startDate.trim() !== '')) return false;
          const onboarding = pendingSites.find(p =>
            p.siteId === s.id ||
            p.id === s.id ||
            (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
              p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
          );
          if (onboarding && onboarding.phase1?.whatIsBeingBuilt && onboarding.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') {
            return false;
          }
          return true;
        })
        .map(s => {
          const onboarding = pendingSites.find(p =>
            p.siteId === s.id ||
            p.id === s.id ||
            (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
              p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
          );
          return {
            id: s.id,
            siteName: s.name,
            clientName: s.client,
            phase3: {
              totalPumpsRequired: onboarding?.phase3?.totalPumpsRequired || '0'
            }
          };
        })
    ];
    const machines = maintenanceAssets.filter(m => m.category === 'machine' && m.isActive);

    const initPhases: ReconPhase[] = [
      { id: 'sites', label: 'Scanning Active Sites', icon: MapPin, status: 'pending', findings: [], risks: [] },
      { id: 'machines', label: 'Machine Status & Maintenance', icon: Wrench, status: 'pending', findings: [], risks: [] },
      { id: 'progress', label: 'Site Progress Velocity', icon: TrendingUp, status: 'pending', findings: [], risks: [] },
      { id: 'pipeline', label: 'Pending Site Pipeline', icon: ArrowRight, status: 'pending', findings: [], risks: [] },
      { id: 'risk', label: 'Risk Assessment', icon: ShieldAlert, status: 'pending', findings: [], risks: [] },
    ];
    setPhases(initPhases);

    // ── PHASE 1: Sites Scan ──────────────────────────────────────────────────
    updatePhase('sites', { status: 'running' });
    await sleep(600);
    const siteFindings: string[] = [];
    const siteRisks: string[] = [];
    siteFindings.push(`Sir, I have scanned our active sites. We currently have ${activeSites.length} active dewatering engagements.`);

    const endedSoon = activeSites.filter(s => s.endDate && s.endDate >= today && (new Date(s.endDate).getTime() - Date.now()) < 14 * 86400000);
    if (endedSoon.length > 0) siteRisks.push(`Notice: ${endedSoon.length} site(s) are nearing their contracted end date within 14 days: ${endedSoon.map((s:any) => s.name).join(', ')}.`);
    const noEndDate = activeSites.filter(s => !s.endDate);
    if (noEndDate.length > 0) siteRisks.push(`Attention Needed: ${noEndDate.length} site(s) are currently open-ended (no end date set). I recommend defining estimated completion dates to assist demob planning.`);

    // Set active sites data immediately
    const structuredSitesData = activeSites.map(s => {
      const siteMachines = machines.filter(m => m.site === s.name);
      const mList = siteMachines.map(m => {
        const mLogs = dailyMachineLogs.filter(l => l.assetId === m.id && l.isActive).sort((a, b) => b.date.localeCompare(a.date));
        const latestLog = mLogs[0];
        const statusMap = { full: 'Full Day', half: 'Half Day', off: 'Off' };
        return { name: m.name, lastLogStatus: latestLog ? (statusMap[latestLog.operationalDay as 'full' | 'half' | 'off'] || latestLog.operationalDay) : null, lastLogDate: latestLog?.date };
      });
      return { id: s.id, name: s.name, client: s.client, progress: s.currentProgressPercentage ?? 0, endDate: s.endDate || null, machines: mList };
    });
    setAnalysedSites(structuredSitesData);
    updatePhase('sites', { status: 'done', findings: siteFindings, risks: siteRisks });

    // ── PHASE 2: Machine Status ──────────────────────────────────────────────
    updatePhase('machines', { status: 'running' });
    await sleep(700);
    const machineFindings: string[] = [];
    const machineRisks: string[] = [];
    const overdueM = machines.filter(m => m.status === 'overdue');
    const dueSoonM = machines.filter(m => m.status === 'due_soon');
    const inServiceM = machines.filter(m => m.operationalStatus === 'under_maintenance');
    const idleM = machines.filter(m => m.operationalStatus === 'idle' || isInternalSite({ name: m.site }));

    machineFindings.push(`Our total pump fleet is ${machines.length} units. Currently, ${machines.filter(m => !isInternalSite({ name: m.site }) && m.operationalStatus !== 'idle' && m.operationalStatus !== 'under_maintenance').length} are actively deployed on client sites.`);
    if (idleM.length > 0) machineFindings.push(`We have ${idleM.length} pump(s) idle in the warehouse: ${idleM.map((m:any) => m.name).join(', ')}.`);
    if (overdueM.length > 0) machineRisks.push(`Action Required: ${overdueM.length} pump(s) are OVERDUE for servicing. Please send them to the workshop before redeployment: ${overdueM.map((m:any) => m.name).join(', ')}.`);
    if (dueSoonM.length > 0) machineRisks.push(`Reminder: ${dueSoonM.length} pump(s) are approaching their service intervals and should be scheduled for servicing soon.`);
    if (inServiceM.length > 0) machineFindings.push(`Note: ${inServiceM.length} pump(s) are currently undergoing workshop maintenance.`);

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenStr = sevenDaysAgo.toISOString().split('T')[0];
    const underutilised = new Map<string, { site: string; halfDays: number; noneDays: number }>();
    dailyMachineLogs.filter(l => l.date >= sevenStr).forEach(log => {
      if (!underutilised.has(log.assetId)) underutilised.set(log.assetId, { site: log.siteName, halfDays: 0, noneDays: 0 });
      const e = underutilised.get(log.assetId)!;
      if (log.operationalDay === 'half') e.halfDays++;
      else if (log.operationalDay === 'none') e.noneDays++;
    });
    const partialMachines: { name: string; site: string; halfDays: number; noneDays: number }[] = [];
    underutilised.forEach((v, assetId) => {
      const m = machines.find(m => m.id === assetId);
      if ((v.halfDays + v.noneDays) >= 3) {
        partialMachines.push({
          name: m?.name || assetId,
          site: v.site,
          halfDays: v.halfDays,
          noneDays: v.noneDays
        });
      }
    });
    if (partialMachines.length > 0) {
      machineRisks.push(`Alert: Underutilized pumps detected (3+ partial/idle days this week): ${partialMachines.map(pm => `${pm.name} at ${pm.site} (${pm.halfDays} half + ${pm.noneDays} idle days this week)`).join('; ')}.`);
    }
    
    // Set fleet stats immediately
    setFleetStats({ total: machines.length, active: machines.filter(m => !isInternalSite({ name: m.site }) && m.operationalStatus !== 'idle' && m.operationalStatus !== 'under_maintenance').length, idle: idleM, maintenance: inServiceM, overdue: overdueM, dueSoon: dueSoonM, underutilised: partialMachines });
    updatePhase('machines', { status: 'done', findings: machineFindings, risks: machineRisks });

    // ── PHASE 3: Progress Velocity ───────────────────────────────────────────
    updatePhase('progress', { status: 'running' });
    await sleep(700);
    let stalledCount = 0; let onTrackCount = 0; let breachCount = 0;
    const siteVelocities: { name: string; velocity: number; progress: number; daysLeft: number | null; estDate: string | null; breach: boolean }[] = [];
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeStr = threeDaysAgo.toISOString().split('T')[0];

    activeSites.forEach(site => {
      const v = computeVelocity(site.id, siteJournalEntries);
      if (v.progress === 0 && site.currentProgressPercentage != null) v.progress = site.currentProgressPercentage;
      const breach = site.endDate && v.daysLeft != null ? new Date(site.endDate) < new Date(Date.now() + v.daysLeft * 86400000) : false;
      siteVelocities.push({ name: site.name, ...v, breach });
      const activeLogsIn3Days = dailyMachineLogs.filter(l => 
        (l.siteId === site.id || l.siteName?.toLowerCase().trim() === site.name.toLowerCase().trim()) &&
        l.date >= threeStr && l.isActive && (l.operationalDay === 'full' || l.operationalDay === 'half')
      );
      if (activeLogsIn3Days.length > 0) onTrackCount++; else if (v.progress < 100) stalledCount++;
      if (breach) breachCount++;
    });
    const stalledSites = activeSites.filter(s => {
      const activeLogs = dailyMachineLogs.filter(l => 
        (l.siteId === s.id || l.siteName?.toLowerCase().trim() === s.name.toLowerCase().trim()) &&
        l.date >= threeStr && l.isActive && (l.operationalDay === 'full' || l.operationalDay === 'half')
      );
      return activeLogs.length === 0;
    });
    const progRisks: string[] = [];
    if (stalledSites.length > 0) progRisks.push(`Warning: No operational pump activity logged in the last 3 days for: ${stalledSites.map(s => s.name).join(', ')}.`);
    if (breachCount > 0) progRisks.push(`High Risk: ${breachCount} site(s) are projected to breach their target dates.`);

    // Set progress stats immediately
    setProgressStats({ runningCount: onTrackCount, stalledCount: stalledCount, stalledSites: stalledSites.map(s => ({ name: s.name })), breachCount: breachCount, breachSites: siteVelocities.filter(s => s.breach).map(s => ({ name: s.name, estDate: s.estDate })) });
    updatePhase('progress', { status: 'done', findings: [], risks: progRisks });

    // ── PHASE 4: Pending Pipeline ────────────────────────────────────────────
    updatePhase('pipeline', { status: 'running' });
    await sleep(600);
    const totalPumpsNeeded = pendingDewatering.reduce((sum: number, s: any) => sum + (parseInt(s.phase3?.totalPumpsRequired || '0') || 0), 0);
    const almostDoneForDemob = siteVelocities.filter(s => s.progress >= 80 && s.progress < 100);

    // Flag sites that are 100% completed but still have pumps on site
    const completedSitesWithPumps = activeSites.filter(s => {
      const isCompleted = s.currentProgressPercentage === 100;
      const hasPumps = machines.some(m => m.site === s.name);
      return isCompleted && hasPumps;
    });

    const pipelineCompletedOpportunities = completedSitesWithPumps.map(s => {
      const siteMachines = machines.filter(m => m.site === s.name);
      return {
        name: s.name,
        machines: siteMachines.map(m => m.name)
      };
    });

    // Set pipeline stats immediately
    setPipelineStats({ 
      pendingCount: pendingDewatering.length, 
      totalPumpsNeeded: totalPumpsNeeded, 
      idleAvailable: idleM.length, 
      demobOpportunities: almostDoneForDemob.map(s => ({ name: s.name, daysLeft: s.daysLeft, progress: s.progress })),
      completedOpportunities: pipelineCompletedOpportunities
    });
    updatePhase('pipeline', { status: 'done', findings: [], risks: [] });

    // ── PHASE 5: Risk Summary ────────────────────────────────────────────────
    updatePhase('risk', { status: 'running' });
    await sleep(500);
    const recs: string[] = [];

    // High priority: demobilize completed sites
    completedSitesWithPumps.forEach(s => {
      const siteMachines = machines.filter(m => m.site === s.name);
      recs.push(`📦 Demobilize equipment [${siteMachines.map(m => m.name).join(', ')}] from ${s.name} IMMEDIATELY (site is 100% complete) and dispatch to pending pipeline.`);
    });

    if (overdueM.length > 0) recs.push(`🔧 Send ${overdueM.map((m:any) => m.name).join(', ')} to the workshop for servicing before dispatching.`);
    if (idleM.length > 0 && totalPumpsNeeded > 0) recs.push(`🚀 Dispatch our ${idleM.length} idle pump(s) [${idleM.map((m:any) => m.name).join(', ')}] immediately to the pending queue sites.`);
    almostDoneForDemob.forEach(s => {
      const daysStr = s.daysLeft != null ? `in ~${s.daysLeft} days` : `soon (progress: ${s.progress}%)`;
      recs.push(`📦 Schedule logistics for equipment demob from ${s.name} ${daysStr}.`);
    });
    if (breachCount > 0) recs.push(`⚡ Escalate: ${breachCount} site(s) are at risk of date breach. I recommend increasing onsite pump capacity.`);
    if (stalledSites.length > 0) recs.push(`📞 Contact site supervisors for stalled sites [${stalledSites.map(s => s.name).join(', ')}] to check why no pump activity was logged.`);
    if (recs.length === 0) recs.push('Sir, all dewatering sites and equipment metrics are nominal. No urgent actions needed.');
    updatePhase('risk', { status: 'done', findings: [], risks: [] });

    setRecommendations(recs);
    setSummary({ activeSites: activeSites.length, stalledSites: stalledCount, machinesAvailableSoon: almostDoneForDemob.length, pendingNeed: totalPumpsNeeded, breachRisk: breachCount });

    // AI
    if (mode === 'hybrid') {
      const { data: keyRow } = await supabase.from('api_keys').select('key_value,provider').eq('workspace_id', workspaceId).eq('is_default', true).maybeSingle();
      if (keyRow) {
        const prompt = `You are a construction operations assistant. Summary: ${activeSites.length} active sites. ${stalledCount} stalled. ${breachCount} breach risk. ${totalPumpsNeeded} pumps needed in pipeline. Recommendations: ${recs.join(' | ')}. Give a strategic summary and one bold action today.`;
        try {
          let insight = '';
          if (keyRow.provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyRow.key_value}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            const d = await res.json(); insight = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else if (keyRow.provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyRow.key_value}` }, body: JSON.stringify({ model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], max_tokens: 250 }) });
            const d = await res.json(); insight = d?.choices?.[0]?.message?.content || '';
          }
          if (insight) setAiInsight(insight);
        } catch {}
      }
    }

    setDone(true);
    setRunning(false);
  }, [sites, pendingSites, maintenanceAssets, dailyMachineLogs, siteJournalEntries, waybills, dieselRefills, mode, workspaceId, updatePhase]);

  useEffect(() => {
    if (open && phases.length === 0 && !running && !done) runRecon();
  }, [open]);

  const renderSitesPhase = () => {
    const siteRisks = phases.find(p => p.id === 'sites')?.risks || [];
    return (
      <div className="space-y-3 pt-1">
        <p className="text-xs text-slate-500 font-medium">Sir, here is the current status of each active dewatering site:</p>
        <div className="grid grid-cols-1 gap-3">
          {analysedSites.map((s, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">{s.client}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Target End Date</span>
                  <span className={`text-xs font-semibold ${s.endDate ? 'text-slate-700 dark:text-slate-300' : 'text-amber-600 font-bold'}`}>
                    {s.endDate ? fmt(s.endDate) : 'Open-ended'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-650 dark:text-slate-400">
                  <span>Site Progress</span>
                  <span>{s.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-750 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${s.progress}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Equipment Onsite</span>
                {s.machines.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {s.machines.map((m: any, mIdx: number) => (
                      <span key={mIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.lastLogStatus === 'Full Day' ? 'bg-emerald-500' : m.lastLogStatus === 'Half Day' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        {m.name} ({m.lastLogDate ? `Last log: ${fmt(m.lastLogDate)}` : 'No log history'})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No dewatering equipment assigned to this site.</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {siteRisks.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {siteRisks.map((r, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-405 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-2.5 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                {r}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMachinesPhase = () => {
    if (!fleetStats) return null;
    return (
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-150 rounded-xl p-2.5 text-center">
            <span className="text-[20px] font-black text-slate-800 dark:text-slate-100 block leading-tight">{fleetStats.total}</span>
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Fleet</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl p-2.5 text-center">
            <span className="text-[20px] font-black text-emerald-700 dark:text-emerald-400 block leading-tight">{fleetStats.active}</span>
            <span className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider">Active Onsite</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl p-2.5 text-center">
            <span className="text-[20px] font-black text-amber-700 dark:text-amber-400 block leading-tight">{fleetStats.idle.length}</span>
            <span className="text-[9px] text-amber-600 uppercase font-bold tracking-wider">Idle/Warehouse</span>
          </div>
          <div className="bg-rose-50 dark:bg-rose-955/20 border border-rose-100 rounded-xl p-2.5 text-center">
            <span className="text-[20px] font-black text-rose-750 dark:text-rose-400 block leading-tight">{fleetStats.maintenance.length}</span>
            <span className="text-[9px] text-rose-600 dark:text-rose-400 uppercase font-bold tracking-wider">Need Maintenance</span>
          </div>
        </div>
        {fleetStats.overdue.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Service Overdue (Immediate Action Required)</span>
            <div className="flex flex-col gap-1">
              {fleetStats.overdue.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-rose-50 dark:bg-rose-955/25 border border-rose-100 rounded-lg px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-400">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-[10px] bg-rose-200 dark:bg-rose-900 px-1.5 py-0.5 rounded font-bold uppercase text-rose-700 dark:text-rose-350">Overdue</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {fleetStats.underutilised.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block font-black">Underutilized Pumps This Week</span>
            <div className="flex flex-col gap-1">
              {fleetStats.underutilised.map((pm: any, i: number) => (
                <div key={i} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg p-2 text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-bold">{pm.name}</span> at <span className="font-semibold">{pm.site}</span>
                  <p className="text-[10px] text-amber-600/85 mt-0.5">Logged: {pm.halfDays} half-days, {pm.noneDays} idle days this week.</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProgressPhase = () => {
    if (!progressStats) return null;
    return (
      <div className="space-y-3 pt-1">
        <p className="text-xs text-slate-655 dark:text-slate-350">
          Sir, the recent logs indicate <span className="font-bold text-emerald-650">{progressStats.runningCount} sites</span> are actively pumping water, and <span className="font-bold text-amber-650">{progressStats.stalledCount} sites</span> are idle with no logs in the last 3 days:
        </p>
        {progressStats.stalledSites.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Inactive / Stalled Sites (3+ Days No Activity)</span>
            <div className="grid grid-cols-1 gap-1.5">
              {progressStats.stalledSites.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl p-3 text-xs text-amber-750 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">{s.name}</span>
                    <p className="text-[10px] text-amber-600 mt-0.5">No pump operational hours recorded. Please confirm if site access is restricted or diesel is missing.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {progressStats.breachSites.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Contract Date Breach Risks</span>
            <div className="grid grid-cols-1 gap-1.5">
              {progressStats.breachSites.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 rounded-xl p-3 text-xs text-rose-750 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold">{s.name}</span>
                    <p className="text-[10px] text-rose-600 mt-0.5">Projected completion is <span className="font-bold">{s.estDate}</span>, which breaches the target contract date.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPipelinePhase = () => {
    if (!pipelineStats) return null;
    return (
      <div className="space-y-3 pt-1">
        <p className="text-xs text-slate-655 dark:text-slate-350">
          We have <span className="font-bold text-indigo-650">{pipelineStats.pendingCount} sites</span> in the onboarding pipeline requiring a total of <span className="font-bold text-indigo-650">{pipelineStats.totalPumpsNeeded} pumps</span>.
        </p>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 border border-slate-150 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="text-center w-full md:w-auto">
            <span className="text-xs text-slate-400 font-bold block mb-1">PENDING DEMAND</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{pipelineStats.totalPumpsNeeded} Pumps</span>
            <span className="text-[10px] text-slate-500 block">Across {pipelineStats.pendingCount} sites</span>
          </div>
          <div className="h-0.5 w-12 bg-slate-200 dark:bg-slate-700 hidden md:block" />
          <div className="text-center w-full md:w-auto">
            <span className="text-xs text-emerald-500 font-bold block mb-1">IMMEDIATELY AVAILABLE</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450">{pipelineStats.idleAvailable} Pumps</span>
            <span className="text-[10px] text-emerald-500 block">Idle in Warehouse</span>
          </div>
        </div>
        {pipelineStats.completedOpportunities && pipelineStats.completedOpportunities.length > 0 && (
          <div className="space-y-1.5 border border-emerald-250 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block font-black">Immediate Demobilization Required (Site 100% Complete)</span>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {pipelineStats.completedOpportunities.map((s: any, i: number) => (
                <div key={i} className="text-xs text-emerald-800 dark:text-emerald-350 font-medium">
                  <strong>{s.name}</strong> is fully completed but still has <span className="underline font-bold text-emerald-700 dark:text-emerald-400">{s.machines.join(', ')}</span> onsite. These should be moved immediately to pending sites.
                </div>
              ))}
            </div>
          </div>
        )}
        {pipelineStats.demobOpportunities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Upcoming Demobilization Opportunities</span>
            <div className="flex flex-col gap-1.5">
              {pipelineStats.demobOpportunities.map((s: any, i: number) => (
                <div key={i} className="bg-emerald-50/45 dark:bg-emerald-950/20 border border-emerald-100 rounded-lg p-2.5 text-xs text-emerald-800 dark:text-emerald-400">
                  Equipment on <span className="font-bold">{s.name}</span> will become available soon (Current progress: {s.progress}%{s.daysLeft != null ? `, est. ${s.daysLeft} days` : ''}).
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRiskPhase = () => {
    return (
      <div className="space-y-3 pt-1">
        <span className="text-xs text-slate-500 font-medium">Sir, I suggest we take the following actions today to optimize our fleet:</span>
        <div className="flex flex-col gap-2">
          {recommendations.map((rec, i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-805 border border-slate-100 dark:border-slate-750 rounded-xl p-3 flex items-start gap-3">
              <span className="h-6 w-6 rounded bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-650 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-normal">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-indigo-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
              {mode === 'hybrid' ? <Bot className="h-5 w-5 text-white" /> : <FlaskConical className="h-5 w-5 text-white" />}
            </div>
            <div>
              <p className="font-black text-white text-sm">Machine Recon Analysis</p>
              <p className="text-indigo-200 text-[10px]">{mode === 'hybrid' ? 'Hybrid AI + Analytic' : 'Analytic Mode'} · All Active Sites</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Phases scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {phases.map((phase) => {
            const Icon = phase.icon as any;
            return (
              <div key={phase.id} className={`rounded-xl border transition-all ${
                phase.status === 'running' ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30' :
                phase.status === 'done' ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' :
                'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50'
              }`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    phase.status === 'running' ? 'bg-indigo-500' :
                    phase.status === 'done' && (phase.findings.length > 0 || phase.risks.length > 0) ? 'bg-emerald-500' :
                    phase.status === 'done' ? 'bg-slate-400' : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {phase.status === 'running' ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : phase.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <Icon className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${
                      phase.status === 'pending' ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200'
                    }`}>{phase.label}</p>
                    {phase.status === 'running' && (
                      <p className="text-[11px] text-indigo-500 animate-pulse">Analysing…</p>
                    )}
                  </div>
                  {phase.status === 'done' && phase.risks.length > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-[10px]">{phase.risks.length} risk{phase.risks.length !== 1 ? 's' : ''}</Badge>
                  )}
                </div>

                {phase.status === 'done' && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {phase.id === 'sites' && renderSitesPhase()}
                    {phase.id === 'machines' && renderMachinesPhase()}
                    {phase.id === 'progress' && renderProgressPhase()}
                    {phase.id === 'pipeline' && renderPipelinePhase()}
                    {phase.id === 'risk' && renderRiskPhase()}
                  </div>
                )}
              </div>
            );
          })}



          {/* AI Insight */}
          {aiInsight && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                <Bot className="h-4 w-4 text-emerald-600" />
                <p className="font-black text-emerald-700 dark:text-emerald-400 text-sm">AI Strategic Insight</p>
              </div>
              <p className="px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
            </div>
          )}

          {/* Summary stats */}
          {done && summary && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{summary.activeSites}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Active Sites</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${ summary.breachRisk > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }`}>
                <p className={`text-2xl font-black ${ summary.breachRisk > 0 ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>{summary.breachRisk}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Breach Risk</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${ summary.stalledSites > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }`}>
                <p className={`text-2xl font-black ${ summary.stalledSites > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>{summary.stalledSites}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Stalled</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {done && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 flex gap-2">
            <Button variant="outline" onClick={() => { setPhases([]); setDone(false); setRecommendations([]); setSummary(null); setAiInsight(null); runRecon(); }} className="flex-1 h-10 text-sm font-bold">
              <FlaskConical className="h-4 w-4 mr-2" /> Re-run Analysis
            </Button>
            <Button onClick={onClose} className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MachineReconciliation() {
  const { maintenanceAssets, waybills, assets, dailyMachineLogs, sitePumpDates, dieselRefills, isLoaded } = useOperations();
  const { pendingSites, sites, invoices, siteJournalEntries } = useAppStore();
  const workspaceId = useAppStore((s: any) => s.workspaceId || 'default');

  const [showRecon, setShowRecon] = useState(false);
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  // ── Date filter ─────────────────────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const hasDateFilter = !!(filterFrom && filterTo);
  const clearFilter = () => { setFilterFrom(''); setFilterTo(''); };

  useSetPageTitle(
    'Machine Reconciliation',
    'Overview of machine allocations, active days, requirements, and service statuses.',
    <div className="flex flex-wrap items-end gap-2">
      {/* Run Recon button */}
      <Button
        onClick={() => setShowRecon(true)}
        className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-2 shadow-md shadow-indigo-200"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Run Analytic Recon
      </Button>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
          <Filter className="h-3 w-3" /> From
        </label>
        <Input
          type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="h-8 text-sm w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 font-medium">To</label>
        <Input
          type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="h-8 text-sm w-36"
        />
      </div>
      {hasDateFilter && (
        <Button variant="ghost" size="sm" onClick={clearFilter} className="h-8 gap-1 text-slate-500">
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>,
    [filterFrom, filterTo, hasDateFilter, showRecon]
  );

  const toggleExpand = (id: string) => {
    setExpandedMachines(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Invoice lookup: latest per site (filtered by date if active) ───────────
  const latestInvoiceForSite = useMemo(() => {
    const map = new Map<string, { noOfMachine: number; invoiceNumber: string; invoiceStart: string; invoiceEnd: string }>();
    const sorted = [...invoices].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    sorted.forEach(inv => {
      const key = (inv.siteName || '').toLowerCase().trim();
      if (!key) return;
      if (hasDateFilter) {
        const invStart = inv.date || '';
        const invEnd = inv.dueDate || inv.date || '';
        if (!rangesOverlap(invStart, invEnd, filterFrom, filterTo)) return;
      }
      if (!map.has(key)) {
        map.set(key, {
          noOfMachine: inv.noOfMachine || 0,
          invoiceNumber: inv.invoiceNumber,
          invoiceStart: inv.date || '',
          invoiceEnd: inv.dueDate || inv.date || '',
        });
      }
    });
    return map;
  }, [invoices, hasDateFilter, filterFrom, filterTo]);

  // ── Stat card numbers ──────────────────────────────────────────────────────
  const machines = maintenanceAssets.filter(m => m.category === 'machine');
  const totalMachines = machines.length;
  // Respect operationalStatus for the new tri-state counts
  const activeOnSite = machines.filter(m => {
    const opStatus = m.operationalStatus ?? 'active';
    return opStatus === 'active' && !isInternalSite({ name: m.site }) && m.site !== 'Warehouse' && m.isActive;
  }).length;
  const idle = machines.filter(m => {
    const opStatus = m.operationalStatus ?? 'active';
    return opStatus === 'idle' || ((isInternalSite({ name: m.site }) || m.site === 'Warehouse') && m.isActive && opStatus === 'active');
  }).length;
  const underMaintenance = machines.filter(m => (m.operationalStatus ?? 'active') === 'under_maintenance').length;

  // ── Active sites map ────────────────────────────────────────────────────────
  const activeSitesMap = useMemo(() => {
    const map = new Map<string, {
      client: string; siteName: string; machinesOnSite: number; status: string; expectedMachines: number;
      invoiceNumber?: string; invoiceStart?: string; invoiceEnd?: string;
      activeMachinesInPeriod?: number;
    }>();
    sites.forEach(s => {
      if (s.status === 'Active' && !isInternalSite(s)) {
        // A site with no startDate is treated as "Pending Site" — skip from Active list
        const hasStartDate = s.startDate && s.startDate.trim() !== '';
        if (!hasStartDate) return;
        const onboarding = pendingSites.find(p =>
          p.siteId === s.id ||
          p.id === s.id ||
          (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
            p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
        );
        if (onboarding && onboarding.phase1?.whatIsBeingBuilt && onboarding.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') {
          return;
        }
        // Prefer latest matching invoice; fall back to onboarding data
        const invData = latestInvoiceForSite.get(s.name.toLowerCase().trim());
        const expectedMachines = invData
          ? invData.noOfMachine
          : (onboarding ? parseInt(onboarding.phase3?.totalPumpsRequired || '0', 10) || 0 : 0);

        const siteWaybills = waybills.filter(w =>
          (w.siteName?.toLowerCase() === s.name.toLowerCase() || w.siteId === s.id) &&
          (w.status !== 'outstanding' || w.type === 'return')
        );
        const inventoryMap = new Map<string, number>();
        siteWaybills
          .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
          .forEach(wb => wb.items.forEach(item =>
            inventoryMap.set(item.assetId, (inventoryMap.get(item.assetId) || 0) + item.quantity)
          ));
        siteWaybills
          .filter(w => w.type === 'return')
          .forEach(wb => wb.items.forEach(item => {
            if (wb.status === 'return_completed') {
              inventoryMap.set(item.assetId, Math.max(0, (inventoryMap.get(item.assetId) || 0) - item.quantity));
            }
          }));
        let machinesOnSite = 0;
        inventoryMap.forEach((qty, assetId) => {
          if (qty > 0) {
            const a = assets.find(a => a.id === assetId);
            if (a && a.type === 'equipment' && a.requiresLogging) machinesOnSite += 1;
          }
        });

        // Count unique machines with active logs in the date filter period
        let activeMachinesInPeriod: number | undefined;
        if (hasDateFilter) {
          const activeAssetIds = new Set<string>();
          dailyMachineLogs.forEach(log => {
            if (
              log.siteName?.toLowerCase() === s.name.toLowerCase() &&
              log.isActive &&
              log.date >= filterFrom &&
              log.date <= filterTo
            ) activeAssetIds.add(log.assetId);
          });
          activeMachinesInPeriod = activeAssetIds.size;
        }

        map.set(s.name, {
          client: s.client, siteName: s.name, machinesOnSite, status: s.status, expectedMachines,
          invoiceNumber: invData?.invoiceNumber,
          invoiceStart: invData?.invoiceStart,
          invoiceEnd: invData?.invoiceEnd,
          activeMachinesInPeriod,
        });
      }
    });
    return Array.from(map.values());
  }, [sites, pendingSites, waybills, assets, latestInvoiceForSite, hasDateFilter, filterFrom, filterTo, dailyMachineLogs]);

  // ── Pending sites ───────────────────────────────────────────────────────────
  // Two sources:
  //   1) SiteQuestionnaire entries with status === 'Pending'
  //   2) Sites in the sites table that have status 'Active' but no startDate yet (e.g. Aerobell)
  const pendingSitesList = useMemo(() => {
    // Source 1: pending questionnaire entries
    const fromQuestionnaire = pendingSites
      .filter(s => s.status === 'Pending' && s.phase1?.whatIsBeingBuilt?.trim().toLowerCase() === 'dewatering')
      .map(s => {
        const key = (s.siteName || '').toLowerCase().trim();
        const invData = latestInvoiceForSite.get(key);
        return {
          id: s.id,
          siteName: s.siteName || 'Unknown Site',
          client: s.clientName || 'Unknown Client',
          pumpsRequired: parseInt(s.phase3?.totalPumpsRequired || '0', 10) || 0,
          pumpsInvoice: invData ? invData.noOfMachine : null,
          invoiceNumber: invData ? invData.invoiceNumber : null,
          source: 'questionnaire' as const,
        };
      });

    // Source 2: sites table entries with Active status but no startDate (dewatering only)
    const fromSitesTable = sites
      .filter(s => {
        if (s.status !== 'Active' || isInternalSite(s) || (s.startDate && s.startDate.trim() !== '')) return false;
        const onboarding = pendingSites.find(p =>
          p.siteId === s.id ||
          p.id === s.id ||
          (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
            p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
        );
        if (onboarding && onboarding.phase1?.whatIsBeingBuilt && onboarding.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') {
          return false;
        }
        return true;
      })
      .map(s => {
        const key = s.name.toLowerCase().trim();
        const invData = latestInvoiceForSite.get(key);
        // avoid duplicates with questionnaire list
        const alreadyInQuestionnaire = fromQuestionnaire.some(
          q => q.siteName.trim().toLowerCase() === s.name.trim().toLowerCase()
        );
        if (alreadyInQuestionnaire) return null;
        return {
          id: s.id,
          siteName: s.name,
          client: s.client,
          pumpsRequired: invData ? invData.noOfMachine : 0,
          pumpsInvoice: invData ? invData.noOfMachine : null,
          invoiceNumber: invData ? invData.invoiceNumber : null,
          source: 'site' as const,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return [...fromQuestionnaire, ...fromSitesTable];
  }, [pendingSites, sites, latestInvoiceForSite]);

  const totalRequiredPumps = pendingSitesList.reduce((acc, c) => acc + c.pumpsRequired, 0);

  // ── Site discrepancies ──────────────────────────────────────────────────────
  const discrepancies = useMemo(() =>
    activeSitesMap
      .filter(s => s.expectedMachines > 0 && s.machinesOnSite !== s.expectedMachines)
      .map(s => ({ ...s, delta: s.machinesOnSite - s.expectedMachines })),
    [activeSitesMap]);

  // ── Per-machine data: active days broken down by site ──────────────────────
  const perMachineData = useMemo(() => {
    return maintenanceAssets
      .filter(m => m.category === 'machine')
      .map(machine => {
        const machineLogs = dailyMachineLogs.filter(l => {
          if (l.assetId !== machine.id) return false;
          if (hasDateFilter && (l.date < filterFrom || l.date > filterTo)) return false;
          return true;
        });

        const siteMap = new Map<string, {
          siteId: string; siteName: string;
          activeDays: number; totalLoggedDays: number;
          firstLog: string; lastLog: string;
        }>();

        machineLogs.forEach(log => {
          const existing = siteMap.get(log.siteId) ?? {
            siteId: log.siteId, siteName: log.siteName,
            activeDays: 0, totalLoggedDays: 0,
            firstLog: log.date, lastLog: log.date,
          };
          existing.totalLoggedDays += 1;
          if (log.isActive) {
            existing.activeDays += log.operationalDay === 'half' ? 0.5 : log.operationalDay === 'none' ? 0 : 1;
          }
          if (log.date < existing.firstLog) existing.firstLog = log.date;
          if (log.date > existing.lastLog) existing.lastLog = log.date;
          siteMap.set(log.siteId, existing);
        });

        const pumpDateMap = Object.fromEntries(
          sitePumpDates.filter(pd => pd.assetId === machine.id).map(pd => [pd.siteId, pd])
        );

        const siteHistory = Array.from(siteMap.values())
          .map(s => ({
            ...s,
            pumpStartDate: pumpDateMap[s.siteId]?.pumpStartDate ?? s.firstLog,
            pumpStopDate: pumpDateMap[s.siteId]?.pumpStopDate ?? null,
            isCurrent: machine.site === s.siteName,
          }))
          .sort((a, b) => b.lastLog.localeCompare(a.lastLog));

        const totalActiveDays = siteHistory.reduce((sum, s) => sum + s.activeDays, 0);

        return { machine, siteHistory, totalActiveDays };
      }).filter(d => !hasDateFilter || d.siteHistory.length > 0);
  }, [maintenanceAssets, dailyMachineLogs, sitePumpDates, hasDateFilter, filterFrom, filterTo]);

  // ── Overdue / due-soon list ─────────────────────────────────────────────────
  const overdueList = useMemo(() =>
    maintenanceAssets
      .filter(m => m.status === 'overdue' || m.status === 'due_soon')
      .sort((a, b) => (a.status === 'overdue' ? -1 : 1)),
    [maintenanceAssets]);

  // ── Diesel summary per site ─────────────────────────────────────────────────
  const dieselSummary = useMemo(() => {
    const siteMap = new Map<string, { siteName: string; refilled: number; logged: number }>();

    const credit = (siteId: string, siteName: string, litres: number) => {
      const e = siteMap.get(siteId) ?? { siteName, refilled: 0, logged: 0 };
      e.refilled += litres;
      siteMap.set(siteId, e);
    };

    dieselRefills.forEach(r => {
      if (hasDateFilter && r.date && (r.date < filterFrom || r.date > filterTo)) return;

      // If allocations carry individual site info, break down by actual site
      const allocsWithSite = r.machineAllocations?.filter(a => a.siteId && a.siteName) ?? [];
      if (allocsWithSite.length > 0) {
        allocsWithSite.forEach(a => {
          credit(a.siteId!, a.siteName!, a.allocatedLitres);
        });
        // Any unallocated remainder goes to the top-level site
        const allocatedTotal = allocsWithSite.reduce((s, a) => s + a.allocatedLitres, 0);
        const remainder = r.totalLitres - allocatedTotal;
        if (remainder > 0) credit(r.siteId, r.siteName, remainder);
      } else {
        // No per-site allocations — credit the whole amount to the top-level site
        credit(r.siteId, r.siteName, r.totalLitres);
      }
    });

    dailyMachineLogs.forEach(l => {
      if (!l.siteId) return;
      if (hasDateFilter && (l.date < filterFrom || l.date > filterTo)) return;
      const e = siteMap.get(l.siteId) ?? { siteName: l.siteName, refilled: 0, logged: 0 };
      e.logged += l.dieselUsage || 0;
      siteMap.set(l.siteId, e);
    });

    return Array.from(siteMap.entries())
      .filter(([siteId]) => {
        const siteObj = sites.find(x => x.id === siteId || x.name.toLowerCase().trim() === siteId.toLowerCase().trim());
        return siteObj ? siteObj.status === 'Active' : false;
      })
      .map(([_, s]) => s)
      .filter(s => s.refilled > 0 || s.logged > 0);
  }, [dieselRefills, dailyMachineLogs, hasDateFilter, filterFrom, filterTo, sites]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Reconciling Machine Data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Machine Recon Analysis Dialog ────────────────────────────────── */}
      <ReconDialog
        open={showRecon}
        onClose={() => setShowRecon(false)}
        sites={sites}
        pendingSites={pendingSites}
        maintenanceAssets={maintenanceAssets}
        dailyMachineLogs={dailyMachineLogs}
        siteJournalEntries={(siteJournalEntries as any[]) || []}
        waybills={waybills}
        dieselRefills={dieselRefills}
        workspaceId={workspaceId}
      />

      {/* Active filter banner */}
      {hasDateFilter && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300">
          <CalendarDays className="h-4 w-4 flex-shrink-0" />
          Showing data for <strong className="mx-1">{fmt(filterFrom)}</strong> → <strong className="mx-1">{fmt(filterTo)}</strong>.
          &nbsp;Expected machines sourced from latest invoice overlapping this period.
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMachines}</div>
            <p className="text-xs text-slate-500">Dewatering / logged assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (On Site)</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeOnSite}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Idle (Warehouse)</CardTitle>
            <MapPin className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{idle}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance / Inactive</CardTitle>
            <Wrench className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{underMaintenance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Sites</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pendingSitesList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Machines Required</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalRequiredPumps}</div>
            <p className="text-xs text-slate-500">For pending sites</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Discrepancy Alerts ─────────────────────────────────────────────── */}
      {discrepancies.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Site Discrepancies ({discrepancies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {discrepancies.map(d => (
              <div
                key={d.siteName}
                className={`flex items-start gap-3 p-3 rounded-xl border ${d.delta < 0
                  ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                  }`}
              >
                {d.delta < 0
                  ? <TrendingDown className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  : <TrendingUp className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm font-semibold ${d.delta < 0 ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {d.siteName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {d.machinesOnSite} on site · {d.expectedMachines} expected ·{' '}
                    <span className={`font-bold ${d.delta < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {d.delta > 0 ? '+' : ''}{d.delta}
                    </span>
                  </p>
                  {d.invoiceNumber && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Inv {d.invoiceNumber}
                      {d.invoiceStart && <> · {fmt(d.invoiceStart)} – {fmt(d.invoiceEnd || '')}</>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Sites & Pending Side-by-Side ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Sites & Machines Onsite</CardTitle>
            {hasDateFilter && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                "In Period" = machines with active logs between {fmt(filterFrom)} – {fmt(filterTo)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {activeSitesMap.length > 0 ? (
              <div className="rounded-md border dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        Expected
                        {hasDateFilter && <span className="block text-[10px] font-normal text-indigo-500">(Invoice)</span>}
                      </TableHead>
                      <TableHead className="text-right">On Site</TableHead>
                      {hasDateFilter && (
                        <TableHead className="text-right">
                          In Period
                          <span className="block text-[10px] font-normal text-indigo-500">(Active)</span>
                        </TableHead>
                      )}
                      {hasDateFilter && (
                        <TableHead className="text-left text-[11px] text-slate-400">Invoice</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSitesMap.map((site, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-500">{site.client}</TableCell>
                        <TableCell className="font-medium">{site.siteName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                            {site.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600 font-medium">{site.expectedMachines}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={site.machinesOnSite > 0 ? 'default' : 'secondary'}>
                            {site.machinesOnSite}
                          </Badge>
                        </TableCell>
                        {hasDateFilter && (
                          <TableCell className="text-right">
                            {site.activeMachinesInPeriod !== undefined ? (
                              <Badge
                                variant="outline"
                                className={
                                  site.activeMachinesInPeriod === site.expectedMachines
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    : site.activeMachinesInPeriod < site.expectedMachines
                                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                                      : 'text-amber-700 bg-amber-50 border-amber-200'
                                }
                              >
                                {site.activeMachinesInPeriod}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        )}
                        {hasDateFilter && (
                          <TableCell className="text-left">
                            {site.invoiceNumber ? (
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <FileText className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                                <span className="font-medium text-indigo-600">{site.invoiceNumber}</span>
                                <span className="text-slate-400 hidden sm:inline">
                                  {fmt(site.invoiceStart || '')}–{fmt(site.invoiceEnd || '')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">No invoice</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">No active sites found.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pending Sites & Required Machines</CardTitle></CardHeader>
          <CardContent>
            {pendingSitesList.length > 0 ? (
              <div className="rounded-md border dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Pumps Required (Onboarding)</TableHead>
                      <TableHead className="text-right">Pumps (Invoice)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSitesList.map(site => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.siteName}</TableCell>
                        <TableCell>{site.client}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-bold border-purple-200 text-purple-700 bg-purple-50">
                            {site.pumpsRequired}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {site.pumpsInvoice !== null ? (
                            <Badge variant="outline" className="font-bold border-blue-200 text-blue-700 bg-blue-50" title={`Invoice ${site.invoiceNumber}`}>
                              {site.pumpsInvoice}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">No pending sites.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Machine Active Days by Site ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                Machine Active Days by Site
                {hasDateFilter && (
                  <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 ml-2 text-xs">
                    {fmt(filterFrom)} – {fmt(filterTo)}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {hasDateFilter
                  ? 'Showing machines with logs in the selected date range only.'
                  : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm" className="text-xs"
                onClick={() => setExpandedMachines(new Set(maintenanceAssets.map(m => m.id)))}
              >
                Expand All
              </Button>
              <Button
                variant="ghost" size="sm" className="text-xs"
                onClick={() => setExpandedMachines(new Set())}
              >
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {perMachineData.length > 0 ? (
            <div className="rounded-md border dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="w-8" />
                    <TableHead>Machine</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Current Site</TableHead>
                    <TableHead>Service Status</TableHead>
                    <TableHead className="text-right">{hasDateFilter ? 'Active Days (Period)' : 'Total Active Days'}</TableHead>
                    <TableHead className="text-right">Sites Visited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perMachineData.map(({ machine, siteHistory, totalActiveDays }) => {
                    const isExpanded = expandedMachines.has(machine.id);
                    const hasSiteHistory = siteHistory.length > 0;

                    return (
                      <React.Fragment key={machine.id}>
                        {/* Main machine row */}
                        <TableRow
                          className={`cursor-pointer transition-colors ${isExpanded
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                            }`}
                          onClick={() => hasSiteHistory && toggleExpand(machine.id)}
                        >
                          <TableCell className="text-center">
                            {hasSiteHistory ? (
                              isExpanded
                                ? <ChevronUp className="h-4 w-4 text-indigo-500 mx-auto" />
                                : <ChevronDown className="h-4 w-4 text-slate-400 mx-auto" />
                            ) : (
                              <span className="text-slate-300 text-xs mx-auto block text-center">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{machine.name}</TableCell>
                          <TableCell className="text-slate-500 text-sm font-mono">
                            {machine.serialNumber || '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${machine.site === 'Warehouse' ? 'text-amber-600' : 'text-emerald-700'
                              }`}>
                              {machine.site}
                            </span>
                          </TableCell>
                          <TableCell>{statusBadge(machine.status)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800 dark:text-slate-100">
                            {totalActiveDays > 0 ? totalActiveDays.toFixed(1) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-slate-500 text-sm">
                            {siteHistory.length}
                          </TableCell>
                        </TableRow>

                        {/* Expanded: per-site breakdown */}
                        {isExpanded && siteHistory.length > 0 && (
                          <TableRow className="bg-indigo-50/40 dark:bg-indigo-950/10">
                            <TableCell colSpan={7} className="p-0">
                              <div className="mx-6 my-3 rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                                      <th className="text-left px-4 py-2 font-medium">Site</th>
                                      <th className="text-left px-4 py-2 font-medium">Period</th>
                                      <th className="text-right px-4 py-2 font-medium">Days Logged</th>
                                      <th className="text-right px-4 py-2 font-medium">Active Days</th>
                                      <th className="text-right px-4 py-2 font-medium">Utilisation</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {siteHistory.map((sh, idx) => {
                                      const utilPct = sh.totalLoggedDays > 0
                                        ? Math.round((sh.activeDays / sh.totalLoggedDays) * 100)
                                        : 0;

                                      return (
                                        <tr
                                          key={idx}
                                          className={`border-t border-indigo-100 dark:border-indigo-900 ${sh.isCurrent ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''
                                            }`}
                                        >
                                          <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                            <div className="flex items-center gap-2">
                                              {sh.siteName}
                                              {sh.isCurrent && (
                                                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 border py-0 px-1.5">
                                                  Current
                                                </Badge>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500">
                                            <div className="flex items-center gap-1 text-xs">
                                              <Clock className="h-3 w-3 flex-shrink-0" />
                                              {fmt(sh.pumpStartDate)}
                                              {' → '}
                                              {sh.pumpStopDate
                                                ? fmt(sh.pumpStopDate)
                                                : <span className="text-emerald-600 font-semibold">Present</span>
                                              }
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-slate-600">{sh.totalLoggedDays}</td>
                                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                                            {sh.activeDays.toFixed(1)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full ${utilPct >= 80 ? 'bg-emerald-500'
                                                    : utilPct >= 50 ? 'bg-amber-400'
                                                      : 'bg-rose-400'
                                                    }`}
                                                  style={{ width: `${utilPct}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-slate-600 w-8 text-right">{utilPct}%</span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              {hasDateFilter
                ? 'No machines with logged activity in the selected date range.'
                : 'No machines with logged activity found.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overdue Maintenance ───────────────────────────────────────────── */}
      {overdueList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-rose-500" />
              Maintenance Alerts ({overdueList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Current Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Service</TableHead>
                    <TableHead>Next Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueList.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold">{m.name}</TableCell>
                      <TableCell className="text-slate-500 font-mono text-sm">{m.serialNumber || '—'}</TableCell>
                      <TableCell className="text-sm">{m.site}</TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell className="text-sm text-slate-600">{m.lastServiceDate ? fmt(m.lastServiceDate) : '—'}</TableCell>
                      <TableCell className="text-sm font-medium text-rose-600">{fmt(m.nextServiceDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Diesel Summary ────────────────────────────────────────────────── */}
      {dieselSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-amber-500" />
              Diesel Usage vs. Refills {hasDateFilter ? `(${fmt(filterFrom)} – ${fmt(filterTo)})` : '(All Time)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Diesel Purchased (L)</TableHead>
                    <TableHead className="text-right">Refilled into Machine (L)</TableHead>
                    <TableHead className="text-right">Delta (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dieselSummary.map((row, i) => {
                    const delta = row.refilled - row.logged;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.siteName}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.refilled.toFixed(0)}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.logged.toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(0)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
