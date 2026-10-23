-- The filled form attached to a filing (private bucket path), when there is one.
alter table public.submissions add column if not exists file_path text;
