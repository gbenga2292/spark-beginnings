import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import {
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Lock,
  Plus,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  FileText,
  X,
  Building2,
  RefreshCw,
  FolderOpen,
  HelpCircle,
  Link as LinkIcon,
  Search,
  Check,
  PlusCircle,
  SlidersHorizontal,
  FolderHeart,
  TrendingDown,
  TrendingUp,
  Percent,
  Calendar,
  Save,
  Eye,
  EyeOff,
  Pencil,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/components/ui/toast';
import {
  parsePdfStatementWithAI,
  parseImageWithAI,
  detectProvider,
  ExtractedTransaction
} from '@/src/lib/aiImportService';

interface ReviewRow extends ExtractedTransaction {
  id: string;
  selected: boolean;
  isDuplicate: boolean;
  linkedEntries: any[]; // Array of matched LedgerEntry items
  scannedCategory: string; // Original perceived category
  client: string;
  site: string;
  vendor: string;
  bank: string;
}

type Step = 'upload' | 'review' | 'done';

export default function BankImport() {
  useSetPageTitle('AI Statement Scan & Audit', 'Compare bank statements with ledger entries, reconcile categories, and resolve discrepancies');
  
  const navigate = useNavigate();
  const workspaceId = useAppStore((s: any) => s.workspaceId || 'default');
  const currentUser = useUserStore((s) => s.getCurrentUser());
  
  // Store collections
  const ledgerCategories = useAppStore((state) => state.ledgerCategories);
  const ledgerBanks = useAppStore((state) => state.ledgerBanks);
  const ledgerVendors = useAppStore((state) => state.ledgerVendors);
  const ledgerEntries = useAppStore((state) => state.ledgerEntries);
  const addLedgerEntry = useAppStore((state) => state.addLedgerEntry);
  const updateLedgerEntry = useAppStore((state) => state.updateLedgerEntry);
  const bulkAddLedgerEntries = useAppStore((state) => state.bulkAddLedgerEntries);
  const sites = useAppStore((state) => state.sites);

  // Derived lists
  const clients = useMemo(() => Array.from(new Set(sites.map((s) => s.client))).sort(), [sites]);
  const categoriesList = useMemo(() => ledgerCategories.map((c) => c.name), [ledgerCategories]);

  // Page States
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [importProgress, setImportProgress] = useState<{ status: string; pct: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [reconciledCount, setReconciledCount] = useState(0);
  
  // Default values for imported rows
  const [defaultBank, setDefaultBank] = useState('');
  
  // API key configuration
  const [apiKey, setApiKey] = useState('');
  const [keyProvider, setKeyProvider] = useState<string>('unknown');
  const [apiModel, setApiModel] = useState<string>('');
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [tempApiKeyInput, setTempApiKeyInput] = useState('');
  const [showTempKeyInput, setShowTempKeyInput] = useState(false);

  // Manual linking modal filters
  const [activeLinkRowId, setActiveLinkRowId] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [modalSelectedCategory, setModalSelectedCategory] = useState('all');
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');

  // Category creation overlay states
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [rowIdAddingCategory, setRowIdAddingCategory] = useState<string | null>(null);

  // PDF Password states
  const [pdfPasswordModalOpen, setPdfPasswordModalOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfPasswordError, setPdfPasswordError] = useState('');
  const [showPdfPassword, setShowPdfPassword] = useState(false);
  const [pendingFileToUnlock, setPendingFileToUnlock] = useState<File | null>(null);

  // Saved Audits states
  const [savedAudits, setSavedAudits] = useState<any[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [auditName, setAuditName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'summary'>('grid');
  const [renamingAuditId, setRenamingAuditId] = useState<string | null>(null);
  const [renamingAuditValue, setRenamingAuditValue] = useState('');
  // Grid sort state: field = key of ReviewRow, dir = 'asc' | 'desc'
  const [gridSort, setGridSort] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);

  const [auditWithLedger, setAuditWithLedger] = useState(true);
  const [autoAddUnmatched, setAutoAddUnmatched] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingScanType, setPendingScanType] = useState<'pdf' | 'image' | 'excel' | null>(null);

  const startFileProcessFlow = (file: File, scanType: 'pdf' | 'image' | 'excel') => {
    setPendingFile(file);
    setPendingScanType(scanType);
    setShowConfigModal(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch the default API Key from Supabase on mount
  useEffect(() => {
    async function fetchApiKey() {
      setIsKeyLoading(true);
      try {
        const { data } = await supabase
          .from('api_keys')
          .select('key_value,provider,default_model')
          .eq('workspace_id', workspaceId)
          .eq('is_default', true)
          .maybeSingle();

        if (data) {
          setApiKey(data.key_value);
          setKeyProvider(data.provider);
          setApiModel(data.default_model || '');
        }
      } catch (err) {
        console.error('Error fetching API key:', err);
      } finally {
        setIsKeyLoading(false);
      }
    }
    fetchApiKey();
  }, [workspaceId]);

  // Fetch saved audit drafts on mount
  const fetchSavedAudits = async () => {
    try {
      const { data } = await supabase
        .from('bank_audits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (data) {
        setSavedAudits(data);
      }
    } catch (err) {
      console.error('Error fetching saved audits:', err);
    }
  };

  useEffect(() => {
    fetchSavedAudits();
  }, [workspaceId]);

  // Load selected saved audit session
  const handleLoadAudit = (audit: any) => {
    setActiveAuditId(audit.id);
    setAuditName(audit.name);
    setDefaultBank(audit.default_bank || '');
    setReviewRows(audit.review_rows || []);
    setAuditWithLedger(audit.file_metadata?.auditWithLedger ?? true);
    setAutoAddUnmatched(audit.file_metadata?.autoAddUnmatched ?? true);
    setStep('review');
    setViewMode('grid');
    toast.success(`Loaded audit session "${audit.name}"!`);
  };

  // Delete a saved audit session from Supabase
  const handleDeleteAudit = async (e: React.MouseEvent, auditId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this audit draft? This cannot be undone.')) return;
    try {
      await supabase.from('bank_audits').delete().eq('id', auditId);
      toast.success('Audit draft deleted.');
      fetchSavedAudits();
      if (activeAuditId === auditId) setActiveAuditId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete audit draft.');
    }
  };

  // Rename a saved audit session inline
  const handleRenameAudit = async (auditId: string, newName: string) => {
    const name = newName.trim();
    if (!name) { setRenamingAuditId(null); return; }
    try {
      await supabase.from('bank_audits').update({ name, updated_at: new Date().toISOString() }).eq('id', auditId);
      setSavedAudits(prev => prev.map(a => a.id === auditId ? { ...a, name } : a));
      toast.success('Audit renamed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to rename audit.');
    } finally {
      setRenamingAuditId(null);
    }
  };

  // Toggle grid column sort
  const toggleSort = (field: string) => {
    setGridSort(prev =>
      prev?.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  };

  // Upsert current session details to Supabase
  const handleSaveAuditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditName.trim()) {
      toast.error('Audit task name is required.');
      return;
    }
    try {
      const payload = {
        name: auditName.trim(),
        workspace_id: workspaceId,
        default_bank: defaultBank,
        review_rows: reviewRows,
        file_metadata: {
          auditWithLedger,
          autoAddUnmatched
        },
        created_by: currentUser?.name || 'Reconciler',
        updated_at: new Date().toISOString()
      };

      if (activeAuditId) {
        await supabase.from('bank_audits').update(payload).eq('id', activeAuditId);
        toast.success('Audit session draft updated.');
      } else {
        const { data } = await supabase.from('bank_audits').insert(payload).select('id').single();
        if (data) {
          setActiveAuditId(data.id);
        }
        toast.success('New audit session draft saved.');
      }
      setShowSaveModal(false);
      fetchSavedAudits();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save audit session.');
    }
  };

  // Auto-detect provider if user provides a temp key
  const handleTempKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempApiKeyInput.trim()) return;
    const provider = detectProvider(tempApiKeyInput);
    setApiKey(tempApiKeyInput.trim());
    setKeyProvider(provider);
    setShowTempKeyInput(false);
    toast.success(`Temporary API Key applied (${provider})!`);
  };

  // Reconciliation auto-matcher: finds single exact match if any
  const findAutoMatch = (date: string, amount: number) => {
    let match = ledgerEntries.find(
      (e) => e.date === date && e.amount === amount
    );
    if (match) return [match];
    
    const txDate = new Date(date);
    match = ledgerEntries.find((e) => {
      if (e.amount !== amount) return false;
      const eDate = new Date(e.date);
      const diffTime = Math.abs(eDate.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });
    return match ? [match] : [];
  };

  // Normalise raw date to YYYY-MM-DD
  const normalizeDate = (raw: string): string => {
    if (!raw) return new Date().toISOString().slice(0, 10);
    const dateObj = new Date(raw);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().slice(0, 10);
    }
    const parts = raw.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().slice(0, 10);
  };

  // Create new category in store/db
  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    const exists = categoriesList.some(c => c.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast.error(`Category "${name}" already exists.`);
      return;
    }

    const addLedgerCategory = useAppStore.getState().addLedgerCategory;
    const newId = Math.random().toString(36).slice(2);
    addLedgerCategory({ id: newId, name });

    if (rowIdAddingCategory) {
      setReviewRows(prev =>
        prev.map(row => (row.id === rowIdAddingCategory ? { ...row, category: name } : row))
      );
    }

    setNewCategoryName('');
    setRowIdAddingCategory(null);
    setShowNewCategoryModal(false);
    toast.success(`Category "${name}" created successfully!`);
  };

  // Process standard Excel/CSV spreadsheet parsing locally (non-AI method)
  const processExcelLocally = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error('Excel file is empty.');
          setLoading(false);
          return;
        }

        const parsedRows: ReviewRow[] = data
          .map((row, idx) => {
            const rawDate = row['Transaction Date'] || row['Date'] || row.date || row['Voucher Date'] || '';
            const description = String(row['Description'] || row.description || 'Imported Transaction');
            const parsedCategory = String(row['Category'] || row.category || 'Other');
            const amount = Math.abs(Number(row['Amount'] || row.amount)) || 0;
            
            const date = normalizeDate(rawDate);
            const matchedEntries = auditWithLedger ? findAutoMatch(date, amount) : [];
            const hasMatch = matchedEntries.length > 0;
            const primaryMatch = matchedEntries[0];

            return {
              id: Math.random().toString(36).slice(2),
              date,
              description,
              amount,
              type: (row.type === 'income' || amount < 0) ? 'income' : 'expense',
              category: hasMatch ? primaryMatch.category : (categoriesList.includes(parsedCategory) ? parsedCategory : 'Other'),
              scannedCategory: parsedCategory,
              linkedEntries: matchedEntries,
              client: hasMatch ? (primaryMatch.client || 'none') : (clients.includes(row.client) ? row.client : 'none'),
              site: hasMatch ? (primaryMatch.site || 'none') : (sites.some(s => s.name === row.site) ? row.site : 'none'),
              vendor: hasMatch ? (primaryMatch.vendor || 'none') : (ledgerVendors.some(v => v.name === row.vendor) ? row.vendor : 'none'),
              bank: hasMatch ? (primaryMatch.bank || 'none') : (ledgerBanks.some(b => b.name === row.bank) ? row.bank : defaultBank || 'none'),
              selected: !hasMatch,
              isDuplicate: hasMatch
            };
          });

        setReviewRows(parsedRows);
        setStep('review');
        toast.success(`Successfully parsed ${parsedRows.length} transactions from Excel!`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Main processing logic for PDF statement & Camera Scans
  const handleProcess = async (file: File, scanType: 'pdf' | 'image' | 'excel', password?: string) => {
    setLoading(true);
    setSelectedFile(file);
    
    try {
      if (scanType === 'excel') {
        setProgressText('Parsing spreadsheet rows...');
        processExcelLocally(file);
        return;
      }

      if (!apiKey) {
        toast.error('AI API Key is required. Please provide a key to scan using AI.');
        setLoading(false);
        return;
      }

      if (scanType === 'pdf') {
        setProgressText('Extracting PDF text and scanning with AI...');
        setImportProgress({ status: 'Preparing...', pct: 2 });
        try {
          const extracted = await parsePdfStatementWithAI(
            file, apiKey, categoriesList, password, apiModel,
            (status, pct) => setImportProgress({ status, pct })
          );
          const rows: ReviewRow[] = extracted.map(tx => {
            const matchedEntries = auditWithLedger ? findAutoMatch(tx.date, tx.amount) : [];
            const hasMatch = matchedEntries.length > 0;
            const primaryMatch = matchedEntries[0];
            return {
              id: Math.random().toString(36).slice(2),
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: tx.type,
              category: hasMatch ? primaryMatch.category : tx.category,
              scannedCategory: tx.category,
              linkedEntries: matchedEntries,
              client: hasMatch ? (primaryMatch.client || 'none') : 'none',
              site: hasMatch ? (primaryMatch.site || 'none') : 'none',
              vendor: hasMatch ? (primaryMatch.vendor || 'none') : 'none',
              bank: hasMatch ? (primaryMatch.bank || 'none') : (defaultBank || 'none'),
              selected: !hasMatch,
              isDuplicate: hasMatch
            };
          });
          setReviewRows(rows);
          setStep('review');
          setPdfPasswordModalOpen(false);
          setPdfPassword('');
          setPdfPasswordError('');
          setShowPdfPassword(false);
          setPendingFileToUnlock(null);
          setImportProgress({ status: 'Done!', pct: 100 });
          setTimeout(() => setImportProgress(null), 800);
          toast.success(`Successfully scanned ${rows.length} transactions from PDF!`);
        } catch (pdfErr: any) {
          if (pdfErr.message === 'PasswordRequiredException') {
            setPendingFileToUnlock(file);
            setPdfPasswordModalOpen(true);
            setPdfPasswordError(password ? 'Incorrect password. Please try again.' : '');
            setLoading(false);
            return;
          }
          throw pdfErr;
        }
      } else if (scanType === 'image') {
        setProgressText('Uploading image to Gemini Vision OCR...');
        setImportProgress({ status: 'Reading image...', pct: 5 });
        const extracted = await parseImageWithAI(
          file, apiKey, categoriesList, apiModel,
          (status, pct) => setImportProgress({ status, pct })
        );
        const rows: ReviewRow[] = extracted.map(tx => {
          const matchedEntries = auditWithLedger ? findAutoMatch(tx.date, tx.amount) : [];
          const hasMatch = matchedEntries.length > 0;
          const primaryMatch = matchedEntries[0];
          return {
            id: Math.random().toString(36).slice(2),
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            category: hasMatch ? primaryMatch.category : tx.category,
            scannedCategory: tx.category,
            linkedEntries: matchedEntries,
            client: hasMatch ? (primaryMatch.client || 'none') : 'none',
            site: hasMatch ? (primaryMatch.site || 'none') : 'none',
            vendor: hasMatch ? (primaryMatch.vendor || 'none') : 'none',
            bank: hasMatch ? (primaryMatch.bank || 'none') : (defaultBank || 'none'),
            selected: !hasMatch,
            isDuplicate: hasMatch
          };
        });
        setReviewRows(rows);
        setStep('review');
        setImportProgress({ status: 'Done!', pct: 100 });
        setTimeout(() => setImportProgress(null), 800);
        toast.success(`Successfully scanned ${rows.length} transactions from Image!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'AI scanning failed.');
    } finally {
      setLoading(false);
      setImportProgress(null);
    };
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') startFileProcessFlow(file, 'pdf');
    else if (['xlsx', 'xls', 'csv'].includes(ext || '')) startFileProcessFlow(file, 'excel');
    else if (['png', 'jpg', 'jpeg'].includes(ext || '')) startFileProcessFlow(file, 'image');
    else toast.error('Unsupported file format.');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') startFileProcessFlow(file, 'pdf');
    else if (['xlsx', 'xls', 'csv'].includes(ext || '')) startFileProcessFlow(file, 'excel');
    else if (['png', 'jpg', 'jpeg'].includes(ext || '')) startFileProcessFlow(file, 'image');
    else toast.error('Unsupported file format.');
  };

  const triggerCameraScan = () => {
    cameraInputRef.current?.click();
  };

  // Inline changes inside the Review Grid
  const updateRow = (id: string, field: keyof ReviewRow, value: any) => {
    setReviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'client') {
          updated.site = 'none';
        }
        return updated;
      })
    );
  };

  // Toggle ledger entry linking inside manual linking modal
  const toggleLedgerLink = (rowId: string, entry: any) => {
    setReviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const isLinked = row.linkedEntries.some((e) => e.id === entry.id);
        let updatedLinks;
        if (isLinked) {
          updatedLinks = row.linkedEntries.filter((e) => e.id !== entry.id);
        } else {
          updatedLinks = [...row.linkedEntries, entry];
        }

        const sum = updatedLinks.reduce((acc, item) => acc + item.amount, 0);
        const isDuplicate = sum === row.amount;

        return {
          ...row,
          linkedEntries: updatedLinks,
          isDuplicate,
          ...(updatedLinks.length > 0 ? {
            category: updatedLinks[0].category || 'Other',
            client: updatedLinks[0].client || 'none',
            site: updatedLinks[0].site || 'none',
            vendor: updatedLinks[0].vendor || 'none',
          } : {})
        };
      })
    );
  };

  // Open linker modal and preset initial search dates around transaction date (±30 days)
  const handleOpenLinker = (row: ReviewRow) => {
    setActiveLinkRowId(row.id);
    setLedgerSearch('');
    setModalSelectedCategory('all');

    if (row.date) {
      const date = new Date(row.date);
      const start = new Date(date);
      start.setDate(date.getDate() - 30);
      const end = new Date(date);
      end.setDate(date.getDate() + 30);
      setModalStartDate(start.toISOString().slice(0, 10));
      setModalEndDate(end.toISOString().slice(0, 10));
    } else {
      setModalStartDate('');
      setModalEndDate('');
    }
  };

  const handleClearModalFilters = () => {
    setLedgerSearch('');
    setModalSelectedCategory('all');
    setModalStartDate('');
    setModalEndDate('');
  };

  const activeRow = useMemo(() => reviewRows.find(r => r.id === activeLinkRowId), [reviewRows, activeLinkRowId]);

  // Build a set of all ledger entry IDs already linked to OTHER statement rows
  const linkedElsewhereIds = useMemo(() => {
    const ids = new Set<string>();
    reviewRows.forEach(r => {
      if (r.id === activeLinkRowId) return; // skip current row
      r.linkedEntries.forEach(e => ids.add(e.id));
    });
    return ids;
  }, [reviewRows, activeLinkRowId]);

  // Combined ledger search engine (with Category and Date Range Filters)
  // IMPORTANT: already-linked entries are ALWAYS included regardless of filters,
  // so the user can always see what's linked even if it's outside the current date range.
  const filteredLedgerList = useMemo(() => {
    if (!activeRow) return [];

    const linkedIds = new Set(activeRow.linkedEntries.map(e => e.id));

    return ledgerEntries.filter(entry => {
      // Always show already-linked entries — bypass all filters
      if (linkedIds.has(entry.id)) return true;

      // 1. Text Search Filter
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const descMatch = (entry.description || '').toLowerCase().includes(q);
        const voucherMatch = (entry.voucherNo || '').toLowerCase().includes(q);
        const amountMatch = String(entry.amount).includes(q);
        if (!descMatch && !voucherMatch && !amountMatch) return false;
      }

      // 2. Category Filter
      if (modalSelectedCategory !== 'all') {
        if ((entry.category || '').toLowerCase() !== modalSelectedCategory.toLowerCase()) return false;
      }

      // 3. Date Range Filter
      if (modalStartDate && entry.date < modalStartDate) return false;
      if (modalEndDate && entry.date > modalEndDate) return false;

      return true;
    });
  }, [activeRow, ledgerEntries, ledgerSearch, modalSelectedCategory, modalStartDate, modalEndDate]);

  // Perform database import & auditing updates
  const handleImportSubmit = () => {
    const toImport = reviewRows.filter(r => r.selected && r.amount > 0);
    if (toImport.length === 0) {
      toast.error('No transactions selected for import.');
      return;
    }

    const newEntries: any[] = [];
    let updatedCount = 0;

    toImport.forEach((row, idx) => {
      // Reconcile/update linked entries only if auditing is enabled and linked entries exist
      if (auditWithLedger && row.linkedEntries && row.linkedEntries.length > 0) {
        // AUDIT ACTION: Update ALL manually linked ledger entries
        row.linkedEntries.forEach(linkedEntry => {
          updateLedgerEntry(linkedEntry.id, {
            bank: row.bank === 'none' ? '' : row.bank,
            category: row.category,
            client: row.client === 'none' ? '' : row.client,
            site: row.site === 'none' ? '' : row.site,
            vendor: row.vendor === 'none' ? '' : row.vendor,
          });
          updatedCount++;
        });
      } else {
        // Insert new ledger entry only if auto-create is enabled (or if we are not auditing and just importing)
        if (!auditWithLedger || autoAddUnmatched) {
          // AUDIT ACTION: Insert brand new ledger entry
          const uniqueVoucherNo = `AI-${Date.now().toString().slice(-6)}-${idx}`;
          newEntries.push({
            id: Math.random().toString(36).slice(2),
            voucherNo: uniqueVoucherNo,
            date: row.date,
            description: row.description,
            category: row.category,
            amount: row.amount,
            client: row.client === 'none' ? '' : row.client,
            site: row.site === 'none' ? '' : row.site,
            vendor: row.vendor === 'none' ? '' : row.vendor,
            bank: row.bank === 'none' ? '' : row.bank,
            enteredBy: currentUser?.name || 'AI Import'
          });
        }
      }
    });

    if (newEntries.length > 0) {
      if (bulkAddLedgerEntries) {
        bulkAddLedgerEntries(newEntries);
      } else {
        newEntries.forEach(addLedgerEntry);
      }
    }

    // Mark the saved audit draft session as 'completed' in DB if it was loaded from draft
    if (activeAuditId) {
      supabase.from('bank_audits').update({ status: 'completed' }).eq('id', activeAuditId).then(({ error }) => {
        if (error) console.error('Error updating bank audit status:', error);
      });
    }

    setImportedCount(newEntries.length);
    setReconciledCount(updatedCount);
    setStep('done');
    
    if (auditWithLedger) {
      toast.success(`Audit complete! Saved ${newEntries.length} new entries and updated ${updatedCount} matched entries.`);
    } else {
      toast.success(`Import complete! Saved ${newEntries.length} new entries to your ledger.`);
    }
  };

  const selectedCount = reviewRows.filter((r) => r.selected).length;

  // Math models for visual summary and cash projections
  const summaryStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    const categoryTotals: Record<string, number> = {};
    let minDate = '';
    let maxDate = '';

    reviewRows.forEach(row => {
      const amt = row.amount || 0;
      if (row.type === 'income') {
        totalInflow += amt;
      } else {
        totalOutflow += amt;
        categoryTotals[row.category] = (categoryTotals[row.category] || 0) + amt;
      }

      if (row.date) {
        if (!minDate || row.date < minDate) minDate = row.date;
        if (!maxDate || row.date > maxDate) maxDate = row.date;
      }
    });

    const categoryArray = Object.entries(categoryTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    // Calculate duration span in days
    let spanDays = 30;
    if (minDate && maxDate) {
      const diff = new Date(maxDate).getTime() - new Date(minDate).getTime();
      spanDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const linkedCount = reviewRows.filter(r => r.linkedEntries.length > 0).length;
    const coveragePercent = reviewRows.length > 0 ? Math.round((linkedCount / reviewRows.length) * 100) : 0;

    return {
      totalInflow,
      totalOutflow,
      netBalance: totalInflow - totalOutflow,
      categories: categoryArray,
      spanDays,
      minDate,
      maxDate,
      coveragePercent,
      linkedCount
    };
  }, [reviewRows]);

  // Sorted view of review rows for the grid
  const sortedReviewRows = useMemo(() => {
    if (!gridSort) return reviewRows;
    return [...reviewRows].sort((a, b) => {
      let av = (a as any)[gridSort.field];
      let bv = (b as any)[gridSort.field];
      
      // Handle special fields
      if (gridSort.field === 'linkedEntries') {
        av = a.linkedEntries?.length ?? 0;
        bv = b.linkedEntries?.length ?? 0;
      } else if (gridSort.field === 'amount') {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      } else {
        av = String(av ?? '').toLowerCase();
        bv = String(bv ?? '').toLowerCase();
      }

      if (av < bv) return gridSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return gridSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reviewRows, gridSort]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* ================================================================
          STEP 1 — Upload Hub & Saved Audits List
      ================================================================ */}
      {step === 'upload' && (
        <div className="space-y-6">
          
          {/* Key configuration alert banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                AI Statement Scanner Status
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isKeyLoading ? (
                  <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Fetching key...</span>
                ) : apiKey ? (
                  <span className="text-emerald-600 font-medium">✓ Default Workspace API key loaded (Provider: <span className="capitalize">{keyProvider}</span>)</span>
                ) : (
                  <span className="text-amber-600">No active AI API Key found. You can enter one temporarily to scan documents.</span>
                )}
              </p>
            </div>
            {!isKeyLoading && !apiKey && !showTempKeyInput && (
              <Button size="sm" onClick={() => setShowTempKeyInput(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0">
                Provide API Key
              </Button>
            )}
          </div>

          {/* Temp Key input form */}
          {showTempKeyInput && (
            <form onSubmit={handleTempKeySubmit} className="bg-amber-50/55 border border-amber-200/60 dark:bg-slate-900 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Provide Temporary API Key</h4>
                <button type="button" onClick={() => setShowTempKeyInput(false)} className="text-slate-400 hover:text-slate-655"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-slate-500">This key is only held in memory and will be cleared when you reload the page. Paste your Google AI Studio or OpenAI/Groq API key below.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste Key (e.g. AIzaSy... or sk-...)"
                  value={tempApiKeyInput}
                  onChange={(e) => setTempApiKeyInput(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none"
                  autoFocus
                />
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9">
                  Apply Key
                </Button>
              </div>
            </form>
          )}

          {/* Saved Audits list (shows active drafts) */}
          {savedAudits.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-indigo-600" />
                Active Statement Audit Drafts ({savedAudits.filter(a => a.status === 'draft').length})
              </h3>
              <p className="text-xs text-slate-500">Click a session to resume. Use the pencil to rename or the trash icon to delete.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {savedAudits.map((audit) => (
                  <div
                    key={audit.id}
                    onClick={() => renamingAuditId !== audit.id && handleLoadAudit(audit)}
                    className={`p-3.5 border rounded-xl transition-all flex flex-col justify-between ${
                      audit.status === 'completed'
                        ? 'border-slate-200 dark:border-slate-800 opacity-60 cursor-pointer hover:opacity-80'
                        : 'border-indigo-100 dark:border-indigo-950 bg-indigo-50/5 hover:border-indigo-400 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        {renamingAuditId === audit.id ? (
                          <input
                            autoFocus
                            defaultValue={audit.name}
                            onClick={e => e.stopPropagation()}
                            onBlur={e => handleRenameAudit(audit.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameAudit(audit.id, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setRenamingAuditId(null);
                            }}
                            className="flex-1 text-xs font-bold border-b border-indigo-400 outline-none bg-transparent text-slate-800 dark:text-slate-200"
                          />
                        ) : (
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex-1">{audit.name}</h4>
                        )}
                        <span className={`text-[8px] px-1 py-0.5 rounded font-black uppercase leading-none shrink-0 ${
                          audit.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {audit.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-450 mt-2">
                        Scanned Transactions: <strong>{audit.review_rows?.length || 0}</strong>
                      </p>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 mt-4 border-t border-slate-150 dark:border-slate-800 pt-2 leading-none">
                      <span>By: {audit.created_by || 'Unknown'} · {new Date(audit.updated_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          title="Rename"
                          onClick={() => { setRenamingAuditId(audit.id); setRenamingAuditValue(audit.name); }}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => handleDeleteAudit(e, audit.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bank / Source global selection */}
          <div className="max-w-xs space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Default Payment Source</label>
            <select
              value={defaultBank}
              onChange={(e) => setDefaultBank(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 h-9 px-3 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 w-full outline-none shadow-sm"
            >
              <option value="">Select Bank / Source...</option>
              {ledgerBanks.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Upload Dropzone Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* File Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white dark:bg-slate-900/40 min-h-[220px]"
            >
              <div className="bg-indigo-50 dark:bg-slate-850 p-4 rounded-full mb-4">
                <Upload className="h-7 w-7 text-indigo-650" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Drop PDF or Spreadsheet statement</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Supports bank statement PDF files, or Excel/CSV ledger exports (.xlsx, .xls, .csv)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>

            {/* Photo / Camera Scan Zone */}
            <div
              onClick={triggerCameraScan}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white dark:bg-slate-900/40 min-h-[220px]"
            >
              <div className="bg-emerald-50 dark:bg-slate-850 p-4 rounded-full mb-4">
                <Camera className="h-7 w-7 text-emerald-655 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Scan Statement Photo / Receipt</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Take a picture from your device or upload an image file (.png, .jpg, .jpeg)</p>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>

          </div>

          {/* Loader Overlay — with live progress bar */}
          {loading && !pdfPasswordModalOpen && (
            <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 flex flex-col gap-4 border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg shrink-0">
                    <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Scanning Statement...</h4>
                    <p className="text-[11px] text-slate-500">Please wait, this may take a moment</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug flex-1 pr-2">
                      {importProgress?.status || progressText || 'Preparing...'}
                    </p>
                    <span className="text-xs font-black text-indigo-600 shrink-0 tabular-nums">
                      {importProgress ? `${importProgress.pct}%` : ''}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${importProgress?.pct ?? 5}%` }}
                    />
                  </div>
                </div>

                {/* Phase indicators */}
                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                  <span className={(importProgress?.pct ?? 0) >= 10 ? 'text-indigo-500' : ''}>Decrypt</span>
                  <span className={(importProgress?.pct ?? 0) >= 30 ? 'text-indigo-500' : ''}>Parse</span>
                  <span className={(importProgress?.pct ?? 0) >= 70 ? 'text-indigo-500' : ''}>AI Scan</span>
                  <span className={(importProgress?.pct ?? 0) >= 95 ? 'text-emerald-500' : ''}>Done</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================================================================
          STEP 2 — Review Grid & Reconciler Board
      ================================================================ */}
      {step === 'review' && (
        <div className="space-y-5">
          
          {/* Header Controls bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-indigo-600" />
                {auditName ? `Audit Session: ${auditName}` : 'Ledger Audit & Reconciliation Board'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {reviewRows.length} transactions · {reviewRows.filter(r => r.linkedEntries.length > 0).length} linked · Selected {selectedCount} items
              </p>
            </div>

            {/* Toggle view mode: Grid vs Summary report */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 ${
                    viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  Grid View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('summary')}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 ${
                    viewMode === 'summary' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  Summary Report
                </button>
              </div>

              <div className="h-8 w-[1px] bg-slate-200 hidden md:block" />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAuditName(auditName || selectedFile?.name.replace(/\.[^/.]+$/, "") || 'Statement Audit');
                  setShowSaveModal(true);
                }}
                className="h-9 font-bold text-[11px] uppercase tracking-tight border-slate-200 bg-white hover:bg-slate-50 flex-1 md:flex-initial gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4 text-slate-500" /> Save Draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep('upload');
                  setReviewRows([]);
                  setActiveAuditId(null);
                  setAuditName('');
                }}
                className="h-9 font-bold text-[11px] uppercase tracking-tight border-slate-200 bg-white hover:bg-slate-50 flex-1 md:flex-initial"
              >
                Start Over
              </Button>
            </div>
          </div>

          {/* ================================================================
              VIEW MODE A — Grid (Reconciliation & split manual linking)
          ================================================================ */}
          {viewMode === 'grid' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Audit Legend Panel */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] text-slate-650 dark:text-slate-400 flex flex-wrap gap-x-6 gap-y-2">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> New / Unmatched (Inserts record)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-555" /> Balanced Match (Linked entries equal statement amount)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Partial Match / Mismatch (Split amounts do not balance statement)</span>
              </div>

              {/* Bank Source Toolbar */}
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shrink-0">Bank Source</span>
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <select
                    value={defaultBank}
                    onChange={(e) => {
                      setDefaultBank(e.target.value);
                      if (e.target.value !== '__external__') {
                        setReviewRows(prev => prev.map(r => ({ ...r, bank: e.target.value })));
                      }
                    }}
                    className="h-8 px-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none shadow-sm"
                  >
                    <option value="">Select registered bank...</option>
                    {ledgerBanks.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    <option value="__external__">➕ External / Other source...</option>
                  </select>

                  {defaultBank === '__external__' && (
                    <input
                      type="text"
                      placeholder="Enter external source name (e.g. Cash, Petty Cash)"
                      className="h-8 px-2 border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none w-64"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          setDefaultBank(val);
                          setReviewRows(prev => prev.map(r => ({ ...r, bank: val })));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            setDefaultBank(val);
                            setReviewRows(prev => prev.map(r => ({ ...r, bank: val })));
                          }
                        }
                      }}
                    />
                  )}

                  {defaultBank && defaultBank !== '__external__' && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                      ✓ Applied to all {reviewRows.length} rows
                    </span>
                  )}
                </div>
              </div>

              {/* Grid Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-xs font-medium text-slate-700 dark:text-slate-350">
                  <thead className="bg-slate-50 dark:bg-slate-855 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={reviewRows.length > 0 && selectedCount === reviewRows.length}
                          onChange={(e) =>
                            setReviewRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-350 accent-indigo-600 cursor-pointer"
                        />
                      </th>
                      <th
                        className="py-3 px-2 text-left font-bold uppercase tracking-wider w-32 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => toggleSort('date')}
                      >
                        <div className="flex items-center gap-1">
                          Date
                          {gridSort?.field === 'date' ? (
                            gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-2 text-left font-bold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => toggleSort('description')}
                      >
                        <div className="flex items-center gap-1">
                          Description
                          {gridSort?.field === 'description' ? (
                            gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-2 text-right font-bold uppercase tracking-wider w-28 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => toggleSort('amount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Amount
                          {gridSort?.field === 'amount' ? (
                            gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-2 text-left font-bold uppercase tracking-wider w-24 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => toggleSort('type')}
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {gridSort?.field === 'type' ? (
                            gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-2 text-left font-bold uppercase tracking-wider w-40 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => toggleSort('category')}
                      >
                        <div className="flex items-center gap-1">
                          Ledger Category
                          {gridSort?.field === 'category' ? (
                            gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      {auditWithLedger && (
                        <th
                          className="py-3 px-2 text-left font-bold uppercase tracking-wider w-44 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => toggleSort('linkedEntries')}
                        >
                          <div className="flex items-center gap-1">
                            Audit Link
                            {gridSort?.field === 'linkedEntries' ? (
                              gridSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 text-slate-400" />
                            )}
                          </div>
                        </th>
                      )}
                      <th className="py-3 px-3 text-center w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                    {sortedReviewRows.map((row) => {
                      const hasCategoryMismatch = row.linkedEntries.length > 0 && row.category.toLowerCase() !== row.scannedCategory.toLowerCase();
                      
                      const linkedSum = row.linkedEntries.reduce((s, e) => s + e.amount, 0);
                      const isBalanced = linkedSum === row.amount;
                      const isUnlinked = row.linkedEntries.length === 0;

                      return (
                        <tr key={row.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors ${row.selected ? '' : 'opacity-65 bg-slate-50/20'}`}>
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => updateRow(row.id, 'selected', e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-slate-350 accent-indigo-600 cursor-pointer"
                            />
                          </td>


                          <td className="py-2 px-2">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                              className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md text-xs"
                            />
                          </td>

                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                              className="w-full h-8 px-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md text-xs truncate font-semibold"
                            />
                          </td>

                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={row.amount || ''}
                              onChange={(e) => updateRow(row.id, 'amount', Math.abs(Number(e.target.value)))}
                              className="w-full h-8 px-2 text-right border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md text-xs font-extrabold"
                            />
                          </td>

                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => updateRow(row.id, 'type', row.type === 'income' ? 'expense' : 'income')}
                              className={`w-full h-8 rounded-md text-[10px] uppercase tracking-wide font-extrabold transition-all duration-200 border ${
                                row.type === 'income'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-205 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-205 hover:bg-rose-100'
                              }`}
                            >
                              {row.type === 'income' ? 'Income' : 'Expense'}
                            </button>
                          </td>

                          {/* Category Comparison dropdown */}
                          <td className="py-2 px-2">
                            <div className="space-y-1">
                              <select
                                value={row.category}
                                onChange={(e) => {
                                  if (e.target.value === '__new__') {
                                    setRowIdAddingCategory(row.id);
                                    setShowNewCategoryModal(true);
                                  } else {
                                    updateRow(row.id, 'category', e.target.value);
                                  }
                                }}
                                className={`w-full h-8 px-1.5 border rounded-md text-xs bg-white dark:bg-slate-800 truncate ${
                                  hasCategoryMismatch
                                    ? 'border-amber-400 bg-amber-50/15 text-amber-700 font-bold'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <option value="__new__">+ Add New Category...</option>
                                <option value="Other">Other</option>
                                {categoriesList.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              {row.linkedEntries.length > 0 && (
                                <div className="flex justify-between text-[10px] font-medium text-slate-450 leading-none">
                                  <span>Perceived: <strong className="text-indigo-650 dark:text-indigo-400">{row.scannedCategory}</strong></span>
                                  {hasCategoryMismatch && <span className="text-amber-500 font-bold">Changed ✓</span>}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Audit Link Button — last column */}
                          {auditWithLedger && (
                            <td className="py-2 px-2">
                              {isUnlinked ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLinker(row)}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 transition-colors text-slate-505 w-full justify-center"
                                >
                                  <LinkIcon className="h-3 w-3" /> Link Ledger
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLinker(row)}
                                  className={`inline-flex flex-col items-center px-2 py-1 rounded text-[10px] border transition-colors w-full ${
                                    isBalanced
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900'
                                      : 'bg-amber-50 text-amber-700 border-amber-255 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                                  }`}
                                >
                                  <span className="font-extrabold flex items-center gap-1">
                                    <LinkIcon className="h-3 w-3" /> Reconciled ({row.linkedEntries.length})
                                  </span>
                                  <span className="text-[9px] opacity-80 mt-0.5 leading-none">
                                    {isBalanced ? 'Balanced ✓' : `₦${linkedSum.toLocaleString()} / ₦${row.amount.toLocaleString()}`}
                                  </span>
                                </button>
                              )}
                            </td>
                          )}

                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setReviewRows((prev) => prev.filter((r) => r.id !== row.id))}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              VIEW MODE B — Summary & Estimates Report
          ================================================================ */}
          {viewMode === 'summary' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-slate-850 rounded-full text-emerald-600">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Inflow</span>
                    <strong className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                      ₦{summaryStats.totalInflow.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-rose-50 dark:bg-slate-850 rounded-full text-rose-600">
                    <TrendingDown className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Outflow</span>
                    <strong className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                      ₦{summaryStats.totalOutflow.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className={`p-3 rounded-full ${summaryStats.netBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {summaryStats.netBalance >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Net Balance</span>
                    <strong className={`text-xl font-extrabold ${summaryStats.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₦{summaryStats.netBalance.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Reconciliation Coverage & Projections Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Audit Coverage card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Percent className="h-4.5 w-4.5 text-indigo-600" />
                    Ledger Reconciliation Coverage
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Reconciled (Linked) items:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{summaryStats.linkedCount} / {reviewRows.length}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-650 h-full rounded-full transition-all duration-500"
                        style={{ width: `${summaryStats.coveragePercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-450 leading-relaxed pt-1">
                      Coverage indicates how many bank statement entries match pre-recorded ledger vouchers. Unmatched items represent statement-only records (like bank charges) that will be generated as new vouchers on save.
                    </p>
                  </div>
                </div>

                {/* Cash Flow Projections Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-emerald-600" />
                    Statement Cash Flow Projections
                  </h4>
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-500">
                      Based on a statement duration of <strong>{summaryStats.spanDays} days</strong> (from <strong className="text-slate-650">{summaryStats.minDate || '—'}</strong> to <strong className="text-slate-650">{summaryStats.maxDate || '—'}</strong>):
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Average Weekly Outflow:</span>
                        <strong className="text-rose-600">₦{Math.round(summaryStats.totalOutflow / summaryStats.spanDays * 7).toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Average Monthly Outflow:</span>
                        <strong className="text-rose-600 font-extrabold">₦{Math.round(summaryStats.totalOutflow / summaryStats.spanDays * 30).toLocaleString()}</strong>
                      </div>
                      <div className="h-[1px] bg-slate-200 dark:bg-slate-850 my-1" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Average Monthly Inflow:</span>
                        <strong className="text-emerald-600 font-extrabold">₦{Math.round(summaryStats.totalInflow / summaryStats.spanDays * 30).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Category Spending Breakdown table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-5 space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Category Expense Outflows</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 border-b border-slate-150 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-bold uppercase tracking-wider">Category</th>
                        <th className="py-2.5 px-3 text-right font-bold uppercase tracking-wider w-40">Total Outflow</th>
                        <th className="py-2.5 px-3 text-right font-bold uppercase tracking-wider w-36">Outflow share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryStats.categories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-slate-450">No expense transactions found.</td>
                        </tr>
                      ) : (
                        summaryStats.categories.map((c) => {
                          const pct = summaryStats.totalOutflow > 0 ? Math.round((c.total / summaryStats.totalOutflow) * 100) : 0;
                          return (
                            <tr key={c.name} className="hover:bg-slate-50/40">
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-300">{c.name}</td>
                              <td className="py-2.5 px-3 text-right font-bold">₦{c.total.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">{pct}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ================================================================
          STEP 3 — Success / Audit Summary Screen
      ================================================================ */}
      {step === 'done' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm max-w-lg mx-auto space-y-6">
          <div className="bg-emerald-50 dark:bg-slate-850 p-4 rounded-full border border-emerald-100 dark:border-emerald-950">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ledger Reconciliation Complete!</h3>
            <p className="text-xs text-slate-550 mt-2 max-w-[320px]">
              Audit Actions completed:
            </p>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg mt-3 text-xs text-left max-w-xs mx-auto space-y-1">
              <p className="text-slate-650 flex justify-between"><span>New Vouchers Generated:</span> <strong className="text-slate-800 font-bold">{importedCount}</strong></p>
              <p className="text-slate-650 flex justify-between"><span>Reconciled/Updated Vouchers:</span> <strong className="text-indigo-600 font-bold">{reconciledCount}</strong></p>
              <p className="text-slate-650 flex justify-between"><span>Total Audit Actions:</span> <strong className="text-slate-800 font-bold">{importedCount + reconciledCount}</strong></p>
            </div>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => { setStep('upload'); setReviewRows([]); setActiveAuditId(null); setAuditName(''); }} className="flex-1 font-bold text-xs h-10 border-slate-200">
              Audit Another Statement
            </Button>
            <Button onClick={() => navigate('/ledger')} className="flex-1 font-bold text-xs h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
              Go To Ledger
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL — Save Audit Draft Session
      ================================================================ */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAuditSession}
            className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider flex items-center gap-1.5">
                <Save className="h-4.5 w-4.5 text-indigo-600" /> Save Audit Session Draft
              </h4>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500">
              Enter a name for this audit session to save your current linked items, edits, and status so anyone can resume later.
            </p>

            <input
              type="text"
              placeholder="e.g. Zenith July Reconciliation"
              value={auditName}
              onChange={(e) => setAuditName(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl outline-none text-xs font-semibold"
              autoFocus
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSaveModal(false)}
                className="h-9 text-xs font-bold px-4 border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Save Session
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================
          MODAL — Manual Ledger Linker (Split-Reconciliation Dialog)
      ================================================================ */}
      {activeLinkRowId && activeRow && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-indigo-600" />
                  Link Ledger Entries to Statement Row
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Select one or more ledger transactions that aggregate to reconcile this statement record.
                </p>
              </div>
              <button
                onClick={() => setActiveLinkRowId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Statement Target Row Details */}
            <div className="bg-slate-50/80 dark:bg-slate-955/40 p-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs flex-wrap gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statement Transaction</span>
                <p className="font-extrabold text-slate-800 dark:text-slate-100">{activeRow.description}</p>
                <p className="text-slate-500 text-[10px] font-semibold">{activeRow.date}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Amount</span>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">₦{activeRow.amount.toLocaleString()}</p>
              </div>
            </div>

            {/* Real-time Allocation Balancing Summary */}
            {(() => {
              const selectedEntries = activeRow.linkedEntries || [];
              const selectedSum = selectedEntries.reduce((s, e) => s + e.amount, 0);
              const remaining = activeRow.amount - selectedSum;
              const isBalanced = selectedSum === activeRow.amount;
              const isOver = selectedSum > activeRow.amount;
              
              return (
                <div className={`p-4 border-b text-xs flex justify-between items-center ${
                  isBalanced 
                    ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30' 
                    : isOver 
                    ? 'bg-rose-50/40 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30'
                    : 'bg-amber-50/40 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/30'
                }`}>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">Selected Sum</span>
                      <strong className={`text-sm ${isBalanced ? 'text-emerald-600' : isOver ? 'text-rose-600' : 'text-amber-600'}`}>
                        ₦{selectedSum.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">Remaining Balance</span>
                      <strong className="text-sm text-slate-700 dark:text-slate-350">
                        {remaining === 0 ? 'Balanced ✓' : `₦${remaining.toLocaleString()}`}
                      </strong>
                    </div>
                  </div>
                  <div>
                    {isBalanced ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Balanced Match
                      </span>
                    ) : isOver ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Over Allocated by ₦{Math.abs(remaining).toLocaleString()}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 animate-pulse">
                        <PlusCircle className="h-3.5 w-3.5" /> Needs ₦{remaining.toLocaleString()} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Extended Filters & Search Panel */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Text */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search desc, amount, voucher..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                  />
                </div>
                {/* Category Filter */}
                <div className="w-full sm:w-48">
                  <select
                    value={modalSelectedCategory}
                    onChange={(e) => {
                      if (e.target.value === '__new_filter__') {
                        setRowIdAddingCategory(null);
                        setShowNewCategoryModal(true);
                      } else {
                        setModalSelectedCategory(e.target.value);
                      }
                    }}
                    className="w-full h-9 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <option value="__new_filter__">+ Create New Category...</option>
                    <option value="all">All Categories</option>
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Filters & Action Panel */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                    <input
                      type="date"
                      value={modalStartDate}
                      onChange={(e) => setModalStartDate(e.target.value)}
                      className="h-8 px-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                    <input
                      type="date"
                      value={modalEndDate}
                      onChange={(e) => setModalEndDate(e.target.value)}
                      className="h-8 px-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleClearModalFilters}
                    className="flex items-center gap-1.5 px-3 h-8 border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 rounded-md font-bold text-[10px] uppercase text-slate-655 hover:bg-slate-50 tracking-wider shadow-sm transition-all"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Reset Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable list of Candidate Ledger entries — selected entries pinned to top */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800">
              {filteredLedgerList.length === 0 ? (
                <div className="p-10 text-center text-slate-450 text-xs">
                  No matching ledger entries found. Click "Reset Filters" to search the entire ledger.
                </div>
              ) : (
                [...filteredLedgerList]
                  .sort((a, b) => {
                    const aChecked = activeRow.linkedEntries.some(e => e.id === a.id) ? 0 : 1;
                    const bChecked = activeRow.linkedEntries.some(e => e.id === b.id) ? 0 : 1;
                    return aChecked - bChecked;
                  })
                  .map((entry) => {
                  const isChecked = activeRow.linkedEntries.some((e) => e.id === entry.id);
                  const isLinkedElsewhere = !isChecked && linkedElsewhereIds.has(entry.id);
                  
                  return (
                    <div
                      key={entry.id}
                      onClick={() => { if (!isLinkedElsewhere) toggleLedgerLink(activeRow.id, entry); }}
                      className={`p-3.5 flex items-center justify-between transition-colors select-none ${
                        isLinkedElsewhere
                          ? 'opacity-45 cursor-not-allowed bg-slate-50/60 dark:bg-slate-800/10'
                          : isChecked
                            ? 'bg-indigo-50/20 dark:bg-indigo-950/20 cursor-pointer hover:bg-indigo-50/40'
                            : 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLinkedElsewhere}
                          onChange={() => {}}
                          className="h-4 w-4 mt-0.5 rounded border-slate-350 accent-indigo-650 shrink-0 pointer-events-none"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2">
                            <span>{entry.description || 'No Description'}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded leading-none">
                              Voucher: {entry.voucherNo}
                            </span>
                            {isChecked && (
                              <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full leading-none border border-indigo-200 dark:border-indigo-800">
                                ✓ Selected
                              </span>
                            )}
                            {isLinkedElsewhere && (
                              <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full leading-none border border-amber-200 dark:border-amber-800">
                                Already linked to another row
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-x-3 text-[10px] font-medium text-slate-450 mt-1 leading-none">
                            <span>Date: <strong className="text-slate-650">{entry.date}</strong></span>
                            <span>Category: <strong className="text-slate-650">{entry.category || 'none'}</strong></span>
                            {entry.site && <span>Site: <strong className="text-slate-650">{entry.site}</strong></span>}
                            {entry.vendor && <span>Vendor: <strong className="text-slate-650">{entry.vendor}</strong></span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <strong className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          ₦{entry.amount.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveLinkRowId(null)}
                className="h-9 text-xs font-bold px-4 border-slate-200 bg-white"
              >
                Close Linker
              </Button>
              <Button
                size="sm"
                onClick={() => setActiveLinkRowId(null)}
                className="h-9 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Confirm Reconciliation
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* ================================================================
          MODAL — Unlock PDF Password
      ================================================================ */}
      {pdfPasswordModalOpen && pendingFileToUnlock && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pendingFileToUnlock) {
                // Close the modal immediately — the main progress overlay takes over
                // If the password is wrong, handleProcess will re-open this modal
                setPdfPasswordModalOpen(false);
                handleProcess(pendingFileToUnlock, 'pdf', pdfPassword);
              }
            }}
            className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-rose-500 animate-bounce" /> Unlock Bank Statement
              </h4>
              <button
                type="button"
                onClick={() => {
                  setPdfPasswordModalOpen(false);
                  setPdfPassword('');
                  setPdfPasswordError('');
                  setShowPdfPassword(false);
                  setPendingFileToUnlock(null);
                }}
                className="text-slate-400 hover:text-slate-655"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500">
              The PDF file <strong>{pendingFileToUnlock.name}</strong> is password protected. Please enter the password to decrypt it client-side.
            </p>

            {pdfPasswordError && (
              <div className="bg-rose-550/10 border border-rose-200 text-rose-600 text-[10px] font-bold p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {pdfPasswordError}
              </div>
            )}

            <div className="relative">
              <input
                type={showPdfPassword ? 'text' : 'password'}
                placeholder="Enter PDF password..."
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                className="w-full h-10 pl-3 pr-10 bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl outline-none text-xs font-semibold"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPdfPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
              >
                {showPdfPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPdfPasswordModalOpen(false);
                  setPdfPassword('');
                  setPdfPasswordError('');
                  setShowPdfPassword(false);
                  setPendingFileToUnlock(null);
                }}
                className="h-9 text-xs font-bold px-4 border-slate-205"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Decrypt PDF
              </Button>
            </div>
          </form>
        </div>
      )}


      {/* ================================================================
          MODAL — Add New Category (Inline Creator)
      ================================================================ */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddNewCategory}
            className="bg-white dark:bg-slate-900 border border-slate-255 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-slate-750 uppercase tracking-wider">Create New Ledger Category</h4>
              <button
                type="button"
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                  setRowIdAddingCategory(null);
                }}
                className="text-slate-400 hover:text-slate-650"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-505">
              This category will be permanently added to your company budget and ledger categories list.
            </p>
            <input
              type="text"
              placeholder="e.g. Taxes, Custom Duties, Security"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-lg outline-none font-semibold"
              autoFocus
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                  setRowIdAddingCategory(null);
                }}
                className="h-9 text-xs font-bold px-4 border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Add Category
              </Button>
            </div>
          </form>
        </div>
      )}
      {/* ================================================================
          MODAL — Statement Import Configuration
      ================================================================ */}
      {showConfigModal && pendingFile && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-750 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" /> Import Configuration
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  setPendingFile(null);
                  setPendingScanType(null);
                }}
                className="text-slate-400 hover:text-slate-655"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/80">
                <p className="text-xs text-slate-500 truncate">
                  File: <strong className="text-slate-700 dark:text-slate-200">{pendingFile.name}</strong>
                </p>
                <p className="text-[10px] text-slate-400 mt-1 capitalize font-bold">
                  Format: {pendingScanType}
                </p>
              </div>

              {/* Option 1: Audit with Ledger */}
              <div
                className="flex items-start gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-xl transition-colors cursor-pointer select-none"
                onClick={() => setAuditWithLedger(!auditWithLedger)}
              >
                <input
                  type="checkbox"
                  checked={auditWithLedger}
                  onChange={() => {}}
                  className="h-4 w-4 mt-0.5 rounded border-slate-350 accent-indigo-650 shrink-0 pointer-events-none"
                />
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Audit and link with Ledger
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    Reconcile statement entries with vouchers inside the system ledger.
                  </p>
                </div>
              </div>

              {/* Option 2: Auto add unmatched */}
              {auditWithLedger && (
                <div
                  className="flex items-start gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-xl transition-colors cursor-pointer select-none ml-4 border-l-2 border-slate-100 dark:border-slate-800"
                  onClick={() => setAutoAddUnmatched(!autoAddUnmatched)}
                >
                  <input
                    type="checkbox"
                    checked={autoAddUnmatched}
                    onChange={() => {}}
                    className="h-4 w-4 mt-0.5 rounded border-slate-350 accent-indigo-650 shrink-0 pointer-events-none"
                  />
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      Auto add unmatched to Ledger
                    </label>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Create new ledger records automatically for unmatched transactions.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowConfigModal(false);
                  setPendingFile(null);
                  setPendingScanType(null);
                }}
                className="h-9 text-xs font-bold px-4 border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowConfigModal(false);
                  if (pendingFile && pendingScanType) {
                    handleProcess(pendingFile, pendingScanType);
                  }
                }}
                className="h-9 text-xs font-bold px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Start Import
              </Button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
