create table if not exists public.workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  contact_name text not null default '',
  whatsapp text,
  email text not null default '',
  source_lists text[] not null default '{}',
  recruitment_status text not null default 'not_contacted'
    check (recruitment_status in ('not_contacted', 'contacted', 'no_response', 'interested', 'accepted', 'declined')),
  notes text not null default '',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruitment_history (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in ('not_contacted', 'contacted', 'no_response', 'interested', 'accepted', 'declined')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  segmentation text not null default '',
  whatsapp_link text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.groups(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (group_id, customer_id)
);

create table if not exists public.tests (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  objective text not null default '',
  hypothesis text not null default '',
  product text not null default '',
  responsible text not null default '',
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'archived')),
  started_at timestamptz,
  expected_end_at timestamptz,
  resource_url text not null default '',
  completed_at timestamptz,
  final_result text not null default '',
  learnings text not null default '',
  next_steps text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_rounds (
  id text primary key default gen_random_uuid()::text,
  test_id text not null references public.tests(id) on delete cascade,
  name text not null,
  objective text not null default '',
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  result text not null default '',
  learnings text not null default '',
  next_steps text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_assignments (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references public.test_rounds(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  version text not null default '',
  experience_name text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_notes (
  id text primary key default gen_random_uuid()::text,
  test_id text references public.tests(id) on delete cascade,
  round_id text references public.test_rounds(id) on delete cascade,
  group_assignment_id text references public.test_assignments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists recruitment_history_customer_created_idx on public.recruitment_history (customer_id, created_at desc);
create index if not exists group_members_customer_idx on public.group_members (customer_id);
create index if not exists test_rounds_test_idx on public.test_rounds (test_id);
create index if not exists test_assignments_round_idx on public.test_assignments (round_id);
create index if not exists test_assignments_group_idx on public.test_assignments (group_id);
create index if not exists test_notes_test_created_idx on public.test_notes (test_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_customer_recruitment_status(
  p_customer_id text,
  p_next_status text,
  p_note text default ''
)
returns public.customers
language plpgsql
set search_path = ''
as $$
declare
  customer_row public.customers;
  previous_status text;
begin
  select * into customer_row
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    return null;
  end if;

  previous_status := customer_row.recruitment_status;

  if previous_status <> p_next_status then
    update public.customers
    set recruitment_status = p_next_status, updated_at = now()
    where id = p_customer_id
    returning * into customer_row;

    insert into public.recruitment_history (id, customer_id, from_status, to_status, note)
    values (gen_random_uuid()::text, p_customer_id, previous_status, p_next_status, coalesce(p_note, ''));
  end if;

  return customer_row;
end;
$$;

create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger groups_set_updated_at before update on public.groups for each row execute function public.set_updated_at();
create trigger tests_set_updated_at before update on public.tests for each row execute function public.set_updated_at();
create trigger test_rounds_set_updated_at before update on public.test_rounds for each row execute function public.set_updated_at();
create trigger test_assignments_set_updated_at before update on public.test_assignments for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_workspace_member() from public;
grant execute on function public.is_workspace_member() to authenticated;
revoke all on function public.update_customer_recruitment_status(text, text, text) from public, anon;
grant execute on function public.update_customer_recruitment_status(text, text, text) to authenticated;

alter table public.workspace_members enable row level security;
alter table public.customers enable row level security;
alter table public.recruitment_history enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tests enable row level security;
alter table public.test_rounds enable row level security;
alter table public.test_assignments enable row level security;
alter table public.test_notes enable row level security;

revoke all on public.workspace_members, public.customers, public.recruitment_history, public.groups, public.group_members, public.tests, public.test_rounds, public.test_assignments, public.test_notes from anon, public;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.customers, public.recruitment_history, public.groups, public.group_members, public.tests, public.test_rounds, public.test_assignments, public.test_notes to authenticated;

drop policy if exists workspace_members_read_self on public.workspace_members;
create policy workspace_members_read_self on public.workspace_members for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists workspace_member_access on public.customers;
create policy workspace_member_access on public.customers for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.recruitment_history;
create policy workspace_member_access on public.recruitment_history for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.groups;
create policy workspace_member_access on public.groups for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.group_members;
create policy workspace_member_access on public.group_members for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.tests;
create policy workspace_member_access on public.tests for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.test_rounds;
create policy workspace_member_access on public.test_rounds for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.test_assignments;
create policy workspace_member_access on public.test_assignments for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
drop policy if exists workspace_member_access on public.test_notes;
create policy workspace_member_access on public.test_notes for all to authenticated using (public.is_workspace_member()) with check (public.is_workspace_member());
