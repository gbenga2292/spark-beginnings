import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  ArrowRightLeft, 
  Search, 
  UserPlus, 
  Clock, 
  Package, 
  Activity, 
  CheckCircle2,
  ListRestart,
  CreditCard,
  Target,
  ChevronRight,
  TrendingDown,
  User,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function CheckoutManager() {
  const { assets } = useOperations();
  const { isDark } = useTheme();
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeStep, setActiveStep] = useState(0);
  const [view, setView] = useState<'checkout' | 'activity' | 'analytics'>('checkout');

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  useSetPageTitle(
    'Quick Checkout System',
    'Issue tools, PPE, and consumables directly to field staff',
    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-9">
       <Button 
         variant="ghost" 
         size="sm" 
         onClick={() => setView('checkout')}
         className={cn(
           "text-[10px] font-black uppercase tracking-wider px-3 h-7",
           view === 'checkout' ? "bg-slate-100 dark:bg-slate-800 text-blue-600" : "text-slate-500 hover:text-blue-600"
         )}
       >
         Checkout
       </Button>
       <Button 
         variant="ghost" 
         size="sm" 
         onClick={() => setView('activity')}
         className={cn(
           "text-[10px] font-black uppercase tracking-wider px-3 h-7",
           view === 'activity' ? "bg-slate-100 dark:bg-slate-800 text-blue-600" : "text-slate-500 hover:text-blue-600"
         )}
       >
         Activity
       </Button>
       <Button 
         variant="ghost" 
         size="sm" 
         onClick={() => setView('analytics')}
         className={cn(
           "text-[10px] font-black uppercase tracking-wider px-3 h-7",
           view === 'analytics' ? "bg-slate-100 dark:bg-slate-800 text-blue-600" : "text-slate-500 hover:text-blue-600"
         )}
       >
         Analytics
       </Button>
    </div>
  );

  // Mock recent activity for checkout
  const recentCheckouts = [
    { id: 'CK-881', employee: 'David Adeleke', asset: 'Reflective Vests', qty: 2, time: '10:15 AM', status: 'completed' },
    { id: 'CK-880', employee: 'Grace Eniola', asset: 'Safety Boots', qty: 1, time: '09:45 AM', status: 'completed' },
    { id: 'CK-879', employee: 'Samuel Okon', asset: 'Raincoat (Medium)', qty: 1, time: '08:30 AM', status: 'completed' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Checkout Form Card */}
        <Card className="lg:col-span-3 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all overflow-hidden border">
           <CardContent className="p-6 sm:p-8 flex flex-col h-full">
               {/* Progress Indicator */}
               <div className="flex items-center gap-4 mb-8 overflow-x-auto no-scrollbar">
                  {['Selection', 'Employee Info', 'Final Review'].map((label, i) => (
                    <div key={i} className="flex items-center gap-2 shrink-0">
                       <div className={cn(
                         "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black border transition-all",
                         activeStep >= i 
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                       )}>
                          {i + 1}
                       </div>
                       <span className={cn(
                         "text-[9px] font-black uppercase tracking-widest",
                         activeStep >= i ? "text-blue-600" : "text-slate-400"
                       )}>{label}</span>
                       {i < 2 && <ChevronRight className="h-3 w-3 text-slate-200 dark:text-slate-700 mx-1" />}
                    </div>
                  ))}
               </div>

               <div className="space-y-6 flex-1 min-h-[300px]">
                  {activeStep === 0 && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Search & Select Asset</label>
                          <div className="relative">
                             <Input 
                               value={selectedAssetId}
                               onChange={(e) => setSelectedAssetId(e.target.value)}
                               className="w-full h-12 pl-11 pr-4 rounded-xl text-base font-bold transition-all placeholder:text-slate-300 focus-visible:ring-blue-500 bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-800"
                               placeholder="Type asset name or scan ID..."
                             />
                             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {assets.filter(a => a.type === 'consumable' || a.category === 'ppe').slice(0, 4).map(a => (
                            <button 
                              key={a.id}
                              onClick={() => setSelectedAssetId(a.id)}
                              className={cn(
                                "p-3 rounded-xl border text-left transition-all active:scale-95 group relative overflow-hidden",
                                selectedAssetId === a.id 
                                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none" 
                                  : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-blue-200"
                              )}
                            >
                              <Package className={cn("h-4 w-4 mb-2", selectedAssetId === a.id ? "text-white" : "text-blue-400")} />
                              <p className="text-[8px] font-black uppercase opacity-60 leading-none mb-1">{a.category}</p>
                              <p className="font-bold text-xs truncate leading-tight group-hover:text-current">{a.name}</p>
                              {selectedAssetId === a.id && (
                                <div className="absolute top-1.5 right-1.5">
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                       </div>

                       {selectedAsset && (
                          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in zoom-in-95 duration-300">
                             <div className="flex items-center gap-3">
                                <ShieldCheck className="h-5 w-5 text-blue-500" />
                                <div>
                                   <p className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase letter-spacing-tight leading-none">{selectedAsset.name}</p>
                                   <p className="text-[9px] text-blue-600/70 font-bold uppercase tracking-widest mt-1">{selectedAsset.availableQuantity} in Stock</p>
                                </div>
                             </div>
                             <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm items-center">
                                <button onClick={() => setQuantity(Math.max(1, quantity-1))} className="w-7 h-7 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all">-</button>
                                <span className="w-8 h-7 flex items-center justify-center font-black text-blue-600 text-xs">{quantity}</span>
                                <button onClick={() => setQuantity(quantity+1)} className="w-7 h-7 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-all">+</button>
                             </div>
                          </div>
                       )}
                    </div>
                  )}

                  {activeStep === 1 && (
                     <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Employee Name / ID</label>
                           <div className="relative">
                              <Input 
                                value={employeeName}
                                onChange={(e) => setEmployeeName(e.target.value)}
                                className="w-full h-12 pl-11 pr-4 rounded-xl text-base font-bold transition-all placeholder:text-slate-300 focus-visible:ring-blue-500 bg-slate-50/50 dark:bg-slate-950 border-slate-100 dark:border-slate-800"
                                placeholder="Enter full name or employee ID..."
                              />
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-4">
                  <Button 
                    variant="outline"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(prev => prev - 1)}
                    className="font-black text-[10px] uppercase text-slate-500 h-10 px-6 tracking-widest disabled:opacity-0 transition-opacity"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => {
                       if(activeStep < 2) setActiveStep(prev => prev + 1);
                       else {
                          alert('Checkout Processed Successfully!');
                          setActiveStep(0);
                          setSelectedAssetId('');
                          setEmployeeName('');
                       }
                    }}
                    disabled={!selectedAssetId || (activeStep === 1 && !employeeName)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-md px-10 h-10"
                  >
                    {activeStep < 2 ? 'Next Step' : 'Confirm Issue'}
                  </Button>
               </div>
           </CardContent>
        </Card>

        {/* Recent Analytics Tracking Sidebar */}
        <div className="lg:col-span-2 space-y-6">
           {/* Activity Mini Log */}
           <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="p-6">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-slate-900 dark:text-white">
                       <Clock className="h-4 w-4 text-blue-500" />
                       Recent Issuances
                    </h3>
                    <div className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-200" />
                 </div>

                 <div className="space-y-4">
                    {recentCheckouts.map((log) => (
                       <div key={log.id} className="flex gap-4 group relative items-center p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                          <div className="h-9 w-9 rounded-full bg-slate-50 dark:bg-slate-800 shrink-0 flex items-center justify-center font-black text-[10px] text-slate-500 border border-slate-100 dark:border-slate-700">
                             {log.employee.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-0.5 truncate uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{log.employee}</p>
                             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                               {log.qty}x {log.asset} <span className="h-0.5 w-0.5 rounded-full bg-slate-300" /> {log.time}
                             </p>
                          </div>
                       </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest border-slate-200 dark:border-slate-800 hover:bg-slate-50 h-9 transition-all">
                      View Full Activity
                    </Button>
                 </div>
              </CardContent>
           </Card>

           {/* Quick Stats Card */}
           <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden relative group rounded-2xl">
              <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
              <CardContent className="p-6 relative z-10 space-y-4">
                 <div className="flex items-center justify-between">
                    <TrendingDown className="h-7 w-7 text-blue-200" />
                    <Badge className="bg-white/20 text-white border-0 text-[8px] font-black tracking-widest px-2 py-0">LIVE</Badge>
                 </div>
                 <div>
                    <h4 className="text-4xl font-black tracking-tighter">24</h4>
                    <p className="text-[9px] font-black uppercase text-blue-200 tracking-widest opacity-80 mt-1">Items Issued Today</p>
                 </div>
                 <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Efficiency</span>
                    <span className="text-sm font-black">98.2%</span>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

