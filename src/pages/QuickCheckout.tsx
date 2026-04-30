import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { 
  ShoppingCart, RotateCcw, History, Users, FileText, 
  Plus, Search, ArrowLeft, Trash2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { Checkout } from '../types/operations';
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
  const [activityFilter, setActivityFilter] = useState('all');

  // Return Items Dialog State
  const [checkoutToUpdate, setCheckoutToUpdate] = useState<Checkout | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnCondition, setReturnCondition] = useState<string>('Returned (Good)');
  const [returnNotes, setReturnNotes] = useState<string>('');

  useSetPageTitle(
    view === 'checkout' ? 'Quick Checkout' : 'Checkout Activity',
    view === 'checkout' 
      ? 'Fast checkout for individual employees and short-term loans' 
      : 'Full checkout history and status tracking',
    <div className="flex items-center gap-2">
      {view === 'checkout' ? (
        <>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setView('activity')}>
            <History className="h-4 w-4" /> <span className="hidden sm:inline">Activity</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 hidden sm:flex" onClick={() => navigate('/operations/analytics')}>
            <Users className="h-4 w-4" /> Employees
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setView('checkout')}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">New Checkout</span>
        </Button>
      )}
      <Button variant="outline" size="sm" className="gap-2 h-9 hidden sm:flex">
        <FileText className="h-4 w-4" /> Export
      </Button>
    </div>
  );

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

  const openReturnDialog = (c: Checkout) => {
    setCheckoutToUpdate(c);
    setReturnQty(1); // Default to 1 instead of max to be safe
    setReturnCondition('Returned (Good)');
    setReturnNotes('');
  };

  const handleConfirmReturn = () => {
    if (!checkoutToUpdate) return;
    
    const returned = returnQty;
    if (isNaN(returned) || returned <= 0 || returned > (checkoutToUpdate.quantity - checkoutToUpdate.returnedQuantity)) {
      toast.error('Invalid quantity entered');
      return;
    }

    const totalReturned = checkoutToUpdate.returnedQuantity + returned;
    const newStatus = totalReturned >= checkoutToUpdate.quantity ? 'returned' : 'outstanding';
    
    // In a real app we'd save condition and notes to the db payload here as well
    updateCheckoutStatus(checkoutToUpdate.id, { 
      returnedQuantity: totalReturned, 
      status: newStatus as any 
    });
    
    toast.success(`Updated checkout status for ${checkoutToUpdate.assetName}`);
    setCheckoutToUpdate(null);
  };

  if (view === 'activity') {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 py-4 px-5 sm:px-6 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">Recent Activity</CardTitle>
              <CardDescription className="text-xs">Full history of all checkouts</CardDescription>
            </div>
            <select 
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold px-3 py-1.5 outline-none shadow-sm"
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
            >
              <option value="all">All ({checkouts.length})</option>
              <option value="outstanding">Outstanding</option>
              <option value="returned">Returned</option>
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {checkouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                  <span className="font-medium text-sm">No activity recorded</span>
                </div>
              ) : (
                checkouts.filter(c => activityFilter === 'all' || c.status === activityFilter).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-white text-sm">{c.assetName}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <Users className="h-3 w-3" />
                        <span>{c.employeeName}</span>
                        <span>•</span>
                        <span>{c.quantity} units {c.returnedQuantity > 0 && `(Returned: ${c.returnedQuantity})`}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={cn(
                        "font-semibold px-2 py-0.5 rounded-full text-[11px]",
                        c.status === 'outstanding' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      )}>
                        {c.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {formatDisplayDate(c.checkoutDate)}
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Checkout Form */}
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Direct Checkout
            </CardTitle>
            <CardDescription className="text-xs">Assign assets to employees instantly</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Select Asset *</label>
                <select 
                  value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full h-11 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-600 dark:text-slate-300 px-3 outline-none text-sm"
                >
                  <option value="" disabled>Choose asset to checkout</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.availableQuantity} in stock)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Quantity *</label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                    className="h-11 rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 font-semibold text-center text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Duration (days)</label>
                  <Input type="number" value={returnDays} onChange={(e) => setReturnDays(Number(e.target.value))}
                    className="h-11 rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 font-semibold text-center text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Assign To *</label>
                <select 
                  value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full h-11 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-600 dark:text-slate-300 px-3 outline-none text-sm"
                >
                  <option value="" disabled>Select site personnel</option>
                  {opsStaff.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstname} {emp.surname} ({emp.position})</option>
                  ))}
                </select>
              </div>
            </div>

            <Button 
              onClick={handleCheckout}
              disabled={!selectedAsset || !selectedEmployee}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm gap-2 shadow-sm disabled:opacity-50 mt-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Confirm Checkout
            </Button>
          </CardContent>
        </Card>

        {/* Outstanding Checkouts */}
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="p-5 sm:p-6 pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Outstanding ({checkouts.filter(c => c.status === 'outstanding').length})
            </CardTitle>
            <CardDescription className="text-xs">Recently assigned items awaiting return</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-2 space-y-3 max-h-[500px] overflow-y-auto">
            {checkouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                <span className="font-medium text-sm">No active checkouts</span>
              </div>
            ) : (
              checkouts.filter(c => c.status === 'outstanding').map((c) => (
                <div 
                  key={c.id} 
                  onMouseEnter={() => setHoveredCheckout(c.id)}
                  onMouseLeave={() => setHoveredCheckout(null)}
                  className="relative p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white text-sm">{c.assetName}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {c.employeeName} • {formatDisplayDate(c.checkoutDate)}
                        {c.returnedQuantity > 0 && <span className="text-blue-500 ml-2">Returned: {c.returnedQuantity}</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-slate-600 dark:text-slate-400">×{c.quantity}</span>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 font-semibold text-[11px] px-2 py-0">
                        Awaiting
                      </Badge>
                    </div>
                  </div>

                  {hoveredCheckout === c.id && (
                    <div className="flex items-center gap-2 mt-3 animate-in fade-in duration-200">
                      <Button variant="outline" className="flex-1 h-9 rounded-lg font-semibold text-slate-600 dark:text-slate-300 text-xs gap-2"
                        onClick={() => openReturnDialog(c)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Update Status
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                        onClick={() => deleteCheckout(c.id)}>
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
        variant="outline"
        className="w-full h-11 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all font-semibold text-slate-500 text-sm gap-2"
        onClick={() => setView('activity')}
      >
        <FileText className="h-4 w-4" />
        View All Checkout Activity History
      </Button>

      {/* Return Items Dialog Overlay */}
      {checkoutToUpdate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCheckoutToUpdate(null)} />
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-[400px] relative z-10 animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Return Items</h2>
              <button 
                onClick={() => setCheckoutToUpdate(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <div className="h-4 w-4 flex items-center justify-center">✕</div>
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Return Quantity</label>
                  <Input 
                    type="number" 
                    value={returnQty} 
                    onChange={(e) => setReturnQty(Number(e.target.value))}
                    min={1}
                    max={checkoutToUpdate.quantity - checkoutToUpdate.returnedQuantity}
                    className="h-11 rounded-lg border-blue-500 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500 shadow-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Condition / Status</label>
                  <select 
                    value={returnCondition} 
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full h-11 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 outline-none text-sm px-3 appearance-none font-medium text-slate-700"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="Returned (Good)">Returned (Good)</option>
                    <option value="Returned (Damaged)">Returned (Damaged)</option>
                    <option value="Returned (Lost / Missing)">Returned (Lost / Missing)</option>
                    <option value="Consumed completely">Consumed completely</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notes (Optional)</label>
                  <textarea 
                    placeholder="Add any notes or clarification about this return/update..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full min-h-[80px] rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 text-sm text-slate-600 outline-none resize-none font-medium"
                  />
                </div>
              </div>
              
              <p className="text-[11px] text-slate-400">
                These notes will appear in checkout reports for additional context
              </p>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 rounded-lg border-slate-200 dark:border-slate-800 font-semibold"
                  onClick={() => setCheckoutToUpdate(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 h-11 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold gap-2 shadow-sm"
                  onClick={handleConfirmReturn}
                >
                  <RotateCcw className="h-4 w-4" />
                  Update Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
