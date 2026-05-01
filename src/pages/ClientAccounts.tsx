import React, { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { Billing } from './Billing';
import { Payments } from './Payments';
import { VatPayments } from './VatPayments';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { ReceiptText, Landmark, Search } from 'lucide-react';
import { NairaSign } from '@/src/components/ui/naira-sign';

export function ClientAccounts() {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  
  const billingPriv = currentUser?.privileges?.billing as any;
  const paymentPriv = currentUser?.privileges?.payments as any;

  const canViewInvoice = billingPriv?.canView === true;
  const canViewPayment = paymentPriv?.canView === true;
  const canViewVat = paymentPriv?.canViewVat === true;

  const tabs: { id: string; label: string; icon: any; component: React.ReactNode }[] = [];
  if (canViewInvoice) tabs.push({ id: 'invoice', label: 'Invoice', icon: ReceiptText, component: <Billing /> });
  if (canViewPayment) tabs.push({ id: 'payment', label: 'Payment', icon: NairaSign, component: <Payments /> });
  if (canViewVat) tabs.push({ id: 'vat', label: 'VAT', icon: Landmark, component: <VatPayments /> });

  const [activeTab, setActiveTab] = useState(tabs.length > 0 ? tabs[0].id : '');
  const [searchTerm, setSearchTerm] = useState('');

  // If permissions change and active tab is no longer available, switch to first available
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [canViewInvoice, canViewPayment, canViewVat, activeTab, tabs]);

  if (tabs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 min-h-[400px]">
            <ReceiptText className="w-12 h-12 text-slate-300 mb-4" />
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
          "flex flex-col gap-3 px-4 sm:px-6 pt-4 pb-0 mb-4 border-b",
          isDark ? "border-slate-800 bg-slate-900/50" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all rounded-t-lg border-b-2 whitespace-nowrap",
                    isActive 
                      ? (isDark ? "border-indigo-400 text-indigo-400 bg-indigo-950/20" : "border-indigo-600 text-indigo-700 bg-indigo-50/50") 
                      : (isDark ? "border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/50" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50")
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="hidden sm:block relative w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients, sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none transition-all",
                isDark 
                  ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-indigo-500" 
                  : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
              )}
            />
          </div>
        </div>
        
        {/* Mobile Search - Only shows on small screens below the tabs if needed */}
        <div className="sm:hidden relative w-full mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients, sites..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border outline-none transition-all",
              isDark 
                ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-indigo-500" 
                : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
            )}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 w-full overflow-y-auto px-4 sm:px-6">
        {ActiveComponent ? React.cloneElement(ActiveComponent as React.ReactElement, { searchTerm } as any) : null}
      </div>
    </div>
  );
}

