import { useState, useMemo } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore } from '@/src/store/appStore';
import { Bot, FlaskConical, TrendingUp, Clock, Wrench, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';

interface MachineReconPanelProps {
  siteId: string;
  siteName: string;
  clientName?: string;
  workspaceId: string;
}

interface SiteAnalysis {
  currentProgress: number;
  velocity: number; // % per day (5-day rolling avg)
  estimatedDaysLeft: number | null;
  estimatedCompletionDate: string | null;
  status: 'on-track' | 'slow' | 'stalled' | 'complete';
  aiInsight?: string;
}

function computeAnalytics(
  siteId: string,
  entries: ReturnType<typeof useAppStore.getState>['siteJournalEntries']
): SiteAnalysis {
  const siteEntries = entries
    .filter(e => e.siteId === siteId && e.progressPercentage != null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (siteEntries.length === 0) {
    return { currentProgress: 0, velocity: 0, estimatedDaysLeft: null, estimatedCompletionDate: null, status: 'stalled' };
  }

  const currentProgress = Math.max(...siteEntries.map(e => e.progressPercentage!));

  if (currentProgress >= 100) {
    return { currentProgress: 100, velocity: 0, estimatedDaysLeft: 0, estimatedCompletionDate: 'Completed', status: 'complete' };
  }

  // 5-day rolling average velocity
  const recent = siteEntries.slice(-6); // up to 6 to compute 5 intervals
  let totalGain = 0;
  let intervals = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const daysDiff = Math.max(1, (new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const gain = (curr.progressPercentage! - prev.progressPercentage!) / daysDiff;
    if (gain >= 0) { totalGain += gain; intervals++; }
  }

  const velocity = intervals > 0 ? totalGain / intervals : 0;
  const remaining = 100 - currentProgress;

  if (velocity <= 0) {
    return { currentProgress, velocity: 0, estimatedDaysLeft: null, estimatedCompletionDate: null, status: 'stalled' };
  }

  const estimatedDaysLeft = Math.ceil(remaining / velocity);
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + estimatedDaysLeft);

  const status: SiteAnalysis['status'] =
    velocity >= 3 ? 'on-track' : velocity >= 1 ? 'slow' : 'stalled';

  return {
    currentProgress,
    velocity: Math.round(velocity * 10) / 10,
    estimatedDaysLeft,
    estimatedCompletionDate: completionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    status,
  };
}

export function MachineReconPanel({ siteId, siteName, clientName, workspaceId }: MachineReconPanelProps) {
  const { siteJournalEntries } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'analytic' | 'hybrid'>('analytic');

  // Load mode from workspace settings
  useMemo(() => {
    supabase
      .from('workspace_settings')
      .select('resource_allocation_mode')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.resource_allocation_mode) setAnalysisMode(data.resource_allocation_mode as any);
      });
  }, [workspaceId]);

  const analytics = useMemo(() => computeAnalytics(siteId, siteJournalEntries), [siteId, siteJournalEntries]);

  const statusConfig = {
    'on-track': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'On Track', icon: CheckCircle2 },
    'slow': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Progressing Slowly', icon: AlertTriangle },
    'stalled': { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Stalled / No Data', icon: AlertTriangle },
    'complete': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Complete', icon: CheckCircle2 },
  };
  const sc = statusConfig[analytics.status];

  const runRecon = async () => {
    setIsRunning(true);
    setAiInsight(null);
    setIsExpanded(true);

    if (analysisMode === 'hybrid') {
      try {
        // Fetch the default API key
        const { data: keyRow } = await supabase
          .from('api_keys')
          .select('key_value, provider')
          .eq('workspace_id', workspaceId)
          .eq('is_default', true)
          .maybeSingle();

        if (!keyRow) {
          toast.error('No default API key set. Go to Settings → AI Settings to add one.');
          setIsRunning(false);
          return;
        }

        // Build the prompt
        const prompt = `You are a construction resource management assistant. Analyze the following site data and provide a concise 3-5 sentence machine recon report.

Site: ${siteName} (Client: ${clientName || 'N/A'})
Current Progress: ${analytics.currentProgress}%
Velocity: ${analytics.velocity}%/day (5-day rolling average)
Status: ${analytics.status}
Estimated Days Remaining: ${analytics.estimatedDaysLeft ?? 'Unknown (stalled)'}
Estimated Completion: ${analytics.estimatedCompletionDate ?? 'Unknown'}

Provide:
1. A risk assessment for this site
2. Whether machines can safely be moved to new sites soon
3. A recommended action for the operations manager`;

        let aiText = '';

        if (keyRow.provider === 'gemini') {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyRow.key_value}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          const data = await res.json();
          aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No insight returned.';
        } else if (keyRow.provider === 'groq') {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyRow.key_value}` },
            body: JSON.stringify({
              model: 'llama3-8b-8192',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 300,
            }),
          });
          const data = await res.json();
          aiText = data?.choices?.[0]?.message?.content || 'No insight returned.';
        } else {
          aiText = `[Provider "${keyRow.provider}" not yet wired up for direct calls. Analytics data is shown above.]`;
        }

        setAiInsight(aiText);
      } catch (err) {
        toast.error('AI analysis failed. Check your API key in Settings → AI Settings.');
      }
    }

    setIsRunning(false);
  };

  if (analytics.currentProgress === 0 && siteJournalEntries.filter(e => e.siteId === siteId).length === 0) {
    return null; // Hide if no journal entries at all
  }

  return (
    <div className={`mt-3 rounded-xl border ${sc.border} ${sc.bg} overflow-hidden transition-all`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(p => !p)}
      >
        <div className="flex items-center gap-2">
          {analysisMode === 'hybrid'
            ? <Bot className={`h-4 w-4 ${sc.color}`} />
            : <FlaskConical className={`h-4 w-4 ${sc.color}`} />
          }
          <span className={`text-xs font-bold ${sc.color}`}>Machine Recon</span>
          <Badge className={`text-[9px] uppercase ${sc.bg} ${sc.color} border ${sc.border}`}>{sc.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black ${sc.color}`}>{analytics.currentProgress}%</span>
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-white/60">
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${analytics.currentProgress}%`,
            background: analytics.status === 'complete' ? '#10b981'
              : analytics.status === 'on-track' ? '#6366f1'
              : analytics.status === 'slow' ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/70 rounded-lg p-2.5 text-center border border-white">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Velocity</p>
              <p className="text-base font-black text-slate-800">{analytics.velocity}<span className="text-xs font-normal">%/day</span></p>
            </div>
            <div className="bg-white/70 rounded-lg p-2.5 text-center border border-white">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Days Left</p>
              <p className="text-base font-black text-slate-800">
                {analytics.estimatedDaysLeft != null ? analytics.estimatedDaysLeft : '—'}
              </p>
            </div>
            <div className="bg-white/70 rounded-lg p-2.5 text-center border border-white">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Est. Done</p>
              <p className="text-[11px] font-bold text-slate-700 leading-tight">
                {analytics.estimatedCompletionDate ?? 'Unknown'}
              </p>
            </div>
          </div>

          {/* AI Insight */}
          {aiInsight && (
            <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">AI Insight</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
            </div>
          )}

          <Button
            onClick={e => { e.stopPropagation(); runRecon(); }}
            disabled={isRunning}
            size="sm"
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-2"
          >
            {isRunning
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
              : analysisMode === 'hybrid'
              ? <><Bot className="h-3.5 w-3.5" /> Run Hybrid Recon</>
              : <><FlaskConical className="h-3.5 w-3.5" /> Run Analytic Recon</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
