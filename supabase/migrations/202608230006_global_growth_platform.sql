-- JHG global growth platform: localization, referrals and privacy-safe analytics.
-- Public APIs expose aggregate data only. All user-owned rows are protected by RLS.

create table public.song_localizations (
  song_id bigint not null references public.songs(id) on delete cascade,
  locale text not null check (locale in ('ja','en','ko','zh','ru','es','fr')),
  localized_title text not null check (char_length(btrim(localized_title)) between 1 and 240),
  localized_artist text not null check (char_length(btrim(localized_artist)) between 1 and 200),
  cultural_note text not null default '' check (char_length(cultural_note) <= 1200),
  source text not null default 'community' check (source in ('official','community','admin','ai_reviewed')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (song_id, locale)
);

create table public.song_localization_proposals (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null check (locale in ('en','ko','zh','ru','es','fr')),
  proposed_title text not null check (char_length(btrim(proposed_title)) between 1 and 240),
  proposed_artist text not null check (char_length(btrim(proposed_artist)) between 1 and 200),
  cultural_note text not null default '' check (char_length(cultural_note) <= 1200),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','duplicate')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.song_localization_votes (
  proposal_id bigint not null references public.song_localization_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1,1)),
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8,20}$'),
  created_at timestamptz not null default now()
);

create table public.referral_events (
  id bigint generated always as identity primary key,
  referral_code text not null references public.referral_codes(code) on delete cascade,
  visitor_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('visit','activated','shared')),
  created_at timestamptz not null default now(),
  unique (referral_code, visitor_user_id, event_type)
);

create table public.growth_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  event_name text not null check (event_name ~ '^[a-z0-9_]{2,60}$'),
  locale text not null check (locale in ('ja','en','ko','zh','ru','es','fr')),
  region_code text,
  page_view text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index localization_proposals_song_idx on public.song_localization_proposals(song_id, locale, status, created_at desc);
create index localization_votes_proposal_idx on public.song_localization_votes(proposal_id);
create index referral_events_code_idx on public.referral_events(referral_code, created_at desc);
create index growth_events_created_idx on public.growth_events(created_at desc);
create index growth_events_funnel_idx on public.growth_events(event_name, locale, region_code, created_at desc);

alter table public.song_localizations enable row level security;
alter table public.song_localization_proposals enable row level security;
alter table public.song_localization_votes enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;
alter table public.growth_events enable row level security;

create policy localizations_public_read on public.song_localizations for select to anon, authenticated using (true);
create policy localizations_admin_insert on public.song_localizations for insert to authenticated with check (public.is_song_admin());
create policy localizations_admin_update on public.song_localizations for update to authenticated using (public.is_song_admin()) with check (public.is_song_admin());
create policy localizations_admin_delete on public.song_localizations for delete to authenticated using (public.is_song_admin());

create policy localization_proposals_read on public.song_localization_proposals for select to authenticated using (true);
create policy localization_proposals_insert_own on public.song_localization_proposals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy localization_proposals_update_admin on public.song_localization_proposals for update to authenticated using (public.is_song_admin()) with check (public.is_song_admin());
create policy localization_votes_read on public.song_localization_votes for select to authenticated using (true);
create policy localization_votes_insert_own on public.song_localization_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy localization_votes_update_own on public.song_localization_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy localization_votes_delete_own on public.song_localization_votes for delete to authenticated using ((select auth.uid()) = user_id);

create policy referral_codes_own on public.referral_codes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy referral_events_visitor_read on public.referral_events for select to authenticated using ((select auth.uid()) = visitor_user_id);
create policy growth_events_own_read on public.growth_events for select to authenticated using ((select auth.uid()) = user_id or public.is_song_admin());
create policy growth_events_insert_own on public.growth_events for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.song_localizations, public.song_localization_proposals, public.song_localization_votes,
  public.referral_codes, public.referral_events, public.growth_events from public, anon;
grant select on public.song_localizations to anon, authenticated;
grant select, insert, update on public.song_localization_proposals to authenticated;
grant select, insert, update, delete on public.song_localization_votes to authenticated;
grant select, insert, update, delete on public.referral_codes to authenticated;
grant select on public.referral_events to authenticated;
grant select, insert on public.growth_events to authenticated;
grant usage, select on sequence public.song_localization_proposals_id_seq, public.referral_events_id_seq,
  public.growth_events_id_seq to authenticated;

create or replace function public.ensure_referral_code()
returns text language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select r.code into v_code from public.referral_codes r where r.user_id = v_user;
  if v_code is null then
    v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    insert into public.referral_codes(user_id, code) values (v_user, v_code)
    on conflict (user_id) do update set user_id = excluded.user_id returning code into v_code;
  end if;
  return v_code;
end; $$;

create or replace function public.claim_referral(p_code text, p_event_type text default 'visit')
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('visit','activated','shared') then raise exception 'Invalid referral event'; end if;
  if not exists(select 1 from public.referral_codes r where r.code = lower(p_code) and r.user_id <> v_user) then return false; end if;
  insert into public.referral_events(referral_code, visitor_user_id, event_type)
  values (lower(p_code), v_user, p_event_type) on conflict do nothing;
  return true;
end; $$;

create or replace function public.get_my_referral_summary()
returns table(code text, visits bigint, activations bigint, shares bigint)
language sql stable security definer set search_path = '' as $$
  select r.code,
    count(e.id) filter (where e.event_type='visit'),
    count(e.id) filter (where e.event_type='activated'),
    count(e.id) filter (where e.event_type='shared')
  from public.referral_codes r left join public.referral_events e on e.referral_code=r.code
  where r.user_id=auth.uid() group by r.code;
$$;

create or replace function public.get_global_growth_metrics(p_days integer default 30)
returns table(metric text, dimension text, value bigint)
language sql stable security definer set search_path = '' as $$
  with e as (
    select * from public.growth_events g
    where g.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days,30),365)))
  )
  select 'event'::text, event_name, count(*) from e group by event_name
  union all select 'locale', locale, count(*) from e group by locale
  union all select 'region', coalesce(region_code,'unknown'), count(*) from e group by region_code
  union all select 'community', 'public_curators', count(*) from public.public_profiles p where p.is_public and p.is_curator
  union all select 'community', 'published_guides', count(*) from public.song_guides g where g.status='published'
  union all select 'catalog', 'visible_songs', count(*) from public.songs s where not s.is_hidden;
$$;

create or replace function public.get_region_discoveries(p_region text, p_limit integer default 20)
returns table(song_id bigint, activity_score numeric, listeners bigint)
language sql stable security definer set search_path = '' as $$
  with activity as (
    select r.song_id, r.user_id, greatest(coalesce(r.rating,0),1)::numeric as weight
    from public.ratings r join public.listener_profiles p on p.user_id=r.user_id
    where p.listener_group='overseas' and (p_region is null or p.country_code=p_region)
    union all
    select f.song_id, f.user_id, 3::numeric
    from public.favorite_songs f join public.listener_profiles p on p.user_id=f.user_id
    where p.listener_group='overseas' and (p_region is null or p.country_code=p_region)
  )
  select a.song_id, sum(a.weight), count(distinct a.user_id)
  from activity a join public.songs s on s.id=a.song_id and not s.is_hidden
  group by a.song_id order by sum(a.weight) desc, count(distinct a.user_id) desc, a.song_id
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

create or replace function public.get_translation_proposals(p_song_id bigint, p_locale text)
returns table(id bigint, song_id bigint, locale text, proposed_title text, proposed_artist text,
  cultural_note text, score bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id,p.song_id,p.locale,p.proposed_title,p.proposed_artist,p.cultural_note,
    coalesce(sum(v.vote),0)::bigint,p.created_at
  from public.song_localization_proposals p left join public.song_localization_votes v on v.proposal_id=p.id
  where p.song_id=p_song_id and p.locale=p_locale and p.status='pending'
  group by p.id order by coalesce(sum(v.vote),0) desc,p.created_at;
$$;

revoke all on function public.ensure_referral_code(), public.claim_referral(text,text),
  public.get_my_referral_summary(), public.get_global_growth_metrics(integer),
  public.get_region_discoveries(text,integer), public.get_translation_proposals(bigint,text) from public;
grant execute on function public.ensure_referral_code(), public.claim_referral(text,text), public.get_my_referral_summary() to authenticated;
grant execute on function public.get_global_growth_metrics(integer), public.get_region_discoveries(text,integer) to anon, authenticated;
grant execute on function public.get_translation_proposals(bigint,text) to authenticated;

