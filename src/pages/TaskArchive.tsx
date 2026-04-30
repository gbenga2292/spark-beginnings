import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Archive, RotateCcw, Trash2, ArrowLeft, Clock, AlertTriangle, 
  Search, Filter, Calendar, ChevronRight, Info, CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useWorkspace } from "@/src/hooks/use-workspace";
import { useAppStore } from "@/src/store/appStore";
import { useAuth } from "@/src/hooks/useAuth";
import { Button } from "@/src/components/ui/button";
import { toast, showConfirm } from "@/src/components/ui/toast";
import { format, differenceInDays } from "date-fns";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export function TaskArchive() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { workspace: teamWs } = useWorkspace();
  const { hrVariables } = useAppStore();
  const { 
    fetchArchivedMainTasks, 
    fetchArchivedSubtasks, 
    restoreMainTask, 
    restoreSubtask,
    deleteMainTaskPermanently,
    deleteSubtaskPermanently,
    mainTasks: allMainTasks,
    users
  } = useAppData();

  const appUser = users.find(u => u.id === currentUser?.id);
  const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;

  const [archivedMain, setArchivedMain] = useState<any[]>([]);
  const [archivedSubs, setArchivedSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'subtasks' | 'main_tasks'>('subtasks');

  const retentionDays = hrVariables.taskArchiveRetentionDays || 30;

  useEffect(() => {
    if (!teamWs?.id) return;
    loadArchive();
  }, [teamWs?.id]);

  const loadArchive = async () => {
    setLoading(true);
    try {
      let [m, s] = await Promise.all([
        fetchArchivedMainTasks(teamWs!.id, retentionDays),
        fetchArchivedSubtasks(teamWs!.id, retentionDays)
      ]);

      if (isExternalHr) {
        m = m.filter((mt: any) => !!mt.is_hr_task);
        s = s.filter((st: any) => {
          const mt = st.main_tasks;
          return mt && !!mt.is_hr_task;
        });
      }

      setArchivedMain(m);
      setArchivedSubs(s);
    } catch (err) {
      console.error("Failed to load archive:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreMain = async (id: string) => {
    try {
      await restoreMainTask(id);
      setArchivedMain(prev => prev.filter(x => x.id !== id));
      toast.success("Main task restored successfully");
    } catch (err) {
      toast.error("Failed to restore task");
    }
  };

  const handleRestoreSub = async (id: string) => {
    try {
      await restoreSubtask(id);
      setArchivedSubs(prev => prev.filter(x => x.id !== id));
      toast.success("Subtask restored successfully");
    } catch (err) {
      toast.error("Failed to restore subtask");
    }
  };

  const handlePermanentDelete = async (id: string, isMain: boolean) => {
    const conf = await showConfirm(
      `Permanently delete this ${isMain ? 'task and all its subtasks' : 'subtask'}? This cannot be undone.`, 
      { variant: 'danger' }
    );
    if (!conf) return;

    try {
      if (isMain) {
        await deleteMainTaskPermanently(id);
        setArchivedMain(prev => prev.filter(x => x.id !== id));
      } else {
        await deleteSubtaskPermanently(id);
        setArchivedSubs(prev => prev.filter(x => x.id !== id));
      }
      toast.success("Permanently deleted");
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const filteredSubs = archivedSubs.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMain = archivedMain.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const getDaysLeft = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    const left = differenceInDays(expiryDate, new Date());
    return Math.max(0, left);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-full">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Archive</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Archive className="w-3.5 h-3.5" /> Items here are kept for {retentionDays} days before final deletion
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search archive..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border-none text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </motion.div>

      <div className="flex items-center gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('subtasks')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'subtasks' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Subtasks ({archivedSubs.length})
        </button>
        <button 
          onClick={() => setActiveTab('main_tasks')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'main_tasks' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Main Tasks ({archivedMain.length})
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading archive...</p>
        </div>
      ) : (activeTab === 'subtasks' ? filteredSubs : filteredMain).length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-20 text-center shadow-sm">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Archive is empty</h3>
          <p className="text-sm text-muted-foreground mt-1">No {activeTab === 'subtasks' ? 'subtasks' : 'tasks'} found in the archive.</p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {(activeTab === 'subtasks' ? filteredSubs : filteredMain).map((item: any) => {
              const daysLeft = getDaysLeft(item.deleted_at);
              const parentTask = activeTab === 'subtasks' ? allMainTasks.find(m => m.id === item.mainTaskId) : null;
              
              return (
                <motion.div 
                  key={item.id} 
                  variants={item}
                  layout
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all hover:border-primary/20"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                      {activeTab === 'subtasks' && parentTask && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate">
                          Part of: {parentTask.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3 h-3" /> Deleted {format(new Date(item.deleted_at), 'MMM d, yyyy')}
                      </span>
                      <span className={`flex items-center gap-1.5 font-bold ${daysLeft <= 3 ? 'text-rose-500' : 'text-amber-600'}`}>
                        <Clock className="w-3 h-3" /> {daysLeft} days until permanent deletion
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => activeTab === 'subtasks' ? handleRestoreSub(item.id) : handleRestoreMain(item.id)}
                      className="h-8 gap-1.5 text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> RESTORE
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handlePermanentDelete(item.id, activeTab === 'main_tasks')}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-5 flex gap-4">
        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">About the Task Archive</h4>
          <p className="text-xs text-amber-800/70 dark:text-amber-100/60 mt-1 leading-relaxed">
            When you delete a task or subtask, it isn't removed immediately. It stays here for {retentionDays} days, 
            allowing you to restore it if needed. After this period, the system will automatically remove it permanently.
            To change the retention period, visit the <b>Settings</b> page.
          </p>
        </div>
      </div>
    </div>
  );
}
