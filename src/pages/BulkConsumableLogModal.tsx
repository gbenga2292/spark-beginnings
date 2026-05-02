import { useState } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Calendar, User, Info, AlignLeft, PackageCheck } from 'lucide-react';
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
  const { addConsumableLogs, employees } = useAppStore();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [usedBy, setUsedBy] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [notes, setNotes] = useState('');

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

    const newLogs: ConsumableUsageLog[] = itemsToLog.map(item => ({
      id: crypto.randomUUID(),
      assetId: item.assetId,
      assetName: item.assetName,
      siteId: site.id,
      siteName: site.name,
      date,
      quantityUsed: quantities[item.assetId],
      usedBy,
      usedFor,
      notes,
      loggedBy: 'Current User',
      created_at: new Date().toISOString()
    }));

    addConsumableLogs(newLogs);
    toast.success(`Successfully logged ${newLogs.length} items.`);
    
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
                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date *
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="h-10 text-sm"
                />
              </div>
              
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
