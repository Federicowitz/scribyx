create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_nickname_lower_idx
  on public.profiles (lower(nickname))
  where nickname is not null and nickname <> '';

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Progetto senza titolo',
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  identifier text not null,
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default now(),
  unique (project_id, identifier)
);

create index if not exists project_members_project_idx
  on public.project_members (project_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

create or replace function public.is_project_owner(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = project_id
      and project.owner_id = auth.uid()
  );
$$;

create or replace function public.can_view_project(project_id uuid, owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    owner_id = auth.uid()
    or exists (
      select 1
      from public.project_members member
      left join public.profiles profile on profile.id = auth.uid()
      where member.project_id = project_id
        and (
          lower(member.identifier) = lower(coalesce(auth.jwt() ->> 'email', ''))
          or lower(member.identifier) = lower(coalesce(profile.nickname, ''))
        )
    );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "projects_select_owner_or_viewer" on public.projects;
create policy "projects_select_owner_or_viewer"
  on public.projects for select
  to authenticated
  using (public.can_view_project(id, owner_id));

drop policy if exists "projects_insert_owner" on public.projects;
create policy "projects_insert_owner"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "projects_update_owner" on public.projects;
create policy "projects_update_owner"
  on public.projects for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "projects_delete_owner" on public.projects;
create policy "projects_delete_owner"
  on public.projects for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "project_members_select_owner" on public.project_members;
create policy "project_members_select_owner"
  on public.project_members for select
  to authenticated
  using (public.is_project_owner(project_id));

drop policy if exists "project_members_insert_owner" on public.project_members;
create policy "project_members_insert_owner"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists "project_members_delete_owner" on public.project_members;
create policy "project_members_delete_owner"
  on public.project_members for delete
  to authenticated
  using (public.is_project_owner(project_id));
