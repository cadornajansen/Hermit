-- Tax and fee payments made through the in-app payment terminal (eGovPay).
-- A row is created before the owner is sent to the gateway; its status only
-- changes from what eGovPay itself reports (never from the browser).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  txnid text not null unique,
  gateway_uuid text,
  payment_url text,
  form_id text not null,
  description text not null,
  tin text,
  rdo_code text,
  atc text,
  period text,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  channel text,
  refno text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_owner_idx on public.payments (owner_id, created_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select, insert, update on public.payments to service_role;
