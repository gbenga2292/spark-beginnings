import { formatDisplayDate } from '@/src/lib/dateUtils';
import { 
  ArrowLeft, X, Printer, Share2, Calendar, User, Car, MapPin, FileText
} from 'lucide-react';
import { Waybill } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
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
    doc.text(`Date: ${formatDisplayDate(waybill.issueDate)}`, 20, 52);
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-4xl p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight">
                {waybill.type === 'return' ? 'Return' : 'Waybill'} {waybill.id}
              </DialogTitle>
              <p className="text-muted-foreground font-bold text-xs mt-0.5">{waybill.siteName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="h-9 px-4 rounded-xl border-border font-bold flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs flex-1 sm:flex-none"
              onClick={() => generatePDF(false)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-bold flex items-center gap-2 text-xs flex-1 sm:flex-none"
              onClick={() => generatePDF(true)}>
              <Share2 className="h-4 w-4" /> Share PDF
            </Button>
            <DialogClose className="hidden sm:flex" />
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="overflow-y-auto max-h-[70vh] no-scrollbar p-6 sm:p-8 space-y-8 bg-background">
          
          {/* Info Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><MapPin className="h-4 w-4" /></div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                {waybill.type === 'return' ? 'Return' : 'Waybill'} Information
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Calendar, label: 'Issue Date', value: formatDisplayDate(waybill.issueDate) },
                { icon: User, label: 'Driver', value: waybill.driverName },
                { icon: Car, label: 'Vehicle', value: waybill.vehicle || 'L200' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <item.icon className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-base font-black text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border w-full" />

          {/* Items Table */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-muted-foreground"><Package className="h-4 w-4" /></div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Items {waybill.type === 'return' ? 'Returned' : 'Listed'}
              </h3>
            </div>
            
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-tight">Asset Name</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-tight">Qty Expected</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-tight">Qty {waybill.type === 'return' ? 'Returned' : 'Delivered'}</th>
                      <th className="px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-tight">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {waybill.items.map((item, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 sm:px-6 py-4 font-bold text-sm text-foreground">{item.assetName}</td>
                        <td className="px-4 sm:px-6 py-4 font-black text-sm text-foreground">{item.quantity}</td>
                        <td className="px-4 sm:px-6 py-4 font-black text-sm text-foreground">{item.quantity}</td>
                        <td className="px-4 sm:px-6 py-4">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black text-[9px] uppercase px-2 py-0 rounded-full">
                            Completed
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <span>Total Items:</span>
                    <span className="text-foreground font-black">{waybill.items.length}</span>
                  </div>
                  <div className="h-4 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <span>Total Quantity:</span>
                    <span className="text-foreground font-black">{waybill.items.reduce((acc, i) => acc + i.quantity, 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
