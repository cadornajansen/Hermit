-- Document packets Kuya Hermit prepared in a reply (requirement ids).
alter table public.chat_messages add column if not exists packs text[];
