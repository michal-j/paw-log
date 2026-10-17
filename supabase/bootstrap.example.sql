-- One-time bootstrap for the real PawLog database (JCB-35). See docs/runbooks/supabase-setup.md.
--
-- 1. Copy this text into the Supabase SQL editor (do NOT save a filled-in copy in the repo).
-- 2. Replace every <PLACEHOLDER>. Both e-mail addresses must already exist under
--    Authentication > Users (created in step 3 of the runbook).
-- 3. Run it once. It stops with an error, and changes nothing, if a placeholder is left,
--    a user is missing, or a household already exists (it was run before).
--
-- The SQL editor runs as the postgres role, which bypasses row-level security; the app cannot
-- create households, members or dogs itself.

do $$
declare
  household_name constant text := '<HOUSEHOLD NAME>';
  dog_name constant text := '<DOG NAME>';
  member_emails constant text[] := array['<EMAIL OF MEMBER 1>', '<EMAIL OF MEMBER 2>'];
  start_text constant text := '<FIRST DAY TO LOG, YYYY-MM-DD>';
  start_date date;
  new_household uuid;
  new_dog uuid;
  added integer;
begin
  if household_name like '<%' or dog_name like '<%' or start_text like '<%'
     or array_to_string(member_emails, ',') like '%<%' then
    raise exception 'Fill in every <PLACEHOLDER> before running this script.';
  end if;
  start_date := start_text::date;

  if exists (select 1 from public.household) then
    raise exception 'A household already exists: this script runs only once. Change data in the Table Editor instead.';
  end if;

  insert into public.household (name) values (household_name) returning id into new_household;
  insert into public.dog (household_id, name) values (new_household, dog_name) returning id into new_dog;

  insert into public.member (household_id, user_id)
  select new_household, u.id from auth.users u where lower(u.email) = any (
    select lower(e) from unnest(member_emails) e
  );
  get diagnostics added = row_count;
  if added <> array_length(member_emails, 1) then
    raise exception 'Expected % members but found % matching users. Create the users first (runbook step 3).',
      array_length(member_emails, 1), added;
  end if;

  -- Initial items. One row per food, medication, treat, supplement or procedure.
  -- kind:     food | medication | treat | supplement | procedure (treats are listed under Food)
  -- colour:   a colour token from docs/design-system/tokens.json:
  --           food-cooked, food-farm, food-ocean, med-arvelin, med-bellavet, med-gastrelle,
  --           med-biomend, med-calmora, treat (one per item; not mark-neutral, which is grey)
  -- day part: 1 before breakfast, 2 breakfast, 3 between breakfast and dinner, 4 dinner,
  --           5 between dinner and supper, 6 supper, 7 after supper
  -- unit:     pill | capsule | sachet | ml | drop (medication); can | tray | g | piece (food)
  -- flavours: for food, the flavours to pick from, e.g. '{<FLAVOUR>,<FLAVOUR>}'; '{}' for none
  -- position: lane order in the timeline, smallest first.
  -- A medication measured in ml with a syringe marking can show both: set conversion_unit 'bars'
  -- and conversion_size to the ml in one bar (0.1 shows 0,15 ml as "0,15 ml (1,5 bars)").
  -- Delete the rows you do not need; add more with the same shape.
  insert into public.item (dog_id, kind, name, colour, default_day_part, active_from, active_to, hidden_by_default,
                           position, default_unit, flavours, conversion_unit, conversion_size)
  values
    (new_dog, 'food',       '<FOOD NAME>',       'food-cooked', 2, start_date, null, false, 10, 'tray',  '{}',                      null, null),
    (new_dog, 'food',       '<FOOD NAME>',       'food-farm',   4, start_date, null, false, 20, 'can',   '{<FLAVOUR>,<FLAVOUR>}',   null, null),
    (new_dog, 'medication', '<MEDICATION NAME>', 'med-arvelin', 2, start_date, null, false, 30, 'pill',  '{}',                      null, null),
    (new_dog, 'treat',      '<TREAT NAME>',      'treat',       6, start_date, null, true,  90, 'piece', '{}',                      null, null);

  if exists (select 1 from public.item where dog_id = new_dog and (name like '<%' or array_to_string(flavours, ',') like '%<%')) then
    raise exception 'Fill in or delete the placeholder item rows before running this script.';
  end if;

  -- The usual day: one schedule slot per item in its default day part, 1 of its unit, no flavour.
  -- Adjust it afterwards in the app (Menu > Usual day), or here before running, for example
  -- an item given in another part too, with its usual amount and flavour:
  --   insert into public.schedule_slot (dog_id, item_id, day_part, flavour, amount, unit, active_from)
  --   select dog_id, id, 6, '<FLAVOUR>', 0.25, 'can', active_from from public.item where dog_id = new_dog and name = '<NAME>';
  insert into public.schedule_slot (dog_id, item_id, day_part, flavour, amount, unit, active_from, active_to, position)
  select dog_id, id, default_day_part, '', 1, default_unit, active_from, active_to, position
  from public.item where dog_id = new_dog;

  -- Usual times of the day parts. Without rows the app uses 07:00, 07:30, 12:00, 15:00, 18:00,
  -- 20:00 and 22:00; they can be changed in the app (Menu > Day parts). To set them here:
  --   insert into public.day_part (dog_id, part, usual_time) values (new_dog, 2, '<HH:MM>');

  raise notice 'Created household %, dog %, % members, % items, % schedule slots.',
    new_household, new_dog, added, (select count(*) from public.item where dog_id = new_dog),
    (select count(*) from public.schedule_slot where dog_id = new_dog);
end
$$;
