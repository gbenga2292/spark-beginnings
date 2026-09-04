import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';
import { Textarea } from '@/src/components/ui/textarea';
import { History, GitCommit, CheckCircle, AlertTriangle, ArrowRight, Clock, User, ShieldCheck } from 'lucide-react';
import { PayrollSnapshot, useAppStore } from '@/src/store/appStore';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { toast } from '@/src/components/ui/toast';

interface PayrollVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CREATE_REVISION' | 'AUDIT_HISTORY';
  monthLabel: string;
  monthKey: string;
  year: number;
  activeSnapshot: PayrollSnapshot | null;
  allVersions: PayrollSnapshot[];
  livePayrollData: any[];
  liveTotals: any;
  currentUserName: string;
  currentUserEmail: string;
  isAdmin: boolean;
  onSaveRevisionSuccess?: () => void;
}

const fm = (v: number) => (typeof v === 'number' ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0');

export function PayrollVersionModal({
  isOpen,
  onClose,
  mode,
  monthLabel,
  monthKey,
  year,
  activeSnapshot,
  allVersions,
  livePayrollData,
  liveTotals,
  currentUserName,
  currentUserEmail,
  isAdmin,
  onSaveRevisionSuccess,
}: PayrollVersionModalProps) {
  const savePayrollSnapshot = useAppStore((state) => state.savePayrollSnapshot);
  const setActivePayrollSnapshot = useAppStore((state) => state.setActivePayrollSnapshot);

  const [changeReason, setChangeReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVersionToView, setSelectedVersionToView] = useState<number | null>(null);

  const nextVersionNumber = useMemo(() => {
    if (allVersions.length === 0) return 1;
    const maxV = Math.max(...allVersions.map((v) => v.version));
    return maxV + 1;
  }, [allVersions]);

  // Compute differences between active snapshot and live data
  const diffMetrics = useMemo(() => {
    if (!activeSnapshot) return null;

    const snapTotals = activeSnapshot.totals || ({} as any);
    const grossDiff = (liveTotals.totalGross || 0) - (snapTotals.totalGross || 0);
    const deductionsDiff = (liveTotals.totalDeductions || 0) - (snapTotals.totalDeductions || 0);
    const netDiff = (liveTotals.totalNet || 0) - (snapTotals.totalNet || 0);
    const countDiff = (liveTotals.employeeCount || 0) - (snapTotals.employeeCount || 0);

    // Identify employees with altered net pay
    const snapRecordMap = new Map<string, any>();
    (activeSnapshot.records || []).forEach((r: any) => snapRecordMap.set(r.id, r));

    const changedEmployees: Array<{
      id: string;
      name: string;
      position: string;
      oldNet: number;
      newNet: number;
      oldGross: number;
      newGross: number;
      isNew?: boolean;
      isRemoved?: boolean;
    }> = [];

    livePayrollData.forEach((liveR: any) => {
      const snapR = snapRecordMap.get(liveR.id);
      if (!snapR) {
        changedEmployees.push({
          id: liveR.id,
          name: `${liveR.firstname} ${liveR.surname}`,
          position: liveR.position,
          oldNet: 0,
          newNet: liveR.takeHomePay,
          oldGross: 0,
          newGross: liveR.grossPay,
          isNew: true,
        });
      } else if (
        Math.abs(liveR.takeHomePay - snapR.takeHomePay) > 0.01 ||
        Math.abs(liveR.grossPay - snapR.grossPay) > 0.01
      ) {
        changedEmployees.push({
          id: liveR.id,
          name: `${liveR.firstname} ${liveR.surname}`,
          position: liveR.position,
          oldNet: snapR.takeHomePay,
          newNet: liveR.takeHomePay,
          oldGross: snapR.grossPay,
          newGross: liveR.grossPay,
        });
      }
    });

    // Check for removed employees
    (activeSnapshot.records || []).forEach((snapR: any) => {
      if (!livePayrollData.some((r: any) => r.id === snapR.id)) {
        changedEmployees.push({
          id: snapR.id,
          name: `${snapR.firstname} ${snapR.surname}`,
          position: snapR.position,
          oldNet: snapR.takeHomePay,
          newNet: 0,
          oldGross: snapR.grossPay,
          newGross: 0,
          isRemoved: true,
        });
      }
    });

    return {
      grossDiff,
      deductionsDiff,
      netDiff,
      countDiff,
      changedEmployees,
      hasChanges: changedEmployees.length > 0 || Math.abs(netDiff) > 0.01,
    };
  }, [activeSnapshot, livePayrollData, liveTotals]);

  const handleCreateRevision = async () => {
    if (!isAdmin) {
      toast.error('Only authorized administrators can revise finalized payrolls.');
      return;
    }
    if (!changeReason.trim()) {
      toast.error('A mandatory reason is required to document this revision.');
      return;
    }

    setIsSaving(true);
    try {
      await savePayrollSnapshot({
        workspaceId: 'dcel-team',
        month: monthKey,
        year,
        version: nextVersionNumber,
        isActive: true,
        changeReason: changeReason.trim(),
        createdBy: currentUserEmail || currentUserName || 'Admin',
        createdByName: currentUserName || 'Admin',
        totals: {
          totalSalary: liveTotals.totalSalary,
          totalOvertime: liveTotals.totalOvertime,
          totalGross: liveTotals.totalGross,
          totalPAYE: liveTotals.totalPAYE,
          totalLoans: liveTotals.totalLoans,
          totalPension: liveTotals.totalPension,
          totalWithholding: liveTotals.totalWithholding,
          totalDeductions: liveTotals.totalDeductions,
          totalNet: liveTotals.totalNet,
          employeeCount: liveTotals.employeeCount,
        },
        records: livePayrollData,
      });

      toast.success(`Revision v${nextVersionNumber} saved successfully for ${monthLabel} ${year}.`);
      setChangeReason('');
      onSaveRevisionSuccess?.();
      onClose();
    } catch (e: any) {
      console.error('Save revision error:', e);
      toast.error('Failed to save payroll revision: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchActiveVersion = async (targetVersion: number) => {
    if (!isAdmin) {
      toast.error('Only administrators can switch the active payroll version.');
      return;
    }
    try {
      await setActivePayrollSnapshot(monthKey, year, targetVersion);
      toast.success(`Active payroll version set to v${targetVersion}.`);
      onSaveRevisionSuccess?.();
    } catch (e: any) {
      console.error('Switch version error:', e);
      toast.error('Failed to switch version: ' + (e?.message || 'Unknown error'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                {mode === 'CREATE_REVISION' ? <GitCommit className="h-5 w-5" /> : <History className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {mode === 'CREATE_REVISION'
                    ? `Create Payroll Revision (v${nextVersionNumber})`
                    : `Payroll Audit & Version History`}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {monthLabel} {year} &bull; {allVersions.length} Recorded Snapshot{allVersions.length === 1 ? '' : 's'}
                </DialogDescription>
              </div>
            </div>
            {activeSnapshot && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
                Active: v{activeSnapshot.version}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mode === 'CREATE_REVISION' ? (
            /* ─────────────────────────────────────────────────────────────
               CREATE REVISION VIEW
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-6">
              {/* Revision Notice */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-300">
                <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Admin Authorization & Audit Trail</p>
                  <p className="text-amber-800 dark:text-amber-400">
                    Creating a revision freezes the current live calculated state as <strong>v{nextVersionNumber}</strong> and marks it as active. The previous version (v{activeSnapshot?.version || 1}) will be preserved in the audit history.
                  </p>
                </div>
              </div>

              {/* Summary of Differences */}
              {diffMetrics && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Calculated Changes (v{activeSnapshot?.version} &rarr; Live State)
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Gross Pay Diff</span>
                      <p className={`text-sm font-bold font-mono ${diffMetrics.grossDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diffMetrics.grossDiff >= 0 ? '+' : ''}₦{fm(diffMetrics.grossDiff)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Deductions Diff</span>
                      <p className={`text-sm font-bold font-mono ${diffMetrics.deductionsDiff >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {diffMetrics.deductionsDiff >= 0 ? '+' : ''}₦{fm(diffMetrics.deductionsDiff)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Net Take-Home Diff</span>
                      <p className={`text-sm font-bold font-mono ${diffMetrics.netDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diffMetrics.netDiff >= 0 ? '+' : ''}₦{fm(diffMetrics.netDiff)}
                      </p>
                    </div>
                  </div>

                  {/* List of Affected Staff */}
                  {diffMetrics.changedEmployees.length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex justify-between">
                        <span>Staff with Net Pay Discrepancies ({diffMetrics.changedEmployees.length})</span>
                        <span>Old &rarr; New Net Pay</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {diffMetrics.changedEmployees.map((emp) => (
                          <div key={emp.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{emp.name}</p>
                              <p className="text-[10px] text-slate-400">{emp.position}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-slate-400 line-through mr-2">₦{fm(emp.oldNet)}</span>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">₦{fm(emp.newNet)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No employee amount differences detected between current live records and locked v{activeSnapshot?.version}.</p>
                  )}
                </div>
              )}

              {/* Mandatory Reason Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mandatory Reason for Revision *</span>
                  <span className="text-[10px] font-normal text-slate-400">Required for compliance & audit log</span>
                </label>
                <Textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Approved retrospective overtime compensation for Site Supervisors following client sign-off."
                  className="min-h-[85px] text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               AUDIT HISTORY & VERSIONS TIMELINE VIEW
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recorded Versions Timeline</h4>
                {allVersions.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs italic">
                    No finalized snapshots recorded yet for {monthLabel} {year}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allVersions
                      .sort((a, b) => b.version - a.version)
                      .map((snap) => {
                        const isCurrentActive = snap.isActive;
                        return (
                          <Card
                            key={snap.id}
                            className={`border transition-all ${
                              isCurrentActive
                                ? 'border-emerald-300 bg-emerald-50/20 dark:border-emerald-800'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
                            }`}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={isCurrentActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}>
                                    Version {snap.version}
                                  </Badge>
                                  {isCurrentActive ? (
                                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
                                      <CheckCircle className="h-3 w-3 mr-1" /> Active Version
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-slate-400 text-[10px]">
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{snap.createdAt ? formatDisplayDate(snap.createdAt) : 'N/A'}</span>
                                </div>
                              </div>

                              {/* Author & Reason */}
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                  <User className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="font-semibold">{snap.createdByName || snap.createdBy || 'Administrator'}</span>
                                </div>
                                {snap.changeReason && (
                                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                                    &ldquo;{snap.changeReason}&rdquo;
                                  </p>
                                )}
                              </div>

                              {/* Snapshot Metric Chips */}
                              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                                  Staff: {snap.totals?.employeeCount ?? snap.records?.length ?? 0}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                                  Gross: ₦{fm(snap.totals?.totalGross || 0)}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold font-mono">
                                  Net: ₦{fm(snap.totals?.totalNet || 0)}
                                </span>

                                {!isCurrentActive && isAdmin && (
                                  <div className="ml-auto">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSwitchActiveVersion(snap.version)}
                                      className="h-7 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                    >
                                      Set as Active Version
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>

          {mode === 'CREATE_REVISION' && (
            <Button
              size="sm"
              onClick={handleCreateRevision}
              disabled={isSaving || !changeReason.trim() || !isAdmin}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
            >
              {isSaving ? (
                'Saving Revision...'
              ) : (
                <>
                  <GitCommit className="h-4 w-4" /> Save Revision v{nextVersionNumber}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
