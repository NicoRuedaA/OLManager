use chrono::{TimeZone, Utc};
use olm_core::clock::GameClock;
use olm_core::domain::league::{
    Fixture, FixtureStatus, League, LeagueKind, MatchResult, MatchType, StandingEntry,
};
use olm_core::domain::manager::Manager;
use olm_core::domain::player::{Player, PlayerAttributes};
use olm_core::domain::staff::{Staff, StaffAttributes, StaffRole};
use olm_core::domain::stats::LolRole;
use olm_core::domain::team::{
    Facilities, FinancialTransaction, FinancialTransactionKind, MainFacilityModuleKind,
    Sponsorship, SponsorshipBonusCriterion, Team,
};
use olm_core::finances::{self, BudgetImpact, FinanceTransactionInput};
use olm_core::game::Game;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn make_team(id: &str, name: &str) -> Team {
    let mut t = Team::new(
        id.to_string(),
        name.to_string(),
        name[..3].to_string(),
        "England".to_string(),
        "London".to_string(),
        "Stadium".to_string(),
        40_000,
    );
    t.finance = 5_000_000;
    t.wage_budget = 2_000_000;
    t
}

fn make_player(id: &str, team_id: &str, wage: u32) -> Player {
    let attrs = PlayerAttributes {
        mental_resilience: 65,
        champion_pool: 65,
        laning: 65,
        mechanics: 65,
        macro_play: 65,
        consistency: 65,
        discipline: 65,
        teamfighting: 65,
        shotcalling: 50,
    };
    let mut p = Player::new(
        id.to_string(),
        "Player".to_string(),
        format!("Full {}", id),
        "1995-01-01".to_string(),
        "GB".to_string(),
        LolRole::Jungle,
        attrs,
    );
    p.team_id = Some(team_id.to_string());
    p.wage = wage;
    p.condition = 90;
    p
}

fn make_staff(id: &str, team_id: &str, wage: u32) -> Staff {
    let mut s = Staff::new(
        id.to_string(),
        "Staff".to_string(),
        id.to_string(),
        "1980-01-01".to_string(),
        StaffRole::Coach,
        StaffAttributes {
            coaching: 70,
            judging_ability: 50,
            judging_potential: 50,
            physiotherapy: 30,
        },
    );
    s.team_id = Some(team_id.to_string());
    s.nationality = "GB".to_string();
    s.wage = wage;
    s
}

/// Create a game set on the 1st of a month so process_monthly_finances runs.
fn make_game_on(year: i32, month: u32, day: u32) -> Game {
    let date = Utc.with_ymd_and_hms(year, month, day, 12, 0, 0).unwrap();
    let clock = GameClock::new(date);
    let mut manager = Manager::new(
        "mgr1".to_string(),
        "Test".to_string(),
        "Manager".to_string(),
        "1980-01-01".to_string(),
        "England".to_string(),
    );
    manager.hire("team1".to_string());

    let team1 = make_team("team1", "Test FC");
    let p1 = make_player("p1", "team1", 52_000); // 52000/12 = 4333/month
    let p2 = make_player("p2", "team1", 26_000); // 26000/12 = 2167/month
    let s1 = make_staff("s1", "team1", 10_400); // 10400/12 = 867/month

    Game::new(clock, manager, vec![team1], vec![p1, p2], vec![s1], vec![])
}

fn make_first_of_month_game() -> Game {
    // 2025-06-01 is the 1st of June
    make_game_on(2025, 6, 1)
}

// ---------------------------------------------------------------------------
// record_transaction — atomic helper
// ---------------------------------------------------------------------------

#[test]
fn record_transaction_applies_income_to_cash_season_totals_and_ledger() {
    let mut team = make_team("team1", "Test FC");
    team.finance = 100_000;
    team.season_income = 20_000;

    finances::record_transaction(
        &mut team,
        FinanceTransactionInput {
            date: "2026-01-15".to_string(),
            description: "Winter sponsorship payment".to_string(),
            amount: 35_000,
            kind: FinancialTransactionKind::Sponsorship,
            budget_impact: BudgetImpact::None,
            affects_season_totals: true,
        },
    );

    assert_eq!(team.finance, 135_000);
    assert_eq!(team.season_income, 55_000);
    assert_eq!(team.season_expenses, 0);
    assert_eq!(team.financial_ledger.len(), 1);
    assert_eq!(team.financial_ledger[0].date, "2026-01-15");
    assert_eq!(
        team.financial_ledger[0].description,
        "Winter sponsorship payment"
    );
    assert_eq!(team.financial_ledger[0].amount, 35_000);
    assert_eq!(
        team.financial_ledger[0].kind,
        FinancialTransactionKind::Sponsorship
    );
}

#[test]
fn record_transaction_applies_expense_and_signed_budget_impact_atomically() {
    let mut team = make_team("team1", "Test FC");
    team.finance = 250_000;
    team.season_expenses = 12_000;
    team.transfer_budget = 90_000;

    finances::record_transaction(
        &mut team,
        FinanceTransactionInput {
            date: "2026-02-02".to_string(),
            description: "Transfer purchase".to_string(),
            amount: -40_000,
            kind: FinancialTransactionKind::TransferPurchase,
            budget_impact: BudgetImpact::Transfer(-40_000),
            affects_season_totals: true,
        },
    );

    assert_eq!(team.finance, 210_000);
    assert_eq!(team.season_income, 0);
    assert_eq!(team.season_expenses, 52_000);
    assert_eq!(team.transfer_budget, 50_000);
    assert_eq!(team.financial_ledger.len(), 1);
    assert_eq!(team.financial_ledger[0].amount, -40_000);
    assert_eq!(
        team.financial_ledger[0].kind,
        FinancialTransactionKind::TransferPurchase
    );
}

#[test]
fn financial_transaction_kind_deserializes_old_prize_money_entries() {
    let entry: FinancialTransaction = serde_json::from_str(
        r#"{
            "date": "2025-12-31",
            "description": "League prize",
            "amount": 800000,
            "kind": "PrizeMoney"
        }"#,
    )
    .expect("old prize money ledger entry should deserialize");

    assert_eq!(entry.kind, FinancialTransactionKind::PrizeMoney);
    assert_eq!(entry.amount, 800_000);
}

#[test]
fn financial_transaction_kind_deserializes_unknown_entries_as_other() {
    let entry: FinancialTransaction = serde_json::from_str(
        r#"{
            "date": "2027-01-01",
            "description": "Future accounting event",
            "amount": 12345,
            "kind": "FutureKindFromNewerSave"
        }"#,
    )
    .expect("unknown future ledger kind should not crash loading");

    assert_eq!(entry.kind, FinancialTransactionKind::Other);
    assert_eq!(entry.amount, 12_345);
}

#[test]
fn financial_transaction_deserializes_partial_entries_with_missing_kind_as_other() {
    let entry: FinancialTransaction = serde_json::from_str(
        r#"{
            "date": "2027-01-02",
            "description": "Partial legacy accounting event",
            "amount": -7500
        }"#,
    )
    .expect("partial ledger entry without kind should not crash loading");

    assert_eq!(entry.kind, FinancialTransactionKind::Other);
    assert_eq!(entry.amount, -7_500);
}

// ---------------------------------------------------------------------------
// process_monthly_finances — wage deductions
// ---------------------------------------------------------------------------

#[test]
fn calc_annual_wages_sums_player_and_staff_wages_for_a_team() {
    let game = make_first_of_month_game();

    let annual_wages = finances::calc_annual_wages(&game, "team1");

    assert_eq!(annual_wages, 88_400);
}

#[test]
fn calc_annual_wages_sums_full_contract_values_for_a_team() {
    let game = make_first_of_month_game();

    let annual_wages = finances::calc_annual_wages(&game, "team1");

    assert_eq!(annual_wages, 88_400);
}

#[test]
fn calc_cash_runway_weeks_uses_projected_monthly_net() {
    assert_eq!(finances::calc_cash_runway_weeks(180_000, -30_000), Some(6));
    assert_eq!(finances::calc_cash_runway_weeks(180_000, 5_000), None);
}

#[test]
fn calc_matchday_uses_explicit_attendance_and_ticket_inputs() {
    let revenue = finances::calc_matchday(40_000, 2, 0.75, 20.0);

    assert_eq!(revenue, 1_200_000);
}

#[test]
fn calc_upkeep_defaults_to_zero_for_now() {
    let game = make_first_of_month_game();

    let upkeep = finances::calc_upkeep(&game.teams[0]);

    assert_eq!(upkeep, 0);
}

#[test]
fn calc_upkeep_stays_zero_for_legacy_default_facilities() {
    let game = make_first_of_month_game();

    assert_eq!(finances::calc_upkeep(&game.teams[0]), 0);
}

#[test]
fn calc_upkeep_scales_with_upgraded_facilities() {
    let mut game = make_first_of_month_game();
    game.teams[0].facilities = Facilities {
        training: 3,
        medical: 2,
        scouting: 1,
        ..Facilities::default()
    };

    assert_eq!(finances::calc_upkeep(&game.teams[0]), 135_000);
}

#[test]
fn calc_upkeep_uses_canonical_modular_hub_contract() {
    let mut game = make_first_of_month_game();
    game.teams[0].facilities = Facilities {
        main_hub_level: 4,
        training: 3,
        medical: 2,
        scouting: 1,
        ..Default::default()
    };

    let breakdown = finances::facility_upkeep_breakdown(&game.teams[0].facilities);

    assert_eq!(breakdown.monthly_total, 155_000);
    assert_eq!(breakdown.hub_extra_level_total, 60_000);
    assert_eq!(breakdown.module_extra_level_total, 95_000);
    assert_eq!(finances::calc_upkeep(&game.teams[0]), 155_000);
}

#[test]
fn content_studio_finance_effect_is_gated_behind_canonical_module_helper() {
    let default_facilities = Facilities::default();
    let expanded_facilities = Facilities {
        main_hub_level: 3,
        ..Facilities::default()
    };

    assert_eq!(
        finances::facility_module_sponsorship_multiplier(&default_facilities),
        1.0
    );
    assert_eq!(
        default_facilities.module_level(MainFacilityModuleKind::ContentStudio),
        1
    );
    assert_eq!(
        finances::facility_module_sponsorship_multiplier(&expanded_facilities),
        1.04
    );
}

#[test]
fn evaluate_sponsorship_bonus_sums_met_criteria_for_team_context() {
    let sponsorship = Sponsorship {
        sponsor_name: "Acme Corp".to_string(),
        base_value: 100_000,
        remaining_months: 8,
        bonus_criteria: vec![
            SponsorshipBonusCriterion::LeaguePosition {
                max_position: 2,
                bonus_amount: 50_000,
            },
            SponsorshipBonusCriterion::UnbeatenRun {
                required_matches: 3,
                bonus_amount: 25_000,
            },
        ],
    };

    let bonus = finances::evaluate_sponsorship_bonus(
        Some(1),
        &["W".to_string(), "D".to_string(), "W".to_string()],
        &sponsorship,
    );

    assert_eq!(bonus, 75_000);
}

#[test]
fn calc_sponsorship_income_applies_esports_or_pc_theme_bonus() {
    let sponsorship = Sponsorship {
        sponsor_name: "Nexus eSports".to_string(),
        base_value: 100_000,
        remaining_months: 8,
        bonus_criteria: vec![SponsorshipBonusCriterion::UnbeatenRun {
            required_matches: 3,
            bonus_amount: 25_000,
        }],
    };

    let income = finances::calc_sponsorship_income(
        Some(1),
        &["W".to_string(), "D".to_string(), "W".to_string()],
        &sponsorship,
    );

    assert_eq!(income, 140_000);
}

#[test]
fn calc_sponsorship_income_leaves_generic_brands_unmodified() {
    let sponsorship = Sponsorship {
        sponsor_name: "Acme Corp".to_string(),
        base_value: 100_000,
        remaining_months: 8,
        bonus_criteria: vec![SponsorshipBonusCriterion::UnbeatenRun {
            required_matches: 3,
            bonus_amount: 25_000,
        }],
    };

    let income = finances::calc_sponsorship_income(
        Some(1),
        &["W".to_string(), "D".to_string(), "W".to_string()],
        &sponsorship,
    );

    assert_eq!(income, 125_000);
}

#[test]
fn monthly_recurring_expenses_create_categorized_ledger_entries() {
    let mut game = make_game_on(2025, 6, 1);
    game.teams[0].facilities = Facilities {
        main_hub_level: 4,
        training: 3,
        medical: 2,
        scouting: 1,
        ..Default::default()
    };
    let initial_finance = game.teams[0].finance;

    finances::process_monthly_finances(&mut game);

    let player_wages = (52_000 + 26_000) / 12;
    let staff_wages = 10_400 / 12;
    let upkeep = 155_000;
    assert_eq!(
        game.teams[0].finance,
        initial_finance - player_wages - staff_wages - upkeep
    );
    assert_eq!(
        game.teams[0].season_expenses,
        player_wages + staff_wages + upkeep
    );
    assert_eq!(game.teams[0].financial_ledger.len(), 3);
    assert!(game.teams[0].financial_ledger.iter().any(|entry| {
        entry.date == "2025-06-01"
            && entry.amount == -player_wages
            && entry.kind == FinancialTransactionKind::Salary
    }));
    assert!(game.teams[0].financial_ledger.iter().any(|entry| {
        entry.date == "2025-06-01"
            && entry.amount == -staff_wages
            && entry.kind == FinancialTransactionKind::StaffWage
    }));
    assert!(game.teams[0].financial_ledger.iter().any(|entry| {
        entry.date == "2025-06-01"
            && entry.amount == -upkeep
            && entry.kind == FinancialTransactionKind::FacilityUpkeep
    }));
}

#[test]
fn monthly_sponsorship_payout_is_applied_and_duration_decrements_on_monday() {
    let mut game = make_first_of_month_game();
    let initial_finance = game.teams[0].finance;
    game.teams[0].form = vec!["W".to_string(), "D".to_string(), "W".to_string()];
    game.teams[0].sponsorship = Some(Sponsorship {
        sponsor_name: "Acme Corp".to_string(),
        base_value: 100_000,
        remaining_months: 2,
        bonus_criteria: vec![SponsorshipBonusCriterion::UnbeatenRun {
            required_matches: 3,
            bonus_amount: 25_000,
        }],
    });

    finances::process_monthly_finances(&mut game);

    let wages = (52_000 + 26_000 + 10_400) / 12;
    let expected_sponsor_income = 10_417; // 125_000 annual / 12, rounded
    assert_eq!(
        game.teams[0].finance,
        initial_finance - wages + expected_sponsor_income
    );
    assert_eq!(game.teams[0].season_income, expected_sponsor_income);
    assert_eq!(
        game.teams[0].sponsorship.as_ref().unwrap().remaining_months,
        1
    );
    let sponsorship_entries: Vec<_> = game.teams[0]
        .financial_ledger
        .iter()
        .filter(|entry| entry.kind == FinancialTransactionKind::Sponsorship)
        .collect();
    assert_eq!(sponsorship_entries.len(), 1);
    assert_eq!(sponsorship_entries[0].date, "2025-06-01");
    assert_eq!(sponsorship_entries[0].amount, expected_sponsor_income);
}

#[test]
fn monthly_upkeep_is_deducted_on_first_of_month() {
    let mut game = make_game_on(2025, 6, 1);
    game.teams[0].facilities = Facilities {
        main_hub_level: 4,
        training: 3,
        medical: 2,
        scouting: 1,
        ..Default::default()
    };
    let initial_finance = game.teams[0].finance;

    finances::process_monthly_finances(&mut game);

    let wages = (52_000 + 26_000 + 10_400) / 12;
    let upkeep = 155_000;
    assert_eq!(game.teams[0].finance, initial_finance - wages - upkeep);
    assert_eq!(game.teams[0].season_expenses, wages + upkeep);
}

#[test]
fn sponsorship_expires_after_the_final_monthly_tick() {
    let mut game = make_first_of_month_game();
    game.teams[0].sponsorship = Some(Sponsorship {
        sponsor_name: "Acme Corp".to_string(),
        base_value: 100_000,
        remaining_months: 1,
        bonus_criteria: vec![],
    });

    finances::process_monthly_finances(&mut game);

    assert!(game.teams[0].sponsorship.is_none());
}

#[test]
fn wages_deducted_on_first_of_month() {
    let mut game = make_first_of_month_game();
    let initial_finance = game.teams[0].finance;

    finances::process_monthly_finances(&mut game);

    // Monthly wages: (52000+26000+10400)/52 = 1700
    let expected_deduction = (52_000 + 26_000 + 10_400) / 12;
    assert_eq!(
        game.teams[0].finance,
        initial_finance - expected_deduction,
        "Finance should be reduced by monthly wages"
    );
}

#[test]
fn season_expenses_tracked() {
    let mut game = make_first_of_month_game();
    assert_eq!(game.teams[0].season_expenses, 0);

    finances::process_monthly_finances(&mut game);

    let expected = (52_000 + 26_000 + 10_400) / 12;
    assert_eq!(game.teams[0].season_expenses, expected);
}

#[test]
fn no_processing_on_non_first_of_month() {
    let mut game = make_first_of_month_game();
    // Change to Tuesday
    game.clock.current_date = Utc.with_ymd_and_hms(2025, 6, 17, 12, 0, 0).unwrap();
    let initial_finance = game.teams[0].finance;

    finances::process_monthly_finances(&mut game);

    assert_eq!(
        game.teams[0].finance, initial_finance,
        "Should not process on non-Monday"
    );
}

// ---------------------------------------------------------------------------
// Financial warnings
// ---------------------------------------------------------------------------

#[test]
fn no_warning_when_finances_healthy() {
    let mut game = make_first_of_month_game();
    game.teams[0].finance = 5_000_000;

    finances::process_monthly_finances(&mut game);

    let finance_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_") || m.id.starts_with("wage_"))
        .collect();
    assert!(
        finance_msgs.is_empty(),
        "No warning when finances are healthy"
    );
}

#[test]
fn critical_warning_when_in_debt() {
    let mut game = make_first_of_month_game();
    game.teams[0].finance = -100_000;

    finances::process_monthly_finances(&mut game);

    let critical_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_critical_"))
        .collect();
    assert_eq!(
        critical_msgs.len(),
        1,
        "Should send critical warning when in debt"
    );
    assert!(
        critical_msgs[0].subject.contains("URGENT") || critical_msgs[0].subject.contains("Debt"),
        "Should be urgent, got: {}",
        critical_msgs[0].subject
    );
}

#[test]
fn warning_when_low_runway() {
    let mut game = make_first_of_month_game();
    // Set finance low enough to warn after monthly wages, but still above debt.
    game.teams[0].finance = 14_700;

    finances::process_monthly_finances(&mut game);

    let warning_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_warning_"))
        .collect();
    // After deducting wages (7366), finance=7334, runway rounds down below threshold.
    assert_eq!(warning_msgs.len(), 1, "Should send low reserves warning");
}

#[test]
fn sponsorship_income_prevents_false_low_runway_warning() {
    let mut game = make_first_of_month_game();
    game.teams[0].finance = 3_400;
    game.teams[0].sponsorship = Some(Sponsorship {
        sponsor_name: "PixelForge PCs".to_string(),
        base_value: 83_200, // equivalent to 1_600/week annualized
        remaining_months: 8,
        bonus_criteria: vec![],
    });

    finances::process_monthly_finances(&mut game);

    let warning_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_warning_"))
        .collect();
    assert!(
        warning_msgs.is_empty(),
        "Positive sponsorship support should avoid a false runway warning"
    );
}

#[test]
fn wage_over_budget_warning() {
    let mut game = make_first_of_month_game();
    game.teams[0].finance = 5_000_000; // healthy
    game.teams[0].wage_budget = 50_000; // very low budget

    // Annual wages = (52000+26000+10400) = 88400 > 50000 budget
    finances::process_monthly_finances(&mut game);

    let budget_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("wage_over_budget_"))
        .collect();
    assert_eq!(
        budget_msgs.len(),
        1,
        "Should warn about exceeding wage budget"
    );
}

#[test]
fn financial_warnings_not_duplicated() {
    let mut game = make_first_of_month_game();
    game.teams[0].finance = -100_000;

    finances::process_monthly_finances(&mut game);
    // Process again on same day (shouldn't add duplicate)
    finances::process_monthly_finances(&mut game);

    let critical_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_critical_"))
        .collect();
    // Note: process only runs on Monday, so second call on same Monday
    // The message dedup uses the date-based ID
    assert_eq!(
        critical_msgs.len(),
        1,
        "Should not duplicate critical warning"
    );
}

#[test]
fn no_warning_without_manager_team() {
    let mut game = make_first_of_month_game();
    game.manager.team_id = None;
    game.teams[0].finance = -100_000;

    finances::process_monthly_finances(&mut game);

    let finance_msgs: Vec<_> = game
        .messages
        .iter()
        .filter(|m| m.id.starts_with("finance_"))
        .collect();
    assert!(finance_msgs.is_empty(), "No warning without manager team");
}

// ---------------------------------------------------------------------------
// Matchday income
// ---------------------------------------------------------------------------

#[test]
fn home_match_generates_income() {
    let mut game = make_first_of_month_game();
    let initial_finance = game.teams[0].finance;

    // Add a completed home fixture within the last 28 days.
    let league = League {
        id: "l1".to_string(),
        name: "Test League".to_string(),
        season: 1,
        competition_id: None,
        logo: None,
        league_kind: LeagueKind::Main,
        fixtures: vec![Fixture {
            id: "f1".to_string(),
            matchday: 1,
            date: "2025-05-30".to_string(), // Friday, within ~28 days of 2025-06-01
            home_team_id: "team1".to_string(),
            away_team_id: "team2".to_string(),
            match_type: MatchType::League,
            best_of: 1,
            status: FixtureStatus::Completed,
            result: Some(MatchResult {
                home_wins: 1,
                away_wins: 0,
                ended_by: Default::default(),
                game_duration_seconds: 1800,
                report: None,
            }),
        }],
        standings: vec![StandingEntry::new("team1".to_string())],
    };
    game.leagues = vec![league];

    finances::process_monthly_finances(&mut game);

    // After wage deduction AND matchday income
    let wages = (52_000 + 26_000 + 10_400) / 12;
    // Income should make final finance > initial - wages
    // (stadium capacity 40000, attendance 60-92%, ticket €15-25)
    // Min income: 40000 * 0.60 * 15 = 360,000
    let final_finance = game.teams[0].finance;
    assert!(
        final_finance > initial_finance - wages,
        "Matchday income should offset some wages. Got {} (started {}, wages {})",
        final_finance,
        initial_finance,
        wages
    );
    let matchday_entries: Vec<_> = game.teams[0]
        .financial_ledger
        .iter()
        .filter(|entry| entry.kind == FinancialTransactionKind::MatchdayRevenue)
        .collect();
    assert_eq!(matchday_entries.len(), 1);
    assert_eq!(matchday_entries[0].date, "2025-06-01");
    assert!(matchday_entries[0].amount > 0);
    assert_eq!(
        final_finance,
        initial_finance - wages + matchday_entries[0].amount
    );
    assert_eq!(game.teams[0].season_income, matchday_entries[0].amount);
}

#[test]
fn away_match_no_income() {
    let mut game = make_first_of_month_game();

    // Add a completed away fixture (team1 is away)
    let league = League {
        id: "l1".to_string(),
        name: "Test League".to_string(),
        season: 1,
        competition_id: None,
        logo: None,
        league_kind: LeagueKind::Main,
        fixtures: vec![Fixture {
            id: "f1".to_string(),
            matchday: 1,
            date: "2025-06-14".to_string(),
            home_team_id: "team2".to_string(), // team1 is away
            away_team_id: "team1".to_string(),
            match_type: MatchType::League,
            best_of: 1,
            status: FixtureStatus::Completed,
            result: Some(MatchResult {
                home_wins: 0,
                away_wins: 1,
                ended_by: Default::default(),
                game_duration_seconds: 1800,
                report: None,
            }),
        }],
        standings: vec![StandingEntry::new("team1".to_string())],
    };
    game.leagues = vec![league];

    let initial_finance = game.teams[0].finance;
    finances::process_monthly_finances(&mut game);

    let wages = (52_000 + 26_000 + 10_400) / 12;
    assert_eq!(
        game.teams[0].finance,
        initial_finance - wages,
        "Away match should generate no income for team1"
    );
}

// ---------------------------------------------------------------------------
// Multiple teams
// ---------------------------------------------------------------------------

#[test]
fn multiple_teams_processed_independently() {
    let mut game = make_first_of_month_game();
    let mut team2 = make_team("team2", "Rival FC");
    team2.finance = 3_000_000;
    game.teams.push(team2);

    let p3 = make_player("p3", "team2", 104_000); // 2000/week
    game.players.push(p3);

    let initial_t1 = game.teams[0].finance;
    let initial_t2 = game.teams[1].finance;

    finances::process_monthly_finances(&mut game);

    let t1_wages = (52_000 + 26_000 + 10_400) / 12; // 1700
    let t2_wages = 104_000 / 12; // 2000
    assert_eq!(game.teams[0].finance, initial_t1 - t1_wages);
    assert_eq!(game.teams[1].finance, initial_t2 - t2_wages);
}
