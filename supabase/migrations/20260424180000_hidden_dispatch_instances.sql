-- Tabela de instâncias Z-API/UAZAPI dedicadas ao Disparo Oculto.
create table if not exists public.hidden_dispatch_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_provider text not null default 'zapi',
  zapi_instance_id text not null default '',
  zapi_token text not null default '',
  zapi_client_token text not null default '',
  evolution_api_url text,
  evolution_api_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.hidden_dispatch_instances enable row level security;

drop policy if exists "Admins manage hidden dispatch" on public.hidden_dispatch_instances;
create policy "Admins manage hidden dispatch"
on public.hidden_dispatch_instances
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Authenticated can list hidden dispatch" on public.hidden_dispatch_instances;
create policy "Authenticated can list hidden dispatch"
on public.hidden_dispatch_instances
for select
to authenticated
using (is_active = true);

drop trigger if exists trg_hidden_dispatch_updated_at on public.hidden_dispatch_instances;
create trigger trg_hidden_dispatch_updated_at
before update on public.hidden_dispatch_instances
for each row execute function public.update_updated_at_column();
