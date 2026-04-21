create table if not exists public.daily_journals (
    id uuid primary key,
    date date not null,
    general_notes text not null,
    logged_by text not null,
    created_at timestamp with time zone default now(),
    workspace_id text not null
);

create table if not exists public.site_journal_entries (
    id uuid primary key,
    journal_id uuid references public.daily_journals(id) on delete cascade not null,
    site_id uuid not null,
    site_name text not null,
    client_name text not null,
    narration text not null,
    workspace_id text not null
);

-- RLS
alter table public.daily_journals enable row level security;
alter table public.site_journal_entries enable row level security;

create policy "Enable read access for all users" on public.daily_journals for select using (true);
create policy "Enable insert access for all users" on public.daily_journals for insert with check (true);
create policy "Enable update access for all users" on public.daily_journals for update using (true);
create policy "Enable delete access for all users" on public.daily_journals for delete using (true);

create policy "Enable read access for all users" on public.site_journal_entries for select using (true);
create policy "Enable insert access for all users" on public.site_journal_entries for insert with check (true);
create policy "Enable update access for all users" on public.site_journal_entries for update using (true);
create policy "Enable delete access for all users" on public.site_journal_entries for delete using (true);
