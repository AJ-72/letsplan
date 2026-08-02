STEP: 3 (blueprint) complete; Step 2 debt paid (CONTRACT.md written)
NEXT_ARTIFACT: factory/HANDOFF.md — task list, ambiguities with defaults, stop conditions, morning review focus
LAST_ACTION: T12 complete — resolution moved into a DB trigger (0003); winner and tie
  both verified live on two devices. Voting now closes on resolution (0005).
  Moving to T12b (tie settlement).
BLOCKED_ON: nothing
DEFERRED: T6 attacks 1 and 3. Attacks 2 and 4 passed against real two-user data
  (unrevealed votes return null voter_id; cannot update another user's vote).
  Attack 1 needs a second group; attack 3 needs a revealed vote, so it rides along with T13.
TASKS_DONE: T0-T12 (13 of 23)
CONSECUTIVE_FAILURES: 0

NOTES:
- Project reclassified: venture idea -> hobby / learning project. No monetization.
- Primary goal is learning the build, not validating the market.
- BUILD STANDARD: monetizable-grade. Do not skip or soften any step on hobby grounds.
- Outstanding debt: kill gate never run. Settle before any monetization.

OPEN AGAINST THE PLAN:
- D6's timeout half has no execution path. Resolution runs only from a trigger on
  vote writes, so a round nobody finishes sits at 'open' past closes_at until a
  stray vote resolves it late. Needs a scheduled sweep (pg_cron, or a GitHub Action
  against an Edge Function, alongside T16/T17). Raised with the human; not yet decided.
- A decision was taken during T12 that is not recorded in DECISIONS.md: votes are
  rejected once a round leaves 'open', while is_revealed stays editable so T13 can
  still reveal after the outcome. Implemented in 0005. DECISIONS.md may want an entry.

CARRIED DEBT (code):
- castVote failures are swallowed: App.tsx calls castVote(...).catch(console.error),
  so a policy rejection leaves the card gone from the deck and the user believing the
  vote landed. Narrow race in practice; fix when next in that file (T13).
- supabase/test_membership.sql parks three real accounts out of the test group
  (Anand, Raseen, Test User 3) so the resolution gate can be satisfied by two testers.
  Re-add block is in that file. Must be undone before the group is used for real.
