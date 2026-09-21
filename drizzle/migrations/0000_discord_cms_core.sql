-- Roles
create type public.app_role as enum ('super_admin','admin','approver','user');
create type public.post_status as enum ('draft','pending','changes_requested','rejected','approved','scheduled','published','failed','cancelled');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,'member'),'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'Workspace',
  plan text not null default 'Free',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select, insert, update, delete on public.org_members to authenticated;
grant all on public.org_members to service_role;
alter table public.org_members enable row level security;

-- Helpers
create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members m where m.org_id = _org and m.user_id = _user);
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org and m.user_id = _user and m.role = any(_roles)
  );
$$;

-- Servers
create table public.servers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  guild_id text,
  icon_url text,
  bot_name text,
  bot_avatar_url text,
  bot_id text,
  connected boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.servers to authenticated;
grant all on public.servers to service_role;
alter table public.servers enable row level security;

create table public.server_secrets (
  server_id uuid primary key references public.servers(id) on delete cascade,
  bot_token text not null,
  updated_at timestamptz not null default now()
);
grant all on public.server_secrets to service_role;
alter table public.server_secrets enable row level security;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  discord_id text not null,
  name text not null,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  unique (server_id, discord_id)
);
grant select, insert, update, delete on public.channels to authenticated;
grant all on public.channels to service_role;
alter table public.channels enable row level security;

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  server_id uuid references public.servers(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  title text not null default 'Untitled post',
  content text not null default '',
  use_embed boolean not null default true,
  embed jsonb not null default '{}'::jsonb,
  buttons jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  timezone text not null default 'UTC',
  revision int not null default 1,
  discord_message_id text,
  failure_reason text,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_org_status_idx on public.posts (org_id, status);
create index posts_due_idx on public.posts (status, scheduled_at);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;

create table public.post_audit (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.post_audit to authenticated;
grant all on public.post_audit to service_role;
alter table public.post_audit enable row level security;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text default '',
  category text default 'General',
  content text not null default '',
  use_embed boolean not null default true,
  embed jsonb not null default '{}'::jsonb,
  buttons jsonb not null default '[]'::jsonb,
  uses int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.templates to authenticated;
grant all on public.templates to service_role;
alter table public.templates enable row level security;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null,
  kind text not null default 'image',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.media_assets to authenticated;
grant all on public.media_assets to service_role;
alter table public.media_assets enable row level security;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  token text not null unique default encode(gen_random_bytes(16),'hex'),
  created_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;

-- Policies
create policy "profiles self read" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "orgs member read" on public.organizations for select to authenticated
  using (public.is_org_member(id, auth.uid()));
create policy "orgs insert own" on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy "orgs admin update" on public.organizations for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "orgs owner delete" on public.organizations for delete to authenticated
  using (public.has_org_role(id, auth.uid(), array['super_admin']::public.app_role[]));

create policy "members read" on public.org_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id, auth.uid()));
create policy "members insert self or admin" on public.org_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[])
  );
create policy "members admin update" on public.org_members for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "members admin delete" on public.org_members for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));

create policy "servers read" on public.servers for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "servers admin write" on public.servers for insert to authenticated
  with check (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "servers admin update" on public.servers for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "servers admin delete" on public.servers for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));

create policy "channels read" on public.channels for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "channels admin insert" on public.channels for insert to authenticated
  with check (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "channels admin update" on public.channels for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "channels admin delete" on public.channels for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));

create policy "posts read" on public.posts for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "posts insert member" on public.posts for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid()) and created_by = auth.uid());
create policy "posts update" on public.posts for update to authenticated
  using (
    created_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['super_admin','admin','approver']::public.app_role[])
  );
create policy "posts delete" on public.posts for delete to authenticated
  using (
    created_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[])
  );

create policy "audit read" on public.post_audit for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "audit insert" on public.post_audit for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid()));

create policy "templates read" on public.templates for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "templates write" on public.templates for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid()));
create policy "templates update" on public.templates for update to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "templates delete" on public.templates for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]) or created_by = auth.uid());

create policy "media read" on public.media_assets for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "media write" on public.media_assets for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid()));
create policy "media update" on public.media_assets for update to authenticated
  using (public.is_org_member(org_id, auth.uid()));
create policy "media delete" on public.media_assets for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]) or created_by = auth.uid());

create policy "invites read" on public.invites for select to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "invites admin insert" on public.invites for insert to authenticated
  with check (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "invites admin update" on public.invites for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
create policy "invites admin delete" on public.invites for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['super_admin','admin']::public.app_role[]));
