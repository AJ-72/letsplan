-- Tighten vote writes: being signed in is not enough, you must belong to the
-- group that owns the suggestion.
--
-- The original policies (0002) checked only `voter_id = auth.uid()`, which
-- proves you are writing as yourself but not that the round is yours. Any
-- authenticated user who learned a suggestion_id could vote in a group they
-- are not a member of. That is a privacy leak in its own right, and it also
-- corrupts the resolution gate in 0003, which infers "everyone has voted on
-- everything" from a row count over group size.
--
-- The read policy (member_votes_read) already scopes by membership; this
-- brings the write policies in line with it.

drop policy own_votes_insert on votes;
drop policy own_votes_update on votes;

create policy own_votes_insert on votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from suggestions s
      join suggestion_rounds r on r.id = s.round_id
      where s.id = suggestion_id and is_group_member(r.group_id)
    )
  );

create policy own_votes_update on votes
  for update using (
    voter_id = auth.uid()
    and exists (
      select 1 from suggestions s
      join suggestion_rounds r on r.id = s.round_id
      where s.id = suggestion_id and is_group_member(r.group_id)
    )
  ) with check (
    voter_id = auth.uid()
    and exists (
      select 1 from suggestions s
      join suggestion_rounds r on r.id = s.round_id
      where s.id = suggestion_id and is_group_member(r.group_id)
    )
  );
