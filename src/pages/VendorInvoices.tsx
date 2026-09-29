import { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/src/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { useAppStore, VendorInvoice, VendorInvoicePayment, LedgerEntry, LedgerVendor, InvoiceVersion } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import { toast, showConfirm } from '@/src/components/ui/toast';
import {
  Plus, Search, X, AlertTriangle, Pencil, CreditCard, CheckCircle2,
  Clock, AlertCircle, Receipt, ArrowRight, MoreVertical, Trash2,
  Calendar, Building2, ChevronLeft, ChevronRight, ArrowUpDown,
  BookOpen, ExternalLink, Filter, Wallet, FileText, Check, Sparkles,
  Link2, Unlink, Edit2, Users, Paperclip, Upload, Eye, Loader2,
  Phone, MapPin, Landmark, ShieldCheck, History, Send, ThumbsUp,
  ThumbsDown, MessageSquare, TrendingDown, Tag, RotateCcw, UserCheck, Lock
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

/**
 * Check if invoice is approved for payment disbursements.
 * Legacy and previously recorded invoices without an explicit approvalStatus
 * are automatically treated as approved.
 */
export function isInvoiceApproved(inv?: { approvalStatus?: string } | null): boolean {
  if (!inv) return false;
  return !inv.approvalStatus || inv.approvalStatus === 'approved';
}

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

// ─── Unified Minimalist Status Badge Component ────────────────────────────────
function UnifiedInvoiceStatusBadge({
  invoice,
  onClickApproval,
}: {
  invoice: ComputedVendorInvoice;
  onClickApproval?: () => void;
}) {
  const approval = invoice.approvalStatus;

  // 1. Pending Approval: primary operational blocker
  if (approval === 'pending_approval') {
    return (
      <button
        type="button"
        onClick={onClickApproval}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
        title={`Pending approval by ${invoice.approverName || 'Approver'}. Click to review.`}
      >
        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Pending Approval</span>
      </button>
    );
  }

  // 2. Rejected / Needs Revision
  if (approval === 'rejected') {
    return (
      <button
        type="button"
        onClick={onClickApproval}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
        title={invoice.rejectionReason ? `Rejected: ${invoice.rejectionReason}. Click to view.` : 'Revision required. Click to view.'}
      >
        <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
        <span>Revision Needed</span>
      </button>
    );
  }

  // 3. Draft
  if (approval === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 whitespace-nowrap">
        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
        <span>Draft</span>
      </span>
    );
  }

  // 4. Approved (Single Minimalist Capsule: Approved · Payment Status)
  const status = invoice.derivedStatus;
  const isOverdue = invoice.isOverdue;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 whitespace-nowrap shadow-2xs">
      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
        <Check className="w-3 h-3 stroke-[3]" />
        <span>Approved</span>
      </span>
      <span className="text-slate-300 dark:text-slate-600 font-light">·</span>
      <span className={`font-semibold shrink-0 ${
        status === 'paid'
          ? 'text-emerald-600 dark:text-emerald-400'
          : isOverdue
            ? 'text-rose-600 dark:text-rose-400'
            : status === 'partial'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-600 dark:text-slate-300'
      }`}>
        {status === 'paid' ? 'Fully Paid' : isOverdue ? 'Overdue' : status === 'partial' ? 'Partial' : 'Unpaid'}
      </span>
    </span>
  );
}

// ─── Line Item Type & Formatters ───────────────────────────────────────────────
type LineItem = { id: string; desc: string; qty: string; rate: string };

const formatAmountInput = (val: string | number): string => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  const clean = str.replace(/[^0-9.]/g, '');
  if (!clean) return '';
  const parts = clean.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 1) {
    return `${intPart}.${parts.slice(1).join('').slice(0, 2)}`;
  }
  return intPart;
};

const parseAmountInput = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const num = parseFloat(String(val || '').replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

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

  // ─── User Authority & Approvals ───────────────────────────────────────────
  const allUsers = useUserStore((s) => s.users);
  const activeUsers = useMemo(() => allUsers.filter((u) => u.isActive), [allUsers]);
  const canDirectApprove = Boolean(
    priv?.canDirectApprove ||
    currentUser?.role?.toLowerCase().includes('admin') ||
    currentUser?.role?.toLowerCase().includes('director') ||
    currentUser?.role?.toLowerCase().includes('managing') ||
    !currentUser
  );

  // ─── State: Filters, Search, Sort & Pagination ──────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'outstanding' | 'awaiting_approval' | 'overdue' | 'paid'>('outstanding');
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'balance-desc' | 'due-soon'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ─── State: Modals ──────────────────────────────────────────────────────────
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<VendorInvoice | null>(null);

  // ─── State: Approval Review Modal ──────────────────────────────────────────
  const [isApprovalReviewModalOpen, setIsApprovalReviewModalOpen] = useState(false);
  const [reviewingInvoice, setReviewingInvoice] = useState<ComputedVendorInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectingOpen, setIsRejectingOpen] = useState(false);
  // Per-line-item decisions while reviewing: itemId → 'approved' | 'flagged' | 'pending'
  const [lineItemDecisions, setLineItemDecisions] = useState<Record<string, 'approved' | 'flagged' | 'pending'>>({});

  // ─── State: Invoice Form Approval Routing ──────────────────────────────────
  const [invApprovalAction, setInvApprovalAction] = useState<'approve_direct' | 'send_approval' | 'draft'>('approve_direct');
  const [invApproverId, setInvApproverId] = useState('');
  const [invApproverName, setInvApproverName] = useState('');
  const [invVersionNote, setInvVersionNote] = useState('');

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

  // ─── Line Items State ───────────────────────────────────────────────────────
  const blankLine = (): LineItem => ({ id: crypto.randomUUID(), desc: '', qty: '1', rate: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([blankLine()]);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkParseError, setBulkParseError] = useState('');

  const lineItemsTotal = lineItems.reduce((sum, li) => {
    const q = parseFloat(li.qty) || 0;
    const r = parseAmountInput(li.rate);
    return sum + q * r;
  }, 0);

  const updateLine = (id: string, field: keyof LineItem, value: string) =>
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));

  const addLine = (afterId?: string) => {
    const newLine = blankLine();
    if (afterId) {
      setLineItems((prev) => {
        const idx = prev.findIndex((li) => li.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, newLine);
        return next;
      });
    } else {
      setLineItems((prev) => [...prev, newLine]);
    }
    // Focus the new row's desc field after render
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-linedesc]');
      inputs[inputs.length - 1]?.focus();
    }, 30);
  };

  const removeLine = (id: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((li) => li.id !== id) : prev));

  // ── Bulk text parser ──────────────────────────────────────────────────────
  // Handles formats like:
  //   "1\" Pipe — ₦2,200 × 4 pcs = ₦8,800"
  //   "Labour — ₦15,000"
  //   "Labour: 15000"
  //   "Labour  15000  1"
  //   "Plumbing Work:" (category header — skipped)
  //   "Total: ₦95,400" (summary — skipped)
  const parseBulkText = (raw: string): LineItem[] => {
    const clean = (s: string) => parseAmountInput(s.replace(/[₦#\s]/g, ''));
    const results: LineItem[] = [];

    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip summary / header lines
      if (/^total[:\s]/i.test(line)) continue;
      if (/^[A-Za-z ]+:$/.test(line)) continue; // e.g. "Plumbing Work:"

      // Pattern A: "desc — ₦rate × qty (pcs|pc|units) = ₦total"
      const pA = line.match(/^(.+?)\s*[\u2014\-]{1,2}\s*[₦#]?([\d,\.]+)\s*[×x\*]\s*([\d,\.]+)\s*(?:pcs?|units?|nos?)?\s*=?/i);
      if (pA) {
        const desc = pA[1].replace(/^[\u2014\-]+/, '').trim();
        const rate = clean(pA[2]);
        const qty = clean(pA[3]);
        if (desc && rate > 0) {
          results.push({ id: crypto.randomUUID(), desc, qty: String(qty || 1), rate: formatAmountInput(rate) });
          continue;
        }
      }

      // Pattern B: "desc — ₦rate" (no qty)
      const pB = line.match(/^(.+?)\s*[\u2014\-]{1,2}\s*[₦#]?([\d,\.]+)\s*$/i);
      if (pB) {
        const desc = pB[1].trim();
        const rate = clean(pB[2]);
        if (desc && rate > 0) {
          results.push({ id: crypto.randomUUID(), desc, qty: '1', rate: formatAmountInput(rate) });
          continue;
        }
      }

      // Pattern C: "desc: rate" or "desc: rate × qty"
      const pC = line.match(/^(.+?):\s*[₦#]?([\d,\.]+)(?:\s*[×x\*]\s*([\d,\.]+))?\s*$/i);
      if (pC) {
        const desc = pC[1].trim();
        const rate = clean(pC[2]);
        const qty = pC[3] ? clean(pC[3]) : 1;
        if (desc && rate > 0) {
          results.push({ id: crypto.randomUUID(), desc, qty: String(qty), rate: formatAmountInput(rate) });
          continue;
        }
      }

      // Pattern D: tab/space separated columns: "desc  rate  qty"
      const parts = line.split(/\t|  +/);
      if (parts.length >= 2) {
        const desc = parts[0].trim();
        const rate = clean(parts[1]);
        const qty = parts[2] ? clean(parts[2]) : 1;
        if (desc && rate > 0) {
          results.push({ id: crypto.randomUUID(), desc, qty: String(qty), rate: formatAmountInput(rate) });
        }
      }
    }

    return results;
  };

  const handleApplyBulkPaste = () => {
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      setBulkParseError('Could not parse any items. Try the format: Item — ₦rate × qty');
      return;
    }
    setBulkParseError('');
    setLineItems(parsed);
    setBulkText('');
    setShowBulkPaste(false);
  };

  const serializeLineItems = (items: LineItem[]): string =>
    items
      .filter((li) => li.desc.trim() || parseAmountInput(li.rate) > 0)
      .map((li) => {
        const q = parseFloat(li.qty) || 1;
        const r = parseAmountInput(li.rate);
        const t = q * r;
        return q !== 1
          ? `${li.desc.trim()} — ₦${fmt(r)} × ${q} = ₦${fmt(t)}`
          : `${li.desc.trim()} — ₦${fmt(r)}`;
      })
      .join('  |  ');

  const loadLineItems = (jsonStr?: string, fallbackDesc?: string): LineItem[] => {
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: any) => ({
            id: crypto.randomUUID(),
            desc: String(p.desc || ''),
            qty: String(p.qty ?? 1),
            rate: formatAmountInput(p.rate ?? ''),
          }));
        }
      } catch { /* ignore */ }
    }
    // fallback: try to parse old description string
    if (fallbackDesc) {
      const parsed = parseBulkText(fallbackDesc.replace(/  \|  /g, '\n'));
      if (parsed.length > 0) return parsed;
      return [{ id: crypto.randomUUID(), desc: fallbackDesc, qty: '1', rate: '' }];
    }
    return [blankLine()];
  };

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
      const isApproved = isInvoiceApproved(inv);
      const daysOverdue = isApproved && inv.dueDate && inv.status !== 'paid' ? getDaysOverdue(inv.dueDate) : 0;
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

  // Invoices waiting for current user's approval
  const myPendingApprovals = useMemo(() => {
    if (!currentUser) return [];
    return invoicesWithBalance.filter(
      (inv) =>
        inv.approvalStatus === 'pending_approval' &&
        (inv.approverId === currentUser.id ||
          inv.approverName?.toLowerCase().trim() === currentUser.name?.toLowerCase().trim() ||
          currentUser.role?.toLowerCase().includes('admin') ||
          currentUser.role?.toLowerCase().includes('director'))
    );
  }, [invoicesWithBalance, currentUser]);

  // ─── Computations: High-level KPI summary ───────────────────────────────────
  const summary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let pendingApprovalCount = 0;
    let totalNegotiatedSavings = 0;

    invoicesWithBalance.forEach((inv) => {
      const isApproved = (inv.approvalStatus || 'approved') === 'approved';
      if (isApproved) {
        totalInvoiced += Number(inv.totalAmount || 0);
        totalPaid += inv.paidAmount;
        totalOutstanding += inv.balanceRemaining;
        if (inv.isOverdue) {
          overdueCount += 1;
          overdueAmount += inv.balanceRemaining;
        }
      } else if (inv.approvalStatus === 'pending_approval') {
        pendingApprovalCount += 1;
      }

      // Track negotiation savings across all invoices
      if (inv.initialAmount && inv.initialAmount > inv.totalAmount) {
        totalNegotiatedSavings += (inv.initialAmount - inv.totalAmount);
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      pendingApprovalCount,
      totalNegotiatedSavings,
      count: invoicesWithBalance.filter((i) => (i.approvalStatus || 'approved') === 'approved').length,
      allCount: invoicesWithBalance.length,
    };
  }, [invoicesWithBalance]);

  // ─── Filtered & Sorted Invoices ──────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let list = invoicesWithBalance;

    // 1. Tab filter
    if (activeTab === 'outstanding') {
      list = list.filter((i) => (i.approvalStatus || 'approved') === 'approved' && i.derivedStatus !== 'paid');
    } else if (activeTab === 'awaiting_approval') {
      list = list.filter((i) => i.approvalStatus === 'pending_approval' || i.approvalStatus === 'rejected' || i.approvalStatus === 'draft');
    } else if (activeTab === 'overdue') {
      list = list.filter((i) => (i.approvalStatus || 'approved') === 'approved' && i.isOverdue);
    } else if (activeTab === 'paid') {
      list = list.filter((i) => (i.approvalStatus || 'approved') === 'approved' && i.derivedStatus === 'paid');
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
    setLineItems([blankLine()]);
    setShowBulkPaste(false);
    setBulkText('');
    setBulkParseError('');
    setInvApprovalAction(canDirectApprove ? 'approve_direct' : 'send_approval');
    setInvApproverId('');
    setInvApproverName('');
    setInvVersionNote('');
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
    setLineItems(loadLineItems(inv.lineItems, inv.description));
    setShowBulkPaste(false);
    setBulkText('');
    setBulkParseError('');
    // Preserve existing approval state when editing
    setInvApprovalAction(
      inv.approvalStatus === 'pending_approval' ? 'send_approval'
      : inv.approvalStatus === 'draft' ? 'draft'
      : canDirectApprove ? 'approve_direct' : 'send_approval'
    );
    setInvApproverId(inv.approverId || '');
    setInvApproverName(inv.approverName || '');
    setInvVersionNote('');
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
      if (detailInvoice && editingInvoice && detailInvoice.id === editingInvoice.id) {
        setDetailInvoice((prev) =>
          prev
            ? {
                ...prev,
                documentUrl: undefined,
                documentName: undefined,
                documentId: undefined,
              }
            : null
        );
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
      setDetailInvoice((prev) =>
        prev
          ? {
              ...prev,
              documentUrl: undefined,
              documentName: undefined,
              documentId: undefined,
            }
          : null
      );
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

    // Validate approver selection when sending for approval
    if (invApprovalAction === 'send_approval' && !invApproverId) {
      toast.error('Please select an approver before sending for approval.');
      return;
    }

    // Prefer line-items total if any items have been entered, else fall back to manual amount
    const hasLineItems = lineItems.some((li) => li.desc.trim() || parseAmountInput(li.rate) > 0);
    const computedAmt = hasLineItems ? lineItemsTotal : parseAmountInput(invAmount);
    if (isNaN(computedAmt) || computedAmt <= 0) {
      toast.error('Please add at least one line item with a cost, or enter a total amount.');
      return;
    }

    // Build description from line items (or keep manual desc)
    const lineItemDesc = hasLineItems ? serializeLineItems(lineItems) : invDescription.trim();
    if (!lineItemDesc) {
      toast.error('Please provide a description or add line items.');
      return;
    }

    // Serialize line items to JSON for storage
    const lineItemsJson = hasLineItems
      ? JSON.stringify(
          lineItems
            .filter((li) => li.desc.trim() || parseAmountInput(li.rate) > 0)
            .map((li) => ({ desc: li.desc.trim(), qty: parseFloat(li.qty) || 1, rate: parseAmountInput(li.rate) }))
        )
      : undefined;

    const cleanVendor = invVendorName.trim();
    const existingVendor = ledgerVendors.find(
      (v) => v.name.trim().toLowerCase() === cleanVendor.toLowerCase()
    );
    let finalVendorId = existingVendor ? existingVendor.id : (editingInvoice?.vendorId || '');
    if (!finalVendorId) {
      const newVendorId = crypto.randomUUID();
      addLedgerVendor({ id: newVendorId, name: cleanVendor });
      finalVendorId = newVendorId;
      toast.success(`Saved "${cleanVendor}" to Vendor Directory.`);
    }

    // ── Resolve approval fields ────────────────────────────────────────────────
    const now = new Date().toISOString();
    let approvalStatus: VendorInvoice['approvalStatus'] = 'approved';
    let approverId: string | undefined;
    let approverName: string | undefined;
    let approvalRequestedAt: string | undefined;
    let approvedAt: string | undefined;

    if (invApprovalAction === 'approve_direct') {
      approvalStatus = 'approved';
      approvedAt = now;
    } else if (invApprovalAction === 'send_approval') {
      approvalStatus = 'pending_approval';
      approverId = invApproverId;
      approverName = invApproverName;
      approvalRequestedAt = now;
    } else {
      approvalStatus = 'draft';
    }

    if (editingInvoice) {
      // Build a new version snapshot if amount changed or explicitly noted
      const prevAmt = editingInvoice.totalAmount;
      const versionNote = invVersionNote.trim() ||
        (computedAmt !== prevAmt ? `Amount revised from ₦${fmt(prevAmt)} → ₦${fmt(computedAmt)}` : 'Invoice edited');

      const existingVersions: InvoiceVersion[] = editingInvoice.versions || [];
      const newVersion: InvoiceVersion = {
        version: existingVersions.length + 1,
        amount: prevAmt,
        description: editingInvoice.description,
        editedBy: currentUser?.name || 'User',
        editedAt: now,
        note: versionNote,
      };

      updateVendorInvoice(editingInvoice.id, {
        vendorName: cleanVendor,
        vendorId: finalVendorId || cleanVendor,
        invoiceNumber: invNumber.trim(),
        dateReceived: invDateReceived,
        dueDate: invDueDate || undefined,
        totalAmount: computedAmt,
        description: lineItemDesc,
        lineItems: lineItemsJson,
        notes: invNotes.trim() || undefined,
        documentUrl: invDocUrl || undefined,
        documentName: invDocName || undefined,
        documentId: invDocId || undefined,
        approvalStatus,
        approverId,
        approverName,
        approvalRequestedAt,
        approvedAt,
        versions: [...existingVersions, newVersion],
        // Keep initialAmount as the very first recorded amount
        initialAmount: editingInvoice.initialAmount ?? prevAmt,
      });
      const msg = invApprovalAction === 'send_approval'
        ? `Invoice updated & sent to ${invApproverName} for approval.`
        : 'Invoice updated successfully.';
      toast.success(msg);
    } else {
      const newInv: VendorInvoice = {
        id: crypto.randomUUID(),
        workspaceId: ws,
        vendorName: cleanVendor,
        vendorId: finalVendorId || cleanVendor,
        invoiceNumber: invNumber.trim(),
        dateReceived: invDateReceived,
        dueDate: invDueDate || undefined,
        totalAmount: computedAmt,
        initialAmount: computedAmt,
        description: lineItemDesc,
        lineItems: lineItemsJson,
        notes: invNotes.trim() || undefined,
        documentUrl: invDocUrl || undefined,
        documentName: invDocName || undefined,
        documentId: invDocId || undefined,
        status: 'unpaid',
        approvalStatus,
        approverId,
        approverName,
        approvalRequestedAt,
        approvedAt,
        versions: [],
        enteredBy: currentUser?.name || 'User',
        createdAt: now,
      };
      addVendorInvoice(newInv);
      const msg = invApprovalAction === 'send_approval'
        ? `Invoice sent to ${invApproverName} for approval.`
        : invApprovalAction === 'draft'
        ? 'Invoice saved as draft.'
        : 'Invoice recorded & approved.';
      toast.success(msg);
    }

    setIsInvoiceModalOpen(false);
    setInvVersionNote('');
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
    // Only approved invoices can receive payment disbursements
    if (!isInvoiceApproved(inv)) {
      const statusLabel =
        inv.approvalStatus === 'pending_approval'
          ? `awaiting approval from ${inv.approverName || 'an approver'}`
          : inv.approvalStatus === 'rejected'
            ? 'rejected'
            : inv.approvalStatus || 'not approved';
      toast.error(`Cannot record payment: Invoice #${inv.invoiceNumber} is ${statusLabel}. Invoices must be approved before payments can be added.`);
      return;
    }

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

    if (!isInvoiceApproved(payingInvoice)) {
      toast.error(`Cannot record payment: Invoice #${payingInvoice.invoiceNumber} is not approved.`);
      return;
    }

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

  // ─── Approval Review Handlers ─────────────────────────────────────────────
  const handleOpenApprovalReview = (inv: ComputedVendorInvoice) => {
    setReviewingInvoice(inv);
    setRejectReason('');
    setIsRejectingOpen(false);
    // Seed per-line-item decisions from stored lineItems
    const items = loadLineItems(inv.lineItems, inv.description);
    const initial: Record<string, 'approved' | 'flagged' | 'pending'> = {};
    items.filter(i => i.desc.trim()).forEach(i => { initial[i.id] = 'pending'; });
    setLineItemDecisions(initial);
    setIsApprovalReviewModalOpen(true);
  };

  const handleApproveInvoice = () => {
    if (!reviewingInvoice) return;
    const now = new Date().toISOString();
    updateVendorInvoice(reviewingInvoice.id, {
      approvalStatus: 'approved',
      approvedAt: now,
    });
    toast.success(`Invoice #${reviewingInvoice.invoiceNumber} approved!`);
    
    // Auto-advance to next pending approval in queue if available
    const remaining = myPendingApprovals.filter((inv) => inv.id !== reviewingInvoice.id);
    if (remaining.length > 0) {
      setReviewingInvoice(remaining[0]);
      setRejectReason('');
      setIsRejectingOpen(false);
    } else {
      setIsApprovalReviewModalOpen(false);
      setReviewingInvoice(null);
    }
  };

  const handleRejectInvoice = () => {
    if (!reviewingInvoice) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason for rejection.');
      return;
    }
    const now = new Date().toISOString();
    // Push a version snapshot of this rejection
    const existingVersions: InvoiceVersion[] = reviewingInvoice.versions || [];
    const rejectionVersion: InvoiceVersion = {
      version: existingVersions.length + 1,
      amount: reviewingInvoice.totalAmount,
      description: reviewingInvoice.description,
      editedBy: currentUser?.name || 'Approver',
      editedAt: now,
      note: `Rejected: ${rejectReason.trim()}`,
    };
    updateVendorInvoice(reviewingInvoice.id, {
      approvalStatus: 'rejected',
      rejectedAt: now,
      rejectionReason: rejectReason.trim(),
      versions: [...existingVersions, rejectionVersion],
    });
    toast.info(`Invoice #${reviewingInvoice.invoiceNumber} rejected. Creator notified to revise.`);
    
    // Auto-advance to next pending approval in queue if available
    const remaining = myPendingApprovals.filter((inv) => inv.id !== reviewingInvoice.id);
    if (remaining.length > 0) {
      setReviewingInvoice(remaining[0]);
      setRejectReason('');
      setIsRejectingOpen(false);
    } else {
      setIsApprovalReviewModalOpen(false);
      setReviewingInvoice(null);
      setRejectReason('');
    }
  };

  // Show approval popup automatically as soon as pending items are detected for the user
  const hasAutoPromptedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoPromptedRef.current && myPendingApprovals.length > 0 && !isApprovalReviewModalOpen) {
      hasAutoPromptedRef.current = true;
      const t = setTimeout(() => {
        setReviewingInvoice(myPendingApprovals[0]);
        setRejectReason('');
        setIsRejectingOpen(false);
        setIsApprovalReviewModalOpen(true);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [myPendingApprovals, isApprovalReviewModalOpen]);

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
              onClick={() => setActiveTab('awaiting_approval')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'awaiting_approval'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-700'
              }`}
            >
              Approvals
              {summary.pendingApprovalCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                  {summary.pendingApprovalCount}
                </span>
              )}
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
                <TableHead className="py-2 px-3 w-[260px]">Vendor & Invoice</TableHead>
                <TableHead className="py-2 px-3">Date / Due</TableHead>
                <TableHead className="py-2 px-3 text-right">Total (₦)</TableHead>
                <TableHead className="py-2 px-3 text-right">Paid (₦)</TableHead>
                <TableHead className="py-2 px-3 text-right">Balance Due (₦)</TableHead>
                <TableHead className="py-2 px-3 text-center">Status</TableHead>
                <TableHead className="py-2 px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-slate-400">
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
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer border-l-[3px] ${
                        inv.approvalStatus === 'approved' || !inv.approvalStatus
                          ? 'border-l-emerald-400 dark:border-l-emerald-600'
                          : inv.approvalStatus === 'pending_approval'
                            ? 'border-l-amber-400 dark:border-l-amber-500'
                            : inv.approvalStatus === 'rejected'
                              ? 'border-l-rose-400 dark:border-l-rose-500'
                              : 'border-l-slate-300 dark:border-l-slate-600'
                      }`}
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
                              {(() => {
                                if (inv.lineItems) {
                                  try {
                                    const parsed = JSON.parse(inv.lineItems);
                                    const count = Array.isArray(parsed) ? parsed.filter((i: {desc?: string}) => (i.desc || '').trim()).length : 0;
                                    if (count > 0) return `${count} item${count !== 1 ? 's' : ''}`;
                                  } catch {}
                                }
                                return (inv.description || '').split('\n')[0].slice(0, 60) || '—';
                              })()}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Date & Due Date collapsed */}
                      <TableCell className="py-2 px-3 text-xs whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {formatDateDisplay(inv.dateReceived)}
                          </span>
                          {inv.dueDate ? (
                            inv.isOverdue ? (
                              <span className="text-[10px] text-rose-600 font-semibold inline-flex items-center gap-1 mt-0.5" title={`${inv.daysOverdue} days overdue`}>
                                <span>Due {formatDateDisplay(inv.dueDate)}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 font-bold">
                                  {inv.daysOverdue}d
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Due {formatDateDisplay(inv.dueDate)}
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400/70 mt-0.5">No due date</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          ₦{fmt(inv.totalAmount)}
                        </div>
                        {inv.initialAmount && inv.initialAmount > inv.totalAmount && (
                          <div
                            className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center justify-end gap-0.5"
                            title={`Negotiated from ₦${fmt(inv.initialAmount)} (Saved ₦${fmt(inv.initialAmount - inv.totalAmount)})`}
                          >
                            <TrendingDown className="w-2.5 h-2.5" />
                            <span>-₦{fmt(inv.initialAmount - inv.totalAmount)}</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Paid Amount & Mini Progress */}
                      <TableCell className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={`text-xs font-semibold ${
                            inv.paidAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            ₦{fmt(inv.paidAmount)}
                          </span>
                          {inv.paidAmount > 0 && inv.balanceRemaining > 0 && (
                            <div className="w-14 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${percentPaid}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Balance Due */}
                      <TableCell className="py-2 px-3 text-right whitespace-nowrap">
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
                      <TableCell className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <UnifiedInvoiceStatusBadge
                          invoice={inv}
                          onClickApproval={() => handleOpenApprovalReview(inv)}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.balanceRemaining > 0 && (
                            !isInvoiceApproved(inv) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reason =
                                    inv.approvalStatus === 'pending_approval'
                                      ? `awaiting approval from ${inv.approverName || 'an approver'}`
                                      : inv.approvalStatus === 'rejected'
                                        ? 'rejected'
                                        : 'not approved';
                                  toast.info(`Invoice #${inv.invoiceNumber} is ${reason}. Invoices must be approved before payments can be added.`);
                                }}
                                title={`Payment locked: invoice is ${inv.approvalStatus === 'pending_approval' ? 'awaiting approval' : inv.approvalStatus || 'not approved'}`}
                                className="h-7 px-2.5 text-xs font-semibold border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shadow-xs"
                              >
                                <Lock className="w-3 h-3 mr-1 text-amber-500" />
                                Locked
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRecordPayment(inv)}
                                className="h-7 px-2.5 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs"
                              >
                                <CreditCard className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                                Pay
                              </Button>
                            )
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
        <DialogContent className="max-w-xl sm:max-w-2xl p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
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

            {/* ── Line Items ───────────────────────────────────────────────────── */}
            <div>
              {/* Section header */}
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Line Items <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {lineItemsTotal > 0 && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₦{fmt(lineItemsTotal)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowBulkPaste((v) => !v); setBulkParseError(''); }}
                    className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors border ${
                      showBulkPaste
                        ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                    title="Paste a bulk list and auto-parse into rows"
                  >
                    {showBulkPaste ? '✕ Close bulk paste' : '⚡ Bulk paste'}
                  </button>
                </div>
              </div>

              {/* ── Bulk Paste Panel ── */}
              {showBulkPaste && (
                <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-2">
                  <textarea
                    autoFocus
                    rows={4}
                    value={bulkText}
                    onChange={(e) => { setBulkText(e.target.value); setBulkParseError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleApplyBulkPaste();
                      }
                    }}
                    placeholder={`Paste list here (supports WhatsApp, quotes, spreadsheets):\n1" Pipe — ₦2,200 × 4 pcs = ₦8,800\n1" Elbow — ₦300 × 11 pcs\nLabour — ₦15,000`}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-y focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {bulkParseError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{bulkParseError}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Ctrl+Enter to parse</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowBulkPaste(false)}
                        className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyBulkPaste}
                        disabled={!bulkText.trim()}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors shadow-xs"
                      >
                        Convert to items
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div className="grid grid-cols-[1fr_56px_110px_90px_24px] gap-2 mb-1 px-1">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Item / Description</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Qty</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Price (₦)</span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Total (₦)</span>
                <span />
              </div>

              {/* Table Rows */}
              <div className="space-y-1.5">
                {lineItems.map((li, idx) => {
                  const q = parseFloat(li.qty) || 0;
                  const r = parseAmountInput(li.rate);
                  const lineTotal = q * r;

                  return (
                    <div key={li.id} className="grid grid-cols-[1fr_56px_110px_90px_24px] gap-2 items-center">
                      <input
                        data-linedesc
                        placeholder={idx === 0 ? 'e.g. 1" Pipe or Labour' : 'Description'}
                        value={li.desc}
                        onChange={(e) => updateLine(li.id, 'desc', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addLine(li.id); }
                          if (e.key === 'Backspace' && li.desc === '' && lineItems.length > 1) {
                            e.preventDefault();
                            removeLine(li.id);
                            setTimeout(() => {
                              const all = document.querySelectorAll<HTMLInputElement>('[data-linedesc]');
                              all[Math.max(0, idx - 1)]?.focus();
                            }, 30);
                          }
                        }}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData('text');
                          if (text.includes('\n') && text.trim().split('\n').length > 1) {
                            e.preventDefault();
                            const parsed = parseBulkText(text);
                            if (parsed.length > 0) {
                              setLineItems((prev) => {
                                const before = prev.slice(0, idx).filter((l) => l.desc.trim() || parseAmountInput(l.rate) > 0);
                                const after = prev.slice(idx + 1).filter((l) => l.desc.trim() || parseAmountInput(l.rate) > 0);
                                return [...before, ...parsed, ...after];
                              });
                            }
                          }
                        }}
                        className="h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                      />

                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={li.qty}
                        onChange={(e) => updateLine(li.id, 'qty', e.target.value.replace(/[^0-9.]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addLine(li.id); }
                        }}
                        className="h-8 px-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                      />

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={li.rate}
                        onChange={(e) => updateLine(li.id, 'rate', formatAmountInput(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && idx === lineItems.length - 1)) {
                            e.preventDefault();
                            addLine(li.id);
                          }
                        }}
                        className="h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                      />

                      <div className="h-8 flex items-center justify-end px-1 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        {lineTotal > 0 ? (
                          <span>₦{fmt(lineTotal)}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </div>

                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => removeLine(li.id)}
                        disabled={lineItems.length === 1 && !li.desc && !li.rate}
                        className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 disabled:opacity-0 transition-colors"
                        title="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer: Add item button & Live total summary */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => addLine()}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add line item
                  <span className="ml-1 text-slate-400 text-[10px] font-normal">(or press Enter / Tab)</span>
                </button>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {lineItems.filter((l) => l.desc.trim() || parseAmountInput(l.rate) > 0).length} item{lineItems.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    Total: ₦{fmt(lineItemsTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Due Date (moved here, removed manual amount — it's auto-calculated) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Payment Due Date <span className="text-[11px] font-normal text-slate-400">(optional)</span>
              </label>
              <Input
                type="date"
                value={invDueDate}
                onChange={(e) => setInvDueDate(e.target.value)}
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

          {/* ── Approval Routing Section ── */}
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Approval Routing</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              {/* Route options */}
              <div className="flex flex-wrap gap-1.5">
                {canDirectApprove && (
                  <button
                    type="button"
                    onClick={() => setInvApprovalAction('approve_direct')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      invApprovalAction === 'approve_direct'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Approve Directly
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInvApprovalAction('send_approval')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    invApprovalAction === 'send_approval'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send for Approval
                </button>
                <button
                  type="button"
                  onClick={() => setInvApprovalAction('draft')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    invApprovalAction === 'draft'
                      ? 'bg-slate-600 border-slate-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Save as Draft
                </button>
              </div>
            </div>

            {/* Approver picker */}
            {invApprovalAction === 'send_approval' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select Approver <span className="text-rose-500">*</span>
                </label>
                <select
                  value={invApproverId}
                  onChange={(e) => {
                    const sel = activeUsers.find((u) => u.id === e.target.value);
                    setInvApproverId(e.target.value);
                    setInvApproverName(sel?.name || '');
                  }}
                  className="w-full text-xs h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Choose approver --</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.role ? ` (${u.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Revision note (only when editing) */}
            {editingInvoice && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Revision Note <span className="text-[11px] font-normal text-slate-400">(optional — auto-generated if blank)</span>
                </label>
                <Input
                  placeholder="e.g. Price revised after negotiation"
                  value={invVersionNote}
                  onChange={(e) => setInvVersionNote(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            )}
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
              className={`text-xs h-9 px-5 font-bold shadow-sm transition-all flex items-center gap-1.5 text-white ${
                invApprovalAction === 'approve_direct'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : invApprovalAction === 'send_approval'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              {invApprovalAction === 'approve_direct' && <ShieldCheck className="w-3.5 h-3.5 stroke-[2]" />}
              {invApprovalAction === 'send_approval' && <Send className="w-3.5 h-3.5" />}
              {invApprovalAction === 'draft' && <FileText className="w-3.5 h-3.5" />}
              {invApprovalAction === 'approve_direct'
                ? (editingInvoice ? 'Save & Approve' : 'Record & Approve')
                : invApprovalAction === 'send_approval'
                ? (editingInvoice ? 'Update & Send' : 'Record & Send')
                : (editingInvoice ? 'Save Draft' : 'Save as Draft')}
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
              {/* Approval status warning if somehow opened */}
              {!isInvoiceApproved(payingInvoice) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>This invoice is currently {payingInvoice.approvalStatus === 'pending_approval' ? 'awaiting approval' : (payingInvoice.approvalStatus || 'not approved')}. Payments cannot be recorded until it is approved.</span>
                </div>
              )}

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
              disabled={!isInvoiceApproved(payingInvoice)}
              onClick={handleSavePayment}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white text-xs h-9 px-5 font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {(() => {
                      const items = loadLineItems(detailInvoiceComputed.lineItems, detailInvoiceComputed.description);
                      const hasItems = items.some(i => i.desc.trim());
                      const subtitle = hasItems
                        ? `${items.filter(i => i.desc.trim()).length} line item${items.filter(i => i.desc.trim()).length !== 1 ? 's' : ''}`
                        : (detailInvoiceComputed.description || '').split('\n')[0].slice(0, 80);
                      return subtitle ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
                      ) : null;
                    })()}
                  </div>

                  {detailInvoiceComputed.balanceRemaining > 0 && (
                    !isInvoiceApproved(detailInvoiceComputed) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason =
                            detailInvoiceComputed.approvalStatus === 'pending_approval'
                              ? `awaiting approval from ${detailInvoiceComputed.approverName || 'an approver'}`
                              : detailInvoiceComputed.approvalStatus === 'rejected'
                                ? 'rejected'
                                : 'not approved';
                          toast.info(`Invoice #${detailInvoiceComputed.invoiceNumber} is ${reason}. Invoices must be approved before payments can be added.`);
                        }}
                        title={`Payment locked: invoice is ${detailInvoiceComputed.approvalStatus === 'pending_approval' ? 'awaiting approval' : detailInvoiceComputed.approvalStatus || 'not approved'}`}
                        className="text-xs h-8 px-3 font-semibold border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shadow-xs"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1 text-amber-500" />
                        Payment Locked
                      </Button>
                    ) : (
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
                    )
                  )}
                </div>
              </DialogHeader>

              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Approval & Payment Status Alert Banner */}
                {!isInvoiceApproved(detailInvoiceComputed) && (
                  <div className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                    detailInvoiceComputed.approvalStatus === 'rejected'
                      ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <span>
                            {detailInvoiceComputed.approvalStatus === 'rejected'
                              ? 'Invoice Rejected — Payments Locked'
                              : 'Pending Approval — Payments Locked'}
                          </span>
                        </p>
                        <p className="opacity-90 leading-relaxed text-[11px]">
                          {detailInvoiceComputed.approvalStatus === 'rejected'
                            ? `This invoice was rejected${detailInvoiceComputed.rejectionReason ? `: "${detailInvoiceComputed.rejectionReason}"` : ''}. Payments cannot be added until the invoice is revised and approved.`
                            : `This invoice is awaiting review from ${detailInvoiceComputed.approverName || 'an approver'}. Only approved invoices are eligible for payment disbursements.`}
                        </p>
                      </div>
                    </div>
                    {/* Direct actions from banner */}
                    {detailInvoiceComputed.approvalStatus === 'pending_approval' &&
                     detailInvoiceComputed.approverId === (currentUser?.id || currentUser?.name) ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleOpenApprovalReview(detailInvoiceComputed);
                        }}
                        className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 shadow-xs"
                      >
                        Review Now
                      </Button>
                    ) : detailInvoiceComputed.approvalStatus === 'rejected' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleOpenEditInvoice(detailInvoiceComputed);
                        }}
                        className="h-7 px-2.5 text-xs border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 font-semibold shrink-0"
                      >
                        Revise Invoice
                      </Button>
                    ) : null}
                  </div>
                )}
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

                {/* Line Items Breakdown */}
                {(() => {
                  const items = loadLineItems(detailInvoiceComputed.lineItems, detailInvoiceComputed.description);
                  const hasStructured = items.some(i => i.desc.trim());
                  if (!hasStructured) return null;
                  const total = items.reduce((s, i) => s + (parseFloat(i.qty || '1') || 1) * (parseAmountInput(i.rate)), 0);
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Line Items</span>
                        <span className="text-[10px] text-slate-400">{items.filter(i => i.desc.trim()).length} item{items.filter(i => i.desc.trim()).length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.filter(i => i.desc.trim()).map((item, idx) => {
                          const qty = parseFloat(item.qty || '1') || 1;
                          const rate = parseAmountInput(item.rate);
                          const lineTotal = qty * rate;
                          const hasQtyRate = rate > 0;
                          return (
                            <div key={item.id || idx} className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                                <span className="text-[10px] text-slate-400 font-mono shrink-0 w-4 text-right">{idx + 1}.</span>
                                <span className="text-slate-800 dark:text-slate-200 leading-snug">{item.desc}</span>
                              </div>
                              {hasQtyRate ? (
                                <div className="flex items-baseline gap-3 shrink-0 text-right">
                                  {qty !== 1 && (
                                    <span className="text-[11px] text-slate-400 font-mono">{qty} × ₦{fmt(rate)}</span>
                                  )}
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 font-mono">₦{fmt(lineTotal)}</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {total > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">₦{fmt(total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
                      {!isInvoiceApproved(detailInvoiceComputed) ? (
                        <>
                          <Lock className="w-5 h-5 text-amber-500 mb-0.5" />
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Payments are currently locked</span>
                          <span className="text-[11px] text-slate-400">This invoice must be approved before payments can be recorded.</span>
                        </>
                      ) : (
                        <span>No payments recorded yet for this invoice.</span>
                      )}
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
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg shrink-0">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
              {editingVendorId ? 'Edit Vendor' : 'New Vendor'}
            </DialogTitle>
          </div>

          {/* Body */}
          <div
            className="px-5 py-4 space-y-2.5"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveVendorModal(); } }}
          >
            {/* Name */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">Name</span>
              <input
                autoFocus
                value={vendorFormName}
                onChange={(e) => setVendorFormName(e.target.value)}
                className="flex-1 text-xs font-medium text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Company name"
              />
            </div>

            {/* TIN */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">TIN</span>
              <input
                value={vendorFormTin}
                onChange={(e) => setVendorFormTin(e.target.value)}
                className="flex-1 text-xs font-mono text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Tax ID"
              />
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">Phone</span>
              <input
                type="tel"
                value={vendorFormPhone}
                onChange={(e) => setVendorFormPhone(e.target.value)}
                className="flex-1 text-xs text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Phone number"
              />
            </div>

            {/* Address */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">Address</span>
              <input
                value={vendorFormAddress}
                onChange={(e) => setVendorFormAddress(e.target.value)}
                className="flex-1 text-xs text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Office location"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">Bank</span>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>

            {/* Bank Name */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">Bank</span>
              <input
                list="vendor-bank-suggestions"
                value={vendorFormBankName}
                onChange={(e) => setVendorFormBankName(e.target.value)}
                className="flex-1 text-xs text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Bank name"
              />
              <datalist id="vendor-bank-suggestions">
                {ledgerBanks.map((b) => <option key={b.id} value={b.name} />)}
              </datalist>
            </div>

            {/* Account Number */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 h-10 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">Acct No.</span>
              <input
                value={vendorFormAccountNumber}
                onChange={(e) => setVendorFormAccountNumber(e.target.value)}
                className="flex-1 text-xs font-mono text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Account number"
              />
            </div>

            {/* Notes */}
            <div className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0 pt-0.5">Notes</span>
              <textarea
                rows={2}
                value={vendorFormNotes}
                onChange={(e) => setVendorFormNotes(e.target.value)}
                className="flex-1 text-xs text-slate-900 dark:text-slate-100 bg-transparent outline-none resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder="Payment instructions, terms..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 pb-5 pt-1 gap-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-600">↵ Enter to save</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVendorModalOpen(false)}
                className="text-xs h-8 px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveVendorModal}
                className="text-xs h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                {editingVendorId ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 11. Approval Review Modal ─────────────────────────────────────────── */}
      <Dialog
        open={isApprovalReviewModalOpen}
        onOpenChange={(open) => {
          setIsApprovalReviewModalOpen(open);
          if (!open) { setRejectReason(''); setIsRejectingOpen(false); }
        }}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {reviewingInvoice && (
            <>
              {/* Header */}
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl shrink-0">
                    <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Invoice Approval Required
                    </DialogTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Submitted by <strong>{reviewingInvoice.enteredBy}</strong> · Awaiting your decision
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Invoice summary card */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        #{reviewingInvoice.invoiceNumber}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {reviewingInvoice.vendorName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">₦{fmt(reviewingInvoice.totalAmount)}</span>
                      {reviewingInvoice.dueDate && (
                        <p className={`text-[10px] mt-0.5 ${reviewingInvoice.isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                          Due {formatDateDisplay(reviewingInvoice.dueDate)}{reviewingInvoice.isOverdue ? ' · OVERDUE' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span>Received: {formatDateDisplay(reviewingInvoice.dateReceived)}</span>
                    <span>·</span>
                    <span>By {reviewingInvoice.enteredBy}</span>
                  </div>

                  {/* Per-Line-Item Review */}
                  {(() => {
                    const items = loadLineItems(reviewingInvoice.lineItems, reviewingInvoice.description);
                    const hasItems = items.some(i => i.desc.trim());
                    if (!hasItems) {
                      return (
                        <div className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {reviewingInvoice.description || 'No description provided.'}
                        </div>
                      );
                    }
                    const flaggedCount = Object.values(lineItemDecisions).filter(d => d === 'flagged').length;
                    const approvedCount = Object.values(lineItemDecisions).filter(d => d === 'approved').length;
                    return (
                      <div>
                        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-100/60 dark:bg-slate-800/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Line Items — Review Each</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            {approvedCount > 0 && <span className="text-emerald-600 font-semibold">{approvedCount} ✓</span>}
                            {flaggedCount > 0 && <span className="text-rose-500 font-semibold">{flaggedCount} flagged</span>}
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.filter(i => i.desc.trim()).map((item) => {
                            const decision = lineItemDecisions[item.id] || 'pending';
                            const rate = parseAmountInput(item.rate);
                            const qty = parseFloat(item.qty || '1') || 1;
                            return (
                              <div key={item.id} className={`flex items-center justify-between gap-2 px-4 py-2 transition-colors ${
                                decision === 'approved' ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : decision === 'flagged' ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : ''
                              }`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug">{item.desc}</p>
                                  {rate > 0 && (
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {qty !== 1 ? `${qty} × ` : ''}₦{fmt(rate * qty)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    title="Approve this item"
                                    onClick={() => setLineItemDecisions(prev => ({ ...prev, [item.id]: 'approved' }))}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all text-xs font-bold ${
                                      decision === 'approved'
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'
                                    }`}
                                  >✓</button>
                                  <button
                                    type="button"
                                    title="Flag this item for revision"
                                    onClick={() => setLineItemDecisions(prev => ({ ...prev, [item.id]: 'flagged' }))}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all text-xs font-bold ${
                                      decision === 'flagged'
                                        ? 'bg-rose-500 border-rose-500 text-white'
                                        : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-rose-400 hover:text-rose-500'
                                    }`}
                                  >✗</button>
                                  <button
                                    type="button"
                                    title="Leave pending"
                                    onClick={() => setLineItemDecisions(prev => ({ ...prev, [item.id]: 'pending' }))}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all text-xs ${
                                      decision === 'pending'
                                        ? 'bg-amber-400 border-amber-400 text-white font-bold'
                                        : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-500'
                                    }`}
                                  >~</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {flaggedCount > 0 && (
                          <div className="px-4 py-2 bg-rose-50/60 dark:bg-rose-950/20 border-t border-rose-100 dark:border-rose-900/40">
                            <p className="text-[11px] text-rose-600 dark:text-rose-400">
                              ⚠ {flaggedCount} item{flaggedCount !== 1 ? 's' : ''} flagged — consider rejecting with a note so the submitter can revise.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Negotiated savings indicator */}
                  {reviewingInvoice.initialAmount && reviewingInvoice.initialAmount > reviewingInvoice.totalAmount && (
                    <div className="flex items-center gap-1.5 mx-4 mb-3 p-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 rounded-lg">
                      <TrendingDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                        Negotiated down from ₦{fmt(reviewingInvoice.initialAmount)} — saving ₦{fmt(reviewingInvoice.initialAmount - reviewingInvoice.totalAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Version history (if any) */}
                {reviewingInvoice.versions && reviewingInvoice.versions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revision History</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      {[...reviewingInvoice.versions].reverse().map((v, i) => (
                        <div key={i} className="px-3 py-2 text-xs bg-white dark:bg-slate-900 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{v.note}</p>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                              v{v.version} · {v.editedBy} · {formatDateDisplay(v.editedAt)}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">₦{fmt(v.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection reason input */}
                {isRejectingOpen && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Reason for Rejection <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      autoFocus
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain what needs to be revised..."
                      className="w-full text-xs p-2.5 border border-rose-200 dark:border-rose-800/60 rounded-lg bg-rose-50/40 dark:bg-rose-950/20 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
                {/* Pending badge showing queue info */}
                {myPendingApprovals.length > 1 && (
                  <p className="text-[11px] text-slate-400 mb-3 text-center">
                    {myPendingApprovals.length} invoices awaiting your approval — reviewing 1 of {myPendingApprovals.length}
                  </p>
                )}

                <div className="flex items-center gap-2 justify-end">
                  {!isRejectingOpen ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsApprovalReviewModalOpen(false)}
                        className="text-xs h-9 px-4 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        Review Later
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (reviewingInvoice && !rejectReason.trim()) {
                            const items = loadLineItems(reviewingInvoice.lineItems, reviewingInvoice.description);
                            const flaggedItems = items.filter(i => lineItemDecisions[i.id] === 'flagged');
                            if (flaggedItems.length > 0) {
                              setRejectReason(`Please revise: ${flaggedItems.map(i => i.desc).join(', ')}`);
                            }
                          }
                          setIsRejectingOpen(true);
                        }}
                        className="text-xs h-9 px-4 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold"
                      >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApproveInvoice}
                        className="text-xs h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                        Approve
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRejectingOpen(false)}
                        className="text-xs h-9 px-4 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRejectInvoice}
                        disabled={!rejectReason.trim()}
                        className="text-xs h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm disabled:opacity-50"
                      >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                        Confirm Rejection
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
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
