create table if not exists public.hidden_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  hidden_instance_id uuid,
  instance_name text,
  phone text not null,
  message_preview text,
  template_type text,
  status text not null default 'pending',
  error_message text,
  batch_id uuid,
  created_at timestamptz not null default now()
);
alter table public.hidden_dispatch_logs enable row level security;
create policy "Users view own hdl" on public.hidden_dispatch_logs for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own hdl" on public.hidden_dispatch_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own hdl" on public.hidden_dispatch_logs for delete to authenticated using (auth.uid() = user_id);
create index if not exists hidden_dispatch_logs_user_created_idx on public.hidden_dispatch_logs (user_id, created_at desc);
create index if not exists hidden_dispatch_logs_batch_idx on public.hidden_dispatch_logs (batch_id);
