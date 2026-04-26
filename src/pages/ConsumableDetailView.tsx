import { useState } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { ConsumableUsageLog } from '@/src/types/operations';
import { ArrowLeft, Layers, Calendar, User, AlignLeft, Info, Activity, Clock, Plus } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface ConsumableDetailViewProps {
  item: {
    assetId: string;
    assetName: string;
    quantity: number;
    unit?: string;
  };
  site: Site;
  logs: ConsumableUsageLog[];
  onBack: () => void;
}

export function ConsumableDetailView({ item, site, logs, onBack }: ConsumableDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'analytics'>('log');
  const { addConsumableLogs, employees } = useAppStore();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [usedBy, setUsedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [usedFor, setUsedFor] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || !usedBy) {
      toast.error('Please fill in quantity and who used it.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be greater than zero.');
      return;
    }

    if (qty > item.quantity) {
      toast.error('Cannot log more than available on site.');
      return;
    }

    const newLog: ConsumableUsageLog = {
      id: crypto.randomUUID(),
      assetId: item.assetId,
      assetName: item.assetName,
      siteId: site.id,
      siteName: site.name,
      date,
      quantityUsed: qty,
      usedBy,
      usedFor,
      notes,
      loggedBy: 'Current User', // Should come from auth/userStore ideally
      created_at: new Date().toISOString()
    };

    addConsumableLogs([newLog]);
    toast.success('Consumable usage logged successfully.');
    
    // Reset form
    setQuantity('');
    setUsedBy('');
    setNotes('');
    setUsedFor('');
    setActiveTab('history');
  };

  const totalUsed = logs.reduce((acc, log) => acc + log.quantityUsed, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-8 w-8 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">{item.assetName}</h1>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Consumable • {site.name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-500">Available on Site</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {item.quantity} <span className="text-xs font-normal text-slate-400">{item.unit || 'pcs'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 shrink-0">
            <button
              onClick={() => setActiveTab('log')}
              className={cn(
                "flex items-center gap-2 px-1 py-4 mr-6 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                activeTab === 'log'
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <Plus className="h-4 w-4" />
              Log Entry
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex items-center gap-2 px-1 py-4 mr-6 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                activeTab === 'history'
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <Clock className="h-4 w-4" />
              History / Logs
              <span className={cn(
                "text-[11px] font-bold px-1.5 py-0.5 rounded",
                activeTab === 'history'
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              )}>
                {logs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                "flex items-center gap-2 px-1 py-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                activeTab === 'analytics'
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <Activity className="h-4 w-4" />
              Analytics
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30 p-6">
            {activeTab === 'log' && (
              <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-emerald-500" />
                    Record Consumable Usage
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Log how much of this item was used and by whom.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" /> Date
                      </Label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-400" /> Quantity Used ({item.unit || 'pcs'})
                      </Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        max={item.quantity}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={`Max: ${item.quantity}`}
                        required
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" /> Used By (Who)
                      </Label>
                      <select
                        value={usedBy}
                        onChange={(e) => setUsedBy(e.target.value)}
                        required
                        className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-emerald-800"
                      >
                        <option value="">Select Employee...</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={`${emp.firstname} ${emp.surname}`}>
                            {emp.firstname} {emp.surname} - {emp.position}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Info className="h-4 w-4 text-slate-400" /> Used For (Task/Area)
                      </Label>
                      <Input
                        placeholder="e.g. Generator refuel, Trench backfill..."
                        value={usedFor}
                        onChange={(e) => setUsedFor(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <AlignLeft className="h-4 w-4 text-slate-400" /> Additional Notes
                    </Label>
                    <Textarea
                      placeholder="Any specific remarks about this usage..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none h-24"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => {
                      setQuantity(''); setUsedBy(''); setNotes(''); setUsedFor('');
                    }}>
                      Clear
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]">
                      Log Usage
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Usage History</h3>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('log')} className="h-8 text-xs gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New Entry
                  </Button>
                </div>
                
                {logs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                    <Clock className="h-12 w-12 mb-3 text-slate-200 dark:text-slate-800" />
                    <p>No usage history found for this item.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                      <div key={log.id} className="p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/30">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-none">
                            {new Date(log.date).getDate()}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-emerald-500/70 mt-0.5">
                            {new Date(log.date).toLocaleString('default', { month: 'short' })}
                          </span>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {log.usedBy} <span className="text-slate-400 font-normal">used</span> {log.quantityUsed} <span className="text-slate-400 font-normal">{item.unit || 'pcs'}</span>
                              </p>
                              {log.usedFor && (
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">Task: {log.usedFor}</p>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              {new Date(log.date).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {log.notes && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 bg-white dark:bg-slate-950 p-2 rounded-md border border-slate-100 dark:border-slate-800 italic">
                              "{log.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center mb-3">
                      <Layers className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Currently Available</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{item.quantity} <span className="text-sm font-normal text-slate-400">{item.unit || 'pcs'}</span></p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center mb-3">
                      <Activity className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Consumed</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalUsed} <span className="text-sm font-normal text-slate-400">{item.unit || 'pcs'}</span></p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="h-12 w-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center mb-3">
                      <Clock className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Usage Logs</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{logs.length}</p>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                  <Activity className="h-12 w-12 text-slate-200 dark:text-slate-800 mb-4" />
                  <p className="text-slate-500 font-medium">Analytics charts will appear here as more data is collected.</p>
                  <p className="text-sm text-slate-400 mt-1">Tracks usage trends over time.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
