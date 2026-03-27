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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { Checkout } from '../types';

export function QuickCheckout() {
  const { assets, checkouts, addCheckout, updateCheckoutStatus, deleteCheckout } = useOperations();
  const allEmployees = useAppStore(state => state.employees);
  const navigate = useNavigate();
  
  const [view, setView] = useState<'checkout' | 'activity'>('checkout');
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [returnDays, setReturnDays] = useState<number>(7);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [hoveredCheckout, setHoveredCheckout] = useState<string | null>(null);

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
      <div className="flex flex-col gap-8 pb-20 px-8 mt-4 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button 
               variant="ghost" 
               className="hover:bg-slate-100 rounded-xl"
               onClick={() => setView('checkout')}
             >
               <ArrowLeft className="h-5 w-5 mr-2" />
               Quick Checkout
             </Button>
             <div>
               <h1 className="text-4xl font-black tracking-tight text-blue-600">Checkout Activity</h1>
               <p className="text-slate-400 font-medium mt-1">Full checkout history and status tracking</p>
             </div>
          </div>
          <select 
            className="w-40 bg-white rounded-xl border-slate-100 font-bold px-4 h-12 outline-none shadow-sm text-sm"
            defaultValue="all"
          >
            <option value="all">All ({checkouts.length})</option>
            <option value="outstanding">Outstanding</option>
            <option value="returned">Returned</option>
          </select>
        </div>

        <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-lg font-bold">All Activity ({checkouts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {checkouts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-50 bg-white hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{c.assetName}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-1">
                      <Users className="h-3 w-3" />
                      <span>{c.employeeName}</span>
                      <span>•</span>
                      <span>{c.quantity} units {c.returnedQuantity > 0 && `(Returned: ${c.returnedQuantity})`}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge className={cn(
                      "font-bold px-3 py-1 rounded-full border-0",
                      c.status === 'outstanding' ? "bg-amber-400 text-white" : "bg-green-500 text-white"
                    )}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1).replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-300 font-bold flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {new Date(c.checkoutDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-20 px-8 mt-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-blue-600">Quick Checkout</h1>
          <p className="text-slate-400 font-medium mt-1">Fast checkout for individual employees and short-term loans</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 font-bold text-slate-600 gap-2 px-6"
            onClick={() => navigate('/operations/analytics')}
          >
            <Users className="h-4 w-4" />
            Employees
          </Button>
          <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-slate-600 gap-2 px-6">
            <FileText className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* New Checkout Form */}
        <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <ShoppingCart className="h-6 w-6 text-slate-900" />
              New Checkout
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Asset *</label>
                <select 
                  value={selectedAsset} 
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border-transparent focus:ring-2 focus:ring-blue-500 font-medium text-slate-600 px-4 outline-none"
                >
                  <option value="" disabled>Select asset to checkout</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.availableQuantity} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Quantity *</label>
                  <Input 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:ring-blue-500 font-bold text-center"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Return in (days)</label>
                  <Input 
                    type="number" 
                    value={returnDays} 
                    onChange={(e) => setReturnDays(Number(e.target.value))}
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:ring-blue-500 font-bold text-center"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Employee Name *</label>
                <select 
                  value={selectedEmployee} 
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full h-14 rounded-2xl bg-slate-50 border-transparent focus:ring-2 focus:ring-blue-500 font-medium text-slate-600 px-4 outline-none"
                >
                  <option value="" disabled>Select employee</option>
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
              className="w-full h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black text-lg gap-3 shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              <ShoppingCart className="h-6 w-6" />
              Checkout Item
            </Button>
          </CardContent>
        </Card>

        {/* Recent Checkouts List */}
        <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <RotateCcw className="h-6 w-6 text-slate-900" />
              Checkouts ({checkouts.filter(c => c.status === 'outstanding').length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-4">
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
                  className="relative p-6 rounded-2xl border border-slate-50 bg-white hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight">{c.assetName}</h4>
                      <p className="text-sm font-bold text-slate-400 mt-1">
                        {c.employeeName} • {new Date(c.checkoutDate).toLocaleDateString()}
                        {c.returnedQuantity > 0 && <span className="text-blue-500 ml-2">Returned: {c.returnedQuantity}</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <span className="font-black text-slate-400 text-lg">×{c.quantity}</span>
                       <Badge className="bg-amber-400 text-white font-black border-0 rounded-full px-4">
                         Outstanding
                       </Badge>
                    </div>
                  </div>

                  {hoveredCheckout === c.id && (
                    <div className="flex items-center gap-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl bg-slate-50 border-transparent font-bold text-slate-600 gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Return / Update
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl"
                        onClick={() => deleteCheckout(c.id)}
                      >
                        <Trash2 className="h-5 w-5" />
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
        className="w-full h-16 rounded-3xl bg-white border border-slate-50 shadow-sm hover:shadow-md transition-all font-black text-slate-400 flex items-center justify-center gap-3 uppercase tracking-widest text-[11px]"
        onClick={() => setView('activity')}
      >
        <FileText className="h-5 w-5" />
        View Recent Checkout Activity
      </Button>
    </div>
  );
}
