import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Download, Plus, FileText, Send, MoreHorizontal, X, Save } from 'lucide-react';
import { useAppStore, Invoice } from '@/src/store/appStore';

export function Billing() {
  const [isAdding, setIsAdding] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    client: '',
    project: '',
    siteId: '',
    siteName: '',
    amount: 0,
    date: '',
    dueDate: '',
    billingCycle: 'Monthly' as 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Custom',
    reminderDate: '',
    status: 'Draft' as 'Draft' | 'Sent' | 'Paid' | 'Overdue'
  });
  
  const invoices = useAppStore((state) => state.invoices);
  const sites = useAppStore((state) => state.sites);
  const addInvoice = useAppStore((state) => state.addInvoice);
  const updateInvoice = useAppStore((state) => state.updateInvoice);
  const deleteInvoice = useAppStore((state) => state.deleteInvoice);

  // Calculate stats from store data
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'Paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const overdueAmount = invoices
    .filter(inv => inv.status === 'Overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const paidThisMonth = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const draftAmount = invoices
    .filter(inv => inv.status === 'Draft')
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Generate truly unique invoice number based on existing invoices
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const yearInvoices = invoices.filter(inv => inv.id.includes(year.toString()));
    const maxNum = yearInvoices.reduce((max, inv) => {
      const num = parseInt(inv.id.split('-').pop() || '0');
      return num > max ? num : max;
    }, 0);
    return `INV-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const handleCreateInvoice = () => {
    if (!newInvoice.client || !newInvoice.amount || !newInvoice.date) {
      alert("Client, Amount, and Date are required.");
      return;
    }
    
    const invoice: Invoice = {
      id: generateInvoiceNumber(),
      invoiceNumber: generateInvoiceNumber(),
      client: newInvoice.client,
      project: newInvoice.project,
      siteId: newInvoice.siteId,
      siteName: newInvoice.siteName,
      amount: newInvoice.amount,
      date: newInvoice.date,
      dueDate: newInvoice.dueDate || newInvoice.date,
      billingCycle: newInvoice.billingCycle,
      reminderDate: newInvoice.reminderDate,
      status: newInvoice.status
    };
    
    addInvoice(invoice);
    setIsAdding(false);
    setNewInvoice({ client: '', project: '', siteId: '', siteName: '', amount: 0, date: '', dueDate: '', billingCycle: 'Monthly', reminderDate: '', status: 'Draft' });
  };

  const handleSendInvoice = (invoice: Invoice) => {
    // Show email compose modal with professional write-up
    const emailContent = `
Dear ${invoice.client},

RE: INVOICE NOTIFICATION - ${invoice.invoiceNumber || invoice.id}

We hope this message finds you well. Please find below the details of your invoice for the services rendered.

========================================
INVOICE DETAILS
========================================
Invoice Number: ${invoice.invoiceNumber || invoice.id}
Project: ${invoice.project}
Site: ${invoice.siteName || 'N/A'}
Billing Cycle: ${invoice.billingCycle}

Issue Date: ${invoice.date}
Due Date: ${invoice.dueDate}

AMOUNT DUE: ₦${invoice.amount.toLocaleString()}
========================================

Payment is due by ${invoice.dueDate}. Please make payment to the bank account details provided in our contract.

For your convenience, we have also attached the detailed invoice document for your records.

If you have any questions regarding this invoice or require any clarification, please don't hesitate to contact us.

Thank you for your continued business. We look forward to serving you.

Best regards,
Finance Team
    `.trim();
    
    // Open email client with pre-filled content
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber || invoice.id} - Payment Due`);
    const body = encodeURIComponent(emailContent);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    
    // Also update status
    updateInvoice(invoice.id, { status: 'Sent' });
  };

  const handleDeleteInvoice = (id: string) => {
    if (confirm("Are you sure you want to delete this invoice?")) {
      deleteInvoice(id);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Client Billing</h1>
          <p className="text-slate-500 mt-2">Manage invoices, track payments, and export to accounting.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export to QuickBooks
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-t-4 border-t-indigo-600 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 flex flex-row justify-between items-center">
            <CardTitle className="text-indigo-900 text-xl">Create New Invoice</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Client</label>
                <Input 
                  placeholder="e.g. Acme Corp" 
                  value={newInvoice.client} 
                  onChange={(e) => setNewInvoice({...newInvoice, client: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Project</label>
                <Input 
                  placeholder="e.g. Website Redesign" 
                  value={newInvoice.project} 
                  onChange={(e) => setNewInvoice({...newInvoice, project: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Site</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newInvoice.siteId}
                  onChange={(e) => {
                    const site = sites.find(s => s.id === e.target.value);
                    setNewInvoice({...newInvoice, siteId: e.target.value, siteName: site?.name || ''});
                  }}
                >
                  <option value="">Select Site (Optional)</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name} - {site.client}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Amount (₦)</label>
                <Input 
                  type="number"
                  placeholder="e.g. 1000000" 
                  value={newInvoice.amount || ''} 
                  onChange={(e) => setNewInvoice({...newInvoice, amount: parseFloat(e.target.value) || 0})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Billing Cycle</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newInvoice.billingCycle}
                  onChange={(e) => setNewInvoice({...newInvoice, billingCycle: e.target.value as any})}
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Issue Date</label>
                <Input 
                  type="date"
                  value={newInvoice.date} 
                  onChange={(e) => setNewInvoice({...newInvoice, date: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Due Date</label>
                <Input 
                  type="date"
                  value={newInvoice.dueDate} 
                  onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Reminder Date</label>
                <Input 
                  type="date"
                  value={newInvoice.reminderDate} 
                  onChange={(e) => setNewInvoice({...newInvoice, reminderDate: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newInvoice.status}
                  onChange={(e) => setNewInvoice({...newInvoice, status: e.target.value as any})}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={handleCreateInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Save className="h-4 w-4" /> Create Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₦{totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Across {invoices.filter(inv => inv.status !== 'Paid').length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₦{overdueAmount.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">{invoices.filter(inv => inv.status === 'Overdue').length} invoice(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Paid This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₦{paidThisMonth.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">{invoices.filter(inv => inv.status === 'Paid').length} invoice(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₦{draftAmount.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">{invoices.filter(inv => inv.status === 'Draft').length} invoice(s) pending review</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs font-medium text-slate-900">{invoice.id}</TableCell>
                  <TableCell className="font-medium">{invoice.client}</TableCell>
                  <TableCell className="text-slate-500">{invoice.project}</TableCell>
                  <TableCell className="font-mono font-medium">₦{invoice.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-500">{invoice.date}</TableCell>
                  <TableCell className="text-slate-500">{invoice.dueDate}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        invoice.status === 'Paid' ? 'success' : 
                        invoice.status === 'Overdue' ? 'destructive' : 
                        invoice.status === 'Sent' ? 'secondary' : 'outline'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {invoice.status === 'Draft' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-indigo-600" 
                          title="Send"
                          onClick={() => handleSendInvoice(invoice)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-slate-500" title="View PDF">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500"
                        title="Delete"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
