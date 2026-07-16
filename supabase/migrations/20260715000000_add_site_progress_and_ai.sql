-- Add progress to site_journal_entries
alter table public.site_journal_entries 
add column if not exists progress_percentage numeric default 0;

-- Add progress and estimation to sites
alter table public.sites 
add column if not exists current_progress_percentage numeric default 0,
add column if not exists estimated_completion_date date;

-- Create API keys table
create table if not exists public.api_keys (
    id uuid primary key default gen_random_uuid(),
    label text,
    provider text not null,
    key_value text not null,
    is_default boolean default false,
    workspace_id text not null,
    created_at timestamp with time zone default now()
);

alter table public.api_keys enable row level security;
create policy "Enable read access for all users" on public.api_keys for select using (true);
create policy "Enable insert access for all users" on public.api_keys for insert with check (true);
create policy "Enable update access for all users" on public.api_keys for update using (true);
create policy "Enable delete access for all users" on public.api_keys for delete using (true);

-- Create Workspace Settings table
create table if not exists public.workspace_settings (
    workspace_id text primary key,
    resource_allocation_mode text default 'analytic' check (resource_allocation_mode in ('analytic', 'hybrid')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

alter table public.workspace_settings enable row level security;
create policy "Enable read access for all users" on public.workspace_settings for select using (true);
create policy "Enable insert access for all users" on public.workspace_settings for insert with check (true);
create policy "Enable update access for all users" on public.workspace_settings for update using (true);
create policy "Enable delete access for all users" on public.workspace_settings for delete using (true);

-- Create trigger function to update site progress
create or replace function public.update_site_progress_and_estimate()
returns trigger as $$
declare
    v_latest_progress numeric;
begin
    -- Get the highest progress percentage for this site
    select max(progress_percentage) into v_latest_progress
    from public.site_journal_entries
    where site_id = NEW.site_id;
    
    -- Update the site's current progress
    update public.sites
    set current_progress_percentage = coalesce(v_latest_progress, 0)
    where id = NEW.site_id;
    
    return NEW;
end;
$$ language plpgsql security definer;

-- Trigger on insert or update
drop trigger if exists tr_update_site_progress on public.site_journal_entries;
create trigger tr_update_site_progress
after insert or update of progress_percentage on public.site_journal_entries
for each row
execute function public.update_site_progress_and_estimate();
