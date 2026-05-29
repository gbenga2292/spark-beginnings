create table if not exists public.dewatering_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  lines jsonb not null default '[]'::jsonb,
  components jsonb not null default '[]'::jsonb,
  background_image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.dewatering_layouts enable row level security;

create policy "Users can view their own dewatering layouts"
  on public.dewatering_layouts for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own dewatering layouts"
  on public.dewatering_layouts for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own dewatering layouts"
  on public.dewatering_layouts for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Users can delete their own dewatering layouts"
  on public.dewatering_layouts for delete
  using ( auth.uid() = user_id );

-- Insert the storage bucket for blueprints
insert into storage.buckets (id, name, public) 
values ('simulator-blueprints', 'simulator-blueprints', true)
on conflict (id) do nothing;

create policy "Users can upload simulator blueprints"
  on storage.objects for insert
  with check ( bucket_id = 'simulator-blueprints' AND auth.uid() = owner );

create policy "Anyone can read simulator blueprints"
  on storage.objects for select
  using ( bucket_id = 'simulator-blueprints' );
