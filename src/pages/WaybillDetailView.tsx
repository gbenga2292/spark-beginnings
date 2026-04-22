import { useState } from 'react';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import {
  ArrowLeft, Download, Eye, Calendar, User, Car, MapPin, Package, X, FileText, Share2, CheckCircle2
} from 'lucide-react';
import { Waybill } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';

interface WaybillDetailViewProps {
  waybill: Waybill;
  onClose: () => void;
}

export function WaybillDetailView({ waybill, onClose }: WaybillDetailViewProps) {
  const { updateWaybillStatus } = useOperations();
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>('');
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [sentDate, setSentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnConditions, setReturnConditions] = useState<Record<string, { good: number, damaged: number, missing: number }>>({});

  const generatePdfDoc = () => {
    const doc = new jsPDF();

    // Logo
    try {
      doc.addImage(logoSrc, 'PNG', 15, 10, 60, 22);
    } catch (_) { /* skip if logo fails */ }

    // Title
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text(waybill.type === 'waybill' ? 'WAYBILL' : 'RETURNS', 105, 34, { align: 'center' });

    // Details
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text(`Waybill No: ${waybill.id}`, 20, 48);
    doc.text(`Date: ${formatDisplayDate(waybill.issueDate)}`, 20, 55);
    doc.text(`Driver Name: ${waybill.driverName}`, 20, 62);
    doc.text(`Vehicle: ${waybill.vehicle || 'L200'}`, 20, 69);

    const fromText = waybill.type === 'waybill' ? 'DCEL Warehouse' : (waybill.siteName || 'Site');
    const toText   = waybill.type === 'waybill' ? (waybill.siteName || 'Site') : 'DCEL Warehouse';

    doc.setFont('times', 'bold');
    const subtitle = `Materials ${waybill.type === 'waybill' ? 'Waybill' : 'Returns'} from ${fromText} to ${toText}`;
    const subtitleLines = doc.splitTextToSize(subtitle, 160);
    doc.text(subtitleLines, 105, 82, { align: 'center' });

    doc.setFont('times', 'normal');
    let yPos = 95 + (subtitleLines.length - 1) * 6;

    waybill.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.assetName} (${item.quantity})`, 25, yPos);
      yPos += 7;
    });

    // Signature
    doc.line(20, 262, 100, 262);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('Signed', 20, 267);
    doc.setFontSize(8);
    doc.setFont('times', 'italic');
    doc.text('Dewatering Construction Etc Limited', 20, 273);

    return doc;
  };

  const handlePreview = () => {
    const doc = generatePdfDoc();
    setPdfDataUri(doc.output('datauristring'));
    setShowPdfPreview(true);
  };

  const handleDownload = () => {
    generatePdfDoc().save(`${waybill.id}.pdf`);
  };

  const handleShare = async () => {
    try {
      const doc = generatePdfDoc();
      const pdfBlob = doc.output('blob');
      
      if (navigator.share) {
        const file = new File([pdfBlob], `${waybill.id}.pdf`, { type: 'application/pdf' });
        await navigator.share({
          title: `Waybill ${waybill.id}`,
          text: `Please find attached the Waybill ${waybill.id}`,
          files: [file],
        });
      } else {
        alert('Sharing is not supported on this browser. You can download the PDF instead.');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  const handleMarkAsSent = () => {
    updateWaybillStatus(waybill.id, 'sent_to_site', sentDate);
    setShowDateDialog(false);
    onClose(); // Optional: could stay on page, but usually you return to list
  };

  const handleOpenReturnDialog = () => {
    if (waybill.type === 'return') {
      const initial: Record<string, { good: number, damaged: number, missing: number }> = {};
      waybill.items.forEach(item => {
        initial[item.assetId] = { good: item.quantity, damaged: 0, missing: 0 };
      });
      setReturnConditions(initial);
    }
    setShowDateDialog(true);
  };

  const handleMarkReturnCompleted = () => {
    updateWaybillStatus(waybill.id, 'return_completed', sentDate, returnConditions);
    setShowDateDialog(false);
    onClose();
  };

  // ── Page header ──────────────────────────────────────────────────────────────
  useSetPageTitle(
    `${waybill.type === 'return' ? 'Return' : 'Waybill'} ${waybill.id}`,
    waybill.siteName || 'Logistics Management',
    <div className="hidden sm:flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 text-slate-600 border-slate-200 bg-white hover:bg-slate-50 font-semibold text-xs"
        onClick={handlePreview}
      >
        <Eye className="h-4 w-4" /> Preview
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100 font-semibold text-xs"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" /> Share
      </Button>
      <Button
        size="sm"
        className="h-9 gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" /> Download
      </Button>
      {waybill.type === 'waybill' && waybill.status === 'outstanding' && (
        <Button
          size="sm"
          className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm"
          onClick={() => setShowDateDialog(true)}
        >
          <CheckCircle2 className="h-4 w-4" /> Mark as Sent
        </Button>
      )}
      {waybill.type === 'return' && waybill.status === 'outstanding' && (
        <Button
          size="sm"
          className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
          onClick={handleOpenReturnDialog}
        >
          <CheckCircle2 className="h-4 w-4" /> Complete Return
        </Button>
      )}
    </div>,
    [waybill.id]
  );

  return (
    <>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">

        {/* ── Back button ──────────────────────────────────────────────────────── */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 font-semibold transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Waybills
        </button>

        {/* ── Mobile action buttons ─────────────────────────────────────────── */}
        <div className="flex sm:hidden flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2 text-slate-600 border-slate-200 font-semibold text-xs"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 text-teal-700 border-teal-200 bg-teal-50 font-semibold text-xs"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button
            className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          {waybill.type === 'waybill' && waybill.status === 'outstanding' && (
            <Button
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs mt-2"
              onClick={() => setShowDateDialog(true)}
            >
              <CheckCircle2 className="h-4 w-4" /> Mark as Sent
            </Button>
          )}
          {waybill.type === 'return' && waybill.status === 'outstanding' && (
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs mt-2"
              onClick={handleOpenReturnDialog}
            >
              <CheckCircle2 className="h-4 w-4" /> Complete Return
            </Button>
          )}
        </div>

        {/* ── Waybill info card ─────────────────────────────────────────────── */}
        <div className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          {/* Card header */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
              <MapPin className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              {waybill.type === 'return' ? 'Return' : 'Waybill'} Information
            </p>
          </div>

          {/* Info cells */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
            {[
              { icon: Calendar, label: 'Issue Date', value: formatDisplayDate(waybill.issueDate) },
              { icon: User,     label: 'Driver',     value: waybill.driverName },
              { icon: Car,      label: 'Vehicle',    value: waybill.vehicle || 'L200' },
            ].map((cell, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <cell.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cell.label}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{cell.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Items table ───────────────────────────────────────────────────── */}
        <div className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          {/* Card header */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
              <Package className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              Items {waybill.type === 'return' ? 'Returned' : 'Listed'}{' '}
              <span className="text-slate-400 font-normal">({waybill.items.length})</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-teal-700 border-b border-teal-800 text-teal-50 uppercase text-[11px] tracking-wider font-bold">
                  <th className="px-5 py-4 whitespace-nowrap">#</th>
                  <th className="px-5 py-4 whitespace-nowrap">Asset Name</th>
                  <th className="px-5 py-4 whitespace-nowrap">Qty Expected</th>
                  <th className="px-5 py-4 whitespace-nowrap">
                    Qty {waybill.type === 'return' ? 'Returned' : 'Delivered'}
                  </th>
                  <th className="px-5 py-4 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {waybill.items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-5 py-4 text-slate-400 font-medium">{i + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">{item.assetName}</td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300">{item.quantity}</td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300">{item.quantity}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 font-semibold px-2 py-0.5 rounded-full text-[11px]"
                      >
                        Completed
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Total Items:</span>
              <span className="font-bold text-slate-800 dark:text-white">{waybill.items.length}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Total Quantity:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {waybill.items.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PDF Preview Modal ─────────────────────────────────────────────────── */}
      {showPdfPreview && (
        <Dialog open onOpenChange={() => setShowPdfPreview(false)}>
          <DialogContent
            aria-describedby={undefined}
            className="max-w-4xl h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white text-sm">PDF Preview</p>
                  <p className="text-xs text-slate-400 font-medium">{waybill.id} · {waybill.siteName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* PDF iframe */}
            <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
              <iframe
                src={pdfDataUri}
                className="w-full h-full border-0"
                title="Waybill PDF Preview"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Date Picker Dialog ─────────────────────────────────────────────────── */}
      {showDateDialog && (
        <Dialog open onOpenChange={setShowDateDialog}>
          <DialogContent className="sm:max-w-[425px] p-6 rounded-2xl">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  {waybill.type === 'waybill' ? 'Mark as Sent to Site' : 'Complete Return'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {waybill.type === 'waybill' 
                    ? 'Select the date the assets were delivered to the site. This will transfer the inventory stock.'
                    : 'Select the date the assets were returned to the warehouse. This will restore the inventory stock.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  {waybill.type === 'waybill' ? 'Delivery Date' : 'Return Date'}
                </Label>
                <Input 
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {waybill.type === 'return' && (
                <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                  <Label className="text-xs font-bold text-slate-700 border-b pb-2 block">Item Conditions</Label>
                  {waybill.items.map(item => (
                    <div key={item.assetId} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.assetName}</span>
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">Total: {item.quantity}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-emerald-600">Good</Label>
                          <Input 
                            type="number" 
                            min={0}
                            max={item.quantity - (returnConditions[item.assetId]?.damaged || 0) - (returnConditions[item.assetId]?.missing || 0)}
                            value={returnConditions[item.assetId]?.good || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], good: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs border-emerald-200 focus-visible:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-amber-600">Damaged</Label>
                          <Input 
                            type="number" 
                            min={0}
                            value={returnConditions[item.assetId]?.damaged || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], damaged: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs border-amber-200 focus-visible:ring-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-rose-600">Missing</Label>
                          <Input 
                            type="number" 
                            min={0}
                            value={returnConditions[item.assetId]?.missing || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], missing: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs border-rose-200 focus-visible:ring-rose-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setShowDateDialog(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button 
                  onClick={waybill.type === 'waybill' ? handleMarkAsSent : handleMarkReturnCompleted} 
                  className={waybill.type === 'waybill' ? "bg-blue-600 hover:bg-blue-700 text-white rounded-xl" : "bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"}
                >
                  {waybill.type === 'waybill' ? 'Confirm Delivery' : 'Confirm Return'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
