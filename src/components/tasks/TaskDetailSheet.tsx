import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/src/components/task_ui/sheet";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useAuth } from "@/src/hooks/useAuth";
import { useUserStore } from "@/src/store/userStore";
import { TaskInboxView } from "./TaskInboxView";
import { AppUser } from "@/src/types/tasks";

interface TaskDetailSheetProps {
  subtaskId: string | null;
  onClose: () => void;
}

export function TaskDetailSheet({ subtaskId, onClose }: TaskDetailSheetProps) {
  const { subtasks, mainTasks, users } = useAppData();
  const { user: currentUser } = useAuth();
  const appUser = useUserStore(s => s.getCurrentUser());

  // ── HR visibility gate — mirrors Tasks.tsx / TaskDashboard.tsx ──────────
  const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;
  const isHrDept = appUser?.department?.toLowerCase() === 'hr';
  const hasHrAccess = isExternalHr || isHrDept;
  const myId = currentUser?.id ?? '';

  const visibleMainTasks = mainTasks.filter(mt => {
    const isCreator = mt.created_by === myId || (mt as any).createdBy === myId;
    const isAssigned = (mt.assignedTo || (mt as any).assigned_to || '').includes(myId);
    const isHr = mt.is_hr_task || (mt as any).isHrTask;

    if (isExternalHr) {
      if (isHr) return true;
      return isCreator || isAssigned;
    }
    
    return true;
  });

  const visibleMainTaskIds = new Set(visibleMainTasks.map(mt => mt.id));

  const visibleSubtasks = subtasks.filter(s => {
    const mtId = (s as any).main_task_id || s.mainTaskId;
    return visibleMainTaskIds.has(mtId);
  });

  // Track the active subtask ID locally inside the full sheet so the user can navigate via the sidebar!
  const [activeId, setActiveId] = useState<string | null>(subtaskId);

  // If the prop changes (e.g. from an external click), update the internal state
  useEffect(() => {
    setActiveId(subtaskId);
  }, [subtaskId]);

  // Make sure we only pass active, non-deleted users to align with the rest of the application
  const activeUsers = users.filter((u: any) => !u.isDeleted && !u.isSuspended) as AppUser[];

  return (
    <Sheet open={!!subtaskId} onOpenChange={(open) => !open && onClose()} modal={false}>
      <SheetContent 
        side="right" 
        className="!w-screen !max-w-[100vw] h-screen p-0 border-0 bg-white"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="sr-only">
          <SheetTitle>Task Details</SheetTitle>
          <SheetDescription>View and manage subtask details, comments, and activity.</SheetDescription>
        </div>
        <TaskInboxView
          subtasks={visibleSubtasks}
          mainTasks={visibleMainTasks}
          users={activeUsers}
          activeSubtaskId={activeId}
          onSelectSubtask={setActiveId}
          onClose={onClose}
          // The CSS class makes it span the absolute full screen of the modal
          className="flex w-full h-full bg-white"
        />
      </SheetContent>
    </Sheet>
  );
}
