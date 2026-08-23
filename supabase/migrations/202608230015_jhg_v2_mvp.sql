begin;

alter table public.songs
  add column if not exists preview_provider text not null default 'youtube',
  add column if not exists preview_start_seconds integer not null default 0,
  add column if not exists preview_duration_seconds integer not null default 20,
  add column if not exists preview_enabled boolean not null default true;

alter table public.songs drop constraint if exists songs_preview_provider_check;
alter table public.songs add constraint songs_preview_provider_check
  check (preview_provider in ('youtube', 'external'));
alter table public.songs drop constraint if exists songs_preview_start_seconds_check;
alter table public.songs add constraint songs_preview_start_seconds_check
  check (preview_start_seconds between 0 and 21600);
alter table public.songs drop constraint if exists songs_preview_duration_seconds_check;
alter table public.songs add constraint songs_preview_duration_seconds_check
  check (preview_duration_seconds between 15 and 30);

alter table public.public_profiles
  add column if not exists favorite_genres text[] not null default '{}',
  add column if not exists favorite_eras text[] not null default '{}';

create table if not exists public.song_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create table if not exists public.song_awareness (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  knew_before boolean not null,
  judged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create table if not exists public.v2_comments (
  id uuid primary key default gen_random_uuid(),
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.v2_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'deleted', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_comment_reactions (
  comment_id uuid not null references public.v2_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, reaction)
);

create table if not exists public.song_preview_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  session_token uuid not null,
  source text not null default 'swipe',
  seconds_listened numeric(7,2) not null default 0 check (seconds_listened between 0 and 1800),
  qualified boolean not null default false,
  knew_before boolean,
  started_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  unique (user_id, session_token)
);

create table if not exists public.song_discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  preview_seconds numeric(7,2) not null check (preview_seconds >= 8),
  source text not null default 'swipe',
  first_discovered_at timestamptz not null default now(),
  last_listened_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index if not exists song_likes_song_created_idx on public.song_likes(song_id, created_at desc);
create index if not exists song_awareness_song_idx on public.song_awareness(song_id, knew_before);
create index if not exists v2_comments_song_created_idx on public.v2_comments(song_id, created_at desc) where status = 'published';
create index if not exists v2_comments_parent_idx on public.v2_comments(parent_id) where parent_id is not null;
create index if not exists v2_comment_reactions_comment_idx on public.v2_comment_reactions(comment_id, reaction);
create index if not exists preview_events_user_recent_idx on public.song_preview_events(user_id, started_at desc);
create index if not exists discoveries_user_recent_idx on public.song_discoveries(user_id, first_discovered_at desc);

alter table public.song_likes enable row level security;
alter table public.song_awareness enable row level security;
alter table public.v2_comments enable row level security;
alter table public.v2_comment_reactions enable row level security;
alter table public.song_preview_events enable row level security;
alter table public.song_discoveries enable row level security;

drop policy if exists song_likes_own_select on public.song_likes;
create policy song_likes_own_select on public.song_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists song_likes_own_insert on public.song_likes;
create policy song_likes_own_insert on public.song_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists song_likes_own_delete on public.song_likes;
create policy song_likes_own_delete on public.song_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists song_awareness_own_select on public.song_awareness;
create policy song_awareness_own_select on public.song_awareness for select to authenticated using (user_id = auth.uid());
drop policy if exists song_awareness_own_insert on public.song_awareness;
create policy song_awareness_own_insert on public.song_awareness for insert to authenticated with check (user_id = auth.uid());
drop policy if exists song_awareness_own_update on public.song_awareness;
create policy song_awareness_own_update on public.song_awareness for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists song_awareness_own_delete on public.song_awareness;
create policy song_awareness_own_delete on public.song_awareness for delete to authenticated using (user_id = auth.uid());

drop policy if exists v2_comments_read_published on public.v2_comments;
create policy v2_comments_read_published on public.v2_comments for select to authenticated using (status = 'published' or user_id = auth.uid());
drop policy if exists v2_comments_insert_own on public.v2_comments;
create policy v2_comments_insert_own on public.v2_comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists v2_comments_update_own on public.v2_comments;
create policy v2_comments_update_own on public.v2_comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists v2_comments_delete_own on public.v2_comments;
create policy v2_comments_delete_own on public.v2_comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists v2_reactions_read on public.v2_comment_reactions;
create policy v2_reactions_read on public.v2_comment_reactions for select to authenticated using (true);
drop policy if exists v2_reactions_insert_own on public.v2_comment_reactions;
create policy v2_reactions_insert_own on public.v2_comment_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists v2_reactions_delete_own on public.v2_comment_reactions;
create policy v2_reactions_delete_own on public.v2_comment_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists preview_events_own_select on public.song_preview_events;
create policy preview_events_own_select on public.song_preview_events for select to authenticated using (user_id = auth.uid());
drop policy if exists preview_events_own_insert on public.song_preview_events;
create policy preview_events_own_insert on public.song_preview_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists preview_events_own_update on public.song_preview_events;
create policy preview_events_own_update on public.song_preview_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists discoveries_own_select on public.song_discoveries;
create policy discoveries_own_select on public.song_discoveries for select to authenticated using (user_id = auth.uid());
drop policy if exists discoveries_own_insert on public.song_discoveries;
create policy discoveries_own_insert on public.song_discoveries for insert to authenticated with check (user_id = auth.uid());
drop policy if exists discoveries_own_update on public.song_discoveries;
create policy discoveries_own_update on public.song_discoveries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.song_likes, public.song_awareness, public.v2_comments,
  public.v2_comment_reactions, public.song_preview_events, public.song_discoveries
  from anon, authenticated;
grant select, insert, delete on public.song_likes to authenticated;
grant select, insert, update, delete on public.song_awareness to authenticated;
grant select, insert, update, delete on public.v2_comments to authenticated;
grant select, insert, delete on public.v2_comment_reactions to authenticated;
grant select, insert, update on public.song_preview_events to authenticated;
grant select, insert, update on public.song_discoveries to authenticated;

commit;
