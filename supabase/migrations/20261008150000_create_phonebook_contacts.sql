-- Create phonebook_contacts table for Client Phonebook and AI business card scanner
CREATE TABLE IF NOT EXISTS public.phonebook_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position TEXT,
    company TEXT,
    category TEXT DEFAULT 'Client',
    email TEXT,
    emails TEXT[] DEFAULT '{}',
    phone TEXT,
    phones TEXT[] DEFAULT '{}',
    address TEXT,
    addresses TEXT[] DEFAULT '{}',
    note TEXT,
    card_image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Enable RLS
ALTER TABLE public.phonebook_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'phonebook_contacts' AND policyname = 'Enable read for all authenticated users'
    ) THEN
        CREATE POLICY "Enable read for all authenticated users" ON public.phonebook_contacts
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'phonebook_contacts' AND policyname = 'Enable insert for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.phonebook_contacts
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'phonebook_contacts' AND policyname = 'Enable update for authenticated users'
    ) THEN
        CREATE POLICY "Enable update for authenticated users" ON public.phonebook_contacts
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'phonebook_contacts' AND policyname = 'Enable delete for authenticated users'
    ) THEN
        CREATE POLICY "Enable delete for authenticated users" ON public.phonebook_contacts
            FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE phonebook_contacts;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;
