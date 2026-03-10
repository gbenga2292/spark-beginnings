import fs from 'fs';

const reportsPath = 'src/pages/Reports.tsx';
const finPath = 'src/pages/FinancialReports.tsx';

let reportsContent = fs.readFileSync(reportsPath, 'utf8');
let finContent = fs.readFileSync(finPath, 'utf8');

const reportsLines = reportsContent.split('\n');
const finLines = finContent.split('\n');

const startIdx = reportsLines.findIndex(l => l.includes('{/* ───────────────── ACCOUNTS REPORTS ───────────────── */}'));
let endIdx = -1;
for (let i = startIdx; i < reportsLines.length; i++) {
  if (reportsLines[i].includes('</Card>') && reportsLines[i+1] && reportsLines[i+1].includes('</div>')) {
    endIdx = i;
    break;
  }
}

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find block", startIdx, endIdx);
    process.exit(1);
}

const cardLines = reportsLines.slice(startIdx, endIdx + 1);
const newReportsLines = [
  ...reportsLines.slice(0, startIdx),
  ...reportsLines.slice(endIdx + 1)
];

const finalReportsContent = newReportsLines.join('\n')
  .replace(/  const loans = useAppStore\(\(state\) => state\.loans\);\r?\n/, '')
  .replace(/  const salaryAdvances = useAppStore\(\(state\) => state\.salaryAdvances\);\r?\n/, '')
  .replace(/  const \[accountsTab, setAccountsTab\] = useState<'payroll' \| 'loans'>\('payroll'\);\r?\n/, '')
  .replace(/  const \[payrollYear, setPayrollYear\] = useState<number>\(.+?\);\r?\n/, '');

const stateInsert = `  const employees = useAppStore(state => state.employees);
  const loans = useAppStore(state => state.loans);
  const salaryAdvances = useAppStore(state => state.salaryAdvances);
  const [accountsTab, setAccountsTab] = useState<'payroll' | 'loans'>('payroll');
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
`;
finContent = finContent.replace("  const [filterYear, setFilterYear] = useState<string>('All');", stateInsert + "  const [filterYear, setFilterYear] = useState<string>('All');");

const lastDivIdx = finContent.lastIndexOf('    </div>');
const beforeDiv = finContent.substring(0, lastDivIdx);
const afterDiv = finContent.substring(lastDivIdx);

const finalFinContent = beforeDiv + '\n' + cardLines.join('\n') + '\n' + afterDiv;

fs.writeFileSync(reportsPath, finalReportsContent);
fs.writeFileSync(finPath, finalFinContent);
console.log('Transfer complete');
