-- Pinned notes (JCB-5), after the approved design in design/proposals/pinned-tracked/.
-- Standing facts both household members should always know (allergies, how to give a medication,
-- the vet's standing advice). Not tied to a day; ordered by hand with `position`.
-- Replaces the draft pinned_note (dog, text, created_by) mentioned in core_schema.

create table public.pinned_note (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  -- Optional: the empty string means no title.
  title text not null default '',
  body text not null check (btrim(body) <> ''),
  -- List order, smallest first. A new note takes (smallest - 1), so it goes on top; ties fall back to created_at.
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pinned_note_dog_idx on public.pinned_note (dog_id, position);

-- Same stamping as stamp_row(), except that moving a note (only `position` changes) does not count
-- as an edit: "Edited 14 Oct" and updated_by follow the title and text only.
create function public.stamp_pinned_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_by := auth.uid();
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.title is distinct from old.title or new.body is distinct from old.body then
      new.updated_by := auth.uid();
      new.updated_at := now();
    else
      new.updated_by := old.updated_by;
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_pinned_note() from public, anon, authenticated;

create trigger pinned_note_stamp before insert or update on public.pinned_note
  for each row execute function public.stamp_pinned_note();

alter table public.pinned_note enable row level security;
revoke all on public.pinned_note from anon, authenticated;
grant select, insert, update, delete on public.pinned_note to authenticated;

-- Both household members read and write every note of their dog.
create policy pinned_note_select on public.pinned_note for select to authenticated
  using (private.can_access_dog(dog_id));
create policy pinned_note_insert on public.pinned_note for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy pinned_note_update on public.pinned_note for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy pinned_note_delete on public.pinned_note for delete to authenticated
  using (private.can_access_dog(dog_id));
