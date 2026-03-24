import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/src/components/task_ui/sheet";
import { useAppData } from "@/src/contexts/AppDataContext";
import { TaskInboxView } from "./TaskInboxView";
import { AppUser } from "@/src/types/tasks";

interface TaskDetailSheetProps {
  subtaskId: string | null;
  onClose: () => void;
}

export function TaskDetailSheet({ subtaskId, onClose }: TaskDetailSheetProps) {
  const { subtasks, mainTasks, users } = useAppData();
  
  // Track the active subtask ID locally inside the full sheet so the user can navigate via the sidebar!
  const [activeId, setActiveId] = useState<string | null>(subtaskId);

  // If the prop changes (e.g. from an external click), update the internal state
  useEffect(() => {
    setActiveId(subtaskId);
  }, [subtaskId]);

  // Make sure we only pass active, non-deleted users to align with the rest of the application
  const activeUsers = users.filter((u: any) => !u.isDeleted && !u.isSuspended) as AppUser[];

  return (
    <Sheet open={!!subtaskId} onOpenChange={(open) => !open && onClose()}>
      {/* !w-screen and !max-w-[100vw] forcefully override Shadcn's internal sm:max-w-sm side sheet class */}
      <SheetContent side="right" className="!w-screen !max-w-[100vw] h-screen p-0 border-0 bg-white">
        <TaskInboxView
          subtasks={subtasks}
          mainTasks={mainTasks}
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
