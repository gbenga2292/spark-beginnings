import { useState } from 'react';
import { 
  ArrowLeft, X, Printer, Share2, Calendar, User, Car, MapPin, FileText
} from 'lucide-react';
import { Waybill } from '../types';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSrc from '@/logo/logo-2.png';

interface WaybillDetailViewProps {
  waybill: Waybill;
  onClose: () => void;
}

export function WaybillDetailView({ waybill, onClose }: WaybillDetailViewProps) {
  const { isDark } = useTheme();

  const generatePDF = (download = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(waybill.type === 'waybill' ? 'WAYBILL' : 'RETURNS', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Waybill No: ${waybill.id}`, 20, 45);
    doc.text(`Date: ${new Date(waybill.issueDate).toLocaleDateString()}`, 20, 52);
    doc.text(`Driver Name: ${waybill.driverName}`, 20, 59);
    doc.text(`Vehicle: ${waybill.vehicle || 'L200'}`, 20, 66);
    const fromText = waybill.type === 'waybill' ? 'DCEL Warehouse' : (waybill.siteName || 'Site');
    const toText = waybill.type === 'waybill' ? (waybill.siteName || 'Site') : 'DCEL Warehouse';
    doc.setFont('helvetica', 'bold');
    doc.text(`Materials ${waybill.type === 'waybill' ? 'Distribution' : 'Returns'} from ${fromText} to ${toText}`, 105, 80, { align: 'center' });
    let yPos = 95;
    waybill.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.assetName} (${item.quantity})`, 25, yPos);
      yPos += 7;
    });
    doc.line(20, 260, 100, 260);
    doc.text('Signed', 20, 265);
    doc.setFontSize(8);
    doc.text('Dewatering Construction Etc Limited', 20, 270);
    if (download) {
      doc.save(`${waybill.id}.pdf`);
    } else {
      const string = doc.output('datauristring');
      const iframe = "<iframe width='100%' height='100%' src='" + string + "'></iframe>";
      const x = window.open();
      x?.document.open();
      x?.document.write(iframe);
      x?.document.close();
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 overflow-y-auto animate-in slide-in-from-right-10 duration-500",
      isDark ? 'bg-slate-950' : 'bg-white'
    )}>
      <div className="max-w-5xl mx-auto min-h-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                {waybill.type === 'return' ? 'Return' : 'Waybill'} {waybill.id}
              </h1>
              <p className="text-slate-400 font-bold text-xs">{waybill.siteName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 font-bold flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs flex-1 sm:flex-none"
              onClick={() => generatePDF(false)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold flex items-center gap-2 text-xs flex-1 sm:flex-none"
              onClick={() => generatePDF(true)}>
              <Share2 className="h-4 w-4" /> Share PDF
            </Button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hidden sm:flex">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-400 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(waybill.issueDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span>{waybill.siteName}</span>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "rounded-2xl border p-6 sm:p-8 lg:p-10 space-y-8",
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/50 border-slate-100'
        )}>
          {/* Info Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
              {waybill.type === 'return' ? 'Return' : 'Waybill'} Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Calendar, label: 'Issue Date', value: new Date(waybill.issueDate).toLocaleDateString() },
                { icon: User, label: 'Driver', value: waybill.driverName },
                { icon: Car, label: 'Vehicle', value: waybill.vehicle || 'L200' },
              ].map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-base font-black text-slate-800 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 w-full" />

          {/* Items Table */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
              Items {waybill.type === 'return' ? 'Returned' : 'Listed'}
            </h3>
            
            <div className={cn(
              "rounded-xl border overflow-hidden shadow-sm",
              isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-white border-slate-100'
            )}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className={cn("border-b", isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-100')}>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Asset Name</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Qty Expected</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Qty {waybill.type === 'return' ? 'Returned' : 'Delivered'}</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {waybill.items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 sm:px-6 py-4 font-bold text-sm text-slate-700 dark:text-slate-200">{item.assetName}</td>
                        <td className="px-4 sm:px-6 py-4 font-black text-sm text-slate-800 dark:text-white">{item.quantity}</td>
                        <td className="px-4 sm:px-6 py-4 font-black text-sm text-slate-800 dark:text-white">{item.quantity}</td>
                        <td className="px-4 sm:px-6 py-4">
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 border-green-100 dark:border-green-800 font-black text-[9px] uppercase px-2 py-0 rounded-full">
                            Completed
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 sm:px-6 py-4 space-y-2 border-t border-slate-50 dark:border-slate-800 font-bold text-sm text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Total Items:</span>
                  <span className="text-slate-800 dark:text-white font-black">{waybill.items.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Quantity:</span>
                  <span className="text-slate-800 dark:text-white font-black">{waybill.items.reduce((acc, i) => acc + i.quantity, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
