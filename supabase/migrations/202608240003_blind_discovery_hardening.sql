-- Reject incomplete or internally inconsistent rating rows at the table boundary.
begin;

alter table public.ratings
  alter column user_id set not null,
  alter column song_id set not null,
  alter column heard_before set not null;

alter table public.ratings drop constraint if exists ratings_value_check;
alter table public.ratings add constraint ratings_value_check check (
  (heard_before is true and rating is null and relisten_intent is null and share_intent is null)
  or
  (heard_before is false and (rating is null or rating between 1 and 5))
);

commit;
