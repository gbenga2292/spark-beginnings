import * as XLSX from 'xlsx';

/**
 * Normalizes an array of objects to have the same keys (headers) so that
 * sheet_to_json and json_to_sheet render consistently.
 */
function normalizeData(data: any[]) {
  if (!data || data.length === 0) return [];
  // Collect all possible keys
  const allKeys = new Set<string>();
  data.forEach((item) => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach((k) => allKeys.add(k));
    }
  });

  return data.map((item) => {
    const normalized: any = {};
    allKeys.forEach((key) => {
      normalized[key] = item[key] !== undefined && item[key] !== null ? item[key] : '';
    });
    return normalized;
  });
}

function objectToSheet(obj: any, sheetName: string) {
  if (!obj || typeof obj !== 'object') return XLSX.utils.aoa_to_sheet([['Key', 'Value']]);
  const rows = Object.entries(obj).map(([key, value]) => ({
    Key: key,
    // JSON stringify nested objects or arrays for flat representation
    Value: typeof value === 'object' ? JSON.stringify(value) : value,
  }));
  return XLSX.utils.json_to_sheet(rows);
}

export const exportFullAppToExcel = async (appStateData: any, appVersion: string, overridePath?: string) => {
  const wb = XLSX.utils.book_new();

  // Create a metadata / cover sheet
  const metaData = [
    { Key: 'Export Date', Value: new Date().toISOString() },
    { Key: 'App Version', Value: appVersion },
    { Key: 'Type', Value: 'Full System Backup' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaData), '_Metadata');

  // Helper macro to append arrays safely
  const appendArraySheet = (key: string, sheetName: string) => {
    const data = appStateData[key];
    if (Array.isArray(data) && data.length > 0) {
      const normalized = normalizeData(data);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(normalized), sheetName);
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No Data']]), sheetName);
    }
  };

  // Helper macro to append objects safely
  const appendObjectSheet = (key: string, sheetName: string) => {
    XLSX.utils.book_append_sheet(wb, objectToSheet(appStateData[key], sheetName), sheetName);
  };

  /* ---- Core Data ---- */
  appendArraySheet('employees', 'Employees');
  appendArraySheet('attendanceRecords', 'Attendance');
  appendArraySheet('leaves', 'Leaves');
  
  // Salary Advances & Loans
  appendArraySheet('salaryAdvances', 'SalaryAdvances');
  appendArraySheet('loans', 'Loans');

  /* ---- Variables & Configuration ---- */
  appendArraySheet('positions', 'Positions');
  appendArraySheet('departments', 'Departments');
  
  // specifically format clients if it's string[]
  if (Array.isArray(appStateData.clients) && typeof appStateData.clients[0] === 'string') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appStateData.clients.map((c: string) => ({ ClientName: c }))), 'Clients');
  } else {
    appendArraySheet('clients', 'Clients');
  }
  
  if (Array.isArray(appStateData.leaveTypes) && typeof appStateData.leaveTypes[0] === 'string') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appStateData.leaveTypes.map((c: string) => ({ LeaveType: c }))), 'LeaveTypes');
  } else {
    appendArraySheet('leaveTypes', 'LeaveTypes');
  }

  appendArraySheet('publicHolidays', 'PublicHolidays');
  appendObjectSheet('payrollVariables', 'PayrollVariables');
  appendObjectSheet('payeTaxVariables', 'PayeTaxVariables');
  appendObjectSheet('monthValues', 'MonthValues');
  appendObjectSheet('hrVariables', 'HrVariables');
  appendArraySheet('departmentTasksList', 'DepartmentTasks');

  /* ---- Billing & Ledger ---- */
  appendArraySheet('sites', 'Sites');
  appendArraySheet('invoices', 'Invoices');
  appendArraySheet('pendingInvoices', 'PendingInvoices');
  appendArraySheet('payments', 'Payments');
  appendArraySheet('vatPayments', 'VatPayments');
  
  appendArraySheet('ledgerCategories', 'LedgerCategories');
  appendArraySheet('ledgerVendors', 'LedgerVendors');
  appendArraySheet('ledgerBanks', 'LedgerBanks');
  appendArraySheet('ledgerBeneficiaryBanks', 'LedgerBenBanks');
  appendArraySheet('ledgerEntries', 'LedgerEntries');
  appendArraySheet('companyExpenses', 'CompanyExpenses');

  /* ---- HR & Tasks ---- */
  appendArraySheet('disciplinaryRecords', 'Disciplinary');
  appendArraySheet('evaluations', 'Evaluations');
  
  // Write the file
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const fileName = `DCEL_Full_Backup_${dateStr}_${timeStr}.xlsx`;

  if (overridePath && (window as any).electronAPI?.writeFile) {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const success = await (window as any).electronAPI.writeFile(overridePath, buf, 'binary');
    return success ? overridePath : null;
  }

  if ((window as any).electronAPI?.savePathDialog) {
    const filePath = await (window as any).electronAPI.savePathDialog({
      title: 'Export Full System Backup (Excel)',
      defaultPath: fileName,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (filePath) {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const success = await (window as any).electronAPI.writeFile(filePath, buf, 'binary');
      return success ? filePath : null;
    }
    return null;
  } else {
    XLSX.writeFile(wb, fileName);
    return 'browser_download';
  }
};

/**
 * Reverses `objectToSheet` mapping.
 */
function sheetToObject(sheet: XLSX.WorkSheet) {
  const json: any[] = XLSX.utils.sheet_to_json(sheet);
  const obj: any = {};
  json.forEach((row) => {
    if (row.Key !== undefined && row.Value !== undefined) {
      try {
        // Try to parse JSON back if it was stringified
        obj[row.Key] = JSON.parse(row.Value);
      } catch {
        obj[row.Key] = row.Value;
      }
    }
  });
  return obj;
}

export const restoreFullAppFromExcel = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const restoredData: any = {};
        
        // Helper to grab arrays
        const getArray = (key: string, sheetName: string) => {
          if (wb.SheetNames.includes(sheetName)) {
            const sheetData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
            // Filter out 'No Data' placeholder rows mapping
            if (sheetData.length === 1 && sheetData[0]['No Data'] === undefined && Object.keys(sheetData[0]).length === 0) {
              restoredData[key] = [];
            } else if (sheetData.length === 1 && Object.values(sheetData[0]).includes('No Data')) {
               restoredData[key] = [];
            } else {
              restoredData[key] = sheetData;
            }
          }
        };

        // Helper to grab objects
        const getObject = (key: string, sheetName: string) => {
          if (wb.SheetNames.includes(sheetName)) {
            restoredData[key] = sheetToObject(wb.Sheets[sheetName]);
          }
        };

        getArray('employees', 'Employees');
        getArray('attendanceRecords', 'Attendance');
        getArray('leaves', 'Leaves');
        getArray('salaryAdvances', 'SalaryAdvances');
        getArray('loans', 'Loans');
        getArray('positions', 'Positions');
        getArray('departments', 'Departments');
        getArray('publicHolidays', 'PublicHolidays');
        getArray('departmentTasksList', 'DepartmentTasks');

        // Handle string array mappings
        if (wb.SheetNames.includes('Clients')) {
            const cData = XLSX.utils.sheet_to_json(wb.Sheets['Clients']) as any[];
            restoredData.clients = cData.map(c => c.ClientName || Object.values(c)[0] ).filter(Boolean);
        }
        if (wb.SheetNames.includes('LeaveTypes')) {
            const cData = XLSX.utils.sheet_to_json(wb.Sheets['LeaveTypes']) as any[];
            restoredData.leaveTypes = cData.map(c => c.LeaveType || Object.values(c)[0] ).filter(Boolean);
        }

        getObject('payrollVariables', 'PayrollVariables');
        getObject('payeTaxVariables', 'PayeTaxVariables');
        getObject('monthValues', 'MonthValues');
        getObject('hrVariables', 'HrVariables');

        getArray('sites', 'Sites');
        getArray('invoices', 'Invoices');
        getArray('pendingInvoices', 'PendingInvoices');
        getArray('payments', 'Payments');
        getArray('vatPayments', 'VatPayments');
        
        getArray('ledgerCategories', 'LedgerCategories');
        getArray('ledgerVendors', 'LedgerVendors');
        getArray('ledgerBanks', 'LedgerBanks');
        getArray('ledgerBeneficiaryBanks', 'LedgerBenBanks');
        getArray('ledgerEntries', 'LedgerEntries');
        getArray('companyExpenses', 'CompanyExpenses');

        getArray('disciplinaryRecords', 'Disciplinary');
        getArray('evaluations', 'Evaluations');

        resolve(restoredData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
