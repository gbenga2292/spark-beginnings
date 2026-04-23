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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
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
      {/* Tabs - Hidden if viewing details */}
      {!selectedAssetId && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 px-2 mx-1 mb-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MaintenanceTab)}
              className={cn(
                "pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter",
                  activeTab === tab.id ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 mt-2">
        {activeTab === 'dashboard' && <MaintenanceDashboard />}
        {activeTab === 'machines' && (
          <MaintenanceAssetGrid 
            category="machine" 
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        )}
        {activeTab === 'vehicles' && (
          <MaintenanceAssetGrid 
            category="vehicle" 
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        )}
        {activeTab === 'log' && <LogMaintenanceForm />}
      </div>
    </div>
  );
}

