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
import { toast } from '@/src/components/ui/toast';

type MaintenanceTab = 'dashboard' | 'machines' | 'vehicles' | 'log';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard');
  const { maintenanceAssets } = useOperations();
  
  const machinesCount = maintenanceAssets.filter(a => a.category === 'machine').length;
  const vehiclesCount = maintenanceAssets.filter(a => a.category === 'vehicle').length;

  const handleExport = () => {
    const headers = ['Name', 'Category', 'Description', 'Status', 'Last Service Date', 'Next Service Date'];
    const rows = maintenanceAssets.map(a => [
      a.name, 
      a.category || '', 
      (a as any).description ? `"${String((a as any).description).replace(/"/g, '""')}"` : '',
      a.status || '', 
      a.lastServiceDate || '', 
      a.nextServiceDate || ''
    ].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `maintenance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully');
  };

  useSetPageTitle(
    'Equipment Maintenance',
    'Track and manage heavy machinery and vehicle service schedules',
    <div className="flex items-center gap-2">
       <Button 
         variant="outline" 
         size="sm" 
         className="gap-2 h-9 border-slate-200"
         onClick={handleExport}
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      {/* Compact Tabs */}
      <div className="flex bg-card p-1.5 rounded-xl shadow-sm border border-border items-center overflow-x-auto no-scrollbar gap-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as MaintenanceTab)}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2",
              activeTab === tab.id 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold",
                activeTab === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-secondary-foreground"
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

