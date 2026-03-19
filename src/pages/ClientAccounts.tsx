import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { Billing } from './Billing';
import { Payments } from './Payments';
import { VatPayments } from './VatPayments';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { Receipt, DollarSign, Landmark } from 'lucide-react';

export function ClientAccounts() {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  
  const billingPriv = currentUser?.privileges?.billing as any;
  const paymentPriv = currentUser?.privileges?.payments as any;

  const canViewInvoice = billingPriv?.canView === true;
  const canViewPayment = paymentPriv?.canView === true;
  const canViewVat = paymentPriv?.canViewVat === true;

  const tabs = [];
  if (canViewInvoice) tabs.push({ id: 'invoice', label: 'Invoice', icon: Receipt, component: <Billing /> });
  if (canViewPayment) tabs.push({ id: 'payment', label: 'Payment', icon: DollarSign, component: <Payments /> });
  if (canViewVat) tabs.push({ id: 'vat', label: 'VAT', icon: Landmark, component: <VatPayments /> });

  const [activeTab, setActiveTab] = useState(tabs.length > 0 ? tabs[0].id : '');

  // If permissions change and active tab is no longer available, switch to first available
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [canViewInvoice, canViewPayment, canViewVat, activeTab, tabs]);

  if (tabs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 min-h-[400px]">
            <Receipt className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-600">No Access</p>
            <p className="text-sm">You do not have permission to view Client Accounts.</p>
        </div>
    );
  }

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div className={cn("flex flex-col h-full", isDark ? "bg-slate-950" : "bg-slate-50")}>
      {/* Tabs Header */}
      <div className={cn(
          "flex items-center gap-2 px-6 pt-4 pb-0 mb-4 border-b",
          isDark ? "border-slate-800 bg-slate-900/50" : "bg-white border-slate-200"
      )}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-[1px]",
                isActive 
                  ? (isDark ? "border-indigo-400 text-indigo-400" : "border-indigo-600 text-indigo-700") 
                  : (isDark ? "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300")
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 w-full overflow-y-auto px-6">
        {ActiveComponent}
      </div>
    </div>
  );
}

