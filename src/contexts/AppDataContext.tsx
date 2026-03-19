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
        const fetchAll = async () => {
            const [mtRes, stRes, pRes, projRes, commRes] = await Promise.all([
                supabase.from('main_tasks').select('*').eq('is_deleted', false),
                supabase.from('subtasks').select('*'),
                supabase.from('profiles').select('*'),
                supabase.from('sites').select('*'), // using sites for projects
                supabase.from('task_updates').select('*')
            ]);
            if (mtRes.data) setMainTasks(mtRes.data);
            if (stRes.data) setSubtasks(stRes.data);
            if (pRes.data) setUsers(pRes.data);
            if (projRes.data) setProjects(projRes.data);
            if (commRes.data) setComments(commRes.data);
        };
        fetchAll();
        
        // Supabase real-time setup skipped for brevity but would go here
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
            const { data } = await supabase.from('main_tasks').insert({ ...task, created_by: user?.id }).select().single();
            if (data && subs.length) {
                const subTasksPayload = subs.map(s => ({ ...s, main_task_id: data.id }));
                await supabase.from('subtasks').insert(subTasksPayload);
            }
            return data;
        },
        updateMainTask: async (id: string, p: any) => {
            await supabase.from('main_tasks').update(p).eq('id', id);
            // optimistic sync skipped
        },
        deleteMainTask: async (id: string) => {
            await supabase.from('main_tasks').update({ is_deleted: true }).eq('id', id);
        },
        addSubtask: async (sub: any) => {
             await supabase.from('subtasks').insert(sub);
        },
        updateSubtask: async (id: string, p: any) => {
            await supabase.from('subtasks').update(p).eq('id', id);
        },
        deleteSubtask: async (id: string) => {
            await supabase.from('subtasks').delete().eq('id', id);
        },
        assignSubtask: async (id: string, userId: string) => {
            await supabase.from('subtasks').update({ assigned_to: userId }).eq('id', id);
        },
        updateSubtaskStatus: async (id: string, status: string) => {
            await supabase.from('subtasks').update({ status }).eq('id', id);
        },
        postComment: async (subId: string, mainId: string, authorId: string, text: string) => {
            await supabase.from('task_updates').insert({ task_id: mainId, text, author_id: authorId });
        },
        getMainTaskComments: (id: string) => comments.filter(c => c.task_id === id)
    };

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useAppData() {
    return useContext(TaskContext);
}
