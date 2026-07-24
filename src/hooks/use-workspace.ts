import { useAppData } from '@/src/contexts/AppDataContext';

export function useWorkspace() {
    const { mainTasks, subtasks, users, workspaces } = useAppData();

    const activeMembers = (users || []).filter(u =>
        u.isActive !== false &&
        u.status !== 'inactive' &&
        u.status !== 'delisted' &&
        u.status !== 'terminated' &&
        u.status !== 'resigned' &&
        !(u as any).is_inactive &&
        !(u as any).is_deleted
    );

    return {
        workspace: workspaces?.[0] || { id: 'dcel-team', name: 'DCEL Team Workspace' },
        isPersonal: false,
        isTeam: true,
        isOwner: true, // or check role
        wsMembers: activeMembers,
        wsTasks: mainTasks || [],
        canInvite: false,

        canManageMembers: false,
        canSeeAllTasks: true,
        hasApprovalFlow: true,
    };
}
