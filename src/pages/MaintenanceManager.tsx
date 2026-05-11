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
  const [logViewAssetId, setLogViewAssetId] = useState<string | null>(null);
  const [logAssetId, setLogAssetId] = useState<string | null>(null);
  const { maintenanceAssets } = useOperations();
  
  const handleLogAsset = (id: string) => {
    setLogAssetId(id);
    setActiveTab('log');
    setSelectedAssetId(null);
    setLogViewAssetId(null);
  };
  
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

  const isSubViewActive = !!selectedAssetId || !!logViewAssetId;

  useSetPageTitle(
    isSubViewActive ? '' : 'Equipment Maintenance',
    isSubViewActive ? '' : 'Track and manage heavy machinery and vehicle service schedules',
    !isSubViewActive && (
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-9 border-slate-200 hidden sm:flex"
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
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Log Service</span>
          </Button>
        )}
      </div>
    )
  );

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'machines', label: 'Machines', count: machinesCount, icon: Activity },
    { id: 'vehicles', label: 'Vehicles', count: vehiclesCount, icon: Truck },
    { id: 'log', label: 'Service Log', icon: Wrench },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      {/* Tabs - Hidden if viewing details or log */}
      {!isSubViewActive && (
        <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 rounded-2xl shadow-sm border border-slate-200/60 p-1.5 flex overflow-x-auto overflow-y-hidden scrollbar-hide shrink-0 gap-1 mb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MaintenanceTab);
                setSelectedAssetId(null);
                setLogAssetId(null);
                setLogViewAssetId(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2.5 flex-1 min-w-[100px] sm:min-w-[140px] py-3 text-sm font-bold rounded-xl transition-all whitespace-nowrap group",
                activeTab === tab.id 
                  ? 'bg-blue-50/50 text-blue-600 shadow-sm border-b-2 border-blue-600 rounded-b-none' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              )}
            >
              <tab.icon className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                activeTab === tab.id ? "text-blue-600" : "text-slate-300 group-hover:text-slate-400"
              )} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black tracking-tight",
                  activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
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
            logViewAssetId={logViewAssetId}
            onSetLogViewAssetId={setLogViewAssetId}
            onLogAsset={handleLogAsset}
          />
        )}
        {activeTab === 'vehicles' && (
          <MaintenanceAssetGrid 
            category="vehicle" 
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            logViewAssetId={logViewAssetId}
            onSetLogViewAssetId={setLogViewAssetId}
            onLogAsset={handleLogAsset}
          />
        )}
        {activeTab === 'log' && <LogMaintenanceForm initialAssetId={logAssetId} />}
      </div>
    </div>
  );
}

