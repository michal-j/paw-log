-- Item colours (JCB-59). Data only; earlier migrations are applied in production and stay untouched.
--
-- Items created before JCB-43 (bootstrap rows, or "Other" in the entry form) could have the colour
-- `mark-neutral` (grey), and nothing gave them an item colour afterwards. Every item whose colour is
-- not an item colour token gets one, per dog, in lane order (position, then created_at, then id):
-- each takes the item colour token used by the fewest of that dog's items so far, earliest in
-- tokens.json order on a tie, so items stay distinct while unused tokens last (the same rule as
-- `withItemColours` / `nextColour` in src/log/items.ts, which the app also applies on load).
--
-- Idempotent: items that already have an item colour token are never changed, so running it again
-- changes nothing. The palette must match ITEM_COLOURS (tests/migrations.test.ts checks it).
do $$
declare
  palette constant text[] := array[
    'food-cooked', 'food-farm', 'food-ocean',
    'med-arvelin', 'med-bellavet', 'med-gastrelle', 'med-biomend', 'med-calmora',
    'treat'
  ];
  r record;
  pick text;
begin
  for r in
    select i.id, i.dog_id
    from public.item i
    where not (i.colour = any (palette))
    order by i.dog_id, i.position, i.created_at, i.id
  loop
    select p.token into pick
    from unnest(palette) with ordinality as p(token, ord)
    left join public.item u on u.dog_id = r.dog_id and u.colour = p.token
    group by p.token, p.ord
    order by count(u.id), p.ord
    limit 1;

    update public.item set colour = pick where id = r.id;
  end loop;
end
$$;
