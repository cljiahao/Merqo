create or replace function merqo.get_or_create_vendor_profile(
  p_vendor_id uuid,
  p_default_stall_name text default null
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  -- Read-first fast path: the row exists on the overwhelming majority of
  -- calls (this is wired into qkit's dashboard load and a public
  -- customer-facing order-status page), so make that case a pure read
  -- instead of an unconditional write.
  select * into v_row from merqo.vendor_profile where vendor_id = p_vendor_id;
  if found then
    return v_row;
  end if;

  -- Only reached on a genuine first-touch race (the select above missed,
  -- then a concurrent caller inserted first). ON CONFLICT DO UPDATE (no-op
  -- self-assignment) makes this atomic against that race — a plain insert
  -- would raise unique_violation on the loser.
  if auth.role() is distinct from 'service_role' and (auth.uid() is null or auth.uid() <> p_vendor_id) then
    raise exception 'not authorized to create profile';
  end if;
  insert into merqo.vendor_profile (vendor_id, stall_name)
  values (p_vendor_id, coalesce(nullif(p_default_stall_name, ''), 'My Stall'))
  on conflict (vendor_id) do update set vendor_id = excluded.vendor_id
  returning * into v_row;
  return v_row;
end;
$$;


-- Public customer pages read profiles through server service clients.
revoke all on function merqo.get_or_create_vendor_profile(uuid,text) from public,anon;
grant execute on function merqo.get_or_create_vendor_profile(uuid,text) to authenticated,service_role;
