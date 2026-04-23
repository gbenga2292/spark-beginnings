import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Users, 
  ArrowLeft,
  ChevronRight,
  User,
  Shield,
  Truck,
  HardHat,
  Hammer,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast } from '@/src/components/ui/toast';
import { Asset, Checkout } from '../types/operations';
import { getPositionIndex } from '@/src/lib/hierarchy';

export function EmployeeAnalytics() {
  const navigate = useNavigate();
  const allEmployees = useAppStore(state => state.employees);
  const { checkouts, assets, updateCheckoutStatus } = useOperations();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingCheckout, setUpdatingCheckout] = useState<Checkout | null>(null);
  const [returnQty, setReturnQty] = useState<number>(0);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSetPageTitle(
    'Employee Checkout Analytics',
    'Comprehensive record of assigned items, PPE, and consumables per employee',
    <div className="flex items-center gap-2">
       <Button 
         size="sm" 
         variant="ghost"
         onClick={() => navigate(-1)}
         className="gap-2 h-9 text-slate-500 hover:text-slate-700"
       >
         <ArrowLeft className="h-4 w-4" /> Back
       </Button>
       <Button 
         size="sm" 
         variant="outline"
         className="gap-2 h-9 border-slate-200"
       >
         <Hammer className="h-4 w-4" /> Export Report
       </Button>
    </div>
  );

  // Show all employees (Office and Field)
  const staffList = allEmployees
    .filter(emp => emp.status === 'Active' || emp.status === 'On Leave')
    .filter(emp => {
      const matchesSearch = `${emp.firstname} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && emp.staffType !== 'NON-EMPLOYEE';
    })
    .sort((a, b) => {
      const rankA = getPositionIndex(a.position);
      const rankB = getPositionIndex(b.position);
      if (rankA !== rankB) return rankA - rankB;
      return `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`);
    });

  const selectedEmployee = staffList.find(emp => emp.id === selectedEmployeeId);
  const employeeCheckouts = checkouts.filter(c => c.employeeId === selectedEmployeeId);

  const getPositionIcon = (position: string) => {
    switch (position) {
      case 'Driver': return <Truck className="h-4 w-4" />;
      case 'Security': return <Shield className="h-4 w-4" />;
      case 'Foreman': 
      case 'Engineer':
      case 'Site Supervisor':
      case 'Assistant Supervisor': return <HardHat className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const handleUpdateStatus = (c: Checkout, assetContext?: Asset) => {
    setUpdatingCheckout(c);
    setReturnQty(c.quantity - c.returnedQuantity);
    setIsReturnModalOpen(true);
  };

  const submitReturnUpdate = async () => {
    if (!updatingCheckout) return;

    setIsSubmitting(true);
    try {
      const linkedAsset = assets.find(a => a.id === updatingCheckout.assetId);
      const isConsumable = linkedAsset?.type === 'consumable' || linkedAsset?.category === 'ppe';
      
      const totalReturned = updatingCheckout.returnedQuantity + returnQty;
      const isFullyReturned = totalReturned >= updatingCheckout.quantity;
      const newStatus = isFullyReturned ? 'returned' : 'partial_returned';

      await updateCheckoutStatus(updatingCheckout.id, { 
        returnedQuantity: totalReturned, 
        status: newStatus as any 
      });

      toast.success(isConsumable ? 'Marked as consumed/used.' : `Updated return status for ${updatingCheckout.assetName}`);
      setIsReturnModalOpen(false);
      setUpdatingCheckout(null);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLoans = employeeCheckouts.filter(c => c.status === 'outstanding');
  const pastLoans = employeeCheckouts.filter(c => c.status === 'returned');

  return (
    <>
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Employee Sidebar */}
        <Card className="lg:col-span-4 rounded-xl border-border shadow-sm overflow-hidden bg-card flex flex-col">
          <CardHeader className="p-4 border-b border-border bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <Users className="h-4 w-4 text-teal-600" />
                Staff Directory
              </CardTitle>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                 placeholder="Search staff..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 h-9 bg-background"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
             {staffList.map(emp => (
               <button 
                 key={emp.id}
                 onClick={() => setSelectedEmployeeId(emp.id)}
                 className={cn(
                   "w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors border-b border-border text-left",
                   selectedEmployeeId === emp.id ? "bg-teal-50/50 hover:bg-teal-50" : "bg-transparent"
                 )}
               >
                 <Avatar className="h-10 w-10 border border-slate-200 shadow-sm shrink-0">
                    <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-xs">
                      {emp.firstname[0]}{emp.surname[0]}
                    </AvatarFallback>
                    {emp.avatar && <AvatarImage src={emp.avatar} className="object-cover" />}
                 </Avatar>
                 <div className="flex flex-col flex-1 min-w-0">
                   <span className={cn(
                     "font-medium text-sm truncate w-full",
                     selectedEmployeeId === emp.id ? "text-teal-700 font-semibold" : "text-foreground"
                   )}>
                     {emp.firstname} {emp.surname}
                   </span>
                   <span className="text-xs text-muted-foreground truncate w-full">
                     {emp.position || emp.department}
                   </span>
                 </div>
                 <ChevronRight className={cn(
                   "h-4 w-4 text-slate-300",
                   selectedEmployeeId === emp.id && "text-teal-500"
                 )} />
               </button>
             ))}
             {staffList.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">No employees found.</div>
             )}
          </CardContent>
        </Card>

        {/* Analytics Detail Area */}
        <Card className="lg:col-span-8 rounded-xl border-border shadow-sm bg-card flex flex-col">
          <CardContent className="p-0 h-full flex flex-col min-h-[400px]">
             {!selectedEmployee ? (
               <div className="flex flex-col items-center justify-center text-center p-12 sm:p-20 m-auto">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Select an Employee</h3>
                  <p className="text-slate-500 text-sm max-w-sm">
                    Choose an employee from the directory to view or manage their assigned tools, consumables, and PPE checkouts.
                  </p>
               </div>
             ) : (
               <div className="flex flex-col h-full bg-slate-50/30">
                 {/* Header Section */}
                  <div className="p-6 border-b border-border bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                       <Avatar className="h-16 w-16 border border-slate-200 shadow-sm shrink-0">
                          <AvatarFallback className="text-xl font-semibold bg-teal-50 text-teal-700">
                             {selectedEmployee.firstname[0]}{selectedEmployee.surname[0]}
                          </AvatarFallback>
                          {selectedEmployee.avatar && <AvatarImage src={selectedEmployee.avatar} className="object-cover" />}
                       </Avatar>
                       <div className="space-y-1">
                          <h2 className="text-xl font-bold text-slate-900">
                            {selectedEmployee.firstname} {selectedEmployee.surname}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2">
                             <Badge variant="secondary" className="font-medium text-xs rounded-md">
                                {selectedEmployee.position || selectedEmployee.department}
                             </Badge>
                             <Badge variant="outline" className="font-medium text-xs text-slate-500 rounded-md">
                                {selectedEmployee.staffType}
                             </Badge>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 shrink-0">
                       <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                          <span className="text-xs font-semibold text-slate-500 mb-1">Total Items Logged</span>
                          <span className="text-3xl font-bold text-slate-800">{employeeCheckouts.length}</span>
                       </div>
                       <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                          <span className="text-xs font-semibold text-amber-600 mb-1">Items Unreturned</span>
                          <span className="text-3xl font-bold text-amber-600">{activeLoans.length}</span>
                       </div>
                       <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
                          <span className="text-xs font-semibold text-teal-600 mb-1">Items Returned / Consumed</span>
                          <span className="text-3xl font-bold text-teal-600">{pastLoans.length}</span>
                       </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-border bg-slate-50 flex items-center gap-2">
                         <Package className="h-4 w-4 text-slate-500" />
                         <h4 className="text-sm font-semibold text-slate-800">Checkout & PPE History</h4>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-2">
                        {employeeCheckouts.length === 0 ? (
                          <div className="text-center p-10 mt-4">
                            <Package className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">No items found for this employee.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            {activeLoans.concat(pastLoans).map((checkout, idx) => {
                              const linkedAsset = assets.find(a => a.id === checkout.assetId);
                              const isConsumable = linkedAsset?.type === 'consumable' || linkedAsset?.category === 'ppe';
                              const isOutstanding = checkout.status === 'outstanding';

                              return (
                                <div key={checkout.id} className={cn(
                                  "flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4",
                                  idx !== 0 && "border-t border-slate-100"
                                )}>
                                    <div className="flex items-center gap-4">
                                      <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border",
                                        isOutstanding ? "bg-amber-50 border-amber-100" : "bg-teal-50 border-teal-100"
                                      )}>
                                          {isOutstanding ? (
                                            <AlertCircle className={cn("h-4 w-4", "text-amber-500")} />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4 text-teal-600" />
                                          )}
                                      </div>
                                      <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-slate-900 leading-none">
                                              {checkout.assetName}
                                            </span>
                                            {isConsumable && (
                                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-5">
                                                {linkedAsset?.category === 'ppe' ? 'PPE' : 'Consumable'}
                                              </Badge>
                                            )}
                                          </div>
                                          <span className="text-xs text-slate-500 mt-1.5">
                                            Qty: <span className="font-medium text-slate-700">{checkout.quantity}</span> • Checked out: {formatDisplayDate(checkout.checkoutDate)}
                                          </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {isOutstanding && (
                                        <Button 
                                          variant="outline"
                                          size="sm" 
                                          onClick={() => handleUpdateStatus(checkout, linkedAsset)}
                                          className="gap-2 border-teal-600 text-teal-700 hover:bg-teal-50 hover:text-teal-800 text-xs h-8"
                                        >
                                          {isConsumable ? 'Mark Used' : 'Update Return'}
                                        </Button>
                                      )}
                                      <Badge variant="secondary" className={cn(
                                        "text-[10px] px-2 py-1 uppercase rounded-sm border whitespace-nowrap",
                                        isOutstanding 
                                          ? "bg-amber-50 text-amber-700 border-amber-200" 
                                          : "bg-slate-50 text-slate-600 border-slate-200"
                                      )}>
                                        {isOutstanding 
                                          ? (isConsumable ? 'In Use' : 'Unreturned') 
                                          : (isConsumable ? 'Consumed' : `Returned (${checkout.returnedQuantity})`)}
                                      </Badge>
                                    </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>

    <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="h-12 w-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 mb-4">
            <RotateCcw className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Update Return Status</DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {updatingCheckout && (
              <>Recording return for <span className="font-semibold text-slate-700 dark:text-slate-200">{updatingCheckout.assetName}</span></>
            )}
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {updatingCheckout && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Checked Out</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{updatingCheckout.quantity} Units</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Already Returned</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{updatingCheckout.returnedQuantity} Units</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Quantity being returned now</Label>
                <div className="relative">
                  <Input 
                    type="number"
                    min="1"
                    max={updatingCheckout.quantity - updatingCheckout.returnedQuantity}
                    value={returnQty}
                    onChange={(e) => setReturnQty(Math.min(updatingCheckout.quantity - updatingCheckout.returnedQuantity, parseInt(e.target.value) || 0))}
                    className="h-12 text-lg font-bold pl-12 rounded-xl focus-visible:ring-teal-500/50 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                    Units
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 ml-1">
                  Maximum possible return: {updatingCheckout.quantity - updatingCheckout.returnedQuantity} units
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-0 bg-white dark:bg-transparent">
          <Button 
            variant="ghost" 
            onClick={() => setIsReturnModalOpen(false)}
            className="rounded-xl font-semibold text-slate-500"
          >
            Cancel
          </Button>
          <Button 
            onClick={submitReturnUpdate}
            disabled={isSubmitting || returnQty <= 0}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold px-8 shadow-lg shadow-teal-600/20"
          >
            {isSubmitting ? 'Updating...' : 'Confirm Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

