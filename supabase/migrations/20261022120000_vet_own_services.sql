-- JCB-89: a vet visit's "also done" may hold the dog's own services next to the built-in keys
-- (anal_glands, nails). Own services are saved as typed text, like clinic names: no new table.
-- The new rule is looser than the old one, so every existing row passes and old app versions keep working.
-- Rule: at most 10 items, each already trimmed and 1 to 40 characters long.
-- A check cannot hold a subquery, so the per-item test lives in a small immutable function.
create function public.also_done_valid(items text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(items), 0) <= 10
    and not exists (
      select 1 from unnest(items) as s
      where s is null or s <> btrim(s) or char_length(s) not between 1 and 40
    );
$$;
-- Callable only where rows are written (the check runs as the writing role); not from the anon API.
revoke all on function public.also_done_valid(text[]) from public, anon;
grant execute on function public.also_done_valid(text[]) to authenticated;

alter table public.event drop constraint event_also_done_check;
alter table public.event
  add constraint event_also_done_check check (public.also_done_valid(also_done));
