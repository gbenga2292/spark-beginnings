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

export function EmployeeAnalytics() {
  const allEmployees = useAppStore(state => state.employees);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="flex flex-col gap-10 pb-20 px-8 mt-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-blue-600">Employee Analytics</h1>
        <p className="text-slate-400 font-medium mt-1">Detailed breakdown of employee equipment usage and status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px]">
        {/* Employee Sidebar */}
        <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white flex flex-col">
          <CardHeader className="p-6 pb-2 border-b border-slate-50">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-900" />
                Employees
              </CardTitle>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input 
                 placeholder="Search staff..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-10 h-10 rounded-xl bg-slate-50 border-transparent text-xs font-bold"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] scrollbar-hide">
             {opsStaff.map(emp => (
               <button 
                 key={emp.id}
                 onClick={() => setSelectedEmployeeId(emp.id)}
                 className={cn(
                   "w-full flex items-center gap-4 p-6 hover:bg-slate-50/80 transition-all border-b border-slate-50 group",
                   selectedEmployeeId === emp.id ? "bg-slate-50" : "bg-transparent"
                 )}
               >
                 <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-2 ring-slate-100 ring-offset-2">
                    <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-xs">
                      {emp.firstname[0]}{emp.surname[0]}
                    </AvatarFallback>
                    {emp.avatar && <AvatarImage src={emp.avatar} className="object-cover" />}
                 </Avatar>
                 <div className="flex flex-col items-start truncate">
                   <span className={cn(
                     "font-black text-sm",
                     selectedEmployeeId === emp.id ? "text-blue-600" : "text-slate-800"
                   )}>
                     {emp.firstname} {emp.surname}
                   </span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                     {emp.position}
                   </span>
                 </div>
               </button>
             ))}
          </CardContent>
        </Card>

        {/* Analytics Detail Area */}
        <Card className="lg:col-span-3 rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardContent className="p-0 h-full flex items-center justify-center">
             {!selectedEmployee ? (
               <div className="flex flex-col items-center justify-center text-center p-20 animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <Users className="h-24 w-24 text-slate-100 relative" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mt-8">Select an Employee</h3>
                  <p className="text-slate-400 font-medium max-w-sm mt-2 leading-relaxed">
                    Click on an employee from the sidebar to view their full equipment usage history and analytics.
                  </p>
               </div>
             ) : (
               <div className="p-10 w-full animate-in slide-in-from-right-4 duration-500">
                  {/* Real detail view could go here, for now it's just a placeholder */}
                  <div className="flex items-center gap-6 mb-10">
                     <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                        <AvatarFallback className="text-4xl">
                           {selectedEmployee.firstname[0]}{selectedEmployee.surname[0]}
                        </AvatarFallback>
                     </Avatar>
                     <div>
                        <h2 className="text-3xl font-black text-slate-900">{selectedEmployee.firstname} {selectedEmployee.surname}</h2>
                        <div className="flex items-center gap-3 mt-2">
                           <Badge className="bg-blue-100 text-blue-600 border-0 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-full">
                              {selectedEmployee.position}
                           </Badge>
                           <span className="text-slate-400 font-bold text-xs">Joined {new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString()}</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                     <Card className="rounded-2xl border-slate-100 bg-slate-50/50 shadow-none p-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Checkouts</span>
                        <div className="text-3xl font-black text-blue-600 mt-1">12</div>
                     </Card>
                     <Card className="rounded-2xl border-slate-100 bg-slate-50/50 shadow-none p-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Loans</span>
                        <div className="text-3xl font-black text-amber-500 mt-1">2</div>
                     </Card>
                     <Card className="rounded-2xl border-slate-100 bg-slate-50/50 shadow-none p-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Returns</span>
                        <div className="text-3xl font-black text-green-500 mt-1">10</div>
                     </Card>
                  </div>

                  <div className="mt-10">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                       <Shield className="h-4 w-4 text-blue-600" />
                       Recent Activity History
                    </h4>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex flex-col">
                             <span className="font-bold text-slate-900">Submersible Pump 2"</span>
                             <span className="text-xs text-slate-400 mt-1 font-medium italic">Checked out on 2026-03-10 • Returned on 2026-03-15</span>
                          </div>
                          <Badge className="bg-green-100 text-green-600 border-0 font-bold rounded-full px-4">Returned</Badge>
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
