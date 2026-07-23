-- Shared vendor NPS/feedback, converged from loopkit/stockkit/paykit's own
-- identical local `feedback` tables (vendor_id, nps 0-10, message,
-- created_at). Distinct from merqo.feedback (0007) — that table is Merqo
-- hub's own NPS about Merqo itself, unrelated to this one. See
-- docs/superpowers/specs/2026-07-23-cross-kit-vendor-feedback-design.md

create table merqo.vendor_feedback (
  id          uuid primary key default gen_random_uuid(),
  kit_slug    text not null references merqo.products(slug),
  vendor_id   uuid not null references auth.users(id) on delete cascade,
  nps         int  not null check (nps between 0 and 10),
  message     text check (message is null or char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);

create index vendor_feedback_kit_created_idx
  on merqo.vendor_feedback (kit_slug, created_at desc);

alter table merqo.vendor_feedback enable row level security;

-- No INSERT policy — writes only go through submit_vendor_feedback below
-- (SECURITY DEFINER bypasses RLS for that path).
create policy vendor_feedback_team_select on merqo.vendor_feedback
  for select using (merqo.is_merqo_team(auth.uid()));

grant select on merqo.vendor_feedback to authenticated;

create or replace function merqo.submit_vendor_feedback(
  p_kit_slug text,
  p_nps int,
  p_message text
) returns merqo.vendor_feedback
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_feedback;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into merqo.vendor_feedback (kit_slug, vendor_id, nps, message)
  values (p_kit_slug, auth.uid(), p_nps, nullif(p_message, ''))
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.submit_vendor_feedback(text, int, text)
  to authenticated;
