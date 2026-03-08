import { useState } from 'react';
import { FinanceDashboard } from './FinanceDashboard';
import { Billing } from './Billing';
import { Payments } from './Payments';
import { VatPayments } from './VatPayments';
import { Receipt, CreditCard, Landmark, LayoutDashboard } from 'lucide-react';

export function FinanceHub() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
                        Financial Hub
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage Invoices, Payments & Tax Remittance.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-[500px]">
                <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
                    <div className="flex bg-slate-200/50 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
                        <button
                            className={`flex items-center whitespace-nowrap gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            <LayoutDashboard className="w-4 h-4" /> Dashboard
                        </button>
                        <button
                            className={`flex items-center whitespace-nowrap gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'invoices' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('invoices')}
                        >
                            <Receipt className="w-4 h-4" /> Invoices
                        </button>
                        <button
                            className={`flex items-center whitespace-nowrap gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'payments' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('payments')}
                        >
                            <CreditCard className="w-4 h-4" /> Payments
                        </button>
                        <button
                            className={`flex items-center whitespace-nowrap gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'vat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('vat')}
                        >
                            <Landmark className="w-4 h-4" /> VAT to FIRS
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-4 sm:p-6 bg-slate-50/30">
                    {activeTab === 'dashboard' && <FinanceDashboard />}
                    {activeTab === 'invoices' && <Billing />}
                    {activeTab === 'payments' && <Payments />}
                    {activeTab === 'vat' && <VatPayments />}
                </div>
            </div>
        </div>
    );
}
