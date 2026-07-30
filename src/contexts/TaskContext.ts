/**
 * Isolated context module — kept in its own file so that HMR reloads of
 * AppDataContext.tsx do NOT invalidate this object and cause the
 * "useAppData outside TaskProvider" warning during development.
 */
import { createContext } from 'react';
import type { AppDataContextType } from './AppDataContext';

export const TaskContext = createContext<AppDataContextType | null>(null);
