-- Japan Hidden Gems: administrator song management
begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.songs
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

create index if not exists songs_is_hidden_idx
  on public.songs (is_hidden, id);

alter table public.admin_users enable row level security;

drop policy if exists "admins_read_own_membership" on public.admin_users;
create policy "admins_read_own_membership"
  on public.admin_users for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.admin_users to authenticated;

create or replace function public.is_song_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_song_admin() from public;
grant execute on function public.is_song_admin() to authenticated;

create or replace function public.get_hidden_song_ids()
returns table (id bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id::bigint
  from public.songs s
  where s.is_hidden = true;
$$;

revoke all on function public.get_hidden_song_ids() from public;
grant execute on function public.get_hidden_song_ids() to anon, authenticated;

create or replace function public.admin_list_songs()
returns table (
  id bigint,
  title text,
  artist text,
  year integer,
  youtube_url text,
  is_hidden boolean,
  created_at timestamptz,
  recommendation_count bigint,
  rating_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    s.id::bigint,
    s.title::text,
    s.artist::text,
    s.year::integer,
    s.youtube_url::text,
    s.is_hidden,
    s.created_at,
    (select count(*) from public.recommendations r where r.song_id = s.id),
    (select count(*) from public.ratings rt where rt.song_id = s.id)
  from public.songs s
  order by s.is_hidden desc, s.id desc;
end;
$$;

revoke all on function public.admin_list_songs() from public;
grant execute on function public.admin_list_songs() to authenticated;

create or replace function public.admin_set_song_hidden(
  p_song_id bigint,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  update public.songs
  set
    is_hidden = p_hidden,
    hidden_at = case when p_hidden then now() else null end,
    hidden_by = case when p_hidden then auth.uid() else null end
  where id = p_song_id;

  if not found then
    raise exception 'Song not found.';
  end if;
end;
$$;

revoke all on function public.admin_set_song_hidden(bigint,boolean) from public;
grant execute on function public.admin_set_song_hidden(bigint,boolean) to authenticated;

create or replace function public.admin_delete_song(
  p_song_id bigint,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  select title into v_title
  from public.songs
  where id = p_song_id;

  if v_title is null then
    raise exception 'Song not found.';
  end if;

  if p_confirmation is distinct from v_title then
    raise exception 'The confirmation title does not match.';
  end if;

  delete from public.recommendations where song_id = p_song_id;
  delete from public.ratings where song_id = p_song_id;
  delete from public.songs where id = p_song_id;
end;
$$;

revoke all on function public.admin_delete_song(bigint,text) from public;
grant execute on function public.admin_delete_song(bigint,text) to authenticated;

commit;

-- After creating your email/password admin in Authentication > Users, run:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
-- Do not commit a real administrator email or password to GitHub.
