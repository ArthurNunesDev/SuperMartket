-- Isolate location broadcasts from the participant presence channel.
-- Both topics remain private and are restricted to the authenticated device's session.
begin;

drop policy if exists "session members can read activity messages" on realtime.messages;
drop policy if exists "session members can send activity messages" on realtime.messages;

create policy "session members can read activity messages"
on realtime.messages
for select
to authenticated
using (
  (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) = 'session:' || (select private.current_shopping_session_id())::text
  )
  or
  (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'session-location:' || (select private.current_shopping_session_id())::text
  )
);

create policy "session members can send activity messages"
on realtime.messages
for insert
to authenticated
with check (
  (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) = 'session:' || (select private.current_shopping_session_id())::text
  )
  or
  (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'session-location:' || (select private.current_shopping_session_id())::text
  )
);

commit;
