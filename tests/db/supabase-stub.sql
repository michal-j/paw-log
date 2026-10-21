-- Minimal stand-in for what a Supabase database provides before our migrations run,
-- so `npm run test:db` can apply them in PGlite (in-process Postgres) without Docker.
-- Mirrors Supabase: the API roles, auth.users, auth.uid() reading the request JWT claims,
-- and default grants of functions in `public` to anon and authenticated. Tables get no default
-- grants: from 30 Oct 2026 Supabase stops granting new `public` tables to the Data API, so every
-- migration must grant its own tables (JCB-128).

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
alter default privileges in schema public grant all on functions to anon, authenticated;

-- Storage (JCB-7): the two tables of Supabase's `storage` schema the migrations use, with RLS on
-- and the API roles' grants, as on a Supabase project. Files themselves are not stored here.
create schema storage;
grant usage on schema storage to anon, authenticated;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated;
