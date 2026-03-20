import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useAuth } from '@/src/hooks/useAuth';
import { toast } from '@/src/components/ui/toast';
import type { MainTask, SubTask, TaskComment, AppUser, CommentAttachment } from '@/src/types/tasks';

// ── Typed context interface ──────────────────────────────────────────────────
interface AppDataContextType {
    mainTasks: any[];
    subtasks: any[];
    users: any[];
    comments: any[];
    projects: any[];
    reminders: any[];
    workspaces: any[];
    addReminder: (...args: any[]) => Promise<void>;
    updateReminder: (...args: any[]) => Promise<void>;
    deleteReminder: (...args: any[]) => Promise<void>;
    toggleReminderActive: (...args: any[]) => Promise<void>;
    createProject: (...args: any[]) => Promise<void>;
    createMainTask: (task: any, subs?: any[]) => Promise<any>;
    updateMainTask: (id: string, p: any) => Promise<void>;
    deleteMainTask: (id: string) => Promise<void>;
    addSubtask: (sub: any) => Promise<void>;
    updateSubtask: (id: string, p: any) => Promise<void>;
    deleteSubtask: (id: string) => Promise<void>;
    assignSubtask: (id: string, userId: string) => Promise<void>;
    updateSubtaskStatus: (id: string, status: string, userId?: string) => Promise<void>;
    approveSubtask: (id: string, userId?: string, note?: string) => Promise<void>;
    rejectSubtask: (id: string, userId?: string, note?: string) => Promise<void>;
    postComment: (subId: string, mainId: string, authorId: string, text: string, attachments?: CommentAttachment[], fileLinks?: string[]) => Promise<void>;
    getMainTaskComments: (id: string) => any[];
    getSubtaskComments: (subtaskId: string) => any[];
    getMainTaskWorkflow: (mainTaskId: string) => any[];
}

export const TaskContext = createContext<AppDataContextType | null>(null);

export function deriveMainTaskStatus(mainTaskId: string, subtasks: any[]): 'not_started'|'in_progress'|'completed' {
    const subs = subtasks.filter(s => s.main_task_id === mainTaskId || s.mainTaskId === mainTaskId);
    if (!subs.length) return 'not_started';
    if (subs.every(s => s.status === 'completed')) return 'completed';
    if (subs.some(s => s.status === 'in_progress' || s.status === 'completed')) return 'in_progress';
    return 'not_started';
}

export function mapReminderToCamel(r: any) {
    if (!r) return r;
    return {
        ...r,
        remindAt: r.remind_at,
        endAt: r.end_at,
        recipientIds: r.recipient_ids || [],
        sendEmail: r.send_email,
        isActive: r.is_active,
        createdBy: r.created_by,
        mainTaskId: r.main_task_id,
        subtaskId: r.subtask_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastSentAt: r.last_sent_at,
    };
}

export function getMainTaskProgress(mainTaskId: string, subtasks: any[]) {
    const subs = subtasks.filter(s => s.main_task_id === mainTaskId || s.mainTaskId === mainTaskId);
    return { total: subs.length, completed: subs.filter(s => s.status === 'completed').length };
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [mainTasks, setMainTasks] = useState<any[]>([]);
    const [subtasks, setSubtasks] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [reminders, setReminders] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        // ── Initial fetch ─────────────────────────────────────────────────────
        const fetchAll = async () => {
            try {
                const [mtRes, stRes, pRes, projRes, commRes, remRes] = await Promise.all([
                    supabase.from('main_tasks').select('*').eq('is_deleted', false),
                    supabase.from('subtasks').select('*'),
                    supabase.from('profiles').select('*'),
                    supabase.from('sites').select('*'),
                    supabase.from('task_updates').select('*').order('created_at', { ascending: true }),
                    supabase.from('reminders').select('*'),
                ]);
                if (mtRes.error) console.error('Failed to load main_tasks:', mtRes.error);
                if (stRes.error) console.error('Failed to load subtasks:', stRes.error);
                if (pRes.error) console.error('Failed to load profiles:', pRes.error);
                if (projRes.error) console.error('Failed to load sites:', projRes.error);
                if (commRes.error) console.error('Failed to load task_updates:', commRes.error);
                if (remRes.error) console.error('Failed to load reminders:', remRes.error);

                if (mtRes.data) setMainTasks(mtRes.data);
                if (stRes.data) setSubtasks(stRes.data);
                if (pRes.data) setUsers(pRes.data);
                if (projRes.data) {
                    setProjects(projRes.data.map((p: any) => ({
                        ...p,
                        workspaceId: 'dcel-team', // Or derive appropriately
                        templateId: '',
                        serviceType: p.client || 'General',
                        startDate: p.start_date || p.created_at,
                        durationDays: parseInt(p.vat) || 30, // Fallback
                        // Note: If old sites don't have a linked mainTaskId, they won't be clickable into tasks
                    })));
                }
                if (commRes.data) setComments(commRes.data);
                if (remRes.data) setReminders(remRes.data.map(mapReminderToCamel));
            } catch (err) {
                console.error('Task data fetch failed:', err);
                toast.error('Failed to load task data. Please refresh.');
            }
        };
        fetchAll();

        // ── Real-time subscriptions ───────────────────────────────────────────
        const channel = supabase
            .channel('app-realtime')

            // task_updates (chat messages)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_updates' }, (payload) => {
                setComments(prev => {
                    // avoid duplicates (our own optimistic insert may already exist)
                    if (prev.some(c => c.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_updates' }, (payload) => {
                setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_updates' }, (payload) => {
                setComments(prev => prev.filter(c => c.id !== payload.old.id));
            })

            // subtasks
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subtasks' }, (payload) => {
                setSubtasks(prev => {
                    if (prev.some(s => s.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subtasks' }, (payload) => {
                setSubtasks(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'subtasks' }, (payload) => {
                setSubtasks(prev => prev.filter(s => s.id !== payload.old.id));
            })

            // main_tasks
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'main_tasks' }, (payload) => {
                if (payload.new.is_deleted) return;
                setMainTasks(prev => {
                    if (prev.some(t => t.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'main_tasks' }, (payload) => {
                if (payload.new.is_deleted) {
                    setMainTasks(prev => prev.filter(t => t.id !== payload.new.id));
                } else {
                    setMainTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
                }
            })
            // reminders
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reminders' }, (payload) => {
                const camel = mapReminderToCamel(payload.new);
                setReminders(prev => {
                    if (prev.some(r => r.id === camel.id)) return prev;
                    return [...prev, camel];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reminders' }, (payload) => {
                const camel = mapReminderToCamel(payload.new);
                setReminders(prev => prev.map(r => r.id === camel.id ? camel : r));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reminders' }, (payload) => {
                setReminders(prev => prev.filter(r => r.id !== payload.old.id));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // ── Memoized action callbacks ─────────────────────────────────────────────
    const createMainTask = useCallback(async (task: any, subs: any[] = []) => {
        const payload = {
            title: task.title,
            description: task.description || null,
            createdBy: task.createdBy || user?.id,
            teamId: task.teamId || '',
            workspaceId: task.workspaceId || task.teamId || '',
            assignedTo: task.assignedTo || null,
            deadline: task.deadline || null,
            priority: task.priority || null,
        };
        const { data, error } = await supabase.from('main_tasks').insert(payload).select().single();
        if (error) {
            console.error('createMainTask error:', error);
            toast.error('Failed to create task. Please try again.');
            return null;
        }
        if (data) {
            setMainTasks(prev => [...prev, data]);
            toast.success('Task created successfully');
            if (subs.length) {
                const subTasksPayload = subs.map(s => ({
                    title: s.title,
                    description: s.description || null,
                    assignedTo: s.assignedTo || null,
                    status: s.status || 'not_started',
                    deadline: s.deadline || null,
                    priority: s.priority || null,
                    mainTaskId: data.id,
                }));
                const { data: insertedSubs, error: subErr } = await supabase.from('subtasks').insert(subTasksPayload).select();
                if (subErr) {
                    console.error('createMainTask subtasks error:', subErr);
                    toast.error('Task created but subtasks failed to save.');
                }
                if (insertedSubs) {
                    setSubtasks(prev => [...prev, ...insertedSubs]);
                }
            }
        }
        return data;
    }, [user?.id]);

    const updateMainTask = useCallback(async (id: string, p: any) => {
        const payload: any = { ...p };
        if (p.assignedTo !== undefined) payload.assignedTo = p.assignedTo;
        if (p.teamId !== undefined) payload.teamId = p.teamId;
        if (p.workspaceId !== undefined) payload.workspaceId = p.workspaceId;
        if (p.createdBy !== undefined) payload.createdBy = p.createdBy;
        const { data, error } = await supabase.from('main_tasks').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('updateMainTask error:', error);
            toast.error('Failed to update task.');
            return;
        }
        if (data) setMainTasks(prev => prev.map(t => t.id === id ? data : t));
    }, []);

    const deleteMainTask = useCallback(async (id: string) => {
        const { error } = await supabase.from('main_tasks').update({ is_deleted: true }).eq('id', id);
        if (error) {
            console.error('deleteMainTask error:', error);
            toast.error('Failed to delete task.');
            return;
        }
        setMainTasks(prev => prev.filter(t => t.id !== id));
        toast.success('Task deleted');
    }, []);

    const addSubtask = useCallback(async (sub: any) => {
        const payload = {
            title: sub.title,
            description: sub.description || null,
            assignedTo: sub.assignedTo || null,
            status: sub.status || 'not_started',
            deadline: sub.deadline || null,
            priority: sub.priority || null,
            mainTaskId: sub.mainTaskId,
        };
        const { data, error } = await supabase.from('subtasks').insert(payload).select().single();
        if (error) {
            console.error('addSubtask error:', error);
            toast.error('Failed to add subtask.');
            return;
        }
        if (data) setSubtasks(prev => [...prev, data]);
    }, []);

    const updateSubtask = useCallback(async (id: string, p: any) => {
        const payload: any = { ...p };
        if (p.assignedTo !== undefined) { payload.assignedTo = p.assignedTo; }
        if (p.mainTaskId !== undefined) { payload.mainTaskId = p.mainTaskId; }
        const { data, error } = await supabase.from('subtasks').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('updateSubtask error:', error);
            toast.error('Failed to update subtask.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
    }, []);

    const deleteSubtask = useCallback(async (id: string) => {
        const { error } = await supabase.from('subtasks').delete().eq('id', id);
        if (error) {
            console.error('deleteSubtask error:', error);
            toast.error('Failed to delete subtask.');
            return;
        }
        setSubtasks(prev => prev.filter(s => s.id !== id));
    }, []);

    const assignSubtask = useCallback(async (id: string, userId: string) => {
        const { data, error } = await supabase.from('subtasks').update({ assignedTo: userId }).eq('id', id).select().single();
        if (error) {
            console.error('assignSubtask error:', error);
            toast.error('Failed to assign subtask.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
    }, []);

    const updateSubtaskStatus = useCallback(async (id: string, status: string, _userId?: string) => {
        const { data, error } = await supabase.from('subtasks').update({ status }).eq('id', id).select().single();
        if (error) {
            console.error('updateSubtaskStatus error:', error);
            toast.error('Failed to update status.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
    }, []);

    const approveSubtask = useCallback(async (id: string, userId?: string, note?: string) => {
        const { data, error } = await supabase.from('subtasks').update({ status: 'completed', approvedBy: userId || user?.id, approval_note: note }).eq('id', id).select().single();
        if (error) {
            console.error('approveSubtask error:', error);
            toast.error('Failed to approve subtask.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        toast.success('Subtask approved');
    }, [user?.id]);

    const rejectSubtask = useCallback(async (id: string, _userId?: string, note?: string) => {
        const { data, error } = await supabase.from('subtasks').update({ status: 'in_progress', rejectedAt: new Date().toISOString(), approval_note: note }).eq('id', id).select().single();
        if (error) {
            console.error('rejectSubtask error:', error);
            toast.error('Failed to reject subtask.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        toast.info('Subtask sent back for revision');
    }, []);

    const postComment = useCallback(async (subId: string, mainId: string, authorId: string, text: string, _attachments?: CommentAttachment[], _fileLinks?: string[]) => {
        // task_updates columns: id, task_id (legacy), subtask_id, main_task_id, text, author_id, created_at
        const { data, error } = await supabase
            .from('task_updates')
            .insert({ subtask_id: subId || null, main_task_id: mainId, text, author_id: authorId })
            .select()
            .single();
        if (error) {
            console.error('postComment error:', error);
            toast.error('Failed to post update.');
            return;
        }
        if (data) setComments(prev => {
            if (prev.some(c => c.id === data.id)) return prev;
            return [...prev, data];
        });
    }, []);

    const getMainTaskComments = useCallback((id: string) => comments.filter(c => c.task_id === id || c.main_task_id === id), [comments]);
    // Since task_updates has no subtask_id column, comments are now keyed by subtask_id stored in-memory (augmented on insert)
    const getSubtaskComments = useCallback((subtaskId: string) => comments.filter(c => c.subtask_id === subtaskId || c.task_id === subtaskId), [comments]);
    const getMainTaskWorkflow = useCallback((_mainTaskId: string) => [], []);

    const addReminder = useCallback(async (rem: any) => {
        const payload = {
            title: rem.title,
            body: rem.body || null,
            remind_at: rem.remindAt,
            end_at: rem.endAt || null,
            frequency: rem.frequency || 'once',
            recipient_ids: rem.recipientIds || [],
            send_email: rem.sendEmail || false,
            is_active: rem.isActive ?? true,
            created_by: rem.createdBy || user?.id,
            main_task_id: rem.mainTaskId || null,
        };
        const { data, error } = await supabase.from('reminders').insert(payload).select().single();
        if (error) {
            console.error('addReminder error:', error);
            toast.error('Failed to add reminder.');
            return;
        }
        if (data) setReminders(prev => [...prev, mapReminderToCamel(data)]);
    }, [user?.id]);

    const updateReminder = useCallback(async (id: string, p: any) => {
        const payload: any = { ...p };
        if ('remindAt' in p) { payload.remind_at = p.remindAt; delete payload.remindAt; }
        if ('endAt' in p) { payload.end_at = p.endAt; delete payload.endAt; }
        if ('recipientIds' in p) { payload.recipient_ids = p.recipientIds; delete payload.recipientIds; }
        if ('sendEmail' in p) { payload.send_email = p.sendEmail; delete payload.sendEmail; }
        if ('isActive' in p) { payload.is_active = p.isActive; delete payload.isActive; }
        if ('mainTaskId' in p) { payload.main_task_id = p.mainTaskId; delete payload.mainTaskId; }

        const { data, error } = await supabase.from('reminders').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('updateReminder error:', error);
            toast.error('Failed to update reminder.');
            return;
        }
        if (data) setReminders(prev => prev.map(r => r.id === id ? mapReminderToCamel(data) : r));
    }, []);

    const deleteReminder = useCallback(async (id: string) => {
        const { error } = await supabase.from('reminders').delete().eq('id', id);
        if (error) {
            console.error('deleteReminder error:', error);
            toast.error('Failed to delete reminder.');
            return;
        }
        setReminders(prev => prev.filter(r => r.id !== id));
        toast.success('Reminder deleted');
    }, []);

    const toggleReminderActive = useCallback(async (id: string) => {
        const current = reminders.find(r => r.id === id);
        if (!current) return;
        const { data, error } = await supabase.from('reminders').update({ is_active: !current.isActive }).eq('id', id).select().single();
        if (error) {
            console.error('toggleReminder error:', error);
            toast.error('Failed to toggle reminder.');
            return;
        }
        if (data) setReminders(prev => prev.map(r => r.id === id ? mapReminderToCamel(data) : r));
    }, [reminders]);

    // ── Memoize context value to prevent unnecessary re-renders ───────────────
    const value = useMemo<AppDataContextType>(() => ({
        mainTasks,
        subtasks,
        users,
        comments,
        projects,
        reminders,
        workspaces: [{ id: 'dcel-team', name: 'DCEL Team Workspace' }],
        addReminder,
        updateReminder,
        deleteReminder,
        toggleReminderActive,
        createProject: async (projectData: any) => {
            const taskPayload = {
                title: projectData.name,
                description: `Project for ${projectData.serviceType}`,
                createdBy: projectData.createdBy,
                teamId: projectData.teamId,
                workspaceId: projectData.workspaceId,
            };
            const { data: mainTask, error } = await supabase.from('main_tasks').insert(taskPayload).select().single();
            if (error || !mainTask) {
                toast.error('Failed to create project task.');
                return;
            }
            
            const sitePayload = {
                name: projectData.name,
                client: projectData.serviceType || 'General',
                start_date: projectData.startDate,
                end_date: projectData.startDate, // fallback, duration handled in UI
                status: 'active',
                vat: projectData.durationDays?.toString() || '30' 
            };
            const { data: site, error: siteErr } = await supabase.from('sites').insert(sitePayload).select().single();
            if (siteErr) {
                 toast.error('Project created, but site link failed.');
            } else if (site) {
                 const adaptedProject = {
                     ...site,
                     workspaceId: projectData.workspaceId,
                     templateId: '',
                     serviceType: projectData.serviceType,
                     startDate: projectData.startDate,
                     durationDays: projectData.durationDays,
                     mainTaskId: mainTask.id,
                 };
                 setProjects(prev => [...prev, adaptedProject]);
            }
            
            // Insert passed subtasks if any
            if (projectData.subtasks && projectData.subtasks.length > 0) {
                const subsToInsert = projectData.subtasks.map((st: any) => ({
                    main_task_id: mainTask.id,
                    title: st.title,
                    description: '',
                    status: 'not_started',
                    category: 'General',
                    assigned_department: st.assignee || 'Engineering',
                    created_by: projectData.createdBy,
                }));
                const { data: insertedSubs } = await supabase.from('subtasks').insert(subsToInsert).select();
                if (insertedSubs && insertedSubs.length > 0) {
                    setSubtasks(prev => [...prev, ...insertedSubs]);
                }
            }
            
            setMainTasks(prev => [...prev, mainTask]);
            toast.success('Project created successfully');
        },
        createMainTask,
        updateMainTask,
        deleteMainTask,
        addSubtask,
        updateSubtask,
        deleteSubtask,
        assignSubtask,
        updateSubtaskStatus,
        approveSubtask,
        rejectSubtask,
        postComment,
        getMainTaskComments,
        getSubtaskComments,
        getMainTaskWorkflow,
    }), [mainTasks, subtasks, users, comments, projects, reminders,
        createMainTask, updateMainTask, deleteMainTask,
        addSubtask, updateSubtask, deleteSubtask, assignSubtask,
        updateSubtaskStatus, approveSubtask, rejectSubtask,
        postComment, getMainTaskComments, getSubtaskComments, getMainTaskWorkflow,
        addReminder, updateReminder, deleteReminder, toggleReminderActive]);

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useAppData(): AppDataContextType {
    const ctx = useContext(TaskContext);
    if (!ctx) throw new Error('useAppData must be used within TaskProvider');
    return ctx;
}
