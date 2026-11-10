create policy "deny client access to family devices"
  on private.family_devices
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "deny client access to family PIN attempts"
  on private.family_pin_attempts
  for all to anon, authenticated
  using (false)
  with check (false);