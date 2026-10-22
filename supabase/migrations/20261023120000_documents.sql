-- PDF documents on events and tracked conditions (JCB-76). Earlier migrations are applied in
-- production and stay untouched; this one only extends them.
--
-- A document is an `attachment` row of kind 'pdf' on an event plus one object in the private
-- `documents` bucket:
--   <dog_id>/<attachment_id>.pdf
-- It has a name (shown without ".pdf"), its size in bytes and, when it was cheap to read on the
-- phone, a page count. A vet visit can carry PDFs; so can a note, which is what "Add document" on a
-- tracked condition saves (linked to the condition). A condition's documents are the PDFs of the
-- events linked to it, exactly as with photos. Nothing is ever public: the app reads through
-- short-lived signed URLs.

-- 1. attachment: room for PDFs
alter table public.attachment drop constraint attachment_kind_check;
alter table public.attachment add constraint attachment_kind_check check (kind in ('photo', 'pdf'));

-- A PDF has no picture size.
alter table public.attachment alter column width drop not null;
alter table public.attachment alter column height drop not null;

alter table public.attachment add column name text check (name is null or char_length(name) between 1 and 120);
alter table public.attachment add column size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760);
alter table public.attachment add column page_count integer check (page_count is null or page_count between 1 and 100000);

-- Each kind has the columns it needs and none of the other's.
alter table public.attachment add constraint attachment_kind_columns_check check (
  (kind = 'photo' and width is not null and height is not null and name is null and size_bytes is null and page_count is null)
  or (kind = 'pdf' and name is not null and size_bytes is not null and width is null and height is null and taken_at is null)
);

-- The path follows the kind: <dog_id>/<id>.jpg for a photo, <dog_id>/<id>.pdf for a document.
alter table public.attachment drop constraint attachment_path_check;
alter table public.attachment add constraint attachment_path_check check (
  storage_path = dog_id::text || '/' || id::text || case kind when 'pdf' then '.pdf' else '.jpg' end
);

-- At most 5 documents on one event (the app checks too; this keeps a second device or a bug honest).
create function private.attachment_pdf_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'pdf'
     and (select count(*) from public.attachment a where a.event_id = new.event_id and a.kind = 'pdf' and a.id <> new.id) >= 5 then
    raise exception 'an event can have at most 5 documents' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.attachment_pdf_limit() from public;

create trigger attachment_pdf_limit before insert or update of event_id, kind on public.attachment
  for each row execute function private.attachment_pdf_limit();

-- 2. The private bucket: PDF only, at most 10 MB a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Object names. Only <uuid>/<uuid>.pdf (lowercase) is accepted; anything else gets null, which
--    no policy lets through.
create function private.document_object_dog(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

create function private.document_object_attachment(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when private.document_object_dog(object_name) is not null
    then split_part(split_part(object_name, '/', 2), '.', 1)::uuid
  end;
$$;

revoke all on function private.document_object_dog(text) from public;
revoke all on function private.document_object_attachment(text) from public;
grant execute on function private.document_object_dog(text) to authenticated;
grant execute on function private.document_object_attachment(text) to authenticated;

-- 4. storage.objects policies, as for photos: household members read, upload and replace (upsert)
--    the documents of their dog. A file can be deleted only once its attachment row is gone (after
--    the Undo window), so a delete can never break a document that is still shown. `objects.name` is
--    qualified because attachment has a `name` column too.
create policy pawlog_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.can_access_dog(private.document_object_dog(name)));
create policy pawlog_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.can_access_dog(private.document_object_dog(name)));
create policy pawlog_documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and private.can_access_dog(private.document_object_dog(name)))
  with check (bucket_id = 'documents' and private.can_access_dog(private.document_object_dog(name)));
create policy pawlog_documents_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and private.can_access_dog(private.document_object_dog(name))
    and not exists (select 1 from public.attachment a where a.id = private.document_object_attachment(objects.name))
  );
