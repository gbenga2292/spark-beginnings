import { useState, useMemo } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Calendar, User, Info, AlignLeft, PackageCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ConsumableUsageLog } from '@/src/types/operations';

interface SiteItem {
  assetId: string;
  assetName: string;
  quantity: number;
  unit?: string;
}

interface BulkConsumableLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site;
  consumables: SiteItem[];
}

export function BulkConsumableLogModal({ isOpen, onClose, site, consumables }: BulkConsumableLogModalProps) {
  const { addConsumableLogs, employees, consumableLogs } = useAppStore();

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [usedBy, setUsedBy] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [notes, setNotes] = useState('');

  const existingLoggedDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    const datesWithLogs = new Set<string>();
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    const datesToCheck: string[] = [];
    if (currentDate <= lastDate) {
      while (currentDate <= lastDate) {
        datesToCheck.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const consumableIds = consumables.map(c => c.assetId);

    consumableLogs.forEach(log => {
      if (
        consumableIds.includes(log.assetId) &&
        log.siteId === site.id &&
        datesToCheck.includes(log.date)
      ) {
        datesWithLogs.add(log.date);
      }
    });

    return Array.from(datesWithLogs).sort();
  }, [startDate, endDate, consumables, consumableLogs, site.id]);

  // Track quantities for each consumable: key is assetId, value is quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleQuantityChange = (assetId: string, value: string) => {
    const qty = parseFloat(value);
    setQuantities(prev => ({
      ...prev,
      [assetId]: isNaN(qty) ? 0 : qty
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!usedBy) {
      toast.error('Please select who used the items.');
      return;
    }

    const itemsToLog = consumables.filter(item => (quantities[item.assetId] || 0) > 0);

    if (itemsToLog.length === 0) {
      toast.error('Please enter a quantity for at least one item.');
      return;
    }

    // Validate quantities against available stock
    for (const item of itemsToLog) {
      const qty = quantities[item.assetId];
      if (qty > item.quantity) {
        toast.error(`Cannot log more ${item.assetName} than available (${item.quantity}).`);
        return;
      }
    }

    const datesToLog: string[] = [];
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    if (currentDate > lastDate) {
      toast.error('End date must be after or equal to start date.');
      return;
    }

    while (currentDate <= lastDate) {
      datesToLog.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const newLogs: ConsumableUsageLog[] = datesToLog.flatMap(logDate => {
      return itemsToLog.map(item => ({
        id: crypto.randomUUID(),
        assetId: item.assetId,
        assetName: item.assetName,
        siteId: site.id,
        siteName: site.name,
        date: logDate,
        quantityUsed: quantities[item.assetId],
        usedBy,
        usedFor,
        notes,
        loggedBy: 'Current User',
        created_at: new Date().toISOString()
      }));
    });

    addConsumableLogs(newLogs);
    toast.success(`Successfully logged ${newLogs.length} item(s) across ${datesToLog.length} day(s).`);
    
    // Reset form
    setQuantities({});
    setUsedBy('');
    setUsedFor('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} fullScreenMobile={true}>
      <DialogContent className="w-full h-[100dvh] max-h-[100dvh] max-w-full sm:max-w-2xl sm:h-auto sm:max-h-[90vh] p-0 border-0 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-950">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-500" />
            Bulk Log Consumables
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Common Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> From Date *
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> To Date *
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                  className="h-10 text-sm"
                />
              </div>
              
              {existingLoggedDates.length > 0 && (
                <div className="md:col-span-2 mt-1 mb-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-400">
                    <span className="font-bold">Note:</span> Consumable logs already exist on: 
                    <span className="font-semibold ml-1">{existingLoggedDates.map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}</span>.
                    Saving will add additional log entries for these dates.
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Used By (Who) *
                </Label>
                <select
                  value={usedBy}
                  onChange={(e) => setUsedBy(e.target.value)}
                  required
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={`${emp.firstname} ${emp.surname}`}>
                      {emp.firstname} {emp.surname} - {emp.position}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-slate-400" /> Used For (Task/Area)
                </Label>
                <Input
                  placeholder="e.g. Generator refuel, Foundation pouring..."
                  value={usedFor}
                  onChange={(e) => setUsedFor(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Consumables Inventory</h4>
              {consumables.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                  <p className="text-sm">No consumables available on this site to log.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {consumables.map(item => (
                    <div key={item.assetId} className="flex items-center justify-between p-3 sm:px-4 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.assetName}</p>
                        <p className="text-xs text-slate-500">Available: {item.quantity} {item.unit || 'pcs'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium text-slate-400">Used Qty:</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          max={item.quantity}
                          value={quantities[item.assetId] || ''}
                          onChange={(e) => handleQuantityChange(item.assetId, e.target.value)}
                          placeholder="0"
                          className="w-24 h-9 text-right font-semibold border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AlignLeft className="h-3.5 w-3.5 text-slate-400" /> General Notes
              </Label>
              <Textarea
                placeholder="Any additional remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none h-20 text-sm"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
              disabled={consumables.length === 0 || consumables.every(i => !(quantities[i.assetId] > 0))}
            >
              Log Usage
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
