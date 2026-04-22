import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  ArrowRightLeft, Search, Clock, Package, CheckCircle2,
  ChevronRight, User, ShieldCheck
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';

import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast } from '@/src/components/ui/toast';

export function CheckoutManager() {
  const { assets, checkouts, addCheckout } = useOperations();
  const { isDark } = useTheme();
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [returnInDays, setReturnInDays] = useState(7);
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  useSetPageTitle(
    'Quick Checkout System',
    'Issue tools, PPE, and consumables directly to field staff'
  );

  const recentCheckouts = checkouts.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Checkout Form Card */}
        <Card className="lg:col-span-3 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-5 sm:p-6 flex flex-col h-full">
            {/* Progress Indicator */}
            <div className="flex items-center gap-4 mb-6 overflow-x-auto no-scrollbar">
              {['Selection', 'Employee Info', 'Final Review'].map((label, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border transition-all",
                    activeStep >= i 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold",
                    activeStep >= i ? "text-blue-600" : "text-slate-400"
                  )}>{label}</span>
                  {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-700 mx-1" />}
                </div>
              ))}
            </div>

            <div className="space-y-5 flex-1 min-h-[300px]">
              {activeStep === 0 && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block ml-1">Search & Select Asset</label>
                    <div className="relative">
                      <Input 
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-lg text-sm font-medium placeholder:text-slate-400 focus-visible:ring-blue-500/50 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        placeholder="Type asset name or scan ID..."
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {assets.filter(a => a.type === 'consumable' || a.category === 'ppe').slice(0, 4).map(a => (
                      <button 
                        key={a.id}
                        onClick={() => setSelectedAssetId(a.id)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all active:scale-95 group relative overflow-hidden",
                          selectedAssetId === a.id 
                            ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-300"
                        )}
                      >
                        <Package className={cn("h-4 w-4 mb-2", selectedAssetId === a.id ? "text-white" : "text-blue-500")} />
                        <p className="text-[11px] font-semibold text-current opacity-60 capitalize mb-0.5">{a.category}</p>
                        <p className="font-semibold text-xs truncate leading-tight">{a.name}</p>
                        {selectedAssetId === a.id && (
                          <div className="absolute top-1.5 right-1.5">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedAsset && (
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 flex items-center justify-between animate-in zoom-in-95 duration-300">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-xs font-bold text-blue-800 dark:text-blue-300">{selectedAsset.name}</p>
                          <p className="text-xs text-blue-600/70 font-medium mt-0.5">{selectedAsset.availableQuantity} in Stock</p>
                        </div>
                      </div>
                      <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm items-center">
                        <button onClick={() => setQuantity(Math.max(1, quantity-1))} className="w-7 h-7 flex items-center justify-center font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all">-</button>
                        <span className="w-8 h-7 flex items-center justify-center font-bold text-blue-600 text-sm">{quantity}</span>
                        <button onClick={() => setQuantity(quantity+1)} className="w-7 h-7 flex items-center justify-center font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all">+</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block ml-1">Employee Name / ID</label>
                    <div className="relative">
                      <Input 
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-lg text-sm font-medium placeholder:text-slate-400 focus-visible:ring-blue-500/50 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        placeholder="Enter full name or employee ID..."
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block ml-1">Expected Return (Days)</label>
                    <div className="relative">
                      <Input 
                        type="number"
                        min="1"
                        value={returnInDays}
                        onChange={(e) => setReturnInDays(parseInt(e.target.value) || 1)}
                        className="w-full h-11 pl-10 pr-4 rounded-lg text-sm font-medium focus-visible:ring-blue-500/50 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && selectedAsset && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-800/50 space-y-4">
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <Package className="h-4 w-4" /> Final Review
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedAsset.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{quantity} {selectedAsset.unitOfMeasurement}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{employeeName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return In</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{returnInDays} Days</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-4">
              <Button 
                variant="outline"
                disabled={activeStep === 0}
                onClick={() => setActiveStep(prev => prev - 1)}
                className="font-semibold text-xs text-slate-500 h-10 px-6 disabled:opacity-0 transition-opacity"
              >
                Back
              </Button>
              <Button 
                onClick={async () => {
                  if(activeStep < 2) setActiveStep(prev => prev + 1);
                  else {
                    setIsSubmitting(true);
                    try {
                      await addCheckout({
                        assetId: selectedAssetId,
                        assetName: selectedAsset?.name || 'Unknown',
                        quantity,
                        employeeId: 'EMP-TEMP', // In a real app, this would be selected from a list
                        employeeName,
                        returnInDays
                      });
                      toast.success('Checkout Processed Successfully!');
                      setActiveStep(0);
                      setSelectedAssetId('');
                      setEmployeeName('');
                    } catch (error) {
                      toast.error('Failed to process checkout');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                disabled={!selectedAssetId || (activeStep === 1 && !employeeName) || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm px-8 h-10"
              >
                {isSubmitting ? 'Processing...' : (activeStep < 2 ? 'Next Step' : 'Confirm Issue')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-700 dark:text-white">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Recent Issuances
                </h3>
                <div className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-3">
                {recentCheckouts.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-xs font-medium">No recent activity</p>
                  </div>
                ) : recentCheckouts.map((log) => (
                  <div key={log.id} className="flex gap-3 items-center p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center font-semibold text-xs text-slate-500 border border-slate-200 dark:border-slate-700">
                      {log.employeeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{log.employeeName}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        {log.quantity}x {log.assetName} • {new Date(log.checkoutDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full text-xs font-semibold text-slate-500 border-slate-200 dark:border-slate-700 h-9">
                  View Full Activity
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden relative group">
            <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-5 sm:p-6 relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <ArrowRightLeft className="h-6 w-6 text-blue-200" />
                <Badge className="bg-white/20 text-white border-0 text-[11px] font-semibold px-2 py-0.5">LIVE</Badge>
              </div>
              <div>
                <h4 className="text-3xl font-bold">{checkouts.filter(c => new Date(c.checkoutDate).toDateString() === new Date().toDateString()).length}</h4>
                <p className="text-xs text-blue-200 mt-1">Items Issued Today</p>
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/70">Efficiency</span>
                <span className="text-sm font-bold">98.2%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
