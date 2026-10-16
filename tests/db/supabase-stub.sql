-- Minimal stand-in for what a Supabase database provides before our migrations run,
-- so `npm run test:db` can apply them in PGlite (in-process Postgres) without Docker.
-- Mirrors Supabase: the API roles, auth.users, auth.uid() reading the request JWT claims,
-- and default grants of everything in `public` to anon and authenticated.

create role anon nologin noinherit;
create role authenticated nologin noinherit;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
