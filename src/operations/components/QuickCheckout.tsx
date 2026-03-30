import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { 
  ShoppingCart, 
  RotateCcw, 
  History, 
  Users, 
  FileText, 
  Plus, 
  Search, 
  ArrowLeft,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { Checkout } from '../types';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function QuickCheckout() {
  const { assets, checkouts, addCheckout, updateCheckoutStatus, deleteCheckout } = useOperations();
  const allEmployees = useAppStore(state => state.employees);
  const navigate = useNavigate();
  const { isDark } = useTheme();
  
  const [view, setView] = useState<'checkout' | 'activity'>('checkout');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [returnDays, setReturnDays] = useState<number>(7);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [hoveredCheckout, setHoveredCheckout] = useState<string | null>(null);

  useSetPageTitle(
    view === 'checkout' ? 'Quick Checkout' : 'Checkout Activity',
    view === 'checkout' 
      ? 'Fast checkout for individual employees and short-term loans' 
      : 'Full checkout history and status tracking',
    <div className="flex items-center gap-2">
      {view === 'checkout' ? (
        <>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 h-9 border-slate-200" 
            onClick={() => setView('activity')}
          >
            <History className="h-4 w-4" /> Activity
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 h-9 border-slate-200" 
            onClick={() => navigate('/operations/analytics')}
          >
            <Users className="h-4 w-4" /> Employees
          </Button>
        </>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-9 border-slate-200" 
          onClick={() => setView('checkout')}
        >
          <ArrowLeft className="h-4 w-4" /> New Checkout
        </Button>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        className="gap-2 h-9 border-slate-200"
      >
        <FileText className="h-4 w-4" /> Export
      </Button>
    </div>
  );

  // Filter for operations staff
  const opStaffPositions = [
    'Foreman', 'Engineer', 'Site Supervisor', 'Assistant Supervisor', 
    'Mechanic Technician/Site Worker', 'Site Worker', 'Driver', 'Security'
  ];
  const opsStaff = allEmployees.filter(emp => opStaffPositions.includes(emp.position || ''));

  const handleCheckout = () => {
    if (!selectedAsset || !selectedEmployee) {
      toast.error('Please select both an asset and an employee');
      return;
    }

    const asset = assets.find(a => a.id === selectedAsset);
    const emp = opsStaff.find(e => e.id === selectedEmployee);

    if (!asset || !emp) return;

    addCheckout({
      assetId: asset.id,
      assetName: asset.name,
      quantity,
      employeeId: emp.id,
      employeeName: `${emp.firstname} ${emp.surname}`,
      returnInDays: returnDays
    });

    toast.success(`${asset.name} checked out to ${emp.firstname}`);
    setSelectedAsset('');
    setSelectedEmployee('');
    setQuantity(1);
    setReturnDays(7);
  };

  if (view === 'activity') {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 py-4 px-6 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</CardTitle>
              <CardDescription>Full history of all checkouts</CardDescription>
            </div>
            <select 
              className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold px-3 py-1.5 outline-none shadow-sm"
              defaultValue="all"
            >
              <option value="all">All ({checkouts.length})</option>
              <option value="outstanding">Outstanding</option>
              <option value="returned">Returned</option>
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {checkouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
                  <span className="font-bold">No activity recorded</span>
                </div>
              ) : (
                checkouts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{c.assetName}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-1">
                        <Users className="h-3 w-3" />
                        <span>{c.employeeName}</span>
                        <span>•</span>
                        <span>{c.quantity} units {c.returnedQuantity > 0 && `(Returned: ${c.returnedQuantity})`}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Badge variant="outline" className={cn(
                        "font-bold px-3 py-0.5 rounded-full border text-[10px] uppercase",
                        c.status === 'outstanding' ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200"
                      )}>
                        {c.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1 uppercase tracking-tighter hidden sm:flex">
                          <FileText className="h-3 w-3" />
                          {new Date(c.checkoutDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* New Checkout Form */}
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Direct Checkout
            </CardTitle>
            <CardDescription>Assign assets to employees instantly</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Asset *</label>
                <select 
                  value={selectedAsset} 
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-transparent dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-medium text-slate-600 dark:text-slate-300 px-4 outline-none text-sm"
                >
                  <option value="" disabled>Choose asset to checkout</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.availableQuantity} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quantity *</label>
                  <Input 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:ring-blue-500 font-bold text-center text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Duration (days)</label>
                  <Input 
                    type="number" 
                    value={returnDays} 
                    onChange={(e) => setReturnDays(Number(e.target.value))}
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:ring-blue-500 font-bold text-center text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assign To *</label>
                <select 
                  value={selectedEmployee} 
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-transparent dark:border-slate-800 focus:ring-2 focus:ring-blue-500 font-medium text-slate-600 dark:text-slate-300 px-4 outline-none text-sm"
                >
                  <option value="" disabled>Select site personnel</option>
                  {opsStaff.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstname} {emp.surname} ({emp.position})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button 
              onClick={handleCheckout}
              disabled={!selectedAsset || !selectedEmployee}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-3 shadow-lg shadow-blue-500/10 disabled:opacity-50 mt-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Confirm Checkout
            </Button>
          </CardContent>
        </Card>

        {/* Recent Checkouts List */}
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Outstanding ({checkouts.filter(c => c.status === 'outstanding').length})
            </CardTitle>
            <CardDescription>Recently assigned items awaiting return</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
            {checkouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
                <span className="font-bold">No active checkouts</span>
              </div>
            ) : (
              checkouts.filter(c => c.status === 'outstanding').map((c) => (
                <div 
                  key={c.id} 
                  onMouseEnter={() => setHoveredCheckout(c.id)}
                  onMouseLeave={() => setHoveredCheckout(null)}
                  className="relative p-5 rounded-xl border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{c.assetName}</h4>
                      <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-tight">
                        {c.employeeName} • {new Date(c.checkoutDate).toLocaleDateString()}
                        {c.returnedQuantity > 0 && <span className="text-blue-500 ml-2">Returned: {c.returnedQuantity}</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <span className="font-black text-slate-600 dark:text-slate-400 text-base">×{c.quantity}</span>
                       <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 font-bold text-[9px] uppercase px-2 py-0">
                         Awaiting
                       </Badge>
                    </div>
                  </div>

                  {hoveredCheckout === c.id && (
                    <div className="flex items-center gap-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Button variant="outline" className="flex-1 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 border-transparent font-bold text-slate-600 dark:text-slate-300 text-xs gap-2">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Update Status
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 rounded-lg"
                        onClick={() => deleteCheckout(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Button 
        variant="ghost" 
        className="w-full h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all font-bold text-slate-400 flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
        onClick={() => setView('activity')}
      >
        <FileText className="h-4 w-4" />
        View All Checkout Activity History
      </Button>
    </div>
  );
}

