import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { useAppStore, AttendanceRecord } from '@/src/store/appStore';
import { Search, Save, Trash2, Calendar as CalendarIcon, Database, Filter, Users, Download, Upload, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { format } from 'date-fns';
import { toast, showConfirm } from '@/src/components/ui/toast';
import * as XLSX from 'xlsx';
import { usePriv } from '@/src/hooks/usePriv';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId, isValidUUID } from '@/src/lib/utils';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/task_ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { parseISO, isSunday, isWithinInterval } from 'date-fns';
import { calculateAttendanceMetrics } from '@/src/lib/attendanceLogic';


export function Attendance() {
  const allEmployees = useAppStore((state) => state.employees);
  const employees = allEmployees.filter(e => e.status === 'Active' || e.status === 'On Leave');
  const sites = useAppStore((state) => state.sites);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const departments = useAppStore((state) => state.departments);
  const addAttendanceRecords = useAppStore((state) => state.addAttendanceRecords);
  const removeAttendanceRecordsByDate = useAppStore((state) => state.removeAttendanceRecordsByDate);
  const deleteAttendanceRecords = useAppStore((state) => state.deleteAttendanceRecords);
  const leaves = useAppStore((state) => state.leaves);

  const publicHolidaysStore = useAppStore((state) => state.publicHolidays);
  const monthValues = useAppStore((state) => state.monthValues);

  const [registerDate, setRegisterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lastEntryDate, setLastEntryDate] = useState(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('entry');
  const [staffTypeFilter, setStaffTypeFilter] = useState<'OFFICE' | 'FIELD'>('FIELD');
  const [importFile, setImportFile] = useState<File | null>(null);

  type SortConfig = { key: keyof AttendanceRecord; direction: 'asc' | 'desc' };
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);

  const handleSort = (key: keyof AttendanceRecord, e: React.MouseEvent) => {
    setSortConfig(prev => {
      let newSort = [...prev];
      const existingIdx = prev.findIndex(s => s.key === key);
      
      if (!e.shiftKey && (prev.length > 1 || existingIdx === -1)) {
        return [{ key, direction: 'asc' }];
      }
      
      if (!e.shiftKey && prev.length === 1 && existingIdx !== -1) {
        if (newSort[existingIdx].direction === 'asc') newSort[existingIdx] = { key, direction: 'desc' };
        else return [];
        return newSort;
      }
      
      if (e.shiftKey) {
        if (existingIdx !== -1) {
          if (newSort[existingIdx].direction === 'asc') newSort[existingIdx] = { key, direction: 'desc' };
          else newSort.splice(existingIdx, 1);
        } else {
          newSort.push({ key, direction: 'asc' });
        }
      }
      return newSort;
    });
  };

  // ─── Name Resolution Dialog ──────────────────────────────────
  type PendingImport = {
    matchedRecords: AttendanceRecord[];
    unmatchedNames: string[];
    unmatchedRecordsByName: Record<string, AttendanceRecord[]>;
    mode: 'append' | 'overwrite';
    rawCount: number;
  };
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [nameResolutions, setNameResolutions] = useState<Record<string, string>>({});
  const [nameSearchTerms, setNameSearchTerms] = useState<Record<string, string>>({});

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('attendance');
  // For export we piggyback off the reports canExport privilege
  const reportPriv = usePriv('reports');

  // Database filters
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbStaffTypeFilter, setDbStaffTypeFilter] = useState<'OFFICE' | 'FIELD' | 'All'>('All');
  const [dbSiteFilter, setDbSiteFilter] = useState('All');
  const [dbShiftFilter, setDbShiftFilter] = useState('All');
  const [dbDateFilter, setDbDateFilter] = useState<Date | undefined>(undefined);

  // ─── Calendar Status Logic ─────────────────────────────────
  const attendanceStatusMap = useMemo(() => {
    const map: Record<string, 'fully' | 'special' | 'partial' | 'none'> = {};
    
    const opsFieldEmployees = employees.filter(emp => 
      emp.staffType === 'FIELD' && ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase())
    );
    const totalNeeded = opsFieldEmployees.length;
    if (totalNeeded === 0) return map;

    const groupedRecords = attendanceRecords.reduce((acc, rec) => {
      const isOpsField = opsFieldEmployees.some(emp => emp.id === rec.staffId);
      if (isOpsField) {
        if (!acc[rec.date]) acc[rec.date] = new Set();
        acc[rec.date].add(rec.staffId);
      }
      return acc;
    }, {} as Record<string, Set<string>>);

    // Check all dates present in the store
    Object.keys(groupedRecords).forEach(dateStr => {
      const recordedCount = groupedRecords[dateStr].size;
      const isPublicHoliday = publicHolidaysStore.some(h => h.date === dateStr);
      const isSun = isSunday(parseISO(dateStr));
      
      // If any records exist for the date among ops field staff, it is considered filled
      if (recordedCount > 0) {
        if (isPublicHoliday || isSun) map[dateStr] = 'special';
        else map[dateStr] = 'fully';
      } else {
        map[dateStr] = 'none';
      }
    });

    return map;
  }, [attendanceRecords, employees, publicHolidaysStore]);


  const lastAttendanceDate = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return null;
    let latestObj = new Date(1900, 0, 1);
    let latestRaw = attendanceRecords[0].date;

    for (const record of attendanceRecords) {
      if (!record.date) continue;
      
      const nDate = normalizeDate(record.date);
      if (nDate) {
        const d = new Date(nDate + 'T00:00:00');
        if (!isNaN(d.getTime()) && d > latestObj) {
          latestObj = d;
          latestRaw = record.date;
        }
      }
    }
    return latestRaw;
  }, [attendanceRecords]);

  const [dbSelectedIds, setDbSelectedIds] = useState<Set<string>>(new Set());

  const isFieldStaff = staffTypeFilter === 'FIELD';
  const isOfficeStaff = staffTypeFilter === 'OFFICE';

  // State for the current form
  const [attendanceData, setAttendanceData] = useState<Record<string, { day: string, night: string, overtime: boolean, overtimeDetails: string }>>({});

  const statuses = [
    "Absent",
    "Absent with Permit",
    "On Leave"
  ];

  const employeesOnLeaveForRegisterDate = useMemo(() => {
    const regDateObj = parseISO(registerDate);
    const set = new Set<string>();
    leaves.forEach(leave => {
      if (leave.status === 'Cancelled') return;
      if (!leave.startDate || !leave.expectedEndDate) return;
      try {
        const start = parseISO(leave.startDate);
        const resumptionDate = parseISO(leave.expectedEndDate);
        if (regDateObj >= start && regDateObj < resumptionDate) {
          set.add(leave.employeeId);
        }
      } catch (e) {}
    });
    return set;
  }, [leaves, registerDate]);

  const activeSitesForDate = useMemo(() => {
    return sites.filter(s => {
      // Exclude if it hasn't started yet
      if (s.startDate && s.startDate > registerDate) return false;
      // Exclude if it has already ended before this date
      if (s.endDate && s.endDate < registerDate) return false;
      // Exclude unconditionally inactive sites without bounds
      if (!s.startDate && !s.endDate && s.status !== 'Active') return false; 
      
      return true;
    });
  }, [sites, registerDate]);

  const renderSiteOptions = (prefix: string, currentVal: string) => {
    const opts = activeSitesForDate.map(site => (
      <option key={`${prefix}-${site.id}`} value={site.name}>{site.name} ({site.client})</option>
    ));
    
    // Prevent data loss natively by maintaining the previously selected site as visual history
    if (currentVal && !statuses.includes(currentVal) && !activeSitesForDate.find(s => s.name === currentVal)) {
      const histSite = sites.find(s => s.name === currentVal);
      if (histSite) {
        opts.push(
          <option key={`${prefix}-hist-${histSite.id}`} value={histSite.name}>
            {histSite.name} ({histSite.client}) (Historical)
          </option>
        );
      } else {
        opts.push(
          <option key={`${prefix}-hist-del`} value={currentVal}>
            {currentVal} (Deleted)
          </option>
        );
      }
    }
    return opts;
  };

  // Auto-load existing records when date changes
  useEffect(() => {
    // Normalizing both sides for safety against different string formats
    const normDate = normalizeDate(registerDate);
    const existingRecords = attendanceRecords.filter(r => normalizeDate(r.date) === normDate);
    
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
      if (dbDateFilter) {
        const selectedDateStr = format(dbDateFilter, 'yyyy-MM-dd');
        if (normalizeDate(r.date) !== selectedDateStr) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortConfig.length > 0) {
        for (const sort of sortConfig) {
          const aVal = String(a[sort.key] ?? '');
          const bVal = String(b[sort.key] ?? '');
          if (aVal !== bVal) {
             const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
             return sort.direction === 'asc' ? cmp : -cmp;
          }
        }
        return 0;
      } else {
        const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCmp !== 0) return dateCmp;

        const idxA = getPositionIndex(a.position);
        const idxB = getPositionIndex(b.position);
        if (idxA !== idxB) return idxA - idxB;
        return (a.position || '').localeCompare(b.position || '');
      }
    });
  }, [attendanceRecords, employees, debouncedDbSearch, dbStaffTypeFilter, dbSiteFilter, dbShiftFilter, sortConfig]);

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
    const exportData = attendanceRecords.map(r => {
      const met = calculateAttendanceMetrics(r, publicHolidays, payrollVariables, monthValues, attendanceRecords);
      if (mode === 'bare') {
        return {
          Date: r.date ? new Date(r.date + 'T00:00:00') : '',
          'Staff ID': r.staffId,
          'Staff Name': r.staffName,
          'Day Site': r.daySite,
          'Night Site': r.nightSite,
          'Absent Status': r.absentStatus,
          'Overtime Details': r.overtimeDetails
        };
      }
      return {
        Date: r.date ? new Date(r.date + 'T00:00:00') : '',
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
        'Night Wk': met.nightWk,
        OT: met.ot,
        'OT Site': met.otSite ?? '',
        'Day Wk': met.dayWk,
        DOW: met.dow,
        NDW: met.ndw,
        Month: met.mth,
        Present: met.isPresent,
        'Day 2': met.day2,
        'Overtime Details': r.overtimeDetails
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData, { cellDates: true });
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
        const wb = XLSX.read(bstr, { type: 'binary', raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        if (!rawData || rawData.length === 0) { toast.error('Invalid Excel file format.'); return; }

        const needsEstimation = !rawData[0].hasOwnProperty('OT') && !rawData[0].hasOwnProperty('NDW');

        // ─ Normalize helper ───────────────────────────────
        const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

        // ─ Find employee (ID match first, then fuzzy name match across ALL staff) ────
        const findEmp = (sId: string, sName: string) => allEmployees.find(e => {
          if (sId && e.id === sId) return true;
          if (!sName) return false;
          const n = norm(sName);
          if (norm(`${e.surname} ${e.firstname}`) === n) return true;
          if (norm(`${e.firstname} ${e.surname}`) === n) return true;
          const words = n.split(' ').filter(w => w.length > 1);
          if (words.length >= 2) {
            const eFull = norm(`${e.surname} ${e.firstname}`);
            if (words.every(w => eFull.includes(w))) return true;
          }
          return false;
        });

        // ─ Site lookup ─────────────────────────────────────────
        const findSite = (name: string) => {
          if (!name) return null;
          const n = name.toLowerCase().trim();
          return sites.find(s => s.name.toLowerCase().trim() === n)
            || sites.find(s => n.includes(s.name.toLowerCase().trim()))
            || sites.find(s => s.name.toLowerCase().trim().includes(n));
        };

        // ─ Classify each raw row ────────────────────────────────────
        const matchedRecords: AttendanceRecord[] = [];
        const unmatchedRecordsByName: Record<string, AttendanceRecord[]> = {};

        // Build a partial 'bare' record for display/estimation later
        const buildBareRecord = (row: any, date: string, empId: string, empName: string): AttendanceRecord => {
          const daySiteRaw = String(row['Day Site'] || row.daySite || '').trim();
          const nightSiteRaw = String(row['Night Site'] || row.nightSite || '').trim();
          const absentStatusRaw = String(row['Absent Status'] || row.absentStatus || '').trim();
          const dSite = isAbsentStatus(daySiteRaw) ? '' : daySiteRaw;
          const nSite = isAbsentStatus(nightSiteRaw) ? '' : nightSiteRaw;
          const dSiteObj = findSite(dSite);
          const nSiteObj = findSite(nSite);
          
          const isPermit = (val: string) => val.toUpperCase() === 'ABSENT WITH PERMIT' || val.toUpperCase() === 'ON LEAVE';
          const permitOverride = isPermit(daySiteRaw) || isPermit(absentStatusRaw);
          const nightPermitOverride = isPermit(nightSiteRaw);

          const day: 'Yes' | 'No' = (dSite && !isAbsentStatus(dSite)) || permitOverride ? 'Yes' : 'No';
          const night: 'Yes' | 'No' = (nSite && !isAbsentStatus(nSite)) || nightPermitOverride ? 'Yes' : 'No';
          return {
            id: generateId(), date, staffId: empId, staffName: empName,
            position: '', dayClient: dSiteObj?.client || (permitOverride ? 'DCEL' : ''), 
            daySite: dSiteObj?.name || (permitOverride ? 'Office' : dSite),
            nightClient: nSiteObj?.client || (nightPermitOverride ? 'DCEL' : ''), 
            nightSite: nSiteObj?.name || (nightPermitOverride ? 'Office' : nSite),
            day, night, absentStatus: absentStatusRaw,
            nightWk: night === 'Yes' ? 1 : 0, ot: 0, otSite: '', dayWk: 0, dow: 0, ndw: 'No', mth: 0,
            isPresent: (day === 'Yes' || night === 'Yes') ? 'Yes' : 'No',
            day2: (day === 'Yes' ? 1 : 0) + (night === 'Yes' ? 1 : 0),
            overtimeDetails: String(row['Overtime Details'] || row.overtimeDetails || ''),
          };
        };

        rawData.forEach(row => {
          const date = normalizeDate(row.Date || row.date || row['Date'] || '');
          if (!date) return; // skip rows with no valid date

          const sIdRaw = String(row['Staff ID'] || row.staffId || row.id || row['Staff No'] || row['Employee Code'] || '').trim();
          const sNameRaw = String(row['Staff Name'] || row.staffName || row.name || row['Employee Name'] || '').trim();
          if (!sIdRaw && !sNameRaw) return;

          const emp = findEmp(sIdRaw, sNameRaw);

          if (emp) {
            // ✓ Matched to employee in system
            if (needsEstimation) {
              const rec = buildBareRecord(row, date, emp.id, `${emp.surname} ${emp.firstname}`);
              rec.position = emp.position;
              matchedRecords.push(rec);
            } else {
              matchedRecords.push({
                id: row.id || generateId(), date,
                staffId: emp.id, staffName: `${emp.surname} ${emp.firstname}`,
                position: emp.position || row.Position || '', dayClient: row['Day Client'] || row.dayClient || '',
                daySite: row['Day Site'] || row.daySite || '', nightClient: row['Night Client'] || row.nightClient || '',
                nightSite: row['Night Site'] || row.nightSite || '', day: row.Day || row.day || 'No',
                night: row.Night || row.night || 'No', absentStatus: row.Absent || row.absentStatus || '',
                nightWk: row['Night Wk'] || row.nightWk || 0, ot: row.OT || row.ot || 0,
                otSite: row['OT Site'] || row.otSite || '', dayWk: row['Day Wk'] || row.dayWk || 0,
                dow: row.DOW || row.dow || 0, ndw: row.NDW || row.ndw || 'No',
                mth: row.Month || row.mth || parseInt(date.split('-')[1], 10),
                isPresent: row.Present || row.isPresent || 'No',
                day2: row['Day 2'] || row.day2 || 0, overtimeDetails: row['Overtime Details'] || row.overtimeDetails || '',
              });
            }
          } else if (isValidUUID(sIdRaw)) {
            // ✓ Valid UUID even if not in employee list (terminated/deleted) — keep as-is
            matchedRecords.push({
              id: row.id || generateId(), date, staffId: sIdRaw, staffName: sNameRaw,
              position: row.Position || '', dayClient: row['Day Client'] || '', daySite: row['Day Site'] || '',
              nightClient: row['Night Client'] || '', nightSite: row['Night Site'] || '',
              day: row.Day || 'No', night: row.Night || 'No', absentStatus: row.Absent || row.absentStatus || '',
              nightWk: row['Night Wk'] || 0, ot: row.OT || 0, otSite: row['OT Site'] || '',
              dayWk: row['Day Wk'] || 0, dow: row.DOW || 0, ndw: row.NDW || 'No',
              mth: row.Month || 0, isPresent: row.Present || 'No', day2: row['Day 2'] || 0,
              overtimeDetails: row['Overtime Details'] || '',
            });
          } else {
            // ✗ Unknown name with no valid UUID — needs user resolution
            const key = sNameRaw || sIdRaw;
            if (!unmatchedRecordsByName[key]) unmatchedRecordsByName[key] = [];
            unmatchedRecordsByName[key].push(buildBareRecord(row, date, '', key));
          }
        });

        const unmatchedNames = Object.keys(unmatchedRecordsByName);

        if (unmatchedNames.length > 0) {
          // Show name resolution dialog before proceeding
          const initRes: Record<string, string> = {};
          unmatchedNames.forEach(n => { initRes[n] = ''; });
          setPendingImport({ matchedRecords, unmatchedNames, unmatchedRecordsByName, mode, rawCount: rawData.length });
          setNameResolutions(initRes);
          setNameSearchTerms({});
        } else {
          // All resolved — save directly
          let allRecords: AttendanceRecord[] = [];
          
          if (needsEstimation) {
             // Group matchedRecords by date to run estimation per-day
             const byDate: Record<string, AttendanceRecord[]> = {};
             matchedRecords.forEach(r => {
               if (!byDate[r.date]) byDate[r.date] = [];
               byDate[r.date].push(r);
             });
             
             Object.keys(byDate).forEach(d => {
               const estimated = runEstimationForBatch(byDate[d], d);
               allRecords.push(...estimated);
             });
          } else {
             allRecords = matchedRecords;
          }

          if (allRecords.length > 0) {
            if (mode === 'overwrite') {
              const dates = Array.from(new Set(allRecords.map(r => r.date)));
              dates.forEach(d => removeAttendanceRecordsByDate(d));
            }
            addAttendanceRecords(allRecords);
            toast.success(`Imported ${allRecords.length} of ${rawData.length} records (${mode}).`);
          } else {
            toast.error('No valid records found in the file.');
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const completeImportWithResolutions = async () => {
    if (!pendingImport) return;
    const { matchedRecords, unmatchedNames, unmatchedRecordsByName, mode, rawCount } = pendingImport;
    const allRecords: AttendanceRecord[] = [...matchedRecords];
    let skipped = 0;
    unmatchedNames.forEach(name => {
      const empId = nameResolutions[name];
      if (!empId || empId === 'skip') { skipped += unmatchedRecordsByName[name].length; return; }
      const emp = allEmployees.find(e => e.id === empId);
      unmatchedRecordsByName[name].forEach(rec =>
        allRecords.push({ ...rec, staffId: empId, staffName: emp ? `${emp.surname} ${emp.firstname}` : rec.staffName, position: emp?.position || '' })
      );
    });
    if (allRecords.length > 0) {
      if (mode === 'overwrite') {
        const dates = Array.from(new Set(allRecords.map(r => r.date)));
        dates.forEach(d => removeAttendanceRecordsByDate(d));
      }
      await addAttendanceRecords(allRecords);
      const skipNote = skipped > 0 ? ` | ${skipped} records skipped` : '';
      toast.success(`Imported ${allRecords.length} of ${rawCount} records (${mode}).${skipNote}`);
    } else {
      toast.error('All records were skipped.');
    }
    setPendingImport(null); setNameResolutions({}); setNameSearchTerms({});
  };

  const runEstimationForBatch = (rows: any[], dateStr: string): AttendanceRecord[] => {
    return rows.map(row => {
      const staffId = row['Staff ID'] || row.staffId || row.staff_id || '';
      const staffName = row['Staff Name'] || row.staffName || row.staff_name || '';
      const emp = employees.find(e => e.id === staffId || (`${e.surname} ${e.firstname}`) === staffName);

      const ds = row['Day Site'] || row.daySite || row.day_site || '';
      const ns = row['Night Site'] || row.nightSite || row.night_site || '';
      const absentStatus = row['Absent Status'] || row.absentStatus || row.absent_status || '';
      const overtimeDetails = row['Overtime Details'] || row.overtimeDetails || row.overtime_details || row.over_time_details || '';

      const isPermit = (val: string) => val.toUpperCase() === 'ABSENT WITH PERMIT' || val.toUpperCase() === 'ON LEAVE';
      const permitOverride = isPermit(ds) || isPermit(absentStatus);
      const nightPermitOverride = isPermit(ns);

      const day = (ds && !isAbsentStatus(ds)) || permitOverride ? 'Yes' : 'No';
      const night = (ns && !isAbsentStatus(ns)) || nightPermitOverride ? 'Yes' : 'No';

      const finalDaySite = (isAbsentStatus(ds) && !isPermit(ds)) ? (permitOverride ? 'Office' : '') : (permitOverride ? 'Office' : ds);
      const finalNightSite = (isAbsentStatus(ns) && !isPermit(ns)) ? '' : (nightPermitOverride ? 'Office' : ns);

      const dayClient = sites.find(s => s.name === finalDaySite)?.client || '';
      const nightClient = sites.find(s => s.name === finalNightSite)?.client || '';

      const partialRec: Partial<AttendanceRecord> = {
        date: dateStr,
        staffId: staffId || emp?.id || '',
        day,
        night,
        daySite: finalDaySite,
        nightSite: finalNightSite,
        dayClient,
        nightClient,
        overtimeDetails,
      };

      const met = calculateAttendanceMetrics(partialRec, publicHolidays, payrollVariables, monthValues as any, attendanceRecords);

      return {
        id: generateId(),
        date: dateStr,
        staffId: partialRec.staffId || '',
        staffName: staffName || (emp ? `${emp.surname} ${emp.firstname}` : ''),
        position: emp?.position || row.Position || row.position || '',
        dayClient,
        daySite: finalDaySite,
        nightClient,
        nightSite: finalNightSite,
        day,
        night,
        absentStatus,
        overtimeDetails,
        nightWk: met.nightWk,
        ot: met.ot,
        otSite: met.otSite,
        dayWk: met.dayWk,
        dow: met.dow,
        ndw: met.ndw,
        mth: met.mth,
        isPresent: met.isPresent,
        day2: met.day2,
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
      return { site: (upperSrc === "ABSENT WITH PERMIT" || upperSrc === "ON LEAVE") ? "Office" : src, shift: "Yes", reason: src };
    }
    return { site: src, shift: "Yes", reason: currentReason };
  };

  const publicHolidays = publicHolidaysStore ? publicHolidaysStore.map(h => h.date) : [];

  const isHoliday = (dateStr: string) => publicHolidays.includes(dateStr);

  const getNextDayStr = (dateStr: string, offset: number = 1) => {
    // Add T00:00:00 to prevent timezone-shift-backward bugs in some environments
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) {
      // Fallback if the dateStr somehow lacks the correct format
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d2 = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d2.setDate(d2.getDate() + offset);
        return format(d2, 'yyyy-MM-dd');
      }
      return dateStr;
    }
    d.setDate(d.getDate() + offset);
    return format(d, 'yyyy-MM-dd');
  };

  // Excel DOW: WEEKDAY(date, 2) → 1=Monday, 7=Sunday
  const getDOW = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return 1;
    const jsDay = d.getDay(); // 0=Sun, 1=Mon...6=Sat
    return jsDay === 0 ? 7 : jsDay; // Convert to 1=Mon...7=Sun
  };

  const handleSubmit = async () => {
    const normDate = normalizeDate(registerDate);
    const existingRecords = attendanceRecords.filter(r => normalizeDate(r.date) === normDate);
    if (existingRecords.length > 0) {
      const ok = await showConfirm(`Entries already exist for ${formatDisplayDate(registerDate)}. Click OK to overwrite them, or Cancel to abort.`, { confirmLabel: 'Overwrite' });
      if (!ok) return;
      removeAttendanceRecordsByDate(registerDate);
    }

    const dateObj = new Date(registerDate + 'T00:00:00');
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
      const onLeave = employeesOnLeaveForRegisterDate.has(emp.id);
      const formDaySite = onLeave ? 'On Leave' : (attendanceData[emp.id]?.day || '');
      const formNightSite = onLeave ? 'On Leave' : (attendanceData[emp.id]?.night || '');

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
    const existingNextDay = attendanceRecords.filter(r => normalizeDate(r.date) === nextDayStr);
    const existingNextNextDay = attendanceRecords.filter(r => normalizeDate(r.date) === nextNextDayStr);

    const mth = dateObj.getMonth() + 1;

    const records: AttendanceRecord[] = rawRecords.map(raw => {
      const partialRec: Partial<AttendanceRecord> = {
        date: registerDate,
        staffId: raw.empId,
        day: raw.day,
        night: raw.night,
        daySite: raw.daySite,
        nightSite: raw.nightSite,
        dayClient: raw.dayClient,
        nightClient: raw.nightClient,
        overtimeDetails: raw.overtimeDetails,
      };

      const met = calculateAttendanceMetrics(partialRec, publicHolidays, payrollVariables, monthValues as any, attendanceRecords);

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
        overtimeDetails: raw.overtimeDetails,
        // The following are now transients/redundant but kept for DB compatibility if needed
        nightWk: met.nightWk,
        ot: met.ot,
        otSite: met.otSite,
        dayWk: met.dayWk,
        dow: met.dow,
        ndw: met.ndw,
        mth: met.mth,
        isPresent: met.isPresent,
        day2: met.day2,
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
      {activeTab === 'database' && (
        <>
          {priv.canImport && (
            <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm mb-0">
              <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
              <Input type="file" accept=".xlsx" className="hidden" onChange={handleImportExcel} />
            </label>
          )}
          {priv.canDelete && dbSelectedIds.size > 0 && (
            <Button onClick={handleBulkDelete} size="sm" variant="destructive" className="h-9 px-3 text-[11px] font-bold uppercase tracking-tight gap-2 shadow-sm">
              <Trash2 className="h-3.5 w-3.5" /> Delete ({dbSelectedIds.size})
            </Button>
          )}
          {priv.canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight shadow-sm hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export <ChevronDown className="h-3 w-3 text-slate-400" />
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
          <div className="w-px h-5 bg-slate-200 mx-1" />
        </>
      )}

      <TabsList className="bg-slate-100/80 p-1 h-10 border border-slate-200/50 shadow-sm">
        <TabsTrigger
          active={activeTab === 'entry'}
          onClick={() => setActiveTab('entry')}
          className="gap-2 text-[11px] font-bold uppercase tracking-tight h-8 px-4 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-indigo-500" /> Entry
        </TabsTrigger>
        <TabsTrigger
          active={activeTab === 'database'}
          onClick={() => setActiveTab('database')}
          className="gap-2 text-[11px] font-bold uppercase tracking-tight h-8 px-4 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
        >
          <Database className="h-3.5 w-3.5 text-emerald-500" /> Database
        </TabsTrigger>
      </TabsList>
    </div>,
    [activeTab, priv.canImport, priv.canDelete, priv.canExport, dbSelectedIds.size, handleImportExcel, handleExportExcel, handleBulkDelete]
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs className="w-full flex-1 flex flex-col min-h-0">
        <TabsContent active={activeTab === 'entry'} className="flex-1 flex flex-col min-h-0 mt-0">
          {/* Toolbar: date, filters, search, actions — all in one row */}
          <div className="flex flex-wrap items-end gap-2 py-1 px-0">
            {/* Date controls */}
            <div className="flex flex-col gap-1.5 flex-none w-full sm:w-[320px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-0.5">
                    Date
                  </span>
                  <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5 whitespace-nowrap shadow-sm">
                    <span className="text-[10px] font-semibold text-indigo-400 mr-1.5 uppercase tracking-wider">Latest:</span>
                    <span className="text-[11.5px] font-bold text-indigo-800">
                      {lastAttendanceDate ? formatDisplayDate(lastAttendanceDate) : 'None'}
                    </span>
                  </div>
                </div>
                {isHoliday(registerDate) && (
                   <span className="bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-100 flex items-center gap-1 animate-pulse">
                     <span className="w-1 h-1 bg-red-400 rounded-full" />
                     HOLIDAY
                   </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRegisterDate(getNextDayStr(registerDate, -1))}
                  className="h-9 w-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-500" />
                </Button>
                <div className="relative flex-1">
                  <Input
                    type="date"
                    value={registerDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setRegisterDate(e.target.value)}
                    className="h-9 pl-9 text-xs bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors uppercase font-medium text-slate-700 dark:text-slate-200 w-full"
                  />
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const nextDate = getNextDayStr(registerDate, 1);
                    if (nextDate <= format(new Date(), 'yyyy-MM-dd')) {
                      setRegisterDate(nextDate);
                    }
                  }}
                  disabled={registerDate >= format(new Date(), 'yyyy-MM-dd')}
                  className="h-9 w-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Attendance Calendar Overview">
                      <CalendarIcon className="h-4 w-4 text-indigo-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-3 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl">
                     <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Attendance Overview</div>
                     <DayPicker
                        defaultMonth={parseISO(registerDate)}
                        onDayClick={(date) => { setRegisterDate(format(date, 'yyyy-MM-dd')) }}
                        disabled={{ after: new Date() }}
                        modifiers={{
                          fully: (date) => attendanceStatusMap[format(date, 'yyyy-MM-dd')] === 'fully',
                          special: (date) => attendanceStatusMap[format(date, 'yyyy-MM-dd')] === 'special',
                          viewing: (date) => format(date, 'yyyy-MM-dd') === registerDate,
                          missing: (date) => {
                            const dStr = format(date, 'yyyy-MM-dd');
                            const status = attendanceStatusMap[dStr];
                            const d = new Date(date); d.setHours(0,0,0,0);
                            const now = new Date(); now.setHours(0,0,0,0);
                            const isHolidayDay = isHoliday(dStr);
                            const isSun = isSunday(d);
                            return d <= now && (!status || status === 'none') && !isHolidayDay && !isSun;
                          }
                        }}
                        modifiersStyles={{
                          today: { color: 'inherit', fontWeight: 'bold' },
                          viewing: { backgroundColor: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '4px' },
                          fully: { backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 'bold', borderRadius: '4px' },
                          special: { backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold', borderRadius: '4px' },
                          missing: { border: '2px solid #ef4444', borderRadius: '50%' },
                        }}
                        className="bg-white dark:bg-slate-900"
                     />
                     <div className="mt-3 text-[10px] flex flex-col gap-1.5">
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#d1fae5]"></div> Attendance Entered</div>
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#e0e7ff]"></div> Attendance Entered (Holiday/Sun)</div>
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-red-500"></div> Missing/Due Attendance</div>
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#f8fafc] border-2 border-[#cbd5e1]"></div> Date Currently Viewing</div>
                       <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-transparent border border-slate-200"></div> No Entry</div>
                     </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Staff Type filter */}
            <div className="relative flex-none">
              <select
                value={staffTypeFilter}
                onChange={(e) => setStaffTypeFilter(e.target.value as any)}
                className="h-9 pl-9 pr-8 text-[11px] font-bold uppercase tracking-tight rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all focus:ring-2 focus:ring-slate-900/5 outline-none"
              >
                <option value="OFFICE">OFFICE STAFF</option>
                <option value="FIELD">FIELD STAFF</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 pointer-events-none" />
            </div>

            {/* Search */}
            <div className="relative flex-none w-full sm:w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search..."
                className="h-9 pl-9 text-xs bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1" />

            {/* Stats pill */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-full px-3 py-1 border border-slate-100 dark:border-slate-700">
              <Users className="h-3 w-3" />
              <span className="font-medium text-slate-700 dark:text-slate-200">{filledCount}</span>
              <span>/</span>
              <span>{filteredEmployees.length}</span>
              <span className="hidden sm:inline">filled</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {priv.canDelete && (
                <Button onClick={handleClear} variant="outline" size="sm" className="h-9 text-[11px] font-bold uppercase tracking-tight gap-1.5 text-red-600 hover:text-red-700 hover:bg-rose-50 border-rose-100 shadow-sm transition-all">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
              {priv.canAdd ? (
                <Button onClick={handleSubmit} size="sm" className="h-9 text-[11px] font-bold uppercase tracking-tight gap-1.5 bg-slate-900 hover:bg-indigo-600 text-white shadow-md transition-all active:scale-[0.98]">
                  <Save className="h-3.5 w-3.5" /> Submit
                </Button>
              ) : (
                <Button disabled size="sm" className="h-9 text-[11px] font-bold uppercase tracking-tight gap-1.5 opacity-40 cursor-not-allowed bg-slate-300 text-slate-500" title="You don't have permission to submit attendance">
                  <Save className="h-3.5 w-3.5" /> Submit
                </Button>
              )}
            </div>
          </div>

          {/* Compact entry table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-sm min-w-[500px]">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={isFieldStaff ? 3 : 2} className="text-center py-8 text-slate-400 text-sm">No employees match your filters.</td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee, idx) => {
                      const onLeave = employeesOnLeaveForRegisterDate.has(employee.id);
                      const dayVal = onLeave ? 'On Leave' : (attendanceData[employee.id]?.day || '');
                      const nightVal = onLeave ? 'On Leave' : (attendanceData[employee.id]?.night || '');
                      const hasEntry = dayVal || nightVal;
                      const isAbsent = dayVal && isAbsentStatus(dayVal);

                      return (
                        <tr
                          key={employee.id}
                          className={`transition-colors ${isAbsent ? 'bg-red-50/50 dark:bg-red-900/10' :
                            hasEntry ? 'bg-emerald-50/40 dark:bg-emerald-900/10' :
                              idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/50'
                            } hover:bg-slate-100/60 dark:hover:bg-slate-700/40`}
                        >
                          <td className="py-1 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAbsent ? 'bg-red-400' : hasEntry ? 'bg-emerald-400' : 'bg-slate-300'
                                }`} />
                              <span className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate">
                                {employee.surname} {employee.firstname}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5 flex-shrink-0 hidden sm:inline">
                                {employee.department}
                              </span>
                            </div>
                          </td>
                          <td className="py-1 px-2 border-l border-slate-100 dark:border-slate-700">
                            <select
                              className={`w-full h-7 rounded border text-xs px-2 outline-none transition-all ${
                                onLeave ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                              } ${dayVal && !isAbsentStatus(dayVal)
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                                : dayVal && isAbsentStatus(dayVal)
                                  ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                                } focus:ring-1 focus:ring-slate-400`}
                              value={dayVal}
                              onChange={(e) => handleSelectChange(employee.id, 'day', e.target.value)}
                              disabled={onLeave}
                            >
                              <option value="">&mdash; Select &mdash;</option>
                              <optgroup label="Sites">
                                {renderSiteOptions('d', dayVal)}
                              </optgroup>
                              <optgroup label="Status">
                                {statuses.map(status => (
                                  <option key={`d-${status}`} value={status}>{status}</option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                          {isFieldStaff ? (
                            <td className="py-1 px-2 border-l border-slate-100 dark:border-slate-700">
                              <select
                                className={`w-full h-7 rounded border text-xs px-2 outline-none transition-all ${
                                  onLeave ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                                } ${nightVal && !isAbsentStatus(nightVal)
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium'
                                  : nightVal && isAbsentStatus(nightVal)
                                    ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                                  } focus:ring-1 focus:ring-slate-400`}
                                value={nightVal}
                                onChange={(e) => handleSelectChange(employee.id, 'night', e.target.value)}
                                disabled={onLeave}
                              >
                                <option value="">&mdash; Select &mdash;</option>
                                <optgroup label="Sites">
                                  {renderSiteOptions('n', nightVal)}
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
                                  const deptObj = departments.find(d => d.name === employee.department);
                                  const defaultDays = employee.staffType === 'FIELD' ? 6 : 5;
                                  const wd = deptObj?.workDaysPerWeek ?? defaultDays;
                                  const isWorkday = (dow <= wd) && !isHoliday(registerDate);

                                  const disabledOt = isWorkday || onLeave;
                                  return (
                                    <>
                                      <label className={`flex items-center gap-1 ${disabledOt ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={isWorkday ? "Overtime disabled on regular workdays" : (onLeave ? "On leave" : "")}>
                                        <input
                                          type="checkbox"
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                          checked={!disabledOt && (attendanceData[employee.id]?.overtime || false)}
                                          onChange={(e) => handleOvertimeToggle(employee.id, e.target.checked)}
                                          disabled={disabledOt}
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
          <div className="flex flex-wrap items-center gap-2 py-1 px-0">
            <div className="relative">
              <select
                value={dbStaffTypeFilter}
                onChange={(e) => setDbStaffTypeFilter(e.target.value as any)}
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
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
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none max-w-[140px] truncate"
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
                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm appearance-none cursor-pointer focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="All">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[100px] max-w-full sm:max-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search Database..."
                className="h-8 pl-7 text-xs bg-white dark:bg-slate-800 shadow-sm"
                value={dbSearchTerm}
                onChange={(e) => setDbSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-8 px-3 text-xs font-medium flex items-center justify-between gap-2 rounded-lg border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${dbDateFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <div className="flex items-center gap-2">
                       <CalendarIcon className={`h-3.5 w-3.5 ${dbDateFilter ? 'text-indigo-500' : 'text-slate-400'}`} />
                       <span>{dbDateFilter ? format(dbDateFilter, 'PPP') : 'Filter by Date'}</span>
                    </div>
                    {dbDateFilter && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDbDateFilter(undefined);
                        }}
                        className="hover:bg-indigo-100 p-0.5 rounded-md transition-colors"
                      >
                        <Trash2 className="h-3 w-3 text-indigo-400" />
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[120]" align="end">
                  <DayPicker
                    mode="single"
                    selected={dbDateFilter}
                    onSelect={setDbDateFilter}
                    className="p-3 border-none shadow-none"
                    classNames={{
                      day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg",
                      day_today: "text-indigo-600 font-bold border-b-2 border-indigo-600",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 h-full max-h-[calc(100vh-250px)]">
              <table className="w-full text-[11px] whitespace-nowrap">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
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
                    {[
                      { label: 'Date', key: 'date' as keyof AttendanceRecord },
                      { label: 'Staff', key: 'staffName' as keyof AttendanceRecord },
                      { label: 'Position', key: 'position' as keyof AttendanceRecord },
                      { label: 'Day Client', key: 'dayClient' as keyof AttendanceRecord },
                      { label: 'Day Site', key: 'daySite' as keyof AttendanceRecord },
                      { label: 'Night Client', key: 'nightClient' as keyof AttendanceRecord },
                      { label: 'Night Site', key: 'nightSite' as keyof AttendanceRecord },
                      { label: 'Day', key: 'day' as keyof AttendanceRecord },
                      { label: 'Night', key: 'night' as keyof AttendanceRecord },
                      { label: 'Absent', key: 'absentStatus' as keyof AttendanceRecord },
                      { label: 'Night_wk', key: 'nightWk' as keyof AttendanceRecord },
                      { label: 'OT', key: 'ot' as keyof AttendanceRecord },
                      { label: 'OT Site', key: 'otSite' as keyof AttendanceRecord },
                      { label: 'Day_Wk', key: 'dayWk' as keyof AttendanceRecord },
                      { label: 'DOW', key: 'dow' as keyof AttendanceRecord },
                      { label: 'NDW', key: 'ndw' as keyof AttendanceRecord },
                      { label: 'Mth', key: 'mth' as keyof AttendanceRecord },
                      { label: 'Present', key: 'isPresent' as keyof AttendanceRecord },
                      { label: 'day2', key: 'day2' as keyof AttendanceRecord },
                    ].map(h => {
                      const sortItem = sortConfig.find(s => s.key === h.key);
                      return (
                        <th 
                          key={h.key} 
                          className="text-left font-semibold text-slate-600 dark:text-slate-400 py-2 px-2 border-b border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                          onClick={(e) => handleSort(h.key, e)}
                          title="Click to sort, Shift+Click to sort by multiple columns"
                        >
                          <div className="flex items-center gap-1">
                            {h.label}
                            {sortItem ? (
                              sortItem.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredDbRecords.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="text-center py-8 text-slate-400 text-sm">
                        No records match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDbRecords.map((r) => {
                      const met = calculateAttendanceMetrics(r, publicHolidays, payrollVariables, monthValues, attendanceRecords);
                      return (
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
                          <td className="py-1.5 px-2 text-center">{met.nightWk}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-indigo-600">{met.ot}</td>
                          <td className="py-1.5 px-2">{met.otSite ?? ''}</td>
                          <td className="py-1.5 px-2 text-center">{met.dayWk}</td>
                          <td className="py-1.5 px-2 text-center">{met.dow}</td>
                          <td className="py-1.5 px-2 text-center">{met.ndw}</td>
                          <td className="py-1.5 px-2 text-center">{met.mth}</td>
                          <td className={`py-1.5 px-2 text-center font-bold ${met.isPresent === 'Yes' ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {met.isPresent === 'Yes' ? '✓' : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-center">{met.day2}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>


      {/* ── Import Policy Modal ─────────────────────────────────────── */}
      {importFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Import Policy</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-2">File: <span className="font-medium text-slate-700">{importFile.name}</span></p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">How would you like to handle the attendance records from this file?</p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => processAttendanceImport(importFile, 'append')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex-col items-center justify-center">
                <span className="font-semibold block text-base">Append Records</span>
                <span className="block text-xs opacity-80 mt-1 font-normal text-center">Adds imported records alongside existing ones. No data is removed.</span>
              </Button>
              <Button onClick={() => processAttendanceImport(importFile, 'overwrite')} variant="outline" className="border-rose-200 h-auto py-3 text-rose-600 hover:bg-rose-50 flex-col items-center justify-center">
                <span className="font-semibold block text-base">Overwrite by Date</span>
                <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes all existing records for each date in the file, then saves the imported ones.</span>
              </Button>
              <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Name Resolution Dialog ──────────────────────────────────── */}
      {pendingImport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Resolve Unmatched Names</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-amber-600">{pendingImport.unmatchedNames.length} name{pendingImport.unmatchedNames.length !== 1 ? 's' : ''}</span> from the file couldn't be matched to an employee.
                    Match them below, or skip to exclude those records.
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">Total rows in file</div>
                  <div className="text-2xl font-bold text-slate-700">{pendingImport.rawCount}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${(Object.values(nameResolutions).filter(v => v && v !== 'skip').length / pendingImport.unmatchedNames.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {Object.values(nameResolutions).filter(v => !!v).length}/{pendingImport.unmatchedNames.length} resolved
                </span>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {pendingImport.unmatchedNames.map(name => {
                const recCount = pendingImport.unmatchedRecordsByName[name].length;
                const dates = [...new Set(pendingImport.unmatchedRecordsByName[name].map(r => r.date))].slice(0, 3);
                const resolution = nameResolutions[name] || '';
                const searchTerm = nameSearchTerms[name] || '';
                const filteredEmps = allEmployees.filter(e => {
                  if (!searchTerm) return true;
                  const q = searchTerm.toLowerCase();
                  return `${e.surname} ${e.firstname}`.toLowerCase().includes(q) || e.position?.toLowerCase().includes(q);
                });
                const selectedEmp = allEmployees.find(e => e.id === resolution);

                return (
                  <div key={name} className={`rounded-xl border p-4 transition-all ${resolution ? (resolution === 'skip' ? 'border-slate-200 bg-slate-50' : 'border-emerald-200 bg-emerald-50') : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {recCount} record{recCount !== 1 ? 's' : ''} &bull; {dates.map(d => {
                            try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return d; }
                          }).join(', ')}{pendingImport.unmatchedRecordsByName[name].length > 3 ? ` +${pendingImport.unmatchedRecordsByName[name].length - 3} more` : ''}
                        </div>
                      </div>
                      {resolution && resolution !== 'skip' && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium flex-shrink-0">✓ Matched</span>
                      )}
                      {resolution === 'skip' && (
                        <span className="text-xs bg-slate-200 text-slate-500 rounded-full px-2 py-0.5 font-medium flex-shrink-0">Skipped</span>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        placeholder={selectedEmp ? `${selectedEmp.surname} ${selectedEmp.firstname}` : 'Type to search employee...'}
                        value={searchTerm}
                        onChange={e => setNameSearchTerms(prev => ({ ...prev, [name]: e.target.value }))}
                        onFocus={() => setNameSearchTerms(prev => ({ ...prev, [name]: prev[name] || '' }))}
                        className="text-sm h-9 pr-28"
                      />
                      {resolution && (
                        <button
                          onClick={() => { setNameResolutions(prev => ({ ...prev, [name]: '' })); setNameSearchTerms(prev => ({ ...prev, [name]: '' })); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                        >Clear</button>
                      )}
                      {/* Dropdown list */}
                      {searchTerm !== undefined && document.activeElement && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          <button
                            onMouseDown={() => { setNameResolutions(prev => ({ ...prev, [name]: 'skip' })); setNameSearchTerms(prev => ({ ...prev, [name]: '' })); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 italic border-b border-slate-100"
                          >Skip — exclude these records</button>
                          {filteredEmps.map(e => (
                            <button
                              key={e.id}
                              onMouseDown={() => { setNameResolutions(prev => ({ ...prev, [name]: e.id })); setNameSearchTerms(prev => ({ ...prev, [name]: '' })); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between gap-2"
                            >
                              <span className="font-medium text-slate-800">{e.surname} {e.firstname}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">{e.position} {e.status === 'Terminated' ? '· Terminated' : ''}</span>
                            </button>
                          ))}
                          {filteredEmps.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-400 italic">No employees found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{pendingImport.matchedRecords.length}</span> already matched &bull; {' '}
                <span className="font-medium text-slate-700">{Object.values(nameResolutions).filter(v => v && v !== 'skip').length * 0}</span>
                {pendingImport.unmatchedNames.filter(n => !nameResolutions[n]).length > 0 && (
                  <span className="text-amber-600">{pendingImport.unmatchedNames.filter(n => !nameResolutions[n]).length} unresolved will be skipped</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setPendingImport(null); setNameResolutions({}); setNameSearchTerms({}); }} className="text-slate-500">
                  Cancel Import
                </Button>
                <Button onClick={completeImportWithResolutions} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Import {pendingImport.matchedRecords.length + Object.values(nameResolutions).filter(v => v && v !== 'skip').length} Records
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

