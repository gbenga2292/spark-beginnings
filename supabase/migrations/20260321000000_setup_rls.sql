-- ========================================================================================
-- DCEL Security Hardening: Row Level Security (RLS) Baseline
-- ========================================================================================

-- 1. Helper Security Functions
-- Creates a function to easily check if the current user has "canManage" Users privileges
-- We use SECURITY DEFINER so this function can bypass RLS to read the profile.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (privileges->'users'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Secure the Profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone logged in can read their own profile. Admins can read all.
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Policy: Users can update their own basic details, Admins can update all.
CREATE POLICY "Users can update own basic profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Policy: Only Admins can insert/delete profiles.
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin());


-- 3. Secure Highly Sensitive Tables (Employees, Payroll, Invoices, Ledger, etc.)

-- Employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR or Admins can view employees" ON public.employees
  FOR SELECT USING (
    ((SELECT (privileges->'employees'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );
-- (Add INSERT/UPDATE/DELETE policies following the same pattern)

-- Invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance or Admins can view invoices" ON public.invoices
  FOR SELECT USING (
    ((SELECT (privileges->'billing'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- Ledger Entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance or Admins can view ledger" ON public.ledger_entries
  FOR SELECT USING (
    ((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- Salary Advances
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own advances, HR/Finance can see all" ON public.salary_advances
  FOR SELECT USING (
    employee_id = auth.uid() 
    OR ((SELECT (privileges->'salaryLoans'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- Evaluate enabling RLS for all other 20+ tables and setting the appropriate privilege paths 
-- matching the UserPrivileges JSON structure inside public.profiles.
