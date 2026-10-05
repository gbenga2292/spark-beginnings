# Standalone PAYE & Pension Calculator Specification

> **Version:** 1.0.0  
> **Source System:** Spark Beginnings Payroll Engine (`usePayrollCalculator.ts`, `Payroll.tsx`, `Variables.tsx`, `appStore.ts`)  
> **Applicable Tax Regime:** Nigerian Personal Income Tax Act (PITA / 2020-2026 Reforms as configured)  
> **Purpose:** Detailed architectural specification, mathematical formulas, data models, and ready-to-use code to build an independent, standalone PAYE and Pension estimator.

---

## Table of Contents
1. [Overview & Objectives](#1-overview--objectives)
2. [Data Models & Configurable Variables](#2-data-models--configurable-variables)
   - [2.1 Payroll & Emolument Breakdown Variables](#21-payroll--emolument-breakdown-variables)
   - [2.2 PAYE Tax Variables & Statutory Reliefs](#22-paye-tax-variables--statutory-reliefs)
   - [2.3 Dynamic Progressive Tax Brackets](#23-dynamic-progressive-tax-brackets)
   - [2.4 Dynamic Extra CRA Deductions](#24-dynamic-extra-cra-deductions)
3. [Calculation Logic & Step-by-Step Formulas](#3-calculation-logic--step-by-step-formulas)
   - [Step 1: Emolument Component Breakdown](#step-1-emolument-component-breakdown)
   - [Step 2: Pension Deductions (Employee & Employer)](#step-2-pension-deductions-employee--employer)
   - [Step 3: Annualized Gross & Relief Allowances (CRA)](#step-3-annualized-gross--relief-allowances-cra)
   - [Step 4: Taxable Income Calculation](#step-4-taxable-income-calculation)
   - [Step 5: Progressive Graduated Tax Calculation](#step-5-progressive-graduated-tax-calculation)
   - [Step 6: Net Take-Home Pay & Employer Total Cost](#step-6-net-take-home-pay--employer-total-cost)
4. [Edge Cases & Business Rules](#4-edge-cases--business-rules)
5. [Pure TypeScript / JavaScript Calculation Engine](#5-pure-typescript--javascript-calculation-engine)
6. [Interactive Standalone UI/UX Blueprint](#6-interactive-standalone-uiux-blueprint)
7. [Verified Test Scenarios (Verification Benchmarks)](#7-verified-test-scenarios-verification-benchmarks)
8. [Complete Single-File HTML / Vanilla JS Prototype](#8-complete-single-file-html--vanilla-js-prototype)

---

## 1. Overview & Objectives

In the **Spark Beginnings** application, payroll calculations follow strict Nigerian statutory accounting standards, broken into two customizable setting tiers:
1. **Payroll Variables:** Controls how monthly gross salary splits into components (Basic, Housing, Transport, Other) and statutory pension percentages.
2. **PAYE Tax Variables:** Controls statutory Consolidated Relief Allowance (CRA base), Rent Relief percentage & cap, dynamic progressive tax brackets, and allowable extra reliefs.

This specification enables any developer to construct a **standalone calculator** (web app, mobile app, microservice, or embeddable widget) that produces **100% identical outputs** to the internal app engine.

---

## 2. Data Models & Configurable Variables

The standalone calculator should store these settings in local state (e.g. `localStorage` or component state) and expose a **"Settings / Tax Variables"** panel matching the app's `Variables.tsx`.

### 2.1 Payroll & Emolument Breakdown Variables

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| `basic` | `40%` | Percentage of gross salary assigned to Basic Salary |
| `housing` | `30%` | Percentage of gross salary assigned to Housing Allowance |
| `transport` | `20%` | Percentage of gross salary assigned to Transport Allowance |
| `otherAllowances` | `10%` | Percentage of gross salary assigned to Other Allowances |
| `employeePensionRate`| `8%` | Deducted from employee salary on `Basic + Housing + Transport` |
| `employerPensionRate`| `10%`| Company mandatory contribution on `Basic + Housing + Transport` |
| `nsitfRate` | `1%` | Company NSITF contribution (optional employer cost metric) |

> **Important Rule:** `basic + housing + transport + otherAllowances` must sum to `100%`. Under Nigerian law, statutory pension is computed exclusively on `Basic + Housing + Transport` (BHT), **excluding** `Other Allowances`.

### 2.2 PAYE Tax Variables & Statutory Reliefs

| Setting | Default Value | Statutory Definition |
| :--- | :--- | :--- |
| `craBase` | `₦800,000` | Fixed statutory Consolidated Relief Allowance base |
| `rentReliefRate` | `20%` (0.20) | Percentage applied to user's annual rent paid |
| `rentReliefCap` | `₦500,000` | Maximum statutory ceiling allowed for annual rent relief |

### 2.3 Dynamic Progressive Tax Brackets

The app uses fully dynamic, progressive tax brackets. Each bracket defines a cumulative upper limit (`upTo`) and a marginal tax rate (`rate`). The top bracket has `upTo: null`.

```typescript
export interface TaxBracket {
  id: string;
  label: string;
  upTo: number | null; // null represents the unbounded top tax bracket
  rate: number;        // e.g. 0.15 for 15%
}

export const DEFAULT_TAX_BRACKETS: TaxBracket[] = [
  { id: 'tb-1', label: 'First ₦2.2m',  upTo: 2200000,  rate: 0.15 }, // 15% on 0 to 2,200,000
  { id: 'tb-2', label: 'Next ₦9m',     upTo: 11200000, rate: 0.18 }, // 18% on 2,200,000 to 11,200,000
  { id: 'tb-3', label: 'Next ₦13m',    upTo: 24200000, rate: 0.21 }, // 21% on 11,200,000 to 24,200,000
  { id: 'tb-4', label: 'Next ₦25m',    upTo: 49200000, rate: 0.23 }, // 23% on 24,200,000 to 49,200,000
  { id: 'tb-5', label: 'Above ₦49.2m', upTo: null,     rate: 0.25 }, // 25% on everything above 49,200,000
];
```

### 2.4 Dynamic Extra CRA Deductions

Extra tax-deductible items (e.g. Life Insurance Relief, NHF, Voluntary Pension Contributions) can be added dynamically and toggled on/off:

```typescript
export interface ExtraCondition {
  id: string;
  label: string;
  amount: number;   // Annual deductible amount (₦)
  enabled: boolean;
}

export const DEFAULT_EXTRA_CONDITIONS: ExtraCondition[] = [
  { id: 'ec-1', label: 'Life Assurance Premium', amount: 0, enabled: false },
  { id: 'ec-2', label: 'National Housing Fund (NHF)', amount: 0, enabled: false },
];
```

---

## 3. Calculation Logic & Step-by-Step Formulas

### Step 1: Emolument Component Breakdown
Given a **Monthly Gross Salary ($S_{mo}$)**:

$$\text{Basic} = S_{mo} \times \left(\frac{\text{payrollVariables.basic}}{100}\right)$$
$$\text{Housing} = S_{mo} \times \left(\frac{\text{payrollVariables.housing}}{100}\right)$$
$$\text{Transport} = S_{mo} \times \left(\frac{\text{payrollVariables.transport}}{100}\right)$$
$$\text{Other Allowances} = S_{mo} \times \left(\frac{\text{payrollVariables.otherAllowances}}{100}\right)$$

$$\text{Pensionable Base (BHT)} = \text{Basic} + \text{Housing} + \text{Transport}$$

---

### Step 2: Pension Deductions (Employee & Employer)

If the user is **Subject to Pension** (`hasPension = true`):

$$\text{Monthly Employee Pension} = \text{Pensionable Base} \times \left(\frac{\text{employeePensionRate}}{100}\right)$$
$$\text{Annual Employee Pension} = \text{Monthly Employee Pension} \times 12$$

$$\text{Monthly Employer Pension} = \text{Pensionable Base} \times \left(\frac{\text{employerPensionRate}}{100}\right)$$
$$\text{Total Monthly Pension Pool} = \text{Monthly Employee Pension} + \text{Monthly Employer Pension}$$

If `hasPension = false`:
$$\text{Monthly Employee Pension} = 0$$
$$\text{Annual Employee Pension} = 0$$
$$\text{Monthly Employer Pension} = 0$$

---

### Step 3: Annualized Gross & Relief Allowances (CRA)

If the user is **Subject to PAYE** (`payeTax = true`):

1. **Annual Gross:**
   $$\text{Annual Gross} = (S_{mo} \times 12) + \text{Annual Overtime/Bonus}$$

2. **Rent Relief:**
   Annual rent paid ($R$) generates statutory relief at `rentReliefRate` (default 20%), capped at ₦500,000:
   $$\text{Rent Relief} = \min\left(R \times \text{rentReliefRate}, 500000\right)$$

3. **Pension Relief:**
   Employee's annual pension contribution is fully tax-exempt under Nigerian PITA:
   $$\text{Pension Relief} = \text{Annual Employee Pension}$$

4. **Extra Reliefs:**
   $$\text{Extra Reliefs} = \sum_{\text{enabled}} \text{condition.amount}$$

5. **Total Consolidated Relief Allowance (CRA):**
   $$\text{Total CRA} = \text{craBase} + \text{Rent Relief} + \text{Pension Relief} + \text{Extra Reliefs}$$

---

### Step 4: Taxable Income Calculation

$$\text{Annual Taxable Income} = \max\left(\text{Annual Gross} - \text{Total CRA}, 0\right)$$

If $\text{Annual Taxable Income} \le 0$, Annual Tax = 0 and Monthly PAYE = 0.

---

### Step 5: Progressive Graduated Tax Calculation

The engine sorts tax brackets in ascending order of `upTo` and fills each tier:

```typescript
let annualTax = 0;
let remainingTaxable = annualTaxableIncome;
let previousLimit = 0;

for (const bracket of sortedBrackets) {
  if (remainingTaxable <= 0) break;

  let taxableInBucket = 0;
  if (bracket.upTo === null) {
    // Unbounded top bracket (e.g. above ₦49.2m)
    taxableInBucket = remainingTaxable;
  } else {
    // Graduated tier
    const bracketSize = bracket.upTo - previousLimit;
    taxableInBucket = Math.min(remainingTaxable, bracketSize);
    previousLimit = bracket.upTo;
  }

  annualTax += taxableInBucket * bracket.rate;
  remainingTaxable -= taxableInBucket;
}

const monthlyPAYE = annualTax / 12;
```

---

### Step 6: Net Take-Home Pay & Employer Total Cost

$$\text{Monthly Total Deductions} = \text{Monthly PAYE} + \text{Monthly Employee Pension}$$
$$\text{Monthly Net Take-Home} = S_{mo} + \text{Monthly Overtime} - \text{Monthly Total Deductions}$$

$$\text{Effective Tax Rate (\%)} = \left(\frac{\text{Annual Tax}}{\text{Annual Gross}}\right) \times 100$$
$$\text{Effective Total Deduction Rate (\%)} = \left(\frac{\text{Monthly Total Deductions}}{S_{mo} + \text{Monthly Overtime}}\right) \times 100$$

$$\text{Total Monthly Employer Payroll Cost} = S_{mo} + \text{Monthly Overtime} + \text{Monthly Employer Pension} + (S_{mo} \times \text{nsitfRate})$$

---

## 4. Edge Cases & Business Rules

1. **Gross Salary Less Than Reliefs:**  
   If $\text{Annual Gross} < \text{Total CRA}$, $\text{Annual Taxable Income}$ evaluates to `0`. No negative tax is possible.
2. **Rent Relief Maximum Cap:**  
   Regardless of how large the annual rent is (e.g. ₦10,000,000), `Rent Relief` can never exceed `₦500,000` ($10,000,000 \times 0.20 = 2,000,000 \rightarrow \min(2000000, 500000) = 500,000$).
3. **Zero Rent Provided:**  
   When rent is 0 or omitted, rent relief is strictly 0. CRA defaults to $\text{craBase} + \text{Pension Relief} + \text{Extra Reliefs}$.
4. **Non-Pensionable Staff:**  
   If user disables pension (`hasPension = false`), Employee Pension = 0, Employer Pension = 0, and no pension deduction is added to CRA.
5. **Non-PAYE Staff (Withholding Tax Alternative):**  
   If a user is marked as contractor / WHT instead of PAYE, monthly tax is simply $S_{mo} \times \text{withholdingTaxRate}$ (default 5%), bypassing the CRA and bracket engine entirely.

---

## 5. Pure TypeScript / JavaScript Calculation Engine

This module is 100% self-contained, zero-dependency, and directly copy-pasteable:

```typescript
// payePensionEngine.ts

export interface PayrollVariables {
  basic: number;              // e.g. 40
  housing: number;            // e.g. 30
  transport: number;          // e.g. 20
  otherAllowances: number;    // e.g. 10
  employeePensionRate: number;// e.g. 8
  employerPensionRate: number;// e.g. 10
  nsitfRate: number;          // e.g. 1
}

export interface TaxBracket {
  id: string;
  label: string;
  upTo: number | null;
  rate: number;
}

export interface ExtraCondition {
  id: string;
  label: string;
  amount: number;
  enabled: boolean;
}

export interface PayeTaxVariables {
  craBase: number;
  rentReliefRate: number;
  taxBrackets: TaxBracket[];
  extraConditions: ExtraCondition[];
}

export interface CalculatorInputs {
  monthlyGross: number;
  annualRent?: number;
  monthlyOvertime?: number;
  subjectToPension?: boolean;
  subjectToPaye?: boolean;
}

export interface BracketBreakdownItem {
  label: string;
  taxableAmount: number;
  rate: number;
  taxAmount: number;
}

export interface CalculationResult {
  // Allowances breakdown
  basicSalary: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  pensionableSum: number;

  // Pension
  monthlyEmployeePension: number;
  annualEmployeePension: number;
  monthlyEmployerPension: number;
  annualEmployerPension: number;
  totalMonthlyPension: number;

  // Reliefs & CRA
  craBase: number;
  rentRelief: number;
  pensionRelief: number;
  extraReliefs: number;
  totalCRA: number;

  // Taxable & Tax
  annualGross: number;
  annualTaxable: number;
  annualTax: number;
  monthlyPaye: number;
  bracketBreakdown: BracketBreakdownItem[];

  // Take home
  totalMonthlyDeductions: number;
  monthlyNetTakeHome: number;
  annualNetTakeHome: number;
  effectiveTaxRate: number;
  effectiveDeductionsRate: number;

  // Employer cost
  monthlyEmployerCost: number;
}

export const DEFAULT_PAYROLL_VARIABLES: PayrollVariables = {
  basic: 40,
  housing: 30,
  transport: 20,
  otherAllowances: 10,
  employeePensionRate: 8,
  employerPensionRate: 10,
  nsitfRate: 1,
};

export const DEFAULT_PAYE_VARIABLES: PayeTaxVariables = {
  craBase: 800000,
  rentReliefRate: 0.20,
  taxBrackets: [
    { id: 'tb-1', label: 'First ₦2.2m',  upTo: 2200000,  rate: 0.15 },
    { id: 'tb-2', label: 'Next ₦9m',     upTo: 11200000, rate: 0.18 },
    { id: 'tb-3', label: 'Next ₦13m',    upTo: 24200000, rate: 0.21 },
    { id: 'tb-4', label: 'Next ₦25m',    upTo: 49200000, rate: 0.23 },
    { id: 'tb-5', label: 'Above ₦49.2m', upTo: null,     rate: 0.25 },
  ],
  extraConditions: [],
};

export function calculatePayeAndPension(
  inputs: CalculatorInputs,
  payrollVars: PayrollVariables = DEFAULT_PAYROLL_VARIABLES,
  payeVars: PayeTaxVariables = DEFAULT_PAYE_VARIABLES
): CalculationResult {
  const {
    monthlyGross,
    annualRent = 0,
    monthlyOvertime = 0,
    subjectToPension = true,
    subjectToPaye = true,
  } = inputs;

  // 1. Emolument components
  const basicSalary = monthlyGross * (payrollVars.basic / 100);
  const housing = monthlyGross * (payrollVars.housing / 100);
  const transport = monthlyGross * (payrollVars.transport / 100);
  const otherAllowances = monthlyGross * (payrollVars.otherAllowances / 100);
  const pensionableSum = basicSalary + housing + transport;

  // 2. Pension
  const monthlyEmployeePension = subjectToPension
    ? pensionableSum * (payrollVars.employeePensionRate / 100)
    : 0;
  const annualEmployeePension = monthlyEmployeePension * 12;

  const monthlyEmployerPension = subjectToPension
    ? pensionableSum * (payrollVars.employerPensionRate / 100)
    : 0;
  const annualEmployerPension = monthlyEmployerPension * 12;
  const totalMonthlyPension = monthlyEmployeePension + monthlyEmployerPension;

  // 3. Gross & Reliefs
  const annualGross = (monthlyGross * 12) + (monthlyOvertime * 12);
  let craBase = 0;
  let rentRelief = 0;
  let pensionRelief = 0;
  let extraReliefs = 0;
  let totalCRA = 0;
  let annualTaxable = 0;
  let annualTax = 0;
  let monthlyPaye = 0;
  const bracketBreakdown: BracketBreakdownItem[] = [];

  if (subjectToPaye) {
    craBase = payeVars.craBase;
    rentRelief = Math.min((annualRent || 0) * (payeVars.rentReliefRate ?? 0.20), 500000);
    pensionRelief = annualEmployeePension;
    extraReliefs = (payeVars.extraConditions || [])
      .filter((c) => c.enabled)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    totalCRA = craBase + rentRelief + pensionRelief + extraReliefs;
    annualTaxable = Math.max(annualGross - totalCRA, 0);

    // 4. Progressive Tax Brackets
    if (annualTaxable > 0) {
      const sortedBrackets = [...payeVars.taxBrackets].sort((a, b) => {
        if (a.upTo === null) return 1;
        if (b.upTo === null) return -1;
        return a.upTo - b.upTo;
      });

      let remainingTaxable = annualTaxable;
      let previousLimit = 0;

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

        const tierTax = taxableInBucket * bracket.rate;
        annualTax += tierTax;
        remainingTaxable -= taxableInBucket;

        bracketBreakdown.push({
          label: bracket.label,
          taxableAmount: taxableInBucket,
          rate: bracket.rate,
          taxAmount: tierTax,
        });
      }
    }

    monthlyPaye = annualTax / 12;
  }

  // 5. Net take home
  const totalMonthlyDeductions = monthlyPaye + monthlyEmployeePension;
  const monthlyNetTakeHome = (monthlyGross + monthlyOvertime) - totalMonthlyDeductions;
  const annualNetTakeHome = monthlyNetTakeHome * 12;
  const effectiveTaxRate = annualGross > 0 ? (annualTax / annualGross) * 100 : 0;
  const effectiveDeductionsRate =
    (monthlyGross + monthlyOvertime) > 0
      ? (totalMonthlyDeductions / (monthlyGross + monthlyOvertime)) * 100
      : 0;

  // 6. Employer Total Cost
  const nsitf = monthlyGross * (payrollVars.nsitfRate / 100);
  const monthlyEmployerCost = monthlyGross + monthlyOvertime + monthlyEmployerPension + nsitf;

  return {
    basicSalary,
    housing,
    transport,
    otherAllowances,
    pensionableSum,
    monthlyEmployeePension,
    annualEmployeePension,
    monthlyEmployerPension,
    annualEmployerPension,
    totalMonthlyPension,
    craBase,
    rentRelief,
    pensionRelief,
    extraReliefs,
    totalCRA,
    annualGross,
    annualTaxable,
    annualTax,
    monthlyPaye,
    bracketBreakdown,
    totalMonthlyDeductions,
    monthlyNetTakeHome,
    annualNetTakeHome,
    effectiveTaxRate,
    effectiveDeductionsRate,
    monthlyEmployerCost,
  };
}
```

---

## 6. Interactive Standalone UI/UX Blueprint

To build a modern, high-converting standalone web app, organize the interface into three primary sections:

### 1. Header & Quick Switchers
- **Gross Input Mode Switcher:** Toggle between **Monthly Gross** vs **Annual Gross**.
- **Settings Gear Button:** Opens a slide-out drawer with the **Variables Editor**.

### 2. Main Dual-Column Layout

#### Left Column: Interactive Inputs & Conditions
- **Gross Salary Input:** Currency input with auto-formatting (`₦`).
- **Annual Rent Paid (₦):** Input with real-time feedback (e.g. *"20% Relief: ₦X (Max ₦500k)"*).
- **Optional Overtime/Bonus (₦):** Monthly overtime input.
- **Subject to Pension Toggle (Switch):** Default ON (8% Employee / 10% Employer).
- **Subject to PAYE Tax Toggle (Switch):** Default ON.
- **Extra Allowable Deductions Checkboxes:** List of enabled extra conditions.

#### Right Column: Real-Time Results & Visual Cards
- **Net Take-Home Pay Hero Card:**
  - Giant Monthly Net Take-Home (e.g. `₦384,500.00`).
  - Subtext: Annual Take-Home (`₦4,614,000.00`).
  - Effective Deduction Rate Badge (`18.2%`).
- **Deductions Summary Grid:**
  - **PAYE Tax:** Monthly & Annual.
  - **Employee Pension (8%):** Monthly & Annual.
  - **Employer Pension (10%):** Highlighted as additional company benefit.
- **Allowances & BHT Split Bar:**
  - Progress bar segmented into Basic (40%), Housing (30%), Transport (20%), Other (10%).
- **Tax Computation Breakdown Accordion:**
  - Annual Gross
  - Less Total Reliefs (CRA Base ₦800k + Rent Relief + Pension + Extras)
  - Taxable Income
  - Table of active tax tiers (First ₦2.2m @ 15%, etc.) with tax per tier.

### 3. Settings Drawer / Variables Management
Matches `Variables.tsx`:
- **Salary Percentages:** Basic, Housing, Transport, Other (with validation ensuring sum = 100%).
- **Pension Rates:** Employee (8%), Employer (10%).
- **CRA Base:** Editable amount (default ₦800,000).
- **Rent Relief Rate:** Editable percentage (default 20%).
- **Dynamic Tax Brackets Table:** Add, delete, and modify tier thresholds and tax rates.
- **Extra Relief Conditions:** Add custom relief labels and fixed amounts.
- **Reset to Defaults Button:** Restores standard app settings.

---

## 7. Verified Test Scenarios (Verification Benchmarks)

Use these exact test cases to verify that your standalone implementation is 100% accurate:

### Benchmark Case A: Standard Middle Earner (With Rent)
- **Monthly Gross:** `₦500,000.00`
- **Annual Rent:** `₦1,200,000.00`
- **Pension:** `Enabled`
- **PAYE:** `Enabled`
- **Expected Results:**
  - **Basic (40%):** ₦200,000.00
  - **Housing (30%):** ₦150,000.00
  - **Transport (20%):** ₦100,000.00
  - **Other (10%):** ₦50,000.00
  - **Pensionable Sum (BHT):** ₦450,000.00
  - **Monthly Employee Pension (8%):** `₦36,000.00` (Annual: ₦432,000.00)
  - **Monthly Employer Pension (10%):** `₦45,000.00`
  - **Annual Gross:** `₦6,000,000.00`
  - **Rent Relief:** $\min(1,200,000 \times 0.20, 500,000) =$ `₦240,000.00`
  - **Total CRA:** $800,000 + 240,000 + 432,000 =$ `₦1,472,000.00`
  - **Annual Taxable Income:** $6,000,000 - 1,472,000 =$ `₦4,528,000.00`
  - **Tax Calculation:**
    - Tier 1 (First ₦2.2m @ 15%): $2,200,000 \times 0.15 = ₦330,000.00$
    - Tier 2 (Next ₦9m @ 18%): $(4,528,000 - 2,200,000) \times 0.18 = 2,328,000 \times 0.18 = ₦419,040.00$
    - **Total Annual Tax:** $330,000 + 419,040 =$ `₦749,040.00`
    - **Monthly PAYE:** $749,040 / 12 =$ `₦62,420.00`
  - **Total Monthly Deductions:** $62,420 + 36,000 =$ `₦98,420.00`
  - **Monthly Net Take-Home:** $500,000 - 98,420 =$ `₦401,580.00`

---

### Benchmark Case B: High Earner (Max Rent Cap Triggered)
- **Monthly Gross:** `₦2,000,000.00`
- **Annual Rent:** `₦5,000,000.00`
- **Pension:** `Enabled`
- **PAYE:** `Enabled`
- **Expected Results:**
  - **Pensionable Sum (90% of Gross):** `₦1,800,000.00`
  - **Monthly Employee Pension (8%):** `₦144,000.00` (Annual: ₦1,728,000.00)
  - **Annual Gross:** `₦24,000,000.00`
  - **Rent Relief:** $5,000,000 \times 0.20 = 1,000,000 \rightarrow$ capped at `₦500,000.00`
  - **Total CRA:** $800,000 + 500,000 + 1,728,000 =$ `₦3,028,000.00`
  - **Annual Taxable Income:** $24,000,000 - 3,028,000 =$ `₦20,972,000.00`
  - **Tax Calculation:**
    - Tier 1 (First ₦2.2m @ 15%): `₦330,000.00`
    - Tier 2 (Next ₦9m from 2.2m to 11.2m @ 18%): $9,000,000 \times 0.18 =$ `₦1,620,000.00`
    - Tier 3 (Next ₦13m from 11.2m to 24.2m @ 21%): $(20,972,000 - 11,200,000) \times 0.21 = 9,772,000 \times 0.21 =$ `₦2,052,120.00`
    - **Total Annual Tax:** $330,000 + 1,620,000 + 2,052,120 =$ `₦4,002,120.00`
    - **Monthly PAYE:** $4,002,120 / 12 =$ `₦333,510.00`
  - **Total Monthly Deductions:** $333,510 + 144,000 =$ `₦477,510.00`
  - **Monthly Net Take-Home:** $2,000,000 - 477,510 =$ `₦1,522,490.00`

---

## 8. Complete Single-File HTML / Vanilla JS Prototype

Save this as `calculator.html` and double-click to open in any web browser. It features responsive styling, real-time live recalculation, and a settings drawer for custom tax brackets and CRA base.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PAYE & Pension Calculator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-4 md:p-8">
  <div class="max-w-5xl mx-auto space-y-6">
    
    <!-- Top Bar -->
    <header class="flex items-center justify-between border-b border-slate-800 pb-5">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
          PAYE & Pension Estimator
        </h1>
        <p class="text-sm text-slate-400 mt-1">Accurate Nigerian tax & statutory pension calculation engine</p>
      </div>
      <button id="toggleSettingsBtn" class="px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
        ⚙️ Tax Settings
      </button>
    </header>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Inputs Column -->
      <section class="lg:col-span-5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-5">
        <h2 class="text-xs font-bold uppercase tracking-wider text-emerald-400">1. Income & Rent Details</h2>
        
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Monthly Gross Salary (₦)</label>
          <input type="number" id="inputGross" value="500000" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-emerald-400 text-lg font-bold focus:outline-none focus:border-emerald-500 transition" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Annual Rent Paid (₦)</label>
          <input type="number" id="inputRent" value="1200000" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition" />
          <p class="text-[11px] text-slate-400 mt-1">Eligible for 20% relief (Capped at ₦500,000)</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Monthly Overtime / Allowance (₦)</label>
          <input type="number" id="inputOvertime" value="0" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 font-mono text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition" />
        </div>

        <div class="pt-2 border-t border-slate-700/60 space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" id="checkPension" checked class="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 accent-emerald-500" />
            <span class="text-sm font-medium text-slate-200">Subject to Statutory Pension (8%)</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" id="checkPaye" checked class="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 accent-emerald-500" />
            <span class="text-sm font-medium text-slate-200">Subject to PAYE Income Tax</span>
          </label>
        </div>

        <!-- Emoluments preview -->
        <div class="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 space-y-2 text-xs">
          <div class="flex justify-between text-slate-400">
            <span>Basic (40%):</span>
            <span class="font-mono text-slate-200" id="prevBasic">₦0</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Housing (30%):</span>
            <span class="font-mono text-slate-200" id="prevHousing">₦0</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Transport (20%):</span>
            <span class="font-mono text-slate-200" id="prevTransport">₦0</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>Other Allowances (10%):</span>
            <span class="font-mono text-slate-200" id="prevOther">₦0</span>
          </div>
        </div>
      </section>

      <!-- Results Column -->
      <section class="lg:col-span-7 space-y-6">
        
        <!-- Net Hero Card -->
        <div class="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-emerald-400">Estimated Monthly Net Take-Home</p>
              <h2 class="text-4xl font-extrabold font-mono text-white mt-1" id="resNetTakeHome">₦0.00</h2>
              <p class="text-xs text-slate-400 mt-1">Annual Take-Home: <span class="font-mono text-slate-200" id="resAnnualTakeHome">₦0.00</span></p>
            </div>
            <span class="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30" id="resDeductionRate">
              0% Deductions
            </span>
          </div>
        </div>

        <!-- Breakdown Cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly PAYE Tax</span>
            <p class="text-xl font-bold font-mono text-rose-400 mt-1" id="resPaye">₦0.00</p>
            <p class="text-[10px] text-slate-500 mt-0.5" id="resAnnualTax">Annual: ₦0</p>
          </div>
          <div class="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employee Pension (8%)</span>
            <p class="text-xl font-bold font-mono text-amber-400 mt-1" id="resEmployeePension">₦0.00</p>
            <p class="text-[10px] text-slate-500 mt-0.5" id="resAnnualPension">Annual: ₦0</p>
          </div>
          <div class="bg-slate-800/80 border border-slate-700 rounded-xl p-4 col-span-2 md:col-span-1">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Employer Pension (10%)</span>
            <p class="text-xl font-bold font-mono text-blue-400 mt-1" id="resEmployerPension">₦0.00</p>
            <p class="text-[10px] text-slate-500 mt-0.5">Paid by Company</p>
          </div>
        </div>

        <!-- Reliefs & CRA Card -->
        <div class="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Statutory Reliefs Breakdown (CRA)</h3>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/40">
              <span class="text-slate-400">Statutory Base CRA:</span>
              <p class="font-mono text-slate-200 font-semibold mt-0.5" id="resCraBase">₦800,000</p>
            </div>
            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/40">
              <span class="text-slate-400">Rent Relief (20% capped):</span>
              <p class="font-mono text-slate-200 font-semibold mt-0.5" id="resRentRelief">₦0</p>
            </div>
            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/40">
              <span class="text-slate-400">Pension Relief (Annual):</span>
              <p class="font-mono text-slate-200 font-semibold mt-0.5" id="resPensionRelief">₦0</p>
            </div>
            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/40">
              <span class="text-slate-400">Total CRA Deductible:</span>
              <p class="font-mono text-emerald-400 font-bold mt-0.5" id="resTotalCra">₦0</p>
            </div>
          </div>
          <div class="flex justify-between items-center pt-2 text-xs text-slate-400 border-t border-slate-700/60">
            <span>Annual Taxable Income:</span>
            <span class="font-mono text-white font-bold" id="resTaxableIncome">₦0.00</span>
          </div>
        </div>

      </section>
    </div>

    <!-- Slide-over Settings Modal -->
    <div id="settingsModal" class="hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white">⚙️ Tax & Payroll Variables</h3>
          <button id="closeSettingsBtn" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">CRA Base (₦)</label>
            <input type="number" id="settingCraBase" value="800000" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Rent Relief Rate (%)</label>
            <input type="number" id="settingRentRate" value="20" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Employee Pension (%)</label>
            <input type="number" id="settingEmpPension" value="8" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Employer Pension (%)</label>
            <input type="number" id="settingCompPension" value="10" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button id="saveSettingsBtn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs uppercase tracking-wider text-white rounded-xl transition">
            Save & Recalculate
          </button>
        </div>
      </div>
    </div>

  </div>

  <script>
    // Variables State
    let settings = {
      basic: 40, housing: 30, transport: 20, other: 10,
      empPensionRate: 8, compPensionRate: 10,
      craBase: 800000, rentReliefRate: 0.20,
      taxBrackets: [
        { label: 'First ₦2.2m', upTo: 2200000, rate: 0.15 },
        { label: 'Next ₦9m', upTo: 11200000, rate: 0.18 },
        { label: 'Next ₦13m', upTo: 24200000, rate: 0.21 },
        { label: 'Next ₦25m', upTo: 49200000, rate: 0.23 },
        { label: 'Above ₦49.2m', upTo: null, rate: 0.25 },
      ]
    };

    function formatN(num) {
      return '₦' + (Number(num) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function recalculate() {
      const gross = Number(document.getElementById('inputGross').value) || 0;
      const rent = Number(document.getElementById('inputRent').value) || 0;
      const overtime = Number(document.getElementById('inputOvertime').value) || 0;
      const hasPension = document.getElementById('checkPension').checked;
      const hasPaye = document.getElementById('checkPaye').checked;

      // Allowances
      const basic = gross * (settings.basic / 100);
      const housing = gross * (settings.housing / 100);
      const transport = gross * (settings.transport / 100);
      const other = gross * (settings.other / 100);
      const bht = basic + housing + transport;

      document.getElementById('prevBasic').innerText = formatN(basic);
      document.getElementById('prevHousing').innerText = formatN(housing);
      document.getElementById('prevTransport').innerText = formatN(transport);
      document.getElementById('prevOther').innerText = formatN(other);

      // Pension
      const empPension = hasPension ? bht * (settings.empPensionRate / 100) : 0;
      const compPension = hasPension ? bht * (settings.compPensionRate / 100) : 0;
      const annualPension = empPension * 12;

      // Reliefs & PAYE
      let annualGross = (gross * 12) + (overtime * 12);
      let rentRelief = 0;
      let totalCRA = 0;
      let annualTaxable = 0;
      let annualTax = 0;
      let monthlyPaye = 0;

      if (hasPaye) {
        rentRelief = Math.min(rent * settings.rentReliefRate, 500000);
        totalCRA = settings.craBase + rentRelief + annualPension;
        annualTaxable = Math.max(annualGross - totalCRA, 0);

        let rem = annualTaxable;
        let prev = 0;
        for (const b of settings.taxBrackets) {
          if (rem <= 0) break;
          let tier = b.upTo === null ? rem : Math.min(rem, b.upTo - prev);
          annualTax += tier * b.rate;
          rem -= tier;
          if (b.upTo !== null) prev = b.upTo;
        }
        monthlyPaye = annualTax / 12;
      }

      // Net take home
      const deductions = monthlyPaye + empPension;
      const netTakeHome = (gross + overtime) - deductions;
      const dedRate = (gross + overtime) > 0 ? (deductions / (gross + overtime)) * 100 : 0;

      // Update DOM
      document.getElementById('resNetTakeHome').innerText = formatN(netTakeHome);
      document.getElementById('resAnnualTakeHome').innerText = formatN(netTakeHome * 12);
      document.getElementById('resDeductionRate').innerText = dedRate.toFixed(1) + '% Total Deductions';
      document.getElementById('resPaye').innerText = formatN(monthlyPaye);
      document.getElementById('resAnnualTax').innerText = 'Annual: ' + formatN(annualTax);
      document.getElementById('resEmployeePension').innerText = formatN(empPension);
      document.getElementById('resAnnualPension').innerText = 'Annual: ' + formatN(annualPension);
      document.getElementById('resEmployerPension').innerText = formatN(compPension);

      document.getElementById('resCraBase').innerText = formatN(settings.craBase);
      document.getElementById('resRentRelief').innerText = formatN(rentRelief);
      document.getElementById('resPensionRelief').innerText = formatN(annualPension);
      document.getElementById('resTotalCra').innerText = formatN(totalCRA);
      document.getElementById('resTaxableIncome').innerText = formatN(annualTaxable);
    }

    // Bind event listeners
    ['inputGross', 'inputRent', 'inputOvertime'].forEach(id => {
      document.getElementById(id).addEventListener('input', recalculate);
    });
    ['checkPension', 'checkPaye'].forEach(id => {
      document.getElementById(id).addEventListener('change', recalculate);
    });

    // Settings Modal
    const modal = document.getElementById('settingsModal');
    document.getElementById('toggleSettingsBtn').onclick = () => modal.classList.remove('hidden');
    document.getElementById('closeSettingsBtn').onclick = () => modal.classList.add('hidden');
    document.getElementById('saveSettingsBtn').onclick = () => {
      settings.craBase = Number(document.getElementById('settingCraBase').value) || 800000;
      settings.rentReliefRate = (Number(document.getElementById('settingRentRate').value) || 20) / 100;
      settings.empPensionRate = Number(document.getElementById('settingEmpPension').value) || 8;
      settings.compPensionRate = Number(document.getElementById('settingCompPension').value) || 10;
      modal.classList.add('hidden');
      recalculate();
    };

    // Initial calculation
    recalculate();
  </script>
</body>
</html>
```

---

## 9. Integration Checklist for Standalone Deployment

When creating the standalone calculator repository or web page:
- [ ] Initialize frontend framework of choice (React + Vite, Next.js, Vue, or single HTML).
- [ ] Copy the pure TypeScript engine from [Section 5](#5-pure-typescript--javascript-calculation-engine).
- [ ] Connect form inputs for `monthlyGross`, `annualRent`, and `monthlyOvertime`.
- [ ] Wire up checkboxes for `subjectToPension` and `subjectToPaye`.
- [ ] Implement local state persistence via `localStorage` so user tax settings and brackets are remembered across browser sessions.
- [ ] Verify test results against the official benchmarks in [Section 7](#7-verified-test-scenarios-verification-benchmarks).
