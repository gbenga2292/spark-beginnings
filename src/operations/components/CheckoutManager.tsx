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

export function CheckoutManager() {
  const { assets } = useOperations();
  const { isDark } = useTheme();
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeStep, setActiveStep] = useState(0);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  // Mock recent activity for checkout
  const recentCheckouts = [
    { id: 'CK-881', employee: 'David Adeleke', asset: 'Reflective Vests', qty: 2, time: '10:15 AM', status: 'completed' },
    { id: 'CK-880', employee: 'Grace Eniola', asset: 'Safety Boots', qty: 1, time: '09:45 AM', status: 'completed' },
    { id: 'CK-879', employee: 'Samuel Okon', asset: 'Raincoat (Medium)', qty: 1, time: '08:30 AM', status: 'completed' },
  ];

  return (
    <div className="flex flex-col gap-6 pb-10 px-6 mt-6 h-full animate-in slide-in-from-left-4 duration-500 overflow-y-auto no-scrollbar">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Quick Checkout System</h1>
          <p className="text-slate-500 mt-1 font-medium">Issue tools, PPE, and consumables directly to field staff.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
           <Button variant="ghost" size="sm" className="bg-slate-100 dark:bg-slate-800 text-blue-600 font-bold px-3">Checkout</Button>
           <Button variant="ghost" size="sm" className="text-slate-500 font-bold px-3">Activity</Button>
           <Button variant="ghost" size="sm" className="text-slate-500 font-bold px-3">Analytics</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Checkout Form Card */}
        <Card className="lg:col-span-3 shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all overflow-hidden border-0">
           <CardContent className="p-8 flex flex-col h-full">
               {/* Progress Indicator */}
               <div className="flex items-center gap-3 mb-10 overflow-x-auto no-scrollbar">
                  {['Selection', 'Employee Info', 'Final Review'].map((label, i) => (
                    <div key={i} className="flex items-center gap-2 shrink-0">
                       <div className={cn(
                         "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black border transition-all",
                         activeStep >= i 
                          ? "bg-indigo-600 border-indigo-600 text-white" 
                          : (isDark ? "bg-slate-800 border-slate-700 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400")
                       )}>
                          {i + 1}
                       </div>
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest",
                         activeStep >= i ? "text-indigo-600" : "text-slate-400"
                       )}>{label}</span>
                       {i < 2 && <ChevronRight className="h-3 w-3 text-slate-200 dark:text-slate-700" />}
                    </div>
                  ))}
               </div>

               <div className="space-y-8 flex-1">
                  {activeStep === 0 && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                       <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">Search & Select Asset</label>
                          <div className="relative">
                             <Input 
                               value={selectedAssetId}
                               onChange={(e) => setSelectedAssetId(e.target.value)}
                               className="w-full h-14 pl-12 pr-4 rounded-xl text-lg font-bold transition-all placeholder:text-slate-300 focus-visible:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                               placeholder="Type asset name or scan ID..."
                             />
                             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                             <Zap className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-200 dark:text-indigo-900" />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {assets.filter(a => a.type === 'consumable' || a.category === 'ppe').slice(0, 4).map(a => (
                            <button 
                              key={a.id}
                              onClick={() => setSelectedAssetId(a.id)}
                              className={cn(
                                "p-4 rounded-xl border text-left transition-all hover:scale-105 active:scale-95 group",
                                selectedAssetId === a.id 
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                                  : (isDark ? "bg-slate-950 border-slate-700 text-slate-400 hover:border-indigo-500" : "bg-white border-slate-200 hover:border-indigo-200")
                              )}
                            >
                              <Package className={cn("h-4 w-4 mb-2 transition-colors", selectedAssetId === a.id ? "text-white" : "text-indigo-400")} />
                              <p className="text-[10px] font-black uppercase opacity-60 m-0 leading-none mb-1">{a.category}</p>
                              <p className="font-bold text-xs truncate leading-tight group-hover:text-current">{a.name}</p>
                            </button>
                          ))}
                       </div>

                       {selectedAsset && (
                          <div className="p-5 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between animate-in zoom-in-95 duration-300">
                             <div className="flex items-center gap-4">
                                <ShieldCheck className="h-6 w-6 text-indigo-500" />
                                <div>
                                   <p className="text-sm font-black text-indigo-900 dark:text-indigo-300">{selectedAsset.name}</p>
                                   <p className="text-xs text-indigo-600/70 font-bold uppercase tracking-widest">{selectedAsset.availableQuantity} Currently in Stock</p>
                                </div>
                             </div>
                             <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <button onClick={() => setQuantity(Math.max(1, quantity-1))} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">-</button>
                                <span className="w-10 h-8 flex items-center justify-center font-black text-indigo-600">{quantity}</span>
                                <button onClick={() => setQuantity(quantity+1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">+</button>
                             </div>
                          </div>
                       )}
                    </div>
                  )}

                  {activeStep === 1 && (
                     <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                           <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">Employee Name / ID</label>
                           <div className="relative">
                              <Input 
                                value={employeeName}
                                onChange={(e) => setEmployeeName(e.target.value)}
                                className="w-full h-14 pl-12 pr-4 rounded-xl text-lg font-bold transition-all placeholder:text-slate-300 focus-visible:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                                placeholder="Enter full name or employee ID..."
                              />
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <Button 
                    variant="outline"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(prev => prev - 1)}
                    className="font-black text-xs uppercase text-slate-500 hover:text-slate-700 disabled:opacity-0"
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition-all shadow-md px-8 h-10 disabled:opacity-50"
                  >
                    {activeStep < 2 ? 'Next Step' : 'Confirm Issue'}
                  </Button>
               </div>
           </CardContent>
        </Card>

        {/* Recent Analytics Tracking Sidebar */}
        <div className="lg:col-span-2 space-y-6">
           {/* Activity Mini Log */}
           <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-0 overflow-hidden">
              <CardContent className="p-6">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                       <Clock className="h-5 w-5 text-indigo-500" />
                       Live Feed
                    </h3>
                    <Activity className="h-4 w-4 text-emerald-500 opacity-60 animate-pulse" />
                 </div>

                 <div className="space-y-6">
                    {recentCheckouts.map((log) => (
                       <div key={log.id} className="flex gap-4 group relative">
                          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center font-bold text-xs text-slate-500">
                             {log.employee.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-black text-slate-700 dark:text-slate-300 mb-0.5 truncate uppercase tracking-tighter decoration-indigo-200 group-hover:underline underline-offset-4">{log.employee}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.qty}x {log.asset} <span className="mx-1">•</span> {log.time}</p>
                          </div>
                          <div className="mt-1">
                             <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                       </div>
                    ))}
                    <Button variant="outline" className="w-full text-xs font-black text-slate-500 uppercase tracking-widest border-2 border-slate-100 dark:border-slate-800 hover:border-slate-300">
                      Full Activity History
                    </Button>
                 </div>
              </CardContent>
           </Card>

           {/* Quick Stats Card */}
           <Card className="shadow-md border-0 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white overflow-hidden relative group">
              <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
              <CardContent className="p-6 relative z-10 space-y-4">
                 <TrendingDown className="h-8 w-8 text-indigo-200" />
                 <div>
                    <h4 className="text-3xl font-black">24</h4>
                    <p className="text-[10px] font-black uppercase text-indigo-200 tracking-widest opacity-80">Items Issued Today</p>
                 </div>
                 <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-white/70">Efficiency Rate</span>
                    <span className="text-sm font-black">98.2%</span>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
