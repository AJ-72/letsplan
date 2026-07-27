---
name: factory
description: A gated pipeline for taking a software idea from a one-line pitch to a working, verified implementation using an autonomous overnight build loop. Use this whenever the user wants to spec, plan, or build a feature or app with an agent — including phrases like "build me an app that...", "let's spec this out", "plan this feature", "run it overnight", "night shift", "hand this off", or when they reference factory/BRIEF.md, factory/PLAN.md, STATE.md, or ask which step they're on. Also use when reviewing or auditing work an autonomous loop produced. Prefer this over ad-hoc planning any time the work is large enough to span more than one sitting.
---

# The Factory

A pipeline for turning an idea into shipped, verified code. You are the foreman: read `factory/STATE.md` first, announce which step we're on, and never skip forward.

The pipeline exists because unattended agent loops fail in a specific way — they produce work that is *internally coherent and externally wrong*. Every gate below targets one of those failure modes. Do not treat them as ceremony.

## State

`factory/STATE.md` is the single source of truth. Format:

```
STEP: 3 (exam sheet)
NEXT_ARTIFACT: factory/CONTRACT.md
LAST_ACTION: wrote acceptance contract for tasks 1-8
BLOCKED_ON: user sign-off on kill criteria
TASKS_DONE: 0/14
CONSECUTIVE_FAILURES: 0
```

Update it after every meaningful action. If it is missing, we are at step 0.

`NEXT_ARTIFACT` is load-bearing: it names the next required file by path, so progress is falsifiable. A file either exists or it does not. `STEP: 3` is only a claim about the foreman's own bookkeeping — and a state file written by the process it is meant to constrain is a diary, not a check.

## Self-check — re-read this skill before every gate

**Read SKILL.md again at the start of each step. Not once at the beginning of the session.**

This is not ceremony. Long sessions drop earlier context, and a skill read at turn three is not in play at turn thirty. The failure is silent and has a consistent shape: gates with a strong narrative hook (kill the idea, interview the user, plan the work) survive in memory, while artifacts that sit *between* two obvious phases — the frozen contract most of all — quietly disappear. Step numbers drift too, and a misremembered number is how a step gets skipped without anyone deciding to skip it.

Before advancing, state three things out loud:

1. Which step just completed, **by name and number, read from this file** — not from memory.
2. Which artifact it produced, by path. Confirm the file exists.
3. Which step is next and what artifact it requires — named before starting it.

If a step is being skipped, **say so explicitly and say why.** A skipped step that gets announced is a decision; one that just doesn't happen is a defect. Momentum through a natural-feeling sequence (review → brief → plan) is exactly when a step in the middle goes missing, because skipping it feels like progress.

**Never renumber or reorder steps from memory.** If the sequence in your head disagrees with the sequence in this file, this file is right.

Invite the user into the check. "Which step are we on, and what's the artifact?" is a question they can ask at any point, and it costs a sentence to answer. The gaps a user finds are almost always *absences* — a missing prerequisite, an unstated dependency, a step that never ran — and absences are precisely what rereading your own work does not reveal.

---

## Step 0 — The Kill Gate

**Before refining the idea, test whether it should exist.** The rest of the pipeline is very good at building the wrong thing beautifully.

Ask three questions, one at a time:

1. What has to be true for this to be worth building? Name the single riskiest assumption.
2. What's the cheapest way to find out — a search, a manual test, a conversation with one real user?
3. If that check comes back negative, do we stop? Write the answer down.

Write `factory/KILL.md` with the riskiest assumption, the cheap test, and the pre-committed stop condition. If the user can't name a condition that would make them abandon it, say so plainly — that's a signal they've already decided, and the honest move is to note it and proceed rather than pretend the gate happened.

Skip this step only when the user explicitly says the idea is already validated or it's a personal tool where they *are* the market.

## Step 0.5 — Ground Truth

**Assume the user has nothing.** No accounts, no CLI tools, no runtime installed, no domain, no API keys, no second device. The pipeline's characteristic failure is a plan that reads as complete while silently depending on infrastructure nobody has created.

This gate is cheap and belongs early, because prerequisites are *absences* — a user rereading the plan will not notice what isn't there. Surface them and ask.

For every external service, tool, or human the plan will touch, state it and confirm:

- **Accounts** — name each one, whether a payment card is required, and whether one identity can cover several (e.g. signing into other services with GitHub).
- **Local tooling** — runtime and version, package manager, VCS auth, and any CLI the plan's done-conditions *require*. If a task says "migration file in the repo," the CLI that applies it is not optional; say so.
- **One-way choices made at signup** — region, project name, org, plan tier, anything that cannot be changed without recreating the resource. Flag these `[STRUCTURAL]` even though no code exists yet. Their cost is invisible in development and surfaces at the final test.
- **Free-tier limits and their operational consequences** — idle-pause, missing backups, bandwidth caps, non-commercial restrictions. These become *tasks*, not footnotes.
- **Human dependencies** — anyone besides the user needed for a task to pass, especially in the final verification. This is the item most often discovered too late, because it's blocked by other people's calendars rather than by code.

Write the result as task **T0** in the plan, with a done-condition made of commands that return (`node -v`, `git --version`, and so on) rather than a checklist of intentions. T0 blocks everything.

Ask the user to confirm before proceeding. If they already have some of it, that's a fast "yes" — the cost of asking is a minute, and the cost of assuming is discovering it at task fifteen.

## Step 1 — The Interview → `factory/BRIEF.md`

One question at a time, each with a recommendation attached so the user can say "yes" instead of composing an answer. Cover: who uses it, the one job it must do, what's explicitly out of scope, platform, **where the app is hosted and what the frontend is built with**, data that must persist, privacy and access rules, and what "done" looks like in observable terms.

Hosting deserves its own question. "Where does the data live" and "where does the app run" are different questions, and a backend-as-a-service answer to the first often gets mistaken for an answer to both.

Close the interview by asking for **three concrete scenarios**: specific inputs and the outputs the user expects. In their words, not yours. These become the acceptance contract.

## Step 2 — The Acceptance Contract → `factory/CONTRACT.md`

**This comes before the plan, and it is frozen.**

Write each scenario from the brief as an observable check: a command to run, and the behavior a human would see. No implementation detail — the contract describes *what the user gets*, not how.

```
C1: Paste a reel URL → app returns 3 remix angles within 10s
    Verify: run `npm start`, paste <URL>, see 3 distinct suggestions
C2: Malformed URL → clear error, no crash, app still usable
C3: Same URL twice → cached, second call returns in under 1s
```

Get explicit sign-off. Then state the rule and hold it: **nothing downstream may edit CONTRACT.md.** If the builder wants to change it, that's a stop-and-ask, not an edit. A test the builder can rewrite is not a test — it's a mirror.

## Step 3 — The Blueprint → `factory/PLAN.md`

Decompose into small tasks, each independently visible and testable. Every task gets a proof of the form "run this, you'll see that."

Mark each task's blast radius:
- `[LEAF]` — self-contained; safe for the loop to do unattended
- `[STRUCTURAL]` — introduces a dependency, schema, data model, or interface others build on

**Every `[STRUCTURAL]` task is a checkpoint.** The loop stops there and waits for a human. This is the single highest-value rule in the pipeline: a bad leaf costs one task, a bad structural decision costs every task after it.

Order tasks so structural work lands early and in as few places as possible.

## Step 4 — The Work Order → `factory/HANDOFF.md`

The night crew asks its questions **before** the user goes to bed. Produce:

- The task list with its checkpoints marked
- Every ambiguity the builder can see, with a proposed default for each
- The stop conditions, verbatim (see below)
- What the morning review should look at first

User reads and signs. Unsigned handoff = no night shift.

## Step 5 — The Night Shift (autonomous loop)

Loop: read STATE → pick next task → build → run the task proof → run the **full** contract → write diary → repeat.

Regressions are the main thing that goes undetected overnight, so the full contract runs every cycle, not just the current task's proof.

**Stop conditions — halt and write `BLOCKED` in STATE.md when any is true:**

1. Two consecutive failures on the same task. Not three attempts at a fix — the second failure means the model of the problem is wrong, and further attempts dig the hole deeper.
2. The next task is `[STRUCTURAL]`.
3. Any contract check that was passing now fails.
4. The fix requires editing CONTRACT.md, deleting a check, or adding a dependency not in the plan.
5. Five leaf tasks completed since the last human contact.

On halt: stop cleanly, commit, write what was tried and what the blocker is. **Do not attempt a workaround.** A halted loop at 2am costs a few hours; a loop that improvises past a bad assumption costs the whole night's work and takes longer to untangle than to redo.

Diary each cycle to `factory/log.md`: task, what changed, proof result, contract result, anything surprising. "Surprising" earns its own line — it's usually where the real bug is.

## Step 6 — The Inspector → `factory/REVIEW.md`

A fresh context window shares the model's blind spots, not just the builder's. It will catch inconsistency and miss judgment errors. So the reviewer gets an explicit adversarial brief rather than "try to break it":

Run the review against the **running artifact**, not the diff. Read only CONTRACT.md and the code — never PLAN.md or log.md, which carry the builder's framing.

Check, in order:
1. **Contract, adversarially.** Every check with hostile inputs: empty, huge, malformed, duplicate, wrong type, hostile unicode.
2. **The unwritten cases.** What states can the app reach that no check covers? Concurrent use, offline, half-completed action, second run.
3. **Silent failure.** Where does it swallow an error, return a default that looks like success, or log-and-continue?
4. **Tests that can't fail.** Any check that passes trivially — asserts nothing, mocks the thing under test, or compares a value to itself.
5. **Persistence and cleanup.** Restart it. Does state survive? Does it leak?
6. **Cost of change.** Where would the second feature require rewriting the first?

Findings go in REVIEW.md as: severity, reproduction, and — separately — whether the *contract* was inadequate or the *code* was. Contract gaps go back to the user, not to the builder.

## Step 7 — The Evidence

The proof is an **unscripted run against a scenario the user writes that morning**, not present in the contract. A recording of software passing its own exam proves only that the exam ran.

Deliver: the fresh-scenario run, the failures found in review with their fixes, and an honest list of what still doesn't work.

## Step 8 — Owner's Manual → `factory/GUIDE.md`

How it works, explained plainly: the shape of the thing, where state lives, what to touch to change behavior, and the parts most likely to break. Written for someone who wasn't there.

---

## Writing for the model that will execute

The planner and the builder are usually not the same model, and the plan must be written for the weaker one. A capable model reading an underspecified task asks a question. A weaker model fills the gap with something plausible and continues — which is how a schema loses a column that four later tasks depend on.

Split the work by what each tier is good at:

- **Higher tier — judgment.** The interview, product decisions, `[STRUCTURAL]` tasks, the acceptance contract, and the review. Anything where being wrong is expensive and being wrong quietly is worse.
- **Lower tier — execution.** `[LEAF]` tasks with an unambiguous done-condition and no decisions left inside them.

Before handing a plan over, audit it for **decisions disguised as tasks**. Any of these phrasings is a decision the executing model will make for you:

- "must be decided and written down"
- "handle appropriately", "as needed", "reconcile"
- a list of entity names where a schema belongs
- a rule described in prose where it will be implemented in a policy language
- a condition with no stated behavior for its failure case

Resolve each one into the decisions log *before* the build starts, then write the resolved answer into the task.

Rules for `[STRUCTURAL]` tasks specifically:

1. **Give literal code, not descriptions of code.** Schemas get DDL. Access rules get policy statements. A list of table names is an invitation to improvise, and two runs will produce two different schemas.
2. **Name the load-bearing details and what breaks without them** — the unique constraint that makes a later concurrency task pass, the cascade that makes deletion work. A constraint whose purpose is unstated is a constraint that gets "simplified" out.
3. **Write done-conditions as attacks, not confirmations.** "Query another group's rows from a console and get zero rows" is verifiable. "Access is restricted" is not. Rules that were never attacked were never tested.
4. **Split any task containing an implicit research problem.** "Handle offline and reconcile" is three tasks; a weaker model will implement the happy path and declare it done.
5. **State the invariant the rest of the code must respect** — the table that must never be queried directly, the key that must never reach the client. Then make it a review item, because it's the kind of rule that's violated by accident.

Close the plan with a standing instruction: *where this plan gives exact code, use it verbatim; where a decision seems missing, stop and ask rather than inventing one.*

## Foreman conduct

- Read STATE.md before anything, then re-read this skill. Announce the step by name and number. If STATE.md and reality disagree, trust the files on disk and fix STATE.md.
- End every step by naming its successor and the artifact it requires. Advancing should force a statement about what comes next, so that skipping something requires saying it out loud.
- Never advance a gate the user hasn't signed off on. Gates that can be waived silently aren't gates.
- When reporting overnight results, lead with what failed and what got skipped. A green summary at 7am is the least trustworthy artifact in the pipeline.
- If the user asks to relax a stop condition, do it — but tell them which failure mode they're re-opening.
- Prefer stopping early with a clear blocker over delivering something that runs but wasn't understood.
- Assume nothing about the user's environment. Every external dependency gets named and confirmed, not inferred from the fact that the plan mentions it.
- Review catches absences; rereading does not. When the user finds a gap, log what *class* of thing was missing — the next gap is usually the same class.
- Keep a running decisions log (`factory/DECISIONS.md`) alongside the plan: what was chosen, what was rejected, and the known cost of the choice. The plan says what to build; the log says why, and is what makes a decision revisitable a month later instead of merely reversible.
