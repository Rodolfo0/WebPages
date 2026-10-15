-- Applied and tracked by the Supabase CLI, separately from Cloudflare D1.

-- SECURITY DEFINER is needed to read auth.users without granting table access.
-- The public registration flow intentionally discloses only email existence.
create or replace function public.auth_email_exists(email_to_check text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    where pg_catalog.length(pg_catalog.btrim(email_to_check)) between 3 and 254
      and pg_catalog.lower(account.email) = pg_catalog.lower(pg_catalog.btrim(email_to_check))
  );
$$;

revoke all on function public.auth_email_exists(text) from public, anon, authenticated;
grant execute on function public.auth_email_exists(text) to anon, authenticated;

notify pgrst, 'reload schema';
