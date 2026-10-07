export type SiteRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'fulfilled'
  | 'cancelled';

export type SiteRequestUrgency = 'low' | 'normal' | 'urgent' | 'critical';

export type SiteRequestCategory =
  | 'equipment'
  | 'material'
  | 'fuel'
  | 'personnel'
  | 'vehicle'
  | 'other';

export interface SiteRequest {
  id: string;
  workspaceId: string;
  siteId?: string;
  siteName?: string;
  requestedById?: string;
  requestedByName: string;
  requestedByRole?: string;
  category: SiteRequestCategory;
  item: string;
  quantity?: number;
  unit?: string;
  urgency: SiteRequestUrgency;
  requestDate?: string;
  neededByDate?: string;
  status: SiteRequestStatus;
  rejectionReason?: string;
  fulfilmentNote?: string;
  assignedToId?: string;
  assignedToName?: string;
  linkedWaybillId?: string;
  linkedCheckoutId?: string;
  loggedById?: string;
  loggedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteRequestUpdate {
  id: string;
  requestId: string;
  workspaceId: string;
  authorName: string;
  authorId?: string;
  statusFrom?: SiteRequestStatus;
  statusTo?: SiteRequestStatus;
  note?: string;
  createdAt: string;
}

export interface CreateSiteRequestPayload {
  siteId?: string;
  siteName?: string;
  requestedById?: string;
  requestedByName: string;
  requestedByRole?: string;
  category: SiteRequestCategory;
  item: string;
  quantity?: number;
  unit?: string;
  urgency: SiteRequestUrgency;
  requestDate?: string;
  neededByDate?: string;
}

export const CATEGORY_LABELS: Record<SiteRequestCategory, string> = {
  equipment: 'Equipment',
  material:  'Material',
  fuel:      'Fuel',
  personnel: 'Personnel',
  vehicle:   'Vehicle',
  other:     'Other',
};

export const CATEGORY_ICONS: Record<SiteRequestCategory, string> = {
  equipment: '⚙️',
  material:  '📦',
  fuel:      '⛽',
  personnel: '👷',
  vehicle:   '🚛',
  other:     '📋',
};

export const URGENCY_CONFIG: Record<SiteRequestUrgency, { label: string; dot: string; ring: string; bg: string; text: string; border: string }> = {
  low:      { label: 'Low',      dot: 'bg-slate-400',  ring: 'ring-slate-300 dark:ring-slate-600', bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
  normal:   { label: 'Normal',   dot: 'bg-blue-500',   ring: 'ring-blue-300 dark:ring-blue-700',   bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  urgent:   { label: 'Urgent',   dot: 'bg-amber-500',  ring: 'ring-amber-300 dark:ring-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  critical: { label: 'Critical', dot: 'bg-red-500',    ring: 'ring-red-300 dark:ring-red-700',     bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
};

export const STATUS_CONFIG: Record<SiteRequestStatus, { label: string; bg: string; text: string; border: string }> = {
  pending:     { label: 'Pending',     bg: 'bg-amber-50 dark:bg-amber-950/30',    text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/50' },
  approved:    { label: 'Approved',    bg: 'bg-blue-50 dark:bg-blue-950/30',      text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800/50' },
  rejected:    { label: 'Rejected',    bg: 'bg-red-50 dark:bg-red-950/30',        text: 'text-red-700 dark:text-red-400',       border: 'border-red-200 dark:border-red-800/50' },
  in_progress: { label: 'In Progress', bg: 'bg-orange-50 dark:bg-orange-950/30',  text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50' },
  fulfilled:   { label: 'Fulfilled',   bg: 'bg-emerald-50 dark:bg-emerald-950/30',text: 'text-emerald-700 dark:text-emerald-400',border: 'border-emerald-200 dark:border-emerald-800/50' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-500 dark:text-slate-400',   border: 'border-slate-200 dark:border-slate-700' },
};

export const UNIT_OPTIONS = ['units', 'bags', 'litres', 'kg', 'tonnes', 'rolls', 'sheets', 'pcs', 'sets'];
