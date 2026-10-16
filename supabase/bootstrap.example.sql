-- One-time bootstrap for the real PawLog database (JCB-35). See docs/runbooks/supabase-setup.md.
--
-- 1. Copy this text into the Supabase SQL editor (do NOT save a filled-in copy in the repo).
-- 2. Replace every <PLACEHOLDER>. Both e-mail addresses must already exist under
--    Authentication > Users (created in step 4 of the runbook).
-- 3. Run it once. It stops with an error, and changes nothing, if a placeholder is left
--    or a user is missing.
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

  insert into public.household (name) values (household_name) returning id into new_household;
  insert into public.dog (household_id, name) values (new_household, dog_name) returning id into new_dog;

  insert into public.member (household_id, user_id)
  select new_household, u.id from auth.users u where lower(u.email) = any (
    select lower(e) from unnest(member_emails) e
  );
  get diagnostics added = row_count;
  if added <> array_length(member_emails, 1) then
    raise exception 'Expected % members but found % matching users. Create the users first (runbook step 4).',
      array_length(member_emails, 1), added;
  end if;

  -- Initial items. One row per food, medication, treat, supplement or procedure.
  -- kind:     food | medication | treat | supplement | procedure
  -- colour:   a colour token from docs/design-system/tokens.json:
  --           food-cooked, food-farm, food-ocean, med-arvelin, med-bellavet, med-gastrelle,
  --           med-biomend, med-calmora, treat, mark-neutral
  -- day part: 1 before breakfast, 2 breakfast, 3 between breakfast and dinner, 4 dinner,
  --           5 between dinner and supper, 6 supper, 7 after supper
  -- position: lane order in the timeline, smallest first.
  -- Delete the rows you do not need; add more with the same shape.
  insert into public.item (dog_id, kind, name, colour, default_day_part, active_from, active_to, hidden_by_default, position)
  values
    (new_dog, 'food',       '<FOOD NAME>',       'food-cooked', 2, start_date, null, false, 10),
    (new_dog, 'food',       '<FOOD NAME>',       'food-farm',   4, start_date, null, false, 20),
    (new_dog, 'medication', '<MEDICATION NAME>', 'med-arvelin', 2, start_date, null, false, 30),
    (new_dog, 'treat',      '<TREAT NAME>',      'treat',       6, start_date, null, true,  90);

  if exists (select 1 from public.item where dog_id = new_dog and name like '<%') then
    raise exception 'Fill in or delete the placeholder item rows before running this script.';
  end if;

  -- The plan: one schedule slot per item in its default day part, dose left empty.
  -- An item given in several day parts, or with a usual dose, gets extra rows or an update here:
  --   insert into public.schedule_slot (dog_id, item_id, day_part, dose_text, active_from)
  --   select dog_id, id, 6, '<DOSE>', active_from from public.item where dog_id = new_dog and name = '<NAME>';
  insert into public.schedule_slot (dog_id, item_id, day_part, dose_text, active_from, active_to)
  select dog_id, id, default_day_part, '', active_from, active_to from public.item where dog_id = new_dog;

  raise notice 'Created household %, dog %, % members, % items, % schedule slots.',
    new_household, new_dog, added, (select count(*) from public.item where dog_id = new_dog),
    (select count(*) from public.schedule_slot where dog_id = new_dog);
end
$$;
