import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore, type UserPrivileges, type AppUser } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { format } from 'date-fns';
import type { AgentOperationalContext } from '@/src/types/agent';

export function useAgentContext() {
  const location = useLocation();
  const currentUserId = useUserStore((s) => s.currentUserId);
  const users = useUserStore((s) => s.users);
  const sites = useAppStore((s) => s.sites) || [];
  const employees = useAppStore((s) => s.employees);
  const ledgerCategories = useAppStore((s) => s.ledgerCategories);
  const ledgerBanks = useAppStore((s) => s.ledgerBanks);
  const ledgerVendors = useAppStore((s) => s.ledgerVendors);
  const ledgerEntries = useAppStore((s) => s.ledgerEntries);
  const { assets } = useOperations();

  // Purely derive currentUser from state
  const currentUser: AppUser | null = useMemo(() => {
    if (!users || users.length === 0) return null;
    return users.find((u) => u.id === currentUserId) || users[0] || null;
  }, [users, currentUserId]);

  // Parse location search parameters (e.g. ?client=APD%20PROJECT%20MANAGEMENT%20LIMITED or ?site=...)
  const searchParams = useMemo(() => new URLSearchParams(location?.search || ''), [location?.search]);
  const urlClientParam = searchParams.get('client');
  const urlSiteParam = searchParams.get('site') || searchParams.get('siteId');

  // Extract siteId from path (e.g. /sites/360/:id or /sites/diary/:id)
  const pathSiteId = useMemo(() => {
    const p = location?.pathname || '';
    const match = p.match(/\/sites\/(?:360|diary|summary|inventory)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  }, [location?.pathname]);

  // Active Client currently focused on page (e.g. on Client 360 Dashboard)
  const activeClient = useMemo(() => {
    if (urlClientParam && urlClientParam !== 'ALL' && urlClientParam !== 'All Clients') {
      const clientSites = sites.filter((s) => s.client?.trim().toLowerCase() === urlClientParam.trim().toLowerCase());
      return {
        name: urlClientParam,
        sites: clientSites.map((s) => ({ id: s.id, name: s.name, status: s.status || 'Active' })),
      };
    }
    return undefined;
  }, [urlClientParam, sites]);

  // Active working site ID (manual override)
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Active working site derived accurately from on-screen context
  const activeSite = useMemo(() => {
    if (!sites || sites.length === 0) return undefined;

    // 1. Manual user override in drawer
    if (selectedSiteId) {
      const found = sites.find((s) => s.id === selectedSiteId);
      if (found) return { id: found.id, name: found.name, clientName: found.client };
    }

    // 2. Direct path-based site context (e.g. /sites/360/:siteId or /sites/diary/:siteId)
    if (pathSiteId) {
      const found = sites.find((s) => s.id === pathSiteId);
      if (found) return { id: found.id, name: found.name, clientName: found.client };
    }

    // 3. Query param site context (e.g. ?site=... or ?siteId=...)
    if (urlSiteParam) {
      const found = sites.find((s) => s.id === urlSiteParam || s.name.toLowerCase() === urlSiteParam.toLowerCase());
      if (found) return { id: found.id, name: found.name, clientName: found.client };
    }

    // 4. On-screen Client 360 context (e.g. ?client=APD PROJECT MANAGEMENT LIMITED)
    if (activeClient && activeClient.sites.length > 0) {
      const primarySiteId = activeClient.sites[0].id;
      const found = sites.find((s) => s.id === primarySiteId);
      if (found) {
        return {
          id: found.id,
          name: found.name,
          clientName: found.client || activeClient.name,
        };
      }
    }

    // 5. If viewing global non-site pages, do NOT inject arbitrary first site
    const p = location?.pathname || '';
    if (
      p.includes('/billing') ||
      p.includes('/ledger') ||
      p.includes('/employees') ||
      p.includes('/settings') ||
      p.includes('/users') ||
      p.includes('/variables')
    ) {
      return undefined;
    }

    // 6. Default fallback for general site management screens
    return {
      id: sites[0].id,
      name: sites[0].name,
      clientName: sites[0].client,
    };
  }, [sites, selectedSiteId, pathSiteId, urlSiteParam, activeClient, location?.pathname]);

  // Route-aware contextual detection
  const currentRoute = useMemo(() => {
    const p = location?.pathname || '';

    if (p.includes('/clients') || p.includes('/client-360')) {
      const clientName = activeClient?.name || (urlClientParam && urlClientParam !== 'ALL' ? urlClientParam : 'All Clients');
      return {
        path: p,
        moduleName: 'Client 360 & Relationship Intelligence',
        activeEntity: `Active Client: "${clientName}"${activeSite ? ` | Active Site: "${activeSite.name}"` : ''}`,
        hint: `User is viewing Client 360 for "${clientName}". The active site for this client is "${activeSite?.name || 'All Sites'}". All questions about "this client" or "this site" must refer strictly to ${clientName}.`,
      };
    }

    if (p.includes('/sites/360') || p.includes('/sites/diary') || p.includes('/sites/summary')) {
      return {
        path: p,
        moduleName: 'Site 360 & Operations',
        activeEntity: activeSite ? `Active Site: "${activeSite.name}" (Client: ${activeSite.clientName || 'General'})` : undefined,
        hint: `User is viewing Site 360 for "${activeSite?.name || 'Site'}". Focus on site progress, dewatering, diesel logs, machine inventory, and diary entries for this project.`,
      };
    }

    if (p.includes('/billing') || p.includes('/client-accounts') || p.includes('/invoices') || p.includes('/vat')) {
      return {
        path: p,
        moduleName: 'Invoicing & Client Accounts',
        hint: 'User is viewing Billing & Invoices. Prioritize drafting invoices, billing summaries, and client balances.',
      };
    }

    if (p.includes('/ledger') || p.includes('/company-expenses') || p.includes('/bank-import') || p.includes('/financial-reports')) {
      return {
        path: p,
        moduleName: 'Financial Ledger & Expenses',
        hint: 'User is viewing the Financial Ledger. Prioritize drafting voucher expenses, income entries, and bank records conforming to ledger rules.',
      };
    }

    if (p.includes('/employees') || p.includes('/onboarding') || p.includes('/leaves') || p.includes('/salary-loans')) {
      return {
        path: p,
        moduleName: 'HR & Employee Management',
        hint: 'User is viewing HR & Staff. Prioritize onboarding new employees, leave approvals, and employee analytics.',
      };
    }

    if (p.includes('/attendance')) {
      return {
        path: p,
        moduleName: 'Workforce Attendance',
        hint: 'User is viewing Attendance. Prioritize logging attendance records and daily headcounts.',
      };
    }

    if (p.includes('/tasks')) {
      return {
        path: p,
        moduleName: 'Tasks & Project Planning',
        hint: 'User is viewing Tasks. Prioritize creating, scheduling, and assigning operational tasks.',
      };
    }

    if (p.includes('/operations')) {
      return {
        path: p,
        moduleName: 'Operations, Fleet & Machinery',
        hint: 'User is viewing Operations & Assets. Prioritize equipment checkouts, fuel logs, machine downtime, and waybills.',
      };
    }

    return {
      path: p,
      moduleName: 'General Operations',
      hint: 'User is navigating the application. Support full cross-module workflows.',
    };
  }, [location?.pathname, activeClient, activeSite, urlClientParam]);

  const availableSites = useMemo(() => {
    return (sites || []).map((s) => ({
      id: s.id,
      name: s.name,
      clientName: s.client,
    }));
  }, [sites]);

  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    (sites || []).forEach((s) => {
      if (s.client) set.add(s.client);
    });
    return Array.from(set).map((c, i) => ({ id: `client-${i}`, name: c }));
  }, [sites]);

  // Determine permitted tools dynamically based on user privileges
  const permittedTools = useMemo(() => {
    const tools: string[] = [];
    const privs = (currentUser?.privileges || {}) as Partial<UserPrivileges>;

    // Site Diary / Daily log permission
    if (currentUser?.role === 'superadmin' || privs.sites?.canView || privs.operations?.canView) {
      tools.push('propose_site_diary');
    }

    // Attendance permission
    if (currentUser?.role === 'superadmin' || privs.attendance?.canAdd || privs.attendance?.canView) {
      tools.push('propose_attendance_summary');
    }

    // Safety & Conduct Incident permission
    if (currentUser?.role === 'superadmin' || privs.disciplinary?.canAdd || privs.disciplinary?.canView) {
      tools.push('propose_incident_log');
    }

    // Fuel & Machine logging permission
    if (currentUser?.role === 'superadmin' || privs.opsMaintenance?.canAdd || privs.operations?.canView) {
      tools.push('propose_diesel_refill');
    }

    // Material & Consumable Burn permission
    if (currentUser?.role === 'superadmin' || privs.opsInventory?.canEdit || privs.operations?.canView) {
      tools.push('propose_consumable_burn');
    }

    // Equipment Maintenance Ticket permission
    if (currentUser?.role === 'superadmin' || privs.opsMaintenance?.canAdd || privs.operations?.canView) {
      tools.push('propose_maintenance_ticket');
    }

    // Site Task Assignment permission
    if (currentUser?.role === 'superadmin' || privs.tasks?.canCreateTasks || privs.tasks?.canView) {
      tools.push('propose_site_task');
    }

    // Invoices & Billing permission
    if (currentUser?.role === 'superadmin' || privs.billing?.canCreate || privs.billing?.canView || privs.sites?.canView) {
      tools.push('propose_create_invoice');
    }

    // Ledger & Expenses permission
    if (currentUser?.role === 'superadmin' || privs.ledger?.canAdd || privs.ledger?.canView) {
      tools.push('propose_ledger_entry');
    }

    // Employee & HR Onboarding permission
    if (currentUser?.role === 'superadmin' || privs.employees?.canAdd || privs.onboarding?.canAdd) {
      tools.push('propose_new_employee');
    }

    return tools;
  }, [currentUser]);

  const context: AgentOperationalContext = useMemo(() => {
    return {
      user: {
        id: currentUser?.id,
        name: currentUser?.name || 'Team Member',
        role: currentUser?.role || 'Staff',
        privileges: currentUser?.privileges,
      },
      currentRoute,
      activeSite,
      activeClient,
      availableSites,
      todayDate: format(new Date(), 'yyyy-MM-dd'),
      permittedTools,
    };
  }, [currentUser, currentRoute, activeSite, activeClient, availableSites, permittedTools]);

  return {
    context,
    currentRoute,
    activeClient,
    selectedSiteId: activeSite?.id || '',
    setSelectedSiteId,
    sites: availableSites,
    clients: uniqueClients,
    employees: (employees || []).map((e) => ({
      id: e.id,
      name: `${e.firstname || ''} ${e.surname || ''}`.trim(),
      department: e.department,
    })),
    assets: (assets || []).map((a) => ({ id: a.id, name: a.name, category: a.category, type: a.type })),
    ledgerCategories,
    ledgerBanks,
    ledgerVendors,
    ledgerEntries,
  };
}
