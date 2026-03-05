import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { useAppStore, AttendanceRecord } from '@/src/store/appStore';
import { Search, Save, Trash2, Calendar as CalendarIcon, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { format } from 'date-fns';

export function Attendance() {
  const employees = useAppStore((state) => state.employees);
  const sites = useAppStore((state) => state.sites);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const addAttendanceRecords = useAppStore((state) => state.addAttendanceRecords);
  const removeAttendanceRecordsByDate = useAppStore((state) => state.removeAttendanceRecordsByDate);

  const [registerDate, setRegisterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lastEntryDate, setLastEntryDate] = useState(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('entry');
  
  // State for the current form
  const [attendanceData, setAttendanceData] = useState<Record<string, { day: string, night: string }>>({});

  const statuses = [
    "Absent",
    "Absent with Permit",
    "Absent without Permit",
    "Sick Leave",
    "Maternity Leave",
    "Annual Leave",
    "Suspension",
    "Public Holiday",
    "Off Duty",
    "No Work"
  ];

  // Auto-load existing records when date changes
  useEffect(() => {
    const existingRecords = attendanceRecords.filter(r => r.date === registerDate);
    if (existingRecords.length > 0) {
      const loadedData: Record<string, { day: string, night: string }> = {};
      existingRecords.forEach(r => {
        loadedData[r.staffId] = {
          day: r.daySite || r.absentStatus || '',
          night: r.nightSite || (r.absentStatus && !r.daySite ? r.absentStatus : '')
        };
      });
      setAttendanceData(loadedData);
    } else {
      setAttendanceData({});
    }
  }, [registerDate, attendanceRecords]);

  const filteredEmployees = employees.filter(emp => 
    emp.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.firstname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectChange = (empId: string, shift: 'day' | 'night', value: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [shift]: value
      }
    }));
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the current form?')) {
      setAttendanceData({});
    }
  };

  const isAbsentStatus = (txt: string) => {
    const upper = txt.toUpperCase();
    return ["ABSENT", "ABSENT WITH PERMIT", "ABSENT WITHOUT PERMIT", "ON LEAVE", "NO WORK", "SICK LEAVE", "MATERNITY LEAVE", "ANNUAL LEAVE", "SUSPENSION", "PUBLIC HOLIDAY", "OFF DUTY"].includes(upper);
  };

  const applyOverride = (src: string, currentSite: string, currentShift: string, currentReason: string) => {
    if (!src) return { site: currentSite, shift: currentShift, reason: currentReason };
    const upperSrc = src.toUpperCase();
    if (["ABSENT", "NO WORK", "ABSENT WITHOUT PERMIT", "SUSPENSION", "OFF DUTY"].includes(upperSrc)) {
        return { site: src, shift: "No", reason: src };
    }
    if (["ABSENT WITH PERMIT", "ON LEAVE", "SICK LEAVE", "MATERNITY LEAVE", "ANNUAL LEAVE", "PUBLIC HOLIDAY"].includes(upperSrc)) {
        return { site: src, shift: "Yes", reason: src };
    }
    return { site: src, shift: "Yes", reason: currentReason };
  };

  const handleSubmit = () => {
    const existingRecords = attendanceRecords.filter(r => r.date === registerDate);
    if (existingRecords.length > 0) {
      if (!confirm(`Entries already exist for ${registerDate}. Click OK to overwrite them, or Cancel to abort.`)) {
        return;
      }
      removeAttendanceRecordsByDate(registerDate);
    }

    const records: AttendanceRecord[] = [];
    
    // Simple public holidays list for OT calculation (mocked based on screenshot)
    const publicHolidays = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-03-20', '2026-03-21', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-27', '2026-05-28', '2026-06-12', '2026-08-26', '2026-10-01', '2026-12-25'];

    const dateObj = new Date(registerDate);
    const dow = dateObj.getDay(); // 0 is Sunday
    const isSunday = dow === 0;
    const isHoliday = publicHolidays.includes(registerDate);
    const fillData = !(isSunday || isHoliday);

    employees.forEach(emp => {
      const formDaySite = attendanceData[emp.id]?.day || '';
      const formNightSite = attendanceData[emp.id]?.night || '';

      let staffHasWorkEntry = false;
      if (formDaySite && !isAbsentStatus(formDaySite)) staffHasWorkEntry = true;
      if (formNightSite && !isAbsentStatus(formNightSite)) staffHasWorkEntry = true;

      // Skip if it's a Sunday/Holiday and they didn't explicitly work
      if (!fillData && !staffHasWorkEntry) return;

      let daySite = fillData ? "Office" : "";
      let nightSite = "";
      let dayShift = fillData ? "Yes" : "No";
      let nightShift = "No";
      let absentReason = "";

      const dayOverride = applyOverride(formDaySite, daySite, dayShift, absentReason);
      daySite = dayOverride.site;
      dayShift = dayOverride.shift;
      absentReason = dayOverride.reason;

      const nightOverride = applyOverride(formNightSite, nightSite, nightShift, absentReason);
      nightSite = nightOverride.site;
      nightShift = nightOverride.shift;
      absentReason = nightOverride.reason;

      // Clear site names if they are actually statuses
      const finalDaySite = isAbsentStatus(daySite) ? '' : daySite;
      const finalNightSite = isAbsentStatus(nightSite) ? '' : nightSite;

      const dayClient = sites.find(s => s.name === finalDaySite)?.client || '';
      const nightClient = sites.find(s => s.name === finalNightSite)?.client || '';

      const mth = dateObj.getMonth() + 1;

      // Basic OT logic: if weekend (6=Sat, 0=Sun) or public holiday, and they worked
      let ot = 0;
      let otSite = '';
      
      if ((dow === 6 || dow === 0 || isHoliday) && (dayShift === 'Yes' || nightShift === 'Yes')) {
         ot = 0.5; // Emulating the 0.5 OT rate from the screenshot
         otSite = finalDaySite || finalNightSite;
      }

      records.push({
         id: crypto.randomUUID(),
         date: registerDate,
         staffId: emp.id,
         staffName: `${emp.surname} ${emp.firstname}`,
         position: emp.position,
         dayClient,
         daySite: finalDaySite,
         nightClient,
         nightSite: finalNightSite,
         day: dayShift as 'Yes'|'No',
         night: nightShift as 'Yes'|'No',
         absentStatus: absentReason,
         nightWk: nightShift === 'Yes' ? 1 : 0,
         ot,
         otSite,
         dayWk: dayShift === 'Yes' ? 1 : 0,
         dow: dow === 0 ? 7 : dow, // Match Excel DOW (1-7, Mon-Sun)
         ndw: (dow > 0 && dow < 6 && absentReason === '' && !isHoliday) ? 'Yes' : 'No',
         mth,
         isPresent: (dayShift === 'Yes' || nightShift === 'Yes') ? 'Yes' : 'No',
         day2: dayShift === 'Yes' ? 1 : 0
      });
    });

    if (records.length === 0) {
      alert("No attendance data selected to submit.");
      return;
    }

    addAttendanceRecords(records);
    setLastEntryDate(registerDate);
    alert(`Successfully saved ${records.length} records to the database!`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily Register</h1>
          <p className="text-slate-500 mt-1">Manage daily attendance, site allocation, and shifts.</p>
        </div>
      </div>

      <Tabs className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger 
            active={activeTab === 'entry'} 
            onClick={() => setActiveTab('entry')} 
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" /> Entry Form
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === 'database'} 
            onClick={() => setActiveTab('database')} 
            className="gap-2"
          >
            <Database className="h-4 w-4" /> Database View
          </TabsTrigger>
        </TabsList>

        <TabsContent active={activeTab === 'entry'} className="mt-6">
          <Card className="border-t-4 border-t-[#002040] shadow-md">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-[#002040] rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-inner">
                    DC
                  </div>
                  <div>
                    <CardTitle className="text-[#002040] text-xl">Dewatering Construction</CardTitle>
                    <CardDescription>Daily Attendance & Site Allocation</CardDescription>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
                  <div className="flex flex-col w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase">Last Entry Date</span>
                    <span className="text-sm font-medium text-slate-900">{lastEntryDate}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                  <div className="flex flex-col w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase">Current Date</span>
                    <Input 
                      type="date" 
                      value={registerDate}
                      onChange={(e) => setRegisterDate(e.target.value)}
                      className="h-8 text-sm border-slate-300 w-full sm:w-36"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search staff..."
                    className="pl-9 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button onClick={handleClear} variant="outline" className="flex-1 sm:flex-none gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Clear
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1 sm:flex-none gap-2 bg-[#002040] hover:bg-[#003060] text-white shadow-md">
                    <Save className="h-4 w-4" /> Submit Register
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#002040]">
                    <TableRow className="hover:bg-[#002040]">
                      <TableHead className="text-white font-semibold py-3 min-w-[150px]">Staff Name</TableHead>
                      <TableHead className="text-white font-semibold py-3 min-w-[120px]">Position</TableHead>
                      <TableHead className="text-white font-semibold py-3 border-l border-white/20 min-w-[150px]">Day Site / Status</TableHead>
                      <TableHead className="text-white font-semibold py-3 border-l border-white/20 min-w-[150px]">Night Site / Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id} className="hover:bg-slate-50">
                        <TableCell className="font-bold text-slate-800 py-2">
                          {employee.surname} {employee.firstname}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm py-2">
                          {employee.position}
                        </TableCell>
                        <TableCell className="p-2 border-l border-slate-100">
                          <select 
                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus:ring-2 focus:ring-[#002040] focus:border-transparent outline-none transition-all"
                            value={attendanceData[employee.id]?.day || ''}
                            onChange={(e) => handleSelectChange(employee.id, 'day', e.target.value)}
                          >
                            <option value="">-- Select --</option>
                            <optgroup label="Active Sites">
                              {sites.filter(s => s.status === 'Active').map(site => (
                                <option key={`day-${site.id}`} value={site.name}>{site.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Statuses">
                              {statuses.map(status => (
                                <option key={`day-${status}`} value={status}>{status}</option>
                              ))}
                            </optgroup>
                          </select>
                        </TableCell>
                        <TableCell className="p-2 border-l border-slate-100">
                          <select 
                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm focus:ring-2 focus:ring-[#002040] focus:border-transparent outline-none transition-all"
                            value={attendanceData[employee.id]?.night || ''}
                            onChange={(e) => handleSelectChange(employee.id, 'night', e.target.value)}
                          >
                            <option value="">-- Select --</option>
                            <optgroup label="Active Sites">
                              {sites.filter(s => s.status === 'Active').map(site => (
                                <option key={`night-${site.id}`} value={site.name}>{site.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Statuses">
                              {statuses.map(status => (
                                <option key={`night-${status}`} value={status}>{status}</option>
                              ))}
                            </optgroup>
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent active={activeTab === 'database'} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Database</CardTitle>
              <CardDescription>View all submitted attendance records and calculated fields.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table className="text-xs whitespace-nowrap">
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Day_Client</TableHead>
                      <TableHead>Day Site</TableHead>
                      <TableHead>Night_Client</TableHead>
                      <TableHead>Night Site</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Night</TableHead>
                      <TableHead>Absent Status</TableHead>
                      <TableHead>Night_wk</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead>OT_SITE</TableHead>
                      <TableHead>Day_Wk</TableHead>
                      <TableHead>DOW</TableHead>
                      <TableHead>NDW</TableHead>
                      <TableHead>Mth</TableHead>
                      <TableHead>IS PRESENT</TableHead>
                      <TableHead>day2</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={19} className="text-center py-8 text-slate-500">
                          No records found. Submit entries from the Entry Form to populate this database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell className="font-medium">{record.staffName}</TableCell>
                          <TableCell>{record.position}</TableCell>
                          <TableCell>{record.dayClient}</TableCell>
                          <TableCell>{record.daySite}</TableCell>
                          <TableCell>{record.nightClient}</TableCell>
                          <TableCell>{record.nightSite}</TableCell>
                          <TableCell>{record.day}</TableCell>
                          <TableCell>{record.night}</TableCell>
                          <TableCell className="text-red-500">{record.absentStatus}</TableCell>
                          <TableCell>{record.nightWk}</TableCell>
                          <TableCell className="font-bold text-indigo-600">{record.ot}</TableCell>
                          <TableCell>{record.otSite}</TableCell>
                          <TableCell>{record.dayWk}</TableCell>
                          <TableCell>{record.dow}</TableCell>
                          <TableCell>{record.ndw}</TableCell>
                          <TableCell>{record.mth}</TableCell>
                          <TableCell className={record.isPresent === 'Yes' ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                            {record.isPresent}
                          </TableCell>
                          <TableCell>{record.day2}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
