-- ========================================================================================
-- DCEL Security Hardening: Comprehensive RLS & Privilege Lockdown
-- ========================================================================================

-- 1. Protect the 'privileges' column on public.profiles
-- Prevents non-admins from promoting themselves or changing their own permissions.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  -- If not an admin, ensure privileges, email, and workspace_id remain unchanged
  IF NOT public.is_admin() THEN
    IF (OLD.privileges IS DISTINCT FROM NEW.privileges) OR 
       (OLD.email IS DISTINCT FROM NEW.email) OR
       (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id) THEN
      RAISE EXCEPTION 'You do not have permission to modify security-critical fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS tr_protect_profile_privileges ON public.profiles;
CREATE TRIGGER tr_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();


-- 2. Secure Attendance Records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with attendance permission can view" ON public.attendance_records
  FOR SELECT USING (
    ((SELECT (privileges->'attendance'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );
CREATE POLICY "Users with attendance manage permission can modify" ON public.attendance_records
  FOR ALL USING (
    ((SELECT (privileges->'attendance'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- 3. Secure Company Expenses (Visible on Web version)
ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with ledger permission can view expenses" ON public.company_expenses
  FOR SELECT USING (
    ((SELECT (privileges->'ledger'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );
CREATE POLICY "Only admins or ledger managers can modify expenses" ON public.company_expenses
  FOR ALL USING (public.is_admin() OR ((SELECT (privileges->'ledger'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true));

-- 4. Secure Communication Logs
ALTER TABLE public.comm_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users with commLog permission can view" ON public.comm_logs
  FOR SELECT USING (
    ((SELECT (privileges->'commLog'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );
CREATE POLICY "Users with commLog manage permission can modify" ON public.comm_logs
  FOR ALL USING (
    ((SELECT (privileges->'commLog'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- 5. Secure Operations (Vehicles & Logistics)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_movement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations access for vehicles" ON public.vehicles
  FOR SELECT USING (
    ((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

CREATE POLICY "Operations access for logs" ON public.vehicle_movement_log
  FOR SELECT USING (
    ((SELECT (privileges->'operations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- 6. Secure Staff Merit Records
ALTER TABLE public.staff_merit_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view merit records" ON public.staff_merit_record
  FOR SELECT USING (
    ((SELECT (privileges->'employees'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- 7. Secure Universal Read Tables (Sites, Clients, Departments)
-- These are usually safe for all logged-in users to read.
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sites" ON public.sites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view depts" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view positions" ON public.positions FOR SELECT USING (auth.role() = 'authenticated');

-- 8. Final Lockdown: Catch-all for any other tables
-- Ensures that no data is public by default.
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
