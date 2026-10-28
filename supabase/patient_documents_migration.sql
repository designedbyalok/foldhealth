-- Documents for the patient app (W7 in docs/features/patient-app-workflows.md).
-- Requires program_documents_category_migration.sql, private_phi_buckets_migration.sql,
-- patient_accounts_migration.sql and staff_patient_portal_access_migration.sql.
--
-- Documents stay in program_documents, the table the staff Documents tab
-- reads. A patient sees a document only when:
--   • staff shared it (shared_with_patient, set from the staff Documents tab), or
--   • the patient uploaded it (uploaded_by_patient; staff see it straight away)
-- Files stay in the private `program-documents` bucket. Patient uploads go
-- under patient-uploads/<member_id>/; a patient may read only the files of
-- documents they can see, and may write only into their own folder.

begin;

alter table public.program_documents
  add column if not exists shared_with_patient boolean not null default false,
  add column if not exists uploaded_by_patient boolean not null default false,
  add column if not exists shared_by text,
  add column if not exists shared_at timestamptz;

insert into storage.buckets (id, name, public)
values ('program-documents', 'program-documents', false)
on conflict (id) do nothing;

-- program_documents.patient_id holds a member id or an all_patients row id
-- ("hcc-32"); this resolves either to the member id.
create or replace function public._document_member(p_patient_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.member_id from public.all_patients a where a.id::text = p_patient_id and a.member_id is not null limit 1),
    p_patient_id);
$$;
revoke execute on function public._document_member(text) from public, anon;
grant execute on function public._document_member(text) to authenticated;

-- May the caller read this storage object as a patient?
create or replace function public.patient_can_read_document_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'program-documents' and exists (
    select 1 from public.program_documents d
     where d.storage_path = p_name
       and (d.shared_with_patient or d.uploaded_by_patient)
       and public.patient_can_access(public._document_member(d.patient_id)));
$$;
revoke execute on function public.patient_can_read_document_object(text, text) from public, anon;
grant execute on function public.patient_can_read_document_object(text, text) to authenticated;

-- May the caller upload this storage object as a patient? Only into
-- patient-uploads/<member_id>/ for a profile they can act for.
create or replace function public.patient_can_upload_document_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'program-documents'
     and split_part(p_name, '/', 1) = 'patient-uploads'
     and split_part(p_name, '/', 3) <> ''
     and public.patient_can_access(split_part(p_name, '/', 2));
$$;
revoke execute on function public.patient_can_upload_document_object(text, text) from public, anon;
grant execute on function public.patient_can_upload_document_object(text, text) to authenticated;

-- The storage gate, split by command so patients get read and upload only:
-- staff keep full access, and update and delete stay staff-only.
drop policy if exists staff_only on storage.objects;
drop policy if exists staff_only_select on storage.objects;
drop policy if exists staff_only_insert on storage.objects;
drop policy if exists staff_only_update on storage.objects;
drop policy if exists staff_only_delete on storage.objects;
create policy staff_only_select on storage.objects as restrictive for select to authenticated
  using ((select public.is_staff()) or public.patient_can_read_document_object(bucket_id, name));
create policy staff_only_insert on storage.objects as restrictive for insert to authenticated
  with check ((select public.is_staff()) or public.patient_can_upload_document_object(bucket_id, name));
create policy staff_only_update on storage.objects as restrictive for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_only_delete on storage.objects as restrictive for delete to authenticated
  using ((select public.is_staff()));

drop policy if exists "patient documents read" on storage.objects;
create policy "patient documents read" on storage.objects for select to authenticated
  using (public.patient_can_read_document_object(bucket_id, name));
drop policy if exists "patient documents upload" on storage.objects;
create policy "patient documents upload" on storage.objects for insert to authenticated
  with check (public.patient_can_upload_document_object(bucket_id, name));

-- A profile's documents, newest first.
create or replace function public.patient_documents(p_member_id text)
returns table (id text, name text, category text, ext text, size_bytes bigint, source text,
               updated_at timestamptz, storage_path text, file_url text, uploaded_by_patient boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select d.id, d.name,
           coalesce(d.category, case d.type
             when 'Imaging' then 'imaging' when 'Lab Report' then 'lab' when 'Lab Result' then 'lab'
             when 'Physical Therapy' then 'physical_therapy' when 'Assessment' then 'health_assessment'
             when 'Referral' then 'referral' when 'Authorization' then 'referral'
             when 'Report' then 'report' when 'Discharge Summary' then 'report' when 'Consult Note' then 'report'
             when 'Form' then 'form' when 'Consent' then 'form'
             when 'ID Card' then 'personal_id' when 'Insurance Card' then 'personal_id'
             else 'other' end),
           d.ext, d.size_bytes,
           case when d.uploaded_by_patient then 'Uploaded by ' || coalesce(d.updated_by, 'you')
                else 'Shared by ' || coalesce(d.shared_by, d.updated_by, 'your care team') end,
           coalesce(d.shared_at, d.created_at),
           d.storage_path,
           -- Only same-site sample files; real files are signed from storage_path.
           case when d.file_url like '/%' then d.file_url end,
           d.uploaded_by_patient
      from public.program_documents d
     where public._document_member(d.patient_id) = p_member_id
       and (d.shared_with_patient or d.uploaded_by_patient)
     order by coalesce(d.shared_at, d.created_at) desc;
end;
$$;
revoke execute on function public.patient_documents(text) from public, anon;
grant execute on function public.patient_documents(text) to authenticated;

-- Records a file the patient just uploaded to patient-uploads/<member_id>/.
create or replace function public.patient_add_document(
  p_member_id text, p_storage_path text, p_name text, p_category text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  obj record;
  v_id text := 'pdoc-' || gen_random_uuid();
  v_name text := left(btrim(coalesce(p_name, '')), 200);
  v_ext text;
begin
  if not public.patient_can_access(p_member_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if split_part(p_storage_path, '/', 1) <> 'patient-uploads' or split_part(p_storage_path, '/', 2) <> p_member_id then
    raise exception 'Upload the file to your own folder first' using errcode = '22023';
  end if;
  select o.metadata into obj from storage.objects o
   where o.bucket_id = 'program-documents' and o.name = p_storage_path;
  if not found then
    raise exception 'The file was not uploaded' using errcode = '22023';
  end if;
  if coalesce((obj.metadata->>'size')::bigint, 0) > 10485760 then
    raise exception 'Files can be up to 10 MB' using errcode = '22023';
  end if;
  if coalesce(obj.metadata->>'mimetype', '') not in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic') then
    raise exception 'Upload a PDF, JPG, PNG or HEIC file' using errcode = '22023';
  end if;
  if exists (select 1 from public.program_documents d where d.storage_path = p_storage_path) then
    raise exception 'This file is already added' using errcode = '22023';
  end if;
  if v_name = '' then v_name := split_part(p_storage_path, '/', 3); end if;
  v_ext := lower(substring(p_storage_path from '\.([A-Za-z0-9]+)$'));
  insert into public.program_documents (id, program_code, patient_id, name, type, status, size_bytes, updated_by,
                                        updated_date, storage_path, ext, category, uploaded_by_patient)
  values (v_id, null, p_member_id, v_name, 'Other', 'Uploaded', (obj.metadata->>'size')::bigint,
          public._patient_sender_name(p_member_id), to_char(current_date, 'MM/DD/YYYY'), p_storage_path, v_ext,
          case when p_category in ('imaging', 'lab', 'physical_therapy', 'health_assessment', 'referral',
                                   'report', 'form', 'personal_id', 'other') then p_category else 'other' end,
          true);
  return v_id;
end;
$$;
revoke execute on function public.patient_add_document(text, text, text, text) from public, anon;
grant execute on function public.patient_add_document(text, text, text, text) to authenticated;

commit;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   drop function if exists public.patient_add_document(text, text, text, text);
--   drop function if exists public.patient_documents(text);
--   drop policy if exists "patient documents upload" on storage.objects;
--   drop policy if exists "patient documents read" on storage.objects;
--   drop policy if exists staff_only_select on storage.objects;
--   drop policy if exists staff_only_insert on storage.objects;
--   drop policy if exists staff_only_update on storage.objects;
--   drop policy if exists staff_only_delete on storage.objects;
--   create policy staff_only on storage.objects as restrictive for all to authenticated
--     using ((select public.is_staff())) with check ((select public.is_staff()));
--   drop function if exists public.patient_can_upload_document_object(text, text);
--   drop function if exists public.patient_can_read_document_object(text, text);
--   drop function if exists public._document_member(text);
--   alter table public.program_documents drop column if exists shared_at, drop column if exists shared_by,
--     drop column if exists uploaded_by_patient, drop column if exists shared_with_patient;
