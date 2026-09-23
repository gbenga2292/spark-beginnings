import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/src/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { useAppStore, VendorInvoice, VendorInvoicePayment, LedgerEntry, LedgerVendor } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import { toast, showConfirm } from '@/src/components/ui/toast';
import {
  Plus, Search, X, AlertTriangle, Pencil, CreditCard, CheckCircle2,
  Clock, AlertCircle, Receipt, ArrowRight, MoreVertical, Trash2,
  Calendar, Building2, ChevronLeft, ChevronRight, ArrowUpDown,
  BookOpen, ExternalLink, Filter, Wallet, FileText, Check, Sparkles,
  Link2, Unlink, Edit2, Users, Paperclip, Upload, Eye, Loader2,
  Phone, MapPin, Landmark
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import { DocPreviewModal } from '@/src/components/DocPreviewModal';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ComputedVendorInvoice = VendorInvoice & {
  paidAmount: number;
  balanceRemaining: number;
  derivedStatus: VendorInvoice['status'];
  isOverdue: boolean;
  daysOverdue: number;
  paymentCount: number;
};

export interface LedgerMatchCandidate {
  entry: LedgerEntry;
  score: number;
  reason: string;
}

// ─── Formatting Helpers ────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().split('T')[0];

function formatDateDisplay(dStr?: string) {
  if (!dStr) return '—';
  try {
    const d = new Date(dStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

function getDaysOverdue(dueDateStr?: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr).getTime();
  const now = new Date(todayStr()).getTime();
  const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// ─── Smart Ledger Auto-Matcher (Payment-Input Driven) ─────────────────────────
export function findLedgerMatchesForPayment(
  payment: {
    amount: number;
    date: string;
    bank?: string;
    notes?: string;
    vendorName?: string;
    invoiceNumber?: string;
  },
  ledgerEntries: LedgerEntry[],
  existingPayments: VendorInvoicePayment[],
  excludePaymentId?: string
): LedgerMatchCandidate[] {
  if (!payment.amount || payment.amount <= 0) {
    return [];
  }

  const linkedVouchers = new Set<string>();
  existingPayments.forEach((p) => {
    if (p.ledgerEntryId && p.id !== excludePaymentId) {
      linkedVouchers.add(String(p.ledgerEntryId).trim().toLowerCase());
    }
  });

  const payBankClean = (payment.bank || '').trim().toLowerCase();
  const payNotesClean = (payment.notes || '').trim().toLowerCase();
  const vendorClean = (payment.vendorName || '').trim().toLowerCase();
  const invNoClean = (payment.invoiceNumber || '').trim().toLowerCase();

  const normPayDate = payment.date ? payment.date.trim().split('T')[0].split(' ')[0] : '';
  const payTime = normPayDate ? new Date(normPayDate + 'T00:00:00').getTime() : NaN;

  const candidates: LedgerMatchCandidate[] = [];

  for (const entry of ledgerEntries) {
    const vNo = String(entry.voucherNo || '').trim().toLowerCase();
    const eId = String(entry.id || '').trim().toLowerCase();
    if ((vNo && linkedVouchers.has(vNo)) || (eId && linkedVouchers.has(eId))) {
      continue;
    }

    const amt = Number(entry.amount || 0);
    if (amt <= 0) continue;

    // 1. Amount Match: Must be exact (within 5 kobo / 0.05)
    const diff = Math.abs(amt - payment.amount);
    if (diff > 0.05) {
      continue;
    }

    // 2. Transaction Date: Must be within 10 days (never match ancient entries from months ago!)
    const normEntryTxDate = entry.date ? entry.date.trim().split('T')[0].split(' ')[0] : '';
    const entryTime = normEntryTxDate ? new Date(normEntryTxDate + 'T00:00:00').getTime() : NaN;
    
    let daysDiff = 999;
    if (!isNaN(payTime) && !isNaN(entryTime)) {
      daysDiff = Math.abs(Math.round((entryTime - payTime) / (1000 * 60 * 60 * 24)));
    }

    if (daysDiff > 10) {
      continue;
    }

    // 3. Corroborating signals: require vendor, invoice token, or memo voucher
    const entryDesc = (entry.description || '').trim().toLowerCase();
    const entryVendor = (entry.vendor || '').trim().toLowerCase();
    const entryBank = (entry.bank || '').trim().toLowerCase();

    let hasVendorMatch = false;
    let hasInvoiceMatch = false;
    let hasVoucherInMemo = false;
    let hasBankMatch = Boolean(payBankClean && entryBank && (entryBank === payBankClean || entryBank.includes(payBankClean)));

    if (vNo && payNotesClean.includes(vNo)) {
      hasVoucherInMemo = true;
    }

    if (vendorClean.length >= 3 && (entryVendor === vendorClean || entryVendor.includes(vendorClean) || entryDesc.includes(vendorClean))) {
      hasVendorMatch = true;
    }

    // Match invoice number ONLY if it is at least 3 chars and is a distinct word boundary
    if (invNoClean.length >= 3) {
      const invRegex = new RegExp(`(^|[^a-zA-Z0-9])${invNoClean}([^a-zA-Z0-9]|$)`, 'i');
      if (invRegex.test(entryDesc) || invRegex.test(vNo)) {
        hasInvoiceMatch = true;
      }
    }

    // Guard: Do not guess if none of these strict signals match
    if (!hasVendorMatch && !hasInvoiceMatch && !hasVoucherInMemo && (!hasBankMatch || daysDiff > 1)) {
      continue;
    }

    let score = 50;
    const reasons: string[] = [`₦${fmt(amt)}`];

    if (daysDiff === 0) {
      score += 35;
      reasons.push(`Same date (${formatDateDisplay(normEntryTxDate)})`);
    } else if (daysDiff <= 3) {
      score += 25;
      reasons.push(`${daysDiff}d apart`);
    } else {
      score += 15;
    }

    if (hasVendorMatch) {
      score += 30;
      reasons.push(`Vendor match`);
    }
    if (hasInvoiceMatch) {
      score += 30;
      reasons.push(`Inv #${payment.invoiceNumber}`);
    }
    if (hasVoucherInMemo) {
      score += 40;
      reasons.push(`Voucher in memo`);
    }
    if (hasBankMatch) {
      score += 15;
      reasons.push(`${entry.bank}`);
    }

    if (score >= 80) {
      candidates.push({
        entry,
        score,
        reason: reasons.join(' · '),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ─── Status Badge Component ────────────────────────────────────────────────────
function InvoiceStatusBadge({ status, isOverdue }: { status: VendorInvoice['status']; isOverdue: boolean }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Fully Paid
      </span>
    );
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
        <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Overdue
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Partially Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
      <AlertCircle className="w-3 h-3 text-slate-500" /> Unpaid
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function VendorInvoices() {
  const navigate = useNavigate();
  const priv = usePriv('ledger');
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const ws = currentUser?.workspaceId || 'dcel-team';

  // Store data
  const vendorInvoices = useAppStore((s) => s.vendorInvoices);
  const vendorInvoicePayments = useAppStore((s) => s.vendorInvoicePayments);
  const ledgerVendors = useAppStore((s) => s.ledgerVendors);
  const ledgerBanks = useAppStore((s) => s.ledgerBanks);
  const ledgerEntries = useAppStore((s) => s.ledgerEntries);

  // Store actions
  const addVendorInvoice = useAppStore((s) => s.addVendorInvoice);
  const updateVendorInvoice = useAppStore((s) => s.updateVendorInvoice);
  const deleteVendorInvoice = useAppStore((s) => s.deleteVendorInvoice);
  const addVendorInvoicePayment = useAppStore((s) => s.addVendorInvoicePayment);
  const updateVendorInvoicePayment = useAppStore((s) => s.updateVendorInvoicePayment);
  const deleteVendorInvoicePayment = useAppStore((s) => s.deleteVendorInvoicePayment);
  const addLedgerVendor = useAppStore((s) => s.addLedgerVendor);
  const updateLedgerVendor = useAppStore((s) => s.updateLedgerVendor);
  const removeLedgerVendor = useAppStore((s) => s.removeLedgerVendor);

  // ─── State: Filters, Search, Sort & Pagination ──────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'outstanding' | 'overdue' | 'paid'>('outstanding');
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'balance-desc' | 'due-soon'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── State: Modals ──────────────────────────────────────────────────────────
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<VendorInvoice | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<ComputedVendorInvoice | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<ComputedVendorInvoice | null>(null);

  // ─── State: Vendor Directory Modal ──────────────────────────────────────────
  const [isVendorDirectoryOpen, setIsVendorDirectoryOpen] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorFormName, setVendorFormName] = useState('');
  const [vendorFormTin, setVendorFormTin] = useState('');
  const [vendorFormAddress, setVendorFormAddress] = useState('');
  const [vendorFormPhone, setVendorFormPhone] = useState('');
  const [vendorFormBankName, setVendorFormBankName] = useState('');
  const [vendorFormAccountNumber, setVendorFormAccountNumber] = useState('');
  const [vendorFormNotes, setVendorFormNotes] = useState('');

  // ─── Invoice Form State ─────────────────────────────────────────────────────
  const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';
  const [invVendorName, setInvVendorName] = useState('');
  const [invSelectedVendorId, setInvSelectedVendorId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDateReceived, setInvDateReceived] = useState(todayStr());
  const [invDueDate, setInvDueDate] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [invDocUrl, setInvDocUrl] = useState('');
  const [invDocName, setInvDocName] = useState('');
  const [invDocId, setInvDocId] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);

  // ─── Payment Form State (Simplified & Dual-Entry) ───────────────────────────
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [payFromBank, setPayFromBank] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [linkedLedgerId, setLinkedLedgerId] = useState('');
  const [isBrowsingLedger, setIsBrowsingLedger] = useState(false);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  // Detail-modal voucher picker state
  const [linkingPaymentId, setLinkingPaymentId] = useState<string | null>(null);
  const [linkingPaymentDate, setLinkingPaymentDate] = useState<string>('');
  const [linkingPaymentAmt, setLinkingPaymentAmt] = useState<number>(0);
  const [linkVoucherSearch, setLinkVoucherSearch] = useState('');
  // Detail-modal inline payment editor state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayAmt,  setEditPayAmt]  = useState('');
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayBank, setEditPayBank] = useState('');
  const [editPayNotes, setEditPayNotes] = useState('');

  // ─── Computations: Invoices with live balance & status ───────────────────────
  const invoicesWithBalance: ComputedVendorInvoice[] = useMemo(() => {
    return vendorInvoices.map((inv) => {
      const payments = vendorInvoicePayments.filter((p) => p.invoiceId === inv.id);
      const paid = payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
      const balance = Math.max(0, Number(inv.totalAmount || 0) - paid);
      const daysOverdue = inv.dueDate && inv.status !== 'paid' ? getDaysOverdue(inv.dueDate) : 0;
      const isOverdue = daysOverdue > 0 && balance > 0;

      let derivedStatus: VendorInvoice['status'] = 'unpaid';
      if (paid >= Number(inv.totalAmount || 0) && Number(inv.totalAmount || 0) > 0) {
        derivedStatus = 'paid';
      } else if (paid > 0) {
        derivedStatus = 'partial';
      }

      return {
        ...inv,
        paidAmount: paid,
        balanceRemaining: balance,
        derivedStatus,
        isOverdue,
        daysOverdue,
        paymentCount: payments.length,
      };
    });
  }, [vendorInvoices, vendorInvoicePayments]);

  // ─── Computations: High-level KPI summary ───────────────────────────────────
  const summary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    invoicesWithBalance.forEach((inv) => {
      totalInvoiced += Number(inv.totalAmount || 0);
      totalPaid += inv.paidAmount;
      totalOutstanding += inv.balanceRemaining;
      if (inv.isOverdue) {
        overdueCount += 1;
        overdueAmount += inv.balanceRemaining;
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      count: invoicesWithBalance.length,
    };
  }, [invoicesWithBalance]);

  // ─── Filtered & Sorted Invoices ──────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let list = invoicesWithBalance;

    // 1. Tab filter
    if (activeTab === 'outstanding') {
      list = list.filter((i) => i.derivedStatus !== 'paid');
    } else if (activeTab === 'overdue') {
      list = list.filter((i) => i.isOverdue);
    } else if (activeTab === 'paid') {
      list = list.filter((i) => i.derivedStatus === 'paid');
    }

    // 2. Vendor filter
    if (vendorFilter !== 'all') {
      list = list.filter((i) => i.vendorName.toLowerCase() === vendorFilter.toLowerCase());
    }

    // 3. Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((i) =>
        i.vendorName.toLowerCase().includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.notes && i.notes.toLowerCase().includes(q))
      );
    }

    // 4. Sorting
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime();
      if (sortBy === 'date-asc') return new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime();
      if (sortBy === 'amount-desc') return b.totalAmount - a.totalAmount;
      if (sortBy === 'amount-asc') return a.totalAmount - b.totalAmount;
      if (sortBy === 'balance-desc') return b.balanceRemaining - a.balanceRemaining;
      if (sortBy === 'due-soon') {
        const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dA - dB;
      }
      return 0;
    });

    return sorted;
  }, [invoicesWithBalance, activeTab, vendorFilter, searchTerm, sortBy]);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, vendorFilter, activeTab, pageSize]);

  // ─── Master Vendor List for Dropdown ────────────────────────────────────────
  const uniqueVendors = useMemo(() => {
    const set = new Set<string>();
    ledgerVendors.forEach((v) => { if (v.name) set.add(v.name.trim()); });
    vendorInvoices.forEach((v) => { if (v.vendorName) set.add(v.vendorName.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ledgerVendors, vendorInvoices]);

  // ─── Handlers: Add / Edit Invoice ───────────────────────────────────────────
  const handleOpenAddInvoice = () => {
    setEditingInvoice(null);
    setInvVendorName('');
    setInvSelectedVendorId('');
    setInvNumber('');
    setInvDateReceived(todayStr());
    setInvDueDate('');
    setInvAmount('');
    setInvDescription('');
    setInvNotes('');
    setInvDocUrl('');
    setInvDocName('');
    setInvDocId('');
    setIsInvoiceModalOpen(true);
  };

  // ─── Vendor Directory Handlers ──────────────────────────────────────────────
  const openNewVendorModal = () => {
    setEditingVendorId(null);
    setVendorFormName('');
    setVendorFormTin('');
    setVendorFormAddress('');
    setVendorFormPhone('');
    setVendorFormBankName('');
    setVendorFormAccountNumber('');
    setVendorFormNotes('');
    setIsVendorModalOpen(true);
  };

  const openEditVendorModal = (v: LedgerVendor) => {
    setEditingVendorId(v.id);
    setVendorFormName(v.name || '');
    setVendorFormTin(v.tinNumber || '');
    setVendorFormAddress(v.address || '');
    setVendorFormPhone(v.phone || '');
    setVendorFormBankName(v.bankName || '');
    setVendorFormAccountNumber(v.accountNumber || '');
    setVendorFormNotes(v.notes || '');
    setIsVendorModalOpen(true);
  };

  const handleSaveVendorModal = () => {
    const cleanName = vendorFormName.trim();
    if (!cleanName) {
      toast.error('Please enter a vendor name.');
      return;
    }

    if (!editingVendorId) {
      const exists = ledgerVendors.some((v) => v.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        toast.error(`Vendor "${cleanName}" already exists.`);
        return;
      }
      addLedgerVendor({
        id: generateId(),
        name: cleanName,
        tinNumber: vendorFormTin.trim() || undefined,
        address: vendorFormAddress.trim() || undefined,
        phone: vendorFormPhone.trim() || undefined,
        bankName: vendorFormBankName.trim() || undefined,
        accountNumber: vendorFormAccountNumber.trim() || undefined,
        notes: vendorFormNotes.trim() || undefined,
      });
      toast.success(`Vendor "${cleanName}" added to directory.`);
    } else {
      updateLedgerVendor(editingVendorId, {
        name: cleanName,
        tinNumber: vendorFormTin.trim() || undefined,
        address: vendorFormAddress.trim() || undefined,
        phone: vendorFormPhone.trim() || undefined,
        bankName: vendorFormBankName.trim() || undefined,
        accountNumber: vendorFormAccountNumber.trim() || undefined,
        notes: vendorFormNotes.trim() || undefined,
      });
      toast.success(`Vendor "${cleanName}" updated.`);
    }
    setIsVendorModalOpen(false);
  };

  const handleDeleteVendorDirectory = async (id: string, name: string) => {
    const invCount = vendorInvoices.filter(
      (i) => (i.vendorName || '').toLowerCase() === name.toLowerCase() || i.vendorId === id
    ).length;
    const ledgerCount = ledgerEntries.filter((l) => (l.vendor || '').toLowerCase() === name.toLowerCase()).length;
    const totalUsage = invCount + ledgerCount;

    if (totalUsage > 0) {
      toast.error(
        `Cannot delete: "${name}" is referenced in ${invCount > 0 ? `${invCount} invoice(s)` : ''}${
          invCount > 0 && ledgerCount > 0 ? ' and ' : ''
        }${ledgerCount > 0 ? `${ledgerCount} ledger record(s)` : ''}.`
      );
      return;
    }

    const ok = await showConfirm(`Are you sure you want to remove vendor "${name}" from the directory?`, {
      variant: 'danger',
      confirmLabel: 'Yes, Delete Vendor',
    });
    if (ok) {
      removeLedgerVendor(id);
      toast.success(`Vendor "${name}" removed.`);
    }
  };

  const sortedAndFilteredVendors = useMemo(() => {
    return [...ledgerVendors]
      .filter((v) => {
        if (!vendorSearchTerm.trim()) return true;
        const q = vendorSearchTerm.toLowerCase();
        return (
          (v.name || '').toLowerCase().includes(q) ||
          (v.tinNumber || '').toLowerCase().includes(q) ||
          (v.phone || '').toLowerCase().includes(q) ||
          (v.bankName || '').toLowerCase().includes(q) ||
          (v.accountNumber || '').toLowerCase().includes(q) ||
          (v.address || '').toLowerCase().includes(q) ||
          (v.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [ledgerVendors, vendorSearchTerm]);

  const headerButtons = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => setIsVendorDirectoryOpen(true)}
        className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80 font-semibold text-xs shadow-xs transition-all"
        title="Manage Vendor Directory"
      >
        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="hidden sm:inline">Vendor Directory</span>
        <span className="sm:hidden">Vendors</span>
        {ledgerVendors.length > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600">
            {ledgerVendors.length}
          </span>
        )}
      </Button>

      <Button
        onClick={handleOpenAddInvoice}
        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 dark:text-white font-bold shadow-sm transition-all flex items-center gap-1.5 px-3 sm:px-3.5 h-8 sm:h-9 rounded-lg text-xs"
      >
        <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
        <span>Add Invoice</span>
      </Button>
    </div>
  );

  useSetPageTitle('Vendor Invoices', '', headerButtons, [ledgerVendors.length]);

  const handleOpenEditInvoice = (inv: VendorInvoice) => {
    setEditingInvoice(inv);
    setInvVendorName(inv.vendorName || '');
    const matchedVendor = uniqueVendors.find(
      (v) => v.toLowerCase() === (inv.vendorName || '').trim().toLowerCase()
    );
    setInvSelectedVendorId(matchedVendor || (inv.vendorName ? '__custom__' : ''));
    setInvNumber(inv.invoiceNumber);
    setInvDateReceived(inv.dateReceived);
    setInvDueDate(inv.dueDate || '');
    setInvAmount(String(inv.totalAmount));
    setInvDescription(inv.description);
    setInvNotes(inv.notes || '');
    setInvDocUrl(inv.documentUrl || '');
    setInvDocName(inv.documentName || '');
    setInvDocId(inv.documentId || '');
    setIsInvoiceModalOpen(true);
  };

  const deleteMediaFileFromServer = async (docUrl?: string, docId?: string | number, invoiceId?: string) => {
    const targetId = docId ? Number(docId) : null;
    if (targetId && !isNaN(targetId)) {
      try {
        await fetch(`${MEDIA_SERVER_URL}/delete.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId }),
        });
        return;
      } catch (e) {
        console.warn('Failed to delete media by ID:', e);
      }
    }

    // Fallback: If no direct ID was stored, query list.php using the invoice journal/site ID
    if (docUrl) {
      try {
        const queryId = invoiceId || 'INVOICE';
        const listRes = await fetch(`${MEDIA_SERVER_URL}/list.php?journal_id=${queryId}`);
        if (listRes.ok) {
          const list = await listRes.json();
          if (Array.isArray(list)) {
            const matched = list.find(
              (m: any) => m.url === docUrl || (m.file_name && docUrl.endsWith(m.file_name))
            );
            if (matched && matched.id) {
              await fetch(`${MEDIA_SERVER_URL}/delete.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: Number(matched.id) }),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Fallback media server deletion failed:', err);
      }
    }
  };

  const handleRemoveFormDocument = async () => {
    if (!invDocUrl) return;

    const confirmed = await showConfirm(
      'Are you sure you want to delete this document? This will permanently remove the file from the media server.',
      {
        title: 'Delete Document',
        variant: 'danger',
        confirmLabel: 'Yes, Delete',
        cancelLabel: 'Cancel',
      }
    );

    if (!confirmed) return;

    try {
      await deleteMediaFileFromServer(invDocUrl, invDocId, editingInvoice?.id);
      setInvDocUrl('');
      setInvDocName('');
      setInvDocId('');
      if (editingInvoice) {
        updateVendorInvoice(editingInvoice.id, {
          documentUrl: undefined,
          documentName: undefined,
          documentId: undefined,
        });
      }
      toast.success('Document deleted successfully.');
    } catch {
      toast.error('Failed to delete document from server.');
    }
  };

  const handleRemoveDetailDocument = async () => {
    if (!detailInvoiceComputed?.documentUrl) return;

    const confirmed = await showConfirm(
      'Are you sure you want to delete this document? This will permanently remove the file from the media server.',
      {
        title: 'Delete Document',
        variant: 'danger',
        confirmLabel: 'Yes, Delete',
        cancelLabel: 'Cancel',
      }
    );

    if (!confirmed) return;

    try {
      await deleteMediaFileFromServer(
        detailInvoiceComputed.documentUrl,
        detailInvoiceComputed.documentId,
        detailInvoiceComputed.id
      );
      updateVendorInvoice(detailInvoiceComputed.id, {
        documentUrl: undefined,
        documentName: undefined,
        documentId: undefined,
      });
      if (editingInvoice?.id === detailInvoiceComputed.id) {
        setInvDocUrl('');
        setInvDocName('');
        setInvDocId('');
      }
      toast.success('Document deleted successfully.');
    } catch {
      toast.error('Failed to delete document from server.');
    }
  };

  const handleUploadInvoiceDocument = async (
    file: File,
    invoiceId?: string,
    invoiceContext?: { number?: string; vendor?: string; date?: string }
  ) => {
    if (!file) return;
    setIsUploadingDoc(true);

    // Resolve context: prefer explicitly passed context, then fall back to form state
    const ctxNumber = invoiceContext?.number || invNumber.trim();
    const ctxVendor = invoiceContext?.vendor || invVendorName.trim();
    const ctxDate   = invoiceContext?.date   || invDateReceived || new Date().toISOString().split('T')[0];
    const resolvedId = invoiceId || editingInvoice?.id || '';

    // Route images to upload.php and documents (.pdf, .doc, .docx) to upload_doc.php
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
    const endpoint = isImage ? `${MEDIA_SERVER_URL}/upload.php` : `${MEDIA_SERVER_URL}/upload_doc.php`;

    const fd = new FormData();
    fd.append('media', file);
    fd.append('site_id', resolvedId || 'INVOICE');
    fd.append('journal_id', resolvedId || 'INVOICE');
    fd.append('asset_id', '0');
    fd.append('site_name', ctxVendor || ctxNumber || 'Vendor Invoice');
    fd.append('log_date', ctxDate);
    fd.append('uploaded_by', currentUser?.id || 'unknown');
    fd.append('uploaded_by_name', currentUser?.name || 'Unknown');
    if (ctxNumber) {
      fd.append('asset_name', `Invoice ${ctxNumber}`);
    }

    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${res.status}`);
      }
      const json = await res.json();
      const url = json.url || json.file_url || '';
      if (!url) throw new Error('No URL returned from upload server');
      const docServerId = json.id ? String(json.id) : '';

      setInvDocUrl(url);
      setInvDocName(file.name);
      if (docServerId) {
        setInvDocId(docServerId);
      }
      if (resolvedId) {
        updateVendorInvoice(resolvedId, {
          documentUrl: url,
          documentName: file.name,
          documentId: docServerId || undefined,
        });
      }
      toast.success(isImage ? 'Invoice image uploaded successfully.' : 'Invoice document uploaded successfully.');
    } catch (err: any) {
      toast.error(`Failed to upload document: ${err.message}`);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSaveInvoice = () => {
    if (!invVendorName.trim()) {
      toast.error('Please specify the vendor name.');
      return;
    }
    if (!invNumber.trim()) {
      toast.error('Please enter the invoice number.');
      return;
    }
    const amt = parseFloat(invAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid invoice total amount greater than zero.');
      return;
    }
    if (!invDescription.trim()) {
      toast.error('Please provide a description of the service or items.');
      return;
    }

    const cleanVendor = invVendorName.trim();
    // Check if this vendor is already in the Vendor Directory (ledgerVendors)
    const existingVendor = ledgerVendors.find(
      (v) => v.name.trim().toLowerCase() === cleanVendor.toLowerCase()
    );
    let finalVendorId = existingVendor ? existingVendor.id : (editingInvoice?.vendorId || '');
    if (!finalVendorId) {
      // Automatically save new vendor to the Vendor Directory (persisted to Supabase & store)
      const newVendorId = crypto.randomUUID();
      addLedgerVendor({ id: newVendorId, name: cleanVendor });
      finalVendorId = newVendorId;
      toast.success(`Saved "${cleanVendor}" to Vendor Directory.`);
    }

    if (editingInvoice) {
      updateVendorInvoice(editingInvoice.id, {
        vendorName: cleanVendor,
        vendorId: finalVendorId || cleanVendor,
        invoiceNumber: invNumber.trim(),
        dateReceived: invDateReceived,
        dueDate: invDueDate || undefined,
        totalAmount: amt,
        description: invDescription.trim(),
        notes: invNotes.trim() || undefined,
        documentUrl: invDocUrl || undefined,
        documentName: invDocName || undefined,
        documentId: invDocId || undefined,
      });
      toast.success('Vendor invoice updated successfully.');
    } else {
      const newInv: VendorInvoice = {
        id: crypto.randomUUID(),
        workspaceId: ws,
        vendorName: cleanVendor,
        vendorId: finalVendorId || cleanVendor,
        invoiceNumber: invNumber.trim(),
        dateReceived: invDateReceived,
        dueDate: invDueDate || undefined,
        totalAmount: amt,
        description: invDescription.trim(),
        notes: invNotes.trim() || undefined,
        documentUrl: invDocUrl || undefined,
        documentName: invDocName || undefined,
        documentId: invDocId || undefined,
        status: 'unpaid',
        enteredBy: currentUser?.name || 'User',
        createdAt: new Date().toISOString(),
      };
      addVendorInvoice(newInv);
      toast.success('Vendor invoice recorded.');
    }

    setIsInvoiceModalOpen(false);
  };

  const handleDeleteInvoice = async (inv: VendorInvoice) => {
    if (!priv?.canDelete) {
      toast.error('You do not have permission to delete invoice records.');
      return;
    }
    const confirmed = await showConfirm(
      `Delete invoice #${inv.invoiceNumber} from ${inv.vendorName}?\nThis will also delete any recorded payment history for this invoice.`,
      { variant: 'danger', confirmLabel: 'Yes, Delete Invoice' }
    );
    if (confirmed) {
      if (inv.documentUrl || inv.documentId) {
        deleteMediaFileFromServer(inv.documentUrl, inv.documentId, inv.id);
      }
      deleteVendorInvoice(inv.id);
      if (detailInvoice?.id === inv.id) setIsDetailModalOpen(false);
      toast.success('Invoice deleted.');
    }
  };

  // ─── Live Payment-Driven Ledger Matches ──────────────────────────────────────
  // Evaluates in real-time based on what the user types into the payment form!
  const livePaymentMatches = useMemo(() => {
    if (!isPaymentModalOpen || !payingInvoice) return [];
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return [];

    return findLedgerMatchesForPayment(
      {
        amount: amt,
        date: payDate,
        bank: payFromBank,
        notes: payNotes,
        vendorName: payingInvoice.vendorName,
        invoiceNumber: payingInvoice.invoiceNumber,
      },
      ledgerEntries,
      vendorInvoicePayments
    );
  }, [isPaymentModalOpen, payingInvoice, payAmount, payDate, payFromBank, payNotes, ledgerEntries, vendorInvoicePayments]);

  // Browseable/Searchable paid ledger transactions
  const availableLedgerEntries = useMemo(() => {
    if (!isBrowsingLedger) return [];
    const q = ledgerSearchQuery.trim().toLowerCase();
    const linkedSet = new Set(
      vendorInvoicePayments
        .filter((p) => p.ledgerEntryId)
        .map((p) => String(p.ledgerEntryId).trim().toLowerCase())
    );

    const vendorNameLower = payingInvoice?.vendorName?.trim().toLowerCase() || '';
    const amtNum = parseFloat(payAmount);

    return ledgerEntries
      .filter((e) => {
        const vNo = String(e.voucherNo || '').trim().toLowerCase();
        const eId = String(e.id || '').trim().toLowerCase();
        // Skip already linked entries (unless it's the one currently linked in this session)
        if (linkedLedgerId !== vNo && linkedLedgerId !== eId) {
          if ((vNo && linkedSet.has(vNo)) || (eId && linkedSet.has(eId))) return false;
        }

        if (q) {
          const amtStr = String(e.amount || '');
          const dateStr = String(e.date || '').toLowerCase();
          const formattedDateStr = formatDateDisplay(e.date).toLowerCase();
          return (
            vNo.includes(q) ||
            eId.includes(q) ||
            amtStr.includes(q) ||
            dateStr.includes(q) ||
            formattedDateStr.includes(q) ||
            (e.vendor || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q) ||
            (e.bank || '').toLowerCase().includes(q)
          );
        }

        // If no query, only show entries matching this vendor or exact payment amount
        if (vendorNameLower && (e.vendor || '').toLowerCase().includes(vendorNameLower)) {
          return true;
        }
        if (!isNaN(amtNum) && amtNum > 0 && Math.abs(Number(e.amount) - amtNum) < 0.05) {
          return true;
        }

        return false;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [ledgerEntries, vendorInvoicePayments, ledgerSearchQuery, payingInvoice, linkedLedgerId, isBrowsingLedger, payAmount]);

  // ─── Handlers: Record Payment & Dual Filling ────────────────────────────────
  const handleOpenRecordPayment = (inv: ComputedVendorInvoice, preselectedLedger?: LedgerEntry) => {
    setPayingInvoice(inv);
    setIsBrowsingLedger(false);
    setLedgerSearchQuery('');

    // If a preselected ledger entry was explicitly provided
    if (preselectedLedger) {
      setPayAmount(String(preselectedLedger.amount));
      setPayDate(preselectedLedger.date || todayStr());
      setPayFromBank(preselectedLedger.bank || ledgerBanks[0]?.name || '');
      setPayNotes(
        preselectedLedger.description
          ? `Voucher #${preselectedLedger.voucherNo || preselectedLedger.id}: ${preselectedLedger.description}`
          : `Payment for ${inv.vendorName} (Inv #${inv.invoiceNumber})`
      );
      setLinkedLedgerId(preselectedLedger.voucherNo || preselectedLedger.id);
      setIsPaymentModalOpen(true);
      return;
    }

    // Default clean form: do NOT prematurely guess or force a ledger link!
    setPayAmount(inv.balanceRemaining > 0 ? String(inv.balanceRemaining) : '');
    setPayDate(todayStr());
    setPayFromBank(ledgerBanks[0]?.name || '');
    setPayNotes(`Payment for ${inv.vendorName} (Inv #${inv.invoiceNumber})`);
    setLinkedLedgerId('');
    setIsPaymentModalOpen(true);
  };

  const handleApplyLedgerEntry = (entry: LedgerEntry) => {
    setPayAmount(String(entry.amount));
    if (entry.date) setPayDate(entry.date);
    if (entry.bank) setPayFromBank(entry.bank);
    setPayNotes(
      entry.description
        ? `Voucher #${entry.voucherNo || entry.id}: ${entry.description}`
        : `Payment for ${payingInvoice?.vendorName} (Inv #${payingInvoice?.invoiceNumber})`
    );
    setLinkedLedgerId(entry.voucherNo || entry.id);
    setIsBrowsingLedger(false);
    toast.success(`Auto-filled & linked from Ledger Voucher #${entry.voucherNo || entry.id}`);
  };

  const handleUnlinkLedger = () => {
    setLinkedLedgerId('');
    toast.info('Switched to manual payment entry.');
  };

  const handleSavePayment = () => {
    if (!payingInvoice) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount greater than zero.');
      return;
    }

    const currentBalance =
      payingInvoice.totalAmount -
      vendorInvoicePayments
        .filter((p) => p.invoiceId === payingInvoice.id)
        .reduce((s, p) => s + Number(p.amountPaid || 0), 0);

    if (amt > currentBalance + 0.01) {
      toast.error(`Payment cannot exceed outstanding balance of ₦${fmt(currentBalance)}.`);
      return;
    }

    if (!payFromBank.trim()) {
      toast.error('Please select the company bank account paid from.');
      return;
    }

    const newPaymentId = crypto.randomUUID();
    const newPayment: VendorInvoicePayment = {
      id: newPaymentId,
      workspaceId: ws,
      invoiceId: payingInvoice.id,
      paymentDate: payDate,
      amountPaid: amt,
      paidFromBank: payFromBank.trim(),
      notes: payNotes.trim() || undefined,
      ledgerEntryId: linkedLedgerId ? String(linkedLedgerId) : undefined,
      enteredBy: currentUser?.name || 'User',
      createdAt: new Date().toISOString(),
    };

    // 1. Record payment in store and Supabase
    addVendorInvoicePayment(newPayment);

    // 2. Update invoice status
    const newTotalPaid =
      vendorInvoicePayments
        .filter((p) => p.invoiceId === payingInvoice.id)
        .reduce((s, p) => s + Number(p.amountPaid || 0), 0) + amt;

    const newStatus: VendorInvoice['status'] =
      newTotalPaid >= payingInvoice.totalAmount - 0.01 ? 'paid' : 'partial';

    updateVendorInvoice(payingInvoice.id, { status: newStatus });

    if (linkedLedgerId) {
      toast.success(`Payment of ₦${fmt(amt)} recorded and verified via Ledger Voucher #${linkedLedgerId}.`);
    } else {
      toast.success(`Payment of ₦${fmt(amt)} recorded successfully.`);
    }

    setIsPaymentModalOpen(false);
  };

  const handleLinkExistingPaymentToLedger = (paymentId: string, voucherNo: string) => {
    if (!voucherNo.trim()) return;
    updateVendorInvoicePayment(paymentId, { ledgerEntryId: voucherNo.trim() });
    toast.success(`Payment linked to Ledger Voucher #${voucherNo.trim()}.`);
  };

  const handleUnlinkExistingPayment = (paymentId: string) => {
    updateVendorInvoicePayment(paymentId, { ledgerEntryId: undefined });
    toast.info('Payment unlinked from Ledger.');
  };

  const handleDeletePayment = async (paymentId: string, invoiceId: string) => {
    if (!priv?.canDelete) {
      toast.error('You do not have permission to delete payments.');
      return;
    }
    const confirmed = await showConfirm('Are you sure you want to delete this payment record? The balance will be restored.', {
      variant: 'danger',
      confirmLabel: 'Yes, Delete Payment',
    });
    if (confirmed) {
      deleteVendorInvoicePayment(paymentId);
      // recalculate status
      const remainingPayments = vendorInvoicePayments.filter((p) => p.invoiceId === invoiceId && p.id !== paymentId);
      const remainingPaid = remainingPayments.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
      const inv = vendorInvoices.find((i) => i.id === invoiceId);
      if (inv) {
        const nextStatus: VendorInvoice['status'] = remainingPaid <= 0 ? 'unpaid' : (remainingPaid >= inv.totalAmount - 0.01 ? 'paid' : 'partial');
        updateVendorInvoice(invoiceId, { status: nextStatus });
      }
      toast.success('Payment removed.');
    }
  };

  const handleSaveEditedPayment = (paymentId: string, invoiceId: string) => {
    const amt = parseFloat(editPayAmt);
    if (isNaN(amt) || amt <= 0) { toast.error('Please enter a valid payment amount.'); return; }
    if (!editPayDate) { toast.error('Please select a payment date.'); return; }
    if (!editPayBank.trim()) { toast.error('Please select the bank paid from.'); return; }

    updateVendorInvoicePayment(paymentId, {
      amountPaid:   amt,
      paymentDate:  editPayDate,
      paidFromBank: editPayBank.trim(),
      notes:        editPayNotes.trim() || undefined,
    });

    // Recalculate invoice status based on new totals
    const otherPayments = vendorInvoicePayments.filter((p) => p.invoiceId === invoiceId && p.id !== paymentId);
    const newTotal = otherPayments.reduce((s, p) => s + Number(p.amountPaid || 0), 0) + amt;
    const inv = vendorInvoices.find((i) => i.id === invoiceId);
    if (inv) {
      const nextStatus: VendorInvoice['status'] =
        newTotal >= Number(inv.totalAmount) - 0.01 ? 'paid' : newTotal > 0 ? 'partial' : 'unpaid';
      updateVendorInvoice(invoiceId, { status: nextStatus });
    }

    toast.success('Payment updated successfully.');
    setEditingPaymentId(null);
  };

  // ─── Detail view payments ───────────────────────────────────────────────────
  const detailPayments = useMemo(() => {
    if (!detailInvoice) return [];
    return vendorInvoicePayments
      .filter((p) => p.invoiceId === detailInvoice.id)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [detailInvoice, vendorInvoicePayments]);

  const detailInvoiceComputed = useMemo(() => {
    if (!detailInvoice) return null;
    return invoicesWithBalance.find((i) => i.id === detailInvoice.id) || detailInvoice;
  }, [detailInvoice, invoicesWithBalance]);

  // ── Ledger entries available for linking in the detail modal ─────────────────
  // Sorted by proximity to the payment's own date, so the most likely match
  // (same transaction date, same amount) appears at the top automatically.
  const detailModalLedgerEntries = useMemo(() => {
    if (!linkingPaymentId) return [];
    const linkedSet = new Set(
      vendorInvoicePayments
        .filter((p) => p.ledgerEntryId && p.id !== linkingPaymentId)
        .map((p) => String(p.ledgerEntryId).trim().toLowerCase())
    );
    const q = linkVoucherSearch.trim().toLowerCase();
    const paymentTime = linkingPaymentDate
      ? new Date(linkingPaymentDate + 'T00:00:00').getTime()
      : NaN;

    return ledgerEntries
      .filter((e) => {
        const vNo = String(e.voucherNo || '').trim().toLowerCase();
        const eId = String(e.id || '').trim().toLowerCase();
        if ((vNo && linkedSet.has(vNo)) || (eId && linkedSet.has(eId))) return false;
        if (!q) return true;
        // Transaction date is the primary search anchor
        return (
          (e.date || '').toLowerCase().includes(q) ||
          formatDateDisplay(e.date).toLowerCase().includes(q) ||
          String(e.amount || '').includes(q) ||
          (e.vendor || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.bank || '').toLowerCase().includes(q) ||
          vNo.includes(q) ||
          eId.includes(q)
        );
      })
      .sort((a, b) => {
        // When no search: sort by proximity to the payment's own date
        if (!q && !isNaN(paymentTime)) {
          const aDiff = Math.abs(new Date(a.date).getTime() - paymentTime);
          const bDiff = Math.abs(new Date(b.date).getTime() - paymentTime);
          if (aDiff !== bDiff) return aDiff - bDiff;
          // Tiebreak: exact amount match first
          const aAmt = Math.abs(Number(a.amount) - linkingPaymentAmt);
          const bAmt = Math.abs(Number(b.amount) - linkingPaymentAmt);
          return aAmt - bAmt;
        }
        // When searching: most recent first
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 15);
  }, [linkingPaymentId, linkingPaymentDate, linkingPaymentAmt, linkVoucherSearch, ledgerEntries, vendorInvoicePayments]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-2.5 sm:p-4 space-y-2">
      {/* ── Compact Inline KPI Strip ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
          {/* Total Invoiced */}
          <div className="flex items-center gap-2.5 px-3.5 py-2">
            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-0.5">Invoiced</p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">₦{fmt(summary.totalInvoiced)}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.2">{summary.count} total</p>
            </div>
          </div>

          {/* Total Paid */}
          <div className="flex items-center gap-2.5 px-3.5 py-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-0.5">Paid Out</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-tight">₦{fmt(summary.totalPaid)}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.2">
                {summary.totalInvoiced > 0 ? Math.round((summary.totalPaid / summary.totalInvoiced) * 100) : 0}% settled
              </p>
            </div>
          </div>

          {/* Balance Owed */}
          <div className="flex items-center gap-2.5 px-3.5 py-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-0.5">Balance Owed</p>
              <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 leading-tight">₦{fmt(summary.totalOutstanding)}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.2">outstanding</p>
            </div>
          </div>

          {/* Overdue */}
          <div className="flex items-center gap-2.5 px-3.5 py-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${summary.overdueCount > 0 ? 'bg-rose-50 dark:bg-rose-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <AlertTriangle className={`w-3 h-3 ${summary.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">Overdue</p>
                {summary.overdueCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <p className={`text-xs sm:text-sm font-bold leading-tight ${summary.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                ₦{fmt(summary.overdueAmount)}
              </p>
              <p className={`text-[9px] mt-0.2 ${summary.overdueCount > 0 ? 'text-rose-500 dark:text-rose-400 font-medium' : 'text-slate-400'}`}>
                {summary.overdueCount} overdue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Filters, Search & View Controls ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-2.5 sm:p-3 space-y-2.5">
        
        {/* Status Tab Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('outstanding')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'outstanding'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Outstanding ({invoicesWithBalance.filter((i) => i.derivedStatus !== 'paid').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Invoices ({invoicesWithBalance.length})
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'overdue'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              Overdue ({summary.overdueCount})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'paid'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              Fully Paid ({invoicesWithBalance.filter((i) => i.derivedStatus === 'paid').length})
            </button>
          </div>

          {/* Quick Page Size */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-700 dark:text-slate-300"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* Search, Vendor Filter, and Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor, invoice #, description..."
              className="pl-8 pr-7 text-xs h-8 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Vendor Filter */}
          <div className="sm:col-span-4">
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:bg-white"
            >
              <option value="all">All Vendors</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:bg-white"
            >
              <option value="date-desc">Date (Newest first)</option>
              <option value="date-asc">Date (Oldest first)</option>
              <option value="balance-desc">Balance Due (High to Low)</option>
              <option value="amount-desc">Amount (High to Low)</option>
              <option value="due-soon">Due Date (Soonest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 4. Main Data Table ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80">
              <TableRow className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <TableHead className="py-2 px-4 w-[280px]">Vendor & Invoice</TableHead>
                <TableHead className="py-2 px-4">Date Received</TableHead>
                <TableHead className="py-2 px-4">Due Date</TableHead>
                <TableHead className="py-2 px-4 text-right">Total (₦)</TableHead>
                <TableHead className="py-2 px-4 text-right">Paid (₦)</TableHead>
                <TableHead className="py-2 px-4 text-right">Balance Due (₦)</TableHead>
                <TableHead className="py-2 px-4 text-center">Status</TableHead>
                <TableHead className="py-2 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <Receipt className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        No vendor invoices found
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchTerm || vendorFilter !== 'all' || activeTab !== 'all'
                          ? 'Try clearing your search or status filter'
                          : 'Click "+ Add Invoice" to record your first vendor bill'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInvoices.map((inv) => {
                  const percentPaid = inv.totalAmount > 0 ? Math.min(100, Math.round((inv.paidAmount / inv.totalAmount) * 100)) : 0;
                  return (
                    <TableRow
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => {
                        setDetailInvoice(inv);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      {/* Vendor & Invoice info */}
                      <TableCell className="py-2 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {inv.vendorName}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              #{inv.invoiceNumber}
                            </span>
                            {inv.documentUrl && (
                              <button
                                type="button"
                                title="Click to preview invoice document"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewDoc({
                                    url: inv.documentUrl!,
                                    name: inv.documentName || `Invoice #${inv.invoiceNumber}`,
                                  });
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 transition-colors"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>Doc</span>
                              </button>
                            )}
                            <span className="text-xs text-slate-500 truncate max-w-[160px]">
                              {inv.description}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Date Received */}
                      <TableCell className="py-2 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateDisplay(inv.dateReceived)}
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className="py-2 px-4 text-xs whitespace-nowrap">
                        {inv.dueDate ? (
                          <div className="flex flex-col">
                            <span className={inv.isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                              {formatDateDisplay(inv.dueDate)}
                            </span>
                            {inv.isOverdue && (
                              <span className="text-[10px] text-rose-500 font-medium">
                                {inv.daysOverdue}d overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">No due date</span>
                        )}
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="py-2 px-4 text-right font-medium text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        ₦{fmt(inv.totalAmount)}
                      </TableCell>

                      {/* Paid Amount & Mini Progress */}
                      <TableCell className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            ₦{fmt(inv.paidAmount)}
                          </span>
                          <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* Balance Due */}
                      <TableCell className="py-2 px-4 text-right whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            inv.balanceRemaining > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          ₦{fmt(inv.balanceRemaining)}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2 px-4 text-center whitespace-nowrap">
                        <InvoiceStatusBadge status={inv.derivedStatus} isOverdue={inv.isOverdue} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.balanceRemaining > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRecordPayment(inv)}
                              className="h-7 px-2.5 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs"
                            >
                              <CreditCard className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                              Pay
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 text-xs">
                              <DropdownMenuItem
                                onClick={() => {
                                  setDetailInvoice(inv);
                                  setIsDetailModalOpen(true);
                                }}
                              >
                                <FileText className="w-3.5 h-3.5 mr-2 text-slate-500" /> View History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEditInvoice(inv)}>
                                <Pencil className="w-3.5 h-3.5 mr-2 text-slate-500" /> Edit Invoice
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteInvoice(inv)}
                                className="text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Invoice
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── 5. Pagination Bar ────────────────────────────────────────────── */}
        {filteredInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(currentPage * pageSize, filteredInvoices.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredInvoices.length}</span> invoices
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <span key={p} className="flex items-center">
                        {prev && p - prev > 1 && <span className="px-1 text-slate-400">…</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                            currentPage === p
                              ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white font-bold shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Dialog: Add / Edit Invoice ──────────────────────────────────── */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              {editingInvoice ? 'Edit Vendor Invoice' : 'Record New Vendor Invoice'}
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter invoice details received from your vendor for goods or services rendered.
            </p>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
            {/* Vendor Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Vendor Name <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2">
                <select
                  value={
                    uniqueVendors.includes(invSelectedVendorId)
                      ? invSelectedVendorId
                      : (uniqueVendors.find(v => v.toLowerCase() === (invVendorName || '').trim().toLowerCase()) || (invVendorName ? '__custom__' : ''))
                  }
                  onChange={(e) => {
                    const sel = e.target.value;
                    setInvSelectedVendorId(sel);
                    if (sel && sel !== '__custom__') {
                      setInvVendorName(sel);
                    } else if (sel === '__custom__') {
                      setInvVendorName('');
                    }
                  }}
                  className="w-full text-xs h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">-- Choose from existing vendors --</option>
                  {uniqueVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value="__custom__">+ Type a new vendor name</option>
                </select>

                {(invSelectedVendorId === '__custom__' || !invSelectedVendorId || !uniqueVendors.some(v => v.toLowerCase() === (invVendorName || '').trim().toLowerCase())) && (
                  <Input
                    placeholder="Or type vendor name..."
                    value={invVendorName}
                    onChange={(e) => setInvVendorName(e.target.value)}
                    className="text-xs h-9"
                  />
                )}
              </div>
            </div>

            {/* Invoice Number & Date Received */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. INV-2026-081"
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Date Received <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={invDateReceived}
                  onChange={(e) => setInvDateReceived(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Total Amount & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Total Amount (₦) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="text-xs h-9 font-semibold text-slate-900 dark:text-slate-100"
                />
                {invAmount && !isNaN(parseFloat(invAmount)) && (
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ₦{fmt(parseFloat(invAmount))}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Due Date (Optional)
                </label>
                <Input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Description / Service */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description / Service Rendered <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Generator diesel supply 1,000L or Office plumbing repairs"
                value={invDescription}
                onChange={(e) => setInvDescription(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Internal Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Purchase order reference, terms, approval notes..."
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 resize-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Invoice Document Upload */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Invoice Document / Receipt <span className="text-[11px] font-normal text-slate-400">(optional)</span></span>
                {invDocUrl && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Attached
                  </span>
                )}
              </label>

              {invDocUrl ? (
                <div className="space-y-2">
                  {/* If image, display preview directly above the file bar */}
                  {['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].some(ext => (invDocName || invDocUrl || '').toLowerCase().includes(ext)) && (
                    <div
                      onClick={() => setPreviewDoc({ url: invDocUrl, name: invDocName || 'Invoice Document' })}
                      className="group/img relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-2 flex items-center justify-center max-h-52 hover:border-blue-400 hover:shadow-md transition-all"
                      title="Click to enlarge preview"
                    >
                      <img
                        src={invDocUrl}
                        alt="Document Preview"
                        className="max-h-48 w-auto object-contain rounded-lg transition-transform duration-200 group-hover/img:scale-[1.02]"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                        <span className="bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs font-medium">
                          <Eye className="w-3.5 h-3.5" /> Click to enlarge
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                          {invDocName || 'Invoice Document'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({ url: invDocUrl, name: invDocName || 'Invoice Document' })}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Eye className="w-3 h-3" /> Click to preview
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <label className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Replace
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadInvoiceDocument(file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveFormDocument}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Remove document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-xl cursor-pointer transition-colors ${
                  isUploadingDoc
                    ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/30'
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    disabled={isUploadingDoc}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadInvoiceDocument(file);
                    }}
                  />
                  {isUploadingDoc ? (
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading document to server...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span><strong className="text-blue-600 dark:text-blue-400 font-medium">Click to upload</strong> invoice document, photo, or PDF</span>
                    </div>
                  )}
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInvoiceModalOpen(false)}
              className="text-xs h-9 px-4 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveInvoice}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 dark:text-white text-xs h-9 px-5 font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              {editingInvoice ? 'Save Changes' : 'Record Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 7. Dialog: Record Payment (Minimalist & Succinct) ────────────── */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Record Vendor Payment
              </DialogTitle>
              {payingInvoice && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  #{payingInvoice.invoiceNumber}
                </span>
              )}
            </div>
            {payingInvoice && (
              <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                  {payingInvoice.vendorName}
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  Balance: ₦{fmt(payingInvoice.balanceRemaining)}
                </span>
              </div>
            )}
          </DialogHeader>

          {payingInvoice && (
            <div className="p-6 space-y-4">
              {/* Payment Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Amount (₦) <span className="text-rose-500">*</span>
                  </label>
                  {payingInvoice.balanceRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(payingInvoice.balanceRemaining))}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Pay Full (₦{fmt(payingInvoice.balanceRemaining)})
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="text-base font-bold h-9 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* Payment Date & Paid From Bank (2 columns) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="text-xs h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paid From (Bank) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={payFromBank}
                    onChange={(e) => setPayFromBank(e.target.value)}
                    className="w-full text-xs h-9 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Bank...</option>
                    {ledgerBanks.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference / Memo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Memo <span className="text-[11px] font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. Transfer note, cheque #, or session ID"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="text-xs h-8.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Linked Ledger Status or Suggestion (Single compact row) */}
              {linkedLedgerId ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200 font-medium truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Linked to Ledger Voucher <strong>#{linkedLedgerId}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkLedger}
                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold shrink-0 ml-2"
                  >
                    Unlink
                  </button>
                </div>
              ) : livePaymentMatches.length > 0 ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">
                      Found Voucher <strong>#{livePaymentMatches[0].entry.voucherNo}</strong> (₦{fmt(livePaymentMatches[0].entry.amount)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const m = livePaymentMatches[0].entry;
                      setLinkedLedgerId(m.voucherNo || m.id);
                      if (!payFromBank && m.bank) setPayFromBank(m.bank);
                      toast.success(`Linked to Voucher #${m.voucherNo || m.id}`);
                    }}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
                  >
                    Link
                  </button>
                </div>
              ) : null}

              {/* Optional Manual Ledger Link Accordion */}
              {!linkedLedgerId && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBrowsingLedger(!isBrowsingLedger)}
                    className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Link2 className="w-3 h-3" />
                    {isBrowsingLedger ? 'Close Ledger Search' : 'Link to a Ledger Voucher manually...'}
                  </button>

                  {isBrowsingLedger && (
                    <div className="mt-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="text"
                          value={ledgerSearchQuery}
                          onChange={(e) => setLedgerSearchQuery(e.target.value)}
                          placeholder="Search voucher #, amount, vendor, date..."
                          className="pl-7 pr-7 text-xs h-7.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        />
                        {ledgerSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setLedgerSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {availableLedgerEntries.length === 0 ? (
                          <div className="p-2.5 text-center text-slate-400 text-[11px] italic">
                            {ledgerSearchQuery ? 'No matching ledger records found.' : 'Type above to search ledger vouchers.'}
                          </div>
                        ) : (
                          availableLedgerEntries.map((le) => (
                            <div key={le.id} className="py-1.5 px-1 flex items-center justify-between gap-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">#{le.voucherNo || le.id}</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">₦{fmt(le.amount)}</span>
                                  <span className="text-slate-400 text-[10px]">{formatDateDisplay(le.date)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{le.vendor ? `${le.vendor} · ` : ''}{le.description || 'No description'}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleApplyLedgerEntry(le)}
                                className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shrink-0 shadow-none"
                              >
                                Link
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentModalOpen(false)}
              className="text-xs h-9 px-4 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold w-full sm:w-auto"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleSavePayment}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white text-xs h-9 px-5 font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-sm transition-all"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 8. Dialog: Invoice Detail & Payment History ────────────────────── */}
      <Dialog open={isDetailModalOpen} onOpenChange={(open) => { setIsDetailModalOpen(open); if (!open) { setLinkingPaymentId(null); setLinkingPaymentDate(''); setLinkingPaymentAmt(0); setLinkVoucherSearch(''); } }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {detailInvoiceComputed && (
            <>
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                        #{detailInvoiceComputed.invoiceNumber}
                      </span>
                      <InvoiceStatusBadge
                        status={detailInvoiceComputed.derivedStatus}
                        isOverdue={detailInvoiceComputed.isOverdue}
                      />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {detailInvoiceComputed.vendorName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{detailInvoiceComputed.description}</p>
                  </div>

                  {detailInvoiceComputed.balanceRemaining > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenRecordPayment(detailInvoiceComputed);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white text-xs h-8 px-3 font-bold shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Payment
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Financial Summary Card */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Invoiced</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      ₦{fmt(detailInvoiceComputed.totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Paid</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₦{fmt(detailInvoiceComputed.paidAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining Balance</span>
                    <span
                      className={`text-sm font-bold ${
                        detailInvoiceComputed.balanceRemaining > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      ₦{fmt(detailInvoiceComputed.balanceRemaining)}
                    </span>
                  </div>
                </div>

                {/* Timeline / Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date Received</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatDateDisplay(detailInvoiceComputed.dateReceived)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Due Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatDateDisplay(detailInvoiceComputed.dueDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Entered By</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {detailInvoiceComputed.enteredBy}
                    </span>
                  </div>
                </div>

                {detailInvoiceComputed.notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 block text-[10px] uppercase mb-0.5">Notes</span>
                    {detailInvoiceComputed.notes}
                  </div>
                )}

                {/* Invoice Document / Receipt Attachment */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Invoice Document / Receipt
                    </span>
                    {detailInvoiceComputed.documentUrl && (
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                          Replace
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadInvoiceDocument(file, detailInvoiceComputed.id, {
                                number: detailInvoiceComputed.invoiceNumber,
                                vendor: detailInvoiceComputed.vendorName,
                                date: detailInvoiceComputed.dateReceived,
                              });
                            }}
                          />
                        </label>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleRemoveDetailDocument}
                          className="text-[11px] font-semibold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {detailInvoiceComputed.documentUrl ? (
                    <div className="space-y-2">
                      {/* If image, display crisp preview above the file bar */}
                      {['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].some(ext => (detailInvoiceComputed.documentName || detailInvoiceComputed.documentUrl || '').toLowerCase().includes(ext)) && (
                        <div
                          onClick={() => setPreviewDoc({
                            url: detailInvoiceComputed.documentUrl!,
                            name: detailInvoiceComputed.documentName || `Invoice #${detailInvoiceComputed.invoiceNumber}`
                          })}
                          className="group/img relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-2 flex items-center justify-center max-h-56 hover:border-blue-400 hover:shadow-md transition-all"
                          title="Click to view full preview"
                        >
                          <img
                            src={detailInvoiceComputed.documentUrl}
                            alt="Invoice Preview"
                            className="max-h-52 w-auto object-contain rounded-lg transition-transform duration-200 group-hover/img:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                            <span className="bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs font-medium">
                              <Eye className="w-3.5 h-3.5" /> Click to enlarge
                            </span>
                          </div>
                        </div>
                      )}

                      {/* File bar below the preview */}
                      <div
                        onClick={() => setPreviewDoc({
                          url: detailInvoiceComputed.documentUrl!,
                          name: detailInvoiceComputed.documentName || `Invoice #${detailInvoiceComputed.invoiceNumber}`
                        })}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
                              {detailInvoiceComputed.documentName || `Invoice #${detailInvoiceComputed.invoiceNumber} Document`}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              <Eye className="w-3 h-3 text-blue-500" /> Click to view preview dialog
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 font-medium border-slate-300 dark:border-slate-700 pointer-events-none group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 p-3 border border-dashed rounded-xl cursor-pointer transition-colors ${
                      isUploadingDoc
                        ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50/40 dark:bg-slate-800/20'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        disabled={isUploadingDoc}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadInvoiceDocument(file, detailInvoiceComputed.id, {
                            number: detailInvoiceComputed.invoiceNumber,
                            vendor: detailInvoiceComputed.vendorName,
                            date: detailInvoiceComputed.dateReceived,
                          });
                        }}
                      />
                      {isUploadingDoc ? (
                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading document...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Attach invoice document or receipt scan</span>
                        </div>
                      )}
                    </label>
                  )}
                </div>

                {/* Payment History List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Payment Disbursements ({detailPayments.length})
                    </h3>
                  </div>

                  {detailPayments.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                      No payments recorded yet for this invoice.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      {detailPayments.map((p) => (
                        <div key={p.id} className="text-xs">
                          {editingPaymentId === p.id ? (
                            /* ── Inline Edit Form ── */
                            <div className="p-3.5 space-y-2.5 bg-blue-50/40 dark:bg-blue-950/10 border-b border-slate-100 dark:border-slate-800">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                                Edit Payment
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Amount (₦) <span className="text-rose-500">*</span></label>
                                  <input
                                    type="number"
                                    value={editPayAmt}
                                    onChange={e => setEditPayAmt(e.target.value)}
                                    className="w-full text-sm font-bold h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Payment Date <span className="text-rose-500">*</span></label>
                                  <input
                                    type="date"
                                    value={editPayDate}
                                    onChange={e => setEditPayDate(e.target.value)}
                                    className="w-full text-xs h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Paid From (Bank) <span className="text-rose-500">*</span></label>
                                <select
                                  value={editPayBank}
                                  onChange={e => setEditPayBank(e.target.value)}
                                  className="w-full text-xs h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
                                >
                                  <option value="">Select bank...</option>
                                  {ledgerBanks.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                  ))}
                                  {/* Keep current value selectable even if not in list */}
                                  {editPayBank && !ledgerBanks.find(b => b.name === editPayBank) && (
                                    <option value={editPayBank}>{editPayBank}</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Notes <span className="text-[11px] font-normal text-slate-400">(optional)</span></label>
                                <input
                                  type="text"
                                  placeholder="Reference, memo..."
                                  value={editPayNotes}
                                  onChange={e => setEditPayNotes(e.target.value)}
                                  className="w-full text-xs h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingPaymentId(null)}
                                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedPayment(p.id, detailInvoiceComputed.id)}
                                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Read View ── */
                            <div className="p-3.5 flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                ₦{fmt(p.amountPaid)}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {formatDateDisplay(p.paymentDate)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>Paid from: <strong>{p.paidFromBank}</strong></span>
                              {p.paidToBankName && (
                                <>
                                  <span>→</span>
                                  <span>To: {p.paidToBankName} ({p.paidToAccountNo})</span>
                                </>
                              )}
                            </div>
                            {p.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5">"{p.notes}"</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {p.ledgerEntryId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Voucher #{p.ledgerEntryId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkExistingPayment(p.id)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Unlink ledger voucher"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkingPaymentId(p.id);
                                  setLinkingPaymentDate(p.paymentDate || '');
                                  setLinkingPaymentAmt(Number(p.amountPaid || 0));
                                  setLinkVoucherSearch('');
                                }}
                                className="h-7 px-2 text-[11px] font-medium border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition-colors"
                              >
                                <Link2 className="w-3 h-3 mr-1 text-slate-500" />
                                Link Voucher
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              title="Edit payment"
                              onClick={() => {
                                setEditingPaymentId(p.id);
                                setEditPayAmt(String(p.amountPaid || ''));
                                setEditPayDate(p.paymentDate || '');
                                setEditPayBank(p.paidFromBank || '');
                                setEditPayNotes(p.notes || '');
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePayment(p.id, detailInvoiceComputed.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteInvoice(detailInvoiceComputed)}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Invoice
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEditInvoice(detailInvoiceComputed);
                    }}
                    className="text-xs h-8 px-3 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold"
                  >
                    <Pencil className="w-3 h-3 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="text-xs h-8 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-transparent dark:border-slate-700 font-semibold shadow-sm"
                  >
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 9a. Dialog: Link Voucher Picker ─────────────────────────────────── */}
      <Dialog
        open={!!linkingPaymentId}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingPaymentId(null);
            setLinkVoucherSearch('');
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Link to Ledger Transaction
            </DialogTitle>
            {/* Payment context — shows which payment we're linking */}
            {linkingPaymentDate && (
              <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Payment:</span>
                <span className="text-slate-700 dark:text-slate-200 font-medium">{formatDateDisplay(linkingPaymentDate)}</span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">₦{fmt(linkingPaymentAmt)}</span>
                <span className="text-slate-400 ml-1 text-[10px]">— showing nearest ledger transactions first</span>
              </div>
            )}
          </DialogHeader>

          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search by date, amount, vendor, description…"
                value={linkVoucherSearch}
                onChange={(e) => setLinkVoucherSearch(e.target.value)}
                className="w-full text-xs h-9 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
              />
              {linkVoucherSearch && (
                <button
                  type="button"
                  onClick={() => setLinkVoucherSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="px-3 pb-4 max-h-[55vh] overflow-y-auto mt-2">
            {detailModalLedgerEntries.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                <BookOpen className="w-8 h-8 text-slate-300" />
                <span>{linkVoucherSearch ? 'No matching transactions found.' : 'No unlinked ledger transactions available.'}</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                {detailModalLedgerEntries.map((le, idx) => {
                  const entryTime = le.date ? new Date(le.date).getTime() : NaN;
                  const payTime = linkingPaymentDate ? new Date(linkingPaymentDate + 'T00:00:00').getTime() : NaN;
                  const daysDiff = (!isNaN(entryTime) && !isNaN(payTime))
                    ? Math.abs(Math.round((entryTime - payTime) / (1000 * 60 * 60 * 24)))
                    : null;
                  const isExactDate = daysDiff === 0;
                  const isClose = daysDiff !== null && daysDiff <= 3;

                  return (
                    <button
                      key={le.id}
                      type="button"
                      onClick={() => {
                        if (!linkingPaymentId) return;
                        handleLinkExistingPaymentToLedger(linkingPaymentId, le.voucherNo || le.id);
                        setLinkingPaymentId(null);
                        setLinkVoucherSearch('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors group"
                    >
                      {/* Row: Date (primary) + Amount + badge */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                            {formatDateDisplay(le.date)}
                          </span>
                          {isExactDate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">
                              Same date
                            </span>
                          )}
                          {!isExactDate && isClose && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">
                              {daysDiff}d apart
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          ₦{fmt(le.amount)}
                        </span>
                      </div>

                      {/* Vendor + Description */}
                      {(le.vendor || le.description) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate pl-[22px] mt-0.5">
                          {le.vendor && <span className="font-medium text-slate-600 dark:text-slate-300">{le.vendor}</span>}
                          {le.vendor && le.description ? ' · ' : ''}
                          {le.description || ''}
                        </div>
                      )}

                      {/* Bank + Voucher ref */}
                      <div className="flex items-center gap-3 pl-[22px] mt-0.5">
                        {le.bank && (
                          <span className="text-[10px] text-slate-400">{le.bank}</span>
                        )}
                        {le.voucherNo && (
                          <span className="text-[10px] text-slate-400 font-mono">Ref: {le.voucherNo}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setLinkingPaymentId(null); setLinkVoucherSearch(''); }}
              className="text-xs h-8 px-4 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 9. Dialog: Vendor Directory ────────────────────────────────────── */}
      <Dialog open={isVendorDirectoryOpen} onOpenChange={setIsVendorDirectoryOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Vendor Directory
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Manage global vendors for invoices and ledger records ({ledgerVendors.length} registered)
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={openNewVendorModal}
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New Vendor
              </Button>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/40 dark:bg-slate-950/40">
            {/* Search & Filter Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search vendors by name, TIN, phone, bank, account..."
                  value={vendorSearchTerm}
                  onChange={(e) => setVendorSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                {vendorSearchTerm && (
                  <button
                    onClick={() => setVendorSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {sortedAndFilteredVendors.length} of {ledgerVendors.length} vendors
              </span>
            </div>

            {/* Table of Vendors */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 h-9 px-4">
                      Vendor / Company
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 h-9 px-4">
                      TIN & Contact
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 h-9 px-4">
                      Bank & Account Details
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 h-9 px-4 text-center">
                      Invoices
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 h-9 px-4 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                        {vendorSearchTerm ? `No vendors matching "${vendorSearchTerm}"` : 'No vendors registered yet. Click "+ New Vendor" to add.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAndFilteredVendors.map((v) => {
                      const invCount = vendorInvoices.filter(
                        (i) => (i.vendorName || '').toLowerCase() === v.name.toLowerCase() || i.vendorId === v.id
                      ).length;

                      return (
                        <TableRow key={v.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                          {/* Vendor Name & Address / Notes */}
                          <TableCell className="py-2.5 px-4 align-top">
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>{v.name}</span>
                              </div>
                              {v.address && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 ml-5">
                                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span className="truncate max-w-[220px]">{v.address}</span>
                                </div>
                              )}
                              {v.notes && (
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5 ml-5 truncate max-w-[220px]">
                                  {v.notes}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* TIN & Phone */}
                          <TableCell className="py-2.5 px-4 align-top">
                            <div className="space-y-1">
                              {v.tinNumber ? (
                                <span className="inline-block text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {v.tinNumber}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">No TIN</span>
                              )}
                              {v.phone && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span>{v.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Bank & Account Details */}
                          <TableCell className="py-2.5 px-4 align-top">
                            {v.bankName || v.accountNumber ? (
                              <div className="space-y-0.5">
                                {v.bankName && (
                                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    <Landmark className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                    <span>{v.bankName}</span>
                                  </div>
                                )}
                                {v.accountNumber && (
                                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 ml-4">
                                    {v.accountNumber}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </TableCell>

                          {/* Invoices count */}
                          <TableCell className="py-2.5 px-4 text-center align-top">
                            {invCount > 0 ? (
                              <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {invCount} {invCount === 1 ? 'bill' : 'bills'}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">0</span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="py-2.5 px-4 text-right align-top">
                            <div className="flex justify-end items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title="Edit Vendor"
                                onClick={() => openEditVendorModal(v)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete Vendor"
                                onClick={() => handleDeleteVendorDirectory(v.id, v.name)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 shrink-0 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Vendors registered here appear in invoice and ledger dropdowns automatically.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVendorDirectoryOpen(false)}
              className="text-xs h-8 px-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 10. Dialog: Add / Edit Vendor Modal ─────────────────────────────── */}
      <Dialog open={isVendorModalOpen} onOpenChange={setIsVendorModalOpen} className="!z-[10050]">
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingVendorId ? 'Edit Vendor Profile' : 'Register New Vendor'}
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingVendorId
                    ? 'Update profile details, contact information, settlement bank, and notes.'
                    : 'Add a new vendor with settlement details to the directory.'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            {/* Vendor Name & TIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Vendor / Company Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Amorsil Energy Ltd"
                  value={vendorFormName}
                  onChange={(e) => setVendorFormName(e.target.value)}
                  className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  TIN Number <span className="text-slate-400 font-normal">(Tax ID)</span>
                </label>
                <Input
                  placeholder="e.g. 10293847-0001"
                  value={vendorFormTin}
                  onChange={(e) => setVendorFormTin(e.target.value)}
                  className="h-9 text-xs font-mono border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Phone Number & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> Phone Number
                </label>
                <Input
                  placeholder="e.g. +234 803 123 4567"
                  value={vendorFormPhone}
                  onChange={(e) => setVendorFormPhone(e.target.value)}
                  className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Address / Office Location
                </label>
                <Input
                  placeholder="e.g. Plot 12 Commercial Ave, Lagos"
                  value={vendorFormAddress}
                  onChange={(e) => setVendorFormAddress(e.target.value)}
                  className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Account Details: Bank & Account Number */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Bank & Settlement Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <Input
                    placeholder="e.g. Zenith Bank, Access Bank..."
                    list="vendor-bank-suggestions"
                    value={vendorFormBankName}
                    onChange={(e) => setVendorFormBankName(e.target.value)}
                    className="h-9 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="vendor-bank-suggestions">
                    {ledgerBanks.map((b) => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Account Number
                  </label>
                  <Input
                    placeholder="e.g. 0123456789"
                    value={vendorFormAccountNumber}
                    onChange={(e) => setVendorFormAccountNumber(e.target.value)}
                    className="h-9 text-xs font-mono border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" /> Notes & Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Payment instructions, representative contacts, specific terms..."
                value={vendorFormNotes}
                onChange={(e) => setVendorFormNotes(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVendorModalOpen(false)}
              className="text-xs h-8 px-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveVendorModal}
              className="text-xs h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              {editingVendorId ? 'Save Changes' : 'Create Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 9. Document / Receipt In-App Preview Modal ───────────────────────── */}
      {previewDoc && (
        <DocPreviewModal
          url={previewDoc.url}
          name={previewDoc.name}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

export default VendorInvoices;
