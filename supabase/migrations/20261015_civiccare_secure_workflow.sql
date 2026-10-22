-- AI CivicCare — reviewed additive migration
-- Apply manually in the Supabase SQL editor after reading this file.
-- This script does NOT delete complaint rows, profile rows, or auth users.
-- It does replace RPC function bodies and recreates RLS policies so
-- citizen data is isolated at the database layer.
--
-- Existing compatible objects (do not drop tables):
--   public.profiles
--   public.complaints
--   public.complaint_reports
--   public.complaint_evidence
--   submit_complaint(p_category, p_description, p_latitude, p_location, p_longitude)
--   process_complaint(p_complaint_id, p_new_status, p_note)
--   confirm_existing_issue(p_complaint_id)
--   review_resolution(p_approved, p_complaint_id, p_note)
--
-- After applying, promote authorities only from the SQL editor:
--   update public.profiles set role = 'authority', department = null where id = '<auth user uuid>';
-- Signup metadata cannot grant the authority role.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Additive columns (safe if they already exist)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists department text;

alter table public.complaints
  add column if not exists sla text;

alter table public.complaint_evidence
  add column if not exists storage_path text;

alter table public.complaint_evidence
  add column if not exists uploaded_by uuid references auth.users (id);

delete from public.complaint_reports a
using public.complaint_reports b
where a.ctid < b.ctid
  and a.complaint_id = b.complaint_id
  and a.user_id = b.user_id;

create unique index if not exists complaint_reports_unique_user
  on public.complaint_reports (complaint_id, user_id);

create index if not exists complaints_created_by_idx
  on public.complaints (created_by);

create index if not exists complaints_status_idx
  on public.complaints (status);

create index if not exists complaints_department_idx
  on public.complaints (department);

-- ---------------------------------------------------------------------------
-- Row Level Security stays enabled. Never disable it for this project.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_reports enable row level security;
alter table public.complaint_evidence enable row level security;

revoke all on table public.profiles from anon, public;
revoke all on table public.complaints from anon, public;
revoke all on table public.complaint_reports from anon, public;
revoke all on table public.complaint_evidence from anon, public;

grant select, update on table public.profiles to authenticated;
grant select on table public.complaints to authenticated;
grant select on table public.complaint_reports to authenticated;
grant select on table public.complaint_evidence to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, locked search_path, auth.uid() checks)
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_profile_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role(), '') = 'authority'
$$;

create or replace function public.can_view_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.complaints c
      where c.id = p_complaint_id
        and (
          c.created_by = auth.uid()
          or exists (
            select 1
            from public.complaint_reports r
            where r.complaint_id = c.id
              and r.user_id = auth.uid()
          )
          or (
            public.is_authority()
            and (
              public.current_profile_department() is null
              or public.current_profile_department() = c.department
            )
          )
        )
    )
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Role cannot be changed from the client';
  end if;

  if tg_op = 'INSERT'
     and coalesce(new.role, 'citizen') <> 'citizen'
     and auth.uid() is not null
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'New accounts must start as citizens';
  end if;

  if new.role is null then
    new.role := 'citizen';
  end if;

  if new.role not in ('citizen', 'authority') then
    raise exception 'Invalid role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'citizen'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recreate RLS policies. Existing row data is kept.
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'complaints',
        'complaint_reports',
        'complaint_evidence'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      pol.policyname,
      pol.tablename
    );
  end loop;
end;
$$;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own_safe
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
-- Role changes are blocked by protect_profile_role, not by a recursive RLS subquery.

create policy complaints_select_scoped
on public.complaints
for select
to authenticated
using (public.can_view_complaint(id));

create policy reports_select_scoped
on public.complaint_reports
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_view_complaint(complaint_id)
);

create policy evidence_select_scoped
on public.complaint_evidence
for select
to authenticated
using (public.can_view_complaint(complaint_id));

-- No direct inserts/updates/deletes on complaints, reports, or evidence.
-- All writes go through SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- RPC: submit_complaint (existing signature)
-- ---------------------------------------------------------------------------

drop function if exists public.submit_complaint(text, text, double precision, text, double precision);

create function public.submit_complaint(
  p_category text,
  p_description text,
  p_latitude double precision,
  p_location text,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_category text := nullif(trim(p_category), '');
  v_location text := nullif(trim(p_location), '');
  v_description text := nullif(trim(p_description), '');
  v_department text;
  v_severity text := 'Medium';
  v_priority integer := 60;
  v_sla text := '4 days';
  v_text text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_category is null or v_location is null then
    raise exception 'Category and location are required';
  end if;

  if v_description is null then
    v_description := v_category || ' issue reported at ' || v_location || '.';
  end if;

  v_department := case v_category
    when 'Pothole' then 'Roads & Public Works'
    when 'Garbage' then 'Sanitation Department'
    when 'Water Leak' then 'Water & Utilities'
    when 'Street Light' then 'Electrical Department'
    when 'Drainage' then 'Drainage & Municipal Works'
    when 'Fallen Tree' then 'Horticulture Department'
    else 'Municipal Helpdesk'
  end;

  v_text := lower(v_category || ' ' || v_description);

  if v_text ~ 'fire|electric shock|live wire|collapsed|life threatening|emergency' then
    v_severity := 'Critical';
    v_priority := 90;
    v_sla := '24 hours';
  elsif v_text ~ 'dangerous|accident|injury|school|hospital|flood|major|huge|blocked|busy road' then
    v_severity := 'High';
    v_priority := 75;
    v_sla := '48 hours';
  elsif v_text ~ 'small|minor|slightly|tiny' then
    v_severity := 'Low';
    v_priority := 48;
    v_sla := '7 days';
  end if;

  if v_text ~ 'school|hospital|busy road|traffic|many people|accident|dangerous|emergency' then
    v_priority := least(v_priority + 10, 100);
  end if;

  insert into public.complaints (
    created_by,
    category,
    description,
    location,
    latitude,
    longitude,
    severity,
    priority,
    department,
    status,
    report_count,
    sla
  )
  values (
    v_user,
    v_category,
    v_description,
    v_location,
    p_latitude,
    p_longitude,
    v_severity,
    v_priority,
    v_department,
    'Submitted',
    1,
    v_sla
  )
  returning id into v_id;

  insert into public.complaint_reports (complaint_id, user_id)
  values (v_id, v_user)
  on conflict (complaint_id, user_id) do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: confirm_existing_issue
-- ---------------------------------------------------------------------------

drop function if exists public.confirm_existing_issue(uuid);

create function public.confirm_existing_issue(p_complaint_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status
  from public.complaints
  where id = p_complaint_id;

  if v_status is null then
    raise exception 'Complaint not found';
  end if;

  if v_status in ('Resolved', 'Verified') then
    raise exception 'That complaint is no longer active';
  end if;

  insert into public.complaint_reports (complaint_id, user_id)
  values (p_complaint_id, v_user);

  update public.complaints
  set
    report_count = coalesce(report_count, 1) + 1,
    priority = least(coalesce(priority, 60) + 3, 100),
    updated_at = now()
  where id = p_complaint_id;
exception
  when unique_violation then
    raise exception 'You have already confirmed this issue';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: process_complaint (authority only, scoped by department)
-- ---------------------------------------------------------------------------

drop function if exists public.process_complaint(uuid, text, text);

create function public.process_complaint(
  p_complaint_id uuid,
  p_new_status text,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.complaints%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_authority() then
    raise exception 'Only authorities can update complaint status';
  end if;

  if p_new_status not in (
    'Submitted',
    'AI Reviewed',
    'Assigned',
    'In Progress',
    'Resolved'
  ) then
    raise exception 'Invalid status change';
  end if;

  select * into v_row
  from public.complaints
  where id = p_complaint_id
  for update;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if public.current_profile_department() is not null
     and public.current_profile_department() is distinct from v_row.department then
    raise exception 'This complaint is outside your department scope';
  end if;

  if v_row.status = 'Verified' then
    raise exception 'Verified complaints cannot be changed';
  end if;

  update public.complaints
  set
    status = p_new_status,
    updated_at = now()
  where id = p_complaint_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: review_resolution (citizen reporter only)
-- ---------------------------------------------------------------------------

drop function if exists public.review_resolution(boolean, uuid, text);

create function public.review_resolution(
  p_approved boolean,
  p_complaint_id uuid,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.complaints%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.complaints
  where id = p_complaint_id
  for update;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if not exists (
    select 1
    from public.complaint_reports
    where complaint_id = p_complaint_id
      and user_id = v_user
  ) and v_row.created_by <> v_user then
    raise exception 'Only a reporting citizen can verify this resolution';
  end if;

  if v_row.status <> 'Resolved' then
    raise exception 'Only resolved complaints can be verified';
  end if;

  update public.complaints
  set
    status = case when p_approved then 'Verified' else 'In Progress' end,
    updated_at = now()
  where id = p_complaint_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: register_evidence (new; required for persisted photos)
-- ---------------------------------------------------------------------------

drop function if exists public.register_evidence(uuid, text, text);

create function public.register_evidence(
  p_complaint_id uuid,
  p_evidence_type text,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.complaints%rowtype;
  v_id uuid;
  v_type text := lower(trim(p_evidence_type));
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_type not in ('original', 'before', 'resolution', 'after') then
    raise exception 'Invalid evidence type';
  end if;

  if v_type = 'before' then
    v_type := 'original';
  end if;

  if v_type = 'after' then
    v_type := 'resolution';
  end if;

  if p_storage_path is null or position(v_user::text in p_storage_path) <> 1 then
    raise exception 'Evidence path must be uploaded by the signed-in user';
  end if;

  select * into v_row
  from public.complaints
  where id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;

  if v_type = 'original' then
    if v_row.created_by <> v_user
       and not exists (
         select 1 from public.complaint_reports
         where complaint_id = p_complaint_id and user_id = v_user
       ) then
      raise exception 'You cannot attach original evidence to this complaint';
    end if;
  elsif not public.is_authority() then
    raise exception 'Only authorities can upload resolution photos';
  elsif public.current_profile_department() is not null
        and public.current_profile_department() is distinct from v_row.department then
    raise exception 'This complaint is outside your department scope';
  end if;

  insert into public.complaint_evidence (
    complaint_id,
    evidence_type,
    storage_path,
    uploaded_by
  )
  values (p_complaint_id, v_type, p_storage_path, v_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Duplicate search for the report flow (no reporter identity)
-- ---------------------------------------------------------------------------

drop function if exists public.find_similar_complaints(text, double precision, double precision, text);

create function public.find_similar_complaints(
  p_category text,
  p_latitude double precision,
  p_longitude double precision,
  p_location text
)
returns table (
  id uuid,
  category text,
  description text,
  location text,
  latitude double precision,
  longitude double precision,
  severity text,
  priority integer,
  department text,
  status text,
  report_count integer,
  sla text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.category,
    c.description,
    c.location,
    c.latitude,
    c.longitude,
    c.severity,
    c.priority,
    c.department,
    c.status,
    c.report_count,
    c.sla,
    c.created_at
  from public.complaints c
  where auth.uid() is not null
    and c.category = p_category
    and c.status not in ('Resolved', 'Verified')
    and (
      (
        p_latitude is not null
        and p_longitude is not null
        and c.latitude is not null
        and c.longitude is not null
        and (
          6371000 * 2 * asin(sqrt(
            power(sin(radians(c.latitude - p_latitude) / 2), 2) +
            cos(radians(p_latitude)) * cos(radians(c.latitude)) *
            power(sin(radians(c.longitude - p_longitude) / 2), 2)
          ))
        ) <= 150
      )
      or lower(trim(c.location)) = lower(trim(coalesce(p_location, '')))
    )
  order by c.created_at desc
  limit 20
$$;

-- Hotspots: coordinates and category only. No names, emails, or user ids.
drop function if exists public.get_civic_hotspots();

create function public.get_civic_hotspots()
returns table (
  category text,
  status text,
  priority integer,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.category,
    c.status,
    c.priority,
    c.latitude,
    c.longitude
  from public.complaints c
  where auth.uid() is not null
    and c.latitude is not null
    and c.longitude is not null
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: authenticated only. Never grant to anon.
-- ---------------------------------------------------------------------------

revoke all on function public.submit_complaint(text, text, double precision, text, double precision) from public, anon;
revoke all on function public.confirm_existing_issue(uuid) from public, anon;
revoke all on function public.process_complaint(uuid, text, text) from public, anon;
revoke all on function public.review_resolution(boolean, uuid, text) from public, anon;
revoke all on function public.register_evidence(uuid, text, text) from public, anon;
revoke all on function public.find_similar_complaints(text, double precision, double precision, text) from public, anon;
revoke all on function public.get_civic_hotspots() from public, anon;
revoke all on function public.can_view_complaint(uuid) from public, anon;

grant execute on function public.submit_complaint(text, text, double precision, text, double precision) to authenticated;
grant execute on function public.confirm_existing_issue(uuid) to authenticated;
grant execute on function public.process_complaint(uuid, text, text) to authenticated;
grant execute on function public.review_resolution(boolean, uuid, text) to authenticated;
grant execute on function public.register_evidence(uuid, text, text) to authenticated;
grant execute on function public.find_similar_complaints(text, double precision, double precision, text) to authenticated;
grant execute on function public.get_civic_hotspots() to authenticated;
grant execute on function public.can_view_complaint(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket and policies
-- Path convention: {auth.uid()}/{complaint_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-evidence',
  'complaint-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidence_insert_own_prefix on storage.objects;
drop policy if exists evidence_select_if_can_view on storage.objects;
drop policy if exists evidence_update_own_prefix on storage.objects;
drop policy if exists evidence_delete_none on storage.objects;

create policy evidence_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'complaint-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy evidence_select_if_can_view
on storage.objects
for select
to authenticated
using (
  bucket_id = 'complaint-evidence'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or (
      split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
      and public.can_view_complaint(split_part(name, '/', 2)::uuid)
    )
  )
);

commit;
