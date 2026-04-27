import { useState, useMemo } from 'react';
import { generateId } from '@/src/lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogFooter } from '@/src/components/ui/dialog';
import { Search, Plus, MapPin, Building2, X, Save, Pencil, Trash2, Download, Upload, CheckCircle2, Circle, Eye, FileText, MoreVertical, Clock, LayoutGrid, List, ArrowUpDown, ChevronUp, ChevronDown, MessageSquare, BookOpen, Calendar, Phone, Mail, Car, MessageCircle, Users, ArrowLeft, Check, Bell, UserCheck } from 'lucide-react';
import { useAppStore, Site } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useUserStore } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { normalizeDate } from '@/src/lib/dateUtils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { cn } from '../lib/utils';
import { ClientSummaryGrid } from './ClientSummaryGrid';
import { ClientContactsPanel } from './ClientContactsPanel';

const EMPTY_FORM = { name: '', client: '', vat: 'No' as 'Yes' | 'No' | 'Add', status: 'Active' as 'Active' | 'Inactive' | 'Ended', startDate: new Date().toISOString().split('T')[0], endDate: '' };

function ClientSummary() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const monthValues = useAppStore(s => s.monthValues);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const employees = useAppStore(s => s.employees);
  const sites = useAppStore(s => s.sites);

  const monthsMap = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const currentMonthKey = monthsMap[selectedMonth - 1];
  const monthData = monthValues[currentMonthKey] || { workDays: 0, overtimeRate: 0.5 };
  const { workDays, overtimeRate } = monthData;

  const results: { name: string; client: string; cost: number; teamSize: number }[] = [];
  let grandTotal = 0;

  if (workDays > 0) {
    const salaryDict: Record<string, number> = {};
    employees.forEach(emp => {
      salaryDict[emp.id] = emp.monthlySalaries[currentMonthKey] || 0;
    });

    const monthRecords = attendanceRecords.filter(r => r.mth === selectedMonth);

    sites.forEach(site => {
      const siteName = site.name.toLowerCase().trim();
      const staffDays: Record<string, number> = {};

      monthRecords.forEach(r => {
        let matched = false;
        let increment = 0;

        if (r.daySite && r.daySite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = 1;
        } else if (r.nightSite && r.nightSite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = 1;
        } else if (r.otSite && r.otSite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = overtimeRate;
        }

        if (matched) {
          staffDays[r.staffId] = (staffDays[r.staffId] || 0) + increment;
        }
      });

      let siteTotalCost = 0;
      Object.keys(staffDays).forEach(staffId => {
        const salary = salaryDict[staffId] || 0;
        const days = staffDays[staffId];
        if (salary > 0) {
          siteTotalCost += (salary / workDays) * days;
        }
      });

      if (siteTotalCost > 0) {
        results.push({
          name: site.name,
          client: site.client,
          cost: siteTotalCost,
          teamSize: Object.keys(staffDays).length
        });
        grandTotal += siteTotalCost;
      }
    });
  }

  results.sort((a, b) => b.cost - a.cost);

  const handleExportSummaryCSV = () => {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results.map((r, i) => ({
      "S/N": i + 1,
      "Client": r.client,
      "Site": r.name,
      "Team Size": r.teamSize,
      "Total Cost (₦)": r.cost.toFixed(2)
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
    XLSX.writeFile(wb, `Client_Summary_${monthNames[selectedMonth - 1]}_${format(new Date(), 'yyyy')}.xlsx`);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="h-9 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium"
          >
            {monthNames.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <div className="text-sm text-slate-500">
            Work Days: <span className="font-semibold text-slate-700">{workDays}</span> |
            Overtime Rate: <span className="font-semibold text-slate-700">{overtimeRate}</span>
          </div>
        </div>
        <Button onClick={handleExportSummaryCSV} variant="outline" size="sm" className="gap-2" disabled={results.length === 0}>
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>S/N</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Site Name</TableHead>
              <TableHead className="text-right">Staff Handled</TableHead>
              <TableHead className="text-right">Total Cost (₦)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="font-medium text-indigo-900">{r.client}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right text-slate-500">{r.teamSize}</TableCell>
                <TableCell className="text-right font-bold text-slate-700">₦{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No costs recorded for this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {results.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50/80 font-bold border-t-2">
                <td colSpan={3} className="px-4 py-3 text-right">GRAND TOTAL:</td>
                <td className="px-4 py-3 text-right text-slate-600">{results.reduce((s, r) => s + r.teamSize, 0)}</td>
                <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          )}
        </Table>
        </div>
      </div>
    </div>
  );
}

const toDisplayDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export function Sites() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'clients' | 'active' | 'pending'>('clients');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedLogsSiteId, setSelectedLogsSiteId] = useState<string | 'all'>('all');
  const [isAddingSite, setIsAddingSite] = useState(searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');
  const [narrativeSite, setNarrativeSite] = useState<{ site: any; q: SiteQuestionnaire | null } | null>(null);
  const [contactsFor, setContactsFor] = useState<string | null>(null);


  const buildNarrative = (site: any, q: SiteQuestionnaire | null): string => {
    const lines: string[] = [];
    const name = site.name || 'this site';
    const client = site.client || 'the client';

    // Opening
    lines.push(`${name} is a dewatering project undertaken by DCEL on behalf of ${client}.`);

    if (q) {
      // Phase 1 — Project Scope
      const p1 = q.phase1;
      if (p1.whatIsBeingBuilt) lines.push(`The project involves ${p1.whatIsBeingBuilt.toLowerCase()}.`);
      if (p1.excavationDepthMeters) lines.push(`Excavation is planned to a depth of ${p1.excavationDepthMeters} metres.`);
      if (p1.siteLength && p1.siteWidth) lines.push(`The site measures approximately ${p1.siteLength}m by ${p1.siteWidth}m.`);
      if (p1.timelineStartDate) lines.push(`Works are scheduled to commence on ${p1.timelineStartDate}.`);
      const dataAvail = [p1.geotechnicalReportAvailable && 'geotechnical report', p1.hydrogeologicalDataAvailable && 'hydrogeological data'].filter(Boolean);
      if (dataAvail.length) lines.push(`Background data available at inquiry: ${dataAvail.join(' and ')}.`);

      // Phase 2 — Site Assessment
      const p2 = q.phase2;
      const visited = p2.siteVisited || p2.walkthroughCompleted;
      if (visited) lines.push(`A site visit and walkthrough were conducted to assess site conditions.`);
      if (p2.knownObstacles) lines.push(`Known site obstacles include: ${p2.knownObstacles}.`);
      if (p2.dischargeLocation) lines.push(`Dewatering discharge will be directed to ${p2.dischargeLocation}.`);
      if (p2.dieselSupplyStrategy) lines.push(`Diesel supply is to be provided by ${p2.dieselSupplyStrategy}.`);

      // Phase 3 — Engineering
      const p3 = q.phase3;
      const methods = (p3.dewateringMethods || []);
      if (methods.length) lines.push(`The approved dewatering method(s) for this site: ${methods.join(', ')}.`);
      if (p3.totalWellpointsRequired) lines.push(`The system requires ${p3.totalWellpointsRequired} wellpoints across ${p3.totalHeadersRequired || '—'} header pipes.`);
      if (p3.totalPumpsRequired) lines.push(`A total of ${p3.totalPumpsRequired} pump(s) will be deployed.`);
      if (p3.expectedDailyDieselUsage) lines.push(`Daily diesel consumption is estimated at ${p3.expectedDailyDieselUsage}.`);

      // Phase 4 — Commercial
      const p4 = q.phase4;
      if (p4.scopeOfWorkSummary) lines.push(`Scope of work: ${p4.scopeOfWorkSummary}`);
      if (p4.scopeExclusionsSummary) lines.push(`Exclusions from scope: ${p4.scopeExclusionsSummary}`);
      if (p4.clientTaxStatus) lines.push(`Client tax classification is ${p4.clientTaxStatus}.`);
      if (p4.proposalAccepted) lines.push(`The client has formally accepted the proposal.`);

      // Phase 5 — Handover
      const p5 = q.phase5;
      const milestones: string[] = [];
      if (p5.safetyPlanIntegrated) milestones.push('site safety plan integrated');
      if (p5.stage1AdvanceReceived) milestones.push('50% advance payment received');
      if (p5.stage2InstallationComplete) milestones.push('installation complete and system started');
      if (p5.stage2FirstInvoiceIssued) milestones.push('first hire invoice issued');
      if (p5.stage3TimelyBilling) milestones.push('regular hire invoicing ongoing');
      if (p5.stage4DemobilizationComplete) milestones.push('demobilisation complete');
      if (p5.stage4FinalInvoiceIssued) milestones.push('final invoice and WHT credit issued');
      if (milestones.length) lines.push(`Project milestones achieved: ${milestones.join(', ')}.`);
      if (p5.actualEndDate) lines.push(`The project concluded on ${p5.actualEndDate}.`);
    } else {
      lines.push(`No detailed onboarding record has been linked to this site yet.`);
    }

    lines.push(`Current site status: ${site.status}. VAT: ${site.vat}.`);
    if (site.startDate) lines.push(`Start date: ${site.startDate}${site.endDate ? `. End date: ${site.endDate}` : ''}.`);
    return lines.join(' ');
  };

  // ── Permission checks ──────────────────────────────────────────
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const sitePriv = currentUser?.privileges?.sites;
  // Super-admin (no currentUser in store) gets full access
  const canAddSite    = !currentUser || (sitePriv?.canView === true && sitePriv?.canAddSite === true);
  const canAddClient  = !currentUser || (sitePriv?.canView === true && sitePriv?.canAddClient === true);
  const canEditSite   = !currentUser || (sitePriv?.canView === true && sitePriv?.canEditSite === true);
  const canDeleteSite = !currentUser || (sitePriv?.canView === true && sitePriv?.canDeleteSite === true);
  const canImport     = !currentUser || (sitePriv?.canView === true && sitePriv?.canImport === true);
  const canExport     = !currentUser || (sitePriv?.canView === true && sitePriv?.canExport === true);
  const hasActions    = canEditSite || canDeleteSite;

  const sites = useAppStore((s) => s.sites);
  const pendingSites = useAppStore((s) => s.pendingSites);
  const clientProfiles = useAppStore((s) => s.clientProfiles);
  const addClientProfile = useAppStore((s) => s.addClientProfile);
  const updateClientProfile = useAppStore((s) => s.updateClientProfile);
  const clientContacts = useAppStore((s) => s.clientContacts);
  const invoices = useAppStore((s) => s.invoices);
  const commLogs = useAppStore((s) => s.commLogs);
  
  const clients = useMemo(() => Array.from(new Set(sites.map(s => s.client))).sort(), [sites]);
  const addSite = useAppStore((s) => s.addSite);
  const addClient = useAppStore((s) => s.addClient);
  const setSites = useAppStore((s) => s.setSites);
  const updateSite = useAppStore((s) => s.updateSite);
  const deleteSite = useAppStore((s) => s.deleteSite);
  const addPendingSite = useAppStore((s) => s.addPendingSite);
  const setPendingSites = useAppStore((s) => s.setPendingSites);
  const updatePendingSite = useAppStore((s) => s.updatePendingSite);
  const { createMainTask } = useAppData();

  const [sortField, setSortField] = useState<'client' | 'name' | 'startDate' | 'endDate' | 'status'>('client');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // URL state for Client Mode
  const urlClientName = searchParams.get('client');
  const selectedClientName = urlClientName || null;

  // Editing TIN state
  const [editingTin, setEditingTin] = useState(false);
  const [tinInput, setTinInput] = useState('');

  // Selected client computed properties
  const selectedClient = useMemo(() => {
    if (!selectedClientName) return null;
    const nameLow = selectedClientName.trim().toLowerCase();
    
    // Deduplicate profiles
    let tinNumber = 'Not provided';
    let profileStartDate = 'Unknown';
    
    const profile = clientProfiles.find(p => p.name.trim().toLowerCase() === nameLow);
    if (profile) {
      tinNumber = profile.tinNumber || 'Not provided';
      profileStartDate = profile.startDate || 'Unknown';
    } else {
      const pending = pendingSites.find(s => s.clientName.trim().toLowerCase() === nameLow && s.phase4?.clientTinNumber);
      if (pending?.phase4?.clientTinNumber) tinNumber = pending.phase4.clientTinNumber;
    }

    let totalSites = 0;
    let activeSites = 0;
    let totalRevenue = 0;

    sites.forEach(s => {
      if (s.client.trim().toLowerCase() === nameLow) {
        totalSites++;
        if (s.status === 'Active') activeSites++;
      }
    });

    invoices.forEach(inv => {
      if (inv.client.trim().toLowerCase() === nameLow && inv.status === 'Paid') {
        totalRevenue += (inv.totalCharge || 0);
      }
    });

    const clientSiteDates = sites
      .filter(s => s.client.trim().toLowerCase() === nameLow && s.startDate)
      .map(s => s.startDate)
      .sort();
    const startDate = clientSiteDates[0] || profileStartDate;

    return {
      id: profile?.id,
      name: selectedClientName,
      tinNumber,
      startDate,
      stats: { totalSites, activeSites, totalRevenue }
    };
  }, [selectedClientName, sites, invoices, clientProfiles, pendingSites]);

  const handleSaveTin = async () => {
    if (!selectedClient) return;
    
    try {
      if (selectedClient.id) {
        updateClientProfile(selectedClient.id, { tinNumber: tinInput });
      } else {
        addClientProfile({
          id: generateId(),
          name: selectedClientName!,
          tinNumber: tinInput,
          startDate: new Date().toISOString().split('T')[0]
        });
      }
      toast.success('Client TIN updated');
      setEditingTin(false);
    } catch (e) {
      toast.error('Failed to update TIN');
    }
  };

  const clientLogs = useMemo(() => {
    if (!selectedClientName) return [];
    const nameLow = selectedClientName.trim().toLowerCase();
    return commLogs
      .filter(l => {
        if (l.client.trim().toLowerCase() !== nameLow) return false;
        if (selectedLogsSiteId !== 'all' && l.siteId !== selectedLogsSiteId) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.date + (a.time ? `T${a.time}` : 'T00:00');
        const dateB = b.date + (b.time ? `T${b.time}` : 'T00:00');
        return new Date(dateA).getTime() - new Date(dateB).getTime(); // ascending for threading
      });
  }, [commLogs, selectedClientName, selectedLogsSiteId]);

  // Group: parent logs (no parentId) with their follow-ups as children
  const groupedClientLogs = useMemo(() => {
    const parents = clientLogs.filter(l => !l.parentId);
    const followUps = clientLogs.filter(l => !!l.parentId);
    return parents
      .map(parent => ({
        ...parent,
        followUps: followUps
          .filter(fu => fu.parentId === parent.id)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first
  }, [clientLogs]);

  // Sites belonging to this client for the logs site-selector
  const clientSitesForLogs = useMemo(() => {
    if (!selectedClientName) return [];
    return sites.filter(s => s.client.trim().toLowerCase() === selectedClientName.trim().toLowerCase());
  }, [sites, selectedClientName]);

  const getChannelIcon = (ch: string) => {
    if (ch === 'Call') return <Phone className="w-4 h-4" />;
    if (ch === 'Email') return <Mail className="w-4 h-4" />;
    if (ch === 'WhatsApp') return <MessageCircle className="w-4 h-4" />;
    if (ch === 'Meeting') return <Users className="w-4 h-4" />;
    if (ch === 'SMS') return <MessageSquare className="w-4 h-4" />;
    if (ch === 'Visit') return <Car className="w-4 h-4" />;
    return <MessageSquare className="w-4 h-4" />;
  };

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      const isHardcoded = site.client.toLowerCase() === 'dcel' && site.name.toLowerCase() === 'office';
      if (isHardcoded) return false;
      
      // Filter by client if in Single Client Mode
      if (selectedClientName && site.client.trim().toLowerCase() !== selectedClientName.trim().toLowerCase()) {
        return false;
      }

      return (
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.client.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [sites, searchTerm, selectedClientName]);

  const sortedSites = useMemo(() => {
    return [...filteredSites].sort((a, b) => {
      let valA = (a[sortField] || '').toString().toLowerCase();
      let valB = (b[sortField] || '').toString().toLowerCase();

      if (sortField === 'startDate' || sortField === 'endDate') {
        valA = a[sortField] || '9999-99-99'; // Push empty dates to end
        valB = b[sortField] || '9999-99-99';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSites, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3 text-indigo-600" /> 
      : <ChevronDown className="ml-1 h-3 w-3 text-indigo-600" />;
  };

  const filteredPendingSites = pendingSites.filter(site => {
    if (site.status !== 'Pending') return false;
    if (selectedClientName && site.clientName.toLowerCase() !== selectedClientName.toLowerCase()) return false;
    
    return (
      site.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const isDuplicate = (name: string, client: string, excludeId?: string) => {
    const nameLow = name.trim().toLowerCase();
    const clientLow = client.trim().toLowerCase();

    const activeMatch = sites.some(s =>
      s.name.trim().toLowerCase() === nameLow &&
      s.client.trim().toLowerCase() === clientLow &&
      s.id !== excludeId
    );
    if (activeMatch) return true;

    // Only flag a pendingSite as a duplicate if there is NO active site record
    // for that name/client already (avoids false positives from linked questionnaires
    // whose siteId was never back-filled at activation time).
    return pendingSites.some(ps =>
      ps.siteName.trim().toLowerCase() === nameLow &&
      ps.clientName.trim().toLowerCase() === clientLow &&
      ps.id !== excludeId &&
      ps.siteId !== excludeId &&
      !sites.some(s =>
        s.name.trim().toLowerCase() === ps.siteName.trim().toLowerCase() &&
        s.client.trim().toLowerCase() === ps.clientName.trim().toLowerCase()
      )
    );
  };

  const handleAdd = () => {
    if (!addForm.name || !addForm.client) { setAddError('Site name and client are required.'); return; }
    if (isDuplicate(addForm.name, addForm.client)) {
      setAddError(`"${addForm.client} – ${addForm.name}" already exists. Client + Site combination must be unique.`);
      return;
    }
    
    // Auto status based on start/end date range logic
    let calcStatus: 'Active' | 'Inactive' | 'Ended' = 'Active';
    const nowStr = new Date().toISOString().split('T')[0];
    if (addForm.endDate) {
      calcStatus = 'Ended';
    } else if (addForm.startDate && nowStr < addForm.startDate) {
      calcStatus = 'Inactive';
    }

    addSite({
      id: generateId(),
      name: addForm.name.trim(),
      client: addForm.client.trim(),
      vat: addForm.vat,
      status: calcStatus,
      startDate: normalizeDate(addForm.startDate),
      endDate: normalizeDate(addForm.endDate),
    });
    setAddForm({ ...EMPTY_FORM });
    setAddError('');
    setIsAddingSite(false);
  };


  const handleEditStart = (site: Site) => {
    setEditingId(site.id);
    setEditForm({ name: site.name, client: site.client, vat: site.vat, status: site.status, startDate: site.startDate || '', endDate: site.endDate || '' });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    if (!editForm.name || !editForm.client) return;
    if (isDuplicate(editForm.name, editForm.client, editingId)) {
      toast.error(`"${editForm.client} – ${editForm.name}" already exists. Client + Site must be unique.`);
      return;
    }
    // Auto status based on end date
    const nowStr = new Date().toISOString().split('T')[0];
    let submitStatus = editForm.status;
    if (editForm.endDate) {
      submitStatus = 'Ended';
    } else if (editForm.startDate && nowStr < editForm.startDate) {
      submitStatus = 'Inactive';
    } else if (submitStatus === 'Ended') {
      // If end date was cleared, it can't be "Ended" anymore
      submitStatus = 'Active';
    }

    updateSite(editingId, {
      ...editForm,
      status: submitStatus
    });

    // Synchronize changes to the linked questionnaire if it exists
    const linkedPS = pendingSites.find(ps => ps.siteId === editingId);
    if (linkedPS) {
      const taxStatus = editForm.vat === 'Add' ? 'Mainland (Add 7.5% VAT)' : 
                       editForm.vat === 'Yes' ? 'Mainland (Yes 7.5% VAT)' : 
                       'Free Trade Zone (0% VAT)';
      
      updatePendingSite(linkedPS.id, {
        siteName: editForm.name,
        clientName: editForm.client,
        phase1: {
          ...linkedPS.phase1,
          timelineStartDate: editForm.startDate || linkedPS.phase1.timelineStartDate
        },
        phase4: {
          ...linkedPS.phase4,
          clientTaxStatus: taxStatus
        },
        phase5: {
          ...linkedPS.phase5,
          actualEndDate: editForm.endDate // Correctly pass empty string if cleared
        }
      });
    }

    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this site?', { variant: 'danger', confirmLabel: 'Delete' });
    if (ok) { deleteSite(id); toast.success('Site deleted.'); }
  };

  const displayClients = clients.filter(c => c.toLowerCase() !== 'dcel');
  const uniqueClients = displayClients.length;

  const handleExportExcel = () => {
    // Collect all unique sites from both live sites and onboarding records
    const allSiteKeys = new Set<string>();
    sites.forEach(s => allSiteKeys.add(`${s.client.toLowerCase().trim()}::${s.name.toLowerCase().trim()}`));
    pendingSites.forEach(ps => allSiteKeys.add(`${ps.clientName.toLowerCase().trim()}::${ps.siteName.toLowerCase().trim()}`));

    const exportData = Array.from(allSiteKeys).map(key => {
      const [clientLow, nameLow] = key.split('::');
      const site = sites.find(s => s.client.toLowerCase().trim() === clientLow && s.name.toLowerCase().trim() === nameLow);
      const q = pendingSites.find(ps => ps.clientName.toLowerCase().trim() === clientLow && ps.siteName.toLowerCase().trim() === nameLow);

      const name = site?.name || q?.siteName || '';
      const client = site?.client || q?.clientName || '';
      
      // Category helps distinguish if it's already live or still in onboarding
      const category = site ? "Active Site" : "Pending Onboarding";

      // Helper to format internal YYYY-MM-DD strings as DD/MM/YYYY for Excel export
      const toUserDate = (iso: string | null | undefined) => {
        if (!iso) return '';
        const parts = iso.split('T')[0].split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      };

      return {
        "Category": category,
        "Site Name": name,
        "Client": client,
        "Start Date": toUserDate(site?.startDate || q?.phase1?.timelineStartDate),
        "End Date": toUserDate(site?.endDate || q?.phase5?.actualEndDate),
        "VAT": site?.vat || (q?.phase4?.clientTaxStatus?.includes('Add') ? 'Add' : q?.phase4?.clientTaxStatus?.includes('Yes') ? 'Yes' : 'No'),
        "Status": site?.status || q?.status || 'Active',
        
        "Service": q?.phase1?.whatIsBeingBuilt || '',
        "Excavation Depth": q?.phase1?.excavationDepthMeters || '',
        "Site Length": q?.phase1?.siteLength || '',
        "Site Width": q?.phase1?.siteWidth || '',
        
        "Known Obstacles": q?.phase2?.knownObstacles || '',
        "Discharge Location": q?.phase2?.dischargeLocation || '',
        "Diesel Strategy": q?.phase2?.dieselSupplyStrategy || '',
        
        "Dewatering Methods": q?.phase3?.dewateringMethods ? q?.phase3?.dewateringMethods.join(', ') : '',
        "Total Wellpoints": q?.phase3?.totalWellpointsRequired || '',
        "Total Headers": q?.phase3?.totalHeadersRequired || '',
        "Total Pumps": q?.phase3?.totalPumpsRequired || '',
        "Expected Daily Diesel": q?.phase3?.expectedDailyDieselUsage || '',
        
        "Client Tax Status": q?.phase4?.clientTaxStatus || '',
        "Scope of Work": q?.phase4?.scopeOfWorkSummary || '',
        "Scope Exclusions": q?.phase4?.scopeExclusionsSummary || ''
      };
    });

    if (exportData.length === 0) {
      toast.error('No sites to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sites");
    XLSX.writeFile(wb, `Sites_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmProceed = await showConfirm(`File selected: ${file.name}\n\nDo you want to proceed with the import process?`, { confirmLabel: "Proceed", cancelLabel: "Cancel" });
    if (!confirmProceed) {
      e.target.value = '';
      return;
    }

    const isClear = await showConfirm("CLEAR EXISTING DATA?\n\n- Click 'Clear & Replace' to wipe all existing sites and replace them completely.\n- Click 'Append Data' to safely add to your existing list.", {
      confirmLabel: "Clear & Replace",
      cancelLabel: "Append Data",
      variant: "danger"
    });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Site>(ws);

        if (data && data.length > 0) {
          let count = 0;
          let skippedCount = 0;
          const validNewSites: Site[] = [];
          const validNewPendingSites: SiteQuestionnaire[] = [];
          const missingTasks: any[] = [];

          const importedPairs = new Set<string>();
          const importedIds = new Set<string>(!isClear ? sites.map(s => s.id) : []);

          data.forEach((importedSite: any) => {
            const name = (importedSite["Site Name"] || importedSite.name || '').toString().trim();
            const client = (importedSite["Client"] || importedSite.client || '').toString().trim();
            const category = (importedSite["Category"] || '').toString().trim();
            const isPendingOnly = category === "Pending Onboarding";

            if (!name || !client) {
              skippedCount++;
              return;
            }

            const pairKey = `${client.toLowerCase()}::${name.toLowerCase()}`;
            // Check against existing store data (Append mode) OR within-file duplicates
            const isDupWithStore = !isClear ? isDuplicate(name, client) : false;
            const isDupInBatch = importedPairs.has(pairKey);

            if (isDupWithStore || isDupInBatch) {
              skippedCount++;
              return;
            }

            let newId = importedSite.id ? importedSite.id.toString().trim() : generateId();
            if (importedIds.has(newId) || sites.some(s => s.id === newId)) {
              newId = generateId();
            }

            importedPairs.add(pairKey);
            importedIds.add(newId);

            const startDate = normalizeDate(importedSite["Start Date"] || importedSite.startDate || '');
            const endDate = normalizeDate(importedSite["End Date"] || importedSite.endDate || '');
            const vat = (importedSite["VAT"] || importedSite.vat || 'No').toString().trim();
            const status = (importedSite["Status"] || importedSite.status || 'Active').toString().trim();

            if (!isPendingOnly) {
              validNewSites.push({
                id: newId,
                name: name,
                client: client,
                startDate: startDate,
                endDate: endDate,
                vat: vat === 'Yes' ? 'Yes' : (vat === 'Add' ? 'Add' : 'No'),
                status: endDate ? 'Ended' : (status === 'Inactive' ? 'Inactive' : 'Active')
              });
            }
            
            // Map onboarding details
            const service = (importedSite["Service"] || '').toString();
            const depth = (importedSite["Excavation Depth"] || '').toString();
            const diesel = (importedSite["Expected Daily Diesel"] || '').toString();
            
            const missingInfo: string[] = [];
            if (!service) missingInfo.push("Service / What Is Being Built");
            if (!depth) missingInfo.push("Excavation Depth");
            if (!diesel) missingInfo.push("Expected Daily Diesel Usage");
            
            validNewPendingSites.push({
               id: generateId(),
               siteId: isPendingOnly ? '' : newId,
               clientName: client,
               siteName: name,
               status: endDate ? 'Ended' : (isPendingOnly ? 'Pending' : 'Active'),
               phase1: {
                  isNewSite: isPendingOnly, 
                  isNewClient: !clients.includes(client), 
                  whatIsBeingBuilt: service, excavationDepthMeters: depth,
                  siteLength: (importedSite["Site Length"] || '').toString(),
                  siteWidth: (importedSite["Site Width"] || '').toString(),
                  timelineStartDate: startDate, 
                  geotechnicalReportAvailable: false, hydrogeologicalDataAvailable: false,
                  completed: !!service && !!depth
               },
               phase2: { siteVisited: false, walkthroughCompleted: false, knownObstacles: (importedSite["Known Obstacles"] || '').toString(), dischargeLocation: (importedSite["Discharge Location"] || '').toString(), dieselSupplyStrategy: '', completed: false },
               phase3: { dewateringMethods: [], totalWellpointsRequired: (importedSite["Total Wellpoints"] || '').toString(), totalHeadersRequired: (importedSite["Total Headers"] || '').toString(), totalPumpsRequired: (importedSite["Total Pumps"] || '').toString(), expectedDailyDieselUsage: diesel, completed: !!diesel },
               phase4: { quotationSent: false, clientFeedbackReceived: false, proposalAccepted: false, clientTaxStatus: (importedSite["Client Tax Status"] || '').toString(), scopeOfWorkSummary: (importedSite["Scope of Work"] || '').toString(), scopeExclusionsSummary: (importedSite["Scope Exclusions"] || '').toString(), timelineConfirmed: false, permittingResponsibilityOutlined: false, tinProvided: false, completed: false },
               phase5: { safetyPlanIntegrated: false, stage1AdvanceReceived: false, stage2InstallationComplete: false, stage2FirstInvoiceIssued: false, stage3TimelyBilling: false, stage4DemobilizationComplete: false, stage4FinalInvoiceIssued: false, actualEndDate: endDate, completed: false },
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
            } as SiteQuestionnaire);
            
            if (missingInfo.length > 0) {
               missingTasks.push({
                  task: {
                     title: `Complete Site Onboarding: ${name}`,
                     description: `Please fill out missing fields for the newly imported site: ${name}.`,
                     priority: 'high'
                  },
                  subs: missingInfo.map(info => ({
                     title: `Provide Missing Field: ${info}`,
                     priority: 'high'
                  }))
               });
            }

            count++;
          });

          if (isClear) {
            setSites(validNewSites);
            setPendingSites(validNewPendingSites);
            toast.success(`Replaced database with ${count} sites! (${skippedCount} duplicates/invalid rows skipped)`);
          } else {
            validNewSites.forEach(s => addSite(s));
            validNewPendingSites.forEach(ps => addPendingSite(ps));
            toast.success(`Appended ${count} new sites! (${skippedCount} duplicates/invalid rows skipped)`);
          }
          
          if (missingTasks.length > 0) {
             missingTasks.forEach(async (t) => {
                await createMainTask(t.task, t.subs);
             });
             toast.success(`Created ${missingTasks.length} onboarding tasks for missing info.`);
          }
        } else {
          toast.error('The file appears to be empty or improperly formatted.');
        }
      } catch (err) {
        toast.error('Failed to parse file.');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  useSetPageTitle(
    selectedClient ? `${selectedClient.name} Sites` : 'Sites Management',
    selectedClient ? `Manage sites, view communications and details for ${selectedClient.name}` : 'Manage project sites, clients, and technical onboarding summaries',
    <div className="hidden sm:flex items-center gap-2">
      {canImport && (
        <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
          <Upload className="h-3.5 w-3.5 text-indigo-500" /> Import Sites
          <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
        </label>
      )}
      {canExport && (
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-9 px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm"
          onClick={handleExportExcel}
        >
          <Download className="h-3.5 w-3.5 text-emerald-500" /> Export Excel
        </Button>
      )}

    </div>,
    [canAddSite, canImport, canExport]
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      
      {/* ── Mobile Actions ── */}
      <div className="flex sm:hidden flex-col gap-3 px-1">
        <div className="flex flex-wrap gap-2">

          {canExport && (
            <Button variant="outline" className="flex-1 gap-2 text-[11px] font-bold uppercase tracking-tight" onClick={handleExportExcel}>
              <Download className="h-4 w-4 text-emerald-500" /> Export
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-[500px]">
        {/* Unified Header with Tabs and Search */}
        <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
          {selectedClient ? (
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/sites')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div className="flex items-center gap-2 text-sm">
                 <span className="text-slate-500">Managing sites for:</span>
                 <Badge variant="secondary" className="px-3 py-1 font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                   <Building2 className="w-3.5 h-3.5 mr-1.5" />
                   {selectedClient.name}
                 </Badge>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-lg w-full sm:w-auto">
              <button
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'clients' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
              >
                Client Summary
              </button>
              <button
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => { setActiveTab('active'); setSearchTerm(''); }}
              >
                All Sites
              </button>
              <button
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'pending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => { setActiveTab('pending'); setSearchTerm(''); }}
              >
                Pending Onboarding
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeTab !== 'clients' && !selectedClient && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search Client or Site..."
                  className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-indigo-500/50 rounded-lg shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
            {(activeTab === 'active' || selectedClient) && (
              <>
                <select 
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={sortField}
                  onChange={(e) => handleSort(e.target.value as any)}
                >
                  <option value="client">Sort By: Client</option>
                  <option value="name">Sort By: Site Name</option>
                  <option value="startDate">Sort By: Start Date</option>
                  <option value="status">Sort By: Status</option>
                </select>
                <div className="hidden sm:flex bg-slate-200/50 p-1 rounded-lg">
                  <button
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setViewMode('card')}
                    title="Card View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                
                {selectedClient && (
                  <Button
                    variant="outline"
                    className="h-9 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-semibold flex items-center gap-2"
                    onClick={() => setContactsFor(selectedClient.name)}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Client Contacts</span>
                    {(() => {
                      const count = clientContacts.filter(c => c.clientName === selectedClient.name).length;
                      return count > 0 ? (
                        <span className="bg-indigo-200 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">{count}</span>
                      ) : null;
                    })()}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {selectedClient && (
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm relative group">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> TIN Number</p>
                  {!editingTin && (
                    <button onClick={() => { setTinInput(selectedClient.tinNumber === 'Not provided' ? '' : selectedClient.tinNumber); setEditingTin(true); }} className="text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {editingTin ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input 
                      autoFocus
                      size={1}
                      className="h-7 text-xs px-2"
                      value={tinInput}
                      onChange={(e) => setTinInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTin()}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 shrink-0" onClick={handleSaveTin}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 shrink-0" onClick={() => setEditingTin(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-800 truncate" title={selectedClient.tinNumber}>{selectedClient.tinNumber}</p>
                )}
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Client Since</p>
                <p className="text-sm font-bold text-slate-800">{selectedClient.startDate}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Total Sites</p>
                <p className="text-xl font-black text-slate-800">{selectedClient.stats.totalSites}</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 shadow-sm">
                <p className="text-xs text-emerald-600/80 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Active Sites</p>
                <p className="text-xl font-black text-emerald-700">{selectedClient.stats.activeSites}</p>
              </div>
            </div>
          </div>
        )}

        {/* --- Render Main Body Based on activeTab --- */}
        {!selectedClient && activeTab === 'clients' ? (
          <div className="flex-1 p-4 sm:p-6 bg-slate-50/50">
            <ClientSummaryGrid />
          </div>
        ) : (activeTab === 'active' || selectedClient) ? (
          <div className="flex-1 flex flex-col min-h-0">
            {viewMode === 'table' ? (
            <div className="overflow-auto style-scroll flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead className="cursor-pointer group" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleSort('client')}>
                    <div className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                      Client <SortIcon field="client" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer group" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                      Site Name <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer group" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleSort('startDate')}>
                    <div className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                      Start Date <SortIcon field="startDate" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer group" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleSort('endDate')}>
                    <div className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                      End Date <SortIcon field="endDate" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">VAT Status</TableHead>
                  <TableHead className="cursor-pointer group" onMouseDown={(e) => e.stopPropagation()} onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                      Status <SortIcon field="status" />
                    </div>
                  </TableHead>
                  {hasActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSites.map(site => {
                  const siteIndex = sites.findIndex(s => s.id === site.id);
                  const siteCode = `S-${String(siteIndex + 1).padStart(3, '0')}`;
                  return (
                    <TableRow 
                      key={site.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group/row"
                      onClick={() => {
                        // Enter client detail mode when clicking a site if we aren't already grouped
                        if (!selectedClientName) {
                          navigate(`/sites?client=${encodeURIComponent(site.client)}`);
                        }
                      }}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-slate-400" onClick={e => e.stopPropagation()}>{siteCode}</TableCell>
                      <TableCell className="font-bold text-slate-900" onClick={e => e.stopPropagation()}>
                        {editingId === site.id ? (
                          <select
                            value={editForm.client}
                            onChange={e => setEditForm({ ...editForm, client: e.target.value })}
                            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                          >
                            <option value="" disabled>Select Client</option>
                            {displayClients.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : site.client}
                      </TableCell>
                      <TableCell>
                        {editingId === site.id
                          ? <Input value={editForm.name} className="h-8" onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                          : site.name}
                      </TableCell>
                      <TableCell>
                        {editingId === site.id ? (
                          <Input type="date" value={editForm.startDate} className="h-8 w-32" onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                        ) : (
                          <span className="text-slate-600 font-medium">{toDisplayDate(site.startDate) || <span className="text-slate-300">-</span>}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === site.id ? (
                          <Input type="date" value={editForm.endDate} className="h-8 w-32" onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                        ) : (
                          <span className="text-slate-500">{toDisplayDate(site.endDate) || <span className="text-slate-300">-</span>}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {editingId === site.id ? (
                          <select
                            value={editForm.vat}
                            onChange={e => setEditForm({ ...editForm, vat: e.target.value as 'Yes' | 'No' | 'Add' })}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                            <option value="Add">Add</option>
                          </select>
                        ) : (
                          <Badge 
                            variant={site.vat === 'Yes' || site.vat === 'Add' ? 'success' : 'outline'}
                            className="text-[10px] uppercase font-bold"
                          >
                            {site.vat}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={site.status === 'Ended' ? 'destructive' : site.status === 'Active' ? 'success' : 'secondary'}
                          className="text-[10px] font-bold"
                        >
                          {site.status}
                        </Badge>
                      </TableCell>
                      {hasActions && (
                        <TableCell className="text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {editingId === site.id ? (
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" className="text-emerald-600" onClick={handleSaveEdit}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]">
                                  <DropdownMenuItem 
                                    onClick={() => setNarrativeSite({ site, q: pendingSites.find(ps => ps.siteName === site.name && ps.clientName === site.client) || null })}
                                    className="gap-2"
                                  >
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <span>Site Summary</span>
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      const linkedQ = pendingSites.find(ps => ps.siteName === site.name && ps.clientName === site.client);
                                      if (linkedQ) navigate(`/sites/onboarding/${linkedQ.id}`);
                                      else navigate('/sites/onboarding/new', { state: { linkedSite: site } });
                                    }}
                                    className="gap-2"
                                  >
                                    <Eye className="h-4 w-4 text-slate-400" />
                                    <span>View Onboarding</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      navigate(`/sites/conversations/${site.id}`);
                                    }}
                                    className="gap-2"
                                  >
                                    <MessageSquare className="h-4 w-4 text-slate-400" />
                                    <span>Site Conversations</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem 
                                    onClick={() => {
                                      navigate(`/sites/diary/${site.id}`);
                                    }}
                                    className="gap-2 text-emerald-600 focus:text-emerald-700"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                    <span>Site Diary</span>
                                  </DropdownMenuItem>
  
                                  {canEditSite && (
                                    <DropdownMenuItem 
                                      onClick={() => handleEditStart(site)}
                                      className="gap-2 text-indigo-700 focus:text-indigo-700 focus:bg-indigo-50"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      <span>Edit Site</span>
                                    </DropdownMenuItem>
                                  )}
  
                                  {canDeleteSite && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleDelete(site.id)}
                                        className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                {filteredSites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={hasActions ? 8 : 7} className="text-center py-12 text-slate-400 italic">
                      No matching project sites found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-5 bg-slate-50/30 overflow-y-auto style-scroll flex-1 min-h-0">
                {sortedSites.map(site => {
                  const q = pendingSites.find(ps => ps.siteName === site.name && ps.clientName === site.client);
                  
                  return (
                    <Card 
                      key={site.id} 
                      className="border-slate-200 shadow-sm hover:shadow-md transition-all bg-white group overflow-hidden cursor-pointer"
                      onClick={() => {
                        if (!selectedClientName) {
                          navigate(`/sites?client=${encodeURIComponent(site.client)}`);
                        }
                      }}
                    >
                      <CardContent className="p-5 sm:p-6 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                              <MapPin className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="text-sm font-bold text-slate-800 uppercase truncate leading-tight" title={site.name}>{site.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-500 text-xs">
                                <Building2 className="h-3 w-3" /> <span className="truncate" title={site.client}>{site.client}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={site.status === 'Ended' ? 'destructive' : site.status === 'Active' ? 'success' : 'secondary'} className="text-[10px] uppercase font-bold shrink-0 ml-2">
                            {site.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4 mt-4 text-xs">
                          <div className="bg-slate-50 p-2 rounded-md">
                            <span className="text-slate-400 block mb-0.5">Start Date</span>
                            <span className="font-semibold text-slate-700">{toDisplayDate(site.startDate) || '-'}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-md">
                            <span className="text-slate-400 block mb-0.5">End Date</span>
                            <span className="font-semibold text-slate-700">{toDisplayDate(site.endDate) || '-'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">VAT:</span>
                            <Badge variant={site.vat === 'Yes' || site.vat === 'Add' ? 'success' : 'outline'} className="text-[9px] uppercase font-bold px-1.5 py-0">
                              {site.vat}
                            </Badge>
                          </div>
                         
                          {hasActions && (
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-slate-50">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]">
                                  <DropdownMenuItem onClick={() => setNarrativeSite({ site, q: q || null })} className="gap-2">
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <span>Site Summary</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      if (q) navigate(`/sites/onboarding/${q.id}`);
                                      else navigate('/sites/onboarding/new', { state: { linkedSite: site } });
                                    }}
                                    className="gap-2"
                                  >
                                    <Eye className="h-4 w-4 text-slate-400" />
                                    <span>View Onboarding</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      navigate(`/sites/conversations/${site.id}`);
                                    }}
                                    className="gap-2"
                                  >
                                    <MessageSquare className="h-4 w-4 text-slate-400" />
                                    <span>Site Conversations</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem 
                                    onClick={() => {
                                      navigate(`/sites/diary/${site.id}`);
                                    }}
                                    className="gap-2 text-emerald-600 focus:text-emerald-700"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                    <span>Site Diary</span>
                                  </DropdownMenuItem>

                                  {canEditSite && (
                                    <DropdownMenuItem onClick={() => { setViewMode('table'); handleEditStart(site); }} className="gap-2 text-indigo-700 focus:text-indigo-700 focus:bg-indigo-50">
                                      <Pencil className="h-4 w-4" />
                                      <span>Edit Site</span>
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteSite && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleDelete(site.id)} className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredSites.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-400 italic">
                    No matching project sites found.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="overflow-auto style-scroll flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Proposed Site</TableHead>
                  <TableHead className="text-center">Phase 1</TableHead>
                  <TableHead className="text-center">Phase 2</TableHead>
                  <TableHead className="text-center">Phase 3</TableHead>
                  <TableHead className="text-center">Phase 4</TableHead>
                  <TableHead className="text-center">Phase 5</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPendingSites.map(site => (
                  <TableRow 
                    key={site.id} 
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!selectedClientName) {
                        navigate(`/sites?client=${encodeURIComponent(site.clientName)}`);
                      }
                    }}
                  >
                    <TableCell className="font-bold text-slate-900">{site.clientName}</TableCell>
                    <TableCell className="font-medium text-slate-600">{site.siteName}</TableCell>
                    <TableCell className="text-center">{site.phase1.completed ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</TableCell>
                    <TableCell className="text-center">{site.phase2.completed ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</TableCell>
                    <TableCell className="text-center">{site.phase3.completed ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</TableCell>
                    <TableCell className="text-center">{site.phase4.completed ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</TableCell>
                    <TableCell className="text-center">{site.phase5.completed ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={site.status === 'Pending' ? 'outline' : 'success'}
                        className={`text-[10px] font-bold ${site.status === 'Pending' ? 'bg-slate-50 text-slate-500 border-slate-200' : ''}`}
                      >
                        {site.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50" onClick={() => navigate(`/sites/onboarding/${site.id}`)}>
                        <Eye className="h-4 w-4 mr-2" /> View Form
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPendingSites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400 italic">
                      No pending onboarding records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </div>
      
      {/* Client Contacts Modal */}
      {contactsFor && (
        <ClientContactsPanel
          clientName={contactsFor}
          onClose={() => setContactsFor(null)}
        />
      )}

      {/* ── Site Narrative Info Modal ── */}
      {narrativeSite && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-5 flex items-start justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">{narrativeSite.site.name}</h2>
                <p className="text-indigo-200 text-sm mt-0.5">{narrativeSite.site.client} · {narrativeSite.site.status}</p>
              </div>
              <button onClick={() => setNarrativeSite(null)} className="text-indigo-200 hover:text-white mt-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Project Summary</h3>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {buildNarrative(narrativeSite.site, narrativeSite.q)}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <Button variant="outline" onClick={() => setNarrativeSite(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
