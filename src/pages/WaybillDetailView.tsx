import { useState } from 'react';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import {
  ArrowLeft, Download, Eye, Calendar, User, Car, MapPin, Package, X, FileText, Share2
} from 'lucide-react';
import { Waybill } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';

interface WaybillDetailViewProps {
  waybill: Waybill;
  onClose: () => void;
}

export function WaybillDetailView({ waybill, onClose }: WaybillDetailViewProps) {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>('');

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
    </>
  );
}
