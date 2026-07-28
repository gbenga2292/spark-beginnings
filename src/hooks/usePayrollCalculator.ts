import { useCallback } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { computeWorkDays, computeWorkDaysInRange } from '@/src/lib/workdays';
import { calculateAttendanceMetrics, getStaffDateWorkedMap } from '@/src/lib/attendanceLogic';
import { getPayrollPeriodDates } from '@/src/lib/dateUtils';
import { getPositionIndex } from '@/src/lib/hierarchy';

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
  const departments = useAppStore((state) => state.departments);

  const currentYear = new Date().getFullYear();

  const calculatePayrollForMonth = useCallback((monthKey: string, year: number = currentYear) => {
    const mKey = monthKey as keyof typeof employees[0]['monthlySalaries'];
    const selectedMonthIndex = MONTHS.findIndex(m => m.key === monthKey) + 1;

    // Get custom payroll period dates
    const { start: periodStart, end: periodEnd } = getPayrollPeriodDates(year, selectedMonthIndex, payrollVariables.periodStartDay);

    const holidayDates = publicHolidays.map(h => h.date);
    const fallbackWorkdays = computeWorkDays(year, selectedMonthIndex, holidayDates, 6);

    const monthConfig = monthValues[mKey as keyof typeof monthValues] || { workDays: fallbackWorkdays, overtimeRate: 0.5 };
    const otRate = monthConfig.overtimeRate;

    const staffDateWorkedMap = getStaffDateWorkedMap(attendanceRecords);
    let snCounter = 1;

    return employees
      .filter(e => {
        // Date-based eligibility using the CUSTOM payroll period boundaries
        if (e.startDate) {
          const empStart = new Date(e.startDate);
          if (empStart > periodEnd) return false;
        }
        if (e.endDate) {
          const empEnd = new Date(e.endDate);
          if (empEnd < periodStart) return false;
        }

        // If current status is not Active or On Leave, only show if they were active in the viewed month
        if (e.status !== 'Active' && e.status !== 'On Leave') {
          if (!e.endDate) return false;
        }

        // Frequency logic for NON-EMPLOYEE (Quarterly/Half Year/Yearly)
        if (e.staffType === 'NON-EMPLOYEE') {
          const cycle = (e as any).typeOfPay || 'Monthly';
          const startMonthLabel = (e as any).startMonthOfPay || 'January';
          const startIdx = MONTHS.findIndex(m => m.label === startMonthLabel);
          const currentIdx = MONTHS.findIndex(m => m.key === monthKey);

          if (startIdx !== -1 && currentIdx !== -1) {
            const diff = currentIdx - startIdx;
            if (diff < 0) return false;

            if (cycle === 'Quarterly') return diff % 3 === 0;
            if (cycle === 'Half Year') return diff % 6 === 0;
            if (cycle === 'Yearly') return diff % 12 === 0;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const idxA = getPositionIndex(a.position);
        const idxB = getPositionIndex(b.position);
        if (idxA !== idxB) return idxA - idxB;
        return (a.position || '').localeCompare(b.position || '');
      })
      .map((emp) => {
        let whtRateToStore = 0;
        const standardSalary = emp.monthlySalaries[mKey] || 0;

        const defaultDays = emp.staffType === 'FIELD' ? 6 : 5;
        const deptRecord = departments.find(d => d.name === emp.department);
        const empWorkDaysPerWeek = deptRecord?.workDaysPerWeek ?? defaultDays;
        const empOfficialWorkdays = computeWorkDays(year, selectedMonthIndex, holidayDates, empWorkDaysPerWeek);

        let daysWorked = 0;
        let daysAbsent = 0;
        let totalOTInstances = 0;

        for (const r of attendanceRecords) {
          if (!r.date || r.staffId !== emp.id) continue;

          const recordDate = new Date(r.date + 'T12:00:00');
          if (recordDate >= periodStart && recordDate <= periodEnd) {
            const metrics = calculateAttendanceMetrics(r, holidayDates, payrollVariables, monthValues as any, staffDateWorkedMap);

            if (r.day?.toLowerCase() === 'yes') {
              daysWorked += 1;
            } else if (r.day?.toLowerCase() === 'no') {
              const st = (r as any).absentStatus?.toUpperCase() || '';
              const isRealAbsence = ["ABSENT", "NO WORK", "ABSENT WITHOUT PERMIT", "SUSPENSION", "OFF DUTY"].includes(st);
              if (isRealAbsence) {
                daysAbsent += 1;
              }
            }

            if (metrics.ot > 0) {
              totalOTInstances += 1;
            }
          }
        }

        if (daysWorked > empOfficialWorkdays) daysWorked = empOfficialWorkdays;

        let salary = 0;
        let overtime = 0;

        if (standardSalary > 0 && empOfficialWorkdays > 0) {
          const dailyRate = standardSalary / empOfficialWorkdays;
          const isFieldStaff = emp.staffType === 'FIELD';

          let salaryBase = standardSalary;
          if (emp.startDate) {
            const empJoin = new Date(emp.startDate);
            const isJoinWithinPeriod = empJoin > periodStart && empJoin <= periodEnd;
            if (isJoinWithinPeriod) {
              const workdaysFromJoin = computeWorkDaysInRange(
                empJoin > periodStart ? empJoin : periodStart,
                periodEnd,
                holidayDates,
                empWorkDaysPerWeek
              );
              salaryBase = standardSalary * (workdaysFromJoin / empOfficialWorkdays);
            }
          }

          if (isFieldStaff) {
            salary = dailyRate * daysWorked;
          } else {
            salary = salaryBase - (dailyRate * daysAbsent);
            if (salary < 0) salary = 0;
          }

          overtime = totalOTInstances * (dailyRate * (1 + otRate));
        }

        const hasPension = (emp.subjectToPension !== undefined && emp.subjectToPension !== null)
          ? (emp.subjectToPension && emp.staffType !== 'NON-EMPLOYEE')
          : (emp.payeTax && emp.staffType !== 'NON-EMPLOYEE');

        const basicSalary = emp.payeTax ? salary * (payrollVariables.basic / 100) : 0;
        const housing = emp.payeTax ? salary * (payrollVariables.housing / 100) : 0;
        const transport = emp.payeTax ? salary * (payrollVariables.transport / 100) : 0;
        const otherAllowances = emp.payeTax ? salary * (payrollVariables.otherAllowances / 100) : 0;

        const totalAllowances = basicSalary + housing + transport + otherAllowances;
        const pensionSum = basicSalary + housing + transport;
        const grossPay = salary + overtime;

        const pension = hasPension ? pensionSum * (payrollVariables.employeePensionRate / 100) : 0;

        let paye = 0;
        let withholdingTax = 0;
        if (emp.payeTax) {
          const tv = payeTaxVariables;
          const annualGross = (salary * 12) + overtime;
          const pensionAmt = hasPension ? (pensionSum * 12) * (payrollVariables.employeePensionRate / 100) : 0;
          const extraCRA = tv.extraConditions.filter(c => c.enabled).reduce((s, c) => s + c.amount, 0);
          const rentRelief = Math.min((emp.rent || 0) * (tv.rentReliefRate ?? 0.20), 500000);
          const cra = tv.craBase + rentRelief + pensionAmt + extraCRA;
          const annualTaxable = Math.max(annualGross - cra, 0);

          let annualTax = 0;
          let remainingTaxable = annualTaxable;
          let previousLimit = 0;

          if (annualTaxable > 0) {
            const sortedBrackets = [...tv.taxBrackets].sort((a, b) => {
              if (a.upTo === null) return 1;
              if (b.upTo === null) return -1;
              return a.upTo - b.upTo;
            });

            for (const bracket of sortedBrackets) {
              if (remainingTaxable <= 0) break;

              let taxableInBucket = 0;
              if (bracket.upTo === null) {
                taxableInBucket = remainingTaxable;
              } else {
                const bracketSize = bracket.upTo - previousLimit;
                taxableInBucket = Math.min(remainingTaxable, bracketSize);
                previousLimit = bracket.upTo;
              }

              annualTax += taxableInBucket * bracket.rate;
              remainingTaxable -= taxableInBucket;
            }
          }

          paye = annualTax / 12;
        } else if (emp.withholdingTax) {
          const whtRate = (emp as any).withholdingTaxRate ?? 0.05;
          withholdingTax = salary * whtRate;
          whtRateToStore = whtRate;
        }

        const empAdvances = salaryAdvances.filter(a => {
          if (a.employeeId !== emp.id) return false;
          if (a.status !== 'Approved' && a.status !== 'Deducted') return false;
          if (!a.requestDate) return false;
          const advanceDate = new Date(a.requestDate + 'T12:00:00');
          return advanceDate >= periodStart && advanceDate <= periodEnd;
        });
        const advanceDeduction = empAdvances.reduce((sum, a) => sum + a.amount, 0);

        const empLoans = loans.filter(l => {
          if (l.employeeId !== emp.id) return false;
          if (l.status !== 'Active' && l.status !== 'Completed' && l.status !== 'Approved') return false;
          if (!l.paymentStartDate) return false;

          const loanStart = new Date(l.paymentStartDate + 'T12:00:00');
          const periodStartMonth = year * 12 + selectedMonthIndex - 1;
          const loanStartMonth = loanStart.getFullYear() * 12 + loanStart.getMonth();
          const monthsElapsed = periodStartMonth - loanStartMonth;

          return monthsElapsed >= 0 && monthsElapsed < l.duration;
        });
        const loanDeduction = empLoans.reduce((sum, l) => sum + l.monthlyDeduction, 0);

        const loanRepayment = advanceDeduction + loanDeduction;

        const takeHomePay = grossPay - (paye + withholdingTax + loanRepayment + pension);

        const employerPension = hasPension ? pensionSum * (payrollVariables.employerPensionRate / 100) : 0;
        const nsitf = emp.payeTax ? grossPay * (payrollVariables.nsitfRate / 100) : 0;

        return {
          id: emp.id,
          employeeCode: emp.employeeCode,
          sn: snCounter++,
          surname: emp.surname,
          firstname: emp.firstname,
          position: emp.position,
          department: emp.department,
          staffType: emp.staffType,
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
          withholdingTax,
          withholdingTaxRate: whtRateToStore,
          loanRepayment,
          pension,
          employerPension,
          nsitf,
          takeHomePay,
          hasPension,
          taxId: (emp as any).taxId || '',
          status: 'Pending' as const,
        };
      });
  }, [employees, salaryAdvances, loans, payrollVariables, payeTaxVariables, monthValues, attendanceRecords, publicHolidays, departments, currentYear]);

  return { calculatePayrollForMonth, MONTHS };
}

