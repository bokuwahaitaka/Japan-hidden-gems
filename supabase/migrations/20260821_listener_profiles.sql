-- Japan Hidden Gems: anonymous listener profile migration
begin;

create table if not exists public.listener_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  listener_group text not null check (listener_group in ('japan', 'overseas')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  age_band text not null check (age_band in (
    'under_18','18_24','25_34','35_44','45_54','55_64','65_plus','prefer_not_to_say'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listener_group_country_consistent check (
    (listener_group = 'japan' and country_code = 'JP') or
    (listener_group = 'overseas' and country_code <> 'JP')
  )
);

create table if not exists public.genres (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  label_en text not null,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table if not exists public.listener_genre_preferences (
  user_id uuid not null references public.listener_profiles(user_id) on delete cascade,
  genre_id smallint not null references public.genres(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, genre_id)
);

insert into public.genres (slug,label_en,sort_order) values
('j-pop','J-Pop',10),('rock','Rock',20),('indie-alternative','Indie / Alternative',30),
('hip-hop-rap','Hip-hop / Rap',40),('r-and-b-soul','R&B / Soul',50),
('electronic-dance','Electronic / Dance',60),('city-pop','City Pop',70),
('anime-game','Anime / Game Music',80),('vocaloid','Vocaloid',90),
('jazz','Jazz',100),('classical','Classical',110),('folk-traditional','Folk / Traditional',120),
('metal','Metal',130),('punk','Punk',140),('other','Other',150)
on conflict (slug) do update set label_en=excluded.label_en,sort_order=excluded.sort_order;

alter table public.listener_profiles enable row level security;
alter table public.genres enable row level security;
alter table public.listener_genre_preferences enable row level security;

create policy "profiles_select_own" on public.listener_profiles for select to authenticated
using ((select auth.uid())=user_id);
create policy "profiles_insert_own" on public.listener_profiles for insert to authenticated
with check ((select auth.uid())=user_id);
create policy "profiles_update_own" on public.listener_profiles for update to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "genres_read_active" on public.genres for select to authenticated using (is_active=true);
create policy "preferences_select_own" on public.listener_genre_preferences for select to authenticated
using ((select auth.uid())=user_id);
create policy "preferences_insert_own" on public.listener_genre_preferences for insert to authenticated
with check ((select auth.uid())=user_id);
create policy "preferences_delete_own" on public.listener_genre_preferences for delete to authenticated
using ((select auth.uid())=user_id);

grant select,insert,update on public.listener_profiles to authenticated;
grant select on public.genres to authenticated;
grant select,insert,delete on public.listener_genre_preferences to authenticated;

commit;
