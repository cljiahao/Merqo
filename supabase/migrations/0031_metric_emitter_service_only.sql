-- Event readers use these rows as evidence for cross-kit rewards. Browser
-- callers must not be able to forge another kit's completion signal.
-- SECURITY DEFINER triggers retain the function owner's execution privilege.
revoke execute on function merqo.emit_metric(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function merqo.emit_metric(uuid, text, text, jsonb)
  to service_role;
