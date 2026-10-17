-- Photos on events and tracked conditions (JCB-7). Earlier migrations are applied in production and
-- stay untouched. PDFs come later (attachment.kind will then allow 'pdf').
--
-- A photo is an `attachment` row on an event plus two JPEG objects in the private `photos` bucket:
--   <dog_id>/<attachment_id>.jpg        the photo, resized on the phone (long edge about 1600 px)
--   <dog_id>/<attachment_id>.thumb.jpg  a small copy for strips and lists
-- A standalone photo is an event of type 'photo' with one attachment; a vet visit, symptom or note
-- can carry photos too. A condition's photos are the attachments of the events linked to it.
-- The path starts with the dog, so storage policies can check the household the same way the
-- tables do (private.can_access_dog). Nothing is ever public: the app reads through short-lived
-- signed URLs.

-- 1. attachment
create table public.attachment (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dog (id) on delete cascade,
  event_id uuid not null,
  kind text not null default 'photo' check (kind in ('photo')),
  -- Always <dog_id>/<id>.jpg (checked below), so the row and its storage object agree on the dog.
  storage_path text not null unique,
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  -- When the picture was taken, from the photo itself (wall-clock time, no zone); null when it had none.
  taken_at timestamp,
  -- Description of a photo attached to another event; a standalone photo uses its event's detail.
  caption text not null default '' check (char_length(caption) <= 500),
  -- Order within the event.
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deleting the event deletes its attachment rows; the files are removed by the app afterwards.
  foreign key (event_id, dog_id) references public.event (id, dog_id) on delete cascade,
  constraint attachment_path_check check (storage_path = dog_id::text || '/' || id::text || '.jpg')
);
create index attachment_event_idx on public.attachment (event_id, position);
create index attachment_dog_idx on public.attachment (dog_id);

create trigger attachment_stamp before insert or update on public.attachment
  for each row execute function public.stamp_row();

alter table public.attachment enable row level security;
revoke all on public.attachment from anon, authenticated;
grant select, insert, update, delete on public.attachment to authenticated;

create policy attachment_select on public.attachment for select to authenticated
  using (private.can_access_dog(dog_id));
create policy attachment_insert on public.attachment for insert to authenticated
  with check (private.can_access_dog(dog_id));
create policy attachment_update on public.attachment for update to authenticated
  using (private.can_access_dog(dog_id))
  with check (private.can_access_dog(dog_id));
create policy attachment_delete on public.attachment for delete to authenticated
  using (private.can_access_dog(dog_id));

-- 2. The private bucket: JPEG only, at most 5 MB a file (a resized photo is well under 1 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Object names. Only <uuid>/<uuid>.jpg and <uuid>/<uuid>.thumb.jpg (lowercase) are accepted;
--    anything else gets null, which no policy lets through.
create function private.photo_object_dog(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.thumb)?\.jpg$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

create function private.photo_object_attachment(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when private.photo_object_dog(object_name) is not null
    then split_part(split_part(object_name, '/', 2), '.', 1)::uuid
  end;
$$;

revoke all on function private.photo_object_dog(text) from public;
revoke all on function private.photo_object_attachment(text) from public;
grant execute on function private.photo_object_dog(text) to authenticated;
grant execute on function private.photo_object_attachment(text) to authenticated;

-- 4. storage.objects policies (RLS is on there already). Household members read, upload and
--    replace (upsert) the photos of their dog. A file can be deleted only once its attachment row is
--    gone (after the Undo window), so a delete can never break a photo that is still shown.
create policy pawlog_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.can_access_dog(private.photo_object_dog(name)));
create policy pawlog_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.can_access_dog(private.photo_object_dog(name)));
create policy pawlog_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and private.can_access_dog(private.photo_object_dog(name)))
  with check (bucket_id = 'photos' and private.can_access_dog(private.photo_object_dog(name)));
create policy pawlog_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and private.can_access_dog(private.photo_object_dog(name))
    and not exists (select 1 from public.attachment a where a.id = private.photo_object_attachment(name))
  );
