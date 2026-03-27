import { useState } from 'react';
import { 
  ArrowLeft, 
  X, 
  Printer, 
  Share2, 
  Calendar, 
  User, 
  Car,
  MapPin,
  FileText
} from 'lucide-react';
import { Waybill } from '../types';
import { Button } from '@/src/components/ui/button';
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
  const [showPreview, setShowPreview] = useState(false);

  const generatePDF = (download = false) => {
    const doc = new jsPDF();
    
    // Logo (placeholder for now as base64 is better for jsPDF)
    // doc.addImage(logoSrc, 'PNG', 15, 15, 40, 15);
    
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
    doc.text(`Materials ${waybill.type === 'waybill' ? 'Distribution' : 'Returns'} for Dewatering from ${fromText} to ${toText}`, 105, 80, { align: 'center' });
    
    let yPos = 95;
    waybill.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.assetName} (${item.quantity})`, 25, yPos);
      yPos += 7;
    });
    
    doc.line(20, 260, 100, 260); // Signature line
    doc.text('Signed', 20, 265);
    doc.setFontSize(8);
    doc.text('Dewatering Construction Etc Limited', 20, 270);
    
    if (download) {
      doc.save(`${waybill.id}.pdf`);
    } else {
      const string = doc.output('datauristring');
      const iframe = "<iframe width='100%' height='100%' src='" + string + "'></iframe>"
      const x = window.open();
      x?.document.open();
      x?.document.write(iframe);
      x?.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 p-0 sm:p-4 overflow-y-auto animate-in slide-in-from-right-10 duration-500">
      <div className="max-w-6xl mx-auto min-h-full flex flex-col gap-6 p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={onClose}
              className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-blue-500" />
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                  {waybill.type === 'return' ? 'Return Waybill' : 'Waybill'} {waybill.id}
                </h1>
              </div>
              <p className="text-slate-400 font-bold text-sm ml-6">{waybill.siteName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
               variant="outline" 
               className="h-12 px-6 rounded-xl border-slate-200 font-bold flex items-center gap-2 text-slate-600 hover:bg-slate-50"
               onClick={() => generatePDF(false)}
            >
              <Printer className="h-5 w-5" />
              Preview & Print
            </Button>
            <Button 
               className="h-12 px-6 rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 font-bold flex items-center gap-2"
               onClick={() => generatePDF(true)}
            >
              <Share2 className="h-5 w-5" />
              Share PDF
            </Button>
            <button onClick={onClose} className="ml-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Created Info Bar */}
        <div className="flex items-center gap-8 text-slate-400 text-sm font-bold">
           <div className="flex items-center gap-2">
             <span>Created: {new Date(waybill.issueDate).toLocaleDateString()}</span>
           </div>
           <div className="flex items-center gap-2">
             <MapPin className="h-4 w-4" />
             <span>{waybill.siteName}</span>
           </div>
        </div>

        {/* Content Card */}
        <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-12 space-y-12">
          
          {/* Section: Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-black text-slate-800">
               {waybill.type === 'return' ? 'Return Information' : 'Waybill Information'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                     <Calendar className="h-4 w-4" />
                     <span className="text-xs font-black uppercase tracking-widest">Issue Date</span>
                  </div>
                  <p className="text-xl font-black text-slate-800 tracking-tight">
                    {new Date(waybill.issueDate).toLocaleDateString()}
                  </p>
               </div>
               
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                     <User className="h-4 w-4" />
                     <span className="text-xs font-black uppercase tracking-widest">Driver</span>
                  </div>
                  <p className="text-xl font-black text-slate-800 tracking-tight">
                    {waybill.driverName}
                  </p>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                     <Car className="h-4 w-4" />
                     <span className="text-xs font-black uppercase tracking-widest">Vehicle</span>
                  </div>
                  <p className="text-xl font-black text-slate-800 tracking-tight">
                    {waybill.vehicle || 'L200'}
                  </p>
               </div>

               <div className="space-y-3 lg:col-span-3">
                  <div className="flex items-center gap-2 text-slate-400">
                     <FileText className="h-4 w-4" />
                     <span className="text-xs font-black uppercase tracking-widest">Purpose</span>
                  </div>
                  <p className="text-xl font-black text-slate-800 tracking-tight">
                    {waybill.type === 'return' ? 'Material Return' : 'Site Deployment'}
                  </p>
               </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Section: Items Table */}
          <div className="space-y-6">
            <h3 className="text-lg font-black text-slate-800">
               {waybill.type === 'return' ? 'Items Returned' : 'Items Listed'}
            </h3>
            
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
               <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                     <tr>
                        <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Asset Name</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Quantity Expected</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Quantity {waybill.type === 'return' ? 'Returned' : 'Delivered'}</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {waybill.items.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/20 transition-colors">
                           <td className="px-8 py-6 font-bold text-slate-700">{item.assetName}</td>
                           <td className="px-8 py-6 font-black text-slate-800">{item.quantity}</td>
                           <td className="px-8 py-6 font-black text-slate-800">{item.quantity}</td>
                           <td className="px-8 py-6">
                              <span className="bg-slate-50 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-500 border border-slate-100 uppercase tracking-widest">
                                COMPLETED
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Totals Summary */}
            <div className="px-12 py-8 space-y-3 font-bold text-slate-500">
               <div className="flex items-center justify-between">
                  <span>Total Items:</span>
                  <span className="text-slate-800 font-black">{waybill.items.length}</span>
               </div>
               <div className="flex items-center justify-between">
                  <span>Total Quantity Expected:</span>
                  <span className="text-slate-800 font-black">
                     {waybill.items.reduce((acc, i) => acc + i.quantity, 0)}
                  </span>
               </div>
               <div className="flex items-center justify-between">
                  <span>Total Quantity {waybill.type === 'return' ? 'Returned' : 'Delivered'}:</span>
                  <span className="text-slate-800 font-black">
                     {waybill.items.reduce((acc, i) => acc + i.quantity, 0)}
                  </span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
