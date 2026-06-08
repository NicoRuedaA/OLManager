# Finances — Architecture & Usage

## Overview

Finances track club balance, wage budget, transfer budget, income, and
expenses. Financial processing runs monthly (1st of each month) and covers
wages, facility upkeep, sponsorship income, and matchday revenue. Warning
messages are generated when the club is in debt or has low runway.

---

## Data flow

```
MONTHLY (1st of month):
  process_monthly_finances(game)
    → Per team:
      ├─ Deduct wages/12 + facility upkeep → finance -= total; season_expenses += total
      ├─ Add sponsorship income/12 + facility_multiplier → finance += income; season_income += income
      ├─ Add matchday revenue (home games in last ~28 days)
      │  → attendance% = random(15-30%), ticket = random(4-8)
      └─ Generate warning messages if:
          ├─ finance < 0 → CRITICAL: in debt
          ├─ runway < 4 months → WARNING: low reserves
          └─ wages > budget → NORMAL: over budget
```

---

## Income sources

### Matchday revenue
```
revenue = stadium_capacity × attendance% × avg_ticket × home_match_count
```
Attendance and ticket price randomized per month.

### Sponsorship
```
income = base_value × theme_multiplier × facility_multiplier / 12
  theme_multiplier: 1.15 for esports/tech sponsors, else 1.0
  facility_multiplier: 1.0 + (content_studio_extra_levels × 0.02)
  + bonus_criteria: LeaguePosition, UnbeatenRun
```

Sponsorships have `remaining_months` that counts down each month. When it
reaches 0, the sponsorship expires.

---

## Expenses

### Wage bill
```
calc_annual_wages(game, team_id) = sum(player.wage) + sum(staff.wage)
monthly = annual / 12
```

### Facility upkeep
```
hub_extra_levels × 20,000 + sum(module_extra_levels × module_cost)
```
| Module | Per extra level |
|---|---|
| ScrimsRoom | 20,000 |
| AnalysisRoom | 15,000 |
| BootcampArea | 15,000 |
| RecoverySuite | 10,000 |
| ScoutingLab | 10,000 |
| ContentStudio | 0 |

Only levels beyond 1 are charged.

---

## Budgets

### Wage budget
Set at end-of-season: `finance × 6%` (if finance > 0).

Soft cap: 110% of budget. If over budget, new wages must not increase the
bill (or max +3% / +25K grace).

### Transfer budget
Set at end-of-season: `finance × 22%` (if finance > 0).

On selling: `60%` of fee is reallocated to transfer budget
(`TRANSFER_BUDGET_SELLING_REALLOCATION_PCT`).

### Bid validation
```
bid must pass BOTH:
  transfer_budget ≥ fee
  finance ≥ fee
```

---

## Cash flow

```
projected_annual_net = sponsor_income - wage_bill

cash_runway_weeks:
  if net ≥ 0 → None (infinite)
  else → max(0, balance / |weekly_net|)
```

---

## Facility upgrades

| Upgrade | Cost formula | Gated by |
|---|---|---|
| Main hub expansion | level × 500,000 | Balance ≥ cost |
| Facility module upgrade | level × 250,000 | Balance ≥ cost, hub > module level |

Each facility module level adds specific gameplay bonuses (see Training and
Scouting docs for details).

---

## End-of-season budget refresh

```
wage_budget = max(0, finance) × 6%
transfer_budget = max(0, finance) × 22%
```

Applied after prize money is awarded. Low spending = smaller budgets next
season.

---

## Frontend

### Sections (FinancesTabV2)

1. **Overview grid** — balance, wage budget, transfer budget, season income,
   season expenses, squad value
2. **Wage bill + cash flow** — annual spend vs budget, projected net, runway
3. **Contract risk** — expiring contracts with renewal actions
4. **Sponsors** — active sponsor + pending offers
5. **Facilities** — hub expansion + 6 module cards with level/upkeep/cost
6. **Payroll** — full roster table (player/role/wage/value/contract)

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/FinancesTabV2.tsx` | v2 tab (770 lines) |
| `src/lib/finances/finance.ts` | TeamFinanceSnapshot computation |
| `src-tauri/crates/olm_core/src/finances.rs` | Core engine (472 lines) |
| `src-tauri/crates/olm_core/src/end_of_season.rs` | Budget refresh |
| `src-tauri/crates/olm_core/src/domain/team.rs` | Team financial fields |
| `src-tauri/crates/olm_core/src/contract_wage_policy.rs` | Wage soft cap |
| `src-tauri/crates/olm_core/src/delegated_renewals.rs` | Bulk contract renewal |
