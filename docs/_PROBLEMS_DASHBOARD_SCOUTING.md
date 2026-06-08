# Scouting — Known Problems & Technical Debt

## P1 — No UI feedback when scouts are unavailable

**Problem:** If all scouts are at capacity, the "Scout" button shows "No free
scouts" text. But the user has no way to see *when* a slot will open or
*which* scout to release/fire to free capacity.

**Fix:** Show next available date per scout, or estimated days until slot
opens.

---

## P2 — Scout report is one-shot, never updated

Once a scout report is delivered as an inbox message, it's static. If the
player's attributes change (via training), the report becomes stale with no
way to refresh it.

**Fix:** Add a "re-scout" option, or show a "stale report" indicator after
X days.

---

## P3 — Potential research is single-threaded with no queue

Only one player can be researched at a time globally. If the manager starts
research on a player and changes their mind, they must wait 7 days with no
option to cancel or reassign.

**Fix:** Allow cancelling research (no refund) or add a research queue.

---

## P4 — Fuzz randomization is not seeded

The noise added to reported attributes uses `rand::random()` with no seed.
This means reloading the game can produce a different report for the same
scout + player combination.

**Fix:** Seed the fuzz RNG with `scout_id + player_id + game_tick` for
deterministic reports.

---

## P5 — Scout table shows all world players

`ScoutingPlayerSearchCardV2` renders every player in `gameState.players` who
isn't on the manager's team. For large saves with hundreds of players, this is
a huge list. There's no region/league filter in the v2 tab.

**Fix:** Add competition/region filter alongside the position filter.

---

## P6 — "Already scouting" doesn't track history

`buildAlreadyScoutingIds()` only checks active assignments. Once a report is
delivered (assignment removed), the player becomes re-scoutable with no
indicator that they were already evaluated.

**Fix:** Track per-player last scout date or add a "previously scouted" badge.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | No capacity feedback | Small |
| P2 | Reports are one-shot, never refresh | Medium |
| P3 | Single-threaded research with no cancel | Small |
| P4 | Fuzz randomization not seeded | Small |
| P5 | No region filter in player search | Small |
| P6 | "Already scouted" not tracked | Small |
