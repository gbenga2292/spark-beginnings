import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useAuth } from '@/src/hooks/useAuth';
import { toast } from '@/src/components/ui/toast';
import logoSrc from '../../logo/logo-2.png';
import type { MainTask, SubTask, TaskComment, AppUser, CommentAttachment } from '@/src/types/tasks';
import { useAppStore } from '@/src/store/appStore';

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
    snoozeReminder: (id: string, untilDate: string) => Promise<void>;
    createProject: (...args: any[]) => Promise<void>;
    createMainTask: (task: any, subs?: any[]) => Promise<any>;
    updateMainTask: (id: string, p: any) => Promise<void>;
    deleteMainTask: (id: string) => Promise<void>;
    addSubtask: (sub: any) => Promise<void>;
    updateSubtask: (id: string, p: any) => Promise<void>;
    deleteSubtask: (id: string) => Promise<void>;
    restoreMainTask: (id: string) => Promise<void>;
    restoreSubtask: (id: string) => Promise<void>;
    deleteMainTaskPermanently: (id: string) => Promise<void>;
    deleteSubtaskPermanently: (id: string) => Promise<void>;
    assignSubtask: (id: string, userId: string) => Promise<void>;
    updateSubtaskStatus: (id: string, status: string, userId?: string, bypassApproval?: boolean) => Promise<void>;
    approveSubtask: (id: string, userId?: string, note?: string) => Promise<void>;
    rejectSubtask: (id: string, userId?: string, note?: string) => Promise<void>;
    postComment: (subId: string, mainId: string, authorId: string, text: string, attachments?: CommentAttachment[], fileLinks?: string[]) => Promise<void>;
    updateComment: (id: string, text: string) => Promise<void>;
    deleteComment: (id: string) => Promise<void>;
    getMainTaskComments: (id: string) => any[];
    getSubtaskComments: (subtaskId: string) => any[];
    getMainTaskWorkflow: (mainTaskId: string) => any[];
    fetchArchivedSubtasks: (workspaceId: string, retentionDays: number) => Promise<any[]>;
    fetchArchivedMainTasks: (workspaceId: string, retentionDays: number) => Promise<any[]>;
}

export const TaskContext = createContext<AppDataContextType | null>(null);

function showNativeNotification(title: string, body?: string) {
    // In Electron: delegate to main process so Windows shows the correct
    // app name ("DCEL Office Suite") and icon instead of generic "Electron"
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.notify) {
        electronAPI.notify(title, body ?? '');
        return;
    }
    // Fallback: browser Web Notification API
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: logoSrc });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body, icon: logoSrc });
            }
        });
    }
}

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
        snoozedUntil: r.snoozed_until,
        sourceRef: r.source_ref,
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
        
        let isActive = true;
        let fetchTimeout: ReturnType<typeof setTimeout>;

        // ── Initial fetch ─────────────────────────────────────────────────────
        const fetchAll = async () => {
            try {
                const [mtRes, stRes, pRes, projRes, commRes, remRes] = await Promise.all([
                    supabase.from('main_tasks').select('*').eq('is_deleted', false),
                    supabase.from('subtasks').select('*').eq('is_deleted', false),
                    supabase.from('profiles').select('*'),
                    supabase.from('sites').select('*'),
                    supabase.from('task_updates').select('*').order('created_at', { ascending: true }),
                    supabase.from('reminders').select('*'),
                ]);
                
                if (!isActive) return;

                if (mtRes.error && !mtRes.error.message?.includes('AbortError')) console.error('Failed to load main_tasks:', mtRes.error);
                if (stRes.error && !stRes.error.message?.includes('AbortError')) console.error('Failed to load subtasks:', stRes.error);
                if (pRes.error && !pRes.error.message?.includes('AbortError')) console.error('Failed to load profiles:', pRes.error);
                if (projRes.error && !projRes.error.message?.includes('AbortError')) console.error('Failed to load sites:', projRes.error);
                if (commRes.error && !commRes.error.message?.includes('AbortError')) console.error('Failed to load task_updates:', commRes.error);
                if (remRes.error && !remRes.error.message?.includes('AbortError')) console.error('Failed to load reminders:', remRes.error);

                if (mtRes.data) setMainTasks(mtRes.data);
                if (stRes.data) setSubtasks(stRes.data);
                if (pRes.data) setUsers(pRes.data);
                let loadedProjects: any[] = [];
                if (mtRes.data) {
                    const genericProjects = mtRes.data
                        .filter((t: any) => t.is_project)
                        .map((t: any) => ({
                             id: `mt-proj-${t.id}`,
                             workspaceId: t.workspaceId || t.teamId || 'dcel-team',
                             templateId: '',
                             name: t.title,
                             serviceType: 'Internal Project',
                             startDate: t.created_at,
                             durationDays: 30, // Fallback
                             mainTaskId: t.id,
                             status: 'Active'
                        }));
                    loadedProjects = [...loadedProjects, ...genericProjects];
                }
                setProjects(loadedProjects);
                if (commRes.data) setComments(commRes.data);
                if (remRes.data) {
                    const mappedRems = remRes.data.map(mapReminderToCamel);
                    setReminders(mappedRems);
                    
                    if (!sessionStorage.getItem('startup_reminders_shown') && user) {
                        sessionStorage.setItem('startup_reminders_shown', 'true');
                        
                        // Check if we have active reminders for the current user
                        // We check if it's created by someone else to avoid self-spam
                        const unread = mappedRems.filter(r => {
                            const isGlobal = !r.recipientIds || r.recipientIds.length === 0;
                            const isRecipient = isGlobal || (r.recipientIds && r.recipientIds.includes(user.id));
                            return isRecipient && r.createdBy !== user.id && r.isActive;
                        });
                        
                        if (unread.length > 0) {
                            if (unread.length === 1) {
                                const actionObj = unread[0].mainTaskId ? {
                                    label: 'View',
                                    onClick: () => { window.location.href = `/tasks?openTask=${unread[0].mainTaskId}`; }
                                } : undefined;
                                
                                const msgTitle = unread[0].title === 'New Task Created' ? `New Task: ${unread[0].body}` : unread[0].title;
                                const msgDesc = unread[0].title !== 'New Task Created' ? unread[0].body : undefined;
                                toast.info(msgDesc ? `${msgTitle} - ${msgDesc}` : msgTitle, actionObj);
                            } else {
                                toast.info(`You have ${unread.length} pending notifications - Check your inbox or reminders for recent updates and mentions.`);
                            }
                        }
                    }
                }
            } catch (err: any) {
                if (!isActive) return;
                if (err?.name === 'AbortError' || err?.message?.includes('AbortError') || err?.message?.includes('Lock')) {
                    console.warn('Ignored AbortError in fetchAll (likely Strict Mode overlap).');
                    return;
                }
                console.error('Task data fetch failed:', err);
                toast.error('Failed to load task data. Please refresh.');
            }
        };

        const pruneExpiredArchive = async () => {
            const state = useAppStore.getState();
            const retentionDays = state.hrVariables?.taskArchiveRetentionDays || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const isoCutoff = cutoffDate.toISOString();

            try {
                await supabase
                    .from('subtasks')
                    .delete()
                    .eq('is_deleted', true)
                    .lt('deleted_at', isoCutoff);

                await supabase
                    .from('main_tasks')
                    .delete()
                    .eq('is_deleted', true)
                    .lt('deleted_at', isoCutoff);
            } catch (err) {
                console.error('Failed to prune expired archive:', err);
            }
        };

        fetchTimeout = setTimeout(() => {
            if (isActive) {
                fetchAll();
                pruneExpiredArchive();
            }
        }, 150);

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
                if (payload.new.is_deleted) {
                    setSubtasks(prev => prev.filter(s => s.id !== payload.new.id));
                } else {
                    setSubtasks(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
                }
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
                    
                    const isGlobal = !camel.recipientIds || camel.recipientIds.length === 0;
                    const isRecipient = isGlobal || (camel.recipientIds && camel.recipientIds.includes(user?.id));
                    const isCreator = camel.createdBy === user?.id;

                    if (isRecipient && !isCreator) {
                        // Notifications are now handled exclusively by the TaskPopupNotifications module
                    }
                    
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
            isActive = false;
            clearTimeout(fetchTimeout);
            supabase.removeChannel(channel);
        };
    }, [user]);

    // ── Memoized action callbacks ─────────────────────────────────────────────
    const createMainTask = useCallback(async (task: any, subs: any[] = []) => {
        // --- ROGUE TASK INTERCEPTOR ---

        const payload = {
            title: task.title,
            description: task.description || null,
            createdBy: task.createdBy || user?.id,
            teamId: task.teamId || '',
            workspaceId: task.workspaceId || task.teamId || '',
            assignedTo: task.assignedTo || null,
            deadline: task.deadline || null,
            priority: task.priority || null,
            is_project: task.is_project || false,
            requires_approval: task.requiresApproval || false,
            is_hr_task: task.is_hr_task || false,
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
            let targetSubs = subs;
            
            // Auto-generate a default subtask if none were provided and it's a standard task (not purely a project wrapper)
            if (targetSubs.length === 0 && !payload.is_project && !task.skipAutoSubtask) {
                targetSubs = [{
                    title: payload.title,
                    description: payload.description,
                    assignedTo: payload.assignedTo,
                    status: 'not_started',
                    deadline: payload.deadline,
                    priority: payload.priority,
                    requiresApproval: task.requiresApproval || false,
                }];
            }

            if (targetSubs.length > 0) {
                const subTasksPayload = targetSubs.map(s => ({
                    title: s.title,
                    description: s.description || null,
                    assignedTo: s.assignedTo || null,
                    status: s.status || 'not_started',
                    deadline: s.deadline || null,
                    priority: s.priority || null,
                    requires_approval: s.requiresApproval || false,
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

            // NOTE: No automatic reminder record is inserted here.
            // Task-creation popup notifications are handled exclusively by the
            // real-time `task_updates` listener in TaskPopupNotifications.tsx.
        }
        return data;
    }, [user?.id]);

    const updateMainTask = useCallback(async (id: string, p: any) => {
        // Build a clean whitelist payload — only send columns that actually exist
        // in the main_tasks table. Unknown keys cause a 400 from Supabase.
        const payload: Record<string, any> = {};
        if (p.title !== undefined)              payload.title = p.title;
        if (p.description !== undefined)        payload.description = p.description ?? null;
        if (p.deadline !== undefined)           payload.deadline = p.deadline ?? null;
        if (p.priority !== undefined)           payload.priority = p.priority ?? null;
        if (p.assignedTo !== undefined)         payload.assignedTo = p.assignedTo ?? null;
        if (p.teamId !== undefined)             payload.teamId = p.teamId;
        if (p.workspaceId !== undefined)        payload.workspaceId = p.workspaceId;
        if (p.createdBy !== undefined)          payload.createdBy = p.createdBy;
        if (p.is_deleted !== undefined)         payload.is_deleted = p.is_deleted;
        if (p.is_project !== undefined)         payload.is_project = p.is_project;
        if (p.isProject !== undefined)          payload.is_project = p.isProject;
        // camelCase → snake_case conversions
        if (p.requires_approval !== undefined)  payload.requires_approval = p.requires_approval;
        if (p.is_hr_task !== undefined)         payload.is_hr_task = p.is_hr_task;
        if (p.isHrTask !== undefined)           payload.is_hr_task = p.isHrTask;
        const { data, error } = await supabase.from('main_tasks').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('updateMainTask error:', error);
            toast.error('Failed to update task.');
            return;
        }
        if (data) setMainTasks(prev => prev.map(t => t.id === id ? data : t));
    }, []);

    const deleteMainTask = useCallback(async (id: string) => {
        const { error } = await supabase.from('main_tasks').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) {
            console.error('deleteMainTask error:', error);
            toast.error('Failed to delete task.');
            return;
        }
        setMainTasks(prev => prev.filter(t => t.id !== id));
        toast.success('Task moved to archive');
    }, []);

    const restoreMainTask = useCallback(async (id: string) => {
        const { data, error } = await supabase.from('main_tasks').update({ is_deleted: false, deleted_at: null }).eq('id', id).select().single();
        if (error) {
            console.error('restoreMainTask error:', error);
            toast.error('Failed to restore task.');
            return;
        }
        if (data) setMainTasks(prev => [...prev, data]);
        toast.success('Task restored');
    }, []);

    const deleteMainTaskPermanently = useCallback(async (id: string) => {
        const { error } = await supabase.from('main_tasks').delete().eq('id', id);
        if (error) {
            console.error('deleteMainTaskPermanently error:', error);
            toast.error('Failed to delete task permanently.');
            return;
        }
        toast.success('Task permanently deleted');
    }, []);

    const addSubtask = useCallback(async (sub: any) => {
        const payload = {
            title: sub.title,
            description: sub.description || null,
            assignedTo: sub.assignedTo || null,
            status: sub.status || 'not_started',
            deadline: sub.deadline || null,
            priority: sub.priority || null,
            requires_approval: sub.requiresApproval || false,
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
        if (payload.requiresApproval !== undefined) {
            payload.requires_approval = payload.requiresApproval;
            delete payload.requiresApproval;
        }
        const { data, error } = await supabase.from('subtasks').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('updateSubtask error:', error);
            toast.error('Failed to update subtask.');
            return;
        }
        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
    }, []);

    const deleteSubtask = useCallback(async (id: string) => {
        const existingSub = subtasks.find(s => s.id === id);
        const mainId = existingSub?.mainTaskId || existingSub?.main_task_id;

        const { error } = await supabase.from('subtasks').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) {
            console.error('deleteSubtask error:', error);
            toast.error('Failed to delete subtask.');
            return;
        }
        setSubtasks(prev => prev.filter(s => s.id !== id));
        toast.success('Subtask moved to archive');

        // Auto-delete parent main task if no subtasks remain
        if (mainId) {
             const remainingSubs = subtasks.filter(s => (s.mainTaskId === mainId || s.main_task_id === mainId) && s.id !== id);
             if (remainingSubs.length === 0) {
                 supabase.from('main_tasks').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', mainId).then(() => {
                     setMainTasks(prev => prev.filter(t => t.id !== mainId));
                 });
             }
        }
    }, [subtasks]);

    const restoreSubtask = useCallback(async (id: string) => {
        const { data, error } = await supabase.from('subtasks').update({ is_deleted: false, deleted_at: null }).eq('id', id).select().single();
        if (error) {
            console.error('restoreSubtask error:', error);
            toast.error('Failed to restore subtask.');
            return;
        }
        if (data) {
            setSubtasks(prev => [...prev, data]);
            const mainId = data.mainTaskId || data.main_task_id;
            // Ensure main task is restored too
            if (mainId) {
                supabase.from('main_tasks').update({ is_deleted: false, deleted_at: null }).eq('id', mainId).then(() => {
                    supabase.from('main_tasks').select('*').eq('id', mainId).single().then(({data: mData}) => {
                        if (mData) {
                            setMainTasks(prev => {
                                if (!prev.some(t => t.id === mainId)) return [...prev, mData];
                                return prev;
                            });
                        }
                    });
                });
            }
        }
        toast.success('Subtask restored');
    }, []);

    const deleteSubtaskPermanently = async (id: string) => {
        const { error } = await supabase.from('subtasks').delete().eq('id', id);
        if (error) toast.error("Failed to delete subtask permanently");
        else toast.success("Subtask deleted permanently");
    };

    const fetchArchivedSubtasks = async (workspaceId: string, retentionDays: number) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const { data, error } = await supabase
            .from('subtasks')
            .select('*, main_tasks!inner(workspaceId)')
            .eq('is_deleted', true)
            .gt('deleted_at', cutoffDate.toISOString());

        if (error) {
            console.error("Error fetching archived subtasks:", error);
            return [];
        }
        return data;
    };

    const fetchArchivedMainTasks = async (workspaceId: string, retentionDays: number) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const { data, error } = await supabase
            .from('main_tasks')
            .select('*')
            .eq('is_deleted', true)
            .gt('deleted_at', cutoffDate.toISOString());

        if (error) {
            console.error("Error fetching archived main tasks:", error);
            return [];
        }
        return data;
    };

    const assignSubtask = useCallback(async (id: string, userId: string) => {
        const { data, error } = await supabase.from('subtasks').update({ assignedTo: userId }).eq('id', id).select().single();
        if (error) {
            console.error('assignSubtask error:', error);
            toast.error('Failed to assign subtask.');
            return;
        }
        if (data) {
             setSubtasks(prev => prev.map(s => s.id === id ? data : s));
             supabase.functions.invoke('send-email-reminder', { body: data }).catch(console.error);
        }
    }, []);

    const updateSubtaskStatus = useCallback(async (id: string, status: string, _userId?: string, bypassApproval?: boolean) => {
        const now = new Date().toISOString();
        const existing = subtasks.find(s => s.id === id);
        
        let finalStatus = status;
        const updatePayload: any = {};
        
        // Intercept 'completed' -> 'pending_approval' ONLY if requiresApproval is set AND not bypassed by an approver
        if (status === 'completed' && !bypassApproval && (existing?.requiresApproval || (existing as any)?.requires_approval)) {
            finalStatus = 'pending_approval';
            updatePayload.pending_approval_since = now;
        } else if (status === 'completed') {
            updatePayload.completed_at = now;
        }
        
        updatePayload.status = finalStatus;

        const { data, error } = await supabase.from('subtasks').update(updatePayload).eq('id', id).select().single();
        if (error) {
            console.error('updateSubtaskStatus error:', error);
            toast.error('Failed to update status.');
            return;
        }
        if (data) {
            setSubtasks(prev => prev.map(s => s.id === id ? data : s));

            // Notify the main task creator
            if (finalStatus === 'pending_approval') {
                const mainTaskId = data.main_task_id || data.mainTaskId;
                const mainTask = mainTasks.find(m => m.id === mainTaskId);
                if (mainTask && mainTask.createdBy && mainTask.createdBy !== (user?.id ?? _userId)) {
                    toast.info('Task submitted for review');
                    const actorId = _userId || user?.id;
                    if (actorId) {
                        const { data: cData } = await supabase.from('task_updates').insert({
                            subtask_id: id,
                            main_task_id: mainTaskId,
                            text: `⏳ **Review Requested**\nSubtask **"${data.title}"** needs your approval.`,
                            author_id: actorId,
                        }).select().single();
                        if (cData) setComments(prev => prev.some(c => c.id === cData.id) ? prev : [...prev, cData]);
                    }
                }
            } else if (finalStatus === 'completed') {
                const mainTaskId = data.main_task_id || data.mainTaskId;
                const mainTask = mainTasks.find(m => m.id === mainTaskId);
                if (mainTask && mainTask.createdBy && mainTask.createdBy !== (user?.id ?? _userId)) {
                    // Leave a comment notifying the creator
                    const actorId = _userId || user?.id;
                    if (actorId) {
                        const { data: cData } = await supabase.from('task_updates').insert({
                            subtask_id: id,
                            main_task_id: mainTaskId,
                            text: `✅ Subtask **"${data.title}"** marked as completed.`,
                            author_id: actorId,
                        }).select().single();
                        if (cData) setComments(prev => prev.some(c => c.id === cData.id) ? prev : [...prev, cData]);
                    }
                }
            }
        }
    }, [mainTasks, user]);

    const approveSubtask = useCallback(async (id: string, userId?: string, note?: string) => {
        // Update task itself
        const { data, error } = await supabase.from('subtasks').update({ status: 'completed', approvedBy: userId || user?.id }).eq('id', id).select().single();
        if (error) {
            console.error('approveSubtask error:', error);
            toast.error('Failed to approve task.');
            return;
        }

        // Check if this task is an approval workflow task
        try {
            if (data?.description) {
                const meta = JSON.parse(data.description);
                if (meta.refType && meta.refId) {
                    // Find approver name
                    const actorId = userId || user?.id;
                    const approverUser = users.find(u => u.id === actorId);
                    const approverName = approverUser?.name || '';

                    // Post a comment
                    const mainTask = mainTasks.find(m => m.id === data.mainTaskId || m.id === data.main_task_id);
                    if (mainTask) {
                        const creator = users.find(u => u.id === mainTask.createdBy);
                        const mention = creator?.name ? `@${creator.name.split(' ')[0].toLowerCase()}` : '';
                        const stepLabel = meta.workflowStep === 1 ? 'Line Manager' : meta.workflowStep === 2 ? 'Head of Department' : meta.workflowStep === 3 ? 'Management' : 'HR';
                        const text = `**${stepLabel} Approved** ✅\n${mention} Step ${meta.workflowStep} of 4 approved${approverName ? ` by ${approverName}` : ''}.`;
                        const { data: cData, error: cErr } = await supabase.from('task_updates').insert({
                            subtask_id: id,
                            main_task_id: mainTask.id,
                            text,
                            author_id: actorId
                        }).select().single();
                        if (cData && !cErr) setComments(prev => [...prev, cData]);
                    }

                    if (meta.refType === 'leave') {
                        const now = new Date().toISOString();
                        const step = meta.workflowStep as number;
                        const mainTaskId = data.mainTaskId || data.main_task_id;
                        const deadline = new Date(); deadline.setHours(16, 30, 0, 0);

                        // Authority bypass: check if approver holds a top-level position (CEO / Head-level)
                        const { getPositionIndex } = await import('@/src/lib/hierarchy');
                        const appStore = useAppStore.getState();
                        const approverEmp = appStore.employees.find(e =>
                            approverUser?.name?.toLowerCase().includes(e.firstname.toLowerCase()) ||
                            approverUser?.name?.toLowerCase().includes(e.surname.toLowerCase())
                        );
                        const posIdx = getPositionIndex(approverEmp?.position);
                        const isHighAuthority = posIdx <= 1; // CEO or Head-level

                        if (isHighAuthority) {
                            // High-authority approval — skip all remaining steps, fully approve immediately
                            const sigUpdate: Record<string, any> = { approvalStatus: 'Approved', approvedAt: now, workflowStep: 5 };
                            if (step <= 1) sigUpdate.supervisorSignature = { signed: 'Signed', date: now, name: approverName };
                            if (step <= 2) sigUpdate.hodSignature = { signed: 'Signed', date: now, name: approverName };
                            if (step <= 3) sigUpdate.managementSignature = { signed: 'Signed', date: now, name: approverName };
                            sigUpdate.hrSignature = { signed: 'Signed', date: now, name: approverName };
                            appStore.updateLeave(meta.refId, sigUpdate);
                        } else if (step === 1) {
                            // LM approved → create HoD subtask using pre-resolved IDs from JSON
                            const hodSystemUserId = meta.hodSystemUserId || null;

                            const hodSubDesc = JSON.stringify({
                                refType: 'leave', refId: meta.refId, workflowStep: 2,
                                empName: meta.empName, leaveType: meta.leaveType, duration: meta.duration,
                                hodUserId: meta.hodUserId,
                                hodSystemUserId: meta.hodSystemUserId,
                                mgmtUserId: meta.mgmtUserId,  // carry forward
                            });
                            const { data: hodSub } = await supabase.from('subtasks').insert({
                                title: `[Step 2/4] HoD Approval — ${meta.empName} ${meta.leaveType} Leave`,
                                description: hodSubDesc,
                                assignedTo: hodSystemUserId,
                                status: 'not_started',
                                priority: 'high',
                                mainTaskId,
                                deadline: deadline.toISOString(),
                            }).select().single();
                            if (hodSub) setSubtasks(prev => [...prev, hodSub]);

                            appStore.updateLeave(meta.refId, {
                                approvalStatus: 'Pending',
                                workflowStep: 2,
                                supervisorSignature: { signed: 'Signed', date: now, name: approverName },
                                hodTaskId: hodSub?.id,
                            });

                        } else if (step === 2) {
                            // HoD approved → create Management subtask using pre-resolved mgmtUserId from JSON
                            const mgmtUserId = meta.mgmtUserId || null;

                            const mgmtSubDesc = JSON.stringify({
                                refType: 'leave', refId: meta.refId, workflowStep: 3,
                                empName: meta.empName, leaveType: meta.leaveType, duration: meta.duration,
                                mgmtUserId,  // carry forward
                            });
                            const { data: mgmtSub } = await supabase.from('subtasks').insert({
                                title: `[Step 3/4] Management Approval — ${meta.empName} ${meta.leaveType} Leave`,
                                description: mgmtSubDesc,
                                assignedTo: mgmtUserId,
                                status: 'not_started',
                                priority: 'high',
                                mainTaskId,
                                deadline: deadline.toISOString(),
                            }).select().single();
                            if (mgmtSub) setSubtasks(prev => [...prev, mgmtSub]);

                            appStore.updateLeave(meta.refId, {
                                workflowStep: 3,
                                hodSignature: { signed: 'Signed', date: now, name: approverName },
                                managementTaskId: mgmtSub?.id,
                            });

                        } else if (step === 3) {
                            // Management approved → create HR subtask
                            const hrUser = users.find((u: any) =>
                                (u.department || '').toLowerCase().includes('hr') ||
                                (u.department || '').toLowerCase().includes('human resource')
                            );

                            const hrSubDesc = JSON.stringify({ refType: 'leave', refId: meta.refId, workflowStep: 4, empName: meta.empName, leaveType: meta.leaveType, duration: meta.duration });
                            const { data: hrSub } = await supabase.from('subtasks').insert({
                                title: `[Step 4/4] HR Processing — ${meta.empName} ${meta.leaveType} Leave`,
                                description: hrSubDesc,
                                assignedTo: hrUser?.id || null,
                                status: 'not_started',
                                priority: 'high',
                                mainTaskId,
                                deadline: deadline.toISOString(),
                            }).select().single();
                            if (hrSub) setSubtasks(prev => [...prev, hrSub]);

                            appStore.updateLeave(meta.refId, {
                                workflowStep: 4,
                                managementSignature: { signed: 'Signed', date: now, name: approverName },
                                hrTaskId: hrSub?.id,
                            });

                        } else if (step === 4) {
                            // HR approved → fully approved!
                            appStore.updateLeave(meta.refId, {
                                approvalStatus: 'Approved',
                                approvedAt: now,
                                workflowStep: 5,
                                hrSignature: { signed: 'Signed', date: now, name: approverName },
                            });
                        }
                    } else if (meta.refType === 'vehicle_doc_renewal') {
                        const { vehicleId, docTypeName } = meta;
                        const newExpiryDate = note; // We expect the approver to provide the new date in the note
                        if (vehicleId && docTypeName && newExpiryDate) {
                            // Update the vehicle document in the store
                            useAppStore.getState().updateVehicleDocument(vehicleId, docTypeName, newExpiryDate);
                            
                            // Post a comment about the update
                            const mainTask = mainTasks.find(m => m.id === data.mainTaskId || m.id === data.main_task_id);
                            if (mainTask) {
                                const actorId = userId || user?.id;
                                const text = `✅ **Document Renewed**\nVehicle document **"${docTypeName}"** updated with new expiry date: **${newExpiryDate}**.`;
                                await supabase.from('task_updates').insert({
                                    subtask_id: id,
                                    main_task_id: mainTask.id,
                                    text,
                                    author_id: actorId
                                });
                            }
                        }
                    } else if (meta.refType === 'salary_advance') {
                        const { error: saErr } = await supabase.from('salary_advances').update({ status: 'Approved', approved_at: new Date().toISOString() }).eq('id', meta.refId);
                        if (saErr) console.error('Failed to update salary advance status:', saErr);
                    } else if (meta.refType === 'loan') {
                        const { error: loanErr } = await supabase.from('loans').update({ status: 'Approved', approved_at: new Date().toISOString() }).eq('id', meta.refId);
                        if (loanErr) console.error('Failed to update loan status:', loanErr);
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors (normal task descriptions)
        }

        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        toast.success('Approval processed successfully');
    }, [user?.id, mainTasks, users]);

    const rejectSubtask = useCallback(async (id: string, _userId?: string, note?: string) => {
        // Update task itself
        const { data, error } = await supabase.from('subtasks').update({ status: 'in_progress', rejectedAt: new Date().toISOString() }).eq('id', id).select().single();
        if (error) {
            console.error('rejectSubtask error:', error);
            toast.error('Failed to reject task.');
            return;
        }

        // Check if this task is an approval workflow task
        try {
            if (data?.description) {
                const meta = JSON.parse(data.description);
                if (meta.refType && meta.refId) {
                    const mainTask = mainTasks.find(m => m.id === data.mainTaskId || m.id === data.main_task_id);
                    if (mainTask) {
                        const creator = users.find(u => u.id === mainTask.createdBy);
                        const mention = creator?.name ? `@${creator.name.split(' ')[0].toLowerCase()}` : '';
                        const stepLabel = meta.workflowStep === 1 ? 'Line Manager' : meta.workflowStep === 2 ? 'Head of Department' : meta.workflowStep === 3 ? 'Management' : 'HR';
                        const text = `**${stepLabel} Rejected** ❌\n${mention} Leave request was rejected at Step ${meta.workflowStep}.\n\n${note ? `Reason: "${note}"` : ''}`;
                        const { data: cData, error: cErr } = await supabase.from('task_updates').insert({
                            subtask_id: id,
                            main_task_id: mainTask.id,
                            text,
                            author_id: _userId || user?.id
                        }).select().single();
                        if (cData && !cErr) setComments(prev => [...prev, cData]);
                    }

                    if (meta.refType === 'leave') {
                        // Rejection at any step permanently aborts the workflow
                        useAppStore.getState().updateLeave(meta.refId, {
                            approvalStatus: 'Rejected',
                            workflowStep: -1,
                            rejectionNote: note || `Rejected at step ${meta.workflowStep}`,
                        });
                    } else if (meta.refType === 'salary_advance') {
                        const { error: saErr } = await supabase.from('salary_advances').update({ status: 'Rejected', rejection_note: note }).eq('id', meta.refId);
                        if (saErr) console.error('Failed to update salary advance status:', saErr);
                    } else if (meta.refType === 'loan') {
                        const { error: loanErr } = await supabase.from('loans').update({ status: 'Rejected', rejection_note: note }).eq('id', meta.refId);
                        if (loanErr) console.error('Failed to update loan status:', loanErr);
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }

        if (data) setSubtasks(prev => prev.map(s => s.id === id ? data : s));
        toast.info('Request rejected');
    }, [user?.id, mainTasks, users]);

    const postComment = useCallback(async (subId: string, mainId: string, authorId: string, text: string, _attachments?: any[], _fileLinks?: string[]) => {
        // Upload any file attachments to Supabase Storage and collect their public URLs
        const uploadedAttachments: { name: string; url: string; type: string }[] = [];
        if (_attachments && _attachments.length > 0) {
            for (const att of _attachments) {
                // att.base64 is a data URL like "data:image/png;base64,..."
                const base64Data = att.base64?.split(',')[1];
                if (!base64Data) continue;
                const mimeMatch = att.base64?.match(/data:(.*?);base64/);
                const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                const ext = att.name.split('.').pop() || 'bin';
                const filePath = `${authorId}/${Date.now()}_${att.name}`;

                // Convert base64 to Uint8Array
                const byteChars = atob(base64Data);
                const byteArr = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                const blob = new Blob([byteArr], { type: mime });

                const { error: upErr } = await supabase.storage
                    .from('task-attachments')
                    .upload(filePath, blob, { contentType: mime, upsert: true });
                if (upErr) {
                    console.error('File upload error:', upErr);
                    toast.error(`Failed to upload ${att.name}`);
                    continue;
                }
                const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
                uploadedAttachments.push({ name: att.name, url: urlData.publicUrl, type: mime });
            }
        }

        const payload: any = { subtask_id: subId || null, main_task_id: mainId, text: text || '', author_id: authorId };
        if (uploadedAttachments.length > 0) payload.attachments = uploadedAttachments;
        if (_fileLinks && _fileLinks.length > 0) payload.file_links = _fileLinks;

        const { data, error } = await supabase
            .from('task_updates')
            .insert(payload)
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

    const updateComment = useCallback(async (id: string, text: string) => {
        const { data, error } = await supabase
            .from('task_updates')
            .update({ text })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('updateComment error:', error);
            toast.error('Failed to update comment.');
            return;
        }
        if (data) setComments(prev => prev.map(c => c.id === id ? data : c));
    }, []);

    const deleteComment = useCallback(async (id: string) => {
        const { error } = await supabase
            .from('task_updates')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('deleteComment error:', error);
            toast.error('Failed to delete comment.');
            return;
        }
        setComments(prev => prev.filter(c => c.id !== id));
        toast.info('Comment deleted');
    }, []);

    const getMainTaskComments = useCallback((id: string) => comments.filter(c => c.task_id === id || c.main_task_id === id), [comments]);
    // Since task_updates has no subtask_id column, comments are now keyed by subtask_id stored in-memory (augmented on insert)
    const getSubtaskComments = useCallback((subtaskId: string) => comments.filter(c => c.subtask_id === subtaskId || c.task_id === subtaskId), [comments]);
    const getMainTaskWorkflow = useCallback((mainTaskId: string) => {
        const events: any[] = [];
        const mt = mainTasks.find(m => m.id === mainTaskId);
        if (mt) {
            events.push({
                id: `mt-${mt.id}`,
                type: 'task_created',
                actorId: mt.createdBy,
                targetUserIds: [],
                mainTaskId: mt.id,
                workspaceId: mt.workspaceId,
                label: `Created task "${mt.title}"`,
                createdAt: mt.createdAt || new Date().toISOString(),
            });
            const mtSubs = subtasks.filter(s => s.mainTaskId === mainTaskId || s.main_task_id === mainTaskId);
            mtSubs.forEach(s => {
                if (s.assignedTo) {
                    events.push({
                        id: `assign-${s.id}`,
                        type: 'subtask_assigned',
                        actorId: mt.createdBy, 
                        targetUserIds: [s.assignedTo],
                        mainTaskId: mt.id,
                        workspaceId: mt.workspaceId,
                        subtaskId: s.id,
                        label: `Delegated subtask "${s.title}"`,
                        createdAt: s.createdAt || s.created_at || mt.createdAt || new Date().toISOString(), 
                    });
                }
            });
            const mtComms = comments.filter(c => c.main_task_id === mainTaskId || c.task_id === mainTaskId);
            mtComms.forEach(c => {
                const textStr = typeof c.text === 'string' ? c.text : String(c.text || "");
                const mentions = Array.from(textStr.matchAll(/@(\w+)/g)).map((m: any) => m[1].toLowerCase());
                const targetIds: string[] = [];
                if (mentions.length > 0) {
                    users.forEach(u => {
                        const fname = (u.name || "").split(' ')[0].toLowerCase();
                        if (mentions.includes(fname)) targetIds.push(u.id);
                    });
                }
                events.push({
                    id: `comm-${c.id}`,
                    type: targetIds.length > 0 ? 'user_mentioned' : 'comment_posted', // standard render config matches
                    actorId: c.author_id || c.authorId,
                    targetUserIds: targetIds,
                    mainTaskId: mt.id,
                    subtaskId: c.subtask_id || c.subtaskId,
                    commentId: c.id,
                    label: targetIds.length > 0 ? `Mentioned users for input` : `Posted an update`,
                    createdAt: c.created_at || c.createdAt || new Date().toISOString(),
                    isUrgent: c.is_urgent_request
                });
            });
        }
        return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [mainTasks, subtasks, comments, users]);

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
            subtask_id: rem.subtaskId || null,
        };
        const { data, error } = await supabase.from('reminders').insert(payload).select().single();
        if (error) {
            // 409 = duplicate / conflict — silently ignore to prevent toast spam on @mentions
            if ((error as any).code === '23505' || (error as any).status === 409) return;
            console.error('addReminder error:', error);
            toast.error('Failed to add reminder.');
            return;
        }
        if (data) {
            const camel = mapReminderToCamel(data);
            setReminders(prev => {
                if (prev.some(r => r.id === camel.id)) return prev;
                return [...prev, camel];
            });
            if (data.send_email) {
                supabase.functions.invoke('send-email-reminder', { body: data }).catch(console.error);
            }
        }
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

        // For recurring reminders being paused (deactivated), warn — but still allow
        const { data, error } = await supabase.from('reminders').update({ is_active: !current.isActive }).eq('id', id).select().single();
        if (error) {
            console.error('toggleReminder error:', error);
            toast.error('Failed to toggle reminder.');
            return;
        }
        if (data) setReminders(prev => prev.map(r => r.id === id ? mapReminderToCamel(data) : r));
    }, [reminders]);

    const snoozeReminder = useCallback(async (id: string, untilDate: string) => {
        const { data, error } = await supabase
            .from('reminders')
            .update({ snoozed_until: untilDate })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('snoozeReminder error:', error);
            toast.error('Failed to snooze reminder.');
            return;
        }
        if (data) {
            setReminders(prev => prev.map(r => r.id === id ? mapReminderToCamel(data) : r));
            toast.success('Reminder snoozed ⏳');
        }
    }, []);

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
        snoozeReminder,
        createProject: async (projectData: any) => {
            const taskPayload = {
                title: projectData.name,
                description: projectData.description || `Project for ${projectData.serviceType || 'Internal Project'}`,
                createdBy: projectData.createdBy,
                teamId: projectData.teamId,
                workspaceId: projectData.workspaceId,
                is_project: true,
                is_hr_task: !!projectData.isHrTask,
            };
            const { data: mainTask, error } = await supabase.from('main_tasks').insert(taskPayload).select().single();
            if (error || !mainTask) {
                toast.error('Failed to create project task.');
                return;
            }
            
            const adaptedProject = {
                 id: `mt-proj-${mainTask.id}`,
                 workspaceId: projectData.workspaceId,
                 templateId: '',
                 name: mainTask.title,
                 serviceType: projectData.serviceType || 'Internal Project',
                 startDate: mainTask.created_at,
                 durationDays: projectData.durationDays || 30,
                 status: 'Active',
                 mainTaskId: mainTask.id,
            };
            setProjects(prev => [...prev, adaptedProject]);
            
            // Insert passed subtasks if any
            if (projectData.subtasks && projectData.subtasks.length > 0) {
                const subsToInsert = projectData.subtasks.map((st: any) => ({
                    main_task_id: mainTask.id,
                    title: st.title,
                    description: st.description || JSON.stringify({
                        refType: 'site',
                        narration: `Automated onboarding step: ${st.title}`
                    }),
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
        updateComment,
        deleteComment,
        getMainTaskComments,
        getSubtaskComments,
        getMainTaskWorkflow,
        restoreMainTask,
        restoreSubtask,
        deleteMainTaskPermanently,
        deleteSubtaskPermanently,
        fetchArchivedSubtasks,
        fetchArchivedMainTasks
    }), [mainTasks, subtasks, users, comments, projects, reminders,
        createMainTask, updateMainTask, deleteMainTask,
        addSubtask, updateSubtask, deleteSubtask, assignSubtask,
        updateSubtaskStatus, approveSubtask, rejectSubtask,
        postComment, updateComment, deleteComment, getMainTaskComments, getSubtaskComments, getMainTaskWorkflow,
        addReminder, updateReminder, deleteReminder, toggleReminderActive, snoozeReminder,
        restoreMainTask, restoreSubtask, deleteMainTaskPermanently, deleteSubtaskPermanently, fetchArchivedSubtasks, fetchArchivedMainTasks]);

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useAppData(): AppDataContextType {
    const ctx = useContext(TaskContext);
    if (!ctx) throw new Error('useAppData must be used within TaskProvider');
    return ctx;
}
