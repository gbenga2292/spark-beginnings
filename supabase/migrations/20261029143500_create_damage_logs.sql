-- Migration: Create damage_logs table for Site and Office Damage Tracking
CREATE TABLE IF NOT EXISTS public.damage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number TEXT NOT NULL,
    incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Location details
    location_type TEXT NOT NULL DEFAULT 'site', -- 'site', 'office', 'yard', 'transit', 'other'
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    specific_location TEXT, -- e.g. "Conference Room A", "Excavation Pit 3"
    
    -- Damaged item details
    item_type TEXT NOT NULL DEFAULT 'asset', -- 'asset', 'vehicle', 'office_fixture', 'tool_equipment', 'property', 'other'
    asset_id TEXT REFERENCES public.operations_assets(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL, -- Name or description of item (especially if unlisted/office)
    
    -- Severity & Lifecycle Status
    severity TEXT NOT NULL DEFAULT 'minor', -- 'minor', 'moderate', 'severe', 'critical'
    status TEXT NOT NULL DEFAULT 'reported', -- 'reported', 'under_assessment', 'in_repair', 'repaired', 'written_off', 'resolved'
    
    -- Personnel & Attribution
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_by_name TEXT,
    personnel_involved TEXT,
    cause_category TEXT DEFAULT 'operator_error', -- 'operator_error', 'wear_tear', 'accident', 'weather', 'malfunction', 'third_party', 'other'
    description TEXT NOT NULL,
    
    -- Financial assessment
    estimated_repair_cost NUMERIC(15,2) DEFAULT 0,
    actual_repair_cost NUMERIC(15,2) DEFAULT 0,
    fault_attribution TEXT DEFAULT 'unavoidable', -- 'internal_operator', 'subcontractor', 'client_billable', 'insurance_claim', 'unavoidable'
    
    -- Media server photo links (stored as JSON array: [{ name, url, type, uploaded_at }])
    photos JSONB DEFAULT '[]'::jsonb,
    
    -- Sign-off and resolution
    signed_off_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    signed_off_by_name TEXT,
    signed_off_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Standard timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_damage_logs_incident_date ON public.damage_logs(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_damage_logs_status ON public.damage_logs(status);
CREATE INDEX IF NOT EXISTS idx_damage_logs_location_type ON public.damage_logs(location_type);
CREATE INDEX IF NOT EXISTS idx_damage_logs_site_id ON public.damage_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_damage_logs_asset_id ON public.damage_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_damage_logs_vehicle_id ON public.damage_logs(vehicle_id);

-- Enable Row Level Security
ALTER TABLE public.damage_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'damage_logs' AND policyname = 'Enable read for all authenticated users'
    ) THEN
        CREATE POLICY "Enable read for all authenticated users" ON public.damage_logs
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'damage_logs' AND policyname = 'Enable insert for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users" ON public.damage_logs
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'damage_logs' AND policyname = 'Enable update for authenticated users'
    ) THEN
        CREATE POLICY "Enable update for authenticated users" ON public.damage_logs
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'damage_logs' AND policyname = 'Enable delete for authenticated users'
    ) THEN
        CREATE POLICY "Enable delete for authenticated users" ON public.damage_logs
            FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- Enable Supabase Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE damage_logs;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;
