-- Undo of a pinned note edit or delete puts the note back exactly as it was, including who edited
-- it last and when ("Edited 14 Oct"). The stamp trigger would otherwise date a restore today.
--
-- restore_pinned_note() is the only way to write those stamps: it runs the write with a
-- transaction-local flag that makes stamp_pinned_note() keep the supplied updated_by / updated_at.
-- Plain table writes cannot set the flag, so the client still cannot forge a stamp that way.

create or replace function public.stamp_pinned_note()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  restoring boolean := coalesce(current_setting('pawlog.restore_pinned', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not restoring then
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
      new.updated_at := now();
    end if;
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if restoring then
      null; -- keep the updated_by / updated_at supplied by restore_pinned_note()
    elsif new.title is distinct from old.title or new.body is distinct from old.body then
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

-- Insert or update a note with the given stamps (undo of an edit or a delete).
-- security definer, so it checks access itself; both people must belong to the dog's household and the
-- time cannot be in the future.
create function public.restore_pinned_note(
  p_id uuid,
  p_dog_id uuid,
  p_title text,
  p_body text,
  p_position integer,
  p_created_by uuid,
  p_updated_by uuid,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not private.can_access_dog(p_dog_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_updated_at > now() then
    raise exception 'updated_at is in the future' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(array[p_created_by, p_updated_by]) as u(id)
    where u.id is not null and not exists (
      select 1 from public.dog d join public.member m on m.household_id = d.household_id
      where d.id = p_dog_id and m.user_id = u.id
    )
  ) then
    raise exception 'unknown household member' using errcode = '22023';
  end if;
  perform set_config('pawlog.restore_pinned', 'on', true);
  insert into public.pinned_note (id, dog_id, title, body, position, created_by, updated_by, updated_at)
  values (p_id, p_dog_id, p_title, p_body, p_position, p_created_by, p_updated_by, p_updated_at)
  on conflict (id) do update
    set title = excluded.title, body = excluded.body, position = excluded.position,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at
    where public.pinned_note.dog_id = excluded.dog_id;
  get diagnostics n = row_count;
  perform set_config('pawlog.restore_pinned', 'off', true);
  if n = 0 then
    raise exception 'note belongs to another dog' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.restore_pinned_note(uuid, uuid, text, text, integer, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.restore_pinned_note(uuid, uuid, text, text, integer, uuid, uuid, timestamptz) to authenticated;
