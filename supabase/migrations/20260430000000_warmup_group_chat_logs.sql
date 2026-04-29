-- Tabela de logs do motor warmup-group-chat
create table if not exists public.warmup_group_chat_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  cycle_id uuid not null,
  link_id uuid,
  group_jid text,
  sender_instance_id uuid,
  sender_name text,
  sender_provider text,
  status text not null default 'success',
  http_status integer,
  error_message text,
  message_preview text
);

create index if not exists idx_wgcl_created_at on public.warmup_group_chat_logs (created_at desc);
create index if not exists idx_wgcl_link on public.warmup_group_chat_logs (link_id);
create index if not exists idx_wgcl_cycle on public.warmup_group_chat_logs (cycle_id);

alter table public.warmup_group_chat_logs enable row level security;

drop policy if exists "Admins can view warmup_group_chat_logs" on public.warmup_group_chat_logs;
create policy "Admins can view warmup_group_chat_logs"
  on public.warmup_group_chat_logs
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Service role inserts warmup_group_chat_logs" on public.warmup_group_chat_logs;
create policy "Service role inserts warmup_group_chat_logs"
  on public.warmup_group_chat_logs
  for insert
  to service_role
  with check (true);
