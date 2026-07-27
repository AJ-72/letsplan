# BRIEF.md — Let's Plan (v1)

**One line:** A mobile-first web app where one group swipes on a deck of suggested
places and sees a shared winner emerge live.

**Build standard:** hobby project, monetizable-grade rigor. Nothing is skipped, softened,
or deferred on the grounds that this is "just for learning."

---

## 1. The job v1 must do

One group sees a deck of suggestions. Members swipe yes/no. Once votes are in, the app
shows a winner — live, on every member's device, without a refresh.

Real accounts from day one. Not a name field.

### Thin surface, honest foundation

**Out of scope for the v1 UI:**
- Multiple groups (schema supports many; UI exposes one)
- The learning / recommendation engine (suggestions are hardcoded)
- Notifications
- Headcount confirmation

**NOT out of scope for the v1 schema:** every one of the above must be modelled now.
Collapsing them is the migration that costs weeks later.

**Rationale:** the instructive and genuinely hard part of this build is multiplayer state
sync. Everything else is plumbing. Keep the surface small; do not let the foundation lie.

---

## 2. Platform

Mobile-first **web app**, PWA-capable. Not native.

A link beats an install — which directly attacks the adoption failure mode identified
before the kill gate was waived. Touch gestures on web are sufficient for the swipe deck
(already proven by the existing mockup). Keep a clean API boundary so a future native
client is a client-only rewrite.

**Known debt:** no reliable iOS push notifications without extra work. This bites later,
at the day-of reminder feature. Accepted knowingly.

---

## 3. Stack, hosting & persistence

### Frontend
**React + Vite, plain SPA.** Not Next.js.

The app is one authenticated screen with heavy client-side interaction and realtime
subscriptions. There is no SEO surface and no content to server-render, so Next.js's
server features would sit unused while adding concepts that are not the ones being
learned here. Vite's faster iteration loop also matters for side-project motivation.

### Hosting
| Layer | Where | Notes |
|---|---|---|
| Frontend | **Cloudflare Pages** | Deploys on git push. Unlimited bandwidth on free tier, no commercial-use restriction |
| Backend / DB / auth / realtime | **Supabase** | See below |
| Server-side logic (if needed) | Supabase Edge Functions | Avoids a third host |
| Source control + CI | **GitHub** | Single source of truth; Pages deploys from it |

Supabase hosts the backend only — it does **not** host the frontend. These are two
separate services and two separate deploy paths.

Cloudflare Pages over Vercel specifically because Vercel's free tier is non-commercial
only; Cloudflare's is not. Given the monetizable-grade standard, that avoids a forced
migration if this ever takes money.

### GitHub as more than storage
Repo is private to start. Beyond source control, GitHub carries two v1 responsibilities
that are otherwise easy to defer into never:
- **Scheduled Action for the Supabase keep-alive ping** (defeats the 7-day auto-pause).
- **Scheduled Action for database dumps** to external storage (free tier has no backups).

Secrets live in GitHub Actions secrets and Cloudflare environment variables — never in
the repo. The Supabase service-role key must never reach the client bundle; the frontend
uses the anon key and relies on row-level security for enforcement.

### Persistence
**Supabase** — managed Postgres, auth, realtime subscriptions, row-level security.

Entities required from day one, even though v1's UI shows a fraction of them:

| Entity | Why it exists in v1 |
|---|---|
| `users` | Real identity, real auth |
| `groups` | One in the UI, many in the model |
| `group_members` | Many-to-many join. One person, several groups — the product thesis |
| `places` | Suggestion targets. Coordinates live here |
| `suggestion_rounds` | First-class. "What did this group pick in March" must stay answerable |
| `suggestions` | A place offered within a round |
| `votes` | Member × suggestion, **plus a per-row visibility flag owned by the voter** |

`suggestion_rounds` being first-class is what makes the future recommendation engine a
query over history rather than a rebuild. History *is* the engine's input.

### Operational debt to handle as v1 work, not later ops

- **Auto-pause after 7 days idle.** Real hazard for a weekly-cadence app — a group that
  skips a week returns to a dead link. Needs a scheduled keep-alive.
- **No automated backups on free tier.** Needs a scheduled dump to external storage.
- Free tiers are someone else's business decision. Portable Postgres is the hedge.

---

## 4. Privacy rules (binding)

1. Votes are **aggregate by default** — "3 of 4 already in", never "Riya passed on your
   suggestion."
2. **Reveal is per-vote and owned by the voter.** A member may attach their name to their
   own vote. No group setting, admin, or other member can ever expose someone else's.
   The guarantee is unconditional and statable without asterisks.
3. **Nudge, don't block.** One-time confirmation on first reveal: this is permanent.
4. **Row-level security at the database, not the client.** Group membership is the
   access boundary.
5. **No location tracking.** Places have coordinates; users do not. Distance comes from a
   coarse city or user-entered home area — never a live GPS feed.
6. **Deletion actually deletes.** Account removal takes the user's votes with it.

**STRUCTURAL:** vote visibility is a per-row flag owned by the voting user. It must not
become a per-group setting. That substitution is a migration and a broken promise.

---

## 5. Definition of done

> You and three friends, on four different phones, can each open a link, sign in, swipe
> the same deck, and all see the same winner appear — without anyone refreshing.

Deliberately a live multi-device test, not a feature checklist. It can only pass if auth,
RLS, realtime sync, and vote tallying all work *together*. A checklist would let every box
be ticked while the app breaks the moment two people vote at once.

**Not required:** visual design beyond the existing mockup; any suggestion intelligence.

---

## 6. Scenarios

### S1 — The happy path
Riya opens the link, signs in, sees four hardcoded trail suggestions. She swipes yes on
two, passes on two. Sam is voting simultaneously on his phone. When the fourth member
votes, both screens update — without a refresh — to show Copper Ridge Trail as the winner.

### S2 — The reveal
Sam passes on a suggestion Riya proposed. Riya's screen shows "2 of 4 already in" and
nothing about who. Sam then chooses to attach his name to a *yes* vote on a different
card, sees the one-time permanence nudge, confirms — and only that vote shows his name.
His earlier pass stays anonymous forever.

### S3 — The mess
Two members vote at the exact same moment on the last remaining card. One is on a train
and loses signal mid-swipe. The vote count must not double, must not go backwards, and
when her connection returns her app must show correct current state rather than a stale deck.

S3 is the one that matters most for a monetizable standard. It is the class of bug hobby
builds discover in production.

---

## 7. Open debt carried forward

- **The kill gate was never run.** Skipped by choice under a valid rule (user is the
  market), but the four-week manual retention test in KILL.md is unpaid debt. Settle it
  before any monetization decision.
- No answer yet for how suggestions get generated once they stop being hardcoded.
- iOS push notifications unsolved — blocks the day-of reminder feature.
