import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Asset, AssetCategory, AssetType } from '../types/operations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { AlertTriangle, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { useOperations } from '../contexts/OperationsContext';
import { toast } from 'sonner';

interface BulkImportAssetsDialogProps {
  file: File;
  onClose: () => void;
}

export function BulkImportAssetsDialog({ file, onClose }: BulkImportAssetsDialogProps) {
  const { assets, bulkAddAssets, updateAsset, deleteAsset } = useOperations();
  const [importMode, setImportMode] = useState<'append' | 'update' | 'replace'>('append');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        
        const toImport = rows.map((item: any) => ({
          name: item['Asset Name'] || item['Name'] || item['Asset'] || 'Unnamed Asset',
          description: item['Description'] || '',
          category: (item['Category']?.toLowerCase() || 'dewatering') as AssetCategory,
          type: (item['Type']?.toLowerCase() || 'equipment') as AssetType,
          quantity: Number(item['Quantity'] || 0),
          unitOfMeasurement: item['Unit'] || 'pcs',
          cost: Number(item['Cost'] || 0),
          location: item['Location'] || 'store',
          status: 'active',
          condition: 'good',
        }));
        
        // Ensure no duplicates within the import file itself
        const uniqueNames = new Set();
        const deduplicated = [];
        for (const item of toImport) {
          const lowerName = item.name.toLowerCase();
          if (!uniqueNames.has(lowerName)) {
            uniqueNames.add(lowerName);
            deduplicated.push(item);
          }
        }

        setParsedData(deduplicated);
      } catch (err) {
        setError('Failed to parse the file. Please ensure it is a valid Excel or CSV file.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
      setIsProcessing(false);
    };
    reader.readAsBinaryString(file);
  }, [file]);

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('No valid data found to import.');
      onClose();
      return;
    }

    try {
      if (importMode === 'replace') {
        // Delete all existing assets first
        // Note: we can't delete them instantly if they're used in waybills or checkouts, but the prompt says overwrite/append/replace just like employees.
        assets.forEach(a => deleteAsset(a.id));
        // Give a little time for deletions
        setTimeout(() => {
          bulkAddAssets(parsedData);
          toast.success(`Replaced with ${parsedData.length} new assets.`);
          onClose();
        }, 500);
      } else if (importMode === 'update') {
        const existingNamesMap = new Map(assets.map(a => [a.name.toLowerCase(), a.id]));
        const toAdd: any[] = [];
        
        for (const pd of parsedData) {
          const lowerName = pd.name.toLowerCase();
          if (existingNamesMap.has(lowerName)) {
            // Update existing
            const id = existingNamesMap.get(lowerName)!;
            updateAsset(id, pd);
          } else {
            // Add new
            toAdd.push(pd);
          }
        }
        if (toAdd.length > 0) {
          bulkAddAssets(toAdd);
        }
        toast.success(`Updated assets and added ${toAdd.length} new assets.`);
        onClose();
      } else {
        // Append mode: fail if any duplicate name
        const existingNames = new Set(assets.map(a => a.name.toLowerCase()));
        const duplicates = parsedData.filter(d => existingNames.has(d.name.toLowerCase()));
        if (duplicates.length > 0) {
          toast.error(`Cannot append. Found duplicate asset names (e.g. ${duplicates[0].name}).`);
          return;
        }
        bulkAddAssets(parsedData);
        toast.success(`Successfully added ${parsedData.length} assets.`);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error during import');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-md bg-card border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">Import Assets</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{file.name}</p>
            </div>
          </div>
          <DialogClose className="absolute right-4 top-4" />
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-muted-foreground">Parsing file...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/20 rounded-md flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Found <strong className="font-mono tabular-nums">{parsedData.length}</strong> valid records to import.</p>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">How should we handle existing data?</p>
                <div className="grid gap-3">
                  <div
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => setImportMode('append')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'append' ? 'border-blue-600' : 'border-muted-foreground'}`}>
                        {importMode === 'append' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <p className="font-semibold text-sm">Append Only</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">Add new assets. Will fail if any asset name already exists.</p>
                  </div>

                  <div
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      importMode === 'update'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => setImportMode('update')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'update' ? 'border-blue-600' : 'border-muted-foreground'}`}>
                        {importMode === 'update' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <p className="font-semibold text-sm">Update Existing</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">Update existing assets with matching names, and add new ones.</p>
                  </div>

                  <div
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => setImportMode('replace')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === 'replace' ? 'border-rose-500' : 'border-muted-foreground'}`}>
                        {importMode === 'replace' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                      </div>
                      <p className="font-semibold text-sm text-rose-600 dark:text-rose-400">Replace All</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">Delete ALL existing assets and replace them with this file.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-muted/30 shrink-0">
          <Button variant="ghost" className="rounded-md" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white" onClick={handleImport} disabled={isProcessing || !!error || parsedData.length === 0}>
            Start Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
