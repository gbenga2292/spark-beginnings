import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OperationsProvider } from '../contexts/OperationsContext';
import { 
  BarChart3, 
  Package, 
  Truck, 
  MapPin, 
  Activity, 
  PieChart,
  ArrowRightLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

import { Dashboard } from '../components/Dashboard';
import { AssetManager } from '../components/AssetManager';
import { WaybillManager } from '../components/WaybillManager';
import { SiteManager } from '../components/SiteManager';
import { CheckoutManager } from '../components/CheckoutManager';
import { MaintenanceManager } from '../components/MaintenanceManager';

type ViewType = 'overview' | 'assets' | 'waybills' | 'sites' | 'checkout' | 'maintenance' | 'analytics';

export function OperationsShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const { isDark } = useTheme();

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (path && ['assets', 'waybills', 'sites', 'checkout', 'maintenance', 'analytics'].includes(path)) {
      setCurrentView(path as ViewType);
    } else if (location.pathname === '/operations' || location.pathname === '/operations/') {
      setCurrentView('overview');
    }
  }, [location]);

  const handleNav = (id: string) => {
    navigate(`/operations${id === 'overview' ? '' : `/${id}`}`);
  };

  return (
    <OperationsProvider>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Area - Full Width now */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 no-scrollbar relative">
            {currentView === 'overview' && <Dashboard />}
            {currentView === 'assets' && <AssetManager />}
            {currentView === 'waybills' && <WaybillManager />}
            {currentView === 'sites' && <SiteManager />}
            {currentView === 'checkout' && <CheckoutManager />}
            {currentView === 'maintenance' && <MaintenanceManager />}
            {currentView === 'analytics' && <div className="p-6 text-slate-500">Reports and analytics data visualization...</div>}
          </div>
        </div>
      </div>
    </OperationsProvider>
  );
}
