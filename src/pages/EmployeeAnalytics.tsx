import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { 
  Users, 
  ArrowLeft,
  ChevronRight,
  User,
  Shield,
  Truck,
  HardHat,
  Hammer,
  Search
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function EmployeeAnalytics() {
  const allEmployees = useAppStore(state => state.employees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useSetPageTitle(
    'Staff Equipment Analytics',
    'Detailed breakdown of employee equipment usage and status',
    <div className="flex items-center gap-2">
       <Button 
         size="sm" 
         variant="outline"
         className="gap-2 h-9 border-slate-200"
       >
         <Hammer className="h-4 w-4" /> Usage Report
       </Button>
    </div>
  );

  // Filter for operations staff
  const opStaffPositions = [
    'Foreman', 'Engineer', 'Site Supervisor', 'Assistant Supervisor', 
    'Mechanic Technician/Site Worker', 'Site Worker', 'Driver', 'Security'
  ];
  const opsStaff = allEmployees.filter(emp => {
    const isOpStaff = opStaffPositions.includes(emp.position || '');
    const matchesSearch = `${emp.firstname} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase());
    return isOpStaff && matchesSearch;
  });

  const selectedEmployee = opsStaff.find(emp => emp.id === selectedEmployeeId);

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

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px]">
        {/* Employee Sidebar */}
        <Card className="lg:col-span-1 rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col border">
          <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm font-black flex items-center gap-3 uppercase tracking-widest text-slate-500">
                <Users className="h-4 w-4 text-slate-400" />
                Operations Staff
              </CardTitle>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
              <Input 
                 placeholder="Search staff..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-[11px] font-bold"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] no-scrollbar">
             {opsStaff.map(emp => (
               <button 
                 key={emp.id}
                 onClick={() => setSelectedEmployeeId(emp.id)}
                 className={cn(
                   "w-full flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-b border-slate-50 dark:border-slate-800/50 group",
                   selectedEmployeeId === emp.id ? "bg-blue-50/50 dark:bg-blue-900/10" : "bg-transparent"
                 )}
               >
                 <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
                    <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-400 font-black text-[10px]">
                      {emp.firstname[0]}{emp.surname[0]}
                    </AvatarFallback>
                    {emp.avatar && <AvatarImage src={emp.avatar} className="object-cover" />}
                 </Avatar>
                 <div className="flex flex-col items-start truncate">
                   <span className={cn(
                     "font-black text-xs transition-colors",
                     selectedEmployeeId === emp.id ? "text-blue-600" : "text-slate-800 dark:text-slate-200"
                   )}>
                     {emp.firstname} {emp.surname}
                   </span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                     {emp.position}
                   </span>
                 </div>
               </button>
             ))}
          </CardContent>
        </Card>

        {/* Analytics Detail Area */}
        <Card className="lg:col-span-3 rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 border">
          <CardContent className="p-0 h-full flex items-center justify-center min-h-[400px]">
             {!selectedEmployee ? (
               <div className="flex flex-col items-center justify-center text-center p-12 sm:p-20 animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <Users className="h-20 w-20 text-slate-100 relative" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-8 uppercase tracking-tight">Select Staff Member</h3>
                  <p className="text-slate-400 font-medium max-w-sm mt-2 leading-relaxed text-xs">
                    Choose an employee from the left panel to view their equipment usage patterns, active loans, and maintenance compliance records.
                  </p>
               </div>
             ) : (
               <div className="p-6 sm:p-10 w-full animate-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-6 mb-8">
                     <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-800 shadow-xl">
                        <AvatarFallback className="text-3xl font-black bg-blue-50 text-blue-600">
                           {selectedEmployee.firstname[0]}{selectedEmployee.surname[0]}
                        </AvatarFallback>
                     </Avatar>
                     <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">{selectedEmployee.firstname} {selectedEmployee.surname}</h2>
                        <div className="flex items-center gap-3">
                           <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800 font-black uppercase text-[8px] tracking-widest px-3 py-0.5 rounded-full">
                              {selectedEmployee.position}
                           </Badge>
                           <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Since {new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString()}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                     <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-5 group hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-md">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Assets Issued</span>
                        <div className="text-3xl font-black text-blue-600 group-hover:scale-110 transition-transform origin-left">12</div>
                     </div>
                     <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-5 group hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-md">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Active Loans</span>
                        <div className="text-3xl font-black text-amber-500 group-hover:scale-110 transition-transform origin-left">2</div>
                     </div>
                     <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-5 group hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-md">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Items Returned</span>
                        <div className="text-3xl font-black text-emerald-500 group-hover:scale-110 transition-transform origin-left">10</div>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                       <Shield className="h-3.5 w-3.5 text-blue-500" />
                       Recent Operational Activity
                    </h4>
                    <div className="space-y-3">
                       <div className="flex items-center justify-between p-4 rounded-xl border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                <Hammer className="h-5 w-5 text-blue-600" />
                             </div>
                             <div className="flex flex-col">
                                <span className="font-black text-sm text-slate-900 dark:text-white uppercase leading-none">Submersible Pump 2"</span>
                                <span className="text-[10px] text-slate-400 mt-1 font-bold">Checkout: March 10 • Return: March 15</span>
                             </div>
                          </div>
                          <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-black uppercase text-[9px] border-emerald-100 dark:border-emerald-800 rounded-full px-3">Returned</Badge>
                       </div>
                    </div>
                  </div>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

