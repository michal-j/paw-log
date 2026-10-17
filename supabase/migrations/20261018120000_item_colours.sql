-- Item colours (JCB-59). Data only; earlier migrations are applied in production and stay untouched.
--
-- Items created before JCB-43 (bootstrap rows, or "Other" in the entry form) could have the colour
-- `mark-neutral` (grey), and nothing gave them an item colour afterwards. Every item whose colour is
-- not an item colour token (the palette below; anything else, such as mark-neutral or an unknown
-- name, counts as none) gets one, per dog, in lane order (position, then created_at, then id).
-- Each takes the auto colour used by the fewest of that dog's items so far; on a tie a token of its
-- own kind first (food-* for food, med-* for medication, supplement and procedure, treat for treats),
-- then palette order. med-calmora is never picked here (it reads as grey next to mark-neutral), but
-- an item that has it keeps it and it counts as used. This is the rule of `nextColour` /
-- `withItemColours` in src/log/items.ts, which the app also applies on load.
--
-- Idempotent: items that already have an item colour token are never changed, so running it again
-- changes nothing. The palette and exclusion must match ITEM_COLOURS / AUTO_EXCLUDED
-- (tests/migrations.test.ts checks both, and that the result equals the app's).
do $$
declare
  palette constant text[] := array[
    'food-cooked', 'food-farm', 'food-ocean',
    'med-arvelin', 'med-bellavet', 'med-gastrelle', 'med-biomend', 'med-calmora',
    'treat'
  ];
  auto_excluded constant text[] := array['med-calmora'];
  r record;
  pick text;
begin
  for r in
    select i.id, i.dog_id, i.kind
    from public.item i
    where not (i.colour = any (palette))
    order by i.dog_id, i.position, i.created_at, i.id
  loop
    select p.token into pick
    from unnest(palette) with ordinality as p(token, ord)
    left join public.item u on u.dog_id = r.dog_id and u.colour = p.token
    where not (p.token = any (auto_excluded))
    group by p.token, p.ord
    order by
      count(u.id),
      case
        when r.kind = 'food' and p.token like 'food-%' then 0
        when r.kind = 'treat' and p.token = 'treat' then 0
        when r.kind in ('medication', 'supplement', 'procedure') and p.token like 'med-%' then 0
        else 1
      end,
      p.ord
    limit 1;

    update public.item set colour = pick where id = r.id;
  end loop;
end
$$;
