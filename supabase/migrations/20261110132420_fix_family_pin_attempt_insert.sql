create or replace function public.check_family_pin_attempt(
  p_device_fingerprint text,
  p_ip_fingerprint text,
  p_failed boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  device_attempts integer;
  ip_attempts integer;
begin
  if p_device_fingerprint is null
     or p_ip_fingerprint is null
     or p_device_fingerprint !~ '^[0-9a-f]{64}$'
     or p_ip_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit fingerprint';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(p_device_fingerprint, p_ip_fingerprint), 0)
  );
  if p_device_fingerprint <> p_ip_fingerprint then
    perform pg_advisory_xact_lock(
      hashtextextended(greatest(p_device_fingerprint, p_ip_fingerprint), 0)
    );
  end if;

  delete from private.family_pin_attempts
  where attempted_at < now() - interval '1 day';

  select
    count(*) filter (where fingerprint = p_device_fingerprint)::integer,
    count(*) filter (where fingerprint = p_ip_fingerprint)::integer
  into device_attempts, ip_attempts
  from private.family_pin_attempts
  where fingerprint in (p_device_fingerprint, p_ip_fingerprint)
    and attempted_at > now() - interval '15 minutes';

  if device_attempts >= 5 or ip_attempts >= 5 then
    return false;
  end if;

  if p_failed then
    insert into private.family_pin_attempts (fingerprint)
    values (p_device_fingerprint);
    if p_ip_fingerprint <> p_device_fingerprint then
      insert into private.family_pin_attempts (fingerprint)
      values (p_ip_fingerprint);
    end if;
  end if;

  return true;
end;
$$;
revoke all on function public.check_family_pin_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.check_family_pin_attempt(text, text, boolean) to service_role;