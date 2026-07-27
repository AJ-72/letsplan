# Let's Plan

A mobile-first web app where a group swipes on suggested places and sees a shared winner
appear live. Hobby build, held to a monetizable-product standard — nothing is skipped or
softened on the grounds that it is "just for learning."

## Before doing anything

1. Read `factory/STATE.md`. It names the current step and the next required artifact.
2. Read `.claude/skills/factory/SKILL.md`. Re-read it at the start of each step, not once
   per session — long sessions drop context and steps go missing silently.
3. Announce which step we are on before writing any code.

## Working rules

- `factory/PLAN.md` and `factory/DECISIONS.md` are not edited without asking. If the plan
  seems wrong, stop and say so — do not quietly adapt it.
- Where the plan gives exact SQL or code, use it **verbatim**. It is written that way
  because those details are load-bearing for later tasks.
- Where a decision seems missing, **stop and ask**. Do not invent one.
- Tasks marked `[STRUCTURAL]` (T0 region choice, T4 schema, T6 RLS policies) are
  checkpoints. Stop after each and wait for a human.
- Update `factory/STATE.md` after every meaningful action.

## Invariants — violating any of these is a bug, not a style choice

- The **service-role key never reaches client code.** The frontend ships the anon key only
  and relies on row-level security. Anything needing elevated privilege goes in an Edge Function.
- The frontend queries the **`votes_visible` view, never the `votes` table.** Querying the
  base table returns real voter identities to every group member and silently breaks the
  privacy promise in BRIEF.md §4.
- Vote visibility is a **per-row flag owned by the voter.** It must never become a
  group-level setting.
- Round resolution is **deterministic** — no randomness. Four devices must compute the
  same outcome from the same data.
- RLS is enabled on **every** table. New Postgres tables are unprotected by default.

## Stack

React + Vite (SPA, TypeScript) → Cloudflare Pages · Supabase (Postgres, auth, realtime,
RLS) · GitHub for source and scheduled jobs (keep-alive ping, database dumps).

## Current position

Start at **T0** in `factory/PLAN.md` — accounts, local tooling, Supabase region.
Outstanding: `factory/CONTRACT.md` has not been written (Step 2 of the pipeline was
skipped); it is owed before any autonomous build loop runs.
