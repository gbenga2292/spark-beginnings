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
import { MaintenanceDashboard } from '@/src/pages/MaintenanceDashboard';
import { MaintenanceAssetGrid } from '@/src/pages/MaintenanceAssetGrid';
import { LogMaintenanceForm } from '@/src/pages/LogMaintenanceForm';

type MaintenanceTab = 'dashboard' | 'machines' | 'vehicles' | 'log';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard');
  const { maintenanceAssets } = useOperations();
  
  const machinesCount = maintenanceAssets.filter(a => a.category === 'machine').length;
  const vehiclesCount = maintenanceAssets.filter(a => a.category === 'vehicle').length;

  useSetPageTitle(
    'Equipment Maintenance',
    'Track and manage heavy machinery and vehicle service schedules',
    <div className="flex items-center gap-2">
       <Button 
         variant="outline" 
         size="sm" 
         className="gap-2 h-9 border-slate-200"
       >
         <FileDown className="h-4 w-4" /> Export
       </Button>
       {activeTab !== 'log' && (
         <Button 
           size="sm" 
           className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
           onClick={() => setActiveTab('log')}
         >
           <Plus className="h-4 w-4" /> Log Service
         </Button>
       )}
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'machines', label: 'Machines', count: machinesCount, icon: Activity },
    { id: 'vehicles', label: 'Vehicles', count: vehiclesCount, icon: Truck },
    { id: 'log', label: 'Service Log', icon: Wrench },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {/* Compact Tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 items-center overflow-x-auto no-scrollbar gap-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as MaintenanceTab)}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 uppercase tracking-wider",
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px]",
                activeTab === tab.id ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 mt-2">
        {activeTab === 'dashboard' && <MaintenanceDashboard />}
        {activeTab === 'machines' && <MaintenanceAssetGrid category="machine" />}
        {activeTab === 'vehicles' && <MaintenanceAssetGrid category="vehicle" />}
        {activeTab === 'log' && <LogMaintenanceForm />}
      </div>
    </div>
  );
}

