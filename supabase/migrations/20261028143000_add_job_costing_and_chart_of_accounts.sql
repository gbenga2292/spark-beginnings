-- Migration: Add Job Costing, Chart of Accounts, and Fixed Asset Register
-- Created: 2026-10-28
-- Description: Non-destructive addition of Nigerian DCEL COA, Job Costing metrics, and Asset Register fields.

-- 1. Add Job Costing & Financial metrics to sites
ALTER TABLE public.sites 
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'DEWATERING',
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(18, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_amount NUMERIC(18, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_percentage NUMERIC(5, 2) DEFAULT 5.0;

-- 2. Add Fixed Asset Register & Dual Inventory Classification to operations_assets
ALTER TABLE public.operations_assets
  ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(18, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS useful_life_months INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(18, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asset_classification TEXT DEFAULT 'RENTAL_FLEET';

-- 3. Add Site linkage to vendor_invoices
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS site_id TEXT,
  ADD COLUMN IF NOT EXISTS site_name TEXT;

-- 4. Create standard Chart of Accounts (COA) table for DCEL
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  normal_balance VARCHAR(10) NOT NULL DEFAULT 'DEBIT',
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chart_of_accounts' AND policyname = 'Enable all for authenticated users'
  ) THEN
    CREATE POLICY "Enable all for authenticated users" 
      ON public.chart_of_accounts FOR ALL 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Seed standard Nigerian DCEL Chart of Accounts
INSERT INTO public.chart_of_accounts (code, name, type, normal_balance, category, description)
VALUES
  ('1000', 'Cash on Hand / Petty Cash', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Cash in office and field imprest accounts'),
  ('1010', 'Bank — GTBank (NGN)', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Main operational bank account'),
  ('1020', 'Bank — Zenith Bank (NGN)', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Secondary operational bank account'),
  ('1100', 'Accounts Receivable — Trade Clients', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Receivables for dewatering, waterproofing and equipment'),
  ('1120', 'Withholding Tax (WHT) Credit Notes Recoverable', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'WHT 5% deducted by clients awaiting FIRS credit note offset'),
  ('1130', 'Retention Receivables (5-10%)', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Retention funds held by construction clients until defect liability period ends'),
  ('1200', 'Inventory — Equipment for Sale', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Pumps, wellpoints, pipes held for resale'),
  ('1210', 'Inventory — Spare Parts', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Impellers, mechanical seals, gaskets, hoses'),
  ('1220', 'Inventory — Consumables & Chemicals', 'ASSET', 'DEBIT', 'CURRENT_ASSET', 'Grout, membranes, sealants, drilling additives'),
  ('1250', 'Accumulated Depreciation — Equipment & Machinery', 'ASSET', 'CREDIT', 'NON_CURRENT_ASSET', 'Cumulative straight-line depreciation of rental assets'),
  ('1300', 'Dewatering Equipment & Machinery (Rental Fleet)', 'ASSET', 'DEBIT', 'NON_CURRENT_ASSET', 'Capitalized dewatering rigs, diesel pump units, vacuum systems'),
  ('1310', 'Motor Vehicles & Logistics Trucks', 'ASSET', 'DEBIT', 'NON_CURRENT_ASSET', 'Company vehicles, operational trucks, tankers'),
  ('1320', 'Office Furniture & IT Equipment', 'ASSET', 'DEBIT', 'NON_CURRENT_ASSET', 'Computers, office tools, lab/testing equipment'),
  ('2000', 'Accounts Payable — Trade Vendors & Suppliers', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'Amounts owed to Grundfos, diesel suppliers, equipment vendors'),
  ('2100', 'VAT Output Payable (7.5%)', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'VAT charged on client invoices payable to FIRS'),
  ('2110', 'VAT Input Receivable (7.5%)', 'LIABILITY', 'DEBIT', 'CURRENT_LIABILITY', 'VAT paid on vendor purchases claimable from FIRS'),
  ('2120', 'Withholding Tax (WHT) Payable to FIRS', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'WHT deducted by DCEL from vendor/contractor payments'),
  ('2130', 'PAYE & State Tax Payable', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'Pay As You Earn payroll tax remittances'),
  ('2140', 'Pension & NHF Remittances Payable', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'Employee and employer statutory deductions'),
  ('2200', 'Client Mobilization Deposits', 'LIABILITY', 'CREDIT', 'CURRENT_LIABILITY', 'Advance payments received before site mobilization'),
  ('3000', 'Share Capital / Owner Equity', 'EQUITY', 'CREDIT', 'EQUITY', 'Capital contributed by owners'),
  ('3100', 'Retained Earnings', 'EQUITY', 'CREDIT', 'EQUITY', 'Accumulated undistributed company earnings'),
  ('4000', 'Revenue — Dewatering Services', 'INCOME', 'CREDIT', 'REVENUE', 'Contract revenue from dewatering and deep wellpoint services'),
  ('4010', 'Revenue — Waterproofing Services', 'INCOME', 'CREDIT', 'REVENUE', 'Contract revenue from basement, structural and roof waterproofing'),
  ('4020', 'Revenue — Allied & Ground Improvement Services', 'INCOME', 'CREDIT', 'REVENUE', 'Revenue from leak sealing, grouting, and ground improvement'),
  ('4030', 'Revenue — Equipment Sales', 'INCOME', 'CREDIT', 'REVENUE', 'Sale of dewatering pumps, hoses, and accessories'),
  ('4040', 'Revenue — Equipment Maintenance & Overhaul', 'INCOME', 'CREDIT', 'REVENUE', 'Third-party equipment servicing and maintenance labor'),
  ('4050', 'Revenue — Spare Parts Sales', 'INCOME', 'CREDIT', 'REVENUE', 'Direct sale of spare parts to clients'),
  ('4060', 'Revenue — Equipment Rental Fleet', 'INCOME', 'CREDIT', 'REVENUE', 'Dry and wet rental of dewatering pumps and generators'),
  ('5000', 'Cost of Equipment & Spares Sold', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Cost of goods sold for equipment and spare parts'),
  ('5010', 'Direct Labor — Field Technicians & Operators', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Site crew wages, overtime, and field allowances'),
  ('5020', 'Site Materials & Consumables Consumed', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Grout, membranes, sealants, wellpoint pipes issued to sites'),
  ('5030', 'Site Diesel & Fuel Consumed', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Diesel refills for on-site pumps and generators'),
  ('5040', 'Subcontractor & Specialist Hire', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Specialist piling, drilling, or earthmoving subcontractors'),
  ('5050', 'Equipment Mobilization & Transport Cost', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Haulage, crane hire, waybill logistics to and from site'),
  ('5060', 'Equipment Running Maintenance on Site', 'EXPENSE', 'DEBIT', 'DIRECT_COST', 'Field repairs, oil, filters, on-site service parts'),
  ('5100', 'Depreciation Expense — Equipment & Machinery', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Monthly straight-line depreciation of rental assets'),
  ('5110', 'Administrative Salaries & Staff Welfare', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Head office salaries, HMO, and staff welfare'),
  ('5120', 'Office Rent & Yard Lease', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Office and equipment storage yard leases'),
  ('5130', 'Utilities & Communications', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Office electricity, water, internet, phones'),
  ('5140', 'Motor Vehicle Running & Logistics', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Office vehicle maintenance, fuel, and licensing'),
  ('5150', 'Legal, Audit & Professional Fees', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Auditing, consulting, and legal compliance expenses'),
  ('5160', 'Bank Charges & Transaction Fees', 'EXPENSE', 'DEBIT', 'OPERATING_EXPENSE', 'Bank maintenance fees, transfer fees, COT')
ON CONFLICT (code) DO NOTHING;

-- 6. Create high-performance Site Job Costing View (Non-destructive, read-only)
CREATE OR REPLACE VIEW public.site_job_costing_summary AS
SELECT 
  s.id AS site_id,
  s.name AS site_name,
  s.client AS client_name,
  s.service AS service_name,
  COALESCE(s.project_type, 'DEWATERING') AS project_type,
  COALESCE(s.status, 'Active') AS status,
  COALESCE(s.contract_value, 0) AS contract_value,
  COALESCE(s.retention_percentage, 5.0) AS retention_percentage,
  
  -- Total Invoiced (Revenue)
  COALESCE((
    SELECT SUM(COALESCE(inv.total_charge, inv.amount, 0))
    FROM public.invoices inv
    WHERE (inv.site_id = s.id::text OR inv.site_name = s.name)
      AND COALESCE(inv.status, '') != 'Cancelled'
  ), 0) AS total_billed,

  -- Total Diesel Cost (Direct Fuel)
  COALESCE((
    SELECT SUM(COALESCE(df.total_cost, 0))
    FROM public.diesel_refills df
    WHERE (df.site_id = s.id::text OR df.site_name = s.name)
  ), 0) AS total_diesel_cost,

  -- Total Vendor / Subcontractor Cost
  COALESCE((
    SELECT SUM(COALESCE(vi.total_amount, 0))
    FROM public.vendor_invoices vi
    WHERE (vi.site_id = s.id::text OR vi.site_name = s.name)
      AND COALESCE(vi.status, '') != 'rejected'
  ), 0) AS total_vendor_subcontractor_cost,

  -- Total Direct Costs
  (
    COALESCE((
      SELECT SUM(COALESCE(df.total_cost, 0))
      FROM public.diesel_refills df
      WHERE (df.site_id = s.id::text OR df.site_name = s.name)
    ), 0)
    +
    COALESCE((
      SELECT SUM(COALESCE(vi.total_amount, 0))
      FROM public.vendor_invoices vi
      WHERE (vi.site_id = s.id::text OR vi.site_name = s.name)
        AND COALESCE(vi.status, '') != 'rejected'
    ), 0)
  ) AS total_direct_costs,

  -- Estimated Gross Margin (Total Billed - Total Direct Costs)
  (
    COALESCE((
      SELECT SUM(COALESCE(inv.total_charge, inv.amount, 0))
      FROM public.invoices inv
      WHERE (inv.site_id = s.id::text OR inv.site_name = s.name)
        AND COALESCE(inv.status, '') != 'Cancelled'
    ), 0)
    -
    (
      COALESCE((
        SELECT SUM(COALESCE(df.total_cost, 0))
        FROM public.diesel_refills df
        WHERE (df.site_id = s.id::text OR df.site_name = s.name)
      ), 0)
      +
      COALESCE((
        SELECT SUM(COALESCE(vi.total_amount, 0))
        FROM public.vendor_invoices vi
        WHERE (vi.site_id = s.id::text OR vi.site_name = s.name)
          AND COALESCE(vi.status, '') != 'rejected'
      ), 0)
    )
  ) AS estimated_gross_margin

FROM public.sites s;
