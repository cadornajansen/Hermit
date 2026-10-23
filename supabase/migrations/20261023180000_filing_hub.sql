-- Filing hub (prototype): demo QR payments and in-app submissions.

-- A demo payment moves no money: it's paid when someone confirms it on the
-- demo checkout page, never from an agency or gateway.
alter table public.payments add column if not exists demo boolean not null default false;

-- Returns and applications filed from HERMIT. While agencies aren't
-- connected these are demo submissions; status is derived from created_at.
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  ref_no text not null unique,
  kind text not null check (kind in ('return', 'application')),
  title text not null,
  agency text not null,
  form_id text,
  requirement_id text,
  period text,
  payment_txnid text,
  demo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists submissions_owner_idx on public.submissions (owner_id, created_at desc);
alter table public.submissions enable row level security;
revoke all on public.submissions from anon, authenticated;
grant select, insert, delete on public.submissions to service_role;
