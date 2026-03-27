import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  Settings2, 
  Wrench,
  Clock,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  List,
  LayoutDashboard,
  Activity,
  Truck,
  FileDown,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { MaintenanceDashboard } from './maintenance/MaintenanceDashboard';
import { MaintenanceAssetGrid } from './maintenance/MaintenanceAssetGrid';
import { LogMaintenanceForm } from './maintenance/LogMaintenanceForm';

type MaintenanceTab = 'dashboard' | 'machines' | 'vehicles' | 'log';

export function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard');
  const { maintenanceAssets } = useOperations();
  
  const machinesCount = maintenanceAssets.filter(a => a.category === 'machine').length;
  const vehiclesCount = maintenanceAssets.filter(a => a.category === 'vehicle').length;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'machines', label: `Machines (${machinesCount})`, icon: Activity },
    { id: 'vehicles', label: `Vehicles (${vehiclesCount})`, icon: Truck },
    { id: 'log', label: 'Log Maintenance', icon: Wrench },
  ];

  return (
    <div className="flex flex-col gap-10 pb-20 px-8 mt-4 h-full animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-blue-600">Machine Maintenance</h1>
          <p className="text-slate-400 font-medium mt-1">Track and manage equipment maintenance schedules</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="relative group">
              <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-slate-600 gap-2 px-6 h-12 shadow-sm bg-white hover:bg-slate-50">
                 <FileDown className="h-4 w-4" /> Export Report <ChevronDown className="h-3 w-3" />
              </Button>
           </div>
           {activeTab !== 'log' && (
              <Button 
                onClick={() => setActiveTab('log')}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 shadow-xl shadow-blue-200 gap-2"
              >
                 <Plus className="h-4 w-4" /> Log Service
              </Button>
           )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit self-start shadow-sm border border-slate-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as MaintenanceTab)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === tab.id 
                ? "bg-white text-blue-600 shadow-xl shadow-slate-200/50 border border-slate-100" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
          >
            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-blue-600" : "text-slate-300")} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'dashboard' && <MaintenanceDashboard />}
        {activeTab === 'machines' && <MaintenanceAssetGrid category="machine" />}
        {activeTab === 'vehicles' && <MaintenanceAssetGrid category="vehicle" />}
        {activeTab === 'log' && <LogMaintenanceForm />}
      </div>
    </div>
  );
}
