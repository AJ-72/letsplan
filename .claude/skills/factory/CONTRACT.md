# CONTRACT.md — Let's Plan v1

Frozen acceptance contract. Nothing downstream may edit this file.
If the builder wants to change a check, that is a stop-and-ask, not an edit.
A test the builder can rewrite is not a test.

Derived from S1, S2, S3 in BRIEF.md. Each check is written as observable
behaviour a human can verify — no implementation detail, no "should be".

---

## C0 — Desktop browser smoke test (pre-flight before mobile)

**Purpose:** Catch auth, swipe mechanics, and live-sync issues on a single machine
before coordinating four phones. Runs entirely in a desktop browser; no phone needed.

**Setup:** One desktop browser (Chrome or Firefox). Two tabs, logged in as two
different users who are both members of the same group. One active round with
four hardcoded suggestions.

**Steps:**
1. Tab 1: sign in as User A. Verify the deck loads and all four suggestions are visible.
2. Tab 1: swipe through all four cards using mouse drag and the yes/pass buttons
   as the accessible fallback. Verify each swipe registers and the card advances.
3. Tab 2: sign in as User B. Verify User B sees the same four suggestions.
4. Tab 2: swipe one card. Switch immediately to Tab 1.
5. Tab 1: verify the vote counter on that suggestion has updated — without refreshing.
6. Tab 1: swipe the remaining cards to cast the deciding votes.

**Pass condition:**
- All four suggestions load from the database, not a hardcoded JS array.
- Mouse-drag swipe and button-tap both register a vote.
- The tally in Tab 1 reflects Tab 2's vote within one second, no refresh.
- After all votes are in, both tabs show the same winner with no refresh.

**Note:** Touch gesture behaviour on mobile is verified separately in C1.
This check is a fast gate — run it first. C1 is the definition of done; C0 is
the sanity check that makes C1 worth attempting.

---

## C1 — Live winner on all four devices (S1 core)

**Setup:** Four real phones. Four signed-in users, all members of the same group.
One active round with four hardcoded suggestions.

**Steps:**
1. Open the app link on all four phones. Each member signs in.
2. Confirm all four see the same deck (same four suggestions, same order).
3. Members 1–3 each swipe all four cards (any mix of yes/pass).
4. Member 4 swipes the last remaining card, casting the final vote.

**Pass condition:** Within one second of Member 4's swipe, all four screens show
the same winner — with no member having refreshed the page. If any screen is
stale or shows a different winner, this check fails.

This check cannot pass in a browser simulator. It requires four real phones on
the production URL.

---

## C2 — Vote payload contains no other member's identity (S1 privacy floor)

**Setup:** A round in progress. At least one other member has voted but not revealed.

**Steps:**
1. Open browser devtools (network tab) on any member's phone or desktop.
2. Let the app load or refresh its vote data.
3. Inspect the raw network response that contains vote information.

**Pass condition:** The payload for another member's unrevealed vote contains no
voter identity — no name, no user id, no email, no field that would identify who
cast it. The check is on the raw network payload, not the rendered UI. A UI that
hides an id while the payload carries it is a failing check.

---

## C3 — Reveal is per-vote and owned by the voter (S2)

**Setup:** Member A has voted yes on Suggestion 1 and passed on Suggestion 2.
Neither vote is revealed. Member B is also in the group.

**Steps:**
1. As Member A: reveal the yes vote on Suggestion 1.
   — A one-time confirmation prompt appears: this action is permanent.
2. Member A confirms.
3. Verify: Suggestion 1 now shows Member A's name on every group member's screen.
4. Verify: Suggestion 2 still shows no identity for Member A on any screen.
5. As Member B: attempt to reveal Member A's pass on Suggestion 2.
   — The action must not be available. The vote stays anonymous.
6. As Member A: attempt to un-reveal the yes vote on Suggestion 1.
   — The action must not be available. Reveal is permanent.

**Pass condition:** All six sub-steps hold. Failure on any one is a failure of this check.

---

## C4 — Concurrent writes produce exactly one row per voter (S3 idempotency)

**Setup:** Two members, both authenticated, viewing the same active round.

**Steps:**
1. Both members submit a vote on the same suggestion at the same moment
   (coordinate by count-down, or drive from two browser tabs simultaneously).
2. After both submissions complete, inspect the vote rows in the database
   for that suggestion.

**Pass condition:** Exactly one vote row exists per voter. The displayed tally equals
the actual row count. No row is duplicated; the count does not show a value higher
than the number of distinct voters.

---

## C5 — Offline member sees correct state on reconnect (S3 resilience)

**Setup:** Two devices (Device A, Device B) in the same group, same round in progress.

**Steps:**
1. On Device A, use browser devtools to set the network to offline.
2. On Device B (online), submit a vote on any suggestion.
3. Note the tally on Device B after the vote registers.
4. Restore Device A's network connection.
5. Observe Device A — without any manual refresh from the user.

**Pass condition:** Device A's tally updates to match Device B's tally.
The count must not remain at the pre-offline value (stale), and must not
go below its pre-offline value (regression). No user action required.

---

## C6 — Tie is surfaced, recorded once, rejected on second attempt (D8)

**Setup:** A round where exactly two suggestions share the highest yes-count (a true tie).
At least two members have voted. Round has resolved.

**Steps:**
1. Verify the round status on all devices: it shows "tie", not a winner, and lists
   the tied suggestions.
2. Member A records one of the tied suggestions as the group's offline choice.
   — A confirmation step appears before the record is written ("Record X as what
   the group went with?").
3. Member A confirms. The recorded outcome is visible to all group members.
4. Member B attempts to record a different tied suggestion as the outcome.

**Pass condition:** Step 4 is rejected at the database level — not just disabled in the UI.
The first recorded outcome stands. Member B sees an appropriate message.
The outcome recorded in step 3 remains visible and unchanged on all screens.

---

## Frozen rule

These seven checks are the definition of done. They may not be edited, weakened,
or replaced by the builder during the night shift. If a check is unreachable with
the current approach, the loop halts — it does not rewrite the contract to match
what was built.

If reality reveals a gap in these checks (a state the app can reach that no check
covers), that gap goes back to the user — not to the builder.
