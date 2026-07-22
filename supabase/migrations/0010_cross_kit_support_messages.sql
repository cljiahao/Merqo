-- Extends merqo.support_messages (0007) into a cross-kit inbox: a
-- nullable kit_slug (null = about Merqo hub itself, unchanged meaning of
-- every existing row) and a category CHECK relaxed to shape-only, since
-- each kit now owns its own category vocabulary at the app layer. See
-- docs/superpowers/specs/2026-07-23-cross-kit-support-messages-design.md

alter table merqo.support_messages
  add column kit_slug text;

alter table merqo.support_messages
  drop constraint support_messages_category_check;

alter table merqo.support_messages
  add constraint support_messages_category_shape
    check (char_length(category) between 1 and 40);

create or replace function merqo.submit_support_message(
  p_kit_slug text,
  p_category text,
  p_body text
) returns merqo.support_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.support_messages;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into merqo.support_messages (user_id, kit_slug, category, body)
  values (auth.uid(), nullif(p_kit_slug, ''), p_category, p_body)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.submit_support_message(text, text, text)
  to authenticated;
