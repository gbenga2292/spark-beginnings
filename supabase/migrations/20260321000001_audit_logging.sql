-- ========================================================================================
-- DCEL Security Hardening: Audit Logging Infrastructure
-- ========================================================================================

-- 1. Create the Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    table_name text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data jsonb,
    new_data jsonb
);

-- 2. Secure the Audit Logs Table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins (as defined by our custom function) can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- Nobody should be able to update, insert, or delete audit logs from client
CREATE POLICY "Nobody can modify audit logs natively" ON public.audit_logs
  FOR ALL USING (false);

-- 3. Create the Generic Trigger Function
CREATE OR REPLACE FUNCTION public.track_audit_log() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, table_name, action_type, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
    );
    
    IF TG_OP = 'DELETE' THEN 
        RETURN OLD; 
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Triggers to Critical Financial & Administrative Tables
DROP TRIGGER IF EXISTS audit_employees_changes ON public.employees;
CREATE TRIGGER audit_employees_changes AFTER INSERT OR UPDATE OR DELETE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();

DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();

DROP TRIGGER IF EXISTS audit_invoices_changes ON public.invoices;
CREATE TRIGGER audit_invoices_changes AFTER INSERT OR UPDATE OR DELETE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();

DROP TRIGGER IF EXISTS audit_ledger_changes ON public.ledger_entries;
CREATE TRIGGER audit_ledger_changes AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();

DROP TRIGGER IF EXISTS audit_salary_advances_changes ON public.salary_advances;
CREATE TRIGGER audit_salary_advances_changes AFTER INSERT OR UPDATE OR DELETE ON public.salary_advances
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();

DROP TRIGGER IF EXISTS audit_payments_changes ON public.payments;
CREATE TRIGGER audit_payments_changes AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.track_audit_log();
