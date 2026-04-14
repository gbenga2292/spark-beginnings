import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useAppStore, CompanyExpense } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { FileText, Plus, Trash2, Search, Filter, CheckSquare, X, Send, History, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function CompanyExpenses() {
  const navigate = useNavigate();
  const priv = usePriv('ledger'); // using ledger priv as it's an account feature
  const currentUser = useUserStore((s) => s.getCurrentUser());

  const expenses = useAppStore((s) => s.companyExpenses);
  const addExpense = useAppStore((s) => s.addCompanyExpense);
  const updateExpense = useAppStore((s) => s.updateCompanyExpense);
  const deleteExpense = useAppStore((s) => s.deleteCompanyExpense);
  const setPendingLedgerEntries = useAppStore((s) => s.setPendingLedgerEntries);
  
  const ledgerBanks = useAppStore((s) => s.ledgerBanks);
  const ledgerBeneficiaryBanks = useAppStore((s) => s.ledgerBeneficiaryBanks);

  const sortedBanks = useMemo(() => [...ledgerBanks].sort((a, b) => a.name.localeCompare(b.name)), [ledgerBanks]);
  const sortedBeneficiaryBanks = useMemo(() => [...ledgerBeneficiaryBanks].sort((a, b) => a.name.localeCompare(b.name)), [ledgerBeneficiaryBanks]);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState('');
  const [paidToBankName, setPaidToBankName] = useState('');
  const [paidToAccountNo, setPaidToAccountNo] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [isFormVisible, setIsFormVisible] = useState(false);

  const [search, setSearch] = useState('');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // We can fetch ledgerCategories to allow category selection right here
  const ledgerCategories = useAppStore((s) => s.ledgerCategories);
  const sortedCategories = useMemo(() => [...ledgerCategories].sort((a, b) => a.name.localeCompare(b.name)), [ledgerCategories]);

  const clearForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setAmount('');
    setPaidFrom('');
    setPaidToBankName('');
    setPaidToAccountNo('');
    setIsFormVisible(false);
  };

  const handleEditClick = async (expense: CompanyExpense) => {
    if (!priv?.canAdd) return;
    
    setIsFormVisible(true);
    // Check for unsaved changes before overwriting form
    if (description || amount || paidFrom || paidToBankName || paidToAccountNo) {
      if (editingId !== expense.id) {
        const confirm = await showConfirm('You have unsaved changes in the form. Do you want to discard them to edit this expense?', { variant: 'danger', confirmLabel: 'Yes, Discard' });
        if (!confirm) return;
      }
    }
    
    setEditingId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setPaidFrom(expense.paidFrom);
    setPaidToBankName(expense.paidToBankName);
    setPaidToAccountNo(expense.paidToAccountNo);
  };
  
  if (!priv?.canView) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center rounded-lg border bg-card p-8">
          <FileText className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priv?.canAdd) {
      toast.error('You do not have permission to add/edit expenses.');
      return;
    }

    if (!description || !amount || parseFloat(amount) <= 0 || !paidFrom || !paidToBankName || !paidToAccountNo) {
      toast.error('Please fill all required fields correctly.');
      return;
    }

    if (editingId) {
      updateExpense(editingId, {
        date,
        description,
        amount: parseFloat(amount),
        paidFrom,
        paidToBankName,
        paidToAccountNo
      });
      toast.success('Company expense updated successfully.');
      clearForm();
    } else {
      const payload: CompanyExpense = {
        id: crypto.randomUUID(),
        date,
        description,
        amount: parseFloat(amount),
        paidFrom,
        paidToBankName,
        paidToAccountNo,
        enteredBy: currentUser?.name || 'Unknown',
        createdAt: new Date().toISOString(),
        status: 'Pending'
      };

      addExpense(payload);
      toast.success('Company expense added successfully.');
      clearForm();
    }
  };

  const handleBeneficiaryBankChange = (bankName: string) => {
    setPaidToBankName(bankName);
    const bank = ledgerBeneficiaryBanks.find(b => b.name === bankName);
    if (bank) {
      setPaidToAccountNo(bank.accountNo);
    }
  };

  const handleDelete = async (id: string) => {
    if (!priv?.canDelete) return;
    const confirmed = await showConfirm('Are you sure you want to delete this expense record?', { variant: 'danger' });
    if (confirmed) {
      deleteExpense(id);
      if (editingId === id) clearForm();
      if (selectedIds.has(id)) {
        const next = new Set(selectedIds);
        next.delete(id);
        setSelectedIds(next);
      }
      toast.success('Expense deleted.');
    }
  };

  const filteredExpenses = useMemo(() => {
    const isHistoryTab = tab === 'history';
    let base = expenses.filter(e => {
        if (isHistoryTab) return e.status === 'Saved to Ledger';
        return !e.status || e.status === 'Pending';
    });
    
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(e => 
      e.description.toLowerCase().includes(q) ||
      e.paidToBankName.toLowerCase().includes(q) ||
      e.paidToAccountNo.toLowerCase().includes(q) ||
      e.paidFrom.toLowerCase().includes(q)
    );
  }, [expenses, search, tab]);

  const toggleSelection = (id: string) => {
    if (tab === 'history') return; // Cannot select history items for ledger
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 8) {
          toast.error('You cannot select more than 8 expenses at a time.');
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (tab === 'history') return;
    if (selectedIds.size === Math.min(filteredExpenses.length, 8) && filteredExpenses.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExpenses.slice(0, 8).map(e => e.id)));
    }
  };

  const handleBulkAddToLedger = () => {
    if (selectedIds.size === 0) return;
    
    // Pass selected expenses to Ledger via global store
    const selectedExpenses = expenses.filter(ex => selectedIds.has(ex.id));
    setPendingLedgerEntries(selectedExpenses);
    
    // Reset selection and navigate to Ledger
    setSelectedIds(new Set());
    navigate('/ledger');
  };

  useSetPageTitle(
    'Company Expenses',
    'Manage and track company expenses and bank transfers',
    <div className="flex items-center gap-2">
      <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shadow-sm backdrop-blur-sm mr-2 hidden sm:flex">
         <button 
           onClick={() => { setTab('pending'); setSelectedIds(new Set()); }} 
           className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${
             tab === 'pending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
           }`}
         >
           <Filter className="h-3 w-3" /> Pending
         </button>
         <button 
           onClick={() => { setTab('history'); setSelectedIds(new Set()); }} 
           className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${
             tab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
           }`}
         >
           <History className="h-3 w-3" /> History
         </button>
      </div>
      {tab === 'pending' && selectedIds.size > 0 && (
        <Button size="sm" onClick={handleBulkAddToLedger} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-semibold px-3 flex items-center gap-1.5 shadow-sm">
          <Send className="w-3.5 h-3.5" /> Continue to Ledger ({selectedIds.size})
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 fade-in">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mobile Form Toggle Button */}
        <div className="lg:hidden text-center">
          <Button 
            onClick={() => setIsFormVisible(!isFormVisible)} 
            variant={isFormVisible ? "outline" : "default"} 
            className={`w-full font-bold shadow-sm transition-all ${!isFormVisible ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-slate-600 border-slate-300 bg-white hover:bg-slate-50'}`}
          >
            {isFormVisible ? <><X className="w-4 h-4 mr-2" /> Hide Expense Form</> : <><Plus className="w-4 h-4 mr-2" /> Log New Expense</>}
          </Button>
        </div>

        {/* Form Column */}
        <div className={`lg:col-span-1 transition-all duration-300 ${isFormVisible ? 'block animate-in slide-in-from-top-4' : 'hidden lg:block'}`}>
          <Card className={`border-slate-200 shadow-sm overflow-hidden group transition-all duration-300 ${editingId ? 'ring-2 ring-amber-500' : ''}`}>
            <div className={`h-1.5 w-full ${editingId ? 'bg-amber-500' : 'bg-indigo-600'}`}></div>
            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{editingId ? 'Edit Expense' : 'Log New Expense'}</CardTitle>
                <CardDescription>{editingId ? 'Modify the selected expense' : 'Fill out the details below'}</CardDescription>
              </div>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={clearForm} className="text-slate-400 hover:text-slate-700 h-8 px-2 flex-shrink-0">
                   <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </CardHeader>
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Date</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Description</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} required placeholder="Transaction purpose..." className="w-full bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Amount (₦)</label>
                  <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className="w-full bg-slate-50 border-slate-200 focus:bg-white" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Paid From (Bank)</label>
                  <select 
                    className="w-full flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={paidFrom} 
                    onChange={e => setPaidFrom(e.target.value)} 
                    required
                  >
                    <option value="" disabled>Select Bank...</option>
                    {sortedBanks.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Paid To (Bank)</label>
                    <select 
                      className="w-full flex h-10 items-center justify-between rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={paidToBankName} 
                      onChange={e => handleBeneficiaryBankChange(e.target.value)} 
                      required
                    >
                      <option value="" disabled>Select Beneficiary...</option>
                      {sortedBeneficiaryBanks.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Account No</label>
                    <Input value={paidToAccountNo} onChange={e => setPaidToAccountNo(e.target.value)} required placeholder="Account Number" className="w-full bg-slate-50 border-slate-200 focus:bg-white" />
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={!priv?.canAdd} className={`w-full font-semibold transition-all shadow-sm ${editingId ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    {editingId ? <><Pencil className="w-4 h-4 mr-2" /> Update Expense</> : <><Plus className="w-4 h-4 mr-2" /> Log Expense</>}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 flex flex-col min-h-[500px]">
          {/* Mobile Tab Toggle */}
          <div className="flex sm:hidden mb-4 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 shadow-sm relative w-full h-11 shrink-0">
             <button 
               onClick={() => { setTab('pending'); setSelectedIds(new Set()); }} 
               className={`flex-1 rounded-md text-[11px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                 tab === 'pending' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
               }`}
             >
               <Filter className="h-3.5 w-3.5" /> Pending
             </button>
             <button 
               onClick={() => { setTab('history'); setSelectedIds(new Set()); }} 
               className={`flex-1 rounded-md text-[11px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                 tab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
               }`}
             >
               <History className="h-3.5 w-3.5" /> History
             </button>
          </div>

          <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  {tab === 'history' ? <History className="w-4 h-4 text-slate-400" /> : <Filter className="w-4 h-4 text-slate-400" />}
                  {tab === 'history' ? 'Ledger History' : 'Recent Expenses'}
                </h3>
                {tab === 'pending' && selectedIds.size > 0 && (
                  <Button size="sm" onClick={handleBulkAddToLedger} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold px-3 hidden sm:flex">
                    <Send className="w-3 h-3 mr-1.5" /> Continue to Ledger ({selectedIds.size})
                  </Button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {tab === 'pending' && selectedIds.size > 0 && (
                  <Button size="sm" onClick={handleBulkAddToLedger} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full h-8 text-xs font-semibold px-3 sm:hidden">
                    <Send className="w-3 h-3 mr-1.5" /> Continue to Ledger ({selectedIds.size})
                  </Button>
                )}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search expenses..." 
                    className="pl-9 h-9 border-slate-200 bg-slate-50 focus:bg-white text-sm" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            
            {tab === 'pending' && (
              <div className="bg-slate-50 border-b border-slate-100 flex items-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-3 flex-1">
                  <button onClick={toggleAll} className="p-0.5 mt-0.5 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-slate-400 hover:text-indigo-600 transition-colors">
                    <CheckSquare className={`w-4 h-4 ${selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0 ? 'text-indigo-600' : ''}`} />
                  </button>
                  <span>Select All (Up to 8)</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto bg-slate-50/50 p-2 md:p-4">
              {filteredExpenses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-10">
                  <div className="p-4 bg-white rounded-full shadow-sm">
                    <FileText className="h-8 w-8 text-slate-300" />
                  </div>
                  <p>{tab === 'history' ? 'No history available.' : 'No expenses found. Log one to get started.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredExpenses.map((expense) => {
                    const isSelected = selectedIds.has(expense.id);
                    const isEditing = editingId === expense.id;
                    return (
                    <div 
                      key={expense.id} 
                      className={`bg-white p-4 rounded-xl border shadow-sm transition-all group ${tab === 'pending' ? 'cursor-pointer' : 'cursor-default'} ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-slate-200 hover:shadow-md hover:border-indigo-200'} ${isEditing ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
                      onClick={() => tab === 'pending' && toggleSelection(expense.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 flex gap-3">
                          {tab === 'pending' && (
                            <div className="pt-0.5">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          )}
                          <div className={tab === 'history' ? 'pl-1' : ''}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                {expense.date.split('-').reverse().join('/')}
                              </span>
                              <span className="text-xs font-semibold text-slate-400">
                                By: {expense.enteredBy}
                              </span>
                              {tab === 'history' && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md uppercase tracking-widest ml-1">
                                  Saved to Ledger
                                </span>
                              )}
                            </div>
                          <h4 className="font-semibold text-slate-800 text-base leading-tight break-all sm:break-normal">{expense.description}</h4>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <span className="text-red-500 font-medium whitespace-nowrap">From:</span>
                              <span className="font-semibold text-slate-700">{expense.paidFrom}</span>
                            </div>
                            <span className="text-slate-300">→</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-500 font-medium whitespace-nowrap">To:</span>
                              <span className="font-semibold text-slate-700">{expense.paidToBankName}</span>
                              <span className="text-xs font-medium text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50 break-all w-24 sm:w-auto">
                                {expense.paidToAccountNo}
                              </span>
                            </div>
                          </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                          <div className="text-lg font-bold text-slate-900 bg-slate-100/80 px-3 py-1 rounded-lg shrink-0">
                            ₦{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {tab === 'pending' && priv?.canAdd && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditClick(expense); }}
                                className={`p-1.5 rounded-md transition-colors ${isEditing ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                title="Edit Expense"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {priv?.canDelete && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
