-- Add foreign key relationships so PostgREST can join members -> user_profiles
-- (required for selects like `user_profiles!inner(...)`).

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organisation_members_user_id_fkey'
  ) then
    alter table public.organisation_members
      add constraint organisation_members_user_id_fkey
      foreign key (user_id)
      references public.user_profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'channel_members_user_id_fkey'
  ) then
    alter table public.channel_members
      add constraint channel_members_user_id_fkey
      foreign key (user_id)
      references public.user_profiles(id)
      on delete cascade;
  end if;
end $$;
