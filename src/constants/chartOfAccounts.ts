export interface ChartAccount {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  category: 'CURRENT_ASSET' | 'NON_CURRENT_ASSET' | 'CURRENT_LIABILITY' | 'EQUITY' | 'REVENUE' | 'DIRECT_COST' | 'OPERATING_EXPENSE';
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

  // ─── 5100 - 5160: OPERATING EXPENSES (OPEX) ───
  { code: '5100', name: 'Depreciation Expense — Equipment & Machinery', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5110', name: 'Administrative Salaries & Staff Welfare', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5120', name: 'Office Rent & Yard Lease', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5130', name: 'Utilities & Communications', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5140', name: 'Motor Vehicle Running & Logistics', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5150', name: 'Legal, Audit & Professional Fees', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5160', name: 'Bank Charges & Transaction Fees', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '5170', name: 'General Administration & Operating Overhead', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
];
