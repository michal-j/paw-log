-- Tracked conditions (JCB-6). Earlier migrations are applied in production and stay untouched.
--
-- A condition (a lump, stomach trouble) is followed over time through the events linked to it. An
-- event can belong to several conditions, so the single event.issue_id from the core schema (never
-- used by the app, no table behind it) is replaced by the event_condition link table.

-- 1. event.issue_id goes. Stop instead of dropping data if anything was ever written to it.
do $$
begin
  if exists (select 1 from public.event where issue_id is not null) then
    raise exception 'event.issue_id is set on some rows; move those links to event_condition before dropping it';
  end if;
end;
$$;
alter table public.event drop column issue_id;

-- Target of the composite foreign key on event_condition, so a link stays within one dog.
alter table public.event add constraint event_id_dog_id_key unique (id, dog_id);

-- 2. condition: open while resolved_on is null; reopening clears it.
create table public.condition (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 60),
  started_on date not null,
  description text not null default '' check (char_length(description) <= 500),
  resolved_on date check (resolved_on is null or resolved_on >= started_on),
  -- Tie-breaker in lists; the Tracked list orders by started_on / resolved_on.
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, dog_id)
);
create index condition_dog_idx on public.condition (dog_id, started_on);

create trigger condition_stamp before insert or update on public.condition
  for each row execute function public.stamp_row();

-- 3. event_condition: which events belong to which conditions. Composite foreign keys with dog_id
--    stop a link between an event and a condition of different dogs (or households). Deleting an
--    event or a condition deletes its links only.
create table public.event_condition (
  event_id uuid not null,
  condition_id uuid not null,
  dog_id uuid not null references public.dog (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, condition_id),
  foreign key (event_id, dog_id) references public.event (id, dog_id) on delete cascade,
  foreign key (condition_id, dog_id) references public.condition (id, dog_id) on delete cascade
);
create index event_condition_condition_idx on public.event_condition (condition_id);
create index event_condition_dog_idx on public.event_condition (dog_id);

-- 4. Row-level security, as on the other data tables.
alter table public.condition enable row level security;
alter table public.event_condition enable row level security;
revoke all on public.condition, public.event_condition from anon, authenticated;
grant select, insert, update, delete on public.condition, public.event_condition to authenticated;

create policy condition_select on public.condition for select to authenticated
  using (private.can_access_dog(dog_id));
create policy condition_insert on public.condition for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy condition_update on public.condition for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy condition_delete on public.condition for delete to authenticated
  using (private.can_access_dog(dog_id));

create policy event_condition_select on public.event_condition for select to authenticated
  using (private.can_access_dog(dog_id));
create policy event_condition_insert on public.event_condition for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy event_condition_update on public.event_condition for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy event_condition_delete on public.event_condition for delete to authenticated
  using (private.can_access_dog(dog_id));
