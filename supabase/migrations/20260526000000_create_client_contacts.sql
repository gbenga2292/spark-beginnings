-- Create client_contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,
    note TEXT,
    client_name TEXT NOT NULL,
    site_ids TEXT[],
    site_names TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_principal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming similar to other tables, allowing authenticated users to read/write)
CREATE POLICY "Enable read access for all authenticated users" ON public.client_contacts
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.client_contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.client_contacts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON public.client_contacts
    FOR DELETE
    TO authenticated
    USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE client_contacts;

