import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { 
  ShoppingCart, RotateCcw, History, Users, FileText, 
  Plus, Search, ArrowLeft, Trash2, Check, ChevronDown, X, AlertCircle, Package
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
  const [assetSearchQuery, setAssetSearchQuery] = useState<string>('');
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false);
  const assetDropdownRef = useRef<HTMLDivElement>(null);

  const [quantity, setQuantity] = useState<number>(1);
  const [returnDays, setReturnDays] = useState<number>(7);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [customEmployeeName, setCustomEmployeeName] = useState<string>('');
  const [hoveredCheckout, setHoveredCheckout] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState('all');

  // Return Items Dialog State
  const [checkoutToUpdate, setCheckoutToUpdate] = useState<Checkout | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnCondition, setReturnCondition] = useState<string>('Returned (Good)');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Close asset dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(event.target as Node)) {
        setIsAssetMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectedAssetObj = useMemo(() => {
    return assets.find(a => a.id === selectedAsset);
  }, [assets, selectedAsset]);

  const filteredAssets = useMemo(() => {
    if (!assetSearchQuery.trim()) return assets;
    const q = assetSearchQuery.toLowerCase();
    return assets.filter(a => 
      a.name.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q) ||
      a.serialNumber?.toLowerCase().includes(q)
    );
  }, [assets, assetSearchQuery]);

  const handleCheckout = () => {
    if (!selectedAsset || !selectedEmployee) {
      toast.error('Please select both an asset and an employee');
      return;
    }
    if (selectedEmployee === 'other' && !customEmployeeName.trim()) {
      toast.error('Please enter a custom employee name');
      return;
    }
    const asset = assets.find(a => a.id === selectedAsset);
    if (!asset) return;

    if (quantity > asset.availableQuantity) {
      toast.error(`Only ${asset.availableQuantity} units available in stock`);
      return;
    }

    if (selectedEmployee === 'other') {
      addCheckout({
        assetId: asset.id,
        assetName: asset.name,
        quantity,
        employeeId: null,
        employeeName: customEmployeeName.trim(),
        returnInDays: returnDays
      });

      toast.success(`${asset.name} checked out to ${customEmployeeName.trim()}`);
    } else {
      const emp = opsStaff.find(e => e.id === selectedEmployee);
      if (!emp) return;

      addCheckout({
        assetId: asset.id,
        assetName: asset.name,
        quantity,
        employeeId: emp.id,
        employeeName: `${emp.firstname} ${emp.surname}`,
        returnInDays: returnDays
      });

      toast.success(`${asset.name} checked out to ${emp.firstname}`);
    }

    setSelectedAsset('');
    setAssetSearchQuery('');
    setSelectedEmployee('');
    setCustomEmployeeName('');
    setQuantity(1);
    setReturnDays(7);
  };

  const openReturnDialog = (c: Checkout) => {
    setCheckoutToUpdate(c);
    setReturnQty(1);
    setReturnCondition('Returned (Good)');
    setReturnNotes('');
  };

  const handleConfirmReturn = () => {
    if (!checkoutToUpdate) return;
    
    const returned = returnQty;
    const remainingToReturn = checkoutToUpdate.quantity - checkoutToUpdate.returnedQuantity;
    if (isNaN(returned) || returned <= 0 || returned > remainingToReturn) {
      toast.error('Invalid quantity entered');
      return;
    }

    const totalReturned = checkoutToUpdate.returnedQuantity + returned;
    const isConsumed = returnCondition === 'Consumed completely';
    const newStatus = isConsumed ? 'consumed' : (totalReturned >= checkoutToUpdate.quantity ? 'returned' : 'outstanding');
    
    updateCheckoutStatus(checkoutToUpdate.id, { 
      returnedQuantity: totalReturned, 
      status: newStatus as any,
      condition: returnCondition,
      notes: returnNotes
    });
    
    toast.success(isConsumed 
      ? `Marked ${returned} units of ${checkoutToUpdate.assetName} as consumed/used.`
      : `Updated return status for ${checkoutToUpdate.assetName}`
    );
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
              <option value="consumed">Consumed</option>
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
                checkouts.filter(c => {
                  if (activityFilter === 'all') return true;
                  if (activityFilter === 'consumed') return c.status === 'consumed' || c.condition?.toLowerCase().includes('consumed');
                  if (activityFilter === 'returned') return c.status === 'returned' && !c.condition?.toLowerCase().includes('consumed');
                  return c.status === activityFilter;
                }).map((c) => {
                  const isConsumed = c.status === 'consumed' || c.condition?.toLowerCase().includes('consumed');
                  return (
                    <div key={c.id} className="flex items-center justify-between p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-white text-sm">{c.assetName}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                          <Users className="h-3 w-3" />
                          <span>{c.employeeName}</span>
                          {!c.employeeId && (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-bold text-[9px] px-1 py-0 rounded">
                              External
                            </Badge>
                          )}
                          <span>•</span>
                          <span>{c.quantity} units {c.returnedQuantity > 0 && `(Returned: ${c.returnedQuantity})`}</span>
                          {c.notes && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-400">"{c.notes}"</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={cn(
                          "font-semibold px-2 py-0.5 rounded-full text-[11px]",
                          c.status === 'outstanding' 
                            ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" :
                          isConsumed 
                            ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300" :
                          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}>
                          {isConsumed ? 'consumed' : c.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {formatDisplayDate(c.checkoutDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
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
              
              {/* Searchable Asset Combobox */}
              <div className="space-y-2 relative" ref={assetDropdownRef}>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Select Asset *</label>
                
                <div 
                  onClick={() => setIsAssetMenuOpen(true)}
                  className={cn(
                    "w-full min-h-[44px] rounded-lg border px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition-all",
                    isDark ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300",
                    isAssetMenuOpen && "ring-2 ring-blue-500/20 border-blue-500"
                  )}
                >
                  {selectedAssetObj ? (
                    <div className="flex items-center justify-between w-full pr-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className={cn("font-semibold truncate", isDark ? "text-white" : "text-slate-900")}>
                          {selectedAssetObj.name}
                        </span>
                        {selectedAssetObj.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            {selectedAssetObj.category}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs font-bold shrink-0 ml-2",
                        selectedAssetObj.availableQuantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                      )}>
                        {selectedAssetObj.availableQuantity} in stock
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">Search or select asset to checkout...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </div>

                {/* Dropdown Menu */}
                {isAssetMenuOpen && (
                  <div className={cn(
                    "absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150",
                    isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}>
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4.5" />
                      <input
                        type="text"
                        autoFocus
                        value={assetSearchQuery}
                        onChange={(e) => setAssetSearchQuery(e.target.value)}
                        placeholder="Type to search asset name, category, serial..."
                        className={cn(
                          "w-full h-9 pl-9 pr-8 rounded-lg text-xs outline-none border transition-colors",
                          isDark 
                            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500" 
                            : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                        )}
                      />
                      {assetSearchQuery && (
                        <button 
                          onClick={() => setAssetSearchQuery('')}
                          className="absolute right-4 top-4.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Asset Items List */}
                    <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-1 style-scroll">
                      {filteredAssets.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 italic">
                          No matching assets found
                        </div>
                      ) : (
                        filteredAssets.map(a => {
                          const isSelected = a.id === selectedAsset;
                          const isOutOfStock = a.availableQuantity <= 0;
                          return (
                            <div
                              key={a.id}
                              onClick={() => {
                                setSelectedAsset(a.id);
                                setIsAssetMenuOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs",
                                isSelected 
                                  ? (isDark ? "bg-blue-950/40 text-blue-300 border border-blue-800/40" : "bg-blue-50 text-blue-700 border border-blue-200")
                                  : (isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700")
                              )}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold truncate text-sm">{a.name}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                  <span>{a.category || 'General'}</span>
                                  {a.serialNumber && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono">SN: {a.serialNumber}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className={cn(
                                  "font-bold text-xs px-2 py-0.5 rounded-full",
                                  isOutOfStock 
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" 
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                )}>
                                  {a.availableQuantity} in stock
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Quantity *</label>
                  <Input 
                    type="number" 
                    value={quantity} 
                    min={1}
                    max={selectedAssetObj ? selectedAssetObj.availableQuantity : undefined}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="h-11 rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 font-semibold text-center text-sm" 
                  />
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
                  value={selectedEmployee} 
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    if (e.target.value !== 'other') {
                      setCustomEmployeeName('');
                    }
                  }}
                  className="w-full h-11 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-600 dark:text-slate-300 px-3 outline-none text-sm"
                >
                  <option value="" disabled>Select site personnel</option>
                  {opsStaff.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstname} {emp.surname} ({emp.position})</option>
                  ))}
                  <option value="other">Other (Type name...)</option>
                </select>
              </div>

              {selectedEmployee === 'other' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Name *</label>
                  <Input 
                    type="text" 
                    placeholder="Enter full name of non-employee" 
                    value={customEmployeeName} 
                    onChange={(e) => setCustomEmployeeName(e.target.value)}
                    className="h-11 rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 font-semibold text-sm"
                  />
                </div>
              )}
            </div>

            <Button 
              onClick={handleCheckout}
              disabled={!selectedAsset || !selectedEmployee || (selectedEmployee === 'other' && !customEmployeeName.trim())}
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
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{c.employeeName}</span>
                        {!c.employeeId && (
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-bold text-[9px] px-1 py-0 rounded">
                            External
                          </Badge>
                        )}
                        <span>•</span>
                        <span>{formatDisplayDate(c.checkoutDate)}</span>
                        {c.returnedQuantity > 0 && <span className="text-blue-500 ml-2">Returned: {c.returnedQuantity}</span>}
                      </div>
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
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-[420px] relative z-10 animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Update Item Status</h2>
                <p className="text-xs text-slate-400">{checkoutToUpdate.assetName} (Total: {checkoutToUpdate.quantity})</p>
              </div>
              <button 
                onClick={() => setCheckoutToUpdate(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <div className="h-4 w-4 flex items-center justify-center">✕</div>
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Quantity to Update</label>
                  <Input 
                    type="number" 
                    value={returnQty} 
                    onChange={(e) => setReturnQty(Number(e.target.value))}
                    min={1}
                    max={checkoutToUpdate.quantity - checkoutToUpdate.returnedQuantity}
                    className="h-11 rounded-lg border-blue-500 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500 shadow-sm" 
                  />
                  <p className="text-[11px] text-slate-400">
                    Max: {checkoutToUpdate.quantity - checkoutToUpdate.returnedQuantity} units awaiting status update
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Condition / Action</label>
                  <select 
                    value={returnCondition} 
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full h-11 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-sm px-3 appearance-none font-medium text-slate-700 dark:text-slate-200"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="Returned (Good)">Returned (Good) - Restore to Available Stock</option>
                    <option value="Consumed completely">Consumed completely - Used up on Job</option>
                    <option value="Returned (Damaged)">Returned (Damaged) - Move to Damaged</option>
                    <option value="Returned (Lost / Missing)">Returned (Lost / Missing) - Mark Lost</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Notes (Optional)</label>
                  <textarea 
                    placeholder="Add any notes about this usage, return condition, or job reference..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full min-h-[70px] rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 text-xs text-slate-600 dark:text-slate-300 outline-none resize-none font-medium"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-10 rounded-lg border-slate-200 dark:border-slate-800 font-semibold text-xs"
                  onClick={() => setCheckoutToUpdate(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className={cn(
                    "flex-1 h-10 rounded-lg text-white font-semibold text-xs gap-1.5 shadow-sm",
                    returnCondition === 'Consumed completely' ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"
                  )}
                  onClick={handleConfirmReturn}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {returnCondition === 'Consumed completely' ? 'Confirm Consumed' : 'Update Status'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
