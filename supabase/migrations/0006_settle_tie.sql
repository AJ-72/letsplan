-- T12b: tie settlement (implements D8).
--
-- Replaces the T4 index that was meant to make settlement write-once:
--
--   create unique index one_settlement_per_round
--     on suggestion_rounds(id) where settled_suggestion_id is not null;
--
-- That index is unique on `id`, which is already the primary key, so it is
-- satisfied by definition and prevents nothing. An UPDATE moving
-- settled_suggestion_id from A to B keeps id unique and would have overwritten
-- the first record. Uniqueness cannot express "this column may be written once"
-- when the column lives on the round row; that needs a policy plus a trigger.

drop index if exists one_settlement_per_round;

-- suggestion_rounds had a SELECT policy only, so with RLS enabled no client
-- could settle anything. This is the only UPDATE route granted to members, and
-- it is deliberately narrow: only a tied, unsettled round, only by a member,
-- only recording themselves, and only a suggestion from this same round.
create policy member_settles_tie on suggestion_rounds
  for update using (
    is_group_member(group_id)
    and status = 'tie'
    and settled_suggestion_id is null
  ) with check (
    is_group_member(group_id)
    and settled_by = auth.uid()
    and settled_suggestion_id is not null
    and exists (
      select 1 from suggestions s
      where s.id = settled_suggestion_id and s.round_id = id
    )
  );

-- First record wins, enforced in the database rather than the UI.
--
-- The USING clause above already means a concurrent second write matches no row
-- and silently updates nothing. This trigger turns that into a hard error the
-- client can show, and stops a settlement write from smuggling in changes to the
-- outcome fields (a member may record what the group chose; they may not rewrite
-- the round's status or winner).
--
-- Updates that do not touch settlement pass straight through, so
-- resolve_round_if_complete() in 0003 is unaffected.
create or replace function trg_round_settlement_write_once()
returns trigger language plpgsql as $$
begin
  if old.settled_suggestion_id is not null then
    if new.settled_suggestion_id is distinct from old.settled_suggestion_id
       or new.settled_by is distinct from old.settled_by
       or new.settled_at is distinct from old.settled_at then
      raise exception 'round % is already settled', old.id
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.settled_suggestion_id is not null then
    if new.status              is distinct from old.status
       or new.winner_suggestion_id is distinct from old.winner_suggestion_id
       or new.group_id         is distinct from old.group_id
       or new.closes_at        is distinct from old.closes_at then
      raise exception 'settling a round may not change its outcome'
        using errcode = 'check_violation';
    end if;

    -- stamped server-side so the client cannot backdate it
    new.settled_at := now();
  end if;

  return new;
end;
$$;

create trigger round_settlement_write_once
before update on suggestion_rounds
for each row execute function trg_round_settlement_write_once();
