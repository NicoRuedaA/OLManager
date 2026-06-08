# Youth / Academy — Known Problems & Technical Debt

## P1 — Academy player OVR is deterministic with narrow range

**Problem:** Every academy player's OVR is `60 + hash(name) % 11`, giving a
fixed range of 60–70. There's no OVR variety — no standout prodigies (75+),
no weak links (below 60). Every academy player is essentially the same
strength.

**Fix:** Use a wider OVR distribution (e.g. 55–78) with weighted probability
(bell curve around 65, rare high-end talents).

---

## P2 — Potential is uninteresting

The 15% elite / 85% normal split with a capped 90 max means most academy
players have potential 75–83 and a rare few hit 84–90. Combined with P1's
flat OVR, the "diamond in the rough" feeling is missing.

**Fix:** Widen ranges and add rare "generational talent" prospects (potential
91–95, OVR 65–72).

---

## P3 — No academy staff

Academy teams have no coaching staff. Players develop (or don't) based on
the **main team's** staff effects. There's no "academy coach" role or
separate training configuration for academy players.

**Fix:** Add academy-specific staff slots (Academy Coach, Academy Scout) with
their own effect computation.

---

## P4 — Academy games not simulated

Academy teams don't play matches. Players only improve through training.
There's no academy league simulation, no match experience for academy players.

**Fix:** Simulate academy league fixtures in background (separate competition
data or simplified results).

---

## P5 — Demoted players keep main roster wage

When a player is demoted to the academy, their wage stays the same. Combined
with the academy having `finance = 0`, the parent team still bears the full
cost with no benefit.

**Fix:** Apply wage reduction on demotion (e.g. 50%) or waive the wage while
in academy.

---

## P6 — Academy acquisition has no budget check

The cost (100K + reputation×40K + dev_level×20K) can reach 500K+. The
acquisition flow checks `team.finance >= cost` but doesn't consider the
impact on wage budget or transfer budget separately.

**Fix:** Show acquisition impact on all budgets before confirming.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | OVR range too narrow (60–70) | Small |
| P2 | Potential distribution flat | Small |
| P3 | No academy staff | Large |
| P4 | No academy match simulation | Large |
| P5 | Demoted players keep full wage | Small |
| P6 | No budget breakdown before purchase | Small |
