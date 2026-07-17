-- Create bank_audits table if not exists
CREATE TABLE IF NOT EXISTS public.bank_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    default_bank TEXT,
    review_rows JSONB DEFAULT '[]'::jsonb,
    file_metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- First, drop the existing public/unrestricted policies if they exist
DROP POLICY IF EXISTS "Enable all access for bank audits" ON public.bank_audits;
DROP POLICY IF EXISTS "workspace_access" ON public.bank_audits;

-- Ensure RLS is enabled
ALTER TABLE public.bank_audits ENABLE ROW LEVEL SECURITY;

-- Create secure policies based on the new bankImport permissions
CREATE POLICY "bank_audits view access" ON public.bank_audits 
FOR SELECT 
USING (
  ((SELECT (privileges->'bankImport'->>'canView')::boolean FROM public.profiles WHERE id = auth.uid()) = true) 
  OR public.is_admin()
);

CREATE POLICY "bank_audits manage access" ON public.bank_audits 
FOR ALL 
USING (
  ((SELECT (privileges->'bankImport'->>'canSave')::boolean FROM public.profiles WHERE id = auth.uid()) = true) 
  OR public.is_admin()
)
WITH CHECK (
  ((SELECT (privileges->'bankImport'->>'canSave')::boolean FROM public.profiles WHERE id = auth.uid()) = true) 
  OR public.is_admin()
);
