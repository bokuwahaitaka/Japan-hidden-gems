-- User-owned favorite songs library
begin;

create table if not exists public.favorite_songs (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index if not exists favorite_songs_user_created_idx
on public.favorite_songs (user_id, created_at desc);

alter table public.favorite_songs enable row level security;

drop policy if exists "users_read_own_favorites" on public.favorite_songs;
create policy "users_read_own_favorites"
on public.favorite_songs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users_add_own_favorites" on public.favorite_songs;
create policy "users_add_own_favorites"
on public.favorite_songs for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users_delete_own_favorites" on public.favorite_songs;
create policy "users_delete_own_favorites"
on public.favorite_songs for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.favorite_songs from anon, authenticated;
grant select, insert, delete on public.favorite_songs to authenticated;

commit;
