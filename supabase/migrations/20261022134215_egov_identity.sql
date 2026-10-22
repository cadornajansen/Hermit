-- Binds an owner's HERMIT data to their eGovPH account ("anonymous, then
-- upgrade"): signing in with eGovPH on any device restores the same owner.
alter table public.owners add column egov_uniqid text unique;
-- Set once the owner passes National ID (PhilSys) eVerify with face liveness.
alter table public.owners add column identity_verified_at timestamptz;
