# Transfers — Architecture & Usage

## Overview

The transfer system handles buying and selling players between teams. It
includes fee negotiation (multi-round with counter-offers), wage negotiation,
player-exchange deals, free agent signings, and AI-generated incoming offers.
Transfers run during transfer windows and integrate with finances, morale,
squad registration, and news generation.

---

## Data flow

```
MAKING A BID:
  make_transfer_bid(game, player_id, fee, included_players)
    → Guards: window open, max 2 swap players, not own player, budget OK
    → minimum_acceptable_fee():
        market_value × multiplier (0.55–1.6)
        adjusted for: transfer_listed, contract expiry, morale, openness
    → Compare fee to threshold:
        ≥ adjusted_threshold → ACCEPTED + wage negotiation starts
        ≥ counter_floor → COUNTER_OFFER with suggested fee
        < counter_floor → REJECTED (terminal)

COUNTER-OFFER:
  counter_offer(game, offer_id, requested_fee)
    → Must exceed current fee
    → Compare to ceiling (suggested_fee × 1.2, capped by buyer budget)
        ≤ ceiling + margin → ACCEPTED → wage negotiation
        ≤ counter_window → COUNTER_OFFER (higher suggested fee)
        > counter_window → REJECTED

WAGE NEGOTIATION:
  negotiate_player_wage(game, offer_id, wage_offered, years)
    → calculate_wage_acceptance_score()
        % increase (0–55 pts) + free agent (+25) + morale (+10) + ...
    → ≥ 50 → ACCEPTED → execute_transfer()
    → round ≥ 4 AND score < 40 → REJECTED (terminal)
    → else → COUNTER_OFFER (10–45% more)

EXECUTION:
  execute_transfer()
    → player.team_id = new_team
    → clear transfer_listed, loan_listed
    → set can_be_transferred_until (next split)
    → payer: deduct fee from finance + transfer_budget
    → seller: add fee to finance, 60% to transfer_budget
    → reconcile lineups (both teams)
    → ensure_academy_roster_continuity() if academy player sold
    → generate news if fee ≥ 1M or value ≥ 1M
    → record in transfer_history
```

---

## AI-generated incoming offers

Called daily during transfer windows:

```
generate_incoming_transfer_offers(game)
  → Rate limits: 2/day total, 2/buyer/week, 14d team cooldown
  → Eligibility: transfer_listed OR low morale OR short contract
  → Scoring:
      base 8
      +30 if transfer_listed
      +40 if contract ≤ 60 days
      +20 if market_value ≥ 1M
  → Fee suggestion: market_value × [0.42, 1.0] (deterministic jitter)
```

---

## Fee negotiation formula

```
minimum_acceptable_fee(player):
  multiplier = 0.8 (listed) / 1.2 (not listed)
  - contract_expiry_reduction (up to -0.25 if ≤ 60 days)
  + importance_bonus (+0.2 key, +0.1 regular, +0.0 fringe)
  - morale_penalty (-0.05 if ≤ 40)
  - openness_reduction (-0.20 if ≥ 60, -0.10 if ≥ 40)
  clamped [0.55, 1.6]

effective_threshold = market_value × multiplier
  - total_included_player_value
  - round_concession (grows with each round)
```

---

## Wage negotiation formula

```
calculate_wage_acceptance_score(offer, player):
  core = %_increase over current wage → 0–55 points
  +25 if free agent
  +15 if academy player
  +20 if transfer_listed
  +18/+10/+5 if contract expiring in ≤30/≤60/≤90 days
  -3 for 3yr, -6 for 4-5yr contract length
  +10 if low morale, -3 if high
  +8 if young, +3 if veteran
```

Outcomes:
- ≥ 50 → **Accepted** (may warn if over budget)
- Round ≥ 4 AND < 40 → **Rejected** (terminal)
- ≥ 25 → **Counter** (10–25% more)
- < 25 → **Counter** (15–45% more)

---

## Contract release

```
release_player_contract(player):
  penalty = remaining_salary × 40%
  → deducted from team finance + season_expenses
  → player becomes free agent (team_id = None, wage = 0)
  → all transfer offers cleared
```

---

## Transfer windows

Transfer activity is gated by window status. Outside windows, bids cannot be
sent or received.

---

## Morale impact

| Event | Morale effect |
|---|---|
| Blocked move (user rejected offer, player wanted to leave) | -6 to -10, manager_trust -5 |
| Departing starter sold | -4 to remaining teammates |
| Transfer listing player | +10 move openness |

---

## Frontend

### Component hierarchy (TransfersTabV2)

```
TransfersTabV2
├── Budget header (transfer budget / wage budget / listed count)
├── Tab navigation (My List / Market / ERL / Loans / Offers)
└── 3-stage modal pipeline:
    ├── TransferBidModal (fee + player exchange + projection)
    ├── TransferCounterOfferModal (fee + feedback)
    └── WageNegotiationModal (wage + years + budget bar)
```

### Data collections

| View | Source |
|---|---|
| my_list | `player.transfer_listed \|\| player.loan_listed` for user's team |
| market | Players with `team_id === null` or `transfer_listed`, no academy dupes |
| erl | Academy team players (not user's) |
| loans | Players with `loan_listed` |
| offers | Players with any `transfer_offers` |

---

## Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/TransfersTabV2.tsx` | v2 tab (936 lines) |
| `src/components/transfers/TransfersTab.model.ts` | Data derivation, filtering, sorting |
| `src/components/transfers/TransfersTab.helpers.ts` | Helper functions |
| `src/components/transfers/TransferBidModal.tsx` | Bid modal |
| `src/components/transfers/TransferCounterOfferModal.tsx` | Counter-offer modal |
| `src/components/transfers/WageNegotiationModal.tsx` | Wage modal |
| `src/services/transfersService.ts` | API bridge |
| `src-tauri/crates/olm_core/src/transfers.rs` | Core engine (3009 lines) |
| `src-tauri/crates/olm_core/src/finances.rs` | Budget/wage integration |
| `src-tauri/crates/olm_core/src/domain/player.rs` | TransferOffer types |
| `src-tauri/crates/olm_core/src/domain/negotiation.rs` | NegotiationFeedback types |
| `src-tauri/crates/olm_core/src/domain/transfer_history.rs` | History types |
