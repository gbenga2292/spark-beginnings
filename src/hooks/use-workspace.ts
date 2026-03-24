import { useAppData } from '../contexts/AppDataContext';

export function useWorkspace() {
    const { mainTasks, subtasks, users, workspaces } = useAppData();

    return {
        workspace: workspaces?.[0] || { id: 'dcel-team', name: 'DCEL Team Workspace' },
        isPersonal: false,
        isTeam: true,
        isOwner: true, // or check role
        wsMembers: users || [],
        wsTasks: mainTasks || [],
        canInvite: false,

        canManageMembers: false,
        canSeeAllTasks: true,
        hasApprovalFlow: true,
    };
}
