import { useState, useEffect } from 'react';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import {
  ArrowLeft, Download, Eye, Calendar, User, Car, MapPin, Package, X, FileText, Share2, CheckCircle2, Printer, Edit2
} from 'lucide-react';
import { Waybill } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';
import { PdfViewer } from '@/src/components/PdfViewer';

interface WaybillDetailViewProps {
  waybill: Waybill;
  onClose: () => void;
  onEdit?: (waybill: Waybill) => void;
}

export function WaybillDetailView({ waybill: propWaybill, onClose, onEdit }: WaybillDetailViewProps) {
  const { waybills, updateWaybillStatus, vehicles } = useOperations();
  const { sites } = useAppStore();
  const waybill = waybills.find(w => w.id === propWaybill.id) || propWaybill;

  // Scroll to top on mount / waybill change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const mainContainer = document.querySelector('main') || document.documentElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
  }, [waybill.id]);

  /** Returns "REG - Name" when a registration number is on file, else just the name, or '-' if empty. */
  const formatVehicle = (name: string | undefined) => {
    if (!name || name === 'Select Vehicle') return '-';
    const trimmed = name.trim();
    const match = vehicles.find(v => 
      v.name.toLowerCase() === trimmed.toLowerCase() ||
      (v.registration_number && v.registration_number.toLowerCase() === trimmed.toLowerCase()) ||
      `${v.registration_number} - ${v.name}`.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      return match.registration_number ? `${match.registration_number} - ${match.name}` : match.name;
    }
    return trimmed;
  };

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>('');
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [sentDate, setSentDate] = useState<string>(
    (waybill.sentToSiteDate || waybill.issueDate)
      ? (waybill.sentToSiteDate || waybill.issueDate)!.split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [returnConditions, setReturnConditions] = useState<Record<string, { good: number, damaged: number, missing: number }>>({});
  const [signatureBase64, setSignatureBase64] = useState<string>('');

  useEffect(() => {
    if (waybill.signature) {
      if (waybill.signature.startsWith('data:')) {
        setSignatureBase64(waybill.signature);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            try {
              const dataURL = canvas.toDataURL('image/png');
              setSignatureBase64(dataURL);
            } catch (e) {
              console.error('Failed to convert signature URL to base64:', e);
            }
          }
        };
        img.onerror = (err) => {
          console.error('Failed to load signature image:', err);
        };
        img.src = waybill.signature;
      }
    } else {
      setSignatureBase64('');
    }
  }, [waybill.signature]);

  const generatePdfDoc = () => {
    const doc = new jsPDF();

    // Logo
    try {
      doc.addImage(logoSrc, 'PNG', 15, 10, 60, 22);
    } catch (_) { /* skip if logo fails */ }

    // Title
    doc.setFontSize(19);
    doc.setFont('times', 'bold');
    doc.text(waybill.type === 'waybill' ? 'WAYBILL' : 'RETURNS', 105, 34, { align: 'center' });

    // Details
    doc.setFontSize(11);
    doc.setFont('times', 'normal');
    doc.text(`Waybill No: REF-${waybill.id.substring(0, 8).toUpperCase()}`, 20, 48);
    doc.text(`Date: ${formatDisplayDate(waybill.sentToSiteDate || waybill.issueDate)}`, 20, 55);
    doc.text(`Driver Name: ${waybill.driverName}`, 20, 62);
    doc.text(`Vehicle: ${formatVehicle(waybill.vehicle)}`, 20, 69);

    const site = sites.find(s => s.id === waybill.siteId || s.name === waybill.siteName);
    const clientSuffix = site?.client ? ` (${site.client})` : '';

    let fromText = '';
    let toText = '';

    if (waybill.transferSiteName) {
      const transferSite = sites.find(s => s.id === waybill.transferSiteId || s.name === waybill.transferSiteName);
      const transferClientSuffix = transferSite?.client ? ` (${transferSite.client})` : '';
      
      if (waybill.type === 'waybill') {
        fromText = `${waybill.transferSiteName}${transferClientSuffix}`;
        toText = `${waybill.siteName || 'Site'}${clientSuffix}`;
      } else {
        fromText = `${waybill.siteName || 'Site'}${clientSuffix}`;
        toText = `${waybill.transferSiteName}${transferClientSuffix}`;
      }
    } else {
      fromText = waybill.type === 'waybill' ? 'Office / Warehouse' : `${waybill.siteName || 'Site'}${clientSuffix}`;
      toText   = waybill.type === 'waybill' ? `${waybill.siteName || 'Site'}${clientSuffix}` : 'Office / Warehouse';
    }

    doc.setFont('times', 'bold');
    const subtitle = `Materials ${waybill.type === 'waybill' ? 'Waybill' : 'Returns'} from ${fromText} to ${toText}`;
    const subtitleLines = doc.splitTextToSize(subtitle, 160);
    doc.text(subtitleLines, 105, 82, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    let yPos = 95 + (subtitleLines.length - 1) * 7;

    const items = waybill.items;
    const maxItemsPerColumn = 20;

    let yPosCol1 = yPos;
    let yPosCol2 = yPos;

    items.forEach((item, index) => {
      if (index < maxItemsPerColumn) {
        doc.text(`${index + 1}. ${item.assetName} (${item.quantity})`, 25, yPosCol1);
        yPosCol1 += 8;
      } else {
        doc.text(`${index + 1}. ${item.assetName} (${item.quantity})`, 115, yPosCol2);
        yPosCol2 += 8;
      }
    });

    // Signature
    const sig = signatureBase64 || waybill.signature;
    if (sig) {
      try {
        doc.addImage(sig, 'PNG', 20, 235, 45, 20);
      } catch (err) {
        console.error('Error rendering signature in PDF:', err);
      }
    }

    doc.line(20, 262, 100, 262);
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Signed', 20, 267);
    doc.setFontSize(9);
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
    generatePdfDoc().save(`WB-${waybill.id.substring(0, 8).toUpperCase()}.pdf`);
  };

  const handlePrint = () => {
    const doc = generatePdfDoc();
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  const handleShare = async () => {
    try {
      const doc = generatePdfDoc();
      const pdfBlob = doc.output('blob');
      
      if (navigator.share) {
        const file = new File([pdfBlob], `WB-${waybill.id.substring(0, 8).toUpperCase()}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Waybill REF-${waybill.id.substring(0, 8).toUpperCase()}`,
            text: `Please find attached the Waybill REF-${waybill.id.substring(0, 8).toUpperCase()}`,
            files: [file],
          });
        } else {
          // If files can't be shared but share API exists, fallback to download
          handleDownload();
        }
      } else {
        // Fallback silently to download if not supported
        handleDownload();
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
    const d = waybill.sentToSiteDate || waybill.issueDate;
    setSentDate(d ? d.split('T')[0] : new Date().toISOString().split('T')[0]);
    setShowDateDialog(true);
  };

  const handleMarkReturnCompleted = () => {
    updateWaybillStatus(waybill.id, 'return_completed', sentDate, returnConditions);
    setShowDateDialog(false);
    onClose();
  };

  // ── Page header ──────────────────────────────────────────────────────────────
  useSetPageTitle(
    showPdfPreview ? 'PDF Preview' : `${waybill.type === 'return' ? 'Return' : 'Waybill'} REF-${waybill.id.substring(0, 8).toUpperCase()}`,
    waybill.siteName || 'Logistics Management',
    showPdfPreview ? (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 gap-2 text-foreground border-slate-200 dark:border-slate-800 bg-background hover:bg-muted/50 font-semibold text-xs rounded-md shadow-none"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print PDF</span>
        </Button>
        <Button
          size="sm"
          className="h-9 px-3 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-none"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download PDF</span>
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 sm:px-3 gap-2 text-foreground border-slate-200 dark:border-slate-800 bg-background hover:bg-muted/50 font-semibold text-xs rounded-md shadow-none"
          onClick={handlePreview}
        >
          <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 sm:px-3 gap-2 text-foreground border-slate-200 dark:border-slate-800 bg-background hover:bg-muted/50 font-semibold text-xs rounded-md shadow-none"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
        </Button>
        <Button
          size="sm"
          className="h-9 px-2 sm:px-3 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-none"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
        </Button>
        {waybill.type === 'waybill' && waybill.status === 'outstanding' && (
          <Button
            size="sm"
            className="h-9 px-2 sm:px-3 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-none"
            onClick={() => {
              const d = waybill.sentToSiteDate || waybill.issueDate;
              setSentDate(d ? d.split('T')[0] : new Date().toISOString().split('T')[0]);
              setShowDateDialog(true);
            }}
          >
            <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">Mark as Sent</span>
          </Button>
        )}
        {waybill.type === 'return' && waybill.status === 'outstanding' && (
          <Button
            size="sm"
            className="h-9 px-2 sm:px-3 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-none"
            onClick={handleOpenReturnDialog}
          >
            <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">Process Return</span>
          </Button>
        )}
      </div>
    ),
    [waybill.id, showPdfPreview, waybill.type, waybill.status, waybill.siteName, onEdit]
  );

  return (
    <>
      <div className="flex items-center max-w-5xl mx-auto pt-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2 font-medium rounded-md"
          onClick={showPdfPreview ? () => setShowPdfPreview(false) : onClose}
        >
          <ArrowLeft className="h-4 w-4" /> {showPdfPreview ? 'Back to Waybill Info' : 'Back to Waybills'}
        </Button>
      </div>

      {showPdfPreview ? (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10 h-[80vh] min-h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex-1 w-full bg-card rounded-md border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden flex flex-col">
            {/* PDF Viewer – works on desktop and Android */}
            <div className="flex-1 overflow-hidden min-h-[500px] flex flex-col">
              <PdfViewer src={pdfDataUri} className="flex-1" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
        {/* ── Waybill info card ─────────────────────────────────────────────── */}
        <div className="border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden bg-card rounded-md">
          {/* Card header */}
          <div className="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600">
                <MapPin className="h-4 w-4" />
              </div>
              <p className="font-semibold text-foreground text-sm">
                {waybill.type === 'return' ? 'Return' : 'Waybill'} Information
              </p>
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-background hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md shadow-none transition-all"
                onClick={() => onEdit(waybill)}
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {/* Info cells */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            {[
              { icon: Calendar, label: 'Date', value: formatDisplayDate(waybill.sentToSiteDate || waybill.issueDate) },
              { icon: User,     label: 'Driver',     value: waybill.driverName },
              { icon: Car,      label: 'Vehicle',    value: formatVehicle(waybill.vehicle) },
            ].map((cell, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 rounded-md bg-muted/30 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-muted-foreground shrink-0">
                  <cell.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{cell.label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{cell.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* From / To row – shown for all waybills */}
          {(() => {
            const site = sites.find(s => s.id === waybill.siteId || s.name === waybill.siteName);
            const clientSuffix = site?.client ? ` (${site.client})` : '';
            let from = '';
            let to = '';
            if (waybill.transferSiteName) {
              const tSite = sites.find(s => s.id === waybill.transferSiteId || s.name === waybill.transferSiteName);
              const tSuffix = tSite?.client ? ` (${tSite.client})` : '';
              if (waybill.type === 'waybill') {
                from = `${waybill.transferSiteName}${tSuffix}`;
                to   = `${waybill.siteName || 'Site'}${clientSuffix}`;
              } else {
                from = `${waybill.siteName || 'Site'}${clientSuffix}`;
                to   = `${waybill.transferSiteName}${tSuffix}`;
              }
            } else {
              from = waybill.type === 'waybill' ? 'Office / Warehouse' : `${waybill.siteName || 'Site'}${clientSuffix}`;
              to   = waybill.type === 'waybill' ? `${waybill.siteName || 'Site'}${clientSuffix}` : 'Office / Warehouse';
            }
            return (
              <div className="col-span-full border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">From</span>
                  <span className="text-sm font-semibold text-foreground truncate">{from}</span>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">To</span>
                  <span className="text-sm font-semibold text-foreground truncate">{to}</span>
                  {waybill.transferSiteName && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-bold uppercase tracking-wider shrink-0">Site Transfer</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Items table ───────────────────────────────────────────────────── */}
        <div className="border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden bg-card rounded-md">
          {/* Card header */}
          <div className="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center gap-2 bg-muted/30">
            <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600">
              <Package className="h-4 w-4" />
            </div>
            <p className="font-semibold text-foreground text-sm">
              Items {waybill.type === 'return' ? 'Returned' : 'Listed'}{' '}
              <span className="text-muted-foreground font-normal font-mono tabular-nums">({waybill.items.length})</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-600 border-b border-blue-700 text-white uppercase text-[11px] tracking-wider font-semibold">
                  <th className="px-5 py-3.5 whitespace-nowrap">#</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Asset Name</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Qty Expected</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">
                    Qty {waybill.type === 'return' ? 'Returned' : 'Delivered'}
                  </th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {waybill.items.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4 text-muted-foreground font-mono tabular-nums font-medium">{i + 1}</td>
                    <td className="px-5 py-4 font-semibold text-foreground">{item.assetName}</td>
                    <td className="px-5 py-4 font-mono tabular-nums font-semibold text-muted-foreground">{item.quantity}</td>
                    <td className="px-5 py-4 font-mono tabular-nums font-semibold text-foreground">{item.quantity}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-semibold px-2 py-0.5 rounded-sm text-[10px]"
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
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-muted/30 flex flex-wrap items-center gap-4 text-sm font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Total Items:</span>
              <span className="font-bold text-foreground">{waybill.items.length}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:border-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Total Quantity:</span>
              <span className="font-bold text-foreground">
                {waybill.items.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── Date Picker Dialog ─────────────────────────────────────────────────── */}
      {showDateDialog && (
        <Dialog open onOpenChange={setShowDateDialog}>
          <DialogContent className="sm:max-w-[425px] p-6 rounded-md border border-slate-200 dark:border-slate-800 shadow-lg bg-card">
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {waybill.type === 'waybill' ? 'Mark as Sent to Site' : 'Complete Return'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {waybill.type === 'waybill'
                    ? 'Select the date the assets were delivered to the site. This will transfer the inventory stock.'
                    : waybill.transferSiteName
                      ? `Select the date the assets left ${waybill.siteName} and confirm the transfer to ${waybill.transferSiteName}.`
                      : 'Select the date the assets were returned to the warehouse. This will restore the inventory stock.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">
                  {waybill.type === 'waybill' ? 'Delivery Date' : 'Return Date'}
                </Label>
                <Input 
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  className="h-10 rounded-md border-slate-200 dark:border-slate-800 bg-background text-sm"
                />
              </div>

              {waybill.type === 'return' && (
                <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                  <Label className="text-xs font-bold text-foreground border-b border-slate-200 dark:border-slate-800 pb-2 block">Item Conditions</Label>
                  {waybill.items.map(item => (
                    <div key={item.assetId} className="p-3 bg-muted/20 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground truncate">{item.assetName}</span>
                        <span className="text-xs font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">Total: {item.quantity}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-emerald-600">Good</Label>
                          <Input 
                            type="number" 
                            min={0}
                            max={item.quantity - (returnConditions[item.assetId]?.damaged || 0) - (returnConditions[item.assetId]?.missing || 0)}
                            value={returnConditions[item.assetId]?.good || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], good: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs font-mono tabular-nums border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-md"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-amber-600">Damaged</Label>
                          <Input 
                            type="number" 
                            min={0}
                            value={returnConditions[item.assetId]?.damaged || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], damaged: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs font-mono tabular-nums border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-amber-500 rounded-md"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-rose-600">Missing</Label>
                          <Input 
                            type="number" 
                            min={0}
                            value={returnConditions[item.assetId]?.missing || 0}
                            onChange={(e) => setReturnConditions(prev => ({
                              ...prev,
                              [item.assetId]: { ...prev[item.assetId], missing: parseInt(e.target.value) || 0 }
                            }))}
                            className="h-8 text-xs font-mono tabular-nums border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-rose-500 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setShowDateDialog(false)} className="rounded-md font-medium">
                  Cancel
                </Button>
                <Button 
                  onClick={waybill.type === 'waybill' ? handleMarkAsSent : handleMarkReturnCompleted} 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-none font-semibold"
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
