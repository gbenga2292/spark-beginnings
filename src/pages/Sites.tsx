import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogFooter } from '@/src/components/ui/dialog';
import { Search, Plus, MapPin, Building2, X, Save, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { useAppStore, Site } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useUserStore } from '@/src/store/userStore';

const EMPTY_FORM = { name: '', client: '', vat: 'No' as 'Yes' | 'No' | 'Add', status: 'Active' as 'Active' | 'Inactive', startDate: new Date().toISOString().split('T')[0], endDate: '' };

function ClientSummary() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const monthValues = useAppStore(s => s.monthValues);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const employees = useAppStore(s => s.employees);
  const sites = useAppStore(s => s.sites);

  const monthsMap = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const currentMonthKey = monthsMap[selectedMonth - 1];
  const { workDays, overtimeRate } = monthValues[currentMonthKey];

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
  );
}

export function Sites() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingSite, setIsAddingSite] = useState(searchParams.get('action') === 'add');
  const [isAddingClient, setIsAddingClient] = useState(searchParams.get('action') === 'addClient');
  const [newClientName, setNewClientName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');

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
  const clients = useAppStore((s) => s.clients);
  const addSite = useAppStore((s) => s.addSite);
  const addClient = useAppStore((s) => s.addClient);
  const setSites = useAppStore((s) => s.setSites);
  const updateSite = useAppStore((s) => s.updateSite);
  const deleteSite = useAppStore((s) => s.deleteSite);

  const filteredSites = sites.filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDuplicate = (name: string, client: string, excludeId?: string) =>
    sites.some(s =>
      s.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      s.client.trim().toLowerCase() === client.trim().toLowerCase() &&
      s.id !== excludeId
    );

  const handleAdd = () => {
    if (!addForm.name || !addForm.client) { setAddError('Site name and client are required.'); return; }
    if (isDuplicate(addForm.name, addForm.client)) {
      setAddError(`"${addForm.client} – ${addForm.name}" already exists. Client + Site combination must be unique.`);
      return;
    }
    
    // Auto status based on start/end date range logic
    let calcStatus: 'Active' | 'Inactive' = 'Active';
    const nowStr = new Date().toISOString().split('T')[0];
    if (addForm.startDate && nowStr < addForm.startDate) calcStatus = 'Inactive';
    if (addForm.endDate && nowStr > addForm.endDate) calcStatus = 'Inactive';

    addSite({
      id: `S-${Date.now().toString().slice(-4)}`,
      name: addForm.name.trim(),
      client: addForm.client.trim(),
      vat: addForm.vat,
      status: calcStatus,
      startDate: addForm.startDate,
      endDate: addForm.endDate,
    });
    if (!clients.includes(addForm.client.trim())) {
      addClient(addForm.client.trim());
    }
    setAddForm({ ...EMPTY_FORM });
    setAddError('');
    setIsAddingSite(false);
  };

  const handleAddClient = () => {
    if (!newClientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    if (clients.includes(newClientName.trim())) {
      toast.error('Client already exists');
      return;
    }
    addClient(newClientName.trim());
    setNewClientName('');
    setIsAddingClient(false);
    toast.success('Client added successfully');
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
    if (editForm.endDate && nowStr > editForm.endDate) {
      submitStatus = 'Inactive';
    } else if (editForm.startDate && nowStr < editForm.startDate) {
      submitStatus = 'Inactive';
    }
    updateSite(editingId, { ...editForm, status: submitStatus });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this site?', { variant: 'danger', confirmLabel: 'Delete' });
    if (ok) { deleteSite(id); toast.success('Site deleted.'); }
  };

  const uniqueClients = new Set(sites.map(s => s.client)).size;

  const handleExportExcel = () => {
    if (filteredSites.length === 0) {
      toast.error('No sites to export');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredSites);
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

          const importedPairs = new Set<string>();
          const importedIds = new Set<string>(!isClear ? sites.map(s => s.id) : []);

          data.forEach(importedSite => {
            const name = (importedSite.name || '').toString().trim();
            const client = (importedSite.client || '').toString().trim();

            if (!name || !client) {
              skippedCount++;
              return;
            }

            const pairKey = `${client.toLowerCase()}::${name.toLowerCase()}`;
            const isDupWithStore = !isClear ? isDuplicate(name, client) : false;

            if (isDupWithStore || importedPairs.has(pairKey)) {
              skippedCount++;
              return;
            }

            let newId = importedSite.id ? importedSite.id.toString().trim() : '';
            if (!newId || importedIds.has(newId)) {
              do {
                newId = `S-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
              } while (importedIds.has(newId) || sites.some(s => s.id === newId));
            }

            importedPairs.add(pairKey);
            importedIds.add(newId);

            validNewSites.push({
              id: newId,
              name: name,
              client: client,
              vat: importedSite.vat === 'Yes' ? 'Yes' : (importedSite.vat === 'Add' ? 'Add' : 'No'),
              status: importedSite.status === 'Inactive' ? 'Inactive' : 'Active'
            });
            count++;
          });

          if (isClear) {
            setSites(validNewSites);
            toast.success(`Replaced database with ${count} sites! (${skippedCount} duplicates/invalid rows skipped)`);
          } else {
            validNewSites.forEach(s => addSite(s));
            toast.success(`Appended ${count} new sites! (${skippedCount} duplicates/invalid rows skipped)`);
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

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sites &amp; Clients</h1>
          <p className="text-slate-500 mt-2">
            Manage project sites and clients. Each <strong>Client + Site</strong> combination is unique.
          </p>
        </div>
        {(canAddSite || canAddClient) && (
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {canAddSite && (
                <Button onClick={() => setIsAddingSite(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="h-4 w-4" /> Add New Site
                </Button>
              )}
              {canAddClient && (
                <Button onClick={() => setIsAddingClient(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add Client
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-indigo-100 bg-indigo-50/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-indigo-900">Total Active Sites</CardTitle>
                <MapPin className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-900">{sites.filter(s => s.status === 'Active').length}</div>
                <p className="text-xs text-indigo-600 mt-1">Currently operational</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Clients</CardTitle>
                <Building2 className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{uniqueClients}</div>
                <p className="text-xs text-slate-500 mt-1">Unique clients</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-100 bg-emerald-50/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">VAT Registered Sites</CardTitle>
                <span className="text-emerald-600 font-bold text-sm">VAT</span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-900">{sites.filter(s => s.vat === 'Yes' || s.vat === 'Add').length}</div>
                <p className="text-xs text-emerald-600 mt-1">Sites with VAT enabled</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search sites or clients..."
                  className="pl-9 text-sm h-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-400 mr-auto">{filteredSites.length} of {sites.length} sites</span>

              <div className="flex items-center gap-2">
                {canImport && (
                  <label className="cursor-pointer">
                    <Input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                    <Button variant="outline" size="sm" className="h-9 gap-2 pointer-events-none text-slate-600">
                      <Upload className="h-4 w-4" /> Import
                    </Button>
                  </label>
                )}
                {canExport && (
                  <Button onClick={handleExportExcel} size="sm" className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Download className="h-4 w-4" /> Export Excel
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Site Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-center">VAT</TableHead>
                  <TableHead>Status</TableHead>
                  {hasActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.map(site => (
                  <TableRow key={site.id}>
                    <TableCell className="font-mono text-xs text-slate-500">{site.id}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {editingId === site.id ? (
                        <select
                          value={editForm.client}
                          onChange={e => setEditForm({ ...editForm, client: e.target.value })}
                          className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                        >
                          <option value="" disabled>Select Client</option>
                          {clients.map(c => (
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
                        site.startDate || <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === site.id ? (
                        <Input type="date" value={editForm.endDate} className="h-8 w-32" onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                      ) : (
                        site.endDate || <span className="text-slate-300">-</span>
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
                        <Badge variant={site.vat === 'Yes' || site.vat === 'Add' ? 'success' : 'secondary'}>
                          {site.vat}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === site.id ? (
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm({ ...editForm, status: e.target.value as 'Active' | 'Inactive' })}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                          disabled={false}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      ) : (
                        <Badge variant={site.status === 'Active' ? 'success' : 'secondary'}>{site.status}</Badge>
                      )}
                    </TableCell>
                    {hasActions && (
                      <TableCell className="text-right">
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
                          <div className="flex justify-end gap-2">
                            {canEditSite && (
                              <Button variant="ghost" size="sm" className="text-indigo-600" onClick={() => handleEditStart(site)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeleteSite && (
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(site.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filteredSites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={hasActions ? 6 : 5} className="text-center py-8 text-slate-500">
                      No sites found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      {/* Floating Dialogs */}
      <Dialog open={isAddingSite} onClose={() => { setIsAddingSite(false); setAddError(''); navigate('/sites', { replace: true }); }} title="Add New Site">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Client <span className="text-red-500">*</span></label>
            <select
              value={addForm.client}
              onChange={e => setAddForm({ ...addForm, client: e.target.value })}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>Select a client...</option>
              {clients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">Select an existing client</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Site Name <span className="text-red-500">*</span></label>
            <Input
              placeholder="e.g. Louiseville"
              value={addForm.name}
              onChange={e => setAddForm({ ...addForm, name: e.target.value })}
            />
            <p className="text-xs text-slate-400">Must be unique per client</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Start Date</label>
              <Input
                type="date"
                value={addForm.startDate}
                onChange={e => setAddForm({ ...addForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">VAT</label>
              <select
                value={addForm.vat}
                onChange={e => setAddForm({ ...addForm, vat: e.target.value as 'Yes' | 'No' | 'Add' })}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="Add">Add</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsAddingSite(false); setAddError(''); navigate('/sites', { replace: true }); }}>Cancel</Button>
          <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Save className="h-4 w-4" /> Save Site
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={isAddingClient} onClose={() => { setIsAddingClient(false); setNewClientName(''); navigate('/sites', { replace: true }); }} title="Add New Client">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Client Name <span className="text-red-500">*</span></label>
            <Input
              placeholder="Enter client name"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
            />
            <p className="text-xs text-slate-400">A client can have multiple sites</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsAddingClient(false); setNewClientName(''); navigate('/sites', { replace: true }); }}>Cancel</Button>
          <Button onClick={handleAddClient} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Save className="h-4 w-4" /> Save Client
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

