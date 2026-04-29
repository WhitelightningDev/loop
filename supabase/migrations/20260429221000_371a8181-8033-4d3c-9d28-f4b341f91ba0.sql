-- Minimal `todos` table for dev smoke-testing Supabase connectivity.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'todos'
      and policyname = 'todos: read'
  ) then
    create policy "todos: read"
      on public.todos for select
      to anon, authenticated
      using (true);
  end if;
end $$;

