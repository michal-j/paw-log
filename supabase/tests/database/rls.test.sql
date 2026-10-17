-- Row-level security tests (JCB-35). Runs with `supabase test db` on a local Supabase stack,
-- and without Docker with `npm run test:db` (PGlite plus a pgTAP shim, see tests/db/).
-- All data is fictional. Everything runs inside one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(144);

-- Fixtures (as the postgres role, which bypasses RLS, like the bootstrap SQL).
-- Household A: users a1, a2, dog A. Household B: user b1, dog B. User c belongs to no household.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a1@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'a2@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.test');
insert into public.household (id, name) values
  ('10000000-0000-4000-8000-00000000000a', 'Household A'),
  ('10000000-0000-4000-8000-00000000000b', 'Household B');
insert into public.member (household_id, user_id) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1');
insert into public.dog (id, household_id, name) values
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Dog A'),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'Dog B');
insert into public.item (id, dog_id, kind, name, colour, default_day_part, active_from) values
  ('30000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'food', 'Food A', 'food-farm', 4, '2026-09-01'),
  ('30000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', 'food', 'Food B', 'food-ocean', 4, '2026-09-01');
insert into public.schedule_slot (id, dog_id, item_id, day_part, dose_text, active_from) values
  ('60000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', 4, '1 tray', '2026-09-01'),
  ('60000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b', 4, '1 tray', '2026-09-01');
insert into public.entry (id, dog_id, date, day_part, item_id, dose_text, state) values
  ('40000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', '2026-10-01', 4, '30000000-0000-4000-8000-00000000000a', '1 tray', 'given'),
  ('40000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', '2026-10-01', 4, '30000000-0000-4000-8000-00000000000b', '1 tray', 'given');
insert into public.day_part (dog_id, part, usual_time) values
  ('20000000-0000-4000-8000-00000000000b', 2, '08:00');
insert into public.dog_settings (dog_id, log_start) values
  ('20000000-0000-4000-8000-00000000000b', '2026-01-01');
insert into public.pinned_note (id, dog_id, title, body, position) values
  ('70000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'Note A', 'Body A', 1),
  ('70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', 'Note B', 'Body B', 1);
insert into public.event (id, dog_id, date, type, title) values
  ('50000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', '2026-10-02', 'vet', 'Check-up A'),
  ('50000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', '2026-10-02', 'vet', 'Check-up B');
insert into public.condition (id, dog_id, name, started_on) values
  ('70000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'Condition A', '2026-10-01'),
  ('70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', 'Condition B', '2026-10-01');
insert into public.event_condition (event_id, condition_id, dog_id) values
  ('50000000-0000-4000-8000-00000000000a', '70000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a'),
  ('50000000-0000-4000-8000-00000000000b', '70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b');

-- 1. Anonymous visitors get nothing, not even an empty list.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select * from public.household', '42501', null, 'anon cannot read household');
select throws_ok('select * from public.member', '42501', null, 'anon cannot read member');
select throws_ok('select * from public.dog', '42501', null, 'anon cannot read dog');
select throws_ok('select * from public.item', '42501', null, 'anon cannot read item');
select throws_ok('select * from public.entry', '42501', null, 'anon cannot read entry');
select throws_ok('select * from public.schedule_slot', '42501', null, 'anon cannot read schedule_slot');
select throws_ok('select * from public.event', '42501', null, 'anon cannot read event');
select throws_ok('select * from public.day_part', '42501', null, 'anon cannot read day_part');
select throws_ok('select * from public.dog_settings', '42501', null, 'anon cannot read dog_settings');
select throws_ok('select * from public.pinned_note', '42501', null, 'anon cannot read pinned_note');
select throws_ok(
  $$insert into public.pinned_note (dog_id, body) values ('20000000-0000-4000-8000-00000000000a', 'x')$$,
  '42501', null, 'anon cannot write pinned_note');
select throws_ok('select * from public.condition', '42501', null, 'anon cannot read condition');
select throws_ok('select * from public.event_condition', '42501', null, 'anon cannot read event_condition');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-03', 1, '30000000-0000-4000-8000-00000000000a', 'given')$$,
  '42501', null, 'anon cannot write entry');
reset role;

-- 2. Member a1 sees only household A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.household), 1, 'a1 sees one household');
select is((select count(*)::int from public.member), 2, 'a1 sees the two members of household A');
select is((select name from public.dog), 'Dog A', 'a1 sees only dog A');
select is((select count(*)::int from public.item), 1, 'a1 sees only items of dog A');
select is((select count(*)::int from public.entry), 1, 'a1 sees only entries of dog A');
select is((select count(*)::int from public.event), 1, 'a1 sees only events of dog A');
select is((select count(*)::int from public.schedule_slot), 1, 'a1 sees only schedule slots of dog A');
select is_empty($$select 1 from public.entry where id = '40000000-0000-4000-8000-00000000000b'$$, 'a1 cannot read an entry of household B by id');

-- 3. a1 writes in household A, and only there.
select lives_ok(
  $$insert into public.entry (id, dog_id, date, day_part, item_id, dose_text, state, created_by)
    values ('40000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '2026-10-03', 2,
            '30000000-0000-4000-8000-00000000000a', '½ pill', 'partial', '00000000-0000-4000-8000-0000000000b1')$$,
  'a1 can add an entry for dog A');
select is((select created_by from public.entry where id = '40000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'created_by is the signed-in user, whatever the client sends');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, state)
    values ('20000000-0000-4000-8000-00000000000b', '2026-10-03', 1, '30000000-0000-4000-8000-00000000000b', 'given')$$,
  '42501', null, 'a1 cannot add an entry for dog B');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-03', 1, '30000000-0000-4000-8000-00000000000b', 'given')$$,
  '23503', null, 'an entry cannot use an item of another dog');
select throws_ok(
  $$update public.entry set dog_id = '20000000-0000-4000-8000-00000000000b'
    where id = '40000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a1 cannot move an entry to dog B');
update public.entry set note = 'tampered' where id = '40000000-0000-4000-8000-00000000000b';
delete from public.entry where id = '40000000-0000-4000-8000-00000000000b';
update public.event set title = 'tampered' where id = '50000000-0000-4000-8000-00000000000b';
delete from public.event where id = '50000000-0000-4000-8000-00000000000b';
select lives_ok(
  $$insert into public.event (dog_id, date, type, title, detail)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-03', 'symptom', 'Vomiting', 'After dinner')$$,
  'a1 can add an event for dog A');
select throws_ok(
  $$insert into public.event (dog_id, date, type, title)
    values ('20000000-0000-4000-8000-00000000000b', '2026-10-03', 'symptom', 'x')$$,
  '42501', null, 'a1 cannot add an event for dog B');
select throws_ok(
  $$insert into public.item (dog_id, kind, name, colour, default_day_part, active_from)
    values ('20000000-0000-4000-8000-00000000000b', 'treat', 'x', 'treat', 6, '2026-10-01')$$,
  '42501', null, 'a1 cannot add an item for dog B');
select lives_ok(
  $$insert into public.item (dog_id, kind, name, colour, default_day_part, active_from)
    values ('20000000-0000-4000-8000-00000000000a', 'treat', 'Treat A', 'treat', 6, '2026-10-01')$$,
  'a1 can add an item for dog A');

-- 3b. Schedule slots and the one-entry-per-slot-per-day rule.
select throws_ok(
  $$insert into public.schedule_slot (dog_id, item_id, day_part, active_from)
    values ('20000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b', 2, '2026-10-01')$$,
  '42501', null, 'a1 cannot add a schedule slot for dog B');
select lives_ok(
  $$insert into public.entry (id, dog_id, date, day_part, item_id, schedule_slot_id, state)
    values ('40000000-0000-4000-8000-0000000000a3', '20000000-0000-4000-8000-00000000000a', '2026-10-04', 4,
            '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', 'given')$$,
  'a1 can fill a schedule slot');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, schedule_slot_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 4,
            '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', 'skipped')$$,
  '23505', null, 'a slot cannot be filled twice on the same date');
select lives_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 4, '30000000-0000-4000-8000-00000000000a', 'given'),
           ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 4, '30000000-0000-4000-8000-00000000000a', 'given')$$,
  'unplanned entries (no slot) are not limited');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, schedule_slot_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-05', 4,
            '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000b', 'given')$$,
  '23503', null, 'an entry cannot use a schedule slot of another dog');
select lives_ok(
  $$insert into public.event (dog_id, date, type, title, intensity)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 'note', 'Calm day', null),
           ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 'symptom', 'Itching', 'medium')$$,
  'events take the note type and an intensity');
select throws_ok(
  $$insert into public.event (dog_id, date, type, title, intensity)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-04', 'symptom', 'x', 'huge')$$,
  '23514', null, 'intensity is small, medium or large');

-- 3c. JCB-39: structured amounts, symptom properties, day-part times, removing a usual-day slot.
select lives_ok(
  $$insert into public.entry (id, dog_id, date, day_part, item_id, amount, unit, flavour, state)
    values ('40000000-0000-4000-8000-0000000000a4', '20000000-0000-4000-8000-00000000000a', '2026-10-06', 4,
            '30000000-0000-4000-8000-00000000000a', 0.5, 'can', 'turkey', 'partial')$$,
  'an entry takes amount, unit and flavour');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 4, '30000000-0000-4000-8000-00000000000a', 1, 'cup', 'given')$$,
  '23514', null, 'unit is one of the known units');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 4, '30000000-0000-4000-8000-00000000000a', 0, 'can', 'given')$$,
  '23514', null, 'amount is above zero');
select lives_ok(
  $$insert into public.event (dog_id, date, type, title, props, also_done)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 'symptom', 'Poo', '{"consistency":"soft","colour":"dark"}', '{}'),
           ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 'vet', 'Clinic A', '{}', '{anal_glands,nails}')$$,
  'events take symptom properties and vet "also done"');
select throws_ok(
  $$insert into public.event (dog_id, date, type, title, also_done)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 'vet', 'x', '{grooming}')$$,
  '23514', null, 'also_done takes only the known values');
select throws_ok(
  $$insert into public.event (dog_id, date, type, title, props)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-06', 'symptom', 'x', '[1]')$$,
  '23514', null, 'props is an object');
select lives_ok(
  $$insert into public.day_part (dog_id, part, usual_time) values ('20000000-0000-4000-8000-00000000000a', 2, '07:45')
    on conflict (dog_id, part) do update set usual_time = excluded.usual_time$$,
  'a1 can set a day-part time for dog A');
select is((select count(*)::int from public.day_part), 1, 'a1 sees only the day-part times of dog A');
select throws_ok(
  $$insert into public.day_part (dog_id, part, usual_time) values ('20000000-0000-4000-8000-00000000000b', 3, '12:00')$$,
  '42501', null, 'a1 cannot set a day-part time for dog B');
update public.day_part set usual_time = '05:00' where dog_id = '20000000-0000-4000-8000-00000000000b';
select lives_ok(
  $$insert into public.schedule_slot (id, dog_id, item_id, day_part, flavour, amount, unit, active_from)
    values ('60000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a',
            6, 'turkey', 0.25, 'can', '2026-10-01')$$,
  'a schedule slot takes flavour, amount and unit');
select throws_ok(
  $$insert into public.schedule_slot (dog_id, item_id, day_part, amount, unit, active_from, is_course)
    values ('20000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', 3, 1, 'sachet', '2026-10-01', true)$$,
  '23514', null, 'a course needs an end date');
insert into public.entry (id, dog_id, date, day_part, item_id, schedule_slot_id, state)
  values ('40000000-0000-4000-8000-0000000000a5', '20000000-0000-4000-8000-00000000000a', '2026-10-07', 6,
          '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-0000000000a2', 'given');
select lives_ok($$delete from public.schedule_slot where id = '60000000-0000-4000-8000-0000000000a2'$$,
  'a usual-day slot that entries filled can be removed');
select is((select schedule_slot_id from public.entry where id = '40000000-0000-4000-8000-0000000000a5'), null::uuid,
  'its entries stay, unplanned');
select is((select dog_id from public.entry where id = '40000000-0000-4000-8000-0000000000a5'),
  '20000000-0000-4000-8000-00000000000a'::uuid, 'and keep their dog');

-- 3d. JCB-43: a usual-day item removed for a day, and the log start setting.
select lives_ok(
  $$insert into public.entry (id, dog_id, date, day_part, item_id, schedule_slot_id, state)
    values ('40000000-0000-4000-8000-0000000000a6', '20000000-0000-4000-8000-00000000000a', '2026-10-08', 4,
            '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', 'removed')$$,
  'an entry can be a removal marker for its slot');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, schedule_slot_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-08', 4,
            '30000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', 'given')$$,
  '23505', null, 'a removed slot is not filled again that day');
select throws_ok(
  $$insert into public.entry (dog_id, date, day_part, item_id, state)
    values ('20000000-0000-4000-8000-00000000000a', '2026-10-08', 4, '30000000-0000-4000-8000-00000000000a', 'lost')$$,
  '23514', null, 'state is given, skipped, partial or removed');
select lives_ok(
  $$insert into public.dog_settings (dog_id, log_start) values ('20000000-0000-4000-8000-00000000000a', '2026-09-01')
    on conflict (dog_id) do update set log_start = excluded.log_start$$,
  'a1 can set the log start of dog A');
select throws_ok(
  $$insert into public.dog_settings (dog_id, log_start) values ('20000000-0000-4000-8000-00000000000b', '2026-09-01')$$,
  '42501', null, 'a1 cannot set the log start of dog B');
update public.dog_settings set log_start = '2020-01-01' where dog_id = '20000000-0000-4000-8000-00000000000b';
select is((select count(*)::int from public.dog_settings), 1, 'a1 sees only the settings of dog A');

-- 3e. JCB-5: pinned notes.
select is((select count(*)::int from public.pinned_note), 1, 'a1 sees only the pinned notes of dog A');
select lives_ok(
  $$insert into public.pinned_note (id, dog_id, title, body, position, created_by)
    values ('70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '', 'Second note', 0,
            '00000000-0000-4000-8000-0000000000b1')$$,
  'a1 can add a pinned note (no title) for dog A');
select is((select created_by from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'created_by of a note is the signed-in user, whatever the client sends');
select is((select updated_by from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'updated_by of a new note is the signed-in user');
select throws_ok(
  $$insert into public.pinned_note (dog_id, body) values ('20000000-0000-4000-8000-00000000000b', 'x')$$,
  '42501', null, 'a1 cannot add a pinned note for dog B');
select throws_ok(
  $$insert into public.pinned_note (dog_id, body) values ('20000000-0000-4000-8000-00000000000a', '   ')$$,
  '23514', null, 'a pinned note needs text');
select throws_ok(
  $$update public.pinned_note set dog_id = '20000000-0000-4000-8000-00000000000b'
    where id = '70000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a1 cannot move a pinned note to dog B');
update public.pinned_note set body = 'tampered' where id = '70000000-0000-4000-8000-00000000000b';
delete from public.pinned_note where id = '70000000-0000-4000-8000-00000000000b';
-- Moving a note is not an edit: updated_at and updated_by stay.
update public.pinned_note set updated_at = '2026-09-01T10:00:00Z' where id = '70000000-0000-4000-8000-0000000000a2';
select is((select updated_at from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  now(), 'an update that changes neither title nor text keeps updated_at (the client cannot set it)');
update public.pinned_note set position = 5 where id = '70000000-0000-4000-8000-0000000000a2';
select is((select position from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'), 5, 'a note can be moved');
-- Undo restores the original stamp through restore_pinned_note(); nothing else can set it.
select lives_ok(
  $$select public.restore_pinned_note('70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a',
      '', 'Second note', 5, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', '2026-09-01T10:00:00Z')$$,
  'a1 can restore a pinned note of dog A');
select is((select updated_at from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '2026-09-01T10:00:00Z'::timestamptz, 'a restore keeps the original updated_at');
select throws_ok(
  $$select public.restore_pinned_note('70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b',
      '', 'x', 0, null, null, '2026-09-01T10:00:00Z')$$,
  '42501', null, 'a1 cannot restore a pinned note of dog B');
select throws_ok(
  $$select public.restore_pinned_note('70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a',
      '', 'x', 0, null, null, now() + interval '1 day')$$,
  '22023', null, 'a restore cannot date a note in the future');
select throws_ok(
  $$select public.restore_pinned_note('70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a',
      '', 'x', 0, null, '00000000-0000-4000-8000-0000000000b1', '2026-09-01T10:00:00Z')$$,
  '22023', null, 'a restore cannot name someone outside the household');
-- 3f. JCB-6: tracked conditions and their links to events.
select is((select count(*)::int from public.condition), 1, 'a1 sees only the conditions of dog A');
select is((select count(*)::int from public.event_condition), 1, 'a1 sees only the links of dog A');
select throws_ok('select issue_id from public.event', '42703', null, 'event.issue_id is gone');
select lives_ok(
  $$insert into public.condition (id, dog_id, name, started_on, description, created_by)
    values ('70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', 'Lump', '2026-10-03', 'Left side',
            '00000000-0000-4000-8000-0000000000b1')$$,
  'a1 can add a condition for dog A');
select is((select created_by from public.condition where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'a condition''s created_by is the signed-in user');
select throws_ok(
  $$insert into public.condition (dog_id, name, started_on) values ('20000000-0000-4000-8000-00000000000b', 'x', '2026-10-03')$$,
  '42501', null, 'a1 cannot add a condition for dog B');
select throws_ok(
  $$insert into public.condition (dog_id, name, started_on, resolved_on)
    values ('20000000-0000-4000-8000-00000000000a', 'x', '2026-10-03', '2026-10-02')$$,
  '23514', null, 'a condition cannot be resolved before it started');
select throws_ok(
  $$insert into public.condition (dog_id, name, started_on) values ('20000000-0000-4000-8000-00000000000a', '  ', '2026-10-03')$$,
  '23514', null, 'a condition has a name');
select throws_ok(
  $$insert into public.condition (dog_id, name, started_on) values ('20000000-0000-4000-8000-00000000000a', repeat('x', 61), '2026-10-03')$$,
  '23514', null, 'a condition name has at most 60 characters');
select throws_ok(
  $$insert into public.condition (dog_id, name, started_on, description) values ('20000000-0000-4000-8000-00000000000a', 'x', '2026-10-03', repeat('x', 501))$$,
  '23514', null, 'a condition description has at most 500 characters');
select lives_ok(
  $$insert into public.event_condition (event_id, condition_id, dog_id)
    values ('50000000-0000-4000-8000-00000000000a', '70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a')$$,
  'a1 can link an event of dog A to a second condition');
select throws_ok(
  $$insert into public.event_condition (event_id, condition_id, dog_id)
    values ('50000000-0000-4000-8000-00000000000a', '70000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a')$$,
  '23505', null, 'an event is linked to a condition once');
select throws_ok(
  $$insert into public.event_condition (event_id, condition_id, dog_id)
    values ('50000000-0000-4000-8000-00000000000a', '70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000a')$$,
  '23503', null, 'an event cannot be linked to a condition of another dog');
select throws_ok(
  $$insert into public.event_condition (event_id, condition_id, dog_id)
    values ('50000000-0000-4000-8000-00000000000b', '70000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'a1 cannot link events of dog B');
update public.condition set name = 'tampered' where id = '70000000-0000-4000-8000-00000000000b';
delete from public.condition where id = '70000000-0000-4000-8000-00000000000b';
delete from public.event_condition where condition_id = '70000000-0000-4000-8000-00000000000b';
select throws_ok(
  $$update public.condition set dog_id = '20000000-0000-4000-8000-00000000000b' where id = '70000000-0000-4000-8000-0000000000a2'$$,
  '42501', null, 'a1 cannot move a condition to dog B');
select lives_ok($$update public.condition set resolved_on = '2026-10-10' where id = '70000000-0000-4000-8000-0000000000a2'$$,
  'a1 can resolve a condition');
select lives_ok($$delete from public.condition where id = '70000000-0000-4000-8000-0000000000a2'$$,
  'a1 can delete a condition');
select is((select count(*)::int from public.event_condition where event_id = '50000000-0000-4000-8000-00000000000a'), 1,
  'deleting a condition deletes its links only');
select is((select count(*)::int from public.event where id = '50000000-0000-4000-8000-00000000000a'), 1,
  'the linked event stays');
insert into public.event (id, dog_id, date, type, title)
  values ('50000000-0000-4000-8000-0000000000a9', '20000000-0000-4000-8000-00000000000a', '2026-10-09', 'note', 'Linked note');
insert into public.event_condition (event_id, condition_id, dog_id)
  values ('50000000-0000-4000-8000-0000000000a9', '70000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a');
delete from public.event where id = '50000000-0000-4000-8000-0000000000a9';
select is((select count(*)::int from public.event_condition where condition_id = '70000000-0000-4000-8000-00000000000a'), 1,
  'deleting an event deletes its links, the condition keeps the others');

-- 4. Nobody can grant themselves access: households, members and dogs are read-only.
select throws_ok(
  $$insert into public.member (household_id, user_id)
    values ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'a1 cannot join household B');
select throws_ok($$insert into public.household (name) values ('New')$$, '42501', null, 'a1 cannot create a household');
select throws_ok(
  $$insert into public.dog (household_id, name) values ('10000000-0000-4000-8000-00000000000a', 'New')$$,
  '42501', null, 'a1 cannot create a dog');
select throws_ok(
  $$update public.dog set household_id = '10000000-0000-4000-8000-00000000000b'$$,
  '42501', null, 'a1 cannot move a dog');
reset role;

-- 5. The other member of household A sees and edits a1's records.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.entry), 8, 'a2 sees all entries of household A');
update public.entry set note = 'edited by a2' where id = '40000000-0000-4000-8000-0000000000a2';
select is((select note from public.entry where id = '40000000-0000-4000-8000-0000000000a2'), 'edited by a2', 'a2 can edit an entry a1 added');
select is((select created_by from public.entry where id = '40000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'editing keeps the original created_by');
select is((select updated_by from public.entry where id = '40000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a2'::uuid, 'updated_by is the last editor');
select is((select count(*)::int from public.pinned_note), 2, 'a2 sees the pinned notes of household A');
update public.pinned_note set position = -1 where id = '70000000-0000-4000-8000-0000000000a2';
select is((select updated_by from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'moving a note does not make a2 its last editor');
update public.pinned_note set body = 'Edited by a2' where id = '70000000-0000-4000-8000-0000000000a2';
select is((select updated_by from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a2'::uuid, 'editing a note a1 added makes a2 its last editor');
select is((select created_by from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'and keeps its created_by');
select lives_ok($$delete from public.pinned_note where id = '70000000-0000-4000-8000-0000000000a2'$$, 'a2 can delete a pinned note of household A');
select lives_ok($$delete from public.entry where id = '40000000-0000-4000-8000-0000000000a2'$$, 'a2 can delete an entry of household A');
select is((select count(*)::int from public.entry), 7, 'the deleted entry is gone');
reset role;

-- 6. A signed-in user with no household sees nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.household) + (select count(*)::int from public.dog)
  + (select count(*)::int from public.entry) + (select count(*)::int from public.event)
  + (select count(*)::int from public.schedule_slot), 0, 'user without household sees no rows');
reset role;

-- 7. Household B's member sees only B, and a1's attempts left B's rows untouched.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.entry), 1, 'b1 sees only the entry of dog B');
select is((select note from public.entry where id = '40000000-0000-4000-8000-00000000000b'), '', 'a1 could not edit or delete B''s entry');
select is((select title from public.event where id = '50000000-0000-4000-8000-00000000000b'), 'Check-up B', 'a1 could not edit or delete B''s event');
select is((select count(*)::int from public.pinned_note), 1, 'b1 sees only the pinned note of dog B');
select is((select body from public.pinned_note), 'Body B', 'a1 could not edit or delete B''s pinned note');
select is((select count(*)::int from public.item), 1, 'b1 does not see the item a1 added');
select is((select count(*)::int from public.schedule_slot), 1, 'b1 sees only the schedule slot of dog B');
select is((select usual_time from public.day_part), '08:00'::time, 'b1 sees only dog B''s day-part time, which a1 could not change');
select is((select log_start from public.dog_settings), '2026-01-01'::date, 'b1 sees only dog B''s log start, which a1 could not change');
select is((select name from public.condition), 'Condition B', 'b1 sees only dog B''s condition, which a1 could not change or delete');
select is((select count(*)::int from public.event_condition), 1, 'b1 sees only dog B''s link, which a1 could not delete');
reset role;

-- 8. Photos (JCB-7): attachment rows and the private photos bucket.
insert into public.attachment (id, dog_id, event_id, storage_path, width, height) values
  ('80000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-00000000000a.jpg', 1600, 1200),
  ('80000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b/80000000-0000-4000-8000-00000000000b.jpg', 1600, 1200);
insert into storage.objects (bucket_id, name) values
  ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-00000000000a.jpg'), ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-00000000000a.thumb.jpg'),
  ('photos', '20000000-0000-4000-8000-00000000000b/80000000-0000-4000-8000-00000000000b.jpg'), ('photos', '20000000-0000-4000-8000-00000000000b/80000000-0000-4000-8000-00000000000b.thumb.jpg');
select is((select public from storage.buckets where id = 'photos'), false, 'the photos bucket is private');
select is((select allowed_mime_types from storage.buckets where id = 'photos'), array['image/jpeg'], 'the photos bucket takes JPEG only');
select ok((select file_size_limit from storage.buckets where id = 'photos') <= 5242880, 'the photos bucket limits the file size');
select throws_ok(
  $$insert into public.attachment (dog_id, event_id, storage_path, width, height)
    values ('20000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a/somewhere-else.jpg', 10, 10)$$,
  '23514', null, 'an attachment path must be <dog>/<id>.jpg');
select throws_ok(
  $$insert into public.attachment (id, dog_id, event_id, storage_path, width, height)
    values ('80000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg', 10, 10)$$,
  '23503', null, 'an attachment cannot point at an event of another dog');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select * from public.attachment', '42501', null, 'anon cannot read attachment');
select is((select count(*)::int from storage.objects), 0, 'anon sees no photo files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg')$$,
  '42501', null, 'anon cannot upload a photo');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.attachment), 1, 'a1 sees only the attachment of dog A');
select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 2, 'a1 sees only the files of dog A');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg'), ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.thumb.jpg')$$,
  'a1 can upload a photo of dog A');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg')
    on conflict (bucket_id, name) do update set updated_at = now()$$,
  'a1 can upload the same photo again (a retry replaces it)');
select lives_ok(
  $$insert into public.attachment (id, dog_id, event_id, storage_path, width, height, taken_at, caption)
    values ('80000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg', 1200, 1600, '2026-10-02 09:41:00', 'Left side')$$,
  'a1 can add an attachment to an event of dog A');
select is((select created_by from public.attachment where id = '80000000-0000-4000-8000-0000000000a2'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'the attachment is stamped with its author');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', '20000000-0000-4000-8000-00000000000b/80000000-0000-4000-8000-0000000000a2.jpg')$$,
  '42501', null, 'a1 cannot upload into dog B''s folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', '20000000-0000-4000-8000-00000000000a/../20000000-0000-4000-8000-00000000000b/x.jpg')$$,
  '42501', null, 'a1 cannot upload under a name that is not <dog>/<id>.jpg');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('other', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg')$$,
  '42501', null, 'the policies cover the photos bucket only');
select throws_ok(
  $$insert into public.attachment (dog_id, event_id, storage_path, width, height)
    values ('20000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b/80000000-0000-4000-8000-00000000000b.jpg', 10, 10)$$,
  '42501', null, 'a1 cannot add an attachment to dog B');
update public.attachment set caption = 'tampered' where id = '80000000-0000-4000-8000-00000000000b';
delete from public.attachment where id = '80000000-0000-4000-8000-00000000000b';
delete from storage.objects where name like '20000000-0000-4000-8000-00000000000b/%';
select throws_ok(
  $$update public.attachment set dog_id = '20000000-0000-4000-8000-00000000000b' where id = '80000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'a1 cannot move an attachment to dog B');
delete from storage.objects where name = '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg';
select is((select count(*)::int from storage.objects where name = '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg'), 1,
  'a file cannot be deleted while its attachment row exists');
select lives_ok($$delete from public.attachment where id = '80000000-0000-4000-8000-0000000000a2'$$, 'a1 can delete an attachment');
delete from storage.objects where name in ('20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.jpg', '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2.thumb.jpg');
select is((select count(*)::int from storage.objects where name like '20000000-0000-4000-8000-00000000000a/80000000-0000-4000-8000-0000000000a2%'), 0,
  'once the row is gone its files can be deleted');
delete from public.event where id = '50000000-0000-4000-8000-00000000000a';
select is((select count(*)::int from public.attachment where id = '80000000-0000-4000-8000-00000000000a'), 0, 'deleting an event deletes its attachment rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select is((select caption from public.attachment), '', 'b1 sees only dog B''s attachment, which a1 could not change or delete');
select is((select count(*)::int from storage.objects where bucket_id = 'photos'), 2, 'b1 sees only dog B''s files, which a1 could not delete');
reset role;

select * from finish();
rollback;
