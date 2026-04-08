import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { normalizeDate } from '@/src/lib/dateUtils';
import { Input } from '@/src/components/ui/input';
import {
  Clock, FileText, UserPlus, UserMinus, Users, Building, Activity,
  CalendarDays, Check, Search, AlertCircle, Mail, RotateCcw,
  ShieldCheck, CalendarCheck2, FileSignature, GraduationCap, Package,
  ChevronDown, ChevronUp, Lock, Unlock, Siren, UserCheck, Pencil, PauseCircle, PlayCircle, X, CheckCircle2
} from 'lucide-react';
import { useAppStore, Employee, OnboardingTask, OnboardingChecklist, GuarantorInfo } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';

// ─── Default blank checklist ──────────────────────────────────
function makeDefaultChecklist(noOfGuarantors: number): OnboardingChecklist {
  return {
    // 1. Send Necessary Information
    emailFormsSent: false,
    emailFormsAcknowledged: false,
    // 2. Return of Forms
    formsReturned: false,
    guarantorFormsReturned: false,
    guarantorPassportReturned: false,
    personalEmployeeFormReturned: false,
    personalEmployeePassportReturned: false,
    // 3. Verification of Documents
    guarantors: Array.from({ length: noOfGuarantors }, () => ({ name: '', phone: '', verified: false })),
    passportPhotos: false,
    addressVerification: false,
    verifiedAddress: '',
    educationalCredentials: false,
    bankName: '',
    accountNo: '',
    accountDetailsVerified: false,
    pensionVerified: false,
    pensionNumberInput: '',
    payeVerified: false,
    payeNumberInput: '',
    // 4. Employment Letters
    employmentLetterPrinted: false,
    employmentLetterSigned: false,
    employmentLetterFiled: false,
    employmentLettersIssued: false,
    // 5. Resumption
    verifiedStartDate: '',
    // 6. Post Onboarding - Orientation
    orientationDone: false,
    hrOrientation: false,
    departmentOrientation: false,
    siteOrientation: false,
    hseOrientation: false,
    // 7. PPE, Handbook & Requirements
    ppeHandbookIssued: false,
    ppeIssued: false,
    handbookProvided: false,
    otherRequirementsSupplied: false,
    // 8. Health insurance (LASHMA)
    lashmaPolicyNumber: '',
    lashmaRegistrationDate: '',
    lashmaExpiryDate: '',
    lashmaVerified: false,
  };
}

// ─── Completion predicates ────────────────────────────────────
// ── "Done" = compulsory fields complete (verified checks are optional/advisory)
const task1Done = (cl: OnboardingChecklist) => cl.emailFormsSent && cl.emailFormsAcknowledged;
const task21Done = (cl: OnboardingChecklist) => cl.guarantorFormsReturned && cl.guarantorPassportReturned;
const task22Done = (cl: OnboardingChecklist) => cl.personalEmployeeFormReturned && cl.personalEmployeePassportReturned;
// task2Done: both guarantor form + personal employee form (and passport photos) returned
const task2Done = (cl: OnboardingChecklist) => task21Done(cl) && task22Done(cl);
// 3.1: name+phone filled for every guarantor (verified is advisory, not blocking)
const task31Done = (cl: OnboardingChecklist) => cl.guarantors.length > 0 && cl.guarantors.every(g => g.name.trim() && g.phone.trim());
const task32DocsDone = (cl: OnboardingChecklist) => cl.passportPhotos && cl.addressVerification && cl.educationalCredentials;
// Account: bank + account no filled (optional for progress)
const task32AccDone = (cl: OnboardingChecklist) => cl.bankName.trim() !== '' && cl.accountNo.trim() !== '';
// Pension/PAYE: number filled (optional for progress)
const task32PensionDone = (cl: OnboardingChecklist) => cl.pensionNumberInput.trim() !== '';
const task32PayeDone = (cl: OnboardingChecklist) => cl.payeNumberInput.trim() !== '';
const task3Done = (cl: OnboardingChecklist) => task31Done(cl) && task32DocsDone(cl);
// task4 = Resumption (official start date confirmed); task5 = all 3 employment letter steps done
const task4Done = (cl: OnboardingChecklist) => cl.verifiedStartDate.trim() !== '';
const task5Done = (cl: OnboardingChecklist) => !!(cl.employmentLetterPrinted && cl.employmentLetterSigned && cl.employmentLetterFiled);
const allCriticalDone = (cl: OnboardingChecklist) =>
  task1Done(cl) && task2Done(cl) && task3Done(cl) && task4Done(cl) && task5Done(cl);

// Advisory "fully verified" helpers (show pending badge only — don't block)
const task31FullyVerified = (cl: OnboardingChecklist) => cl.guarantors.every(g => g.verified);
const task32AccVerified = (cl: OnboardingChecklist) => cl.accountDetailsVerified;
const task32PensionVerified = (cl: OnboardingChecklist) => cl.pensionVerified;
const task32PayeVerified = (cl: OnboardingChecklist) => cl.payeVerified;

// ─── UI: Section wrapper ──────────────────────────────────────
function Section({
  icon: Icon, label, color, children, defaultOpen = true, locked = false, lockMsg,
}: {
  icon: React.ElementType; label: string; color: string;
  children: React.ReactNode; defaultOpen?: boolean; locked?: boolean; lockMsg?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (locked) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden opacity-50">
        <div className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold bg-slate-100 text-slate-400 gap-2`}>
          <span className="flex items-center gap-2"><Lock className="h-4 w-4" />{label}</span>
          <span className="text-[11px] font-normal italic">{lockMsg || 'Complete previous task to unlock'}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      <button
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold ${color} gap-2 hover:opacity-90 transition-opacity`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
        {open ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
      </button>
      {open && <div className="p-4 bg-white dark:bg-slate-900 space-y-3">{children}</div>}
    </div>
  );
}

// ─── UI: Subsection ───────────────────────────────────────────
function SubSection({
  label, children, locked = false, lockMsg, done = false,
}: {
  label: string; children: React.ReactNode; locked?: boolean; lockMsg?: string; done?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (locked) {
    return (
      <div className="rounded-lg border border-slate-200 overflow-hidden opacity-40 mt-2">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-100 text-slate-400 text-xs font-bold">
          <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" />{label}</span>
          <span className="text-[10px] font-normal italic">{lockMsg || 'Complete previous step first'}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border overflow-hidden mt-2 transition-colors ${done ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100'}`}>
      <button
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold gap-1 transition-opacity hover:opacity-90 ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-1.5">
          {done ? <Check className="h-3 w-3 text-emerald-600" /> : null}
          {label}
        </span>
        {open ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {open && <div className="p-3 space-y-2 bg-white dark:bg-slate-900">{children}</div>}
    </div>
  );
}

// ─── UI: Checkbox row ─────────────────────────────────────────
function CheckRow({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div
          className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white dark:bg-slate-800 group-hover:border-indigo-400'}
            ${disabled ? 'border-slate-200 bg-slate-50' : ''}`}
          onClick={() => !disabled && onChange(!checked)}
        >
          {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
        <span className={`text-sm font-medium ${checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{label}</span>
      </label>
      {disabled && hint && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1 ml-8">
          <Lock className="h-3 w-3" /> {hint}
        </p>
      )}
    </div>
  );
}

// ─── UI: Labeled Input ────────────────────────────────────────
function LabeledInput({ label, value, onChange, placeholder, type = 'text', disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      <Input
        type={type}
        className="h-9 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Status badge helper ──────────────────────────────────────
function DoneBadge({ done }: { done: boolean }) {
  return done
    ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Check className="h-2.5 w-2.5" />Done</span>
    : <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Pending</span>;
}

// ─── Main Component ───────────────────────────────────────────
export function Onboarding() {
  const employees = useAppStore(s => s.employees);
  const updateEmployee = useAppStore(s => s.updateEmployee);
  const departments = useAppStore(s => s.departments);
  const positions = useAppStore(s => s.positions);
  const ledgerBeneficiaryBanks = useAppStore(s => s.ledgerBeneficiaryBanks);
  const priv = usePriv('onboarding');
  const privUsers = usePriv('users');
  const isAdmin = privUsers.canManage;
  const navigate = useNavigate();
  const { createMainTask, subtasks, updateSubtaskStatus, addReminder, reminders } = useAppData();
  const { user } = useAuth();
  const hrVariables = useAppStore(s => s.hrVariables);
  const l = hrVariables.onboardingStageLabels || {};

  // Local buffer for account number to avoid keystroke-delete bug (store update on every key causes re-render)
  const [localAccountNo, setLocalAccountNo] = useState('');
  const accountNoInitialized = useRef(false);

  const [leftTab, setLeftTab] = useState<'Active' | 'Pending' | 'Terminated'>('Active');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  // Tracks whether the active-employee checklist is in edit vs. view-only mode
  const [checklistEditMode, setChecklistEditMode] = useState(false);

  // ── Edit pending employee modal ───────────────────────────
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const openEdit = (emp: Employee, e: React.MouseEvent) => { e.stopPropagation(); setEditEmp({ ...emp }); };
  const closeEdit = () => setEditEmp(null);
  const saveEdit = () => {
    if (!editEmp) return;
    const currentEmp = employees.find(e => e.id === editEmp.id);
    const newCount = editEmp.noOfGuarantors ?? 2;
    // Sync guarantors array to the new count, preserving existing entries
    let updatedChecklist = currentEmp?.onboardingChecklist;
    if (updatedChecklist) {
      const existing = updatedChecklist.guarantors ?? [];
      if (existing.length !== newCount) {
        const synced = Array.from({ length: newCount }, (_, i) =>
          existing[i] ?? { name: '', phone: '', verified: false }
        );
        updatedChecklist = { ...updatedChecklist, guarantors: synced };
      }
    }
    updateEmployee(editEmp.id, {
      department: editEmp.department,
      position: editEmp.position,
      staffType: editEmp.staffType,
      tentativeStartDate: editEmp.tentativeStartDate,
      probationPeriod: editEmp.probationPeriod,
      noOfGuarantors: newCount,
      ...(updatedChecklist ? { onboardingChecklist: updatedChecklist } : {}),
    });
    toast.success('Employee details updated.');
    closeEdit();
  };
  // ── Suspend / Resume toggle for Onboarding employees ─────────────
  const handleSuspendToggle = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    const suspending = !emp.onboardingSuspended;
    updateEmployee(emp.id, { onboardingSuspended: suspending });
    toast.info(suspending
      ? `${emp.firstname} ${emp.surname}’s onboarding has been suspended.`
      : `${emp.firstname} ${emp.surname}’s onboarding has been resumed.`
    );
  };

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const [activeTaskType, setActiveTaskType] = useState<'Onboarding' | 'History' | 'Offboarding' | null>(null);

  const activeEmployees = useMemo(() => filterAndSortEmployeesExcludingCEO(employees.filter(e => e.status === 'Active' && e.staffType !== 'NON-EMPLOYEE' && !e.excludeFromOnboarding)), [employees]);
  const pendingEmployees = useMemo(() => filterAndSortEmployeesExcludingCEO(employees.filter(e => e.status === 'Onboarding' && e.staffType !== 'NON-EMPLOYEE' && !e.excludeFromOnboarding)), [employees]);
  const terminatedEmployees = useMemo(() => filterAndSortEmployeesExcludingCEO(employees.filter(e => e.status === 'Terminated' && e.staffType !== 'NON-EMPLOYEE' && !e.excludeFromOnboarding)), [employees]);

  const filterEmps = (list: Employee[]) => {
    if (!employeeSearchQuery) return list;
    const q = employeeSearchQuery.toLowerCase();
    return list.filter(e =>
      e.firstname.toLowerCase().includes(q) ||
      e.surname.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q)
    );
  };
  const filteredActive = useMemo(() => filterEmps(activeEmployees), [activeEmployees, employeeSearchQuery]);
  const filteredPending = useMemo(() => filterEmps(pendingEmployees), [pendingEmployees, employeeSearchQuery]);
  const filteredTerminated = useMemo(() => filterEmps(terminatedEmployees), [terminatedEmployees, employeeSearchQuery]);

  const hasIncompleteTasks = (tasks?: OnboardingTask[]) => tasks?.some(t => t.status !== 'Completed') ?? false;

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployeeId(emp.id);
    setChecklistEditMode(false);
    if (emp.status === 'Onboarding') setActiveTaskType('Onboarding');
    else if (emp.status === 'Active') setActiveTaskType(emp.onboardingTasks?.some(t => t.status !== 'Completed') ? 'Onboarding' : 'History');
    else if (emp.status === 'Terminated') setActiveTaskType('Offboarding');
  };

  // ── Active checklist ──────────────────────────────────────
  const cl: OnboardingChecklist = useMemo(() => {
    const count = Math.max(2, selectedEmployee?.noOfGuarantors ?? 2);
    const defaultCl = makeDefaultChecklist(count);
    if (!selectedEmployee) return defaultCl;
    const storedCl = (selectedEmployee.onboardingChecklist || {}) as Partial<OnboardingChecklist>;
    
    // Ensure guarantors array reflects the required count (pad with defaults if too small)
    const storedGuarantors = storedCl.guarantors || [];
    const syncedGuarantors = Array.from({ length: Math.max(count, storedGuarantors.length) }, (_, i) => 
      storedGuarantors[i] || { name: '', phone: '', verified: false }
    );

    return { ...defaultCl, ...storedCl, guarantors: syncedGuarantors };
  }, [selectedEmployee]);

  // Sync localAccountNo whenever the selected employee changes
  useEffect(() => {
    accountNoInitialized.current = false;
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!accountNoInitialized.current) {
      setLocalAccountNo(cl.accountNo ?? '');
      accountNoInitialized.current = true;
    }
  }, [cl.accountNo]);

  const updateCL = (patch: Partial<OnboardingChecklist>) => {
    if (!selectedEmployee) return;
    const newCL = { ...cl, ...patch };
    
    // Sync LASHMA fields to the main employee record if they are being updated
    const syncPatch: any = { onboardingChecklist: newCL };
    if (patch.lashmaPolicyNumber !== undefined) syncPatch.lashmaPolicyNumber = patch.lashmaPolicyNumber;
    if (patch.lashmaRegistrationDate !== undefined) syncPatch.lashmaRegistrationDate = patch.lashmaRegistrationDate;
    if (patch.lashmaExpiryDate !== undefined) syncPatch.lashmaExpiryDate = patch.lashmaExpiryDate;

    updateEmployee(selectedEmployee.id, syncPatch);

    // Manage LASHMA Renewal Reminder if expiry date is updated
    if (patch.lashmaExpiryDate) {
      const expiry = new Date(patch.lashmaExpiryDate);
      const remindAt = new Date(expiry);
      remindAt.setDate(remindAt.getDate() - 7);
      
      const title = `LASHMA Renewal: ${selectedEmployee.firstname} ${selectedEmployee.surname}`;
      // Basic check to avoid duplicates: find existing active reminder with same title
      const existing = reminders.find(r => r.title === title && r.isActive);
      
      if (!existing || existing.remindAt !== remindAt.toISOString()) {
        addReminder({
          title,
          body: `Health insurance (LASHMA) for ${selectedEmployee.firstname} ${selectedEmployee.surname} expires on ${patch.lashmaExpiryDate}. Please initiate renewal.`,
          remindAt: remindAt.toISOString(),
          recipientIds: user?.id ? [user.id] : [], 
          frequency: 'once', 
          isActive: true
        });
      }
    }
  };

  const updateGuarantor = (i: number, field: keyof GuarantorInfo, value: string | boolean) => {
    const guarantors = cl.guarantors.map((g, idx) => idx === i ? { ...g, [field]: value } : g);
    // if clearing a field, unverify that guarantor
    updateCL({ guarantors });
  };

  const criticalDone = allCriticalDone(cl);

  // ── Computed unlock flags ─────────────────────────────────
  const t1Done = task1Done(cl);
  const t2Unlocked = t1Done;
  const t21Done = task21Done(cl);
  const t22Done = task22Done(cl);
  const t2FullDone = t21Done && t22Done;  // no formsReturned gate
  const t3Unlocked = t1Done && t2FullDone;
  // Within task 3 — unlock by compulsory fields only
  const t31Done = task31Done(cl);
  const t32DocsDone = task32DocsDone(cl);
  const t32AccDone = task32AccDone(cl);
  const t32PensionDone = task32PensionDone(cl);
  const t32PayeDone = task32PayeDone(cl);
  const t3Done = task3Done(cl);
  const t4Unlocked = t3Done;   // Resumption unlocks after Task 3
  const t4Done = task4Done(cl); // Resumption done
  const t5Unlocked = t4Done;   // Employment Letters unlock after Resumption
  const t5Done = task5Done(cl); // Employment Letters done
  // Advisory verified flags
  const allGuarantorsVerified = task31FullyVerified(cl);
  const accVerified = task32AccVerified(cl);
  const pensionVerified = task32PensionVerified(cl);
  const payeVerified = task32PayeVerified(cl);

  // ── Activate ──────────────────────────────────────────────
  const handleActivate = async () => {
    if (!selectedEmployee) return;
    if (!criticalDone) { toast.error('Complete all required tasks (1–5) before activation.'); return; }
    const ok = await showConfirm(
      `Activate ${selectedEmployee.firstname} ${selectedEmployee.surname}? Verified start date (${cl.verifiedStartDate}) will become their official start date.`,
      { confirmLabel: 'Activate Employee' }
    );
    if (!ok) return;

    const startDate = cl.verifiedStartDate || selectedEmployee.startDate;
    
    // Auto-spawn probation evaluation reminder if applicable
    if (selectedEmployee.probationPeriod && selectedEmployee.probationPeriod > 0 && addReminder && user) {
      const evaluationDate = new Date(startDate);
      evaluationDate.setDate(evaluationDate.getDate() + selectedEmployee.probationPeriod);
      evaluationDate.setHours(8, 0, 0, 0);
      try {
        await addReminder({
          title: `Probation Evaluation: ${selectedEmployee.firstname} ${selectedEmployee.surname}`,
          body: `Reminder to conduct a ${selectedEmployee.probationPeriod}-day probation evaluation for ${selectedEmployee.firstname} ${selectedEmployee.surname} (${selectedEmployee.department} - ${selectedEmployee.position}).`,
          remindAt: evaluationDate.toISOString(),
          frequency: 'once',
          recipientIds: [user.id],
          createdBy: user.id,
          isActive: true,
          sendEmail: false
        });
      } catch (e) {
        console.error("Failed to create probation evaluation reminder", e);
      }
    }

    updateEmployee(selectedEmployee.id, {
      status: 'Active',
      startDate: startDate,
      verifiedStartDate: cl.verifiedStartDate,
      bankName: cl.bankName || selectedEmployee.bankName,
      accountNo: cl.accountNo || selectedEmployee.accountNo,
      pensionNumber: cl.pensionNumberInput || selectedEmployee.pensionNumber,
      payeNumber: cl.payeNumberInput || selectedEmployee.payeNumber,
      lashmaPolicyNumber: cl.lashmaPolicyNumber || selectedEmployee.lashmaPolicyNumber,
      lashmaRegistrationDate: cl.lashmaRegistrationDate || selectedEmployee.lashmaRegistrationDate,
      lashmaExpiryDate: cl.lashmaExpiryDate || selectedEmployee.lashmaExpiryDate,
      onboardingChecklist: cl,
    });
    toast.success(`${selectedEmployee.firstname} ${selectedEmployee.surname} is now ACTIVE! ðŸŽ‰`);
  };

  const handleMarkAllAsOnboarded = async () => {
    if (pendingEmployees.length === 0) return;
    const ok = await showConfirm(
      `Mark all ${pendingEmployees.length} pending hires as "Onboarding Complete"? This will bypass the manual checklist and move them to the Active staff list immediately.`,
      { variant: 'default', confirmLabel: 'Mark All Complete' }
    );
    if (!ok) return;

    pendingEmployees.forEach(emp => {
      const defaultCL = makeDefaultChecklist(emp.noOfGuarantors ?? 2);
      // Fill in critical fields as true/done and pull existing details
      const fullCL: OnboardingChecklist = {
        ...defaultCL,
        emailFormsSent: true,
        emailFormsAcknowledged: true,
        formsReturned: true,
        guarantorFormsReturned: true,
        personalEmployeeFormReturned: true,
        passportPhotos: true,
        addressVerification: true,
        educationalCredentials: true,
        bankName: emp.bankName || '',
        accountNo: emp.accountNo || '',
        accountDetailsVerified: true,
        pensionNumberInput: emp.pensionNumber || '',
        pensionVerified: true,
        payeNumberInput: emp.payeNumber || '',
        payeVerified: true,
        lashmaPolicyNumber: emp.lashmaPolicyNumber || '',
        lashmaRegistrationDate: emp.lashmaRegistrationDate || '',
        lashmaExpiryDate: emp.lashmaExpiryDate || '',
        lashmaVerified: !!emp.lashmaPolicyNumber,
        employmentLetterPrinted: true,
        employmentLetterSigned: true,
        employmentLetterFiled: true,
        employmentLettersIssued: true,
        verifiedStartDate: emp.startDate,
        orientationDone: true,
        hrOrientation: true,
        ppeHandbookIssued: true,
      };
      
      updateEmployee(emp.id, {
        status: 'Active',
        startDate: emp.startDate,
        verifiedStartDate: emp.startDate,
        onboardingChecklist: fullCL,
      });
    });
    toast.success(`Successfully onboarded all ${pendingEmployees.length} staff!`);
  };

  const handleBulkCompleteSteps = async () => {
    if (!selectedEmployee) return;
    const ok = await showConfirm(
      `Mark all onboarding steps as "Complete" for ${selectedEmployee.firstname}? This will fill the audit trail for this employee if it was partially filled.`,
      { variant: 'default', confirmLabel: 'Bulk Complete' }
    );
    if (!ok) return;

    const defaultCL = makeDefaultChecklist(selectedEmployee.noOfGuarantors ?? 2);
    const fullCL: OnboardingChecklist = {
      ...defaultCL,
      ...selectedEmployee.onboardingChecklist, // preserve what's there
      emailFormsSent: true,
      emailFormsAcknowledged: true,
      formsReturned: true,
      guarantorFormsReturned: true,
      guarantorPassportReturned: true,
      personalEmployeeFormReturned: true,
      personalEmployeePassportReturned: true,
      passportPhotos: true,
      addressVerification: true,
      educationalCredentials: true,
      bankName: selectedEmployee.onboardingChecklist?.bankName || selectedEmployee.bankName || '',
      accountNo: selectedEmployee.onboardingChecklist?.accountNo || selectedEmployee.accountNo || '',
      pensionNumberInput: selectedEmployee.onboardingChecklist?.pensionNumberInput || selectedEmployee.pensionNumber || '',
      payeNumberInput: selectedEmployee.onboardingChecklist?.payeNumberInput || selectedEmployee.payeNumber || '',
      lashmaPolicyNumber: selectedEmployee.onboardingChecklist?.lashmaPolicyNumber || selectedEmployee.lashmaPolicyNumber || '',
      lashmaRegistrationDate: selectedEmployee.onboardingChecklist?.lashmaRegistrationDate || selectedEmployee.lashmaRegistrationDate || '',
      lashmaExpiryDate: selectedEmployee.onboardingChecklist?.lashmaExpiryDate || selectedEmployee.lashmaExpiryDate || '',
      accountDetailsVerified: true,
      pensionVerified: true,
      payeVerified: true,
      lashmaVerified: true,
      employmentLetterPrinted: true,
      employmentLetterSigned: true,
      employmentLetterFiled: true,
      employmentLettersIssued: true,
      orientationDone: true,
      hrOrientation: true,
      ppeHandbookIssued: true,
    };
    updateEmployee(selectedEmployee.id, { onboardingChecklist: fullCL });
    toast.success(`Onboarding steps marked as complete for ${selectedEmployee.firstname}!`);
  };

  const handleMarkAllActiveAsOnboardingComplete = async () => {
    if (activeEmployees.length === 0) return;
    const ok = await showConfirm(
      `Mark all ${activeEmployees.length} active staff onboarding checklists as "Complete"? This will bypass manual ticking and fill the audit trails for all currently active staff.`,
      { variant: 'default', confirmLabel: 'Bulk Complete All' }
    );
    if (!ok) return;

    activeEmployees.forEach(emp => {
      const defaultCL = makeDefaultChecklist(emp.noOfGuarantors ?? 2);
      const fullCL: OnboardingChecklist = {
        ...defaultCL,
        ...emp.onboardingChecklist,
        emailFormsSent: true,
        emailFormsAcknowledged: true,
        formsReturned: true,
        guarantorFormsReturned: true,
        guarantorPassportReturned: true,
        personalEmployeeFormReturned: true,
        personalEmployeePassportReturned: true,
        passportPhotos: true,
        addressVerification: true,
        educationalCredentials: true,
        bankName: emp.onboardingChecklist?.bankName || emp.bankName || '',
        accountNo: emp.onboardingChecklist?.accountNo || emp.accountNo || '',
        pensionNumberInput: emp.onboardingChecklist?.pensionNumberInput || emp.pensionNumber || '',
        payeNumberInput: emp.onboardingChecklist?.payeNumberInput || emp.payeNumber || '',
        lashmaPolicyNumber: emp.onboardingChecklist?.lashmaPolicyNumber || emp.lashmaPolicyNumber || '',
        lashmaRegistrationDate: emp.onboardingChecklist?.lashmaRegistrationDate || emp.lashmaRegistrationDate || '',
        lashmaExpiryDate: emp.onboardingChecklist?.lashmaExpiryDate || emp.lashmaExpiryDate || '',
        accountDetailsVerified: true,
        pensionVerified: true,
        payeVerified: true,
        lashmaVerified: true,
        employmentLetterPrinted: true,
        employmentLetterSigned: true,
        employmentLetterFiled: true,
        employmentLettersIssued: true,
        orientationDone: true,
        hrOrientation: true,
        ppeHandbookIssued: true,
        verifiedStartDate: emp.startDate,
      };
      updateEmployee(emp.id, { onboardingChecklist: fullCL });
    });
    toast.success(`Successfully updated checklists for all ${activeEmployees.length} active staff!`);
  };

  const toggleOffboardingTask = (taskId: string) => {
    if (!selectedEmployee) return;
    const tasks = (selectedEmployee.offboardingTasks || []).map(t => {
      if (t.id !== taskId) return t;
      return { ...t, status: t.status === 'Completed' ? 'Pending' : t.status === 'In Progress' ? 'Completed' : 'In Progress' } as OnboardingTask;
    });
    updateEmployee(selectedEmployee.id, { offboardingTasks: tasks });
  };

  const handlePostActivationTask = (task: 'orientation' | 'ppe') => {
    if (!selectedEmployee || selectedEmployee.status !== 'Active') { toast.error('Employee must be Active.'); return; }
    if (task === 'orientation') { updateCL({ orientationDone: true }); toast.info('Orientation marked done. HR notified.'); }
    else { updateCL({ ppeHandbookIssued: true }); toast.info('PPE & Handbook issuance marked done. HR notified.'); }
  };

  const offTasks = selectedEmployee?.offboardingTasks || [];
  const offDone = offTasks.filter(t => t.status === 'Completed').length;
  const offPct = offTasks.length > 0 ? Math.round((offDone / offTasks.length) * 100) : 0;

  const isOnboarding = activeTaskType === 'Onboarding' && selectedEmployee?.status === 'Onboarding';
  const isHistory = activeTaskType === 'History' || (activeTaskType === 'Onboarding' && selectedEmployee?.status === 'Active');
  const isOffboarding = activeTaskType === 'Offboarding';

  useSetPageTitle(
    'Lifecycle & Flow',
    'Manage onboarding, offboarding, and seamless employee transitions',
    <div className="hidden sm:flex items-center gap-2">
      {priv.canAdd && (
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2 h-9" 
          onClick={() => navigate('/onboarding/contract')}
        >
          <FileText className="h-4 w-4 text-indigo-500" /> Contract
        </Button>
      )}
      {priv.canAdd && (
        <Button 
          size="sm"
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-9" 
          onClick={() => navigate('/onboarding/new')}
        >
          <UserPlus className="h-4 w-4" /> Start New Hire
        </Button>
      )}
      {priv.canDelete && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-medium"
          onClick={() => navigate('/onboarding/offboard')}
        >
          <UserMinus className="h-4 w-4" /> Offboarding
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* ── Mobile Actions ── */}
      <div className="flex sm:hidden flex-wrap gap-2 px-1">
        {priv.canAdd && (
          <Button
            className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => navigate('/onboarding/new')}
          >
            <UserPlus className="h-4 w-4" /> Start New Hire
          </Button>
        )}
        {priv.canAdd && (
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate('/onboarding/contract')}
          >
            <FileText className="h-4 w-4 text-indigo-500" /> Contract
          </Button>
        )}
        {priv.canDelete && (
          <Button
            variant="outline"
            className="w-full sm:flex-1 gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-medium"
            onClick={() => navigate('/onboarding/offboard')}
          >
            <UserMinus className="h-4 w-4" /> Offboarding
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Employed', value: employees.filter(e => e.staffType === 'FIELD' || e.staffType === 'OFFICE').length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Staff', value: activeEmployees.length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Hires', value: pendingEmployees.length, icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Terminated', value: terminatedEmployees.length, icon: UserMinus, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-white dark:bg-slate-900">
            <CardContent className="p-5 flex items-center justify-between">
              <div><p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p><h3 className="text-3xl font-black text-slate-900">{stat.value}</h3></div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner ${stat.bg} ${stat.color}`}><stat.icon className="h-6 w-6" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Split */}
      <div className="grid gap-6 md:grid-cols-12 items-start">

        {/* ── Left Column ────────────────────────────────── */}
        <Card className="md:col-span-5 lg:col-span-4 border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-[720px]">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-5 space-y-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>{leftTab === 'Terminated' ? 'Offboarding' : leftTab} Directory</span>
              <div className="flex items-center gap-2">
                {leftTab === 'Active' && activeEmployees.length > 0 && isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold uppercase tracking-tight text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 border border-emerald-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAllActiveAsOnboardingComplete();
                    }}
                  >
                    Bulk Complete Checklists
                  </Button>
                )}
                {leftTab === 'Pending' && pendingEmployees.length > 0 && isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold uppercase tracking-tight text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 border border-amber-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAllAsOnboarded();
                    }}
                  >
                    Mark All Complete
                  </Button>
                )}
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 rounded-full px-2.5">
                  {leftTab === 'Active' ? activeEmployees.length : leftTab === 'Pending' ? pendingEmployees.length : terminatedEmployees.length}
                </Badge>
              </div>
            </CardTitle>
            <div className="flex p-1 bg-slate-200/50 rounded-lg">
              {(['Active', 'Pending', 'Terminated'] as const).map(tab => (
                <button key={tab}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors relative ${leftTab === tab ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setLeftTab(tab)}
                >
                  {tab === 'Terminated' ? 'Offboarding' : tab}
                  {tab === 'Pending' && pendingEmployees.length > 0 && <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
                  {tab === 'Terminated' && terminatedEmployees.some(e => hasIncompleteTasks(e.offboardingTasks)) && <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder={`Search ${leftTab.toLowerCase()}...`} className="pl-9 bg-slate-50/50 border-slate-200/60 h-9 text-sm rounded-lg" value={employeeSearchQuery} onChange={e => setEmployeeSearchQuery(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">

            {/* Active */}
            {leftTab === 'Active' && (filteredActive.length === 0
              ? <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><Building className="h-10 w-10 text-slate-200 mb-2" /><p className="text-sm">No active employees.</p></div>
              : <div className="divide-y divide-slate-100">{filteredActive.map(emp => {
                  // Post-activation tasks pending (orientation / PPE)
                  const empCl = emp.onboardingChecklist;
                  const hasPostPending = empCl && (!empCl.orientationDone || !empCl.ppeHandbookIssued);
                  return (
                    <div key={emp.id} className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedEmployeeId === emp.id ? 'bg-indigo-50/50 outline outline-1 outline-indigo-200' : ''}`} onClick={() => handleSelectEmployee(emp)}>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-100/50 shadow-sm">{emp.firstname.charAt(0)}{emp.surname.charAt(0)}</div>
                          {hasPostPending && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white" title="Post-activation tasks pending" />}
                        </div>
                        <div className="flex-1 overflow-hidden"><p className="font-semibold text-slate-800 text-sm truncate">{emp.surname} {emp.firstname}</p><p className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p></div>
                      </div>
                    </div>
                  );
                })}</div>
            )}

            {/* Pending */}
            {leftTab === 'Pending' && (filteredPending.length === 0
              ? <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><UserPlus className="h-10 w-10 text-slate-200 mb-2" /><p className="text-sm">No pending hires.</p></div>
              : <div className="divide-y divide-slate-100">{filteredPending.map(emp => {
                const empCl = emp.onboardingChecklist ?? makeDefaultChecklist(emp.noOfGuarantors ?? 2);
                const ready = allCriticalDone(empCl);
                const suspended = !!emp.onboardingSuspended;
                const hasPendingTasks = !ready; // still has incomplete required tasks
                return (
                  <div key={emp.id} className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                    suspended ? 'bg-slate-50 opacity-60' :
                    selectedEmployeeId === emp.id ? 'bg-amber-50/50 outline outline-1 outline-amber-200' : ''
                  }`} onClick={() => !suspended && handleSelectEmployee(emp)}>
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm mt-0.5 ${
                          suspended
                            ? 'bg-slate-200 text-slate-500 border-slate-300 grayscale'
                            : 'bg-gradient-to-tr from-amber-100 to-yellow-50 text-amber-700 border-amber-100/50'
                        }`}>{emp.firstname.charAt(0)}{emp.surname.charAt(0)}</div>
                        {/* Pending tasks dot */}
                        {!suspended && hasPendingTasks && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" title="Onboarding tasks pending" />
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-800 text-sm truncate">{emp.surname} {emp.firstname}</p>
                          {suspended && <span className="text-[9px] font-bold bg-slate-300 text-slate-600 rounded px-1.5 py-0.5 uppercase tracking-wider shrink-0">Suspended</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p>
                      </div>
                      {priv.canEdit && (
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit new hire details"
                            onClick={e => openEdit(emp, e)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                              suspended
                                ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                : 'text-amber-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={suspended ? 'Resume onboarding' : 'Suspend onboarding'}
                            onClick={e => handleSuspendToggle(emp, e)}
                          >
                            {suspended
                              ? <PlayCircle className="h-3.5 w-3.5" />
                              : <PauseCircle className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-center space-y-1.5">
                      {suspended
                        ? <div className="w-full flex justify-center h-7 items-center text-xs font-semibold text-slate-400 border border-slate-200 rounded-full bg-slate-50">&#9646;&#9646; Suspended</div>
                        : <Badge variant="outline" className={`w-full flex justify-center h-7 text-xs font-semibold ${ready ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                            {ready ? <><Unlock className="h-3 w-3 mr-1.5" />Ready to Activate</> : <><Clock className="h-3 w-3 mr-1.5" />Tasks Pending</>}
                          </Badge>
                      }
                      {/* Subtask progress quick view */}
                      {!suspended && emp.onboardingMainTaskId && (
                        <div className="text-[10px] font-medium text-slate-500 flex justify-between items-center px-1">
                          {(() => {
                            const empSubs = subtasks.filter(s => s.main_task_id === emp.onboardingMainTaskId || s.mainTaskId === emp.onboardingMainTaskId);
                            if (!empSubs.length) return null;
                            const completed = empSubs.filter(s => s.status === 'completed').length;
                            const pct = Math.round((completed / empSubs.length) * 100);
                            return (
                              <>
                                <span>Tasks: {completed}/{empSubs.length}</span>
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}</div>
            )}

            {/* Terminated */}
            {leftTab === 'Terminated' && (filteredTerminated.length === 0
              ? <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><UserMinus className="h-10 w-10 text-slate-200 mb-2" /><p className="text-sm">No offboarding employees.</p></div>
              : <div className="divide-y divide-slate-100">{filteredTerminated.map(emp => {
                const hasPending = hasIncompleteTasks(emp.offboardingTasks);
                return (
                  <div key={emp.id} className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedEmployeeId === emp.id ? 'bg-red-50/50 outline outline-1 outline-red-200' : ''}`} onClick={() => handleSelectEmployee(emp)}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 grayscale">{emp.firstname.charAt(0)}{emp.surname.charAt(0)}</div>
                      <div className="flex-1 overflow-hidden"><p className="font-semibold text-sm truncate text-slate-700">{emp.surname} {emp.firstname}</p><p className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p></div>
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline" className={`w-full flex justify-center h-7 text-xs font-semibold ${hasPending ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                        {hasPending ? <><Clock className="h-3 w-3 mr-1.5" />Incomplete</> : <><Check className="h-3 w-3 mr-1.5" />Offboarded</>}
                      </Badge>
                    </div>
                  </div>
                );
              })}</div>
            )}
          </CardContent>
        </Card>

        {/* ── Right Column ───────────────────────────────── */}
        <Card className="md:col-span-7 lg:col-span-8 border-none shadow-lg bg-white dark:bg-slate-900 overflow-hidden min-h-[720px] flex flex-col ring-1 ring-slate-100">
          <CardHeader className="border-b border-slate-100 bg-white/50 dark:bg-slate-900/80 sticky top-0 z-10 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <Badge variant="outline" className={`rounded-md font-bold text-[10px] tracking-widest uppercase border-0 text-white ${isHistory ? 'bg-emerald-500' : isOffboarding ? 'bg-rose-500' : isOnboarding ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                {activeTaskType || 'Action Center'}
              </Badge>
              <CardTitle className="text-xl font-black text-slate-800 flex items-center flex-wrap gap-2">
                {isOnboarding ? 'Onboarding Checklist' : isHistory ? 'Onboarding History' : isOffboarding ? 'Offboarding Tasks' : 'Select an Employee'}
                {selectedEmployee && (
                  <span className={`text-base font-medium px-3 py-1 rounded-lg ${selectedEmployee.status === 'Onboarding' ? 'text-indigo-500 bg-indigo-50' : selectedEmployee.status === 'Terminated' ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'}`}>
                    ({selectedEmployee.firstname} {selectedEmployee.surname})
                  </span>
                )}
              </CardTitle>
              {selectedEmployee?.status === 'Onboarding' && (
                <p className="text-xs text-slate-500">
                  Tentative Start: <strong>{selectedEmployee.tentativeStartDate || selectedEmployee.startDate}</strong>
                  {selectedEmployee.probationPeriod && <span className="ml-3 text-indigo-600 font-semibold">Probation: {selectedEmployee.probationPeriod} days</span>}
                  {selectedEmployee.noOfGuarantors && <span className="ml-3 text-amber-600 font-semibold">Guarantors Required: {selectedEmployee.noOfGuarantors}</span>}
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 flex-1 bg-slate-50/30 overflow-y-auto custom-scrollbar">

            {/* â• â•  ONBOARDING CHECKLIST (Pending or Active History) â• â•  */}
            {(isOnboarding || isHistory) && selectedEmployee && (
              <div className="space-y-3">
                {isHistory && (
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-4 shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                        Onboarding Completed <Check className="h-4 w-4" />
                      </p>
                      <div className="text-[11px] text-emerald-700 font-medium mt-1 space-x-4">
                        <span>Verified Start: <strong>{selectedEmployee.verifiedStartDate || selectedEmployee.startDate}</strong></span>
                        {selectedEmployee.probationPeriod && <span>Probation: <strong>{selectedEmployee.probationPeriod} days</strong></span>}
                        {selectedEmployee.bankName && <span>Bank: <strong>{selectedEmployee.bankName}</strong></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleBulkCompleteSteps}
                          className="h-8 text-[10px] font-bold uppercase tracking-tight text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 border border-amber-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Bulk Complete Steps
                        </Button>
                      )}
                      {priv.canEdit && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setChecklistEditMode(!checklistEditMode)} 
                          className={`gap-1.5 transition-colors h-8 text-xs font-semibold shadow-sm ${checklistEditMode ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 hover:text-amber-900 focus:bg-amber-200' : 'bg-white dark:bg-slate-800 border-emerald-200 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'}`}
                        >
                          {checklistEditMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                          {checklistEditMode ? 'Done Editing' : 'Edit Checklist'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className={`space-y-3 transition-opacity duration-300 ${isHistory && !checklistEditMode ? 'opacity-60 pointer-events-none grayscale-[15%]' : ''}`}>
                  {/* ─ Task 1 ─ */}
                <Section icon={Mail} label={l['1'] || "1. Send Necessary Information (Forms)"} color="bg-indigo-50 text-indigo-700"
                  defaultOpen={!t1Done}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">All forms must be sent and acknowledged before Task 2 unlocks.</span>
                    <DoneBadge done={t1Done} />
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">Tick after sending all necessary forms to the employee.</p>
                  <div className="ml-2 space-y-2 border-l-2 border-indigo-100 pl-3">
                    <p className="text-xs font-semibold text-indigo-600">Employee Forms</p>
                    <CheckRow
                      label="All necessary forms sent to employee (Employee Forms + Guarantor Forms)"
                      checked={cl.emailFormsSent}
                      onChange={v => updateCL({ emailFormsSent: v, emailFormsAcknowledged: cl.emailFormsAcknowledged && v })}
                    />
                  </div>
                  <div className="mt-3">
                    <CheckRow
                      label={cl.emailFormsSent ? 'Acknowledgement received from employee' : 'Mark forms sent first to unlock acknowledgement'}
                      checked={cl.emailFormsAcknowledged}
                      onChange={v => updateCL({ emailFormsAcknowledged: v })}
                      disabled={!cl.emailFormsSent}
                      hint={!cl.emailFormsSent ? 'Tick "All forms sent" above before marking acknowledgement' : undefined}
                    />
                  </div>
                </Section>

                {/* ─ Task 2 ─ */}
                <Section icon={RotateCcw} label={l['2'] || "2. Return of Forms"} color="bg-violet-50 text-violet-700"
                  locked={!t2Unlocked} lockMsg="Complete Task 1 first" defaultOpen={t1Done && !t2FullDone}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Tick when each form and passport photo has been received.</span>
                    <DoneBadge done={t2FullDone} />
                  </div>

                  {/* Guarantor Form block */}
                  <div className="rounded-lg border border-violet-100 bg-violet-50/30 p-3 space-y-2">
                    <p className="text-xs font-bold text-violet-700">Guarantor Form</p>
                    <CheckRow
                      label="Guarantor form(s) returned"
                      checked={cl.guarantorFormsReturned}
                      onChange={v => updateCL({ guarantorFormsReturned: v, guarantorPassportReturned: cl.guarantorPassportReturned && v })}
                    />
                    <div className="ml-6 space-y-1 border-l-2 border-violet-100 pl-3">
                      <CheckRow
                        label="With passport photograph"
                        checked={cl.guarantorPassportReturned}
                        onChange={v => updateCL({ guarantorPassportReturned: v })}
                        disabled={!cl.guarantorFormsReturned}
                        hint="Tick guarantor form returned first"
                      />
                      {!cl.guarantorPassportReturned && cl.guarantorFormsReturned && (
                        <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          Pending — HR receives a daily reminder to collect guarantor passport photograph.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Personal Employee Form block */}
                  <div className="rounded-lg border border-violet-100 bg-violet-50/30 p-3 space-y-2 mt-2">
                    <p className="text-xs font-bold text-violet-700">Personal Employee Form</p>
                    <CheckRow
                      label="Personal employee form returned"
                      checked={cl.personalEmployeeFormReturned}
                      onChange={v => updateCL({ personalEmployeeFormReturned: v, personalEmployeePassportReturned: cl.personalEmployeePassportReturned && v })}
                    />
                    <div className="ml-6 space-y-1 border-l-2 border-violet-100 pl-3">
                      <CheckRow
                        label="With passport photograph"
                        checked={cl.personalEmployeePassportReturned}
                        onChange={v => updateCL({ personalEmployeePassportReturned: v })}
                        disabled={!cl.personalEmployeeFormReturned}
                        hint="Tick personal employee form returned first"
                      />
                      {!cl.personalEmployeePassportReturned && cl.personalEmployeeFormReturned && (
                        <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          Pending — HR receives a daily reminder to collect employee passport photograph.
                        </p>
                      )}
                    </div>
                  </div>
                </Section>

                {/* ─ Task 3 ─ */}
                <Section icon={ShieldCheck} label={l['3'] || "3. Verification of Documents"} color="bg-sky-50 text-sky-700"
                  locked={!t3Unlocked} lockMsg="Complete all of Task 2 first" defaultOpen={t3Unlocked && !t3Done}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Complete Document Verification. Account Details, Pension, and PAYE are optional inputs.</span>
                    <DoneBadge done={t3Done} />
                  </div>

                  {/* 3.1 — Guarantors */}
                  <SubSection label="3.1 — Guarantor Information" done={t31Done}>
                    <p className="text-[11px] text-slate-500">Fill name &amp; phone for each guarantor. The verified checkbox is advisory — you can proceed without ticking it.</p>
                    {cl.guarantors.map((g, i) => {
                      const inputsFilled = g.name.trim() !== '' && g.phone.trim() !== '';
                      return (
                        <div key={i} className={`p-3 rounded-lg border space-y-2 mt-2 transition-colors ${g.verified ? 'bg-emerald-50/50 border-emerald-200' : inputsFilled ? 'bg-sky-50/30 border-sky-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-sky-700">Guarantor {i + 1}</p>
                            {g.verified
                              ? <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" />Verified</span>
                              : inputsFilled
                                ? <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><Clock className="h-3 w-3" />Verification Pending</span>
                                : <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Lock className="h-3 w-3" />Fill details</span>
                            }
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <LabeledInput label="Full Name *" value={g.name}
                              onChange={v => { updateGuarantor(i, 'name', v); if (!v.trim()) updateGuarantor(i, 'verified', false); }}
                              placeholder="e.g. Jane Smith" />
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Phone Number *</label>
                              <Input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="h-9 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700"
                                placeholder="e.g. 08012345678"
                                value={g.phone}
                                onChange={e => {
                                  const v = e.target.value.replace(/\D/g, '');
                                  updateGuarantor(i, 'phone', v);
                                  if (!v.trim()) updateGuarantor(i, 'verified', false);
                                }}
                              />
                            </div>
                          </div>
                          <CheckRow
                            label={inputsFilled ? `Mark Guarantor ${i + 1} as verified (optional)` : `Fill name & phone first`}
                            checked={g.verified}
                            onChange={v => updateGuarantor(i, 'verified', v)}
                            disabled={!inputsFilled}
                            hint={!inputsFilled ? 'Enter name and phone number above to enable' : undefined}
                          />
                        </div>
                      );
                    })}
                    {!allGuarantorsVerified && t31Done && (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />Some guarantors not yet verified — you can still proceed.</p>
                    )}
                  </SubSection>

                  {/* 3.2 — Document checklist (unlocked after 3.1) */}
                  <SubSection label="3.2 — Document Checklist" locked={!t31Done} lockMsg="Complete 3.1 first" done={t32DocsDone}>
                    <p className="text-[11px] text-slate-500">Tick each document after it has been physically verified.</p>
                    <CheckRow label="Passport Photos submitted" checked={cl.passportPhotos} onChange={v => updateCL({ passportPhotos: v })} />
                    {/* Address — input required BEFORE checkbox can be ticked */}
                    <div className="space-y-1.5">
                      <LabeledInput
                        label="Employee Residential Address"
                        value={cl.verifiedAddress ?? ''}
                        onChange={v => updateCL({ verifiedAddress: v, addressVerification: cl.addressVerification && v.trim() !== '' })}
                        placeholder="Enter employee's verified residential address"
                      />
                      <CheckRow
                        label={cl.verifiedAddress?.trim() ? 'Address Verification document submitted' : 'Enter address above first'}
                        checked={cl.addressVerification}
                        onChange={v => updateCL({ addressVerification: v })}
                        disabled={!cl.verifiedAddress?.trim()}
                        hint={!cl.verifiedAddress?.trim() ? 'Type the verified address above before ticking this' : undefined}
                      />
                    </div>
                    <CheckRow label="Educational Qualification Credentials submitted" checked={cl.educationalCredentials} onChange={v => updateCL({ educationalCredentials: v })} />
                  </SubSection>

                  {/* 3.2 — Account Details (optional) */}
                  <SubSection label="3.2 — Account Details" done={t32AccDone}>
                    <p className="text-[11px] text-slate-500">Enter bank details — these will be saved to the employee record on activation. Verified checkbox is advisory.</p>
                    <div className={`p-3 rounded-lg border grid grid-cols-2 gap-3 transition-colors ${cl.bankName.trim() && cl.accountNo.trim() ? 'border-sky-200 bg-sky-50/20' : 'border-slate-200'}`}>
                      {/* Bank Name — dropdown from Variables > Beneficiary Banks */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bank Name *</label>
                        <select
                          className="w-full h-9 px-2.5 rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-colors"
                          value={cl.bankName}
                          onChange={e => updateCL({ bankName: e.target.value })}
                        >
                          <option value="">-- Select Bank --</option>
                          {ledgerBeneficiaryBanks.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                          {/* Allow a manually entered value to persist even if not in list */}
                          {cl.bankName && !ledgerBeneficiaryBanks.some(b => b.name === cl.bankName) && (
                            <option value={cl.bankName}>{cl.bankName}</option>
                          )}
                        </select>
                        {ledgerBeneficiaryBanks.length === 0 && (
                          <p className="text-[10px] text-amber-600">No banks configured — add them in Variables → Beneficiary Banks.</p>
                        )}
                      </div>
                      {/* Account Number — buffered locally to prevent keystroke-delete bug */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Account Number *</label>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="h-9 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700"
                          placeholder="0123456789"
                          value={localAccountNo}
                          onChange={e => setLocalAccountNo(e.target.value.replace(/\D/g, ''))}
                          onBlur={() => updateCL({ accountNo: localAccountNo })}
                        />
                      </div>
                    </div>
                    {cl.bankName.trim() && cl.accountNo.trim()
                      ? <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" />Account details entered</p>
                      : <p className="text-[11px] text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" />Fill both fields first</p>
                    }
                    <CheckRow
                      label={cl.bankName.trim() && cl.accountNo.trim() ? 'Mark account details as verified (optional)' : 'Fill bank name and account number first'}
                      checked={cl.accountDetailsVerified}
                      onChange={v => updateCL({ accountDetailsVerified: v })}
                      disabled={!(cl.bankName.trim() && cl.accountNo.trim())}
                      hint={!(cl.bankName.trim() && cl.accountNo.trim()) ? 'Enter bank name and account number to unlock' : undefined}
                    />
                    {!accVerified && t32AccDone && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1"><Clock className="h-3 w-3" />Account not yet verified — you can still proceed.</p>
                    )}
                  </SubSection>

                  {/* 3.2 — Pension */}
                  <SubSection label="3.2 — Pension Number" done={t32PensionDone}>
                    <LabeledInput label="Enter Pension Number *" value={cl.pensionNumberInput}
                      onChange={v => updateCL({ pensionNumberInput: v, pensionVerified: cl.pensionVerified && v.trim() !== '' })}
                      placeholder="e.g. PEN/123456" />
                    {!cl.pensionNumberInput.trim() && <p className="text-[11px] text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" />Enter pension number to unlock verification</p>}
                    <CheckRow
                      label={cl.pensionNumberInput.trim() ? 'Mark Pension Number as verified (optional)' : 'Fill in pension number first'}
                      checked={cl.pensionVerified}
                      onChange={v => updateCL({ pensionVerified: v })}
                      disabled={!cl.pensionNumberInput.trim()}
                      hint={!cl.pensionNumberInput.trim() ? 'Enter pension number above to enable this' : undefined}
                    />
                    {!pensionVerified && t32PensionDone && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1"><Clock className="h-3 w-3" />Pension not yet verified — you can still proceed.</p>
                    )}
                  </SubSection>

                  {/* 3.2 — PAYE */}
                  <SubSection label="3.2 — PAYE Number" done={t32PayeDone}>
                    <LabeledInput label="Enter PAYE Number *" value={cl.payeNumberInput}
                      onChange={v => updateCL({ payeNumberInput: v, payeVerified: cl.payeVerified && v.trim() !== '' })}
                      placeholder="e.g. PAYE/654321" />
                    {!cl.payeNumberInput.trim() && <p className="text-[11px] text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" />Enter PAYE number to unlock verification</p>}
                    <CheckRow
                      label={cl.payeNumberInput.trim() ? 'Mark PAYE Number as verified (optional)' : 'Fill in PAYE number first'}
                      checked={cl.payeVerified}
                      onChange={v => updateCL({ payeVerified: v })}
                      disabled={!cl.payeNumberInput.trim()}
                      hint={!cl.payeNumberInput.trim() ? 'Enter PAYE number above to enable this' : undefined}
                    />
                    {!payeVerified && t32PayeDone && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1"><Clock className="h-3 w-3" />PAYE not yet verified — you can still proceed.</p>
                    )}
                  </SubSection>
                </Section>

                {/* ─ Task 4 ─ */}
                <Section icon={CalendarCheck2} label={l['4'] || "4. Resumption — Verified Start Date"} color="bg-amber-50 text-amber-700"
                  locked={!t4Unlocked} lockMsg="Complete all of Task 3 first" defaultOpen={t4Unlocked && !t4Done}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-amber-800">Tentative date: <strong>{selectedEmployee.tentativeStartDate || selectedEmployee.startDate}</strong></span>
                    <DoneBadge done={t4Done} />
                  </div>
                  <p className="text-[11px] text-slate-500">Enter the confirmed official start date. This replaces the tentative date and becomes the employee's official start date on activation.</p>
                  <div className={`p-3 rounded-lg border transition-colors ${cl.verifiedStartDate ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/20'}`}>
                    <LabeledInput type="date" label="Verified / Official Start Date *" value={cl.verifiedStartDate} onChange={v => updateCL({ verifiedStartDate: v })} />
                    {cl.verifiedStartDate
                      ? <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1.5"><Check className="h-3 w-3" />Date set — will update employee record on activation.</p>
                      : <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5"><Lock className="h-3 w-3" />A verified date is required before Task 5 unlocks.</p>
                    }
                  </div>
                </Section>

                {/* ─ Task 5 ─ */}
                <Section icon={FileSignature} label={l['5'] || "5. Employment Letters"} color="bg-teal-50 text-teal-700"
                  locked={!t5Unlocked} lockMsg="Set verified start date first" defaultOpen={t5Unlocked && !t5Done}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">All three steps required before activation.</span>
                    <DoneBadge done={t5Done} />
                  </div>
                  <CheckRow label="Employment letter printed" checked={!!cl.employmentLetterPrinted} onChange={v => updateCL({ employmentLetterPrinted: v, employmentLettersIssued: v && cl.employmentLetterSigned && cl.employmentLetterFiled })} />
                  <CheckRow label="Signed by HR and employee" checked={!!cl.employmentLetterSigned} onChange={v => updateCL({ employmentLetterSigned: v, employmentLettersIssued: cl.employmentLetterPrinted && v && cl.employmentLetterFiled })} disabled={!cl.employmentLetterPrinted} hint={!cl.employmentLetterPrinted ? "Print letter first" : ""} />
                  <CheckRow label="Returned and filed" checked={!!cl.employmentLetterFiled} onChange={v => updateCL({ employmentLetterFiled: v, employmentLettersIssued: cl.employmentLetterPrinted && cl.employmentLetterSigned && v })} disabled={!cl.employmentLetterSigned} hint={!cl.employmentLetterSigned ? "Sign letter first" : ""} />
                </Section>

                </div>
                {/* ─ Activation Gate ─ */}
                {!isHistory && (
                  <div className={`p-5 rounded-xl border-2 transition-all mt-6 ${criticalDone ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <p className={`font-bold text-sm ${criticalDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {criticalDone ? '✅ All critical tasks complete — ready to activate!' : '🔒 Complete tasks 1–5 in sequence to unlock activation'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Tasks 6 (Orientation) and 7 (PPE & Handbook) can be completed after activation.</p>
                      </div>
                      {priv.canEdit && (
                        <Button
                          disabled={!criticalDone}
                          onClick={handleActivate}
                          className={`shrink-0 font-bold gap-2 transition-all ${criticalDone
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                          {criticalDone ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          Make Employee Active
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* ─ Task 6 & 7 (Post-Activation) ─ */}
                {isHistory ? (
                  <div className="space-y-3 mt-8 pt-6 border-t border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                      <Siren className="h-3.5 w-3.5 text-orange-500" /> Post-Activation Tasks
                    </p>
                    <Section icon={GraduationCap} label="6. Orientation" color="bg-purple-50 text-purple-700" defaultOpen={!cl.orientationDone}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">All orientations must be completed.</span>
                        <DoneBadge done={!!(cl.hrOrientation && cl.departmentOrientation && cl.siteOrientation && cl.hseOrientation)} />
                      </div>
                      <CheckRow label="HR orientation (policies, benefits, compliance)" checked={cl.hrOrientation} onChange={v => { updateCL({ hrOrientation: v, orientationDone: v && cl.departmentOrientation && cl.siteOrientation && cl.hseOrientation }); }} />
                      <CheckRow label="Department orientation" checked={cl.departmentOrientation} onChange={v => { updateCL({ departmentOrientation: v, orientationDone: cl.hrOrientation && v && cl.siteOrientation && cl.hseOrientation }); }} />
                      <CheckRow label="Site orientation" checked={cl.siteOrientation} onChange={v => { updateCL({ siteOrientation: v, orientationDone: cl.hrOrientation && cl.departmentOrientation && v && cl.hseOrientation }); }} />
                      <CheckRow label="HSE orientation" checked={cl.hseOrientation} onChange={v => { updateCL({ hseOrientation: v, orientationDone: cl.hrOrientation && cl.departmentOrientation && cl.siteOrientation && v }); }} />
                    </Section>
                    <Section icon={Package} label={l['7'] || "7. Provision of PPE, Handbook & Requirements"} color="bg-orange-50 text-orange-700" defaultOpen={!cl.ppeHandbookIssued}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">Provide all required items to employee.</span>
                        <DoneBadge done={!!(cl.ppeIssued && cl.handbookProvided && cl.otherRequirementsSupplied)} />
                      </div>
                      <CheckRow label="PPE issued" checked={cl.ppeIssued} onChange={v => { updateCL({ ppeIssued: v, ppeHandbookIssued: v && cl.handbookProvided && cl.otherRequirementsSupplied }); }} />
                      <CheckRow label="Employee handbook provided" checked={cl.handbookProvided} onChange={v => { updateCL({ handbookProvided: v, ppeHandbookIssued: cl.ppeIssued && v && cl.otherRequirementsSupplied }); }} />
                      <CheckRow label="Other requirements supplied" checked={cl.otherRequirementsSupplied} onChange={v => { updateCL({ otherRequirementsSupplied: v, ppeHandbookIssued: cl.ppeIssued && cl.handbookProvided && v }); }} />
                    </Section>
                    <Section icon={Activity} label="8. Health insurance (LASHMA)" color="bg-emerald-50 text-emerald-700" defaultOpen={!cl.lashmaVerified}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">Enter and verify health insurance policy details.</span>
                        <DoneBadge done={cl.lashmaVerified} />
                      </div>
                      <div className="space-y-3">
                        <LabeledInput 
                          label="LASHMA Policy Number" 
                          value={cl.lashmaPolicyNumber} 
                          onChange={v => updateCL({ lashmaPolicyNumber: v })} 
                          placeholder="Enter policy number" 
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <LabeledInput 
                            label="Registration Date" 
                            type="date"
                            value={cl.lashmaRegistrationDate || ''} 
                            onChange={v => updateCL({ lashmaRegistrationDate: v })} 
                          />
                          <LabeledInput 
                            label="Expiry Date" 
                            type="date"
                            value={cl.lashmaExpiryDate || ''} 
                            onChange={v => updateCL({ lashmaExpiryDate: v })} 
                          />
                        </div>
                        <CheckRow 
                          label={(cl.lashmaPolicyNumber || '').trim() ? "Mark LASHMA as verified" : "Enter policy number first"} 
                          checked={cl.lashmaVerified} 
                          onChange={v => updateCL({ lashmaVerified: v })} 
                          disabled={!(cl.lashmaPolicyNumber || '').trim()} 
                          hint={!(cl.lashmaPolicyNumber || '').trim() ? "Policy number required" : ""}
                        />
                      </div>
                    </Section>
                  </div>
                ) : (
                  <div className="space-y-2 opacity-50 pointer-events-none mt-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2"><Siren className="h-3.5 w-3.5" />Post-Activation Tasks (Available after employee is activated)</p>
                    <Section icon={GraduationCap} label={l['6'] || "6. Orientation"} color="bg-purple-50 text-purple-700" defaultOpen={false}>
                      <p className="text-xs text-purple-600">Unlocks after activation. Includes HR, Department, Site, and HSE orientations.</p>
                    </Section>
                    <Section icon={Package} label={l['7'] || "7. Provision of PPE, Handbook & Requirements"} color="bg-orange-50 text-orange-700" defaultOpen={false}>
                      <p className="text-xs text-orange-600">Unlocks after activation. Includes PPE issuance, handbook, and other requirements.</p>
                    </Section>
                    <Section icon={Activity} label="8. Health insurance (LASHMA)" color="bg-emerald-50 text-emerald-700" defaultOpen={false}>
                      <p className="text-xs text-emerald-600">Unlocks after activation. Requires entry of LASHMA policy number, registration date, and expiry date.</p>
                    </Section>
                  </div>
                )}

                {/* Additional / Custom Department Tasks */}
                {selectedEmployee.onboardingTasks && selectedEmployee.onboardingTasks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-500" /> Additional Tasks ({selectedEmployee.department})
                    </h3>
                    {selectedEmployee.onboardingTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow mb-2">
                        <button
                          className={`h-5 w-5 rounded border-[1.5px] p-0 flex items-center justify-center shrink-0 transition-colors ${
                            task.status === 'Completed' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-emerald-400'
                          }`}
                          disabled={isHistory && !checklistEditMode}
                          onClick={() => {
                            const newTasks = selectedEmployee.onboardingTasks!.map(t =>
                              (t.id === task.id ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' } : t) as OnboardingTask
                            );
                            updateEmployee(selectedEmployee.id, { onboardingTasks: newTasks });
                            toast.success(task.status === 'Completed' ? 'Task marked pending' : 'Task completed');
                          }}
                        >
                          {task.status === 'Completed' && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${task.status === 'Completed' ? 'text-emerald-700' : 'text-slate-700'}`}>{task.title}</p>
                          <p className="text-[11px] text-slate-500">Assignee: {task.assignee}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ OFFBOARDING ══ */}
            {isOffboarding && selectedEmployee && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-400">{offDone} of {offTasks.length} tasks completed</p>
                  <span className="text-2xl font-black text-rose-500">{offPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${offPct}%` }} /></div>
                <div className="space-y-4 mt-5">
                  {offTasks.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No offboarding tasks configured.</p>
                  ) : (
                    Object.entries(
                      offTasks.reduce((acc, task) => {
                        const match = task.title.match(/^(\d+\.\s+[^-\n]+?)\s*-\s*(.*)/);
                        const group = match ? match[1].trim() : 'Other Tasks';
                        const shortTitle = match ? match[2].trim() : task.title;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push({ ...task, shortTitle });
                        return acc;
                      }, {} as Record<string, (typeof offTasks[0] & { shortTitle: string })[]>)
                    ).map(([group, groupTasks]) => (
                      <Section key={group} label={group} color="bg-rose-50 text-rose-700" defaultOpen={true} icon={Lock}>
                        <div className="space-y-2 mt-1">
                          {groupTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:shadow-sm transition-shadow">
                              <button
                                className={`h-5 w-5 rounded border-[1.5px] p-0 flex items-center justify-center shrink-0 transition-colors ${
                                  task.status === 'Completed' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-emerald-400'
                                }`}
                                onClick={() => priv.canEdit && toggleOffboardingTask(task.id)}
                                disabled={!priv.canEdit}
                              >
                                {task.status === 'Completed' && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </button>
                              <span className={`text-[13px] font-medium flex-1 ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {task.shortTitle}
                              </span>
                              {priv.canEdit && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2" onClick={() => toggleOffboardingTask(task.id)}>
                                  {task.status === 'Completed' ? 'Undo' : 'Done'}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </Section>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* â•â• Empty State â•â• */}
            {!selectedEmployee && (
              <div className="text-center py-20 px-6 flex flex-col items-center justify-center">
                <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
                  <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-full animate-[spin_10s_linear_infinite]" />
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">No active roadmap mapped.</h3>
                <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">Select an employee from the directory on the left or start a new hire.</p>
                <Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600" onClick={() => navigate('/onboarding/new')}>Start New Hire</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Edit Modal ────────────────────────────────────── */}
      {editEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Edit New Hire Details</p>
                <h3 className="text-lg font-black text-slate-800 mt-0.5">{editEmp.firstname} {editEmp.surname}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Full name is not editable here</p>
              </div>
              <button onClick={closeEdit} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Department</label>
                  <select className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" value={editEmp.department} onChange={e => setEditEmp(p => p ? { ...p, department: e.target.value } : p)}>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Position</label>
                  <select className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" value={editEmp.position} onChange={e => setEditEmp(p => p ? { ...p, position: e.target.value } : p)}>
                    {positions.map(pos => <option key={pos.id} value={pos.title}>{pos.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Staff Type</label>
                <select className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" value={editEmp.staffType} onChange={e => setEditEmp(p => p ? { ...p, staffType: e.target.value as any } : p)}>
                  <option value="OFFICE">Office</option>
                  <option value="FIELD">Field</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tentative Start Date</label>
                <Input type="date" className="h-9 text-sm" value={normalizeDate(editEmp.tentativeStartDate)} onChange={e => setEditEmp(p => p ? { ...p, tentativeStartDate: e.target.value } : p)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Probation (days)</label>
                  <Input type="number" min={0} className="h-9 text-sm" value={editEmp.probationPeriod ?? ''} onChange={e => setEditEmp(p => p ? { ...p, probationPeriod: Number(e.target.value) } : p)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">No. of Guarantors</label>
                  <Input type="number" min={1} max={5} className="h-9 text-sm" value={editEmp.noOfGuarantors ?? 1} onChange={e => setEditEmp(p => p ? { ...p, noOfGuarantors: Number(e.target.value) } : p)} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button variant="outline" className="flex-1" onClick={closeEdit}>Cancel</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={saveEdit}><Check className="h-4 w-4 mr-1.5" />Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; margin: 4px 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; border: 2px solid #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}</style>
    </div>
  );
}

