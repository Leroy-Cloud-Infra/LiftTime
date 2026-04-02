begin;

create table if not exists public.changelog (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  release_date date not null,
  changes text[] not null,
  created_at timestamptz not null default timezone('utc', now()),
  is_published boolean not null default false
);

alter table public.changelog enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'users_profile'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users_profile'
      and column_name = 'is_disabled'
  ) then
    alter table public.users_profile
      add column is_disabled boolean not null default false;
  end if;
end $$;

create or replace function public.enforce_is_disabled_admin_only()
returns trigger
language plpgsql
as $$
begin
  if new.is_disabled is distinct from old.is_disabled then
    if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
       and not exists (
        select 1
        from public.users_profile admin_profile
        where admin_profile.id = auth.uid()
          and admin_profile.is_admin = true
      ) then
      raise exception 'Only admins can change is_disabled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_is_disabled_admin_only on public.users_profile;

create trigger trg_enforce_is_disabled_admin_only
before update on public.users_profile
for each row
execute function public.enforce_is_disabled_admin_only();

drop policy if exists changelog_public_read_published on public.changelog;
drop policy if exists changelog_admin_insert on public.changelog;
drop policy if exists changelog_admin_update on public.changelog;
drop policy if exists changelog_admin_delete on public.changelog;

create policy changelog_public_read_published
on public.changelog
for select
using (
  is_published = true
  or exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

create policy changelog_admin_insert
on public.changelog
for insert
with check (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

create policy changelog_admin_update
on public.changelog
for update
using (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

create policy changelog_admin_delete
on public.changelog
for delete
using (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

alter table public.exercise_requests enable row level security;

drop policy if exists exercise_requests_user_insert_own on public.exercise_requests;
drop policy if exists exercise_requests_admin_read_all on public.exercise_requests;
drop policy if exists exercise_requests_admin_update_all on public.exercise_requests;

create policy exercise_requests_user_insert_own
on public.exercise_requests
for insert
with check (auth.uid() = user_id);

create policy exercise_requests_admin_read_all
on public.exercise_requests
for select
using (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

create policy exercise_requests_admin_update_all
on public.exercise_requests
for update
using (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users_profile
    where users_profile.id = auth.uid()
      and users_profile.is_admin = true
  )
);

commit;
