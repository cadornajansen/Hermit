-- Rate limits for paid AI calls (Kuya Hermit chat, document reading,
-- business classification). Buckets are 'owner:<uuid>' or 'ip:<hmac>' —
-- IPs are stored only as a keyed hash.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  bucket text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index ai_usage_bucket_idx on public.ai_usage (bucket, kind, at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, delete on public.ai_usage to service_role;
grant usage on all sequences in schema public to service_role;

-- Checks every (bucket, limit, window) rule; if all pass, records one use per
-- distinct bucket and returns true. Otherwise records nothing and returns false.
create function public.take_ai_quota(
  p_kind text,
  p_buckets text[],
  p_limits int[],
  p_window_seconds int[]
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i int;
begin
  if cardinality(p_buckets) = 0
     or cardinality(p_buckets) <> cardinality(p_limits)
     or cardinality(p_buckets) <> cardinality(p_window_seconds) then
    raise exception 'take_ai_quota: buckets, limits and windows must be non-empty and the same length';
  end if;

  -- Serialize concurrent calls for the same owner so two requests can't both pass at the limit.
  perform pg_advisory_xact_lock(hashtext(p_buckets[1]));

  for i in 1 .. cardinality(p_buckets) loop
    if (
      select count(*) from public.ai_usage
      where bucket = p_buckets[i]
        and kind = p_kind
        and at > now() - make_interval(secs => p_window_seconds[i])
    ) >= p_limits[i] then
      return false;
    end if;
  end loop;

  insert into public.ai_usage (bucket, kind)
  select distinct b, p_kind from unnest(p_buckets) as b;

  -- Occasional cleanup; no window is longer than a day.
  if random() < 0.02 then
    delete from public.ai_usage where at < now() - interval '2 days';
  end if;

  return true;
end;
$$;

revoke execute on function public.take_ai_quota(text, text[], int[], int[]) from public, anon, authenticated;
grant execute on function public.take_ai_quota(text, text[], int[], int[]) to service_role;
