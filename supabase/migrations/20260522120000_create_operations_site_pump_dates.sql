-- Create operations_site_pump_dates table
CREATE TABLE IF NOT EXISTS public.operations_site_pump_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    pump_start_date DATE NOT NULL,
    pump_stop_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_asset_site UNIQUE (asset_id, site_id)
);

-- Revert/Drop the old fields from public.operations_assets if they exist
ALTER TABLE public.operations_assets DROP COLUMN IF EXISTS pump_start_date;
ALTER TABLE public.operations_assets DROP COLUMN IF EXISTS pump_stop_date;

-- Enable Row Level Security
ALTER TABLE public.operations_site_pump_dates ENABLE ROW LEVEL SECURITY;

-- Create Policies for operations_site_pump_dates
CREATE POLICY "Enable read access for authenticated users" ON public.operations_site_pump_dates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.operations_site_pump_dates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.operations_site_pump_dates
    FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.operations_site_pump_dates
    FOR DELETE USING (auth.role() = 'authenticated');
