import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Asset } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/src/components/ui/dialog';
import { useOperations } from '../contexts/OperationsContext';
import { FileText, FileSpreadsheet, Download, Table as TableIcon } from 'lucide-react';

interface ExportAssetsDialogProps {
  onClose: () => void;
}

export function ExportAssetsDialog({ onClose }: ExportAssetsDialogProps) {
  const { assets } = useOperations();
  const [exportScope, setExportScope] = useState<string>('all');

  const categories = Array.from(new Set(assets.map(a => a.category))).filter(Boolean);
  const types = Array.from(new Set(assets.map(a => a.type))).filter(Boolean);

  const filteredAssets = useMemo(() => {
    let filtered = [...assets];
    if (exportScope === 'low_stock') {
      filtered = filtered.filter(a => a.availableQuantity <= (a.criticalStockLevel || 0));
    } else if (exportScope.startsWith('cat_')) {
      const cat = exportScope.replace('cat_', '');
      filtered = filtered.filter(a => a.category === cat);
    } else if (exportScope.startsWith('type_')) {
      const type = exportScope.replace('type_', '');
      filtered = filtered.filter(a => a.type === type);
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, exportScope]);

  const handleExportExcel = () => {
    const data = filteredAssets.map(a => ({
      'Asset Name': a.name,
      'Category': a.category,
      'Type': a.type,
      'Total Stock': a.quantity,
      'Available': a.availableQuantity,
      'Reserved': a.reservedQuantity || 0,
      'Missing': a.missingQuantity || 0,
      'Damaged': a.damagedQuantity || 0,
      'Used': a.usedQuantity || 0,
      'Unit': a.unitOfMeasurement,
      'Location': a.location,
      'Status': a.status,
      'Condition': a.condition,
      'Description': a.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    onClose();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text('Inventory Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);
    doc.text(`Scope: ${exportScope.replace('cat_', 'Category: ').replace('type_', 'Type: ').toUpperCase()}`, 14, 28);
    doc.text(`Total Assets: ${filteredAssets.length}`, 14, 34);

    const tableData = filteredAssets.map(a => [
      a.name,
      a.category,
      a.type,
      a.quantity.toString(),
      a.availableQuantity.toString(),
      (a.reservedQuantity || 0).toString(),
      a.location || '',
      a.status
    ]);

    (doc as any).autoTable({
      startY: 40,
      head: [['Asset Name', 'Category', 'Type', 'Total', 'Available', 'Reserved', 'Location', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`Inventory_Export_${new Date().toISOString().split('T')[0]}.pdf`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[85vh]">
        <DialogHeader className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">Export Inventory</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Select scope and preview data before exporting</p>
            </div>
          </div>
          <DialogClose className="absolute right-4 top-4" />
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
            <div className="flex-1 w-full max-w-sm">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Export Scope</label>
              <select 
                value={exportScope} 
                onChange={e => setExportScope(e.target.value)}
                className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">All Assets</option>
                <option value="low_stock">Low Stock & Critical</option>
                
                {categories.length > 0 && (
                  <optgroup label="By Category">
                    {categories.map(cat => (
                      <option key={`cat_${cat}`} value={`cat_${cat}`}>Category: {cat}</option>
                    ))}
                  </optgroup>
                )}

                {types.length > 0 && (
                  <optgroup label="By Type">
                    {types.map(type => (
                      <option key={`type_${type}`} value={`type_${type}`}>Type: {type}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-semibold whitespace-nowrap">
                {filteredAssets.length} Assets Selected
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50 p-0">
            {filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <TableIcon className="h-10 w-10 mb-4 opacity-20" />
                <p>No assets found for the selected scope.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm border-b border-border z-10">
                  <tr className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Asset Name</th>
                    <th className="px-4 py-3 text-center">Category / Type</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Available</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-foreground uppercase text-xs">{asset.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="capitalize text-xs font-medium text-slate-600 dark:text-slate-400">{asset.category} &bull; {asset.type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{asset.quantity}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{asset.availableQuantity}</td>
                      <td className="px-4 py-2.5 text-center text-xs">
                         <span className="capitalize px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{asset.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card flex items-center justify-between flex-shrink-0 sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="mr-auto">Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={filteredAssets.length === 0} className="gap-2">
              <FileText className="h-4 w-4 text-rose-500" /> Export PDF
            </Button>
            <Button onClick={handleExportExcel} disabled={filteredAssets.length === 0} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
