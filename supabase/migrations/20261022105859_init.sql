-- HERMIT backend v1.
-- Access model: only the Next.js server talks to the database, using the
-- secret (service-role) key, scoped to the owner id in a signed httpOnly
-- cookie. RLS is on with no policies, so the public anon/publishable key
-- can read nothing. Per-user RLS policies come with real auth (eGovPH SSO).

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  profile jsonb,
  items jsonb not null default '{}'::jsonb, -- checklist status per requirement id
  last_diff jsonb
);

create table public.documents (
  id uuid not null, -- generated on the device
  owner_id uuid not null references public.owners (id) on delete cascade,
  file_name text not null,
  mime text not null,
  size integer not null check (size >= 0),
  sha256 text not null,
  storage_path text, -- null when the file only lives on the owner's device
  requirement_id text,
  expected_types text[] not null default '{}',
  extracted jsonb not null,
  checks jsonb not null default '[]'::jsonb,
  verdict text not null check (verdict in ('verified', 'needs_review', 'rejected')),
  owner_confirmed boolean not null default false,
  uploaded_at timestamptz not null default now(),
  primary key (owner_id, id) -- a client can never touch another owner's row
);

-- Append-only record of what the owner submitted and what HERMIT concluded.
create table public.vault_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.owners (id) on delete cascade,
  doc_id uuid,
  doc_name text not null,
  event text not null,
  at timestamptz not null default now()
);
create index vault_events_owner_idx on public.vault_events (owner_id, at desc);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.owners (id) on delete cascade,
  role text not null check (role in ('owner', 'hermit')),
  text text not null,
  sources jsonb,
  form_ids text[],
  at timestamptz not null default now()
);
create index chat_messages_owner_idx on public.chat_messages (owner_id, at);

alter table public.owners enable row level security;
alter table public.documents enable row level security;
alter table public.vault_events enable row level security;
alter table public.chat_messages enable row level security;

-- New tables aren't exposed to the Data API by default; grant only the server role.
revoke all on public.owners, public.documents, public.vault_events, public.chat_messages from anon, authenticated;
grant select, insert, update, delete on public.owners, public.documents, public.vault_events, public.chat_messages to service_role;
grant usage on all sequences in schema public to service_role;

-- Private bucket for uploaded documents: <owner_id>/<document_id>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
