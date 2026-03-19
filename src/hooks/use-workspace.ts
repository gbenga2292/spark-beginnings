import { useAppData } from '../contexts/AppDataContext';

export function useWorkspace() {
    const { mainTasks, subtasks, users } = useAppData();

    return {
        workspace: null,
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
