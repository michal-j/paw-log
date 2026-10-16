-- Row-level security (JCB-35): a signed-in user reads and writes only rows of households
-- they are a member of. The anon role gets nothing. Households, members and dogs are created
-- by the CEO with the bootstrap SQL (runs as the postgres role, which bypasses RLS).

-- Helpers live in a schema the Data API does not expose. SECURITY DEFINER lets them read
-- `member` without recursing into its own policies; search_path is pinned to stop hijacking.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member m
    where m.household_id = target_household and m.user_id = (select auth.uid())
  );
$$;

create function private.can_access_dog(target_dog uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dog d
    join public.member m on m.household_id = d.household_id
    where d.id = target_dog and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.can_access_dog(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.can_access_dog(uuid) to authenticated;

-- Trigger functions are not meant to be called directly.
revoke all on function public.stamp_row() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter table public.household enable row level security;
alter table public.member enable row level security;
alter table public.dog enable row level security;
alter table public.item enable row level security;
alter table public.schedule_slot enable row level security;
alter table public.entry enable row level security;
alter table public.event enable row level security;

-- Table privileges: Supabase grants everything to anon and authenticated by default.
-- Start from nothing and grant only what the app uses.
revoke all on public.household, public.member, public.dog, public.item, public.schedule_slot, public.entry,
  public.event from anon, authenticated;
grant select on public.household, public.member, public.dog to authenticated;
grant select, insert, update, delete on public.item, public.schedule_slot, public.entry, public.event
  to authenticated;

-- household, member, dog: read-only for the household's members.
create policy household_select on public.household
  for select to authenticated
  using (private.is_household_member(id));

create policy member_select on public.member
  for select to authenticated
  using (private.is_household_member(household_id));

create policy dog_select on public.dog
  for select to authenticated
  using (private.is_household_member(household_id));

-- item, schedule_slot, entry, event: full read and write, scoped to dogs of the user's households.
-- USING guards the existing row, WITH CHECK the new one, so a row cannot be moved out either.
create policy item_select on public.item for select to authenticated
  using (private.can_access_dog(dog_id));
create policy item_insert on public.item for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy item_update on public.item for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy item_delete on public.item for delete to authenticated
  using (private.can_access_dog(dog_id));

create policy schedule_slot_select on public.schedule_slot for select to authenticated
  using (private.can_access_dog(dog_id));
create policy schedule_slot_insert on public.schedule_slot for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy schedule_slot_update on public.schedule_slot for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy schedule_slot_delete on public.schedule_slot for delete to authenticated
  using (private.can_access_dog(dog_id));

create policy entry_select on public.entry for select to authenticated
  using (private.can_access_dog(dog_id));
create policy entry_insert on public.entry for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy entry_update on public.entry for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy entry_delete on public.entry for delete to authenticated
  using (private.can_access_dog(dog_id));

create policy event_select on public.event for select to authenticated
  using (private.can_access_dog(dog_id));
create policy event_insert on public.event for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy event_update on public.event for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy event_delete on public.event for delete to authenticated
  using (private.can_access_dog(dog_id));
