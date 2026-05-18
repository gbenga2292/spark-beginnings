import { X, Building2, MapPin, AlertTriangle, FileText, CheckCircle2, Clock, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
}

export function Client360Sidebar({ isOpen, onClose, clientName = "Acme Corp" }: Props) {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div className={cn(
        "relative w-full max-w-md h-full shadow-2xl flex flex-col slide-in-from-right duration-300",
        isDark ? "bg-slate-900 border-l border-slate-800" : "bg-slate-50 border-l border-slate-200"
      )}>
        
        {/* Header */}
        <div className={cn("flex-shrink-0 border-b p-5 flex items-start justify-between", isDark ? "bg-slate-800/50 border-slate-800" : "bg-white border-slate-200")}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <h2 className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-900")}>{clientName}</h2>
            </div>
            <div className={cn("flex items-center gap-2 text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
              <span>Client 360 Overview</span>
              <Badge variant="outline" className={cn("text-[10px]", isDark ? "bg-indigo-900/30 text-indigo-400 border-indigo-800" : "bg-indigo-50 text-indigo-700 border-indigo-200")}>Active</Badge>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={cn("p-2 -mr-2 rounded-lg transition-colors", isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 style-scroll">
          
          {/* AI Risk Brief (Groq Prototype) */}
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl p-4 shadow-md text-white relative overflow-hidden group border border-indigo-700/50">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
              <Sparkles className="w-16 h-16" />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Groq AI Intelligence Brief</span>
            </div>
            <p className="text-sm text-indigo-50 leading-relaxed relative z-10">
              <strong className="text-white">Risk Alert:</strong> {clientName} has a high VAT deficit of ₦4,500,000 and 12 hours of recent machine downtime across 2 active sites. Consider pausing the 3 pending approval tasks until the financial deficit is cleared.
            </p>
          </div>

          {/* Financial Health */}
          <div>
            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-500" : "text-slate-400")}>Financial Health</h3>
            <div className={cn("border rounded-xl p-4 shadow-sm space-y-3", isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200")}>
              <div className="flex justify-between items-center">
                <div className={cn("flex items-center gap-2 text-sm font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  VAT Deficit
                </div>
                <span className="text-base font-black text-rose-500">₦4,500,000</span>
              </div>
              <div className={cn("h-px w-full", isDark ? "bg-slate-700" : "bg-slate-100")} />
              <div className="flex justify-between items-center">
                <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-slate-400" : "text-slate-600")}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Total Payments Cleared
                </div>
                <span className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-800")}>₦12,450,000</span>
              </div>
            </div>
          </div>

          {/* Operational Health */}
          <div>
            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-500" : "text-slate-400")}>Operational Health</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("border rounded-xl p-3 shadow-sm", isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200")}>
                <div className="text-slate-500 mb-1"><MapPin className="w-4 h-4" /></div>
                <div className={cn("text-2xl font-black", isDark ? "text-slate-100" : "text-slate-800")}>4</div>
                <div className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Active Sites</div>
              </div>
              <div className={cn("border rounded-xl p-3 shadow-sm", isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200")}>
                <div className="text-amber-500 mb-1"><AlertTriangle className="w-4 h-4" /></div>
                <div className={cn("text-2xl font-black", isDark ? "text-slate-100" : "text-slate-800")}>12h</div>
                <div className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>Recent Downtime</div>
              </div>
              <div className={cn("col-span-2 border rounded-xl p-3 shadow-sm flex justify-between items-center", isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200")}>
                <span className={cn("text-xs font-semibold", isDark ? "text-slate-400" : "text-slate-600")}>Avg. Daily Diesel Usage</span>
                <span className="text-sm font-bold text-indigo-500">450 Litres</span>
              </div>
            </div>
          </div>

          {/* Active Workflows */}
          <div>
            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-500" : "text-slate-400")}>Active Workflows</h3>
            <div className={cn("border rounded-xl overflow-hidden shadow-sm", isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200")}>
              <div className={cn("p-3 border-b cursor-pointer transition-colors flex justify-between items-start", isDark ? "border-slate-700 hover:bg-slate-800" : "border-slate-100 hover:bg-slate-50")}>
                <div>
                  <h4 className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-800")}>Review Quotation for Site B</h4>
                  <p className={cn("text-xs flex items-center gap-1 mt-1", isDark ? "text-slate-400" : "text-slate-500")}><Clock className="w-3 h-3" /> Waiting for Manager Approval</p>
                </div>
                <Badge className={cn("border-none text-[10px]", isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700 hover:bg-amber-100")}>Pending</Badge>
              </div>
              <div className={cn("p-3 border-b cursor-pointer transition-colors flex justify-between items-start", isDark ? "border-slate-700 hover:bg-slate-800" : "border-slate-100 hover:bg-slate-50")}>
                <div>
                  <h4 className={cn("text-sm font-bold", isDark ? "text-slate-200" : "text-slate-800")}>Deploy Pump to Main Site</h4>
                  <p className={cn("text-xs flex items-center gap-1 mt-1", isDark ? "text-slate-400" : "text-slate-500")}><Calendar className="w-3 h-3" /> Due Today</p>
                </div>
                <Badge className={cn("border-none text-[10px]", isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100")}>In Progress</Badge>
              </div>
              <div className={cn("p-2 text-center", isDark ? "bg-slate-800" : "bg-slate-50")}>
                <Button variant="link" className="text-xs text-indigo-500 hover:text-indigo-400 h-auto p-0">View all 8 tasks</Button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={cn("flex-shrink-0 border-t p-4 flex gap-3", isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200")}>
          <Button variant="outline" className={cn("flex-1 text-xs h-9", isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "")}>
            <FileText className="w-4 h-4 mr-2" />
            Full Report
          </Button>
          <Button className="flex-1 text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
            View Dashboard
          </Button>
        </div>

      </div>
    </div>
  );
}
