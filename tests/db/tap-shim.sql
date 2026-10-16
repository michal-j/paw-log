-- The subset of pgTAP used by supabase/tests/database/*.test.sql, for PGlite (which has no pgTAP).
-- On a real Supabase stack the same test files run against the genuine extension (`supabase test db`).
-- A passing assertion raises a NOTICE `ok N - description`; a failing one raises an exception.

create function public.plan(n integer) returns setof text language plpgsql as $$
begin
  perform set_config('tap.planned', n::text, true);
  perform set_config('tap.count', '0', true);
  return next '1..' || n;
end $$;

create function public._tap_pass(description text) returns text language plpgsql as $$
declare n integer := coalesce(nullif(current_setting('tap.count', true), ''), '0')::integer + 1;
begin
  perform set_config('tap.count', n::text, true);
  raise notice 'ok % - %', n, description;
  return 'ok ' || n || ' - ' || description;
end $$;

create function public.ok(result boolean, description text) returns text language plpgsql as $$
begin
  if result is not true then
    raise exception 'not ok - %', description;
  end if;
  return public._tap_pass(description);
end $$;

create function public.is(have anyelement, want anyelement, description text) returns text language plpgsql as $$
begin
  if have is distinct from want then
    raise exception 'not ok - % (have %, want %)', description, have, want;
  end if;
  return public._tap_pass(description);
end $$;

create function public.lives_ok(sql text, description text) returns text language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise exception 'not ok - % (died: % %)', description, sqlstate, sqlerrm;
  end;
  return public._tap_pass(description);
end $$;

create function public.throws_ok(sql text, errcode text, errmsg text, description text)
returns text language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if errcode is not null and sqlstate <> errcode then
      raise exception 'not ok - % (threw % %, want %)', description, sqlstate, sqlerrm, errcode;
    end if;
    if errmsg is not null and sqlerrm <> errmsg then
      raise exception 'not ok - % (message "%", want "%")', description, sqlerrm, errmsg;
    end if;
    return public._tap_pass(description);
  end;
  raise exception 'not ok - % (no error thrown)', description;
end $$;

create function public.is_empty(sql text, description text) returns text language plpgsql as $$
declare found_row boolean;
begin
  execute 'select exists (' || sql || ')' into found_row;
  if found_row then
    raise exception 'not ok - % (query returned rows)', description;
  end if;
  return public._tap_pass(description);
end $$;

create function public.finish() returns setof text language plpgsql as $$
declare
  planned integer := nullif(current_setting('tap.planned', true), '')::integer;
  ran integer := coalesce(nullif(current_setting('tap.count', true), ''), '0')::integer;
begin
  if planned is not null and planned <> ran then
    raise exception 'planned % tests but ran %', planned, ran;
  end if;
  return next 'done ' || ran;
end $$;

grant execute on all functions in schema public to anon, authenticated;
