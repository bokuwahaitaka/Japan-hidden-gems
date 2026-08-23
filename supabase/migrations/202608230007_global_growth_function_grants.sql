-- Explicitly remove anonymous execution inherited from project default privileges.
-- JHG creates an anonymous Auth user for visitors, so these RPCs remain available
-- to real app sessions through the authenticated role.
revoke all on function public.ensure_referral_code() from anon;
revoke all on function public.claim_referral(text,text) from anon;
revoke all on function public.get_my_referral_summary() from anon;
revoke all on function public.get_translation_proposals(bigint,text) from anon;
revoke all on function public.get_global_growth_metrics(integer) from anon;
revoke all on function public.get_region_discoveries(text,integer) from anon;

grant execute on function public.ensure_referral_code(), public.claim_referral(text,text),
  public.get_my_referral_summary(), public.get_translation_proposals(bigint,text),
  public.get_global_growth_metrics(integer), public.get_region_discoveries(text,integer)
  to authenticated;
