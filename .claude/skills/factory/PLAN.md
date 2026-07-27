# PLAN.md — Let's Plan v1

Derived from BRIEF.md. Every task is independently verifiable — each states how you know
it is done. `[STRUCTURAL]` tasks change the shape of everything after them; they are
expensive to redo and must not be improvised.

Acceptance tests are S1/S2/S3 from the brief. Definition of done: four people, four
phones, one deck, same winner, no refresh.

---

## Phase 0 — Foundations

### T0 — Prerequisites (hard blocker for everything below)
Not a build phase — about fifteen minutes of clicking and installing. But T1, T2 and T3
are all impossible without it, so it goes first.

**Accounts** (all free tier, no card required for this scope):
- GitHub
- Supabase — sign in with GitHub
- Cloudflare — sign in with GitHub

Signing in with GitHub for the other two keeps it to one identity.

**Local tooling:**
- Node.js 18+ and npm
- Git, authenticated to GitHub (SSH key or personal access token)
- Supabase CLI — **required**, not optional. T4 and T6 specify migration files applied
  from the repo. Pasting SQL into the dashboard instead means the schema exists nowhere in
  version control and cannot be recreated.

**Not needed:** a custom domain. Cloudflare Pages issues a `*.pages.dev` URL, which is the
link you send to friends.

**Region choice — [STRUCTURAL], cannot be changed later.** Create the Supabase project in
the region nearest your group (Mumbai or Singapore from Kerala). Changing it later means
recreating the project and re-running every migration. Wrong region is invisible in
development and shows up as sluggishness on a real phone.

**Human dependency:** T19 needs four people with four phones in the same place. That is a
scheduling problem, not a technical one, and it is the easiest item in this plan to
discover too late. Line them up before you reach Phase 5.

**Done when:** all three accounts exist, `node -v`, `git --version`, and
`supabase --version` all return, and the Supabase project is created in the chosen region.

### T1 — Repo and skeleton
Private GitHub repo. React + Vite + TypeScript. Basic folder structure.
**Done when:** `npm run dev` serves a blank app locally; first commit pushed.

### T2 — Deploy pipeline, before there is anything to deploy
Connect repo to Cloudflare Pages. Auto-deploy on push to `main`.
**Done when:** a change pushed to `main` is visible at the public URL within minutes.
**Why now:** deploying an empty app is trivial; deploying a finished one for the first
time is where a day disappears. Get the pipeline boring early.

### T3 — Supabase project + environment wiring
Create project. Wire the **anon key only** into the frontend via environment variables
(Cloudflare env vars + local `.env` that is gitignored).
**Done when:** the app makes one successful authenticated-as-anonymous call to Supabase.
**Guard:** grep the built bundle for the service-role key. It must not appear. Ever.

---

## Phase 1 — Data and access

### T4 — [STRUCTURAL] Schema
Write as a migration file in the repo (`supabase/migrations/0001_init.sql`), not clicked
into the dashboard. Implement exactly this — do not rename, drop, or "simplify" columns.

```sql
create extension if not exists pgcrypto;

-- app_users mirrors auth.users; never store passwords here
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at  timestamptz not null default now()
);

create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references app_users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table group_members (
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  blurb       text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

create table suggestion_rounds (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  opened_at   timestamptz not null default now(),
  closes_at   timestamptz not null,
  resolved_at timestamptz,
  winner_suggestion_id uuid,
  status      text not null default 'open'
              check (status in ('open','resolved','no_result','tie')),
  -- set only when status = 'tie' and the group has recorded their offline choice
  settled_suggestion_id uuid,
  settled_by  uuid references app_users(id) on delete set null,
  settled_at  timestamptz
);

create table suggestions (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references suggestion_rounds(id) on delete cascade,
  place_id    uuid not null references places(id) on delete restrict,
  added_by    uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (round_id, place_id)
);

create table votes (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  voter_id      uuid not null references app_users(id) on delete cascade,
  value         text not null check (value in ('yes','pass')),
  is_revealed   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (suggestion_id, voter_id)
);

alter table suggestion_rounds
  add constraint fk_winner foreign key (winner_suggestion_id)
  references suggestions(id) on delete set null;

alter table suggestion_rounds
  add constraint fk_settled foreign key (settled_suggestion_id)
  references suggestions(id) on delete set null;

-- a tie's recorded outcome is write-once: first record wins (D8)
create unique index one_settlement_per_round
  on suggestion_rounds(id) where settled_suggestion_id is not null;

create index on group_members(user_id);
create index on suggestions(round_id);
create index on votes(suggestion_id);
create index on suggestion_rounds(group_id, opened_at desc);
```

**Load-bearing details — changing any of these breaks a later task:**
- `unique (suggestion_id, voter_id)` — this is what makes S3's "count must not double" a
  database guarantee. Vote writes use `on conflict (suggestion_id, voter_id) do update`.
- `is_revealed` lives on the **vote row**, owned by the voter. It must never migrate to
  `groups` or `group_members` as a group-wide setting.
- `on delete cascade` from `app_users` to `votes` is what makes T15 (account deletion)
  work without orphans.
- `suggestion_rounds` is a real table, not a column on `groups`. History is the future
  recommendation engine's input.
- `settled_*` columns record what the group chose offline after a tie (D8). `settled_by`
  and `settled_at` exist so a wrong entry is traceable, since v1 has no correction path.

**Done when:** migration applies cleanly to an empty database, and re-running it from
scratch produces an identical schema.

### T5 — Auth
Supabase Auth. Email magic link (no passwords to store or reset).
**Done when:** a real second person on a real second device can sign in and stay signed in.

### T6 — [STRUCTURAL] Row-level security policies
Second migration (`0002_rls.sql`). Enable RLS on **every** table — new Postgres tables are
unprotected by default, and that default is the most common way projects like this leak.

```sql
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
```

**The reveal rule cannot be a row policy.** The row must stay readable (it counts toward
the tally) while the *identity* stays hidden. Hiding the row would break the count. So the
client reads a view, never the table:

```sql
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
```

**The frontend must query `votes_visible`, never `votes`.** Querying the base table returns
real voter ids to every group member and silently breaks the promise in Section 4 of the
brief. Add this as a lint rule or a code-review checklist item.

**Done when — all four of these pass, run as deliberate attacks from a console using the
anon key, not through your UI:**
1. A member of Group A selecting Group B's rows gets **zero rows** — not an error, zero rows.
2. Selecting `votes_visible` for someone else's unrevealed vote returns the row with
   `voter_id` null.
3. Flipping `is_revealed` to true on that vote makes `voter_id` appear.
4. Attempting to update another user's vote row fails.

An RLS policy you have not attempted to break is a policy you have not tested. This task
carries the entire privacy promise — budget real time for it.

### T7 — Seed data
One group, four members, one round, four hardcoded places matching the mockup.
**Done when:** the deck's content comes from the database, not a JS array.

---

## Phase 2 — The core loop

### T8 — Swipe deck UI
Port the existing mockup's card deck to React. Drag gestures, yes/pass, buttons as
accessible fallback.
**Done when:** it works with touch on a real phone, not just a mouse in a desktop browser.

### T9 — Vote writes
A swipe writes a vote row. Idempotent — swiping the same card twice does not create two rows.
**Done when:** votes appear in the database and the unique constraint holds under a
deliberate double-submit.

### T10 — Aggregate vote display
Show "3 of 4 already in". Never who.
**Done when:** the network response itself contains no other member's identity — check the
payload, not the rendered UI.

### T11 — Realtime sync
Supabase realtime subscription on votes for the current round.
**Done when:** two phones side by side; a vote on one moves the counter on the other
within a second, no refresh. **This is S1.**

### T12 — Winner resolution
Implements D6 (see DECISIONS.md). Do not invent alternative rules.

- Resolve when every member has voted on every suggestion, **or** `closes_at` passes.
- At timeout, require ≥2 voters; otherwise set status `no_result`.
- Single highest yes-count → status `resolved`, that suggestion is the winner.
- **An actual tie is never broken automatically** → status `tie` (see T12b).

Resolution must be **deterministic** — the same data always yields the same outcome on
every device. No randomness anywhere in this path.

**Done when:** all four devices show the same winner, and a forced tie in seed data
produces status `tie` on every device rather than four different winners. **Completes S1.**

### T12b — Tie settlement
Implements D8. When a round is `tie`, the app shows the tied options and asks the group to
settle it between themselves, then record what they went with.

- **Anyone in the group can record it. First record wins** — the unique index in T4
  enforces write-once at the database, not just in the UI.
- A **confirmation step** is required before writing ("Record Copper Ridge as what the
  group went with?"). v1 has no correction path, so a mis-tap is permanent.
- Store `settled_by` and `settled_at` so a wrong entry is traceable.

**Done when:** a tied round can be settled from any member's device; a second attempt from
another device is rejected by the database rather than overwriting; and the recorded
outcome is visible to the whole group.

## Phase 3 — The promises

### T13 — Per-vote reveal
Voter can attach their name to their own vote. One-time permanence nudge on first use.
**Done when:** **S2 passes** — a revealed vote shows the name, an unrevealed one from the
same user in the same round stays anonymous, and no other member can trigger either.

### T14a — Concurrent writes
Two members vote on the same suggestion simultaneously.
**Done when:** vote rows use `on conflict (suggestion_id, voter_id) do update`; a
deliberate double-submit from two tabs produces exactly one row per voter and a tally that
does not double.
**Note:** if this fails, the fix belongs in T4's unique constraint — not a patch here.

### T14b — Optimistic UI with rollback
A swipe updates the local view immediately, then reconciles with the server response.
**Done when:** a swipe against a deliberately failing write visibly reverts, rather than
leaving a phantom vote on screen.

### T14c — Reconnect and refetch
On losing and regaining connection, the client re-establishes its realtime subscription
**and refetches current state** — a resubscribe alone leaves it stale, since events missed
while offline are gone.
**Done when:** with devtools set to offline, swipe, wait for another device to vote, then
go back online. The reconnecting client shows correct current state, and the count never
goes backwards. **These three complete S3.**

### T15 — Account deletion
User can delete their account; their votes go with it (cascade).
**Done when:** deletion leaves no orphaned rows referencing that user.

---

## Phase 4 — Operational debt (v1 work, not "later")

### T16 — Keep-alive
Scheduled GitHub Action pinging Supabase to defeat the 7-day auto-pause.
**Done when:** the Action has run on schedule at least twice, verified in the run log.

### T17 — Backups
Scheduled GitHub Action dumping the database to external storage.
**Done when:** a dump has been **restored** into a scratch database. An untested backup
is not a backup.

### T18 — Error visibility
Minimal error surface: failed writes are logged somewhere you will actually look, and the
user sees a real message rather than a silently dead swipe.
**Done when:** a deliberately broken write produces both a visible message and a log entry.

---

## Phase 5 — The finish line

### T19 — Live four-device test
You and three friends, four phones, one deck, one winner, no refresh.
**Done when:** it works on the first attempt with people who have not seen the app before.
This is the definition of done from the brief. Nothing after this is v1.

---

## Explicitly not in v1
Multiple groups in the UI · recommendation engine · notifications · headcount
confirmation · visual polish beyond the mockup.

The schema supports all of them. The UI ships none of them.

## Note on autonomous implementation
T4, T6, T12 and T14a-c contain literal SQL and explicit rules because they were the
tasks most likely to be silently improvised by an implementer filling gaps. Where this
plan gives exact code, use it verbatim. Where a decision seems missing, stop and ask —
do not invent one.

## Carried debt
Kill gate unrun (see KILL.md) · iOS push unsolved · suggestion generation undesigned.
