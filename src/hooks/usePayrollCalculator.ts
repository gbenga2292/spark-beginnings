import { useCallback } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { computeWorkDays } from '@/src/lib/workdays';

const OPERATIONS_DEPARTMENTS = ['OPERATIONS', 'ENGINEERING'];

const MONTHS = [
  { key: 'jan', label: 'January' },
  { key: 'feb', label: 'February' },
  { key: 'mar', label: 'March' },
  { key: 'apr', label: 'April' },
  { key: 'may', label: 'May' },
  { key: 'jun', label: 'June' },
  { key: 'jul', label: 'July' },
  { key: 'aug', label: 'August' },
  { key: 'sep', label: 'September' },
  { key: 'oct', label: 'October' },
  { key: 'nov', label: 'November' },
  { key: 'dec', label: 'December' },
];

export function usePayrollCalculator() {
  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const payeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const monthValues = useAppStore((state) => state.monthValues);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const publicHolidays = useAppStore((state) => state.publicHolidays);

  const currentYear = new Date().getFullYear();

  const calculatePayrollForMonth = useCallback((monthKey: string) => {
    const mKey = monthKey as keyof typeof employees[0]['monthlySalaries'];
    const selectedMonthIndex = MONTHS.findIndex(m => m.key === monthKey) + 1;

    // Auto-compute workdays for this month from public holidays
    const holidayDates = publicHolidays.map(h => h.date);
    // Keep a generic 6-day default for month config fallback
    const fallbackWorkdays = computeWorkDays(currentYear, selectedMonthIndex, holidayDates, 6);

    const monthConfig = monthValues[mKey as keyof typeof monthValues] || { workDays: fallbackWorkdays, overtimeRate: 0.5 };
    const otRate = monthConfig.overtimeRate;

    let snCounter = 1;

    return employees
      .filter(e => e.status === 'Active')
      .map((emp) => {
        const standardSalary = emp.monthlySalaries[mKey] || 0;

        // Per-department workdays per week (defaults: Ops/Engineering = 6, others = 5)
        const defaultDays = OPERATIONS_DEPARTMENTS.includes(emp.department.toUpperCase()) ? 6 : 5;
        const empWorkDaysPerWeek = payrollVariables.departmentWorkDays?.[emp.department] ?? defaultDays;
        const empOfficialWorkdays = computeWorkDays(currentYear, selectedMonthIndex, holidayDates, empWorkDaysPerWeek);

        // ── Attendance tallies ────────────────────────────────────────────
        let daysWorked = 0;
        let daysAbsent = 0;
        let totalOTInstances = 0;

        for (const r of attendanceRecords) {
          if (r.staffId === emp.id && r.mth === selectedMonthIndex) {
            if (r.day?.toLowerCase() === 'yes') {
              daysWorked += 1;
              if (r.ot > 0) totalOTInstances += 1;
            } else if (r.day?.toLowerCase() === 'no') {
              daysAbsent += 1;
            }
          }
        }

        if (daysWorked > empOfficialWorkdays) daysWorked = empOfficialWorkdays;

        // ── Salary calculation (two-mode) ─────────────────────────────────
        let salary = 0;
        let overtime = 0;

        if (standardSalary > 0 && empOfficialWorkdays > 0) {
          const dailyRate = standardSalary / empOfficialWorkdays;
          const isOperations = OPERATIONS_DEPARTMENTS.includes(emp.department.toUpperCase());

          if (isOperations) {
            salary = dailyRate * daysWorked;
          } else {
            salary = standardSalary - (dailyRate * daysAbsent);
            if (salary < 0) salary = 0;
          }

          overtime = totalOTInstances * (dailyRate * (1 + otRate));
        }

        const basicSalary = emp.payeTax ? salary * (payrollVariables.basic / 100) : 0;
        const housing = emp.payeTax ? salary * (payrollVariables.housing / 100) : 0;
        const transport = emp.payeTax ? salary * (payrollVariables.transport / 100) : 0;
        const otherAllowances = emp.payeTax ? salary * (payrollVariables.otherAllowances / 100) : 0;

        const totalAllowances = basicSalary + housing + transport + otherAllowances;
        const pensionSum = basicSalary + housing + transport;

        const grossPay = salary + overtime;

        const pension = emp.payeTax ? pensionSum * (payrollVariables.employeePensionRate / 100) : 0;

        let paye = 0;
        if (emp.payeTax) {
          const tv = payeTaxVariables;
          const annualGross = (salary * 12) + overtime;
          const pensionAmt = (pensionSum * 12) * (payrollVariables.employeePensionRate / 100);
          const extraCRA = tv.extraConditions.filter(c => c.enabled).reduce((s, c) => s + c.amount, 0);
          const rentRelief = Math.min((emp.rent || 0) * (tv.rentReliefRate ?? 0.20), 500000);
          const cra = tv.craBase + rentRelief + pensionAmt + extraCRA;
          const annualTaxable = Math.max(annualGross - cra, 0);

          let annualTax = 0;
          if (annualTaxable <= 0) {
            annualTax = 0;
          } else if (annualTaxable <= 2200000) {
            annualTax = annualTaxable * 0.15;
          } else if (annualTaxable <= 11200000) {
            annualTax = (annualTaxable - 2200000) * 0.18 + 330000;
          } else if (annualTaxable <= 24200000) {
            annualTax = (annualTaxable - 11200000) * 0.21 + (330000 + 1620000);
          } else if (annualTaxable <= 49200000) {
            annualTax = (annualTaxable - 24200000) * 0.23 + (330000 + 1620000 + 2730000);
          } else {
            annualTax = (annualTaxable - 49200000) * 0.25 + (330000 + 1620000 + 2730000 + 5750000);
          }

          paye = annualTax / 12;
        } else if (emp.withholdingTax) {
          paye = salary * ((payrollVariables as any).withholdingTaxRate ?? 0);
        }

        const empAdvances = salaryAdvances.filter(a => {
          if (a.employeeId !== emp.id) return false;
          if (a.status !== 'Approved' && a.status !== 'Deducted') return false;
          if (!a.requestDate) return false;
          const dateParts = a.requestDate.split('-');
          const advanceMonth = parseInt(dateParts[1], 10);
          return advanceMonth === selectedMonthIndex;
        });
        const advanceDeduction = empAdvances.reduce((sum, a) => sum + a.amount, 0);

        const empLoans = loans.filter(l => {
          if (l.employeeId !== emp.id) return false;
          if (l.status !== 'Active' && l.status !== 'Completed') return false;
          if (!l.paymentStartDate) return false;
          const dateParts = l.paymentStartDate.split('-');
          const startYear = parseInt(dateParts[0], 10);
          const startMonth = parseInt(dateParts[1], 10);

          const monthsElapsed = (currentYear - startYear) * 12 + (selectedMonthIndex - startMonth);
          return monthsElapsed >= 0 && monthsElapsed < l.duration;
        });
        const loanDeduction = empLoans.reduce((sum, l) => sum + l.monthlyDeduction, 0);

        const loanRepayment = advanceDeduction + loanDeduction;

        const takeHomePay = grossPay - (paye + loanRepayment + pension);

        const employerPension = emp.payeTax ? pensionSum * (payrollVariables.employerPensionRate / 100) : 0;
        const nsitf = emp.payeTax ? grossPay * (payrollVariables.nsitfRate / 100) : 0;

        return {
          id: emp.id,
          sn: snCounter++,
          surname: emp.surname,
          firstname: emp.firstname,
          position: emp.position,
          department: emp.department,
          bankName: emp.bankName,
          accountNo: emp.accountNo,
          salary,
          basicSalary,
          housing,
          transport,
          otherAllowances,
          totalAllowances,
          overtime,
          grossPay,
          paye,
          loanRepayment,
          pension,
          employerPension,
          nsitf,
          takeHomePay,
          status: 'Pending' as const,
        };
      });
  }, [employees, salaryAdvances, loans, payrollVariables, payeTaxVariables, monthValues, attendanceRecords, publicHolidays, currentYear]);

  return { calculatePayrollForMonth, MONTHS };
}
