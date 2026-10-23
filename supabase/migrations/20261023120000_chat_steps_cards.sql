-- Kuya Hermit's step timeline and the interactive cards under an answer.
alter table public.chat_messages add column if not exists steps jsonb, add column if not exists cards jsonb;
