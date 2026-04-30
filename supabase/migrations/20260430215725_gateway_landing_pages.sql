create table if not exists public.gateway_landing_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  description text,
  files jsonb not null default '[]'::jsonb,
  entry_file text,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gateway_landing_pages_user on public.gateway_landing_pages(user_id);
alter table public.gateway_landing_pages enable row level security;
drop policy if exists "lp_select_own" on public.gateway_landing_pages;
create policy "lp_select_own" on public.gateway_landing_pages for select to authenticated using (auth.uid() = user_id);
drop policy if exists "lp_insert_own" on public.gateway_landing_pages;
create policy "lp_insert_own" on public.gateway_landing_pages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "lp_update_own" on public.gateway_landing_pages;
create policy "lp_update_own" on public.gateway_landing_pages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lp_delete_own" on public.gateway_landing_pages;
create policy "lp_delete_own" on public.gateway_landing_pages for delete to authenticated using (auth.uid() = user_id);
insert into storage.buckets (id, name, public) values ('landing-pages', 'landing-pages', true) on conflict (id) do nothing;
drop policy if exists "lp_storage_read" on storage.objects;
create policy "lp_storage_read" on storage.objects for select to public using (bucket_id = 'landing-pages');
drop policy if exists "lp_storage_insert_own" on storage.objects;
create policy "lp_storage_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'landing-pages' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "lp_storage_update_own" on storage.objects;
create policy "lp_storage_update_own" on storage.objects for update to authenticated using (bucket_id = 'landing-pages' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "lp_storage_delete_own" on storage.objects;
create policy "lp_storage_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'landing-pages' and auth.uid()::text = (storage.foldername(name))[1]);
