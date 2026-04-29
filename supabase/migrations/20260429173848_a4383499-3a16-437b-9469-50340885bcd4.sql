
-- 1) CALLS: allow any active participant to end the call
drop policy if exists "calls_update_initiator" on public.calls;
drop policy if exists "calls_update_participant" on public.calls;

create policy "calls_update_initiator"
  on public.calls for update to authenticated
  using (auth.uid() = initiator_id)
  with check (auth.uid() = initiator_id);

create policy "calls_update_participant"
  on public.calls for update to authenticated
  using (
    exists (select 1 from public.call_participants p
            where p.call_id = calls.id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.call_participants p
            where p.call_id = calls.id and p.user_id = auth.uid())
  );

-- 2) USER_PRESENCE: key per (user_id, org_id)
alter table public.user_presence replica identity full;

-- Drop old PK
do $$
declare pkname text;
begin
  select conname into pkname from pg_constraint
  where conrelid = 'public.user_presence'::regclass and contype = 'p';
  if pkname is not null then
    execute format('alter table public.user_presence drop constraint %I', pkname);
  end if;
end $$;

-- Deduplicate (replica identity full now allows delete)
delete from public.user_presence a
using public.user_presence b
where a.ctid < b.ctid
  and a.user_id = b.user_id
  and coalesce(a.org_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(b.org_id, '00000000-0000-0000-0000-000000000000'::uuid);

create unique index if not exists user_presence_user_org_uniq
  on public.user_presence (user_id, (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- 3) STORAGE: tighten attachments bucket reads/inserts to channel members
drop policy if exists "attachments authed read" on storage.objects;
drop policy if exists "attachments owner insert" on storage.objects;
drop policy if exists "attachments: read if channel member" on storage.objects;
drop policy if exists "attachments: owner+member insert" on storage.objects;

create policy "attachments: read if channel member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_read_channel(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

create policy "attachments: owner+member insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and owner = auth.uid()
    and public.is_channel_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
