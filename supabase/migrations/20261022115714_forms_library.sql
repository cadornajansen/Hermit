-- Library of official blank forms and agency guides, copied from government
-- websites by scripts/sync-forms.mjs. Public on purpose: these are public
-- documents, and owners on weak signal need a fast, stable link. Only the
-- server (secret key) can write; there are no storage policies for anon.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forms', 'forms', true, 20971520,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;
