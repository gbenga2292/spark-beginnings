import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Search, Plus, Building, User, CalendarDays, FileText, CheckCircle2, ChevronDown, ListFilter, PlaySquare, X } from 'lucide-react';
import { useAppStore, LeaveRecord, Employee } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { addDays, parseISO, format } from 'date-fns';

export function Leaves() {
    const { employees, leaves, addLeave, updateLeave, deleteLeave } = useAppStore();
    const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active' || e.status === 'On Leave'), [employees]);

    const [showForm, setShowForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterView, setFilterView] = useState<'All' | 'Active' | 'Completed'>('All');

    // Form State
    const [formId, setFormId] = useState<string | null>(null);
    const [staffId, setStaffId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [duration, setDuration] = useState('');
    const [reason, setReason] = useState('');
    const [dateReturned, setDateReturned] = useState('');
    const [canBeContacted, setCanBeContacted] = useState<'Yes' | 'No'>('No');

    // Calculate Expected End Date based on Start Date and Duration (excluding weekends if that's standard, but here just simple addition)
    const expectedEndDate = useMemo(() => {
        if (startDate && duration) {
            const days = parseInt(duration);
            if (!isNaN(days) && days > 0) {
                return format(addDays(parseISO(startDate), days), 'yyyy-MM-dd');
            }
        }
        return '';
    }, [startDate, duration]);

    const filteredLeaves = useMemo(() => {
        let result = leaves;
        if (filterView === 'Active') {
            result = result.filter(l => !l.dateReturned);
        } else if (filterView === 'Completed') {
            result = result.filter(l => !!l.dateReturned);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(l =>
                l.employeeName.toLowerCase().includes(q) ||
                l.reason.toLowerCase().includes(q)
            );
        }
        return result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [leaves, filterView, searchQuery]);

    const handleCreateOrUpdate = () => {
        if (!staffId || !startDate || !duration || !reason) {
            toast.error('Please fill in all required fields (Staff, Start Date, Duration, Reason).');
            return;
        }

        const emp = employees.find(e => e.id === staffId);
        if (!emp) {
            toast.error('Employee not found.');
            return;
        }

        if (formId) {
            updateLeave(formId, {
                startDate,
                duration: parseInt(duration),
                expectedEndDate,
                reason,
                dateReturned,
                canBeContacted,
            });
            toast.success('Leave entry updated successfully!');
        } else {
            addLeave({
                id: `LV-${Date.now()}`,
                employeeId: staffId,
                employeeName: `${emp.surname} ${emp.firstname}`,
                startDate,
                duration: parseInt(duration),
                expectedEndDate,
                reason,
                dateReturned,
                canBeContacted,
            });
            toast.success('Leave form submitted successfully!');
        }

        setShowForm(false);
        resetForm();
    };

    const resetForm = () => {
        setFormId(null);
        setStaffId('');
        setStartDate('');
        setDuration('');
        setReason('');
        setDateReturned('');
        setCanBeContacted('No');
    };

    const handleEdit = (leave: LeaveRecord) => {
        setFormId(leave.id);
        setStaffId(leave.employeeId);
        setStartDate(leave.startDate);
        setDuration(leave.duration.toString());
        setReason(leave.reason);
        setDateReturned(leave.dateReturned || '');
        setCanBeContacted(leave.canBeContacted);
        setShowForm(true);
    };

    const totalLeavesActive = leaves.filter(l => !l.dateReturned).length;

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

            {/* Header section with sleek styling */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-teal-400">
                        Staff Leave Summary
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage and track employee absences, vacations, and sick leaves.</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        className="gap-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-md transition-all whitespace-nowrap"
                        onClick={() => { resetForm(); setShowForm(true); }}
                    >
                        <Plus className="h-4 w-4" />
                        File Leave Entry
                    </Button>
                </div>
            </div>

            {/* Form Overlay Area */}
            {showForm && (
                <Card className="border-none shadow-2xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10 w-full max-w-2xl mx-auto">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 sm:px-8 flex flex-row justify-between items-center">
                        <div>
                            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CalendarDays className="h-5 w-5 text-teal-500" /> {formId ? 'Edit Leave Form' : 'Staff Leave Entry Form'}
                            </CardTitle>
                            <CardDescription className="mt-1 pb-0">Fill out this entry form to log employee absences.</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => { setShowForm(false); resetForm(); }}>
                            <X className="h-5 w-5 text-slate-500" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 sm:p-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff <span className="text-rose-500">*</span></label>
                                <select
                                    className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                                    value={staffId} onChange={e => setStaffId(e.target.value)} disabled={!!formId}
                                >
                                    <option value="" disabled>--- Select Staff Member ---</option>
                                    {activeEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.department})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start of Leave <span className="text-rose-500">*</span></label>
                                <Input type="date" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days) <span className="text-rose-500">*</span></label>
                                <Input type="number" min="1" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 5" />
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Expected End of Leave</label>
                                <Input className="h-11 bg-slate-100 border-slate-200 text-slate-500 font-medium cursor-not-allowed" value={expectedEndDate} disabled readOnly placeholder="Auto-calculated..." />
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason for Leave <span className="text-rose-500">*</span></label>
                                <textarea
                                    className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-3 h-24 focus:bg-white focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"
                                    value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter details regarding this leave..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    Date Returned <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-700 text-[10px] font-bold">OPTIONAL</span>
                                </label>
                                <Input type="date" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={dateReturned} onChange={e => setDateReturned(e.target.value)} />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Can be contacted during leave?</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                        <input type="radio" className="accent-teal-600 w-4 h-4" checked={canBeContacted === 'Yes'} onChange={() => setCanBeContacted('Yes')} />
                                        Yes
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                        <input type="radio" className="accent-teal-600 w-4 h-4" checked={canBeContacted === 'No'} onChange={() => setCanBeContacted('No')} />
                                        No
                                    </label>
                                </div>
                            </div>

                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-medium sm:mr-auto h-11" onClick={resetForm}>
                                Clear Form
                            </Button>
                            <Button variant="outline" className="text-slate-600 font-medium h-11" onClick={() => setShowForm(false)}>
                                View Entries
                            </Button>
                            <Button onClick={handleCreateOrUpdate} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11 px-8 shadow-md">
                                Submit Entry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Datatable Card */}
            <Card className="border-none shadow-sm overflow-hidden bg-white flex-1 flex flex-col min-h-[500px]">
                {/* Table Filters & Header */}
                <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
                    <div className="flex items-center gap-2 ml-1">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
                            <ListFilter className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">Leave Forms Database <span className="text-slate-400 font-normal">({filteredLeaves.length})</span></p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            {(['All', 'Active', 'Completed'] as const).map(tab => (
                                <button
                                    key={tab}
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${filterView === tab ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setFilterView(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search staff or reason..."
                                className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Table Datagrid */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-teal-700 border-b border-teal-800 text-teal-50 uppercase text-[11px] tracking-wider font-bold">
                                <th className="px-5 py-4 whitespace-nowrap rounded-tl-lg">Name</th>
                                <th className="px-5 py-4 whitespace-nowrap">Start of Leave</th>
                                <th className="px-5 py-4 whitespace-nowrap">Duration</th>
                                <th className="px-5 py-4 whitespace-nowrap">Expected End of Leave</th>
                                <th className="px-5 py-4 min-w-[300px]">Reason for Leave</th>
                                <th className="px-5 py-4 whitespace-nowrap">Date Returned</th>
                                <th className="px-5 py-4 whitespace-nowrap text-center">Contactable</th>
                                <th className="px-5 py-4 whitespace-nowrap rounded-tr-lg">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredLeaves.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <CalendarDays className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <p>No leave records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLeaves.map(leave => (
                                    <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-4 font-bold text-slate-800 uppercase text-xs">{leave.employeeName}</td>
                                        <td className="px-5 py-4 font-medium text-slate-600">{format(parseISO(leave.startDate), 'dd-MM-yy')}</td>
                                        <td className="px-5 py-4 font-bold text-slate-700">{leave.duration}</td>
                                        <td className="px-5 py-4 font-medium-text-slate-600">{format(parseISO(leave.expectedEndDate), 'dd-MM-yyyy')}</td>
                                        <td className="px-5 py-4 max-w-xs text-slate-700">
                                            <span className={`inline-block border px-3 py-2 rounded border-teal-600/30 text-xs font-medium`}>{leave.reason}</span>
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-600">
                                            {leave.dateReturned ? format(parseISO(leave.dateReturned), 'dd-MM-yy') : '-'}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`text-xs font-bold ${leave.canBeContacted === 'Yes' ? 'text-teal-600' : 'text-slate-400'}`}>{leave.canBeContacted}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => handleEdit(leave)}>
                                                Edit
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

        </div>
    );
}
