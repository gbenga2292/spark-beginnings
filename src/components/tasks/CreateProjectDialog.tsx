import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { X, FolderOpen, Plus, Trash2, Building2 } from "lucide-react";
import type { AppUser } from "@/src/types/tasks";
import { useAppStore } from "@/src/store/appStore";
import { Button } from "@/src/components/ui/button";

export function CreateProjectDialog({ 
  onClose, 
  onSubmit, 
  users, 
  currentUserId, 
  teamId, 
  workspaceId,
  initialProjectName = "",
  initialStatus = "Active",
  isEditing = false,
  initialData = null
}: {
  onClose: () => void;
  onSubmit: (payload: any) => void;
  users: AppUser[];
  currentUserId: string;
  teamId: string;
  workspaceId: string;
  initialProjectName?: string;
  initialStatus?: string;
  isEditing?: boolean;
  initialData?: any;
}) {
  const [name, setName] = useState(initialData?.name || initialProjectName);
  const [serviceType, setServiceType] = useState(initialData?.serviceType || "");
  const [projectStatus, setProjectStatus] = useState(initialData?.status || initialStatus);
  const [startDate, setStartDate] = useState(initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : (initialStatus === "Pending" ? "" : new Date().toISOString().split('T')[0]));
  const [durationDays, setDurationDays] = useState(initialData?.durationDays ? String(initialData.durationDays) : (initialStatus === "Pending" ? "" : "30"));
  const [endDate, setEndDate] = useState(initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : "");

  // Auto-calculate duration whenEnded
  useEffect(() => {
    if (projectStatus === 'Ended' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        setDurationDays(diffDays.toString());
      }
    }
  }, [projectStatus, startDate, endDate]);

  const departmentTasksList = useAppStore(state => state.departmentTasksList);
  const serviceTemplates = useMemo(() => {
    return departmentTasksList
      .filter(d => d.department.startsWith('__SERVICE__'))
      .map(d => ({
        serviceName: d.department.replace('__SERVICE__', ''),
        subtasks: d.onboardingTasks
      }));
  }, [departmentTasksList]);
  
  // Local state for subtasks so user can tweak them before creating
  const [subtasks, setSubtasks] = useState<{id?: string, title: string, assignee?: string, deadline?: string, hasUpdate?: boolean}[]>(initialData?.subtasks || []);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // When service type changes, populate subtasks
  useEffect(() => {
    if (!serviceType) {
      setSubtasks([]);
      return;
    }
    const tmpl = serviceTemplates.find(s => s.serviceName === serviceType);
    if (tmpl) {
      setSubtasks([...tmpl.subtasks]);
    } else {
      setSubtasks([]);
    }
  }, [serviceType, serviceTemplates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      serviceType: serviceType.trim() || 'General',
      status: projectStatus,
      startDate: projectStatus !== 'Pending' ? (startDate || new Date().toISOString()) : null,
      durationDays: projectStatus !== 'Pending' ? (parseInt(durationDays) || 30) : null,
      endDate: projectStatus === 'Ended' ? endDate : null,
      teamId,
      workspaceId,
      createdBy: currentUserId,
      subtasks: subtasks // Pass the customized subtasks along
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{isEditing ? "Edit Project" : "New Project"}</h2>
              <p className="text-[11px] text-muted-foreground font-medium">{isEditing ? "Update project details" : "Create a new project task"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {initialData?.linkedSite && (
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                 </div>
                 <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-900/60">Linked Site</p>
                    <p className="text-sm font-semibold text-indigo-900">{initialData.linkedSite}</p>
                 </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                Project Name <span className="text-destructive">*</span>
              </label>
              <input required autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">Service Type</label>
                <select value={serviceType} onChange={e => setServiceType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm">
                  <option value="">-- Custom/None --</option>
                  {serviceTemplates.map(s => (
                    <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Selecting a service loads its preset subtasks below.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">Project Status <span className="text-destructive">*</span></label>
                <select value={projectStatus} onChange={e => setProjectStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm">
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Ended">Ended</option>
                </select>
              </div>
            </div>

            {projectStatus !== 'Pending' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">Start Date <span className="text-destructive">*</span></label>
                  <input type="date" required={projectStatus !== 'Pending'} value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm [color-scheme:light] dark:[color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">Duration (Days) <span className="text-destructive">*</span></label>
                  <input type="number" required={projectStatus !== 'Pending'} min="1" value={durationDays} onChange={e => setDurationDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm" />
                </div>
                {projectStatus === 'Ended' && (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">End Date <span className="text-destructive">*</span></label>
                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all shadow-sm [color-scheme:light] dark:[color-scheme:dark]" />
                  </div>
                )}
              </div>
            )}

            {/* Subtasks editing section */}
            <div className="border border-border bg-muted/20 rounded-xl overflow-hidden mt-4">
               <div className="bg-muted px-4 py-2 border-b border-border flex justify-between items-center">
                 <span className="text-xs font-bold uppercase tracking-wider text-foreground">Project Subtasks</span>
                 <span className="text-[10px] bg-background text-foreground px-2 py-0.5 rounded font-bold">{subtasks.length}</span>
               </div>
               <div className="p-4 space-y-3">
                 <div className="flex gap-2">
                   <input 
                     value={newTaskTitle} 
                     onChange={e => setNewTaskTitle(e.target.value)}
                     placeholder="Add custom subtask..."
                     className="flex-1 text-sm px-3 py-1.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                     onKeyDown={e => {
                       if (e.key === 'Enter') {
                         e.preventDefault();
                         if (newTaskTitle) {
                           setSubtasks([...subtasks, { title: newTaskTitle, assignee: '' }]);
                           setNewTaskTitle("");
                         }
                       }
                     }}
                   />
                   <button 
                     type="button"
                     onClick={() => {
                        if (newTaskTitle) {
                          setSubtasks([...subtasks, { title: newTaskTitle, assignee: '' }]);
                          setNewTaskTitle("");
                        }
                     }}
                     className="px-3 py-1.5 bg-background border border-input rounded-md text-sm font-medium hover:bg-muted text-foreground transition flex items-center gap-1"
                   >
                     <Plus className="w-3.5 h-3.5"/> Add
                   </button>
                 </div>
                 
                 <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                   {subtasks.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">No subtasks. Add them above or select a Service.</p>}
                   {subtasks.map((t, i) => (
                      <div key={i} className="flex flex-col gap-2 text-sm bg-background p-3 rounded-lg border border-border shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 max-w-[85%] w-full">
                            <span className="w-5 h-5 rounded-full bg-muted flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-muted-foreground">{i+1}</span>
                            <input 
                              value={t.title} 
                              onChange={e => {
                                 const next = [...subtasks];
                                 next[i].title = e.target.value;
                                 setSubtasks(next);
                              }}
                              disabled={t.hasUpdate}
                              className={`w-full font-medium text-foreground bg-transparent focus:outline-none focus:border-b focus:border-primary/30 ${t.hasUpdate ? 'opacity-70 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isEditing && (
                          <div className="flex items-center gap-3 pl-7">
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] uppercase font-bold text-muted-foreground">Deadline:</span>
                               <input type="date" value={t.deadline || ''} onChange={e => {
                                 const next = [...subtasks];
                                 // @ts-ignore
                                 next[i].deadline = e.target.value;
                                 setSubtasks(next);
                               }} className="text-xs px-2 py-1 rounded border border-input focus:outline-none focus:ring-1 focus:ring-primary/30" />
                            </div>
                            {t.hasUpdate && <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Has updates (Title locked)</span>}
                          </div>
                        )}
                      </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border rounded-b-2xl flex-shrink-0">
            <Button type="button" onClick={onClose}
              className="px-5 py-2 h-auto rounded-xl border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-muted transition-colors shadow-sm">Cancel</Button>
            <Button type="submit" 
              disabled={
                !name.trim() || 
                (projectStatus !== 'Pending' && (!startDate || !durationDays)) || 
                (projectStatus === 'Ended' && !endDate)
              }
              className="px-5 py-2 h-auto rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              {isEditing ? "Save Changes" : "Create Project Note"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
