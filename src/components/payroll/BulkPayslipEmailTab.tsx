import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore, Employee } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  Check,
  RefreshCw,
  X,
  FileText,
  User,
  Building,
  MoreVertical,
  History,
  Pencil,
  CheckCheck,
  AlertCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PayrollRecord {
  id: string;
  employeeCode?: string;
  sn: number;
  surname: string;
  firstname: string;
  position: string;
  department: string;
  staffType: 'OFFICE' | 'FIELD' | 'NON-EMPLOYEE';
  bankName: string;
  accountNo: string;
  salary: number;
  basicSalary: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  totalAllowances: number;
  overtime: number;
  grossPay: number;
  paye: number;
  loanRepayment: number;
  pension: number;
  employerPension: number;
  takeHomePay: number;
  nsitf: number;
  withholdingTaxRate?: number;
  withholdingTax: boolean;
  hasPension?: boolean;
  taxId: string;
  status: 'Pending' | 'Processed';
  daysWorked?: number;
}

export interface PayslipItem {
  monthLabel: string;
  monthKey: string;
  record: any;
}

export interface PayslipEmailLog {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  recipient_email: string;
  year: number;
  months: string[];
  status: 'SENT' | 'FAILED';
  error_message?: string;
  provider: string;
  message_id?: string;
  sent_by?: string;
  created_at: string;
}

export interface EmployeeEmailGroup {
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  position: string;
  bankName: string;
  accountNo: string;
  totalNetPay: number;
  slips: PayslipItem[];
  lastSentLog?: PayslipEmailLog;
  sentCount: number;
}

export interface BulkPayslipEmailTabProps {
  selectedYear: number;
  selectedMonths: string[];
  selectedMonthLabels: string[];
  payslips: any[];
  payslipTheme: 'MODERN' | 'CLASSIC' | 'FORMAL' | 'CORPORATE';
  buildSlipHtml: (slip: any, index: number) => string;
  themeStyles: string;
  companyInfo: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
  isPayrollLocked: boolean;
  unfinalizedMonthsLabels: string[];
  canEmailPayslips: boolean;
}

export function BulkPayslipEmailTab({
  selectedYear,
  selectedMonths,
  selectedMonthLabels,
  payslips,
  payslipTheme,
  buildSlipHtml,
  themeStyles,
  companyInfo,
  isPayrollLocked,
  unfinalizedMonthsLabels,
  canEmailPayslips,
}: BulkPayslipEmailTabProps) {
  const employees = useAppStore((state) => state.employees);
  const updateEmployee = useAppStore((state) => state.updateEmployee);
  const currentUser = useUserStore((state) => state.users.find((u) => u.id === state.currentUserId) ?? null);
  const currentUserName = currentUser?.name || currentUser?.email || 'Administrator';

  // Email settings configuration status
  const [emailConfigState, setEmailConfigState] = useState<{
    loaded: boolean;
    isConfigured: boolean;
    provider: string;
    details: string;
  }>({
    loaded: false,
    isConfigured: false,
    provider: 'resend',
    details: '',
  });

  const checkEmailConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('email_settings')
        .limit(1)
        .maybeSingle();

      const s = data?.email_settings || {};
      const prov = s.provider || (s.smtpHost ? 'smtp' : 'resend');
      let configured = false;
      let details = '';

      if (prov === 'smtp') {
        configured = Boolean(s.smtpHost && s.smtpUser && s.smtpPass);
        details = configured ? `SMTP (${s.smtpHost})` : 'SMTP (Credentials missing)';
      } else {
        configured = Boolean(s.resendApiKey && s.resendApiKey.trim().length > 0);
        details = configured ? `Resend (${s.resendFromEmail || 'onboarding@resend.dev'})` : 'Resend (API key missing)';
      }

      setEmailConfigState({
        loaded: true,
        isConfigured: configured,
        provider: prov,
        details,
      });
    } catch {
      setEmailConfigState({
        loaded: true,
        isConfigured: false,
        provider: 'unknown',
        details: 'Failed to verify configuration',
      });
    }
  }, []);

  useEffect(() => {
    checkEmailConfig();
  }, [checkEmailConfig]);

  // Selection & UI State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsent' | 'sent'>('all');
  const [activeEmailEditId, setActiveEmailEditId] = useState<string | null>(null);
  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});
  const [savingEmailIds, setSavingEmailIds] = useState<Set<string>>(new Set());

  // Email Logs State
  const [emailLogs, setEmailLogs] = useState<PayslipEmailLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLogEmployee, setSelectedLogEmployee] = useState<EmployeeEmailGroup | null>(null);

  // Sending progress state
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);
  const isSendingBatchRef = useRef(false);
  const sendingSingleIdsRef = useRef<Set<string>>(new Set());
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  });

  // 1. Fetch dispatch logs from Supabase for this year
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('payslip_email_logs')
        .select('*')
        .eq('year', selectedYear)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEmailLogs(data as PayslipEmailLog[]);
      }
    } catch (err) {
      console.error('Failed to fetch payslip email logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 2. Group raw payslips by Employee (optimized with O(1) hash maps)
  const employeeGroups = useMemo<EmployeeEmailGroup[]>(() => {
    const map = new Map<string, EmployeeEmailGroup>();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    // Pre-index logs by employee ID for O(1) access
    const logsByEmp = new Map<string, PayslipEmailLog[]>();
    for (let i = 0; i < emailLogs.length; i++) {
      const log = emailLogs[i];
      const arr = logsByEmp.get(log.employee_id);
      if (arr) arr.push(log);
      else logsByEmp.set(log.employee_id, [log]);
    }

    const selectedMonthsSet = new Set(selectedMonths);

    for (let i = 0; i < payslips.length; i++) {
      const item = payslips[i];
      const empId = item.record.id;
      const empRecord = empMap.get(empId);
      const email = empRecord?.email || (item.record as any).email || '';

      if (!map.has(empId)) {
        const empLogs = logsByEmp.get(empId) || [];

        // Match logs that include any of the currently selected months
        const periodLogs = empLogs.filter((log) => {
          if (!Array.isArray(log.months)) return false;
          return log.months.some((m) => selectedMonthsSet.has(m));
        });

        const successfulLogs = periodLogs.filter((l) => l.status === 'SENT');
        const lastSentLog = successfulLogs[0] || empLogs.find((l) => l.status === 'SENT');

        map.set(empId, {
          employeeId: empId,
          employeeCode: item.record.employeeCode || empRecord?.employeeCode || '',
          name: `${item.record.firstname} ${item.record.surname}`,
          email,
          department: item.record.department,
          position: item.record.position,
          bankName: item.record.bankName,
          accountNo: item.record.accountNo,
          totalNetPay: 0,
          slips: [],
          lastSentLog,
          sentCount: successfulLogs.length,
        });
      }

      const g = map.get(empId)!;
      g.slips.push(item);
      g.totalNetPay += item.record.takeHomePay || 0;
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [payslips, employees, emailLogs, selectedMonths]);

  // Initial selection: select all by default when groups load or change
  useEffect(() => {
    setSelectedIds(new Set(employeeGroups.map((g) => g.employeeId)));
  }, [employeeGroups.length]);

  // Filtered employee groups based on search & status filter
  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return employeeGroups.filter((g) => {
      // Search
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.department.toLowerCase().includes(q) ||
        g.employeeCode.toLowerCase().includes(q) ||
        (g.email && g.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status
      if (statusFilter === 'sent') return !!g.lastSentLog;
      if (statusFilter === 'unsent') return !g.lastSentLog;
      return true;
    });
  }, [employeeGroups, searchTerm, statusFilter]);

  // Stats
  const sentCount = useMemo(() => employeeGroups.filter((g) => !!g.lastSentLog).length, [employeeGroups]);
  const unsentCount = employeeGroups.length - sentCount;
  const selectedCount = selectedIds.size;

  // Selection handlers
  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredGroups.map((g) => g.employeeId)));
  };

  const handleSelectUnsent = () => {
    const unsentIds = filteredGroups.filter((g) => !g.lastSentLog).map((g) => g.employeeId);
    setSelectedIds(new Set(unsentIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleSelect = (empId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  // In-place email editing & saving
  const handleSaveEmail = async (empId: string) => {
    const targetEmail = (editedEmails[empId] ?? '').trim();
    if (!targetEmail || !targetEmail.includes('@') || !targetEmail.includes('.')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setSavingEmailIds((prev) => new Set(prev).add(empId));
    try {
      updateEmployee(empId, { email: targetEmail });
      toast.success('Employee email updated successfully.');
      setActiveEmailEditId(null);
    } catch (err: any) {
      console.error('Failed to update email:', err);
      toast.error('Failed to update email: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingEmailIds((prev) => {
        const next = new Set(prev);
        next.delete(empId);
        return next;
      });
    }
  };

  // PDF Generator for an employee
  const generateEmployeeMultiMonthPdf = async (
    group: EmployeeEmailGroup
  ): Promise<{ filename: string; base64Content: string }> => {
    // 1. Ensure fonts are fully loaded
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }

    const container = document.createElement('div');
    // Position at positive origin (0, 0) inside viewport but z-indexed behind everything to avoid negative subpixel floating-point rounding bugs
    container.style.cssText =
      'position: fixed; left: 0; top: 0; width: 794px; background: #ffffff; margin: 0; padding: 0; z-index: -99999; pointer-events: none; opacity: 1;';

    const slipsMarkup = group.slips
      .map(
        (slip, i) =>
          `<div class="pdf-slip-page" data-page="${i}">${buildSlipHtml(
            slip,
            i
          )}</div>`
      )
      .join('');

    container.innerHTML = `<style>
      ${themeStyles}
      .pdf-slip-page {
        width: 794px;
        min-height: 1123px;
        box-sizing: border-box;
        background: #ffffff;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .pdf-slip-page .payslip {
        flex: 1;
        width: 100%;
        min-height: 1123px;
        box-sizing: border-box;
      }
    </style>${slipsMarkup}`;
    document.body.appendChild(container);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageElements = container.querySelectorAll('.pdf-slip-page');

      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794,
          onclone: (clonedDoc) => {
            if (document.fonts) {
              document.fonts.forEach((font) => {
                try {
                  clonedDoc.fonts.add(font);
                } catch (_) {}
              });
            }
          },
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage('a4', 'p');
        }

        // Top-aligned full A4 coverage: fills the standard page naturally without vertical squashing
        const renderHeight = Math.max(297, pdfHeight);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight, undefined, 'FAST');
      }

      const dataUri = pdf.output('datauristring');
      const base64Content = dataUri.split(',')[1] || '';
      const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
      const monthsStr = selectedMonthLabels.join('_');
      const filename = `Payslip_${safeName}_${monthsStr}_${selectedYear}.pdf`;

      return { filename, base64Content };
    } finally {
      document.body.removeChild(container);
    }
  };

  // Helper to construct email HTML body
  const buildEmailHtml = (group: EmployeeEmailGroup, monthsText: string, filename: string) => {
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 18px;">
          <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 20px;">${companyInfo.name}</h2>
          <span style="color: #64748b; font-size: 13px; font-weight: 500;">Confidential Employee Payroll Advice</span>
        </div>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.5; margin-bottom: 16px;">
          Dear <strong>${group.name}</strong>,
        </p>
        
        <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
          Please find attached your official payslip document for <strong>${monthsText} ${selectedYear}</strong>.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; width: 140px;"><strong>Staff ID:</strong></td><td style="padding: 4px 0; font-family: monospace;">${group.employeeCode || '—'}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Department:</strong></td><td style="padding: 4px 0;">${group.department}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Position:</strong></td><td style="padding: 4px 0;">${group.position}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Period:</strong></td><td style="padding: 4px 0;">${monthsText} ${selectedYear}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Take-Home Pay:</strong></td><td style="padding: 4px 0; color: #059669; font-weight: bold; font-size: 15px; font-family: monospace;">₦${group.totalNetPay.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
          </table>
        </div>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          The payslip is attached as a single document (<strong>${filename}</strong>) containing your itemized earnings, deductions, and bank payment confirmation for the period.
        </p>

        <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px;">
          <p style="margin: 0 0 4px 0;">This is a system-generated transmission from DCEL Office Suite. Please retain this email for your financial and tax records.</p>
          ${companyInfo.phone ? `<span>Tel: ${companyInfo.phone} | </span>` : ''}
          ${companyInfo.email ? `<span>Email: ${companyInfo.email}</span>` : ''}
        </div>
      </div>
    `;
  };

  // Dispatch single employee payslip
  const handleSendSingle = async (group: EmployeeEmailGroup) => {
    if (sendingSingleIdsRef.current.has(group.employeeId) || isSendingBatchRef.current) {
      console.warn('Dispatch already in progress for this employee, ignoring duplicate click.');
      return;
    }
    if (!canEmailPayslips) {
      toast.error('You do not have permission to send payslips via email.');
      return;
    }
    if (!isPayrollLocked) {
      toast.error(
        `Cannot send email: Payroll for ${unfinalizedMonthsLabels.join(', ')} is not finalized and locked.`
      );
      return;
    }
    if (emailConfigState.loaded && !emailConfigState.isConfigured) {
      toast.error('Email delivery is not configured. Please enter your Resend API Key or SMTP credentials in Settings > Email.');
      return;
    }

    const targetEmail = (editedEmails[group.employeeId] ?? group.email).trim();
    if (!targetEmail || !targetEmail.includes('@') || !targetEmail.includes('.')) {
      toast.error(`Please provide a valid email address for ${group.name}.`);
      setActiveEmailEditId(group.employeeId);
      return;
    }

    sendingSingleIdsRef.current.add(group.employeeId);
    setSendingSingleId(group.employeeId);
    try {
      // 1. Generate multi-month PDF
      const { filename, base64Content } = await generateEmployeeMultiMonthPdf(group);
      const monthsText = selectedMonthLabels.join(' & ');
      const emailSubject = `Payslip for ${monthsText} ${selectedYear} — ${companyInfo.name}`;
      const emailHtml = buildEmailHtml(group, monthsText, filename);

      // 2. Invoke Edge Function
      const { data, error } = await supabase.functions.invoke('send-payslip-email', {
        body: {
          to: targetEmail,
          subject: emailSubject,
          html: emailHtml,
          attachments: [
            {
              filename,
              content: base64Content,
              contentType: 'application/pdf',
            },
          ],
        },
      });

      let errMsg = '';
      if (error) {
        try {
          if ((error as any).context && typeof (error as any).context.json === 'function') {
            const errBody = await (error as any).context.json();
            errMsg = errBody?.error || errBody?.message || error.message;
          } else {
            errMsg = error.message;
          }
        } catch {
          errMsg = error.message;
        }
      } else if (data && (data.success === false || data.error)) {
        errMsg = data.error || 'Email dispatch failed';
      }

      if (errMsg) {
        // Record failed attempt
        await supabase.from('payslip_email_logs').insert({
          employee_id: group.employeeId,
          employee_name: group.name,
          employee_code: group.employeeCode || null,
          recipient_email: targetEmail,
          year: selectedYear,
          months: selectedMonths,
          status: 'FAILED',
          error_message: errMsg,
          provider: data?.provider || 'resend',
          sent_by: currentUserName,
        });
        throw new Error(errMsg);
      }

      // 3. Record successful send
      await supabase.from('payslip_email_logs').insert({
        employee_id: group.employeeId,
        employee_name: group.name,
        employee_code: group.employeeCode || null,
        recipient_email: targetEmail,
        year: selectedYear,
        months: selectedMonths,
        status: 'SENT',
        provider: data?.provider || 'resend',
        message_id: data?.messageId || data?.data?.id || null,
        sent_by: currentUserName,
      });

      toast.success(`Payslip sent successfully to ${group.name} (${targetEmail})!`);
      await fetchLogs();
    } catch (err: any) {
      console.error(`Failed to send to ${group.name}:`, err);
      toast.error(`Delivery failed: ${err.message || 'Check Email Settings'}`);
      if (err.message && (err.message.includes('onboarding@resend.dev') || err.message.includes('403'))) {
        alert(`Resend Test Sandbox Notice:\n\n${err.message}`);
      }
      await fetchLogs();
    } finally {
      sendingSingleIdsRef.current.delete(group.employeeId);
      setSendingSingleId(null);
    }
  };

  // Dispatch batch of selected employees
  const handleSendBatch = async () => {
    if (isSendingBatchRef.current || sendingSingleIdsRef.current.size > 0) {
      console.warn('Batch dispatch already running, ignoring duplicate trigger.');
      return;
    }
    if (!canEmailPayslips) {
      toast.error('You do not have permission to send payslips via email.');
      return;
    }
    if (!isPayrollLocked) {
      toast.error(
        `Cannot send emails: Payroll for ${unfinalizedMonthsLabels.join(', ')} is not yet finalized and locked.`
      );
      return;
    }
    if (emailConfigState.loaded && !emailConfigState.isConfigured) {
      toast.error('Email delivery is not configured. Please enter your Resend API Key or SMTP credentials in Settings > Email.');
      return;
    }

    const targets = employeeGroups.filter((g) => selectedIds.has(g.employeeId));

    if (targets.length === 0) {
      toast.error('Please select at least one employee to send payslips to.');
      return;
    }

    // Filter valid emails
    const validTargets = targets.filter((g) => {
      const em = (editedEmails[g.employeeId] ?? g.email).trim();
      return em.length > 3 && em.includes('@') && em.includes('.');
    });

    if (validTargets.length === 0) {
      toast.error('None of the selected employees have valid email addresses.');
      return;
    }

    isSendingBatchRef.current = true;
    setIsSendingBatch(true);
    setSendProgress({ current: 0, total: validTargets.length, currentName: '' });

    let successCount = 0;
    const failures: Array<{ name: string; email: string; reason: string }> = [];

    try {
      for (let i = 0; i < validTargets.length; i++) {
        const group = validTargets[i];
        const targetEmail = (editedEmails[group.employeeId] ?? group.email).trim();

        // Auto-save edited email to store if modified
        if (editedEmails[group.employeeId] && editedEmails[group.employeeId] !== group.email) {
          try {
            updateEmployee(group.employeeId, { email: targetEmail });
          } catch (_) { }
        }

        setSendProgress({
          current: i + 1,
          total: validTargets.length,
          currentName: group.name,
        });

        try {
          const { filename, base64Content } = await generateEmployeeMultiMonthPdf(group);
          const monthsText = selectedMonthLabels.join(' & ');
          const emailSubject = `Payslip for ${monthsText} ${selectedYear} — ${companyInfo.name}`;
          const emailHtml = buildEmailHtml(group, monthsText, filename);

          const { data, error } = await supabase.functions.invoke('send-payslip-email', {
            body: {
              to: targetEmail,
              subject: emailSubject,
              html: emailHtml,
              attachments: [
                {
                  filename,
                  content: base64Content,
                  contentType: 'application/pdf',
                },
              ],
            },
          });

          let errMsg = '';
          if (error) {
            try {
              if ((error as any).context && typeof (error as any).context.json === 'function') {
                const errBody = await (error as any).context.json();
                errMsg = errBody?.error || errBody?.message || error.message;
              } else {
                errMsg = error.message;
              }
            } catch {
              errMsg = error.message;
            }
          } else if (data && (data.success === false || data.error)) {
            errMsg = data.error || 'Delivery failed';
          }

          if (errMsg) {
            await supabase.from('payslip_email_logs').insert({
              employee_id: group.employeeId,
              employee_name: group.name,
              employee_code: group.employeeCode || null,
              recipient_email: targetEmail,
              year: selectedYear,
              months: selectedMonths,
              status: 'FAILED',
              error_message: errMsg,
              provider: data?.provider || 'resend',
              sent_by: currentUserName,
            });
            throw new Error(errMsg);
          }

          await supabase.from('payslip_email_logs').insert({
            employee_id: group.employeeId,
            employee_name: group.name,
            employee_code: group.employeeCode || null,
            recipient_email: targetEmail,
            year: selectedYear,
            months: selectedMonths,
            status: 'SENT',
            provider: data?.provider || 'resend',
            message_id: data?.messageId || data?.data?.id || null,
            sent_by: currentUserName,
          });

          successCount++;
        } catch (err: any) {
          console.error(`Error sending to ${group.name}:`, err);
          failures.push({
            name: group.name,
            email: targetEmail,
            reason: err.message || 'Unknown error',
          });
        }
      }
    } finally {
      isSendingBatchRef.current = false;
      setIsSendingBatch(false);
      await fetchLogs();
    }

    if (failures.length === 0) {
      toast.success(`Successfully dispatched ${successCount} payslip email(s)!`);
    } else if (successCount > 0) {
      toast.warning(`Dispatched ${successCount} payslips. ${failures.length} failed. Check alert for details.`);
      alert(
        `Dispatched ${successCount} emails.\n\nFailed (${failures.length}):\n` +
        failures.map((f) => `• ${f.name} (${f.email}): ${f.reason}`).join('\n')
      );
    } else {
      toast.error(`All ${failures.length} dispatches failed. Please check your Email Settings.`);
      const uniqueReasons = Array.from(new Set(failures.map((f) => f.reason)));
      alert(
        `Failed to send emails (${failures.length} employees):\n\n` +
        uniqueReasons.map((r) => `• ${r}`).join('\n\n') +
        `\n\nPlease check your configuration in Settings > Email.`
      );
    }
  };

  // Format date helper
  const formatLogDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Warning Banner if Email Delivery is Unconfigured */}
      {emailConfigState.loaded && !emailConfigState.isConfigured && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Email Provider Not Configured:</strong> Neither Resend API Key nor SMTP credentials are saved in <strong>Settings &gt; Email</strong>. Please configure credentials before sending payslips.
            </span>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
            Setup Required in Settings
          </Badge>
        </div>
      )}

      {/* Top Info Banner if Using Resend Sandbox (onboarding@resend.dev) */}
      {emailConfigState.loaded && emailConfigState.isConfigured && emailConfigState.provider === 'resend' && emailConfigState.details.includes('onboarding@resend.dev') && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between text-xs text-blue-900 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Resend Test Mode:</strong> Sending from <code>onboarding@resend.dev</code> will only deliver to your registered Resend email address. Verify your domain on resend.com or use SMTP for general staff delivery.
            </span>
          </div>
        </div>
      )}

      {/* Top Warning Banner if Payroll is Unlocked */}
      {!isPayrollLocked && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Payroll Not Frozen:</strong> Payroll for{' '}
              <strong>{unfinalizedMonthsLabels.join(', ')}</strong> is not finalized and locked. You can only dispatch emails once the payroll is frozen.
            </span>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
            Sending Disabled
          </Badge>
        </div>
      )}

      {/* Progress Bar Overlay during Batch Sending */}
      {isSendingBatch && (
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 mb-1.5">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>
                Dispatching: <strong>{sendProgress.currentName}</strong> ({sendProgress.current} of{' '}
                {sendProgress.total})
              </span>
            </span>
            <span>{Math.round((sendProgress.current / sendProgress.total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Toolbar & Filter Bar */}
      <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Quick Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors',
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All ({employeeGroups.length})
            </button>
            <button
              onClick={() => setStatusFilter('unsent')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors',
                statusFilter === 'unsent' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Unsent ({unsentCount})
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors',
                statusFilter === 'sent' ? 'bg-white text-slate-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Sent ({sentCount})
            </button>
          </div>

          {/* Quick Select Buttons */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 pl-2">
            <span>Select:</span>
            <button onClick={handleSelectAll} className="text-blue-600 hover:underline font-medium">
              All
            </button>
            <span>·</span>
            <button onClick={handleSelectUnsent} className="text-blue-600 hover:underline font-medium">
              Unsent
            </button>
            <span>·</span>
            <button onClick={handleDeselectAll} className="text-slate-500 hover:underline font-medium">
              None
            </button>
          </div>
        </div>

        {/* Search Bar & Bulk Action */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff, code, or email..."
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleSendBatch}
            disabled={isSendingBatch || selectedCount === 0 || !isPayrollLocked || !canEmailPayslips}
            className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 shrink-0"
          >
            {isSendingBatch ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>Send Selected ({selectedCount})</span>
          </Button>
        </div>
      </div>

      {/* Main Employee Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
                    checked={
                      filteredGroups.length > 0 &&
                      filteredGroups.every((g) => selectedIds.has(g.employeeId))
                    }
                    onChange={(e) => {
                      if (e.target.checked) handleSelectAll();
                      else handleDeselectAll();
                    }}
                  />
                </th>
                <th className="py-2.5 px-3">Staff Member</th>
                <th className="py-2.5 px-3">Department &amp; Position</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Net Pay</th>
                <th className="py-2.5 px-3">Delivery Status</th>
                <th className="py-2.5 px-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No employees match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((item) => {
                  const isChecked = selectedIds.has(item.employeeId);
                  const currentEmail = (editedEmails[item.employeeId] ?? item.email).trim();
                  const isEditingEmail = activeEmailEditId === item.employeeId;
                  const isSavingThis = savingEmailIds.has(item.employeeId);
                  const isSendingThis = sendingSingleId === item.employeeId;
                  const hasEmail = currentEmail.length > 3 && currentEmail.includes('@');

                  return (
                    <tr
                      key={item.employeeId}
                      className={cn(
                        'hover:bg-slate-50/80 transition-colors',
                        isChecked ? 'bg-blue-50/30' : ''
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleSelect(item.employeeId)}
                        />
                      </td>

                      {/* Staff Member */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {item.employeeCode || '—'}
                        </div>
                      </td>

                      {/* Department & Position */}
                      <td className="py-3 px-3">
                        <div className="text-slate-700 font-medium">{item.department}</div>
                        <div className="text-[11px] text-slate-400">{item.position}</div>
                      </td>

                      {/* Email Address */}
                      <td className="py-3 px-3">
                        {isEditingEmail ? (
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <Input
                              type="email"
                              value={editedEmails[item.employeeId] ?? item.email}
                              onChange={(e) =>
                                setEditedEmails((prev) => ({
                                  ...prev,
                                  [item.employeeId]: e.target.value,
                                }))
                              }
                              placeholder="e.g. name@dcel.com"
                              className="h-7 text-xs bg-white border-blue-400"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveEmail(item.employeeId)}
                              disabled={isSavingThis}
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              {isSavingThis ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveEmailEditId(null)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            {hasEmail ? (
                              <span className="text-slate-700 font-mono text-[11.5px] truncate max-w-[200px]">
                                {currentEmail}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <AlertTriangle className="h-3 w-3" /> Missing Email
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEmailEditId(item.employeeId);
                                if (editedEmails[item.employeeId] === undefined) {
                                  setEditedEmails((prev) => ({
                                    ...prev,
                                    [item.employeeId]: item.email,
                                  }));
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                              title="Edit Email Address"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Net Pay */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">
                        ₦{item.totalNetPay.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3 px-3">
                        {item.lastSentLog ? (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Sent {formatLogDate(item.lastSentLog.created_at)}</span>
                            </span>
                            {item.sentCount > 1 && (
                              <span className="text-[10px] text-slate-400 mt-0.5 pl-1">
                                Sent {item.sentCount} times
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>Not Sent</span>
                          </span>
                        )}
                      </td>

                      {/* 3-Dot Action Menu */}
                      <td className="py-3 px-3 text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                            >
                              {isSendingThis ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 shadow-md">
                            <DropdownMenuItem
                              onClick={() => handleSendSingle(item)}
                              disabled={isSendingBatch || isSendingThis || !isPayrollLocked || !canEmailPayslips}
                              className="gap-2 cursor-pointer text-xs font-medium text-slate-700 focus:bg-blue-50 focus:text-blue-700"
                            >
                              <Send className="h-3.5 w-3.5 text-blue-600" />
                              <span>{item.lastSentLog ? 'Resend Payslip' : 'Send Payslip'}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setSelectedLogEmployee(item)}
                              className="gap-2 cursor-pointer text-xs font-medium text-slate-700 focus:bg-slate-50"
                            >
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              <span>View Dispatch Logs</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => {
                                setActiveEmailEditId(item.employeeId);
                                if (editedEmails[item.employeeId] === undefined) {
                                  setEditedEmails((prev) => ({
                                    ...prev,
                                    [item.employeeId]: item.email,
                                  }));
                                }
                              }}
                              className="gap-2 cursor-pointer text-xs font-medium text-slate-700 focus:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              <span>Edit Email Address</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch History Modal for Selected Employee */}
      {selectedLogEmployee && (
        <Dialog open={!!selectedLogEmployee} onOpenChange={(open) => !open && setSelectedLogEmployee(null)}>
          <DialogContent className="max-w-xl p-0 rounded-xl overflow-hidden border border-slate-200 shadow-2xl">
            <DialogHeader className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold text-slate-900">
                    Dispatch History — {selectedLogEmployee.name}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedLogEmployee.employeeCode || '—'} · {selectedLogEmployee.email || 'No email registered'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLogEmployee(null)}
                className="h-8 w-8 p-0 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {(() => {
                const logsForEmp = emailLogs.filter((l) => l.employee_id === selectedLogEmployee.employeeId);

                if (logsForEmp.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No email dispatches recorded for this employee yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {logsForEmp.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                                log.status === 'SENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              )}
                            >
                              {log.status === 'SENT' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                              {log.status}
                            </span>
                            <span className="font-semibold text-slate-700">
                              {Array.isArray(log.months) ? log.months.join(', ') : log.months} {log.year}
                            </span>
                          </div>

                          <div className="text-slate-500 text-[11px]">
                            Sent to: <span className="font-mono text-slate-700">{log.recipient_email}</span>
                          </div>

                          {log.error_message && (
                            <div className="text-rose-600 text-[11px] bg-rose-50 p-1.5 rounded border border-rose-100 mt-1">
                              <strong>Error:</strong> {log.error_message}
                            </div>
                          )}

                          <div className="text-slate-400 text-[10px] pt-0.5">
                            Provider: <span className="uppercase">{log.provider}</span> · Triggered by:{' '}
                            {log.sent_by || 'Admin'}
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-400 shrink-0">
                          {formatLogDate(log.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLogEmployee(null)}
                className="text-xs h-8"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const emp = selectedLogEmployee;
                  setSelectedLogEmployee(null);
                  handleSendSingle(emp);
                }}
                disabled={!isPayrollLocked || !canEmailPayslips}
                className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Send className="h-3 w-3" />
                <span>Resend Payslip Now</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

