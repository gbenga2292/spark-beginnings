import { useState } from "react";
import { Task, TaskPriority, TaskStatus } from "@/src/types/tasks/task";
import { departments } from "@/src/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/task_ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/src/components/ui/button";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: Omit<Task, "id" | "createdAt" | "updates">) => void;
}

export function CreateTaskDialog({ open, onOpenChange, onSubmit }: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [department, setDepartment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assignee.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      assignee: assignee.trim(),
      department: department || "General",
      dueDate: dueDate || new Date().toISOString().split("T")[0],
      priority,
      status: "pending" as TaskStatus,
    });
    setTitle(""); setDescription(""); setAssignee("");
    setDepartment(""); setDueDate(""); setPriority("medium");
    onOpenChange(false);
  };

  const priorityStyles: Record<TaskPriority, { selected: string; default: string }> = {
    low: { selected: "bg-muted text-muted-foreground border-border ring-1 ring-border", default: "bg-card text-muted-foreground border border-border hover:bg-muted" },
    medium: { selected: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30 ring-1 ring-yellow-500/30", default: "bg-card text-muted-foreground border border-border hover:bg-muted" },
    high: { selected: "bg-red-500/10 text-red-500 border-red-500/30 ring-1 ring-red-500/30", default: "bg-card text-muted-foreground border border-border hover:bg-muted" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg bg-card border border-border rounded-2xl shadow-gcal p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-heading font-medium text-foreground">New Task</DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <Field label="Title *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="gcal-input"
              autoFocus
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details or notes..."
              rows={3}
              className="gcal-input resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <Field label="Assignee *">
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Full name"
                className="gcal-input"
              />
            </Field>

            {/* Department */}
            <Field label="Department">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="gcal-input"
              >
                <option value="">Select...</option>
                {departments.filter(d => d !== "All").map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <Field label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="gcal-input"
              />
            </Field>

            {/* Priority */}
            <Field label="Priority">
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all
                      ${priority === p ? priorityStyles[p].selected : priorityStyles[p].default}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-auto py-2 rounded-full border border-border bg-card text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !assignee.trim()}
              className="flex-1 h-auto py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
