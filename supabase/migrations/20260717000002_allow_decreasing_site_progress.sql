-- Create or replace the trigger function to update site progress
CREATE OR REPLACE FUNCTION public.update_site_progress_and_estimate()
RETURNS TRIGGER AS $$
DECLARE
    v_latest_progress numeric;
    v_site_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_site_id := OLD.site_id;
    ELSE
        v_site_id := NEW.site_id;
    END IF;

    -- Only run calculation and update if:
    -- 1. INSERT and new progress_percentage is not null
    -- 2. UPDATE and progress_percentage has changed
    -- 3. DELETE and the deleted entry had a progress_percentage
    IF (TG_OP = 'INSERT' AND NEW.progress_percentage IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND (OLD.progress_percentage IS DISTINCT FROM NEW.progress_percentage)) OR
       (TG_OP = 'DELETE' AND OLD.progress_percentage IS NOT NULL) THEN
        
        -- Get the highest progress percentage for this site
        SELECT max(progress_percentage) INTO v_latest_progress
        FROM public.site_journal_entries
        WHERE site_id = v_site_id;
        
        -- Update the site's current progress using the maximum from journal entries
        UPDATE public.sites
        SET current_progress_percentage = coalesce(v_latest_progress, 0)
        WHERE id = v_site_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on insert or update or delete
DROP TRIGGER IF EXISTS tr_update_site_progress ON public.site_journal_entries;
CREATE TRIGGER tr_update_site_progress
AFTER INSERT OR UPDATE OR DELETE ON public.site_journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_site_progress_and_estimate();
