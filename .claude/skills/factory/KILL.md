# KILL.md — Step 0 (Kill Gate)

**Status: SKIPPED — deliberately, by the user.**

## Why skipped

The user reframed Let's Plan from a venture-track product into a **hobby / learning project**.
Explicit decision: *"am building it anyway. To learn how to build."* Monetization is off the table.

Under the factory rules, the kill gate is skippable when the user is the market and the
build is a personal tool. That applies here: the user's own friend group is the intended
(and only) user base, and the payoff being optimized for is **learning the stack**, not adoption.

## What was surfaced before skipping

The gate was partly run before being waived. Recorded for the record:

- **Riskiest assumption (agreed):** the group keeps responding to weekly suggestion decks
  past week 3–4. Retention of the *behavior*, not the tech, is what would kill the product idea.
- **Second assumption (user-added):** enough of the group actually joins the app in the
  first place. Noted as a distinct failure mode — adoption can be brute-forced by personally
  recruiting friends; retention cannot.
- **Cheapest test (proposed, not run):** four weeks of manual suggestion decks in the existing
  group chat, votes by emoji reaction. Zero code.

## Stop condition

**None.** There is no result that stops this project — that is the intended consequence of
treating it as a learning build. If the group abandons it in week 3, the build still succeeded
on its own terms.

Consequence to be aware of, stated plainly: no signal gathered from here on is
evidence about the *product*. Success means the user learned the stack and shipped
something working. Product-market questions are explicitly out of scope.

---

## Amendment — build standard raised

The user has since clarified: although this is a hobby build with no current monetization
plan, it must be **built to a monetizable standard**. Nothing may be skipped or hand-waved
on the grounds of "it's just a hobby project" — if a decision would matter for a product
that takes money, it gets raised, decided, and recorded.

In practice this means every later gate is run in full, and these get treated as real
rather than deferred: data model and schema design, auth and account identity, privacy
and data handling (this app stores social graphs and location-adjacent data), cost per
active group, error handling and observability, and migration cost of early decisions.

**Open gap, stated honestly:** the kill gate itself remains skipped. That is now the one
place where this project does *not* meet a monetizable standard. It is skipped by choice
and by a valid rule (user is the market), but if monetization is ever revisited, the
four-week manual retention test in the section above is the unpaid debt to settle first.
