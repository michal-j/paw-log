-- Logging, editing and the usual day (JCB-39), after the approved design in design/proposals/add-edit/.
-- Adds structured amounts (amount + unit + flavour) to entries and schedule slots, item defaults
-- (unit, flavours, unit conversion), symptom properties and vet "also done" on events, and the
-- usual time of each part of the day. Existing columns stay: dose_text is kept so rows written
-- before this migration still display; new rows leave it empty.

-- Units the app offers (kept as text with a check, so a new unit is one migration away):
-- pill, capsule, sachet, ml, drop, can, tray, g, piece.

-- Item: the unit it is usually given in, its flavours (food), and an optional second unit
-- shown next to the amount (Bellavet: 1 bar = 0.1 ml, shown as "0,15 ml (1,5 bars)").
alter table public.item
  add column default_unit text check (default_unit is null or default_unit in ('pill', 'capsule', 'sachet', 'ml', 'drop', 'can', 'tray', 'g', 'piece')),
  add column flavours text[] not null default '{}',
  add column conversion_unit text check (conversion_unit is null or conversion_unit in ('bars')),
  add column conversion_size numeric check (conversion_size is null or conversion_size > 0),
  add constraint item_conversion_pair check ((conversion_unit is null) = (conversion_size is null));

-- Schedule slot (the usual day): structured amount and flavour; position orders items within a part.
-- A change "from a date" ends the old row the day before and starts a new one; a course is active_to.
alter table public.schedule_slot
  add column flavour text not null default '',
  add column amount numeric check (amount is null or amount > 0),
  add column unit text check (unit is null or unit in ('pill', 'capsule', 'sachet', 'ml', 'drop', 'can', 'tray', 'g', 'piece')),
  add column position integer not null default 0,
  -- A course (set with "How long" on the Usual day): only then does the app show "day n of m".
  -- A slot ended by a change from a date or a removal has active_to but is not a course.
  add column is_course boolean not null default false,
  add constraint schedule_slot_course_has_end check (not is_course or active_to is not null);

-- Entry: structured amount. dose_text stays for rows written before this migration.
alter table public.entry
  add column amount numeric check (amount is null or amount > 0),
  add column unit text check (unit is null or unit in ('pill', 'capsule', 'sachet', 'ml', 'drop', 'can', 'tray', 'g', 'piece')),
  add column flavour text not null default '';

-- Removing a usual-day item that some entries filled turns those entries into unplanned ones
-- instead of blocking the removal. Only schedule_slot_id is cleared; dog_id stays.
alter table public.entry drop constraint entry_schedule_slot_id_dog_id_fkey;
alter table public.entry
  add constraint entry_schedule_slot_id_dog_id_fkey
  foreign key (schedule_slot_id, dog_id) references public.schedule_slot (id, dog_id)
  on delete set null (schedule_slot_id);

-- Event: symptom properties (consistency, colour, quantity, times, when) as a flat object of
-- string keys, and what else was done at a vet visit.
alter table public.event
  add column props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
  add column also_done text[] not null default '{}'
    check (also_done <@ array['anal_glands', 'nails']::text[]);

-- Day part: the usual time of each part of the day, per dog. "Up to now" on today uses it.
-- Parts without a row use the app's defaults (07:00, 07:30, 12:00, 15:00, 18:00, 20:00, 22:00).
create table public.day_part (
  dog_id uuid not null references public.dog (id) on delete cascade,
  part smallint not null check (part between 1 and 7),
  usual_time time not null,
  updated_at timestamptz not null default now(),
  primary key (dog_id, part)
);

create trigger day_part_touch before update on public.day_part
  for each row execute function public.touch_updated_at();

alter table public.day_part enable row level security;
revoke all on public.day_part from anon, authenticated;
grant select, insert, update, delete on public.day_part to authenticated;

create policy day_part_select on public.day_part for select to authenticated
  using (private.can_access_dog(dog_id));
create policy day_part_insert on public.day_part for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy day_part_update on public.day_part for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy day_part_delete on public.day_part for delete to authenticated
  using (private.can_access_dog(dog_id));
