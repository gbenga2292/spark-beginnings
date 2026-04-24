import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore, UserPrivileges } from '../../store/userStore';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: keyof UserPrivileges | (keyof UserPrivileges)[];
}

export function ProtectedRoute({ children, requiredModule }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { getCurrentUser } = useUserStore();
  const appUser = getCurrentUser();

  if (loading) {
     return <div className="p-4 text-slate-500">Loading...</div>;
  }

  // Fallback to login if no auth session
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check privileges if a specific module is required
  if (requiredModule && appUser) {
    const privs = appUser.privileges as any;
    const modules = Array.isArray(requiredModule) ? requiredModule : [requiredModule];
    
    // Check if user has access to ANY of the required modules
    const hasAccess = modules.some(m => privs?.[m]?.canView);

    if (!hasAccess) {
      console.warn(`Access denied to modules: ${modules.join(', ')}`);
      if (modules.includes('dashboard')) {
         return <div className="p-10 text-center text-red-500 font-bold">Access Denied: You do not have permission to view the dashboard. Please contact an administrator.</div>;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
