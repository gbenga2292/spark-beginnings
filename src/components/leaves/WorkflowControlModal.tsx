import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { LeaveRecord } from '@/src/store/appStore';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { CheckCircle2, Circle, RotateCcw, AlertTriangle, FastForward, Play, Loader2, RefreshCw } from 'lucide-react';
import { toast, showConfirm } from '@/src/components/ui/toast';

// Step definitions — titles and leave record key that stores the subtask ID
const STEP_DEFS = [
    { title: 'Line Manager',   stepNum: 1, taskKey: 'lineManagerTaskId'   as const },
    { title: 'Head of Dept',   stepNum: 2, taskKey: 'hodTaskId'           as const },
    { title: 'Management',     stepNum: 3, taskKey: 'managementTaskId'    as const },
    { title: 'HR',             stepNum: 4, taskKey: 'hrTaskId'            as const },
];

interface WorkflowControlModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leave: LeaveRecord;
    onRecreateApprovalTask?: (leave: LeaveRecord) => void;
}

export function WorkflowControlModal({ open, onOpenChange, leave, onRecreateApprovalTask }: WorkflowControlModalProps) {
    const { subtasks, deleteSubtask, updateSubtask, addSubtask, mainTasks, users, approveSubtask } = useAppData();
    const { updateLeave } = useAppStore();
    const [isProcessing, setIsProcessing] = useState(false);

    // Resolve the live leave from the store so the modal reacts to changes without reopening
    const { leaves } = useAppStore();
    const liveLeave = leaves.find(l => l.id === leave.id) ?? leave;

    // Map each step to its current subtask
    const steps = STEP_DEFS.map(def => ({
        ...def,
        task: subtasks.find(s => s.id === (liveLeave as any)[def.taskKey]),
    }));

    const currentStepNum = liveLeave.workflowStep || 1;
    const mainTaskExists = !!liveLeave.approvalTaskId && mainTasks.some(t => t.id === liveLeave.approvalTaskId);

    // ── Start a specific step (creates the subtask) ────────────────────────────
    const handleStart = async (stepNum: number) => {
        const step = STEP_DEFS.find(s => s.stepNum === stepNum)!;

        const ok = await showConfirm(
            `This will create the Step ${stepNum} (${step.title}) approval task.`,
            { title: `Start Step ${stepNum}?`, confirmLabel: 'Start' }
        );
        if (!ok) return;

        setIsProcessing(true);
        try {
            const title = `[Step ${stepNum}/4] ${step.title} Approval — ${liveLeave.employeeName} ${liveLeave.leaveType} Leave`;
            const desc = JSON.stringify({
                text: `Leave request for ${liveLeave.employeeName} (${liveLeave.leaveType}, ${liveLeave.duration} days) is awaiting Step ${stepNum}/4 (${step.title}) approval.`,
                isLeaveApproval: true,
                leaveId: liveLeave.id,
                workflowStep: stepNum,
            });

            const created = await addSubtask({
                mainTaskId: liveLeave.approvalTaskId,
                title,
                description: desc,
                status: 'pending_approval',
                priority: 'High',
                requiresApproval: true,
            });

            updateLeave(liveLeave.id, {
                workflowStep: stepNum,
                [step.taskKey]: created?.id ?? null,
            });

            toast.success(`Step ${stepNum} (${step.title}) started!`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to start step.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Undo a completed step ──────────────────────────────────────────────────
    const handleUndo = async (stepNum: number) => {
        const stepToUndo = steps.find(s => s.stepNum === stepNum);
        if (!stepToUndo || !stepToUndo.task) return;

        const ok = await showConfirm(
            `This will delete all steps AFTER Step ${stepNum} and reset Step ${stepNum} (${stepToUndo.title}) back to Pending Approval. Are you sure?`,
            { title: 'Undo Approval?', variant: 'danger', confirmLabel: 'Undo' }
        );
        if (!ok) return;

        setIsProcessing(true);
        try {
            // Delete all downstream tasks
            for (const s of steps) {
                if (s.stepNum > stepNum && s.task) {
                    await deleteSubtask(s.task.id);
                }
            }

            // Reset target step back to pending
            await updateSubtask(stepToUndo.task.id, {
                status: 'pending_approval',
                approved_by: null,
                completed_at: null,
            });

            // Clear downstream task IDs from leave record
            const patch: any = { workflowStep: stepNum };
            if (stepNum < 2) patch.hodTaskId = null;
            if (stepNum < 3) patch.managementTaskId = null;
            if (stepNum < 4) patch.hrTaskId = null;
            if (stepNum === 1) patch.approvalStatus = 'Pending';

            updateLeave(liveLeave.id, patch);
            toast.success(`Workflow reset to Step ${stepNum}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to undo step.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Skip current pending step → trigger next ───────────────────────────────
    const handleSkipToNext = async (stepNum: number) => {
        if (stepNum > 4) return;
        
        const step = steps.find(s => s.stepNum === stepNum);
        if (!step || !step.task) return;
        
        const ok = await showConfirm(
            `This will auto-approve Step ${stepNum} and immediately advance the workflow.`,
            { title: 'Skip & Auto-Approve?', confirmLabel: 'Skip & Approve' }
        );
        if (!ok) return;

        setIsProcessing(true);
        try {
            await approveSubtask(step.task.id);
            toast.success(`Step ${stepNum} bypassed and auto-approved.`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to skip step.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <DialogTitle>Workflow Control Center</DialogTitle>
                    <DialogDescription>
                        Manage approval steps for <strong>{liveLeave.employeeName}</strong>'s{' '}
                        {liveLeave.leaveType} leave ({liveLeave.duration} days).
                    </DialogDescription>
                </DialogHeader>

                <div className="p-5 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-130px)]">
                    {/* Main task status */}
                    {!mainTaskExists && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>No approval main task found for this leave. You must recreate it to continue the workflow.</span>
                            </div>
                            {onRecreateApprovalTask && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 h-8 text-xs bg-white text-red-700 border-red-200 hover:bg-red-50"
                                    onClick={() => onRecreateApprovalTask(liveLeave)}
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" /> Recreate Task
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="border rounded-md divide-y">
                        <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-t-md">
                            4-Step Sequential Approval
                        </div>

                        {steps.map((step, idx) => {
                            const isCompleted  = step.task?.status === 'completed';
                            const isPending    = step.task?.status === 'pending_approval' || step.task?.status === 'in_progress';
                            const isNotStarted = !step.task;

                            // A step is actionable (can be started) if:
                            // - it's step 1 (always), OR
                            // - the previous step is completed
                            const prevStep     = idx > 0 ? steps[idx - 1] : null;
                            const canStart     = isNotStarted && mainTaskExists && (idx === 0 || prevStep?.task?.status === 'completed');

                            return (
                                <div key={step.stepNum} className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        ) : isPending ? (
                                            <Circle className="w-5 h-5 text-orange-400 fill-orange-100 shrink-0" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-slate-200 shrink-0" />
                                        )}
                                        <div>
                                            <p className={`text-sm font-medium ${isNotStarted && !canStart ? 'text-slate-400' : 'text-slate-800'}`}>
                                                Step {step.stepNum}: {step.title}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${
                                                isCompleted  ? 'text-green-600' :
                                                isPending    ? 'text-orange-500' :
                                                canStart     ? 'text-blue-500'   :
                                                'text-slate-400'
                                            }`}>
                                                {isCompleted  ? `✓ Approved${step.task?.approvedBy ? ` by ${users.find(u => u.id === step.task.approvedBy)?.name?.split(' ')[0] || 'Unknown'}` : ''}`
                                                : isPending    ? 'Pending Approval'
                                                : canStart     ? 'Ready to start'
                                                : 'Waiting for previous step'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 shrink-0">
                                        {/* Start button — shown when step is not started but ready */}
                                        {canStart && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                                onClick={() => handleStart(step.stepNum)}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing
                                                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    : <Play className="w-3 h-3 mr-1" />
                                                }
                                                Start
                                            </Button>
                                        )}

                                        {/* Skip button — shown for the active pending step (not step 4) */}
                                        {isPending && step.stepNum < 4 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => handleSkipToNext(step.stepNum)}
                                                disabled={isProcessing}
                                            >
                                                <FastForward className="w-3 h-3 mr-1" /> Skip
                                            </Button>
                                        )}

                                        {/* Undo button — shown for completed steps */}
                                        {isCompleted && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                                                onClick={() => handleUndo(step.stepNum)}
                                                disabled={isProcessing}
                                            >
                                                <RotateCcw className="w-3 h-3 mr-1" /> Undo
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-xs flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                            <strong>Admin Controls:</strong> <em>Start</em> creates the task for that step.
                            <em> Skip</em> bypasses the current step (no formal approval).
                            <em> Undo</em> resets a step and deletes all downstream tasks.
                        </p>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0 mt-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
