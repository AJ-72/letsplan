-- Voting closes when the round resolves.
--
-- Once a round leaves 'open' (resolved / tie / no_result) the outcome has been
-- shown to the group, so new votes must not be accepted. The resolution
-- function in 0003 already no-ops on a non-open round, meaning a late vote
-- would not move the winner -- but it would leave stored votes that no longer
-- justify the recorded outcome, which breaks auditability.
--
-- Inserts are blocked in RLS. Changing an existing vote's *value* is blocked in
-- a trigger rather than RLS, because a policy cannot compare the old row to the
-- new one (`using` sees OLD, `with check` sees NEW). Doing it in a trigger lets
-- `is_revealed` stay editable after resolution, which T13 (per-vote reveal)
-- needs -- revealing how you voted is something people may well do only after
-- seeing the result.

drop policy own_votes_insert on votes;

create policy own_votes_insert on votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from suggestions s
      join suggestion_rounds r on r.id = s.round_id
      where s.id = suggestion_id
        and is_group_member(r.group_id)
        and r.status = 'open'
    )
  );

-- Reject a change to `value` once the round has resolved. Reveal flips are
-- still allowed.
create or replace function trg_votes_no_change_after_resolution()
returns trigger language plpgsql as $$
declare
  v_status text;
begin
  if new.value = old.value then
    return new;  -- not a vote change (e.g. a reveal); nothing to guard
  end if;

  select r.status into v_status
  from suggestions s
  join suggestion_rounds r on r.id = s.round_id
  where s.id = new.suggestion_id;

  if v_status is distinct from 'open' then
    raise exception 'round is % -- votes can no longer be changed', v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger votes_no_change_after_resolution
before update on votes
for each row execute function trg_votes_no_change_after_resolution();
