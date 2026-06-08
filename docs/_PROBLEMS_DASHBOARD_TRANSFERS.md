# Transfers — Known Problems & Technical Debt

## P1 — transfers.rs is a 3009-line monolith

**Problem:** All transfer logic lives in a single file. Bid submission,
counter-offers, wage negotiation, AI offer generation, free agent signings,
AI-to-AI transfers, execution, and contract release are all mixed together.

**Fix:** Split into:
- `transfers/bidding.rs` — fee negotiation, counter-offers
- `transfers/wages.rs` — wage negotiation
- `transfers/ai.rs` — AI offer generation, free agent signings
- `transfers/execution.rs` — transfer completion, lineup reconciliation
- `transfers/mod.rs` — orchestrator

---

## P2 — No tests for negotiation logic

Minimum acceptable fee, wage acceptance score, counter-offer thresholds,
tension/patience mechanics — all untested. The negotiation system is the most
complex AI interaction in the game with zero coverage.

**Fix:** Add parameterized tests for each formula with edge cases.

---

## P3 — Tension/patience values are magic numbers

```rust
const FEE_TENSION_BASE: u8 = 34;      // +16 per round
const FEE_PATIENCE_BASE: u8 = 82;     // -18 per round
const WAGE_TENSION_BASE: u8 = 30;     // +18 per round
const WAGE_PATIENCE_BASE: u8 = 85;    // -20 per round
```

Why 34? Why +16 vs +18? Why 82 vs 85? No documentation explains the
calibration or intended behavior.

**Fix:** Named constants with doc comments explaining design intent.

---

## P4 — Budget reallocation % is global

`TRANSFER_BUDGET_SELLING_REALLOCATION_PCT = 60` means every sale puts 60% of
the fee back into the transfer budget. This is a global constant — all teams,
all leagues, all situations use the same value.

**Fix:** Make reallocation % team-specific (board policy) or league-specific.

---

## P5 — No bidder reputation affects price

The fee negotiation doesn't consider the buying team's reputation. A
world-famous organization and a relegation-tier team pay the same price.

**Fix:** Add buyer reputation modifier to `minimum_acceptable_fee()`.

---

## P6 — Player swap valuation is opaque

`calculate_player_offer_value()` uses `market_value × age_mult × pot_mult`
but the multipliers are undocumented. Users see a player "included" in the
deal but can't tell how their value was calculated.

**Fix:** Show swap player valuation breakdown in the bid modal.

---

## P7 — AI transfer logic has no tests

AI teams buying from AI teams (`line 884`), free agent signings, and
squad-balancing logic all run every day with zero test coverage.

**Fix:** Add integration tests for AI transfer scenarios.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | 3009-line monolith | Large |
| P2 | No negotiation tests | Large |
| P3 | Tension/patience magic numbers | Small |
| P4 | Budget reallocation global | Small |
| P5 | No buyer reputation in pricing | Medium |
| P6 | Player swap valuation opaque | Small |
| P7 | AI transfer logic untested | Large |
