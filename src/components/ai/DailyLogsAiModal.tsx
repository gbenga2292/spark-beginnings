import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  format, subDays, addDays, startOfMonth, endOfMonth, isWithinInterval, parseISO
} from 'date-fns';
import {
  Sparkles, Send, Bot, User, RefreshCw, Copy, Check, Calendar,
  Building2, Trash2, Cpu
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';
import { toast } from '@/src/components/ui/toast';
import { supabase } from '@/src/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'all';

interface Props {
  initialSiteId?: string;
  initialDate?: Date;
  onClose?: () => void;
  isEmbedded?: boolean;
}

/** Helper component to parse and render Markdown with clean studio UI tags */
function FormattedAiMessage({ text }: { text: string }) {
  // Parse inline text (**bold**, *italic*, `code`)
  const formatInline = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let key = 0;

    // Pattern matches **bold**, *italic*, and `code`
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/;

    while (remaining) {
      const match = regex.exec(remaining);
      if (!match) {
        parts.push(remaining);
        break;
      }

      const matchIndex = match.index;
      if (matchIndex > 0) {
        parts.push(remaining.slice(0, matchIndex));
      }

      const matchedText = match[0];
      if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        parts.push(
          <strong key={key++} className="font-semibold text-slate-100">
            {matchedText.slice(2, -2)}
          </strong>
        );
      } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        parts.push(
          <code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[10.5px]">
            {matchedText.slice(1, -1)}
          </code>
        );
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        parts.push(
          <em key={key++} className="text-slate-300 italic">
            {matchedText.slice(1, -1)}
          </em>
        );
      } else {
        parts.push(matchedText);
      }

      remaining = remaining.slice(matchIndex + matchedText.length);
    }

    return parts;
  };

  // Split content into blocks/lines
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const header = tableRows[0];
    const body = tableRows.slice(1);

    renderedElements.push(
      <div key={`table-${renderedElements.length}`} className="my-2.5 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead>
            <tr className="bg-white/10 border-b border-white/10 text-slate-200">
              {header.map((col, i) => (
                <th key={i} className="py-1.5 px-2.5 font-bold">{formatInline(col.trim())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="py-1.5 px-2.5 text-slate-300">{formatInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    // Check if table row
    if (line.startsWith('|') && line.endsWith('|')) {
      // Ignore separator row e.g. |---|---|
      if (line.includes('---')) return;
      const cols = line.slice(1, -1).split('|');
      tableRows.push(cols);
      inTable = true;
      return;
    } else if (inTable) {
      flushTable();
    }

    if (!line) {
      renderedElements.push(<div key={`blank-${idx}`} className="h-1.5" />);
      return;
    }

    // Heading 3: ### Title
    if (line.startsWith('### ')) {
      const headingText = line.replace(/^###\s+/, '');
      renderedElements.push(
        <h4 key={`h3-${idx}`} className="text-xs font-bold text-indigo-400 mt-3 mb-1.5 flex items-center gap-1.5 border-b border-white/5 pb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span>{formatInline(headingText)}</span>
        </h4>
      );
      return;
    }

    // Heading 2 / 1: ## Title
    if (line.startsWith('## ') || line.startsWith('# ')) {
      const headingText = line.replace(/^#{1,2}\s+/, '');
      renderedElements.push(
        <h3 key={`h2-${idx}`} className="text-xs font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5">
          <span>{formatInline(headingText)}</span>
        </h3>
      );
      return;
    }

    // Bullet list: - or * or •
    if (line.match(/^[-*•]\s+/)) {
      const bulletText = line.replace(/^[-*•]\s+/, '');
      renderedElements.push(
        <div key={`bullet-${idx}`} className="flex items-start gap-1.5 my-0.5 ml-1 text-slate-200">
          <span className="text-indigo-400 shrink-0 text-xs mt-[-1px]">•</span>
          <span className="flex-1 leading-relaxed">{formatInline(bulletText)}</span>
        </div>
      );
      return;
    }

    // Numbered list: 1. 2.
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const rest = numMatch[2];
      renderedElements.push(
        <div key={`num-${idx}`} className="flex items-start gap-1.5 my-0.5 ml-1 text-slate-200">
          <span className="text-amber-400 font-mono text-[10px] shrink-0 font-bold mt-0.5">{num}.</span>
          <span className="flex-1 leading-relaxed">{formatInline(rest)}</span>
        </div>
      );
      return;
    }

    // Standard paragraph
    renderedElements.push(
      <p key={`p-${idx}`} className="my-1 text-slate-200 leading-relaxed">
        {formatInline(line)}
      </p>
    );
  });

  if (inTable) {
    flushTable();
  }

  return <div className="space-y-0.5 text-[11.5px]">{renderedElements}</div>;
}

let cachedApiKeys: any[] | null = null;
let lastApiKeyFetch = 0;

export function DailyLogsAiModal({ initialSiteId, initialDate, onClose, isEmbedded = false }: Props) {
  const { isDark } = useTheme();
  const { sites, siteJournalEntries = [] } = useAppStore();
  const { dailyMachineLogs, siteHoldPeriods } = useOperations();

  // Scope state
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || 'all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last7');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // AI Provider & Chat State
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq'>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.0-flash');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load configured keys with memory cache (refresh every 5 mins max)
  useEffect(() => {
    async function loadApiKeys() {
      try {
        const now = Date.now();
        let keys = cachedApiKeys;
        if (!keys || (now - lastApiKeyFetch > 5 * 60 * 1000)) {
          let { data: dbKeys } = await supabase.from('api_keys').select('*');
          if (!dbKeys || dbKeys.length === 0) {
            const res = await supabase.from('ai_provider_keys').select('*');
            dbKeys = res.data;
          }
          keys = dbKeys || [];
          cachedApiKeys = keys;
          lastApiKeyFetch = now;
        }

        if (keys && keys.length > 0) {
          const defaultKey = keys.find((k: any) => k.is_default) || keys[0];
          if (defaultKey) {
            const rawProv = (defaultKey.provider || '').toLowerCase();
            const prov = rawProv === 'gemini' || rawProv === 'groq' ? rawProv : (rawProv === 'openai' ? 'groq' : 'gemini');
            setSelectedProvider(prov);
            if (defaultKey.default_model) {
              setSelectedModel(defaultKey.default_model);
            } else {
              setSelectedModel(prov === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile');
            }
          }
        }
      } catch (err) {
        console.error('Error loading AI keys from settings:', err);
      }
    }
    loadApiKeys();
  }, []);

  // Compute Active Date Range
  const { startDate, endDate, rangeLabel, startStr, endStr } = useMemo(() => {
    const now = new Date();
    let s = now;
    let e = now;
    let label = 'Today (' + format(now, 'MMM d') + ')';

    if (initialDate && datePreset === 'today') {
      s = initialDate;
      e = initialDate;
      label = format(initialDate, 'MMM d, yyyy');
    } else if (datePreset === 'today') {
      s = now;
      e = now;
      label = 'Today (' + format(now, 'MMM d') + ')';
    } else if (datePreset === 'yesterday') {
      s = subDays(now, 1);
      e = subDays(now, 1);
      label = 'Yesterday (' + format(s, 'MMM d') + ')';
    } else if (datePreset === 'last7') {
      s = subDays(now, 7);
      e = now;
      label = 'Last 7 Days';
    } else if (datePreset === 'last30') {
      s = subDays(now, 30);
      e = now;
      label = 'Last 30 Days';
    } else if (datePreset === 'thisMonth') {
      s = startOfMonth(now);
      e = endOfMonth(now);
      label = 'This Month (' + format(now, 'MMMM') + ')';
    } else if (customStart && customEnd) {
      s = parseISO(customStart);
      e = parseISO(customEnd);
      label = `${customStart} to ${customEnd}`;
    } else {
      s = subDays(now, 90);
      e = now;
      label = 'All-Time Logs (Last 90d)';
    }

    return {
      startDate: s,
      endDate: e,
      rangeLabel: label,
      startStr: format(s, 'yyyy-MM-dd'),
      endStr: format(e, 'yyyy-MM-dd')
    };
  }, [datePreset, initialDate, customStart, customEnd]);

  // Filter Target Sites
  const filteredSites = useMemo(() => {
    if (selectedSiteId === 'all') return sites.filter(s => s.client?.toUpperCase() !== 'DCEL');
    return sites.filter(s => s.id === selectedSiteId);
  }, [sites, selectedSiteId]);

  // Filter Machine Logs & Operations in Scope (100% accurate string comparison)
  const inScopeLogs = useMemo(() => {
    return dailyMachineLogs.filter(log => {
      const siteMatch = selectedSiteId === 'all' || log.siteId === selectedSiteId;
      if (!siteMatch) return false;
      const logDateStr = (log.date || '').slice(0, 10);
      if (!logDateStr) return false;
      return logDateStr >= startStr && logDateStr <= endStr;
    });
  }, [dailyMachineLogs, selectedSiteId, startStr, endStr]);

  // Filter Site Journals in Scope
  const inScopeSiteJournals = useMemo(() => {
    return siteJournalEntries.filter(entry => {
      const siteMatch = selectedSiteId === 'all' || entry.siteId === selectedSiteId;
      if (!siteMatch) return false;
      const jDateStr = (entry.createdAt || '').slice(0, 10);
      if (!jDateStr) return true;
      return jDateStr >= startStr && jDateStr <= endStr;
    });
  }, [siteJournalEntries, selectedSiteId, startStr, endStr]);

  const inScopeHolds = useMemo(() => {
    return siteHoldPeriods.filter(h => {
      const siteMatch = selectedSiteId === 'all' || h.siteId === selectedSiteId;
      if (!siteMatch) return false;
      return true;
    });
  }, [siteHoldPeriods, selectedSiteId]);

  // Synthesize Context Metrics
  const summaryStats = useMemo(() => {
    const totalPumpingDays = inScopeLogs.filter(l => l.isActive && l.operationalDay !== 'none').length;
    const totalDowntimeDays = inScopeLogs.filter(l => !l.isActive || l.operationalDay === 'none').length;
    const totalDiesel = inScopeLogs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
    const machines = Array.from(new Set(inScopeLogs.map(l => l.assetName).filter(Boolean)));
    const activeHolds = inScopeHolds.filter(h => !h.holdEnd);

    return {
      sitesCount: filteredSites.length,
      logsCount: inScopeLogs.length,
      totalPumpingDays,
      totalDowntimeDays,
      totalDiesel,
      machinesCount: machines.length,
      activeHoldsCount: activeHolds.length,
      journalsCount: inScopeSiteJournals.length,
    };
  }, [filteredSites, inScopeLogs, inScopeHolds, inScopeSiteJournals]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Execute AI Request
  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || chatInput.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: format(new Date(), 'HH:mm')
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setChatInput('');
    setIsLoading(true);

    try {
      // 1. Fetch Key from in-memory cache with fallback to Supabase, localStorage & env
      let apiKey = '';
      const keys = cachedApiKeys;
      if (keys && keys.length > 0) {
        const match = keys.find((k: any) => (k.provider || '').toLowerCase() === selectedProvider.toLowerCase());
        if (match && match.key_value) {
          apiKey = match.key_value;
        } else {
          const def = keys.find((k: any) => k.is_default) || keys[0];
          if (def && def.key_value) apiKey = def.key_value;
        }
      }

      if (!apiKey) {
        try {
          const { data: apiKeysData } = await supabase.from('api_keys').select('*');
          if (apiKeysData && apiKeysData.length > 0) {
            cachedApiKeys = apiKeysData;
            const match = apiKeysData.find((k: any) => (k.provider || '').toLowerCase() === selectedProvider.toLowerCase());
            if (match && match.key_value) apiKey = match.key_value;
            else {
              const def = apiKeysData.find((k: any) => k.is_default) || apiKeysData[0];
              if (def && def.key_value) apiKey = def.key_value;
            }
          }
        } catch (e) {
          console.error('Error querying api_keys:', e);
        }
      }

      if (!apiKey) {
        try {
          const { data: providerKeys } = await supabase.from('ai_provider_keys').select('*');
          const match = providerKeys?.find((k: any) => (k.provider || '').toLowerCase() === selectedProvider.toLowerCase());
          if (match && match.key_value) apiKey = match.key_value;
        } catch (e) {
          console.error(e);
        }
      }

      if (!apiKey) {
        apiKey = localStorage.getItem(`${selectedProvider.toUpperCase()}_API_KEY`) || 
                 localStorage.getItem('GROQ_API_KEY') || 
                 localStorage.getItem('GEMINI_API_KEY') || 
                 (import.meta as any).env?.[`VITE_${selectedProvider.toUpperCase()}_API_KEY`] || '';
      }

      if (!apiKey) {
        apiKey = window.prompt(`Enter your ${selectedProvider === 'gemini' ? 'Gemini' : 'Groq'} API key:`) || '';
        if (!apiKey) {
          setIsLoading(false);
          return;
        }
        localStorage.setItem(`${selectedProvider.toUpperCase()}_API_KEY`, apiKey);
      }

      // 2. Build Structured Grounding Prompt Context with complete logs
      const siteSummaryContext = filteredSites.map(s => {
        const sLogs = inScopeLogs.filter(l => l.siteId === s.id);
        const sDiesel = sLogs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
        const sPumping = sLogs.filter(l => l.isActive && l.operationalDay !== 'none').length;
        const sDowntime = sLogs.filter(l => !l.isActive || l.operationalDay === 'none').length;
        const sHold = inScopeHolds.find(h => h.siteId === s.id && !h.holdEnd);

        return `- Site: "${s.name}" | Client: "${s.client}" | Status: ${s.status} ${sHold ? `(ON HOLD: "${sHold.holdNote}")` : ''} | Date Range: ${s.startDate || 'N/A'} to ${s.endDate || 'Present'} | Total Logs: ${sLogs.length} days | Pumping Days: ${sPumping} | Downtime Days: ${sDowntime} | Diesel Consumed: ${sDiesel.toLocaleString()}L`;
      }).join('\n');

      // Include all logs up to 500 records with complete downtime entries and details
      const logsSnippet = inScopeLogs.slice(0, 500).map(l => {
        const downtime = l.downtimeEntries && l.downtimeEntries.length > 0 
          ? l.downtimeEntries.map(d => `${d.reason} (${d.durationHours || 0}h)`).join(', ') 
          : '';
        const notes = [
          l.issuesOnSite ? `Issues: ${l.issuesOnSite}` : '',
          l.maintenanceDetails ? `Maint: ${l.maintenanceDetails}` : '',
          l.clientFeedback ? `Feedback: ${l.clientFeedback}` : '',
          downtime ? `Downtime: ${downtime}` : ''
        ].filter(Boolean).join(' | ') || 'None';

        return `[${l.date}] Site: "${l.siteName}" | Machine: "${l.assetName}" | Status: ${l.isActive ? 'Active Pumping' : 'Idle/Downtime'} (${l.operationalDay || 'full'} day) | Diesel: ${l.dieselUsage || 0}L | Supervisor: ${l.supervisorOnSite || 'N/A'} | Details: ${notes}`;
      }).join('\n');

      const journalSnippet = inScopeSiteJournals.slice(0, 200).map(j => {
        return `[${j.createdAt?.slice(0, 10) || 'N/A'}] Site: "${j.siteName || 'Site'}" | Stage: ${j.dewateringStage || 'operation'} | Progress: ${j.progressPercentage || 0}% | LoggedBy: ${j.loggedBy || 'N/A'} | Notes: ${j.narration || 'N/A'}`;
      }).join('\n');

      const holdsSnippet = inScopeHolds.map(h => {
        return `Site: "${h.siteName || h.siteId}" | Hold Start: ${h.holdStart} | Hold End: ${h.holdEnd || 'Still Active'} | Reason: "${h.holdNote || 'No reason provided'}"`;
      }).join('\n');

      const systemPrompt = `You are the Lead Operations Intelligence Copilot for DCEL Dewatering & Construction Engineering.
You have real-time access to the company's daily machine logs, fuel usage, site journals, waybills, and site holds.

CURRENT SCOPE:
- Target Site(s): ${selectedSiteId === 'all' ? 'All Active Corporate Sites (' + filteredSites.length + ')' : filteredSites[0]?.name}
- Date Range: ${rangeLabel} (${startStr} to ${endStr})
- Summary Metrics: ${summaryStats.logsCount} Total Machine Logs, ${summaryStats.totalPumpingDays} Pumping Days, ${summaryStats.totalDowntimeDays} Downtime Days, ${summaryStats.totalDiesel.toLocaleString()}L Total Diesel, ${summaryStats.machinesCount} Machines Active, ${summaryStats.activeHoldsCount} Active Holds.

SITE DIRECTORY:
${siteSummaryContext || 'No site context available'}

DAILY MACHINE LOGS & RUNS:
${logsSnippet || 'No machine logs found in this date range'}

SITE JOURNALS & PROGRESS:
${journalSnippet || 'No journal entries in this date range'}

SITE HOLDS & SUSPENSIONS:
${holdsSnippet || 'No site holds recorded'}

INSTRUCTIONS:
1. Answer the user's operational question with complete, fully articulated facts, exact numbers, and cross-referenced parameters from the provided data.
2. Structure your briefing using clean Markdown section headers (### Header), bold key statistics, and bullet points.
3. NEVER truncate or leave your response incomplete mid-sentence. Ensure all sections and sentences are completely finished.
4. If citing fuel, pump hours, downtime, or holds, mention the exact site and machine names.`;

      let aiReply = '';

      if (selectedProvider === 'gemini') {
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        contents.push({ role: 'user', parts: [{ text }] });

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Gemini API Error');
        }
        const data = await res.json();
        aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      } else {
        // Groq
        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text }
        ];

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel || 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.2,
            max_tokens: 4096
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Groq API Error');
        }
        const data = await res.json();
        aiReply = data?.choices?.[0]?.message?.content || 'No response generated.';
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: aiReply,
          timestamp: format(new Date(), 'HH:mm')
        }
      ]);
    } catch (err: any) {
      console.error(err);
      toast.error(`AI Error: ${err.message || 'Failed to generate response'}`);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error generating response:** ${err.message}\n\nPlease verify your API key in Settings or try selecting another provider/model.`,
          timestamp: format(new Date(), 'HH:mm')
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Quick Action Chips
  const quickActions = [
    { label: "📋 Today's Operations Brief", prompt: "Provide a comprehensive executive summary of all operations, pumping activities, and issues logged across all sites today." },
    { label: "⛽ Fuel & Efficiency Audit", prompt: "Analyze diesel fuel consumption across all active machines. Identify any high fuel usage anomalies relative to pumping hours." },
    { label: "🚨 Downtime & Stoppage Analysis", prompt: "List all machines that experienced downtime or stoppages in this period. Detail the root causes, remarks, and any ongoing site holds." },
    { label: "🌊 Jetting & Mobilisation Check", prompt: "Review all jetting activities and mobilisation waybills in this period. Are there any sites requiring re-jetting or pending demobilisation?" }
  ];

  return (
    <div className={cn(
      "flex flex-col h-full text-slate-900 dark:text-white",
      isEmbedded ? "bg-[#0b0f19] text-white" : "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
    )}>
      {/* ── Compact Flat Studio Toolbar Row ── */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs border-b shrink-0",
        isEmbedded ? "bg-[#0f1422] border-white/10" : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-800"
      )}>
        {/* Left: Scope Pickers */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {/* Site Selector */}
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs",
            isEmbedded ? "bg-white/5 border-white/10 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          )}>
            <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="bg-transparent font-bold focus:outline-none cursor-pointer text-[11px] max-w-[130px] sm:max-w-[160px] truncate"
            >
              <option value="all" className="bg-slate-900 text-white">All Sites ({sites.length})</option>
              {sites.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name} ({s.client})</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs",
            isEmbedded ? "bg-white/5 border-white/10 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          )}>
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as DateRangePreset)}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer text-[11px]"
            >
              <option value="today" className="bg-slate-900 text-white">Today</option>
              <option value="yesterday" className="bg-slate-900 text-white">Yesterday</option>
              <option value="last7" className="bg-slate-900 text-white">Last 7d</option>
              <option value="last30" className="bg-slate-900 text-white">Last 30d</option>
              <option value="thisMonth" className="bg-slate-900 text-white">This Month</option>
              <option value="all" className="bg-slate-900 text-white">All Logs (90d)</option>
            </select>
          </div>

          {/* Compact Grounding Pill Badges */}
          <div className="hidden xl:flex items-center gap-1 pl-1.5 border-l border-white/10">
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
              {summaryStats.totalPumpingDays}d Pumping
            </span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
              {summaryStats.totalDiesel.toLocaleString()}L
            </span>
          </div>
        </div>

        {/* Right: AI Provider & Clear */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Provider / Model */}
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[11px]",
            isEmbedded ? "bg-white/5 border-white/10 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          )}>
            <Cpu className="w-3 h-3 text-indigo-400" />
            <select
              value={selectedProvider}
              onChange={e => {
                const p = e.target.value as 'gemini' | 'groq';
                setSelectedProvider(p);
                setSelectedModel(p === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile');
              }}
              className="bg-transparent font-bold focus:outline-none cursor-pointer text-[11px] uppercase"
            >
              <option value="gemini" className="bg-slate-900 text-white">Gemini</option>
              <option value="groq" className="bg-slate-900 text-white">Groq</option>
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1 rounded-lg border border-white/10 text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Clear Conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

          {onClose && !isEmbedded && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs rounded-md border-slate-200 dark:border-slate-700"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* ── Chat Stream Area ── */}
      <div className={cn(
        "flex-1 overflow-y-auto p-3.5 space-y-3.5 style-scroll",
        isEmbedded ? "bg-[#0b0f19]" : "bg-white dark:bg-slate-900"
      )}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2.5 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-white">
              Daily Operations Intelligence Copilot
            </h3>
            <p className="text-[11px] text-white/50 mt-1 mb-4 leading-relaxed">
              Ask anything about daily machine runs, fuel burned, stoppages, crew journals, and site history across <strong>{rangeLabel}</strong>.
            </p>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-1 gap-1.5 w-full text-left">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action.prompt)}
                  className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-indigo-600/20 hover:border-indigo-500/40 transition-all text-xs group text-left"
                >
                  <span className="font-bold text-slate-200 group-hover:text-indigo-400 block text-[11px] mb-0.5">
                    {action.label}
                  </span>
                  <span className="text-[10px] text-white/40 line-clamp-1">
                    {action.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-2.5 text-xs leading-relaxed max-w-2xl",
                msg.role === 'user' ? "ml-auto justify-end" : "mr-auto justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={cn(
                "rounded-2xl p-3 shadow-xs border relative group",
                msg.role === 'user'
                  ? "bg-indigo-600 text-white border-indigo-700 rounded-tr-none"
                  : "bg-white/5 text-slate-200 border-white/10 rounded-tl-none"
              )}>
                {msg.role === 'assistant' ? (
                  <FormattedAiMessage text={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap text-[11.5px]">
                    {msg.content}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-white/5 text-[9px] opacity-60">
                  <span>{msg.timestamp}</span>

                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(msg.content, idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-400 p-0.5"
                      title="Copy response"
                    >
                      {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-2.5 text-xs mr-auto max-w-md">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs animate-pulse">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-2xl p-3 bg-white/5 border border-white/10 rounded-tl-none flex items-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
              <span>Analyzing machine logs & site parameters across {rangeLabel}...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box ── */}
      <div className={cn(
        "p-2.5 border-t shrink-0",
        isEmbedded ? "bg-[#0f1422] border-white/10" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      )}>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder={`Ask about daily logs, pump hours, fuel or downtime...`}
            disabled={isLoading}
            className={cn(
              "flex-1 h-8 rounded-lg text-xs px-3 focus-visible:ring-indigo-500",
              isEmbedded ? "bg-white/5 border-white/10 text-white placeholder:text-white/40" : "bg-slate-50 dark:bg-slate-800/60"
            )}
          />

          <Button
            type="submit"
            disabled={!chatInput.trim() || isLoading}
            size="sm"
            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold gap-1.5 shadow-xs shrink-0"
          >
            <Send className="w-3 h-3" />
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
