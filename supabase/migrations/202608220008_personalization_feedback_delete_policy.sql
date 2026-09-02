begin;

grant select, delete
on table public.personalization_feedback
to authenticated;

drop policy if exists users_delete_own_personalization_feedback
  on public.personalization_feedback;

create policy users_delete_own_personalization_feedback
on public.personalization_feedback
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
