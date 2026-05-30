-- Restrict Realtime private channel authorization to authenticated users on their own user-scoped topics.
-- Postgres Changes still relies on each published table's RLS; these policies protect Realtime
-- Broadcast/Presence channel joins whenever channels are configured as private.

alter table realtime.messages enable row level security;

drop policy if exists "Users can read own realtime topics" on realtime.messages;
drop policy if exists "Users can write own realtime topics" on realtime.messages;
drop policy if exists "Service role can manage realtime messages" on realtime.messages;

create policy "Users can read own realtime topics"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() like ('%' || auth.uid()::text || '%')
);

create policy "Users can write own realtime topics"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() like ('%' || auth.uid()::text || '%')
);

create policy "Service role can manage realtime messages"
on realtime.messages
for all
to service_role
using (true)
with check (true);
