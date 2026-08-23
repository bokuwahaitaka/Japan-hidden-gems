begin;

create index if not exists growth_events_user_idx
  on public.growth_events(user_id, created_at desc);

commit;
