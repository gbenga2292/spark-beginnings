import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  X, 
  Trash2, 
  Mic, 
  MicOff, 
  Building2, 
  Loader2, 
  Maximize2,
  Minimize2,
  Layers
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { toast } from 'sonner';
import { useAgentContext } from '@/src/hooks/useAgentContext';
import { getActiveAiConfig, processAgentMessage } from '@/src/lib/agentExecutor';
import { ActionProposalCard } from './ActionProposalCard';
import { FormattedAgentMessage } from './FormattedAgentMessage';
import type { AgentMessage, ActionProposal } from '@/src/types/agent';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SiteCopilotDrawer({ isOpen, onClose }: Props) {
  const { isDark } = useTheme();
  const { context, currentRoute, selectedSiteId, setSelectedSiteId, sites } = useAgentContext();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `👋 Hello! I'm your universal **Spark AI Co-Pilot**.\n\nI can execute actions across the entire system: **Billing & Invoices**, **Ledger & Expenses**, **HR & Staff**, **Site Diary**, and **Fleet Operations**.\n\nAsk me to draft records or review operational happenings anytime!`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const isSiteModule = Boolean(
    currentRoute?.path.includes('/sites') || 
    currentRoute?.path.includes('/operations') ||
    currentRoute?.path.includes('/attendance')
  );

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isProcessing]);

  const toggleSpeech = () => {
    if (!speechSupported || !recognitionRef.current) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info('Listening...');
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isProcessing) return;

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsProcessing(true);

    try {
      const config = await getActiveAiConfig();
      if (!config.apiKey) {
        throw new Error('No AI API key found. Please configure a key in Settings -> AI Keys.');
      }

      const result = await processAgentMessage(textToSend, messages, context, config);

      const assistantMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        timestamp: new Date().toISOString(),
        proposals: result.proposals,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Agent processing error:', err);
      const errorMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message || 'Failed to process message with AI.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error(err.message || 'AI request failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProposal = (messageId: string, updatedProposal: ActionProposal) => {
    setMessages((prev) => {
      const updatedMessages = prev.map((msg) => {
        if (msg.id === messageId && msg.proposals) {
          return {
            ...msg,
            proposals: msg.proposals.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)),
          };
        }
        return msg;
      });

      // Inject confirmation receipt into conversational memory for intelligent follow-ups
      if (updatedProposal.status === 'confirmed') {
        const receiptMessage: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `✅ **Saved:** ${updatedProposal.title}.\n*(You can now ask me to take next steps or create follow-up tasks for this record)*`,
          timestamp: new Date().toISOString(),
        };
        return [...updatedMessages, receiptMessage];
      }

      return updatedMessages;
    });
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Chat history cleared. How can I assist you with operations, billing, or HR today?',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Route-adaptive prompt suggestions
  const getDynamicQuickPrompts = () => {
    const path = currentRoute?.path || '';
    if (path.includes('/billing') || path.includes('/client-accounts') || path.includes('/invoices')) {
      return [
        'Draft new invoice for ₦1,500,000 for August',
        'Create weekly billing invoice for Lekki client',
        'Generate VAT inclusive invoice',
      ];
    }
    if (path.includes('/ledger') || path.includes('/company-expenses')) {
      return [
        'Record ₦250,000 diesel expense from GTBank',
        'Log equipment maintenance voucher for ₦180,000',
        'Record subcontractor expense for concrete works',
      ];
    }
    if (path.includes('/employees') || path.includes('/onboarding')) {
      return [
        'Onboard new Site Engineer in Civil department',
        'Add new Field Operator starting Monday',
        'Draft employment details for new supervisor',
      ];
    }
    return [
      "Log today's site work & progress",
      "Record 12 workers attendance on site",
      "Draft invoice for ₦2.5M for dewatering",
      "Consumed 40 bags cement on Slab B",
      "Excavator 01 hydraulic pressure issue",
      "Record ₦150k fuel expense in ledger",
    ];
  };

  const quickPrompts = getDynamicQuickPrompts();

  const hasAccess = context.user.privileges?.aiCopilot?.canAccess !== false;
  if (!isOpen || !hasAccess) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Drawer Container with Theme Adaptation */}
      <div 
        className={cn(
          "h-full flex flex-col shadow-2xl transition-all duration-300 relative border-l",
          isDark 
            ? "bg-slate-950 border-slate-800 text-slate-100" 
            : "bg-white border-slate-200 text-slate-900",
          isExpanded ? "w-full md:w-[720px]" : "w-full sm:w-[490px]"
        )}
      >
        {/* Drawer Header */}
        <div 
          className={cn(
            "p-3.5 border-b backdrop-blur-md flex items-center justify-between gap-2",
            isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-50/90 border-slate-200"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  Spark AI Co-Pilot
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-semibold border",
                  isDark 
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                )}>
                  Universal ERP
                </span>
              </div>
              <p className={cn("text-[10.5px] flex items-center gap-1 font-medium truncate max-w-[320px]", isDark ? "text-slate-400" : "text-slate-500")}>
                <Layers className="w-3 h-3 text-sky-500 shrink-0 inline" />
                <span className="truncate">{currentRoute?.activeEntity || currentRoute?.moduleName || 'Global Assistant'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "w-7 h-7 cursor-pointer",
                isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              )}
              title={isExpanded ? 'Collapse width' : 'Expand width'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearChat}
              className={cn(
                "w-7 h-7 cursor-pointer",
                isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              )}
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className={cn(
                "w-7 h-7 cursor-pointer",
                isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              )}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Context Bar: Only visible when on Site & Field Operations screens */}
        {isSiteModule && sites.length > 0 && (
          <div 
            className={cn(
              "px-3.5 py-2 border-b flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150",
              isDark ? "bg-slate-900/50 border-slate-800/80" : "bg-slate-50 border-slate-200"
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className={cn("text-[11px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                Active Site:
              </span>
            </div>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className={cn(
                "text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium max-w-[240px] truncate cursor-pointer border transition-colors",
                isDark 
                  ? "bg-slate-900 text-slate-200 border-slate-700/80" 
                  : "bg-white text-slate-800 border-slate-300 shadow-2xs"
              )}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.clientName ? `(${s.clientName})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Message Thread */}
        <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", isDark ? "bg-slate-950/60" : "bg-slate-50/40")}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col',
                msg.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl p-3.5 shadow-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : isDark
                      ? 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-xs shadow-md'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs shadow-sm'
                )}
              >
                <FormattedAgentMessage text={msg.content} isUser={msg.role === 'user'} />
              </div>

              {/* Render Action Proposal Cards if any */}
              {msg.proposals && msg.proposals.length > 0 && (
                <div className="w-full mt-2 space-y-2">
                  {msg.proposals.map((prop) => (
                    <ActionProposalCard
                      key={prop.id}
                      proposal={prop}
                      context={context}
                      onUpdateProposal={(updated) => handleUpdateProposal(msg.id, updated)}
                      onCloseParent={onClose}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div 
              className={cn(
                "flex items-center gap-2 p-3 rounded-2xl border text-xs w-fit shadow-xs",
                isDark 
                  ? "bg-slate-900/90 border-slate-800 text-slate-400" 
                  : "bg-white border-slate-200 text-slate-600"
              )}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Co-Pilot is formulating action proposals...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div 
          className={cn(
            "px-3.5 py-2 border-t overflow-x-auto flex items-center gap-1.5 no-scrollbar",
            isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200 bg-slate-50"
          )}
        >
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              disabled={isProcessing}
              className={cn(
                "text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full border transition-all font-medium cursor-pointer shadow-2xs",
                isDark 
                  ? "bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/40 hover:text-indigo-300 text-slate-300 border-slate-700/60" 
                  : "bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 border-slate-200"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div 
          className={cn(
            "p-3 border-t backdrop-blur-md",
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          )}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            {speechSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSpeech}
                className={cn(
                  'w-9 h-9 shrink-0 rounded-xl transition-all border mb-0.5',
                  isListening
                    ? 'bg-rose-500/20 text-rose-500 border-rose-500/30 animate-pulse'
                    : isDark 
                      ? 'text-slate-400 hover:text-white bg-slate-800/60 border-slate-700/60'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-100 border-slate-200'
                )}
                title="Voice input"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}

            <Textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask Co-Pilot (Shift+Enter for newline)...`}
              disabled={isProcessing}
              rows={1}
              className={cn(
                "flex-1 text-xs min-h-[38px] max-h-[140px] resize-y py-2 px-3 rounded-xl shadow-2xs border transition-colors leading-relaxed",
                isDark 
                  ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500" 
                  : "bg-slate-50/80 border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
              )}
            />

            <Button
              type="submit"
              size="icon"
              disabled={!inputPrompt.trim() || isProcessing}
              className="w-9 h-9 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md disabled:opacity-40 cursor-pointer mb-0.5"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
