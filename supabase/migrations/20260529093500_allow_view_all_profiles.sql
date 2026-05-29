-- ========================================================================================
-- DCEL Security Update: Allow all authenticated users to view profiles
-- Necessary for assignee dropdowns, comments, and site journals to function for restricted users.
-- ========================================================================================

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
