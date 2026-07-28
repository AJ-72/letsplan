-- T12: deterministic round resolution via DB trigger
-- Fires after every vote insert/update; resolves when all members have voted
-- on every suggestion in the round, or closes_at has passed (handled separately
-- by the closes_at check in the function below for timeout-triggered calls).

create or replace function resolve_round_if_complete(p_round_id uuid)
returns void language plpgsql security definer as $$
declare
  v_group_id        uuid;
  v_member_count    int;
  v_voter_count     int;
  v_suggestion_count int;
  v_voted_count     int;
  v_winner_id       uuid;
  v_max_yes         int;
  v_tie             boolean;
  v_closes_at       timestamptz;
  v_now             timestamptz := now();
begin
  -- lock the round row to prevent concurrent resolutions
  select group_id, closes_at
  into v_group_id, v_closes_at
  from suggestion_rounds
  where id = p_round_id and status = 'open'
  for update;

  if not found then
    return; -- already resolved or doesn't exist
  end if;

  select count(*) into v_member_count
  from group_members where group_id = v_group_id;

  select count(*) into v_suggestion_count
  from suggestions where round_id = p_round_id;

  -- count distinct voters who have voted on at least one suggestion
  select count(distinct voter_id) into v_voter_count
  from votes v
  join suggestions s on s.id = v.suggestion_id
  where s.round_id = p_round_id;

  -- count (voter, suggestion) pairs that have been voted on
  select count(*) into v_voted_count
  from votes v
  join suggestions s on s.id = v.suggestion_id
  where s.round_id = p_round_id;

  -- resolve only when all members × all suggestions are covered,
  -- or closes_at has passed
  if v_voted_count < (v_member_count * v_suggestion_count)
     and v_now < v_closes_at then
    return; -- not yet complete
  end if;

  -- timeout path: require ≥2 voters
  if v_now >= v_closes_at and v_voter_count < 2 then
    update suggestion_rounds
    set status = 'no_result', resolved_at = v_now
    where id = p_round_id and status = 'open';
    return;
  end if;

  -- count yes votes per suggestion (deterministic: same data → same counts)
  select max(yes_count) into v_max_yes
  from (
    select count(*) filter (where value = 'yes') as yes_count
    from votes v
    join suggestions s on s.id = v.suggestion_id
    where s.round_id = p_round_id
    group by s.id
  ) counts;

  -- check for tie: more than one suggestion shares the max yes count
  select count(*) > 1 into v_tie
  from (
    select s.id
    from votes v
    join suggestions s on s.id = v.suggestion_id
    where s.round_id = p_round_id
    group by s.id
    having count(*) filter (where value = 'yes') = v_max_yes
  ) tied;

  if v_tie then
    update suggestion_rounds
    set status = 'tie', resolved_at = v_now
    where id = p_round_id and status = 'open';
    return;
  end if;

  -- single winner
  select s.id into v_winner_id
  from votes v
  join suggestions s on s.id = v.suggestion_id
  where s.round_id = p_round_id
  group by s.id
  order by count(*) filter (where value = 'yes') desc
  limit 1;

  update suggestion_rounds
  set status = 'resolved',
      winner_suggestion_id = v_winner_id,
      resolved_at = v_now
  where id = p_round_id and status = 'open';
end;
$$;

-- trigger function: extracts round_id from the voted suggestion and calls resolver
create or replace function trg_vote_resolve()
returns trigger language plpgsql security definer as $$
declare
  v_round_id uuid;
begin
  select round_id into v_round_id
  from suggestions where id = new.suggestion_id;

  perform resolve_round_if_complete(v_round_id);
  return new;
end;
$$;

create trigger vote_resolve_trigger
after insert or update on votes
for each row execute function trg_vote_resolve();
