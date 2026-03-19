import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useAuth } from '@/src/hooks/useAuth';

export const TaskContext = createContext<any>(null);

export function deriveMainTaskStatus(mainTaskId: string, subtasks: any[]): 'not_started'|'in_progress'|'completed' {
    const subs = subtasks.filter(s => s.main_task_id === mainTaskId || s.mainTaskId === mainTaskId);
    if (!subs.length) return 'not_started';
    if (subs.every(s => s.status === 'completed')) return 'completed';
    if (subs.some(s => s.status === 'in_progress' || s.status === 'completed')) return 'in_progress';
    return 'not_started';
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

    useEffect(() => {
        if (!user) return;

        // ── Initial fetch ─────────────────────────────────────────────────────
        const fetchAll = async () => {
            const [mtRes, stRes, pRes, projRes, commRes] = await Promise.all([
                supabase.from('main_tasks').select('*').eq('is_deleted', false),
                supabase.from('subtasks').select('*'),
                supabase.from('profiles').select('*'),
                supabase.from('sites').select('*'),
                supabase.from('task_updates').select('*').order('created_at', { ascending: true }),
            ]);
            if (mtRes.data) setMainTasks(mtRes.data);
            if (stRes.data) setSubtasks(stRes.data);
            if (pRes.data) setUsers(pRes.data);
            if (projRes.data) setProjects(projRes.data);
            if (commRes.data) setComments(commRes.data);
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const value = {
        mainTasks,
        subtasks,
        users,
        comments,
        projects,
        reminders: [],
        workspaces: [{ id: 'dcel-team', name: 'DCEL Team Workspace' }], // Temporary mock
        addReminder: async () => {},
        updateReminder: async () => {},
        deleteReminder: async () => {},
        toggleReminderActive: async () => {},
        createProject: async () => {},
        createMainTask: async (task: any, subs: any[]) => {
            // Use camelCase columns to match the actual DB schema
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
            if (error) { console.error('createMainTask error:', error); return null; }
            if (data) {
                setMainTasks(prev => [...prev, data]);
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
                    if (subErr) console.error('createMainTask subtasks error:', subErr);
                    if (insertedSubs) {
                        setSubtasks(prev => [...prev, ...insertedSubs]);
                    }
                }
            }
            return data;
        },
        updateMainTask: async (id: string, p: any) => {
            const payload: any = { ...p };
            // Map camelCase props to correct DB columns
            if (p.assignedTo !== undefined) payload.assignedTo = p.assignedTo;
            if (p.teamId !== undefined) payload.teamId = p.teamId;
            if (p.workspaceId !== undefined) payload.workspaceId = p.workspaceId;
            if (p.createdBy !== undefined) payload.createdBy = p.createdBy;
            const { data } = await supabase.from('main_tasks').update(payload).eq('id', id).select().single();
            if (data) setMainTasks(prev => prev.map(t => t.id === id ? data : t));
        },
        deleteMainTask: async (id: string) => {
            await supabase.from('main_tasks').update({ is_deleted: true }).eq('id', id);
            setMainTasks(prev => prev.filter(t => t.id !== id));
        },
        addSubtask: async (sub: any) => {
             const payload = {
                 title: sub.title,
                 description: sub.description || null,
                 assignedTo: sub.assignedTo || null,
                 status: sub.status || 'not_started',
                 deadline: sub.deadline || null,
                 priority: sub.priority || null,
                 mainTaskId: sub.mainTaskId,
             };
             const { data } = await supabase.from('subtasks').insert(payload).select().single();
             if (data) setSubtasks(prev => [...prev, data]);
        },
        updateSubtask: async (id: string, p: any) => {
            const payload: any = { ...p };
            if (p.assignedTo !== undefined) { payload.assignedTo = p.assignedTo; }
            if (p.mainTaskId !== undefined) { payload.mainTaskId = p.mainTaskId; }
            const { data } = await supabase.from('subtasks').update(payload).eq('id', id).select().single();
            if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        },
        deleteSubtask: async (id: string) => {
            await supabase.from('subtasks').delete().eq('id', id);
            setSubtasks(prev => prev.filter(s => s.id !== id));
        },
        assignSubtask: async (id: string, userId: string) => {
            const { data } = await supabase.from('subtasks').update({ assignedTo: userId }).eq('id', id).select().single();
            if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        },
        updateSubtaskStatus: async (id: string, status: string) => {
            const { data } = await supabase.from('subtasks').update({ status }).eq('id', id).select().single();
            if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        },
        approveSubtask: async (id: string, note?: string) => {
            const { data } = await supabase.from('subtasks').update({ status: 'completed', approvedBy: user?.id, approval_note: note }).eq('id', id).select().single();
            if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        },
        rejectSubtask: async (id: string, note?: string) => {
            const { data } = await supabase.from('subtasks').update({ status: 'in_progress', rejectedAt: new Date().toISOString(), approval_note: note }).eq('id', id).select().single();
            if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        },
        postComment: async (subId: string, mainId: string, authorId: string, text: string) => {
            const { data } = await supabase.from('task_updates').insert({ task_id: mainId, subtask_id: subId, text, author_id: authorId }).select().single();
            if (data) setComments(prev => [...prev, data]);
        },
        getMainTaskComments: (id: string) => comments.filter(c => c.task_id === id || c.main_task_id === id),
        getSubtaskComments: (subtaskId: string) => comments.filter(c => c.subtask_id === subtaskId || c.subtaskId === subtaskId),
        getMainTaskWorkflow: (_mainTaskId: string) => [],
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useAppData() {
    return useContext(TaskContext);
}
