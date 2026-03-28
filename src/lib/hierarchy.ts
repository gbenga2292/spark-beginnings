import { Employee } from '@/src/store/appStore';

export const POSITION_HIERARCHY = [
  'CEO',
  'Head of Admin',
  'Head of Operations',
  'Projects Supervisor',
  'Logistics and Warehouse Officer',
  'Admin/Accounts Officer',
  'HR Officer',
  'Foreman',
  'Engineer',
  'Site Supervisor',
  'Assistant Supervisor',
  'Mechanic Technician/Site Worker',
  'Site Worker',
  'Driver',
  'Adhoc Staff',
  'Security',
  'Consultant',
  'Sponsored Student'
];

/**
 * Get the sort index for a given position.
 * Returns a high number if the position is not in the hierarchy, placing it at the end.
 */
export function getPositionIndex(position?: string): number {
  if (!position) return 999;
  const idx = POSITION_HIERARCHY.indexOf(position);
  return idx === -1 ? 999 : idx;
}

/**
 * Sort an array of employees based on their position hierarchy.
 */
export function sortEmployeesByHierarchy<T extends { position?: string }>(employees: T[]): T[] {
  return [...employees].sort((a, b) => getPositionIndex(a.position) - getPositionIndex(b.position));
}

/**
 * Filter and sort employees, explicitly excluding the CEO.
 * Mainly used for performance, evaluation, attendance, leave, and onboarding modules.
 */
export function filterAndSortEmployeesExcludingCEO(employees: Employee[]): Employee[] {
  const filtered = employees.filter(e => e.position !== 'CEO');
  return sortEmployeesByHierarchy(filtered);
}
