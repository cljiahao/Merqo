create or replace function merqo.patch_vendor_profile(
  p_vendor_id uuid,
  p_stall_name text default null,
  p_social_links jsonb default null
)
returns merqo.vendor_profile language plpgsql security definer set search_path = '' as $$
declare v_row merqo.vendor_profile;
begin
  if auth.uid() is null or auth.uid() <> p_vendor_id then raise exception 'not authorized'; end if;
  if p_stall_name is not null and (length(btrim(p_stall_name)) < 1 or length(p_stall_name) > 100) then
    raise exception 'invalid stall name';
  end if;
  if p_social_links is not null then
    if jsonb_typeof(p_social_links) <> 'object' then raise exception 'invalid social links'; end if;
    if exists(select 1 from jsonb_each(p_social_links) e where e.key not in ('website','instagram','facebook','tiktok')
      or jsonb_typeof(e.value) <> 'string' or length(e.value#>>'{}') > 300 or (e.value#>>'{}') !~* '^https?://') then
      raise exception 'invalid social links';
    end if;
  end if;
  insert into merqo.vendor_profile as profile(vendor_id,stall_name,social_links,updated_at)
    values(p_vendor_id,coalesce(p_stall_name,'My Stall'),coalesce(p_social_links,'{}'::jsonb),clock_timestamp())
  on conflict(vendor_id) do update set
    stall_name=coalesce(p_stall_name,profile.stall_name),
    social_links=coalesce(p_social_links,profile.social_links),updated_at=clock_timestamp()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function merqo.patch_vendor_profile(uuid,text,jsonb) from public,anon;
grant execute on function merqo.patch_vendor_profile(uuid,text,jsonb) to authenticated;
-- The legacy writer's null-subject bypass is reserved for service-role calls.
revoke all on function merqo.upsert_vendor_profile(uuid,text,jsonb) from public,anon;
