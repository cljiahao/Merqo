# src/app/actions

Server Actions for vendor feedback, support messages and waitlist requests. Validate payloads before database work, resolve the signed-in actor from Supabase, and keep vendor writes on the session client so RLS checks ownership. Tests cover rejected payloads, authentication failures and database failures.
