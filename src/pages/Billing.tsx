import { useState, useMemo } from 'react';
import { useAppStore, PendingInvoice, Invoice } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, ArrowRightCircle } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';

export function Billing() {
  const sites = useAppStore((state) => state.sites);
  const pendingInvoices = useAppStore((state) => state.pendingInvoices);
  const invoices = useAppStore((state) => state.invoices);
  const addPendingInvoice = useAppStore(state => state.addPendingInvoice);
  const updatePendingInvoice = useAppStore(state => state.updatePendingInvoice);
  const deletePendingInvoice = useAppStore(state => state.deletePendingInvoice);
  const addInvoice = useAppStore(state => state.addInvoice);
  const updateInvoice = useAppStore(state => state.updateInvoice);
  const deleteInvoice = useAppStore(state => state.deleteInvoice);
  const vatRate = useAppStore(state => state.payrollVariables.vatRate);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('billing');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isViewingActive, setIsViewingActive] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initialForm = {
    destination: 'Pending' as 'Pending' | 'Active',
    startDate: '',
    duration: '',
    invoiceNo: '',
    client: '',
    site: '',
    noOfMachine: '',
    dailyRentalCost: '',
    noOfTechnician: '',
    techniciansDailyRate: '',
    dieselCostPerLtr: '',
    dailyUsage: '',
    mobDemob: '',
    installation: '',
    damages: '',
  };
  const [form, setForm] = useState(initialForm);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleClear = () => {
    setForm(initialForm);
    setSelectedId(null);
  };

  const livePreview = useMemo(() => {
    const duration = parseFloat(form.duration) || 0;
    const noOfMachine = parseFloat(form.noOfMachine) || 0;
    const dailyRentalCost = parseFloat(form.dailyRentalCost) || 0;
    const noOfTechnician = parseFloat(form.noOfTechnician) || 0;
    const techniciansDailyRate = parseFloat(form.techniciansDailyRate) || 0;
    const dieselCostPerLtr = parseFloat(form.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(form.dailyUsage) || 0;
    const mobDemob = parseFloat(form.mobDemob) || 0;
    const installation = parseFloat(form.installation) || 0;
    const damages = parseFloat(form.damages) || 0;

    const rentalCost = noOfMachine * dailyRentalCost * duration;
    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * duration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * duration;
    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;

    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
    const vatInc = siteObj ? siteObj.vat : 'No';

    let vat = 0;
    if (vatInc === 'Yes') {
      vat = (totalCost / (100 + vatRate)) * vatRate;
    } else if (vatInc === 'Add') {
      vat = totalCost * (vatRate / 100);
    }

    let totalCharge = totalCost;
    if (vatInc === 'Add') {
      totalCharge = totalCost + vat;
    }

    return { totalCost, vat, totalCharge, vatInc };
  }, [form, sites, vatRate]);

  const calculateInvoice = (): Omit<PendingInvoice, 'id'> | null => {
    if (!form.invoiceNo || !form.client || !form.site) {
      toast.error('Invoice Number, Client, and Site are required');
      return null;
    }

    const duration = parseFloat(form.duration) || 0;
    const noOfMachine = parseFloat(form.noOfMachine) || 0;
    const dailyRentalCost = parseFloat(form.dailyRentalCost) || 0;
    const noOfTechnician = parseFloat(form.noOfTechnician) || 0;
    const techniciansDailyRate = parseFloat(form.techniciansDailyRate) || 0;
    const dieselCostPerLtr = parseFloat(form.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(form.dailyUsage) || 0;
    const mobDemob = parseFloat(form.mobDemob) || 0;
    const installation = parseFloat(form.installation) || 0;
    const damages = parseFloat(form.damages) || 0;

    let endDate = '';
    if (form.startDate && duration > 0) {
      const start = new Date(form.startDate);
      start.setDate(start.getDate() + duration - 1);
      endDate = start.toISOString().split('T')[0];
    }

    const rentalCost = noOfMachine * dailyRentalCost * duration;
    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * duration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * duration;
    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;

    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
    const vatInc = siteObj ? siteObj.vat : 'No';

    let vat = 0;
    if (vatInc === 'Yes') {
      vat = (totalCost / (100 + vatRate)) * vatRate;
    } else if (vatInc === 'Add') {
      vat = totalCost * (vatRate / 100);
    }

    let totalCharge = totalCost;
    if (vatInc === 'Add') {
      totalCharge = totalCost + vat;
    }

    const totalExclusiveOfVat = totalCharge - vat;

    return {
      invoiceNo: form.invoiceNo,
      client: form.client,
      site: form.site,
      vatInc,
      noOfMachine,
      dailyRentalCost,
      dieselCostPerLtr,
      dailyUsage,
      noOfTechnician,
      techniciansDailyRate,
      startDate: form.startDate,
      duration,
      endDate,
      mobDemob,
      installation,
      damages,
      rentalCost,
      dieselCost,
      techniciansCost,
      totalCost,
      vat,
      totalCharge,
      totalExclusiveOfVat,
    };
  };

  const handleSubmit = () => {
    const data = calculateInvoice();
    if (!data) return;

    if (form.destination === 'Active') {
      // Create an Active Invoice directly
      const newInvoice: Invoice = {
        id: `INV-${Date.now()}`,
        invoiceNumber: data.invoiceNo,
        client: data.client,
        project: 'Billed',
        siteId: sites.find(s => s.name === data.site)?.id || '',
        siteName: data.site,
        amount: data.totalCharge,
        date: data.startDate,
        dueDate: data.endDate || data.startDate,
        billingCycle: 'Custom',
        reminderDate: '',
        status: 'Sent',
        // Sync pending properties
        vatInc: data.vatInc,
        noOfMachine: data.noOfMachine,
        dailyRentalCost: data.dailyRentalCost,
        dieselCostPerLtr: data.dieselCostPerLtr,
        dailyUsage: data.dailyUsage,
        noOfTechnician: data.noOfTechnician,
        techniciansDailyRate: data.techniciansDailyRate,
        mobDemob: data.mobDemob,
        installation: data.installation,
        damages: data.damages,
        duration: data.duration,
        rentalCost: data.rentalCost,
        dieselCost: data.dieselCost,
        techniciansCost: data.techniciansCost,
        totalCost: data.totalCost,
        vat: data.vat,
        totalCharge: data.totalCharge,
        totalExclusiveOfVat: data.totalExclusiveOfVat
      };

      if (selectedId) {
        // If we are somehow editing and moving it to Active directly
        updateInvoice(selectedId, newInvoice);
        toast.success('Active Invoice updated successfully');
      } else {
        addInvoice(newInvoice);
        toast.success('Active Invoice created successfully');
      }

    } else {
      // Destination is Pending
      if (selectedId) {
        updatePendingInvoice(selectedId, data);
        toast.success('Pending Invoice updated successfully');
      } else {
        addPendingInvoice({ ...data, id: `PI-${Date.now()}` });
        toast.success('Pending Invoice created successfully');
      }
    }

    setIsModalOpen(false);
    handleClear();
  };

  const handleEdit = (inv: PendingInvoice | Invoice) => {
    setSelectedId(inv.id);
    setForm({
      destination: 'totalCost' in inv ? 'Pending' : 'Active',
      startDate: 'startDate' in inv ? inv.startDate : inv.date,
      duration: 'duration' in inv ? String(inv.duration ?? 0) : '0',
      invoiceNo: 'invoiceNo' in inv ? inv.invoiceNo : inv.invoiceNumber,
      client: inv.client,
      site: 'site' in inv ? inv.site : inv.siteName,
      noOfMachine: 'noOfMachine' in inv ? String(inv.noOfMachine ?? 0) : '0',
      dailyRentalCost: 'dailyRentalCost' in inv ? String(inv.dailyRentalCost ?? 0) : '0',
      noOfTechnician: 'noOfTechnician' in inv ? String(inv.noOfTechnician ?? 0) : '0',
      techniciansDailyRate: 'techniciansDailyRate' in inv ? String(inv.techniciansDailyRate ?? 0) : '0',
      dieselCostPerLtr: 'dieselCostPerLtr' in inv ? String(inv.dieselCostPerLtr ?? 0) : '0',
      dailyUsage: 'dailyUsage' in inv ? String(inv.dailyUsage ?? 0) : '0',
      mobDemob: 'mobDemob' in inv ? String(inv.mobDemob ?? 0) : '0',
      installation: 'installation' in inv ? String(inv.installation ?? 0) : '0',
      damages: 'damages' in inv ? String(inv.damages ?? 0) : '0',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, removeOnly: boolean = false) => {
    if (!removeOnly) {
      const ok = await showConfirm('Are you sure you want to delete this invoice?', { variant: 'danger' });
      if (!ok) return;
    }

    if (isViewingActive) {
      deleteInvoice(id);
    } else {
      deletePendingInvoice(id);
    }
    if (selectedId === id) handleClear();
    if (!removeOnly) toast.success('Invoice deleted');
  };

  const handleMakeActive = async (inv: PendingInvoice) => {
    const ok = await showConfirm('Do you want to add this to the Active Invoices?', { confirmLabel: "Yes", cancelLabel: "No" });
    if (ok) {
      addInvoice({
        id: `INV-${Date.now()}`,
        invoiceNumber: inv.invoiceNo,
        client: inv.client,
        project: 'Billed',
        siteId: sites.find(s => s.name === inv.site)?.id || '',
        siteName: inv.site,
        amount: inv.totalCharge,
        date: inv.startDate,
        dueDate: inv.endDate || inv.startDate,
        billingCycle: 'Custom',
        reminderDate: '',
        status: 'Sent',
        vatInc: inv.vatInc,
        noOfMachine: inv.noOfMachine,
        dailyRentalCost: inv.dailyRentalCost,
        dieselCostPerLtr: inv.dieselCostPerLtr,
        dailyUsage: inv.dailyUsage,
        noOfTechnician: inv.noOfTechnician,
        techniciansDailyRate: inv.techniciansDailyRate,
        mobDemob: inv.mobDemob,
        installation: inv.installation,
        damages: inv.damages,
        duration: inv.duration,
        rentalCost: inv.rentalCost,
        dieselCost: inv.dieselCost,
        techniciansCost: inv.techniciansCost,
        totalCost: inv.totalCost,
        vat: inv.vat,
        totalCharge: inv.totalCharge,
        totalExclusiveOfVat: inv.totalExclusiveOfVat
      });
      deletePendingInvoice(inv.id);
      if (selectedId === inv.id) handleClear();
      toast.success('Moved to Active Invoices');
    }
  };

  const currentList = isViewingActive ? invoices : pendingInvoices;

  const uniqueClients = useMemo(() => Array.from(new Set(sites.map(s => s.client))), [sites]);
  const sitesForClient = useMemo(() => form.client ? sites.filter(s => s.client === form.client) : sites, [sites, form.client]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
                        Invoices
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage active and pending invoices.</p>
                </div>
            </div>
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button
            className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${!isViewingActive ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setIsViewingActive(false)}
          >
            Pending Invoices
            <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${!isViewingActive ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{pendingInvoices.length}</Badge>
          </button>
          <button
            className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${isViewingActive ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setIsViewingActive(true)}
          >
            Active Invoices
            <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${isViewingActive ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{invoices.length}</Badge>
          </button>
        </div>

        {priv.canCreate && (
          <Button
            className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
            onClick={() => { handleClear(); setIsModalOpen(true); }}
          >
            <Plus className="w-5 h-5" /> Add Invoice
          </Button>
        )}
      </div>

      {/* Main Table View */}
      <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0 min-h-[400px]">
        <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {isViewingActive ? 'Active Invoices' : 'Pending Invoices'}
            </h3>
            <Badge variant="secondary" className="ml-2 font-mono">{currentList.length}</Badge>
          </div>
          {!isViewingActive && <p className="text-xs text-slate-500">Double click row or click action arrow to transition to Active.</p>}
        </div>

        <div className="flex-1 overflow-x-auto">
          <Table className="whitespace-nowrap min-w-full text-xs sm:text-sm">
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="font-semibold px-4 py-3">Inv #</TableHead>
                <TableHead className="font-semibold px-4 py-3">Client / Site</TableHead>
                <TableHead className="font-semibold px-4 py-3 text-right">Equipment</TableHead>
                <TableHead className="font-semibold px-4 py-3 text-right">Dates & Dur</TableHead>
                <TableHead className="font-semibold px-4 py-3 text-right">Cost Bkdn</TableHead>
                <TableHead className="font-semibold px-4 py-3 text-right">Totals (₦)</TableHead>
                {(priv.canEdit || priv.canDelete) && (
                  <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentList.map((inv: any) => (
                <TableRow key={inv.id} onDoubleClick={() => { if (!isViewingActive) handleMakeActive(inv) }} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <TableCell className="px-4 py-3 font-mono font-bold text-slate-700">{inv.invoiceNo || inv.invoiceNumber}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">
                    <div className="font-semibold">{inv.client}</div>
                    <div className="text-slate-500 text-xs">{inv.site || inv.siteName} <span className="ml-1 px-1 rounded bg-slate-100 border text-[10px]">{inv.vatInc || 'No VAT'}</span></div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-600">
                    <div><span className="text-slate-400">Mac:</span> {inv.noOfMachine || 0} x {(inv.dailyRentalCost || 0).toLocaleString()}</div>
                    <div><span className="text-slate-400">Tech:</span> {inv.noOfTechnician || 0} x {(inv.techniciansDailyRate || 0).toLocaleString()}</div>
                    <div><span className="text-slate-400">DsLtr:</span> {(inv.dieselCostPerLtr || 0).toLocaleString()} ({(inv.dailyUsage || 0)}L)</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-600">
                    <div className="font-medium text-slate-800">{inv.duration || 0} Days</div>
                    <div className="text-slate-500 text-xs">{inv.startDate || inv.date} - {inv.endDate || inv.dueDate}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-600">
                    <div><span className="text-slate-400">Rent:</span> {(inv.rentalCost || 0).toLocaleString()}</div>
                    <div><span className="text-slate-400">Fuel:</span> {(inv.dieselCost || 0).toLocaleString()}</div>
                    <div><span className="text-slate-400">Other:</span> {((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0)).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="text-slate-500 text-xs">Gross: {(inv.totalCost || 0).toLocaleString()}</div>
                    <div className="text-slate-500 text-xs">VAT: {(inv.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="font-bold text-indigo-700 mt-1">{(inv.totalCharge || inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </TableCell>
                  {(priv.canEdit || priv.canDelete) && (
                    <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-center gap-1">
                        {!isViewingActive && priv.canEdit && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMakeActive(inv); }} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Move to Active">
                            <ArrowRightCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {priv.canEdit && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(inv); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit row">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {priv.canDelete && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete row">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {currentList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide">
                    No {isViewingActive ? 'active' : 'pending'} records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modern Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedId ? 'Edit Invoice' : 'Create Invoice'}</h2>
                <p className="text-xs text-slate-500">Auto-calculate totals by entering valid numbers.</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">

              <div className="space-y-1.5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg pb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-800">Destination</label>
                <select
                  value={form.destination}
                  onChange={e => handleChange('destination', e.target.value)}
                  className="flex h-11 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-semibold text-slate-700 shadow-sm"
                >
                  <option value="Pending">Pending Invoices</option>
                  <option value="Active">Active Invoices</option>
                </select>
                <p className="text-[11px] text-indigo-600 mt-1 pl-1">Select where you want this record to be inserted.</p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                  <Input type="date" value={form.startDate} onChange={e => handleChange('startDate', e.target.value)} className="bg-slate-50 h-11" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days)</label>
                  <Input type="number" min="0" value={form.duration} onChange={e => handleChange('duration', e.target.value)} className="bg-slate-50 h-11" />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice No</label>
                <Input type="text" value={form.invoiceNo} onChange={e => handleChange('invoiceNo', e.target.value)} placeholder="e.g. 144" className="bg-slate-50 font-semibold text-lg h-11" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
                  <select
                    value={form.client}
                    onChange={e => { handleChange('client', e.target.value); handleChange('site', ''); }}
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                  >
                    <option value="">Select Client...</option>
                    {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Site</label>
                  <select
                    value={form.site}
                    onChange={e => handleChange('site', e.target.value)}
                    disabled={!form.client}
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Site...</option>
                    {sitesForClient.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 pt-5 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Machines</label>
                  <Input type="number" min="0" value={form.noOfMachine} onChange={e => handleChange('noOfMachine', e.target.value)} className="bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily R. Cost</label>
                  <Input type="number" min="0" value={form.dailyRentalCost} onChange={e => handleChange('dailyRentalCost', e.target.value)} className="bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Technicians</label>
                  <Input type="number" min="0" value={form.noOfTechnician} onChange={e => handleChange('noOfTechnician', e.target.value)} className="bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Tech Rate</label>
                  <Input type="number" min="0" value={form.techniciansDailyRate} onChange={e => handleChange('techniciansDailyRate', e.target.value)} className="bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Usage (L)</label>
                  <Input type="number" min="0" value={form.dailyUsage} onChange={e => handleChange('dailyUsage', e.target.value)} className="bg-slate-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diesel / Ltr</label>
                  <Input type="number" min="0" value={form.dieselCostPerLtr} onChange={e => handleChange('dieselCostPerLtr', e.target.value)} className="bg-slate-50" />
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 block">Other Costs</label>
                <div className="grid grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mob/Demob</label>
                    <Input type="number" min="0" value={form.mobDemob} onChange={e => handleChange('mobDemob', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Install</label>
                    <Input type="number" min="0" value={form.installation} onChange={e => handleChange('installation', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Damages</label>
                    <Input type="number" min="0" value={form.damages} onChange={e => handleChange('damages', e.target.value)} className="bg-slate-50" />
                  </div>
                </div>
              </div>

              {/* Live Preview of Calculation */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="bg-slate-900 rounded-xl p-5 shadow-inner">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Live Auto-Calculation</span>
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider rounded-sm px-2 py-0 border-slate-700 ${livePreview.vatInc === 'Yes' ? 'text-indigo-400 bg-indigo-950/50' : livePreview.vatInc === 'Add' ? 'text-amber-400 bg-amber-950/50' : 'text-slate-400 bg-slate-800'}`}>
                      VAT: {livePreview.vatInc}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Gross Total</span>
                      <span className="font-mono text-slate-200 font-medium text-sm">₦{livePreview.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700 pl-4">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Tax (VAT {livePreview.vatInc})</span>
                      <span className="font-mono text-indigo-400 font-medium text-sm">₦{livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700 pl-4">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Final Amount Due</span>
                      <span className="font-mono text-emerald-400 font-bold text-lg leading-none">₦{livePreview.totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <Button variant="outline" className="flex-1 border-slate-300 h-11 text-slate-600 hover:bg-slate-100" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 shadow-md">
                <CheckCircle className="w-4 h-4" /> {selectedId ? 'Update Invoice' : 'Submit Invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
        </div>
    );
}
