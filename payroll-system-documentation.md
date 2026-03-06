# **Documentation: Integrated Attendance and Payroll System**

## **Introduction**
This system is designed to manage workforce attendance and payroll within a construction company environment. It integrates daily attendance tracking with payroll computation, ensuring that salaries, overtime, and statutory deductions are calculated accurately and transparently. Built entirely in Excel with VBA automation, it functions as a **mini HR and Finance application**.

---

## **1. Attendance Management (Daily Register)**
The **Daily Register** sheet serves as the attendance database. Each record captures:

- **Identifiers**: Date, Staff Name, Position.  
- **Assignments**: Day Site, Night Site, linked to client names.  
- **Attendance Flags**: Day (Yes/No), Night (Yes/No), Absent Status.  
- **Overtime Triggers**: OT column, NDW (Next Day Work), Day of Week (DOW).  
- **Counters**: IS PRESENT, day2 (total shifts worked).

### **Business Rules**
- **Sundays and Holidays**: No default “Office” assignment unless overridden.  
- **Overtime**: Triggered if staff work on Sundays, holidays, or double shifts.  
- **NDW**: Flags if staff are scheduled again the next day, even across weekends or holidays.  

👉 This ensures attendance records are consistent, calendar-aware, and ready for payroll integration.

---

## **2. MonthlyPay Function**
The `MonthlyPay` function translates attendance into salary impact.

- **Inputs**: First Name, Surname, Month.  
- **Process**:
  - Pulls official workdays for the month from `MonthsValues`.  
  - Retrieves fixed salary from `Worker_details`.  
  - Counts actual workdays (Day=Yes) in the Daily Register.  
  - Caps at official workdays.  
- **Output**:
  \[
  \text{Monthly Pay} = \frac{\text{Salary}}{\text{Official Workdays}} \times \text{Actual Workdays}
  \]

👉 Staff are paid proportionally to the days they actually worked.

---

## **3. Overtime Function**
The `Overtime` function calculates extra pay for overtime shifts.

- **Inputs**: First Name, Surname, Month.  
- **Process**:
  - Retrieves salary and official workdays.  
  - Reads overtime rate from `MonthsValues`.  
  - Counts OT instances (Day=Yes AND OT>0).  
- **Output**:
  \[
  \text{Overtime Pay} = \text{OT Instances} \times (\text{Daily Rate} \times (1 + \text{OT Rate}))
  \]

👉 Overtime pay is directly tied to attendance records and monthly rates.

---

## **4. Payroll Sheet**
The **Payroll Sheet** integrates HR data, attendance, and financial rules.

### **Data Pulled from Worker_details**
- Staff details: Name, Job Title, Bank, Account Number.  
- Fixed salaries and allowances.  

### **Salary & Allowances**
- Salary column uses `MonthlyPay` for Operations staff, or fixed salary otherwise.  
- Allowances: Basic, Housing, Transport, Other.  
- House Rent Allowance: capped at ₦500,000.  
- Overtime Pay: from `Overtime` function.  

### **Gross Pay**
\[
\text{Gross Pay} = \text{Salary} + \text{Allowances} + \text{Overtime}
\]

---

## **5. NIGERIATAX Function**
The `NIGERIATAX` function enforces Nigerian PAYE tax rules.

- **Inputs**: Monthly Income, Pension, Overtime, Rent Relief.  
- **Process**:
  - Annual Gross = Monthly × 12 + Overtime.  
  - CRA = ₦800,000 + Rent Relief + Pension.  
  - Annual Taxable = Gross – CRA.  
  - Applies progressive tax bands (15%–25%).  
- **Output**:
  \[
  \text{PAYE} = \frac{\text{Annual Tax}}{12}
  \]

👉 Ensures compliance with statutory tax obligations.

---

## **6. Deductions Layer**
- **PAYE Tax** → from `NIGERIATAX`.  
- **Loan Repayment** → from `LOANS` and `REPAYMENTS` tables.  
- **Pension** → 8% of allowances (if PAYE applies).  

---

## **7. Net Salary (Take Home Pay)**
Final computation:
\[
\text{Take Home Pay} = \text{Gross Pay} - (\text{PAYE} + \text{Loan Repayment} + \text{Pension})
\]

👉 This is the amount transferred to the employee’s bank account.

---

## **End-to-End Workflow**

```
[Daily Register: Attendance]
   → Tracks workdays, overtime, absences

        ↓

[MonthlyPay Function]
   → Adjusts salary based on actual workdays

        ↓

[Overtime Function]
   → Calculates overtime pay

        ↓

[Payroll Sheet]
   → Combines salary, allowances, overtime → Gross Pay

        ↓

[NIGERIATAX Function]
   → Calculates PAYE tax

        ↓

[Deductions Layer]
   → Applies tax, loans, pension

        ↓

[Net Salary: Take Home Pay]
   → Final amount paid to staff
```

---

## **Conclusion**
This integrated system transforms Excel into a **comprehensive HR and Finance tool**. It ensures:
- Attendance is tracked daily with precision.  
- Salaries are adjusted fairly based on actual workdays.  
- Overtime is rewarded accurately.  
- Taxes, loans, and pensions are deducted in compliance with Nigerian law.  
- Net salary is calculated transparently and consistently.

In short, it is a **workflow engine**:  
**Attendance → Payroll → Tax → Net Pay.**
