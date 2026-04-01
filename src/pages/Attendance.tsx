import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { useAppStore, AttendanceRecord } from '@/src/store/appStore';
import { Search, Save, Trash2, Calendar as CalendarIcon, Database, Filter, Users, Download, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { format } from 'date-fns';
import { toast, showConfirm } from '@/src/components/ui/toast';
import * as XLSX from 'xlsx';
import { usePriv } from '@/src/hooks/usePriv';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import { useDebounce } from '@/src/hooks/useDebounce';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';

import { getPositionIndex } from '@/src/lib/hierarchy';


export function Attendance() {
  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const sites = useAppStore((state) => state.sites);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const addAttendanceRecords = useAppStore((state) => state.addAttendanceRecords);
  const removeAttendanceRecordsByDate = useAppStore((state) => state.removeAttendanceRecordsByDate);
  const deleteAttendanceRecords = useAppStore((state) => state.deleteAttendanceRecords);

  const [registerDate, setRegisterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lastEntryDate, setLastEntryDate] = useState(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('entry');
  const [staffTypeFilter, setStaffTypeFilter] = useState<'OFFICE' | 'FIELD'>('FIELD');
  const [importFile, setImportFile] = useState<File | null>(null);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('attendance');
  // For export we piggyback off the reports canExport privilege
  const reportPriv = usePriv('reports');

  // Database filters
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbStaffTypeFilter, setDbStaffTypeFilter] = useState<'OFFICE' | 'FIELD' | 'All'>('FIELD');
  const [dbSiteFilter, setDbSiteFilter] = useState('All');
  const [dbShiftFilter, setDbShiftFilter] = useState('All');

  const [dbSelectedIds, setDbSelectedIds] = useState<Set<string>>(new Set());

  const isFieldStaff = staffTypeFilter === 'FIELD';
  const isOfficeStaff = staffTypeFilter === 'OFFICE';
  
  const departments = useAppStore((state) => state.departments);

  // State for the current form
  const [attendanceData, setAttendanceData] = useState<Record<string, { day: string, night: string, overtime: boolean, overtimeDetails: string }>>({});

  const statuses = [
    "Absent",
    "Absent with Permit",
    "On Leave"
  ];

  // Auto-load existing records when date changes
  useEffect(() => {
    const existingRecords = attendanceRecords.filter(r => r.date === registerDate);
    if (existingRecords.length > 0) {
      const loadedData: Record<string, { day: string, night: string, overtime: boolean, overtimeDetails: string }> = {};
      existingRecords.forEach(r => {
        loadedData[r.staffId] = {
          day: r.daySite || r.absentStatus || '',
          night: r.nightSite || (r.absentStatus && !r.daySite ? r.absentStatus : ''),
          overtime: r.overtimeDetails ? true : false,
          overtimeDetails: r.overtimeDetails || ''
        };
      });
      setAttendanceData(loadedData);
    } else {
      setAttendanceData({});
    }
  }, [registerDate, attendanceRecords]);

  const filteredEmployees = useMemo(() => {
    const searchLow = searchTerm.toLowerCase();
    return employees.filter(emp => {
      const matchesSearch = emp.surname.toLowerCase().includes(searchLow) ||
        emp.firstname.toLowerCase().includes(searchLow);
      const matchesType = emp.staffType === staffTypeFilter;
      const isNotCEO = emp.position !== 'CEO';
      return matchesSearch && matchesType && isNotCEO;
    }).sort((a, b) => {
      const idxA = getPositionIndex(a.position);
      const idxB = getPositionIndex(b.position);
      if (idxA !== idxB) return idxA - idxB;
      return (a.position || '').localeCompare(b.position || '');
    });
  }, [employees, searchTerm, staffTypeFilter]);

  const debouncedDbSearch = useDebounce(dbSearchTerm, 300);

  const filteredDbRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      const emp = employees.find(e => e.id === r.staffId);
      if (dbStaffTypeFilter !== 'All') {
        if (emp?.staffType !== dbStaffTypeFilter) return false;
      } else {
        if (emp?.staffType === 'NON-EMPLOYEE') return false;
      }
      if (debouncedDbSearch) {
        const matchName = r.staffName.toLowerCase().includes(debouncedDbSearch.toLowerCase());
        if (!matchName) return false;
      }
      if (dbSiteFilter !== 'All') {
        if (r.daySite !== dbSiteFilter && r.nightSite !== dbSiteFilter) return false;
      }
      if (dbShiftFilter !== 'All') {
        if (dbShiftFilter === 'Day' && r.day !== 'Yes') return false;
        if (dbShiftFilter === 'Night' && r.night !== 'Yes') return false;
      }
      return true;
    }).sort((a, b) => {
      const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCmp !== 0) return dateCmp;

      const idxA = getPositionIndex(a.position);
      const idxB = getPositionIndex(b.position);
      if (idxA !== idxB) return idxA - idxB;
    return (a.position || '').localeCompare(b.position || '');
    });
  }, [attendanceRecords, employees, debouncedDbSearch, dbStaffTypeFilter, dbSiteFilter, dbShiftFilter]);

  // DB Actions
  const handleBulkDelete = async () => {
    if (dbSelectedIds.size === 0) return;
    const ok = await showConfirm(`Are you sure you want to delete ${dbSelectedIds.size} attendance record(s)?`, { variant: 'danger' });
    if (!ok) return;
    deleteAttendanceRecords(Array.from(dbSelectedIds));
    setDbSelectedIds(new Set());
    toast.success('Selected records deleted.');
  };

  const handleExportExcel = async (mode: 'bare' | 'detailed' = 'detailed') => {
    if (filteredDbRecords.length === 0) {
      toast.error('No records to export');
      return;
    }

    const exportData = filteredDbRecords.map(r => {
      if (mode === 'bare') {
        return {
          Date: formatDisplayDate(r.date),
          'Staff ID': r.staffId,
          'Staff Name': r.staffName,
          'Day Site': r.daySite,
          'Night Site': r.nightSite,
          'Absent Status': r.absentStatus,
          'Overtime Details': r.overtimeDetails
        };
      }
      return {
        Date: formatDisplayDate(r.date),
        'Staff ID': r.staffId,
        'Staff Name': r.staffName,
        Position: r.position,
        'Day Client': r.dayClient,
        'Day Site': r.daySite,
        'Night Client': r.nightClient,
        'Night Site': r.nightSite,
        Day: r.day,
        Night: r.night,
        Absent: r.absentStatus,
        'Night Wk': r.nightWk,
        OT: r.ot,
        'OT Site': r.otSite,
        'Day Wk': r.dayWk,
        DOW: r.dow,
        NDW: r.ndw,
        Month: r.mth,
        Present: r.isPresent,
        'Day 2': r.day2,
        'Overtime Details': r.overtimeDetails
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const defaultFileName = `Attendance_${mode === 'bare' ? 'Bare_' : 'Detailed_'}${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // Try Electron Save Dialog first
    if (window.electronAPI?.savePathDialog) {
      const filePath = await window.electronAPI.savePathDialog({
        title: `Export Attendance (${mode === 'bare' ? 'Bare Minimum' : 'Detailed'})`,
        defaultPath: defaultFileName,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });

      if (filePath) {
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const success = await window.electronAPI.writeFile(filePath, buf, 'binary');
        if (success) {
          toast.success(`Exported to ${filePath}`);
        } else {
          toast.error('Failed to save file.');
        }
      }
    } else {
      // Fallback for browser-only mode
      XLSX.writeFile(wb, defaultFileName);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    e.target.value = ''; // Reset input so same file can be re-selected
  };

  const processAttendanceImport = (file: File, mode: 'append' | 'overwrite') => {
    setImportFile(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        if (rawData && rawData.length > 0) {
          const processedRecords: AttendanceRecord[] = [];
          
          // Determine if we need to estimate (if key "OT" or "NDW" is missing)
          const needsEstimation = !rawData[0].hasOwnProperty('OT') && !rawData[0].hasOwnProperty('NDW');

          if (needsEstimation) {
            // Group by date to process batches for NDW calculation
            const byDate: Record<string, any[]> = {};
            rawData.forEach(row => {
              const dt = normalizeDate(row.Date || row.date);
              if (!byDate[dt]) byDate[dt] = [];
              byDate[dt].push(row);
            });

            Object.keys(byDate).forEach(dateStr => {
              const recordsForDate = byDate[dateStr];
              const normalizedDate = normalizeDate(dateStr);
              const estimated = runEstimationForBatch(recordsForDate, normalizedDate);
              processedRecords.push(...estimated);
            });
          } else {
            rawData.forEach(row => {
              processedRecords.push({
                id: row.id || generateId(),
                date: normalizeDate(row.Date || row.date),
                staffId: row['Staff ID'] || row.staffId,
                staffName: row['Staff Name'] || row.staffName,
                position: row.Position || row.position || '',
                dayClient: row['Day Client'] || row.dayClient || '',
                daySite: row['Day Site'] || row.daySite || '',
                nightClient: row['Night Client'] || row.nightClient || '',
                nightSite: row['Night Site'] || row.nightSite || '',
                day: row.Day || row.day || 'No',
                night: row.Night || row.night || 'No',
                absentStatus: row.Absent || row.absentStatus || '',
                nightWk: row['Night Wk'] || row.nightWk || 0,
                ot: row.OT || row.ot || 0,
                otSite: row['OT Site'] || row.otSite || '',
                dayWk: row['Day Wk'] || row.dayWk || 0,
                dow: row.DOW || row.dow || 0,
                ndw: row.NDW || row.ndw || 'No',
                mth: row.Month || row.mth || 0,
                isPresent: row.Present || row.isPresent || 'No',
                day2: row['Day 2'] || row.day2 || 0,
                overtimeDetails: row['Overtime Details'] || row.overtimeDetails || '',
              });
            });
          }

          if (processedRecords.length > 0) {
            if (mode === 'overwrite') {
              // Remove all existing records for dates found in the file
              const datesToOverwrite = new Set(processedRecords.map(r => r.date));
              datesToOverwrite.forEach(date => removeAttendanceRecordsByDate(date));
            }
            addAttendanceRecords(processedRecords);
            const modeLabel = mode === 'overwrite' ? ' (dates overwritten)' : ' (appended)';
            toast.success(`Successfully imported ${processedRecords.length} records${needsEstimation ? ' with automatic estimation' : ''}${modeLabel}!`);
          } else {
            toast.error('No valid records found in the file.');
          }
        } else {
          toast.error('Invalid Excel file format.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const runEstimationForBatch = (rows: any[], dateStr: string): AttendanceRecord[] => {
    const dow = getDOW(dateStr);
    const dateIsHoliday = isHoliday(dateStr);
    const dateObj = new Date(dateStr);
    const mth = dateObj.getMonth() + 1;

    // We need next day data for NDW. In an import batch, we can only look at 
    // what's already in the DB or in the batch itself.
    const nextDayStr = getNextDayStr(dateStr);
    const nextNextDayStr = getNextDayStr(dateStr, 2);
    const existingNextDay = attendanceRecords.filter(r => r.date === nextDayStr);
    const existingNextNextDay = attendanceRecords.filter(r => r.date === nextNextDayStr);

    return rows.map(row => {
      const staffId = row['Staff ID'] || row.staffId;
      const staffName = row['Staff Name'] || row.staffName;
      const emp = employees.find(e => e.id === staffId || (`${e.surname} ${e.firstname}`) === staffName);
      
      const daySite = row['Day Site'] || row.daySite || '';
      const nightSite = row['Night Site'] || row.nightSite || '';
      const absentStatus = row['Absent Status'] || row.absentStatus || '';
      const overtimeDetails = row['Overtime Details'] || row.overtimeDetails || '';

      const day = (daySite && !isAbsentStatus(daySite)) ? 'Yes' : 'No';
      const night = (nightSite && !isAbsentStatus(nightSite)) ? 'Yes' : 'No';

      const finalDaySite = isAbsentStatus(daySite) ? '' : daySite;
      const finalNightSite = isAbsentStatus(nightSite) ? '' : nightSite;

      const dayClient = sites.find(s => s.name === finalDaySite)?.client || '';
      const nightClient = sites.find(s => s.name === finalNightSite)?.client || '';

      const nightWk = night === 'Yes' ? 1 : 0;

      let ndw: 'Yes' | 'No' = 'No';
      if (dow !== 7) {
        const staffWorksNextDay = existingNextDay.some(
          r => r.staffId === staffId && (r.day === 'Yes' || r.night === 'Yes')
        );
        const nextDayDow = getDOW(nextDayStr);
        const nextDayIsHolidayOrSunday = nextDayDow === 7 || isHoliday(nextDayStr);
        const staffWorksNextNextDay = existingNextNextDay.some(
          r => r.staffId === staffId && (r.day === 'Yes' || r.night === 'Yes')
        );

        if (staffWorksNextDay || (nextDayIsHolidayOrSunday && staffWorksNextNextDay)) {
          ndw = 'Yes';
        }
      }

      const worked = day === 'Yes' || night === 'Yes';
      let ot = 0;
      if (
        (dow === 7 && worked) ||
        (dateIsHoliday && worked) ||
        (day === 'Yes' && night === 'Yes' && ndw === 'Yes') ||
        !!overtimeDetails
      ) {
        ot = overtimeRates[mth] || 0.5;
      }

      const otSite = ot > 0 ? (night === 'Yes' ? finalNightSite : finalDaySite) : '';

      let dayWk = 0;
      if (ot > 0) {
        dayWk = 1;
      } else if (day === 'No' && night === 'No') {
        dayWk = 0;
      } else if (day === 'No') {
        dayWk = 1;
      } else if (night === 'Yes') {
        dayWk = 2;
      } else {
        dayWk = 1;
      }

      const isPresent = (day === 'Yes' || night === 'Yes' || ndw === 'Yes') ? 'Yes' : 'No';
      const day2 = (day === 'Yes' ? 1 : 0) + (night === 'Yes' ? 1 : 0);

      return {
        id: generateId(),
        date: dateStr,
        staffId: staffId || '',
        staffName: staffName || '',
        position: emp?.position || row.Position || row.position || '',
        dayClient,
        daySite: finalDaySite,
        nightClient,
        nightSite: finalNightSite,
        day,
        night,
        absentStatus,
        nightWk,
        ot,
        otSite,
        dayWk,
        dow,
        ndw,
        mth,
        isPresent,
        day2,
        overtimeDetails,
      };
    });
  };

  const handleSelectChange = (empId: string, shift: 'day' | 'night' | 'overtimeDetails', value: string | boolean) => {
    setAttendanceData(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [shift]: value
      }
    }));
  };

  const handleOvertimeToggle = (empId: string, checked: boolean) => {
    const emp = employees.find(e => e.id === empId);
    const isOps = emp ? ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase()) : false;
    setAttendanceData(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        overtime: checked,
        overtimeDetails: checked ? prev[empId]?.overtimeDetails || '' : '',
        // For non-Operations: auto-set day to 'Office' (DCEL) when overtime is ticked
        ...((!isOps && checked) ? { day: 'Office' } : {}),
        ...((!isOps && !checked && prev[empId]?.day === 'Office') ? { day: '' } : {}),
      }
    }));
  };

  const handleClear = async () => {
    const ok = await showConfirm('Are you sure you want to clear the current form?', { variant: 'danger', confirmLabel: 'Clear' });
    if (ok) setAttendanceData({});
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

  // Public holidays from Variables page (in a real app, this would come from the store)
  const publicHolidays = [
    '2026-01-01', '2026-01-02', '2026-01-03', '2026-03-20', '2026-03-21',
    '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-27', '2026-05-28',
    '2026-06-12', '2026-08-26', '2026-10-01', '2026-12-25'
  ];

  // Monthly overtime rates (from MonthsValues table equivalent)
  const overtimeRates: Record<number, number> = {
    1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 0.5,
    7: 0.5, 8: 0.5, 9: 0.5, 10: 0.5, 11: 0.5, 12: 0.5
  };

  const isHoliday = (dateStr: string) => publicHolidays.includes(dateStr);

  const getNextDayStr = (dateStr: string, offset: number = 1) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + offset);
    return format(d, 'yyyy-MM-dd');
  };

  // Excel DOW: WEEKDAY(date, 2) → 1=Monday, 7=Sunday
  const getDOW = (dateStr: string) => {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0=Sun, 1=Mon...6=Sat
    return jsDay === 0 ? 7 : jsDay; // Convert to 1=Mon...7=Sun
  };

  const handleSubmit = async () => {
    const existingRecords = attendanceRecords.filter(r => r.date === registerDate);
    if (existingRecords.length > 0) {
      const ok = await showConfirm(`Entries already exist for ${registerDate}. Click OK to overwrite them, or Cancel to abort.`, { confirmLabel: 'Overwrite' });
      if (!ok) return;
      removeAttendanceRecordsByDate(registerDate);
    }

    const dateObj = new Date(registerDate);
    const dow = getDOW(registerDate);
    const isSunday = dow === 7;
    const dateIsHoliday = isHoliday(registerDate);

    // First pass: build raw records with day/night/site info
    type RawRecord = {
      empId: string;
      staffName: string;
      position: string;
      daySite: string;
      nightSite: string;
      dayClient: string;
      nightClient: string;
      day: 'Yes' | 'No';
      night: 'Yes' | 'No';
      absentStatus: string;
      overtimeDetails: string;
    };

    const rawRecords: RawRecord[] = [];

    employees.forEach(emp => {
      const formDaySite = attendanceData[emp.id]?.day || '';
      const formNightSite = attendanceData[emp.id]?.night || '';

      let staffHasWorkEntry = false;
      if (formDaySite && !isAbsentStatus(formDaySite)) staffHasWorkEntry = true;
      if (formNightSite && !isAbsentStatus(formNightSite)) staffHasWorkEntry = true;

      // Default: on weekdays that aren't holidays, Operations staff are at Office for day shift
      // Other departments only get an entry if manually specified (status, day, night, or overtime).
      const isOperations = ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase());
      const fillData = isOperations ? !(isSunday || dateIsHoliday) : false;
      const hasOvertime = attendanceData[emp.id]?.overtime;
      if (!fillData && !staffHasWorkEntry && !formDaySite && !formNightSite && !hasOvertime) return;

      let daySite = fillData ? "Office" : "";
      let nightSite = "";
      let dayShift: 'Yes' | 'No' = fillData ? "Yes" : "No";
      let nightShift: 'Yes' | 'No' = "No";
      let absentReason = "";

      const dayOverride = applyOverride(formDaySite, daySite, dayShift, absentReason);
      daySite = dayOverride.site;
      dayShift = dayOverride.shift as 'Yes' | 'No';
      absentReason = dayOverride.reason;

      const nightOverride = applyOverride(formNightSite, nightSite, nightShift, absentReason);
      nightSite = nightOverride.site;
      nightShift = nightOverride.shift as 'Yes' | 'No';
      absentReason = nightOverride.reason;

      const finalDaySite = isAbsentStatus(daySite) ? '' : daySite;
      const finalNightSite = isAbsentStatus(nightSite) ? '' : nightSite;

      const dayClient = sites.find(s => s.name === finalDaySite)?.client
        || (hasOvertime && !isOperations ? 'DCEL' : '');
      const nightClient = sites.find(s => s.name === finalNightSite)?.client || '';

      rawRecords.push({
        empId: emp.id,
        staffName: `${emp.surname} ${emp.firstname}`,
        position: emp.position,
        daySite: finalDaySite,
        nightSite: finalNightSite,
        dayClient,
        nightClient,
        day: dayShift,
        night: nightShift,
        absentStatus: absentReason,
        overtimeDetails: (attendanceData[emp.id]?.overtime && !isFieldStaff) ? attendanceData[emp.id].overtimeDetails : '',
      });
    });

    if (rawRecords.length === 0) {
      toast.error('No attendance data selected to submit.');
      return;
    }

    // Second pass: calculate NDW (needs to look at next day's records)
    // NDW checks if this staff works the next day (or day after if next day is Sunday/holiday)
    const nextDayStr = getNextDayStr(registerDate);
    const nextNextDayStr = getNextDayStr(registerDate, 2);
    const existingNextDay = attendanceRecords.filter(r => r.date === nextDayStr);
    const existingNextNextDay = attendanceRecords.filter(r => r.date === nextNextDayStr);

    const mth = dateObj.getMonth() + 1;

    const records: AttendanceRecord[] = rawRecords.map(raw => {
      // Col 11: Night_wk = IF(Night="Yes",1,0)
      const nightWk = raw.night === 'Yes' ? 1 : 0;

      // Col 15: DOW
      // Already calculated above as `dow`

      // Col 16: NDW - Next Day Work
      // If Sunday, NDW is blank ("")
      // Otherwise check if staff works next day, or if next day is Sunday/holiday, check day after
      let ndw: 'Yes' | 'No' = 'No';
      if (dow !== 7) {
        const staffWorksNextDay = existingNextDay.some(
          r => r.staffName === raw.staffName && (r.day === 'Yes' || r.night === 'Yes')
        );
        const nextDayDow = getDOW(nextDayStr);
        const nextDayIsHolidayOrSunday = nextDayDow === 7 || isHoliday(nextDayStr);
        const staffWorksNextNextDay = existingNextNextDay.some(
          r => r.staffName === raw.staffName && (r.day === 'Yes' || r.night === 'Yes')
        );

        if (staffWorksNextDay || (nextDayIsHolidayOrSunday && staffWorksNextNextDay)) {
          ndw = 'Yes';
        }
      }

      // Col 12: OT (Overtime)
      // Three conditions:
      // 1. Sunday + worked → OT
      // 2. Public holiday + worked → OT
      // 3. Day=Yes AND Night=Yes AND NDW=Yes → OT
      // 4. Non-operations manual overtime ticked
      const worked = raw.day === 'Yes' || raw.night === 'Yes';
      let ot = 0;
      const isManualOvertime = !!raw.overtimeDetails;
      if (
        (dow === 7 && worked) ||
        (dateIsHoliday && worked) ||
        (raw.day === 'Yes' && raw.night === 'Yes' && ndw === 'Yes') ||
        isManualOvertime
      ) {
        ot = overtimeRates[mth] || 0;
      }

      // Col 13: OT_SITE = IF(OT>0, IF(Night="Yes", NightSite, DaySite), "")
      const otSite = ot > 0 ? (raw.night === 'Yes' ? raw.nightSite : raw.daySite) : '';

      // Col 14: Day_Wk
      // =IF(OT="Yes",1, IF(AND(Day="No",Night="No"),0, IF(Day="No",1, IF(Night="Yes",2,1))))
      let dayWk = 0;
      if (ot > 0) {
        dayWk = 1;
      } else if (raw.day === 'No' && raw.night === 'No') {
        dayWk = 0;
      } else if (raw.day === 'No') {
        dayWk = 1; // Night only
      } else if (raw.night === 'Yes') {
        dayWk = 2; // Day + Night
      } else {
        dayWk = 1; // Day only
      }

      // Col 18: IS PRESENT = IF(OR(Day="Yes",Night="Yes",NDW="Yes"),1,0)
      const isPresent = (raw.day === 'Yes' || raw.night === 'Yes' || ndw === 'Yes') ? 'Yes' : 'No';

      // Col 19: day2 = IF(Day="Yes",1,0) + IF(Night="Yes",1,0)
      const day2 = (raw.day === 'Yes' ? 1 : 0) + (raw.night === 'Yes' ? 1 : 0);

      return {
        id: generateId(),
        date: registerDate,
        staffId: raw.empId,
        staffName: raw.staffName,
        position: raw.position,
        dayClient: raw.dayClient,
        daySite: raw.daySite,
        nightClient: raw.nightClient,
        nightSite: raw.nightSite,
        day: raw.day,
        night: raw.night,
        absentStatus: raw.absentStatus,
        nightWk,
        ot,
        otSite,
        dayWk,
        dow,
        ndw,
        mth,
        isPresent,
        day2,
        overtimeDetails: raw.overtimeDetails,
      };
    });

    addAttendanceRecords(records);
    setLastEntryDate(registerDate);
    // Increment date to next day only if it won't be a future date
    const nextDay = getNextDayStr(registerDate);
    const today = format(new Date(), 'yyyy-MM-dd');
    setRegisterDate(nextDay <= today ? nextDay : today);
    setAttendanceData({});
    toast.success(`Successfully saved ${records.length} records to the database!`);
  };

  const filledCount = Object.keys(attendanceData).filter(k => attendanceData[k]?.day || attendanceData[k]?.night).length;

  useSetPageTitle(
    'Daily Register',
    'Attendance & site allocation',
    <div className="flex items-center gap-2">
      <TabsList className="bg-slate-100 h-8">
        <TabsTrigger
          active={activeTab === 'entry'}
          onClick={() => setActiveTab('entry')}
          className="gap-1.5 text-xs h-7 px-3"
        >
          <CalendarIcon className="h-3 w-3" /> Entry
        </TabsTrigger>
        <TabsTrigger
          active={activeTab === 'database'}
          onClick={() => setActiveTab('database')}
          className="gap-1.5 text-xs h-7 px-3"
        >
          <Database className="h-3 w-3" /> Database
        </TabsTrigger>
      </TabsList>
    </div>,
    [activeTab]
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs className="w-full flex-1 flex flex-col min-h-0">
        <TabsContent active={activeTab === 'entry'} className="flex-1 flex flex-col min-h-0 mt-0">
          {/* Toolbar: date, filters, search, actions — all in one row */}
          <div className="flex flex-wrap items-center gap-2 py-1 px-0">
            {/* Date controls */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last</span>
              <span className="text-xs font-mono font-medium text-slate-700">{formatDisplayDate(lastEntryDate)}</span>
              <div className="w-px h-4 bg-slate-200" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</span>
              <Input
                type="date"
                value={registerDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => {
                  const chosen = e.target.value;
                  if (chosen > format(new Date(), 'yyyy-MM-dd')) {
                    toast.error('You cannot record attendance for a future date.');
                    return;
                  }
                  setRegisterDate(chosen);
                }}
                className="h-7 text-xs border-0 bg-transparent p-0 w-28 font-mono focus-visible:ring-0"
              />
            </div>

            {/* Staff Type filter */}
            <div className="relative">
              <select
                value={staffTypeFilter}
                onChange={(e) => setStaffTypeFilter(e.target.value as any)}
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 bg-white shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="OFFICE">OFFICE STAFF</option>
                <option value="FIELD">FIELD STAFF</option>
              </select>
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search..."
                className="h-8 pl-7 text-xs bg-white shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1" />

            {/* Stats pill */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-full px-3 py-1 border border-slate-100">
              <Users className="h-3 w-3" />
              <span className="font-medium text-slate-700">{filledCount}</span>
              <span>/</span>
              <span>{filteredEmployees.length}</span>
              <span className="hidden sm:inline">filled</span>
            </div>

            {/* Actions */}
            {priv.canDelete && (
              <Button onClick={handleClear} variant="outline" size="sm" className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            )}
            {priv.canAdd ? (
              <Button onClick={handleSubmit} size="sm" className="h-8 text-xs gap-1 bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                <Save className="h-3 w-3" /> Submit
              </Button>
            ) : (
              <Button disabled size="sm" className="h-8 text-xs gap-1 opacity-40 cursor-not-allowed bg-slate-300 text-slate-500" title="You don't have permission to submit attendance">
                <Save className="h-3 w-3" /> Submit
              </Button>
            )}
          </div>

          {/* Compact entry table */}
          <div className="rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-white sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 px-3 w-[30%]">Staff Name</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 px-3 border-l border-white/10 w-[35%]">Day Site / Status</th>
                    {isFieldStaff ? (
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 px-3 border-l border-white/10 w-[35%]">
                        Night Site / Status
                      </th>
                    ) : (
                      <th className="text-left text-[11px] font-semibold uppercase tracking-wider py-2 px-3 border-l border-white/10 w-[35%]">
                        Overtime
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={isFieldStaff ? 3 : 2} className="text-center py-8 text-slate-400 text-sm">No employees match your filters.</td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee, idx) => {
                      const dayVal = attendanceData[employee.id]?.day || '';
                      const nightVal = attendanceData[employee.id]?.night || '';
                      const hasEntry = dayVal || nightVal;
                      const isAbsent = dayVal && isAbsentStatus(dayVal);

                      return (
                        <tr
                          key={employee.id}
                          className={`transition-colors ${isAbsent ? 'bg-red-50/50' :
                            hasEntry ? 'bg-emerald-50/40' :
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } hover:bg-slate-100/60`}
                        >
                          <td className="py-1 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAbsent ? 'bg-red-400' : hasEntry ? 'bg-emerald-400' : 'bg-slate-300'
                                }`} />
                              <span className="font-medium text-slate-800 text-xs truncate">
                                {employee.surname} {employee.firstname}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1 py-0.5 flex-shrink-0 hidden sm:inline">
                                {employee.department}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-2 border-l border-slate-100">
                            <select
                              className={`w-full h-7 rounded border text-xs px-2 outline-none transition-all cursor-pointer ${dayVal && !isAbsentStatus(dayVal)
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                                : dayVal && isAbsentStatus(dayVal)
                                  ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                                  : 'border-slate-200 bg-white text-slate-700'
                                } focus:ring-1 focus:ring-slate-400`}
                              value={dayVal}
                              onChange={(e) => handleSelectChange(employee.id, 'day', e.target.value)}
                            >
                              <option value="">&mdash; Select &mdash;</option>
                              <optgroup label="Sites">
                                {sites.filter(s => s.status === 'Active').map(site => (
                                  <option key={`d-${site.id}`} value={site.name}>{site.name} ({site.client})</option>
                                ))}
                              </optgroup>
                              <optgroup label="Status">
                                {statuses.map(status => (
                                  <option key={`d-${status}`} value={status}>{status}</option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                          {isFieldStaff ? (
                            <td className="py-1 px-2 border-l border-slate-100">
                              <select
                                className={`w-full h-7 rounded border text-xs px-2 outline-none transition-all cursor-pointer ${nightVal && !isAbsentStatus(nightVal)
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                                  : nightVal && isAbsentStatus(nightVal)
                                    ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                                    : 'border-slate-200 bg-white text-slate-700'
                                  } focus:ring-1 focus:ring-slate-400`}
                                value={nightVal}
                                onChange={(e) => handleSelectChange(employee.id, 'night', e.target.value)}
                              >
                                <option value="">&mdash; Select &mdash;</option>
                                <optgroup label="Sites">
                                  {sites.filter(s => s.status === 'Active').map(site => (
                                    <option key={`n-${site.id}`} value={site.name}>{site.name} ({site.client})</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Status">
                                  {statuses.map(status => (
                                    <option key={`n-${status}`} value={status}>{status}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                          ) : (
                            <td className="py-1 px-2 border-l border-slate-100">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const dow = getDOW(registerDate);
                                  const defaultDays = ['OPERATIONS', 'ENGINEERING'].includes(employee.department.toUpperCase()) ? 6 : 5;
                                  const wd = payrollVariables.departmentWorkDays?.[employee.department] ?? defaultDays;
                                  const isWorkday = (dow <= wd) && !isHoliday(registerDate);
                                  
                                  return (
                                    <>
                                      <label className={`flex items-center gap-1 ${isWorkday ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={isWorkday ? "Overtime disabled on regular workdays" : ""}>
                                        <input 
                                          type="checkbox" 
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                          checked={!isWorkday && (attendanceData[employee.id]?.overtime || false)}
                                          onChange={(e) => handleOvertimeToggle(employee.id, e.target.checked)}
                                          disabled={isWorkday}
                                        />
                                        <span className="text-xs text-slate-600 font-medium">Overtime</span>
                                      </label>
                                      {attendanceData[employee.id]?.overtime && !isWorkday && (
                                        <Input
                                          type="text"
                                          placeholder="Remarks..."
                                          className="h-7 text-xs flex-1"
                                          value={attendanceData[employee.id]?.overtimeDetails || ''}
                                          onChange={(e) => handleSelectChange(employee.id, 'overtimeDetails', e.target.value)}
                                        />
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent active={activeTab === 'database'} className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="flex flex-wrap items-center gap-2 py-1 px-0 bg-white">
            <div className="relative">
              <select
                value={dbStaffTypeFilter}
                onChange={(e) => setDbStaffTypeFilter(e.target.value as any)}
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 bg-white shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="All">All Types</option>
                <option value="OFFICE">OFFICE</option>
                <option value="FIELD">FIELD</option>
              </select>
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={dbSiteFilter}
                onChange={(e) => setDbSiteFilter(e.target.value)}
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 bg-white shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none max-w-[140px] truncate"
              >
                <option value="All">All Sites</option>
                {sites.filter(s => s.status === 'Active').map(site => (
                  <option key={site.id} value={site.name}>{site.name}</option>
                ))}
              </select>
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={dbShiftFilter}
                onChange={(e) => setDbShiftFilter(e.target.value)}
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 bg-white shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="All">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search Database..."
                className="h-8 pl-7 text-xs bg-white shadow-sm"
                value={dbSearchTerm}
                onChange={(e) => setDbSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {priv.canImport && (
                <label className="cursor-pointer">
                  <Input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 pointer-events-none">
                    <Upload className="h-3 w-3" /> Import
                  </Button>
                </label>
              )}
              {priv.canDelete && dbSelectedIds.size > 0 && (
                <Button onClick={handleBulkDelete} size="sm" variant="destructive" className="h-8 text-xs gap-1 shadow-sm">
                  <Trash2 className="h-3 w-3" /> Delete ({dbSelectedIds.size})
                </Button>
              )}
              {priv.canExport && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm">
                      <Download className="h-3 w-3" /> Export Excel
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Choose Export Type</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExportExcel('bare')} className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">Bare Minimum</span>
                        <span className="text-[10px] text-slate-500">Essential fields for re-import</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportExcel('detailed')} className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">Detailed Version</span>
                        <span className="text-[10px] text-slate-500">Full database records with estimates</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 h-full max-h-[calc(100vh-250px)]">
              <table className="w-full text-[11px] whitespace-nowrap">
                <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="py-2 px-2 border-b border-slate-200">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 w-3 h-3 text-slate-800"
                        checked={filteredDbRecords.length > 0 && dbSelectedIds.size === filteredDbRecords.length}
                        onChange={(e) => {
                          if (e.target.checked) setDbSelectedIds(new Set(filteredDbRecords.map(r => r.id)));
                          else setDbSelectedIds(new Set());
                        }}
                      />
                    </th>
                    {['Date', 'Staff', 'Position', 'Day Client', 'Day Site', 'Night Client', 'Night Site', 'Day', 'Night', 'Absent', 'Night_wk', 'OT', 'OT Site', 'Day_Wk', 'DOW', 'NDW', 'Mth', 'Present', 'day2'].map(h => (
                      <th key={h} className="text-left font-semibold text-slate-600 py-2 px-2 border-b border-slate-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDbRecords.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="text-center py-8 text-slate-400 text-sm">
                        No records match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDbRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 w-3 h-3 text-slate-800"
                            checked={dbSelectedIds.has(r.id)}
                            onChange={(e) => {
                              const s = new Set(dbSelectedIds);
                              if (e.target.checked) s.add(r.id);
                              else s.delete(r.id);
                              setDbSelectedIds(s);
                            }}
                          />
                        </td>
                        <td className="py-1.5 px-2 font-mono whitespace-nowrap">{formatDisplayDate(r.date)}</td>
                        <td className="py-1.5 px-2 font-medium text-slate-800">{r.staffName}</td>
                        <td className="py-1.5 px-2 text-slate-500">{r.position}</td>
                        <td className="py-1.5 px-2">{r.dayClient}</td>
                        <td className="py-1.5 px-2">{r.daySite}</td>
                        <td className="py-1.5 px-2">{r.nightClient}</td>
                        <td className="py-1.5 px-2">{r.nightSite}</td>
                        <td className="py-1.5 px-2">{r.day}</td>
                        <td className="py-1.5 px-2">{r.night}</td>
                        <td className="py-1.5 px-2 text-red-500">{r.absentStatus}</td>
                        <td className="py-1.5 px-2 text-center">{r.nightWk}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-indigo-600">{r.ot}</td>
                        <td className="py-1.5 px-2">{r.otSite}</td>
                        <td className="py-1.5 px-2 text-center">{r.dayWk}</td>
                        <td className="py-1.5 px-2 text-center">{r.dow}</td>
                        <td className="py-1.5 px-2 text-center">{r.ndw}</td>
                        <td className="py-1.5 px-2 text-center">{r.mth}</td>
                        <td className={`py-1.5 px-2 text-center font-bold ${r.isPresent === 'Yes' ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {r.isPresent === 'Yes' ? '✓' : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center">{r.day2}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Policy Modal */}
      {importFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Import Policy</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-2">
              File: <span className="font-medium text-slate-700">{importFile.name}</span>
            </p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              How would you like to handle the attendance records from this file?
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => processAttendanceImport(importFile, 'append')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex-col items-center justify-center"
              >
                <span className="font-semibold block text-base">Append Records</span>
                <span className="block text-xs opacity-80 mt-1 font-normal text-center">Adds imported records alongside existing ones. No data is removed.</span>
              </Button>
              <Button
                onClick={() => processAttendanceImport(importFile, 'overwrite')}
                variant="outline"
                className="border-rose-200 h-auto py-3 text-rose-600 hover:bg-rose-50 flex-col items-center justify-center"
              >
                <span className="font-semibold block text-base">Overwrite by Date</span>
                <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes all existing records for each date in the file, then saves the imported ones.</span>
              </Button>
              <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

