const fs = require('fs');
let code = fs.readFileSync('src/pages/FinancialReports.tsx', 'utf8');

// Replace standard variables with Multiple Selection variables
code = code.replace(
  /const \[filterYear, setFilterYear\] = useState<string>\(String\(new Date\(\)\.getFullYear\(\)\)\);\s*const \[filterMonth, setFilterMonth\] = useState<string>\('All'\);\s*const \[filterClient, setFilterClient\] = useState<string>\('All'\);\s*const \[priorPeriodLimit, setPriorPeriodLimit\] = useState<'none' \| 'all' \| 'this-year' \| 'prev-month' \| 'prev-2-months'>\('none'\);/,
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));\n  const [filterMonth, setFilterMonth] = useState<string>('All');\n  const [filterClient, setFilterClient] = useState<string>('All');\n  const [priorPeriodLimit, setPriorPeriodLimit] = useState<'none' | 'all' | 'this-year' | 'prev-month' | 'prev-2-months'>('all');
);

code = code.replace(
  /const \[summaryTab, setSummaryTab\] = useState<'client' \| 'site'>\('client'\);/,
  const [summaryTab, setSummaryTab] = useState<'client' | 'site' | 'vat'>('client');
);

// We need to carefully replace the useMemo blocks for invoices, payments, vatPayments
const oldFilters =   const invoices = useMemo(() => rawInvoices.filter(i => {
    const normalized = normalizeDate(i.date);
    const matchY = filterYear === 'All' || (normalized && normalized.startsWith(filterYear));
    let matchM = filterMonth === 'All';
    if (!matchM) {
      if (normalized) {
        matchM = parseInt(normalized.substring(5, 7), 10) === parseInt(filterMonth, 10);
      } else if (i.date && i.date.includes('/')) {
        const parts = i.date.split('/');
        if (parts.length === 3) matchM = parseInt(parts[1], 10) === parseInt(filterMonth, 10);
      }
    }
    const matchC = filterClient === 'All' || (i.client || '').trim() === filterClient.trim();
    return matchY && matchM && matchC;
  }), [rawInvoices, filterYear, filterMonth, filterClient]);;

const newFilters =   const selectedYears = useMemo(() => {
    if (filterYear === 'All') return availableYears;
    if (!filterYear) return [];
    return filterYear.split(',').map((year) => year.trim()).filter(Boolean);
  }, [filterYear, availableYears]);

  const selectedMonths = useMemo(() => {
    if (filterMonth === 'All') return MONTHS_LIST.map(m => m.value);
    if (!filterMonth) return [];
    return filterMonth
      .split(',')
      .map((month) => parseInt(month, 10))
      .filter((value) => !Number.isNaN(value) && value >= 1 && value <= 12);
  }, [filterMonth]);

  const yearMatches = (yearStr: string) => selectedYears.includes(yearStr);
  const monthMatches = (monthValue: number) => selectedMonths.includes(monthValue);

  const yearDisplayLabel = filterYear === 'All'
    ? 'All Years'
    : selectedYears.length === 0
      ? '0 selected'
      : selectedYears.length === 1
        ? selectedYears[0]
        : \\ selected\;

  const monthDisplayLabel = filterMonth === 'All'
    ? 'All Months'
    : selectedMonths.length === 0
      ? '0 selected'
      : selectedMonths.length === 1
        ? MONTHS_LIST.find(m => m.value === selectedMonths[0])?.label || '0 selected'
        : \\ selected\;

  const invoices = useMemo(() => rawInvoices.filter(i => {
    const normalized = normalizeDate(i.date);
    let matchY = normalized ? yearMatches(normalized.substring(0, 4)) : false;
    let matchM = normalized ? monthMatches(parseInt(normalized.substring(5, 7), 10)) : false;

    if (!normalized && i.date && i.date.includes('/')) {
      const parts = i.date.split('/');
      if (parts.length === 3) {
        matchM = monthMatches(parseInt(parts[1], 10));
        matchY = yearMatches(parts[2]);
      }
    }

    const matchC = filterClient === 'All' || (i.client || '').trim() === filterClient.trim();
    return matchY && matchM && matchC;
  }), [rawInvoices, filterYear, filterMonth, filterClient, availableYears]);;

code = code.replace(oldFilters, newFilters);

const oldPayments =   const payments = useMemo(() => rawPayments.filter(p => {
    const normalized = normalizeDate(p.date);
    const matchY = filterYear === 'All' || (normalized && normalized.startsWith(filterYear));
    let matchM = filterMonth === 'All';
    if (!matchM) {
      if (normalized) {
        matchM = parseInt(normalized.substring(5, 7), 10) === parseInt(filterMonth, 10);
      } else if (p.date && p.date.includes('/')) {
        const parts = p.date.split('/');
        if (parts.length === 3) matchM = parseInt(parts[1], 10) === parseInt(filterMonth, 10);
      }
    }
    const matchC = filterClient === 'All' || (p.client || '').trim() === filterClient.trim();
    return matchY && matchM && matchC;
  }), [rawPayments, filterYear, filterMonth, filterClient]);;

const newPayments =   const payments = useMemo(() => rawPayments.filter(p => {
    const normalized = normalizeDate(p.date);
    let matchY = normalized ? yearMatches(normalized.substring(0, 4)) : false;
    let matchM = normalized ? monthMatches(parseInt(normalized.substring(5, 7), 10)) : false;

    if (!normalized && p.date && p.date.includes('/')) {
      const parts = p.date.split('/');
      if (parts.length === 3) {
        matchM = monthMatches(parseInt(parts[1], 10));
        matchY = yearMatches(parts[2]);
      }
    }

    const matchC = filterClient === 'All' || (p.client || '').trim() === filterClient.trim();
    return matchY && matchM && matchC;
  }), [rawPayments, filterYear, filterMonth, filterClient, availableYears]);;

code = code.replace(oldPayments, newPayments);

fs.writeFileSync('src/pages/FinancialReports.tsx', code);
console.log('Patch step 1 applied.');
