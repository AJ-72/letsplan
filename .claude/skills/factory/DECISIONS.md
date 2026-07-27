# Decisions log — Let's Plan

Running record of choices made during the factory interview, with the reasoning
and the known cost of each. Kept separate from BRIEF.md so the *why* survives.

## D1 — v1 scope
**Decision:** One group sees a deck of suggestions, members swipe, app shows a winner
once votes are in. Real accounts from day one.

**Out of scope for the v1 UI:** multiple groups, the learning/recommendation engine
(suggestions hardcoded), notifications, headcount confirmation.
**NOT out of scope for the v1 schema:** all of the above must be modelled.

**Why:** the instructive part is multiplayer state sync. Everything else is plumbing.
The thin-surface / honest-foundation split keeps v1 small without foreclosing v2.

## D2 — Platform
**Decision:** Mobile-first web app (PWA-capable). Not native.

**Why:** a link beats an install, which directly attacks the adoption failure mode.
Touch gestures on web are sufficient for the swipe deck (already proven in the mockup).
A clean API boundary keeps a future native client a client-only rewrite.

**Known debt:** no reliable iOS push notifications without extra work. This bites later,
at the day-of reminder feature. Accepted knowingly, not discovered.

## D3 — Backend / database
**Decision:** Supabase (managed Postgres + auth + realtime + row-level security).

**Alternatives considered:** Firebase (NoSQL — wrong shape for a relational vote/round
model), Neon (better pure Postgres, but no bundled auth/storage; more instructive, slower
to a working demo), PocketBase (single binary + SQLite; single-server ceiling),
Appwrite (most generous free tier, smaller ecosystem), Convex (proprietary reactive model).

**Why Supabase:**
1. The data model is relational and the future recommendation engine is a *query* over
   group history. Postgres is the correct primitive; anything else migrates to it later.
2. Row-level security is the real mechanism for "Group A cannot read Group B's votes."
   For an app holding a social graph this is a requirement, not a nicety, and it is
   exactly where hand-rolled backends leak.
3. No lock-in at the data layer — the exit path is a pg_dump, not a rewrite.

**Known costs / operational debt (free tier, verified July 2026):**
- 500 MB database, 1 GB file storage, 5 GB egress, 50k MAU, 200 concurrent realtime
  connections, max 2 active projects. All comfortably sufficient for v1.
- **Projects auto-pause after 7 days of inactivity.** Real hazard for a weekly-cadence
  app: a group that skips a week returns to a dead link. Needs a scheduled keep-alive ping.
- **No automated backups on the free tier.** Bigger risk than the storage ceiling.
  Needs a scheduled dump to external storage. Treat as a v1 task, not a later nicety.
- Free tiers are someone else's business decision (cf. PlanetScale withdrawing theirs
  in 2024). Portability of the Postgres data is the hedge.
- Step up is Pro at $25/mo per project if this ever outgrows free.

## D4 — Privacy & data handling
**Decision:** Private by default, with voter-owned disclosure.

Rules:
1. **Votes are aggregate by default.** The deck shows "3 of 4 already in" — never
   "Riya passed on your suggestion." Individual rejection stays invisible unless revealed.
2. **Reveal is per-vote and owned by the voter (option A).** A member may attach their
   name to their *own* vote. No group setting, admin, or other member can expose someone
   else's vote. The privacy guarantee is therefore unconditional and statable in a privacy
   policy without asterisks.
   - Rejected (b) group-level "open voting" toggle: lets one person publicise everyone.
   - Rejected (c) group toggle + individual opt-out: opting out while others are visible
     is itself a signal, so the choice is coerced. A privacy option that is socially
     expensive to use is not really an option.
   - Degrades gracefully: a transparent group simply has everyone opt in, reaching (b)
     by consent rather than decree.
3. **Nudge, don't block.** First time a user reveals, show a one-time confirmation that
   this permanently attaches their name to that vote.
4. **Row-level security enforced at the database, not the client.** Group membership is
   the access boundary. No group's rows readable outside it.
5. **No location tracking.** Places carry coordinates; users do not. Distance is computed
   from a coarse city or a user-entered home area, never a live GPS feed.
6. **Deletion actually deletes.** Account removal takes the user's votes with it.

**Schema consequence (STRUCTURAL):** the votes table needs a per-row visibility flag
owned by the voting user, not a per-group setting. Getting this wrong is a migration.

## D5 — Frontend, hosting, source control
**Decision:** React + Vite SPA → Cloudflare Pages. Supabase for backend. GitHub for
source control and scheduled jobs.

**Why not Next.js:** one authenticated, interaction-heavy screen with realtime
subscriptions. No SEO surface, nothing to server-render. Next's server features would go
unused while adding learning surface that isn't the point of this build.

**Why Cloudflare Pages over Vercel:** Vercel's free tier is non-commercial only.
Cloudflare's has no such restriction and no bandwidth cap. Under a monetizable-grade
standard this avoids a forced migration later. (If the framework had been Next.js, Vercel
would have been the better fit — framework should drive host, not the reverse.)

**Gap this closed:** the earlier draft of the brief specified persistence but never said
where the *app* runs. Supabase does not host frontends. Caught on user review.

**Security consequence (STRUCTURAL):** the frontend ships the Supabase *anon* key and
depends entirely on row-level security for enforcement. The service-role key must never
enter the client bundle. Any logic needing elevated privilege goes in an Edge Function.

**GitHub carries two operational v1 tasks**, not just code:
- Scheduled Action: keep-alive ping (defeats 7-day auto-pause)
- Scheduled Action: DB dump to external storage (no backups on free tier)

## D6 — Round resolution rules (CONFIRMED)
Surfaced while hardening PLAN.md. The plan deferred these to the implementer, which for
an autonomous agent means "the agent decides." Resolved here instead.

**When does a round resolve?** When every member of the group has voted on every
suggestion in the round, OR when the round's `closes_at` timestamp passes — whichever
comes first. A quorum rule is required because otherwise one silent member freezes the
group forever.

**Minimum quorum at timeout:** at least 2 members must have voted, else the round
resolves as "no result" rather than picking a winner off one person's opinion.

**Ties are NOT broken automatically.** Superseded by D8 below — a tie is information
(the group liked two things equally), not a problem to resolve silently. Highest yes-count
still wins outright; only an actual tie goes to D8's flow.

**Rejected:** random tie-break (non-deterministic across clients — four devices could
compute different winners, which fails the definition of done), earliest-first-yes
(rewards being fast, a design opinion nobody asked for), and "creator decides"
(adds a role concept v1 does not have).

## D8 — Tie handling: settle offline, record in app
**Decision:** on a tie, the round enters status `tie` and stores the tied suggestion ids.
The app tells the group to settle it themselves, then asks them to record what they chose.

**Why not auto-resolve:** picking one silently discards real signal. Why not a runoff or
multi-day scheduling in v1: a runoff needs a second round state and its own tie rule;
"do both on different days" needs a scheduling layer v1 does not have at all.

**Why recording is mandatory, not optional:** an unrecorded tie leaves history saying
"tied, outcome unknown", which teaches the future recommendation engine nothing — and the
offline decision is exactly the signal most worth learning from.

**Who records it (option A):** anyone in the group. First record wins. No correction path
in v1.
- Rejected (b) anyone-can-change-until-locked and (c) admin-only. (c) would require a role
  system and its own RLS surface.
- **Known risk, accepted:** a mis-tap is permanent and pollutes history; the only fix is a
  manual database edit. Mitigated by a confirmation step before the record is written.
- Recording also captures *who* recorded it and when, so a wrong entry is at least traceable.

## D7 — How conditional voter identity is enforced
The per-vote reveal rule cannot be expressed as a plain row policy: the row must remain
readable (it counts toward the tally) while the *voter identity* stays hidden. Hiding the
whole row would break the count.

**Decision:** base table `votes` is not read directly by the client. Clients read a view
that returns `voter_id` only when the vote is revealed or belongs to the requester, and
`NULL` otherwise. RLS on the base table still restricts to group members — the view
narrows further, it does not replace the policy.

**Consequence:** the frontend must never query `votes` directly. Doing so returns real
voter ids to group members and silently breaks the privacy promise.


## D9 — Prerequisites and region
Surfaced on user review: the plan assumed GitHub, Supabase and Cloudflare accounts already
existed. They did not. Added as T0, a hard blocker before T1.

**Accounts:** GitHub, Supabase, Cloudflare — all free tier, no card needed at this scope.
Supabase and Cloudflare both sign in with GitHub, keeping it to one identity.

**Supabase CLI is required, not optional.** T4 and T6 specify migrations applied from the
repo. Clicking schema into the dashboard leaves it outside version control and
unreproducible — which breaks the "re-runs from scratch" done-condition on T4.

**Region (STRUCTURAL):** Mumbai or Singapore, nearest the user in Kerala. A Supabase
project's region cannot be changed after creation; changing it means recreating the
project and re-running all migrations. The cost of getting it wrong is invisible locally
and only appears as latency on real phones — i.e. at the definition-of-done test.

**No custom domain needed.** Cloudflare Pages issues a `*.pages.dev` URL, which satisfies
the "send a link" adoption strategy from D2.

## D10 — T6 verification deferred to after T7
The four RLS attack checks in T6's done-condition require rows in the database to attack.
The migration applies cleanly to an empty database, but the verification proof does not —
you cannot assert "Group A sees zero of Group B's rows" when neither group has rows.

**Decision:** apply T6's migration in order (before seed data exists), defer the four
verification attacks to immediately after T7. T6 is not marked done until the attacks pass.

**Class of gap:** verification dependency ≠ build dependency. The plan conflated them.
For future tasks: if a done-condition says "run X against Y", check whether Y exists at
the point the task runs. An autonomous loop would have blocked or silently skipped here.

**Human dependency noted:** T19 requires four people and four phones simultaneously. It is
the only task in the plan blocked by other humans' calendars rather than by code.
