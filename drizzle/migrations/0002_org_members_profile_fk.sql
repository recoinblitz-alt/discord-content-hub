alter table public.org_members
  add constraint org_members_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;