-- Real-data blockers (JCB-43). Earlier migrations are applied in production and stay untouched.
--
-- 1. A usual-day item removed for one day. Deleting an entry that filled a schedule slot keeps the
--    row as a marker with state 'removed' (same id), so the slot is neither shown as "not logged"
--    nor filled again that day: the one-entry-per-slot-per-day index makes Fill skip it.
--    The app never shows a 'removed' row as given; Undo turns it back into the entry it was.
alter table public.entry drop constraint entry_state_check;
alter table public.entry
  add constraint entry_state_check check (state in ('given', 'skipped', 'partial', 'removed'));

-- 2. Settings per dog. log_start: the first day the Timeline and Day view offer, so days before the
--    first record can be opened and filled. Null means the app derives it (earliest record or
--    usual-day start, else one year back).
create table public.dog_settings (
  dog_id uuid primary key references public.dog (id) on delete cascade,
  log_start date,
  updated_at timestamptz not null default now()
);

create trigger dog_settings_touch before update on public.dog_settings
  for each row execute function public.touch_updated_at();

alter table public.dog_settings enable row level security;
revoke all on public.dog_settings from anon, authenticated;
grant select, insert, update, delete on public.dog_settings to authenticated;

create policy dog_settings_select on public.dog_settings for select to authenticated
  using (private.can_access_dog(dog_id));
create policy dog_settings_insert on public.dog_settings for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy dog_settings_update on public.dog_settings for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy dog_settings_delete on public.dog_settings for delete to authenticated
  using (private.can_access_dog(dog_id));
