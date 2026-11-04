export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountCategory = 'CURRENT_ASSET' | 'NON_CURRENT_ASSET' | 'FIXED_ASSET' | 'CURRENT_LIABILITY' | 'EQUITY' | 'REVENUE' | 'DIRECT_COST' | 'OPERATING_EXPENSE';

export interface ChartAccount {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  category: AccountCategory;
  description?: string;
}

export const DCEL_CHART_OF_ACCOUNTS: ChartAccount[] = [
  // ─── 1000 - 1320: ASSETS ───
  { code: '1000', name: 'Cash on Hand / Petty Cash', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1010', name: 'Bank — GTBank (NGN)', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1020', name: 'Bank — Zenith Bank (NGN)', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1100', name: 'Accounts Receivable — Trade Clients', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1120', name: 'Withholding Tax (WHT) Credit Notes Recoverable', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1130', name: 'Retention Receivables (5-10%)', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1200', name: 'Inventory — Equipment for Sale', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1210', name: 'Inventory — Spare Parts', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1220', name: 'Inventory — Consumables & Chemicals', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '1250', name: 'Accumulated Depreciation — Equipment & Machinery', type: 'ASSET', category: 'NON_CURRENT_ASSET' },
  { code: '1300', name: 'Dewatering Equipment & Machinery (Rental Fleet)', type: 'ASSET', category: 'NON_CURRENT_ASSET' },
  { code: '1310', name: 'Motor Vehicles & Logistics Trucks', type: 'ASSET', category: 'NON_CURRENT_ASSET' },
  { code: '1320', name: 'Office Furniture & IT Equipment', type: 'ASSET', category: 'NON_CURRENT_ASSET' },

  // ─── 2000 - 2200: LIABILITIES ───
  { code: '2000', name: 'Accounts Payable — Trade Vendors & Suppliers', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2100', name: 'VAT Output Payable (7.5%)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2110', name: 'VAT Input Receivable (7.5%)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2120', name: 'Withholding Tax (WHT) Payable to FIRS', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2130', name: 'PAYE & State Tax Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2140', name: 'Pension & NHF Remittances Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '2200', name: 'Client Mobilization Deposits', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },

  // ─── 3000 - 3100: EQUITY ───
  { code: '3000', name: 'Share Capital / Owner Equity', type: 'EQUITY', category: 'EQUITY' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', category: 'EQUITY' },

  // ─── 4000 - 4060: REVENUE STREAMS ───
  { code: '4000', name: 'Revenue — Dewatering Services', type: 'INCOME', category: 'REVENUE' },
  { code: '4010', name: 'Revenue — Waterproofing Services', type: 'INCOME', category: 'REVENUE' },
  { code: '4020', name: 'Revenue — Allied & Ground Improvement Services', type: 'INCOME', category: 'REVENUE' },
  { code: '4030', name: 'Revenue — Equipment Sales', type: 'INCOME', category: 'REVENUE' },
  { code: '4040', name: 'Revenue — Equipment Maintenance & Overhaul', type: 'INCOME', category: 'REVENUE' },
  { code: '4050', name: 'Revenue — Spare Parts Sales', type: 'INCOME', category: 'REVENUE' },
  { code: '4060', name: 'Revenue — Equipment Rental Fleet', type: 'INCOME', category: 'REVENUE' },

  // ─── 5000 - 5060: DIRECT OPERATIONAL COSTS ───
  { code: '5000', name: 'Cost of Equipment & Spares Sold', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5010', name: 'Direct Labor — Field Technicians & Operators', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5020', name: 'Site Materials & Consumables Consumed', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5030', name: 'Site Diesel & Fuel Consumed', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5040', name: 'Subcontractor & Specialist Hire', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5050', name: 'Equipment Mobilization & Transport Cost', type: 'EXPENSE', category: 'DIRECT_COST' },
  { code: '5060', name: 'Equipment Running Maintenance on Site', type: 'EXPENSE', category: 'DIRECT_COST' },

  // ─── 5100 - 5170: OPERATING EXPENSES (OPEX) ───
  { code: '5100', name: 'Depreciation Expense — Equipment & Machinery', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5110', name: 'Administrative Salaries & Staff Welfare', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5120', name: 'Office Rent & Yard Lease', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5130', name: 'Utilities & Communications', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5140', name: 'Motor Vehicle Running & Logistics', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5150', name: 'Legal, Audit & Professional Fees', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5160', name: 'Bank Charges & Transaction Fees', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5170', name: 'General Administration & Operating Overhead', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
];

export const DEFAULT_CATEGORY_COA_MAP: Record<string, string> = {
  // Direct Costs (5000 - 5060)
  'payroll expenses': '5010',
  'salary': '5010',
  'direct cost': '5020',
  'cost of goods': '5000',
  'petrol (vehicle)': '5030',
  'office consumables:petrol': '5030',
  'office consumables:diesel': '5030',
  'diesel': '5030',
  're-embursable expense': '5040',
  'reimbursable expense': '5040',
  'local transport': '5050',
  'machine maintenance': '5060',
  'repairs and maintenance': '5060',
  'tools and small equipment': '5060',

  // Operating Expenses (5100 - 5170)
  'welfare': '5110',
  'medical': '5110',
  'premises maintenance': '5120',
  'office maintenance': '5120',
  'office consumables': '5120',
  'office supplies': '5120',
  'premises service charge': '5120',
  'client rent': '5120',
  'internet and subs': '5130',
  'power and electricity': '5130',
  'telephone expense': '5130',
  'auto truck maintenance': '5140',
  'motor vehicle maintenance': '5140',
  'professional fees': '5150',
  'interest expense': '5160',
  'bank service charges': '5160',
  'directors expense': '5170',
  'fines': '5170',
  'corporate social responsibility': '5170',
  'meals and entertainment': '5170',
  'furnitures and fitting': '5170',
  'business development': '5170',
  'government/business/regulatory': '5170',

  // Non-P&L Capital & Tax Accounts
  'fixed assets': '1300',
  'vat': '2100',
};

/**
 * Resolves the Chart of Accounts code for a given Ledger Category name.
 * Checks user-configured mappings first (case-insensitive), then falls back to DEFAULT_CATEGORY_COA_MAP.
 */
export function resolveCategoryAccountCode(
  categoryName: string | undefined,
  customMap?: Record<string, string>
): string | undefined {
  if (!categoryName) return undefined;
  const trimmed = categoryName.trim();
  if (!trimmed) return undefined;

  if (customMap) {
    if (customMap[trimmed]) return customMap[trimmed];
    const lowerKey = Object.keys(customMap).find(k => k.toLowerCase() === trimmed.toLowerCase());
    if (lowerKey && customMap[lowerKey]) return customMap[lowerKey];
  }

  return DEFAULT_CATEGORY_COA_MAP[trimmed.toLowerCase()];
}

