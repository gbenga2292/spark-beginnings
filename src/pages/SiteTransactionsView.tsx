import React, { useState } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useOperations } from '../contexts/OperationsContext';
import { Site } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { Eye, ChevronDown } from 'lucide-react';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';

interface SiteTransactionsViewProps {
  site: Site;
  onBack: () => void;
}

interface Transaction {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  asset: string;
  quantity: number;
  reference: string;
  notes: string;
}

export function SiteTransactionsView({ site, onBack }: SiteTransactionsViewProps) {
  const { waybills } = useOperations();
  const [viewMode, setViewMode] = useState<'Table View' | 'Tree View' | 'Flow View'>('Table View');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Derive transactions from waybills for this site
  const siteWaybills = waybills.filter(w =>
    (w.siteName?.toLowerCase() === site.name.toLowerCase() ||
    w.siteId === site.id) &&
    w.status !== 'outstanding'
  );

  const transactions: Transaction[] = [];
  siteWaybills.forEach(wb => {
    wb.items.forEach((item, index) => {
      transactions.push({
        id: `${wb.id}-${index}-${item.assetId}`,
        date: wb.issueDate,
        type: wb.type === 'waybill' ? 'IN' : 'OUT',
        asset: item.assetName,
        quantity: item.quantity,
        reference: wb.id || 'N/A',
        notes: ''
      });
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatPrintDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  useSetPageTitle(
    `${site.name} - Transaction History`,
    'View all asset movements and transactions for this site',
    (
      <div className="flex gap-3">
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="bg-white border-slate-200 text-slate-700 text-xs font-bold h-9 shadow-sm rounded-xl px-4 hover:bg-slate-50 transition-all gap-2 min-w-[120px] justify-between uppercase tracking-wider"
          >
            {viewMode} <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
          
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 p-1.5 flex flex-col gap-1">
                {(['Table View', 'Tree View', 'Flow View'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setViewMode(mode);
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                      viewMode === mode 
                        ? "bg-[#80b18f] text-white" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {viewMode === mode && <span className="mr-2 opacity-80">✓</span>}
                    {mode}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Button
          variant="outline"
          onClick={onBack}
          className="bg-white border-slate-200 text-slate-700 text-xs font-bold h-9 shadow-sm rounded-xl px-4 hover:bg-slate-50 transition-all shrink-0 gap-2 uppercase tracking-wider"
        >
          <Eye className="h-4 w-4" /> Back to Site Inventory
        </Button>
      </div>
    ),
    [site.name, viewMode, isDropdownOpen, onBack]
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        {viewMode === 'Table View' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100/80">
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap">Date</th>
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap">Type</th>
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap leading-none">Asset</th>
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap">Quantity</th>
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap">Reference</th>
                  <th className="px-6 py-5 text-[13px] font-bold text-slate-400 whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium">
                      No transactions found for this site.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {formatPrintDate(tx.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tx.type === 'IN' ? (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500 text-white text-[11px] font-bold">
                            IN
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[11px] font-bold">
                            OUT
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">
                        {tx.asset}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {tx.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {tx.reference}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {tx.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
              <Eye className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">{viewMode} Coming Soon</h3>
            <p className="text-slate-400 max-w-sm mx-auto">This visualization mode is currently under development.</p>
          </div>
        )}
      </div>
    </div>
  );
}
