import { Task, TaskStats } from '@/src/types/tasks/task';

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Finalize Q1 budget proposal',
    description: 'Complete the quarterly budget review and submit for approval by the finance committee.',
    assignee: 'Sarah Chen',
    department: 'Finance',
    dueDate: '2026-02-28',
    priority: 'high',
    status: 'in_progress',
    createdAt: '2026-02-20',
    updates: [
      { id: 'u1', text: 'Draft submitted to department head for review.', author: 'Sarah Chen', timestamp: '2026-02-24T10:30:00Z' },
    ],
  },
  {
    id: '2',
    title: 'Onboarding docs for new hires',
    description: 'Update the employee handbook and create onboarding checklists for March cohort.',
    assignee: 'James Wilson',
    department: 'HR',
    dueDate: '2026-03-01',
    priority: 'medium',
    status: 'pending',
    createdAt: '2026-02-22',
    updates: [],
  },
  {
    id: '3',
    title: 'Deploy authentication module',
    description: 'Ship the new SSO integration with Azure AD for internal tooling.',
    assignee: 'Priya Patel',
    department: 'Engineering',
    dueDate: '2026-02-25',
    priority: 'high',
    status: 'overdue',
    createdAt: '2026-02-15',
    updates: [
      { id: 'u2', text: 'Blocked on Azure AD tenant config — escalated to IT.', author: 'Priya Patel', timestamp: '2026-02-23T14:00:00Z' },
    ],
  },
  {
    id: '4',
    title: 'Client presentation deck',
    description: 'Prepare the pitch deck for Acme Corp partnership meeting.',
    assignee: 'Alex Morgan',
    department: 'Sales',
    dueDate: '2026-03-05',
    priority: 'medium',
    status: 'in_progress',
    createdAt: '2026-02-24',
    updates: [
      { id: 'u3', text: 'First draft ready, needs design polish.', author: 'Alex Morgan', timestamp: '2026-02-25T09:00:00Z' },
    ],
  },
  {
    id: '5',
    title: 'Update privacy policy',
    description: 'Review and update privacy policy to comply with latest GDPR amendments.',
    assignee: 'Maria Garcia',
    department: 'Legal',
    dueDate: '2026-03-10',
    priority: 'low',
    status: 'pending',
    createdAt: '2026-02-23',
    updates: [],
  },
  {
    id: '6',
    title: 'Server migration to new cluster',
    description: 'Migrate production workloads to the upgraded Kubernetes cluster.',
    assignee: 'David Kim',
    department: 'Engineering',
    dueDate: '2026-02-27',
    priority: 'high',
    status: 'in_progress',
    createdAt: '2026-02-18',
    updates: [
      { id: 'u4', text: 'Staging migration complete. Production scheduled for tonight.', author: 'David Kim', timestamp: '2026-02-26T16:00:00Z' },
    ],
  },
  {
    id: '7',
    title: 'Quarterly all-hands agenda',
    description: 'Draft and finalize the agenda for Q1 company all-hands meeting.',
    assignee: 'Lisa Thompson',
    department: 'Operations',
    dueDate: '2026-03-03',
    priority: 'low',
    status: 'completed',
    createdAt: '2026-02-19',
    updates: [
      { id: 'u5', text: 'Agenda finalized and shared with leadership team.', author: 'Lisa Thompson', timestamp: '2026-02-25T11:00:00Z' },
    ],
  },
  {
    id: '8',
    title: 'Social media campaign launch',
    description: 'Launch the spring product campaign across all social channels.',
    assignee: 'Ryan Brooks',
    department: 'Marketing',
    dueDate: '2026-03-02',
    priority: 'medium',
    status: 'pending',
    createdAt: '2026-02-25',
    updates: [],
  },
];

export const departments = ['All', 'Engineering', 'Finance', 'HR', 'Sales', 'Legal', 'Operations', 'Marketing'];

export function getTaskStats(tasks: Task[]): TaskStats {
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  };
}
