create or replace function public.get_my_referral_summary()
returns table(code text, visits bigint, activations bigint, shares bigint)
language sql stable security definer set search_path = '' as $$
  select r.code,
    (select count(*) from public.referral_events e where e.referral_code=r.code and e.event_type='visit'),
    (select count(*) from public.referral_events e where e.referral_code=r.code and e.event_type='activated'),
    (select count(*) from public.growth_events g where g.user_id=r.user_id and g.event_name='referral_shared')
  from public.referral_codes r where r.user_id=auth.uid();
$$;
revoke all on function public.get_my_referral_summary() from public, anon;
grant execute on function public.get_my_referral_summary() to authenticated;
