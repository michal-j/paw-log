-- PawLog core schema (JCB-35): household, member, dog, item, schedule_slot, entry, event.
-- Maps to src/data/types.ts. pinned_note, issue and attachment come in a later slice.
-- Row-level security is in the next migration; nothing here is reachable by clients until then.

-- Household: the unit of sharing. Both members read and write everything in it.
create table public.household (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Member: links a Supabase auth user to a household.
create table public.member (
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index member_user_id_idx on public.member (user_id);

-- Dog: every data table below carries dog_id so several dogs stay possible.
create table public.dog (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index dog_household_id_idx on public.dog (household_id);

-- Item: something that can be given (food, medication, treat, supplement, procedure).
create table public.item (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  kind text not null check (kind in ('food', 'medication', 'treat', 'supplement', 'procedure')),
  name text not null,
  -- Name of a colour token in docs/design-system/tokens.json, for example `food-farm`.
  colour text not null check (colour ~ '^[a-z0-9-]+$'),
  -- Kept for the timeline's lane order and quick add; the real plan is in schedule_slot.
  default_day_part smallint not null check (default_day_part between 1 and 7),
  active_from date not null,
  active_to date check (active_to is null or active_to >= active_from),
  hidden_by_default boolean not null default false,
  -- Lane order in the timeline ("item order"); ties fall back to created_at.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign key on entry, so an entry can only use its own dog's items.
  unique (id, dog_id)
);
create index item_dog_id_idx on public.item (dog_id, position);

-- Schedule slot: the plan. One item can sit in several day parts, each with its own dose,
-- for a period of time. Slots are ended with active_to rather than deleted, so history keeps them.
create table public.schedule_slot (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  item_id uuid not null,
  day_part smallint not null check (day_part between 1 and 7),
  dose_text text not null default '',
  active_from date not null,
  active_to date check (active_to is null or active_to >= active_from),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, dog_id),
  foreign key (item_id, dog_id) references public.item (id, dog_id) on delete restrict
);
create index schedule_slot_dog_idx on public.schedule_slot (dog_id, active_from);
create index schedule_slot_item_idx on public.schedule_slot (item_id);

-- Entry: one item given (or skipped, or partly eaten) on one day part of one date.
create table public.entry (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  date date not null,
  day_part smallint not null check (day_part between 1 and 7),
  item_id uuid not null,
  -- The planned slot this entry fills; null for an unplanned (ad hoc) entry.
  schedule_slot_id uuid,
  dose_text text not null default '',
  state text not null check (state in ('given', 'skipped', 'partial')),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (item_id, dog_id) references public.item (id, dog_id) on delete restrict,
  foreign key (schedule_slot_id, dog_id) references public.schedule_slot (id, dog_id) on delete restrict
);
create index entry_dog_date_idx on public.entry (dog_id, date);
create index entry_item_idx on public.entry (item_id);
-- One entry per planned slot per day, so two people filling in the same day cannot create duplicates.
-- Ad hoc entries (schedule_slot_id null) are not limited: nulls are distinct.
create unique index entry_slot_per_day_idx on public.entry (dog_id, date, schedule_slot_id);

-- Event: vet visit, symptom, photo, Frontline, deworming and so on. `type` is a stable key;
-- title and detail are free text in whichever language the household writes.
create table public.event (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  date date not null,
  type text not null check (
    type in ('vet', 'symptom', 'photo', 'frontline', 'deworming', 'anal_glands', 'nails', 'note', 'other')
  ),
  title text not null default '',
  detail text not null default '',
  -- How strong, for symptoms and similar; null when it does not apply.
  intensity text check (intensity in ('small', 'medium', 'large')),
  -- Links to the future `issue` table; the foreign key is added with that table.
  issue_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_dog_date_idx on public.event (dog_id, date);

-- created_by is always the signed-in user on insert and never changes afterwards;
-- updated_by and updated_at follow every write, whatever the client sends.
create function public.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger entry_stamp before insert or update on public.entry
  for each row execute function public.stamp_row();
create trigger event_stamp before insert or update on public.event
  for each row execute function public.stamp_row();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger item_touch before update on public.item
  for each row execute function public.touch_updated_at();
create trigger schedule_slot_touch before update on public.schedule_slot
  for each row execute function public.touch_updated_at();
