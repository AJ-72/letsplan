alter table app_users         enable row level security;
alter table groups            enable row level security;
alter table group_members     enable row level security;
alter table places            enable row level security;
alter table suggestion_rounds enable row level security;
alter table suggestions       enable row level security;
alter table votes             enable row level security;

-- helper: is the current user in this group?
create or replace function is_group_member(g uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from group_members
    where group_id = g and user_id = auth.uid()
  );
$$;

create policy own_profile on app_users
  for select using (id = auth.uid());

create policy member_groups on groups
  for select using (is_group_member(id));

create policy member_roster on group_members
  for select using (is_group_member(group_id));

create policy member_rounds on suggestion_rounds
  for select using (is_group_member(group_id));

create policy member_suggestions on suggestions
  for select using (
    exists (select 1 from suggestion_rounds r
            where r.id = round_id and is_group_member(r.group_id))
  );

create policy member_places on places
  for select using (
    exists (select 1 from suggestions s
            join suggestion_rounds r on r.id = s.round_id
            where s.place_id = places.id and is_group_member(r.group_id))
  );

-- votes: group members may READ rows (needed for the tally)
create policy member_votes_read on votes
  for select using (
    exists (select 1 from suggestions s
            join suggestion_rounds r on r.id = s.round_id
            where s.id = suggestion_id and is_group_member(r.group_id))
  );

-- but may only WRITE as themselves
create policy own_votes_insert on votes
  for insert with check (voter_id = auth.uid());

create policy own_votes_update on votes
  for update using (voter_id = auth.uid())
             with check (voter_id = auth.uid());

create view votes_visible with (security_invoker = true) as
select
  v.id,
  v.suggestion_id,
  v.value,
  v.is_revealed,
  v.created_at,
  case when v.is_revealed or v.voter_id = auth.uid()
       then v.voter_id end as voter_id
from votes v;
