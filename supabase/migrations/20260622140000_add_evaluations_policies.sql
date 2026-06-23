-- Policies for evaluations and disciplinary_records
-- These tables were locked down by the default catch-all RLS script but lacked explicit policies.

-- Disciplinary Records
CREATE POLICY "Disciplinary view access" ON public.disciplinary_records
  FOR SELECT USING (
    ((SELECT (privileges->'disciplinary'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

CREATE POLICY "Disciplinary manage access" ON public.disciplinary_records
  FOR ALL USING (
    ((SELECT (privileges->'disciplinary'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

-- Evaluations
CREATE POLICY "Evaluations view access" ON public.evaluations
  FOR SELECT USING (
    ((SELECT (privileges->'evaluations'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );

CREATE POLICY "Evaluations manage access" ON public.evaluations
  FOR ALL USING (
    ((SELECT (privileges->'evaluations'->>'canManage')::boolean FROM public.profiles WHERE id = auth.uid()) = true)
    OR public.is_admin()
  );
