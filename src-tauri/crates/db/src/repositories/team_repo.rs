use domain::team::{
    AcademyMetadata, Facilities, FinancialTransaction, LolTactics, PlayStyle, Sponsorship, Team,
    TeamColors, TeamKind, TrainingFocus, TrainingIntensity, TrainingSchedule,
};
use rusqlite::{params, Connection};

/// Insert or replace a team row.
pub fn upsert_team(conn: &Connection, t: &Team) -> Result<(), String> {
    let starting_xi_json =
        serde_json::to_string(&t.starting_xi_ids).map_err(|e| format!("JSON error: {}", e))?;
    let form_json = serde_json::to_string(&t.form).map_err(|e| format!("JSON error: {}", e))?;
    let history_json =
        serde_json::to_string(&t.history).map_err(|e| format!("JSON error: {}", e))?;
    let training_groups_json =
        serde_json::to_string(&t.training_groups).map_err(|e| format!("JSON error: {}", e))?;
    let weekly_scrims_json = serde_json::to_string(&t.weekly_scrim_opponent_ids)
        .map_err(|e| format!("JSON error: {}", e))?;
    let scrim_slot_results_json =
        serde_json::to_string(&t.scrim_slot_results).map_err(|e| format!("JSON error: {}", e))?;
    let team_roles_json =
        serde_json::to_string(&t.team_roles).map_err(|e| format!("JSON error: {}", e))?;
    let financial_ledger_json =
        serde_json::to_string(&t.financial_ledger).map_err(|e| format!("JSON error: {}", e))?;
    let sponsorship_json =
        serde_json::to_string(&t.sponsorship).map_err(|e| format!("JSON error: {}", e))?;
    let facilities_json = t
        .facilities
        .to_persisted_json_string()
        .map_err(|e| format!("JSON error: {}", e))?;
    let play_style_str = format!("{:?}", t.play_style);
    let training_focus_str = t.training_focus.as_id().to_string();
    let training_intensity_str = format!("{:?}", t.training_intensity);
    let training_schedule_str = format!("{:?}", t.training_schedule);
    let team_kind_str = format!("{:?}", t.team_kind);
    let academy_metadata_json = t
        .academy
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| format!("JSON error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO teams
         (id, name, short_name, country, city, arena_name, arena_capacity,
           finance, manager_id, reputation, wage_budget, transfer_budget,
          season_income, season_expenses, formation, play_style,
          training_focus, training_intensity, training_schedule,
          founded_year, colors_primary, colors_secondary,
          starting_xi_ids, team_roles, form, history, training_groups, weekly_scrim_opponent_ids, scrim_loss_streak, scrim_weekly_played, scrim_weekly_wins, scrim_weekly_losses, scrim_slot_results, financial_ledger, sponsorship, facilities,
          team_kind, parent_team_id, academy_team_id, academy_metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40)",
        params![
            t.id,
            t.name,
            t.short_name,
            t.country,
            t.city,
            t.arena_name,
            t.arena_capacity,
            t.finance,
            t.manager_id,
            t.reputation,
            t.wage_budget,
            t.transfer_budget,
            t.season_income,
            t.season_expenses,
            t.formation,
            play_style_str,
            training_focus_str,
            training_intensity_str,
            training_schedule_str,
            t.founded_year,
            t.colors.primary,
            t.colors.secondary,
            starting_xi_json,
            team_roles_json,
            form_json,
            history_json,
            training_groups_json,
            weekly_scrims_json,
            t.scrim_loss_streak,
            t.scrim_weekly_played,
            t.scrim_weekly_wins,
            t.scrim_weekly_losses,
            scrim_slot_results_json,
            financial_ledger_json,
            sponsorship_json,
            facilities_json,
            team_kind_str,
            t.parent_team_id,
            t.academy_team_id,
            academy_metadata_json,
        ],
    )
    .map_err(|e| format!("Failed to upsert team: {}", e))?;
    Ok(())
}

/// Insert or replace multiple teams in a single transaction.
pub fn upsert_teams(conn: &Connection, teams: &[Team]) -> Result<(), String> {
    for t in teams {
        upsert_team(conn, t)?;
    }
    Ok(())
}

fn parse_play_style(s: &str) -> PlayStyle {
    match s {
        "Attacking" => PlayStyle::Attacking,
        "Defensive" => PlayStyle::Defensive,
        "Possession" => PlayStyle::Possession,
        "Counter" => PlayStyle::Counter,
        "HighPress" => PlayStyle::HighPress,
        _ => PlayStyle::Balanced,
    }
}

fn parse_training_focus(s: &str) -> TrainingFocus {
    TrainingFocus::from_id(s).unwrap_or_default()
}

fn parse_training_intensity(s: &str) -> TrainingIntensity {
    match s {
        "Low" => TrainingIntensity::Low,
        "High" => TrainingIntensity::High,
        _ => TrainingIntensity::Medium,
    }
}

fn parse_training_schedule(s: &str) -> TrainingSchedule {
    match s {
        "Intense" => TrainingSchedule::Intense,
        "Light" => TrainingSchedule::Light,
        _ => TrainingSchedule::Balanced,
    }
}

fn parse_team_kind(s: &str) -> TeamKind {
    match s {
        "Academy" => TeamKind::Academy,
        _ => TeamKind::Main,
    }
}

fn parse_academy_metadata(json: Option<String>) -> Option<AcademyMetadata> {
    json.and_then(|value| serde_json::from_str::<AcademyMetadata>(&value).ok())
}

fn row_to_team(row: &rusqlite::Row) -> rusqlite::Result<Team> {
    log::debug!("[team_repo] row_to_team: parsing row...");
    let starting_xi_json: String = row.get(22)?;
    let team_roles_json: String = row.get(23)?;
    let form_json: String = row.get(24)?;
    let history_json: String = row.get(25)?;
    let training_groups_json: String = row.get(26)?;
    let weekly_scrims_json: String = row.get(27)?;
    let scrim_loss_streak: u8 = row.get(28)?;
    let scrim_weekly_played: u8 = row.get(29)?;
    let scrim_weekly_wins: u8 = row.get(30)?;
    let scrim_weekly_losses: u8 = row.get(31)?;
    let scrim_slot_results_json: String = row.get(32)?;
    let financial_ledger_json: String = row.get(33)?;
    let sponsorship_json: String = row.get(34)?;
    let facilities_json: String = row.get(35)?;
    let play_style_str: String = row.get(15)?;
    let training_focus_str: String = row.get(16)?;
    let training_intensity_str: String = row.get(17)?;
    let training_schedule_str: String = row.get(18)?;
    let team_kind_str: String = row.get(36)?;
    let parent_team_id: Option<String> = row.get(37)?;
    let academy_team_id: Option<String> = row.get(38)?;
    let academy_metadata_json: Option<String> = row.get(39)?;

    Ok(Team {
        id: row.get(0)?,
        name: row.get(1)?,
        short_name: row.get(2)?,
        country: row.get(3)?,
        city: row.get(4)?,
        arena_name: row.get(5)?,
        arena_capacity: row.get(6)?,
        finance: row.get(7)?,
        manager_id: row.get(8)?,
        reputation: row.get(9)?,
        wage_budget: row.get(10)?,
        transfer_budget: row.get(11)?,
        season_income: row.get(12)?,
        season_expenses: row.get(13)?,
        formation: row.get(14)?,
        play_style: parse_play_style(&play_style_str),
        lol_tactics: LolTactics::default(),
        training_focus: parse_training_focus(&training_focus_str),
        training_intensity: parse_training_intensity(&training_intensity_str),
        training_schedule: parse_training_schedule(&training_schedule_str),
        training_groups: serde_json::from_str(&training_groups_json).unwrap_or_default(),
        weekly_scrim_opponent_ids: serde_json::from_str(&weekly_scrims_json).unwrap_or_default(),
        scrim_loss_streak,
        scrim_weekly_played,
        scrim_weekly_wins,
        scrim_weekly_losses,
        scrim_slot_results: serde_json::from_str(&scrim_slot_results_json).unwrap_or_default(),
        founded_year: row.get(19)?,
        colors: TeamColors {
            primary: row.get(20)?,
            secondary: row.get(21)?,
        },
        starting_xi_ids: serde_json::from_str(&starting_xi_json).unwrap_or_default(),
        team_roles: serde_json::from_str(&team_roles_json).unwrap_or_default(),
        form: serde_json::from_str(&form_json).unwrap_or_default(),
        history: serde_json::from_str(&history_json).unwrap_or_default(),
        team_kind: parse_team_kind(&team_kind_str),
        parent_team_id,
        academy_team_id,
        academy: parse_academy_metadata(academy_metadata_json),
        financial_ledger: serde_json::from_str(&financial_ledger_json).unwrap_or_default(),
        sponsorship: serde_json::from_str(&sponsorship_json).unwrap_or_default(),
        facilities: Facilities::from_persisted_json(&facilities_json),
    })
}

/// Load all teams.
pub fn load_all_teams(conn: &Connection) -> Result<Vec<Team>, String> {
    log::info!("[team_repo] load_all_teams: preparing query...");
    let query = "SELECT id, name, short_name, country, city, arena_name, arena_capacity,
                    finance, manager_id, reputation, wage_budget, transfer_budget,
                    season_income, season_expenses, formation, play_style,
                    training_focus, training_intensity, training_schedule,
                    founded_year, colors_primary, colors_secondary,
                    starting_xi_ids, team_roles, form, history, training_groups, weekly_scrim_opponent_ids, scrim_loss_streak, scrim_weekly_played, scrim_weekly_wins, scrim_weekly_losses, scrim_slot_results, financial_ledger, sponsorship, facilities,
                    team_kind, parent_team_id, academy_team_id, academy_metadata
             FROM teams";

    log::info!(
        "[team_repo] load_all_teams: executing query on {} columns...",
        40
    );

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(e) => {
            log::error!("[team_repo] load_all_teams: PREPARE FAILED: {}", e);
            // Try to identify which column is missing
            let error_msg = format!("{}", e);
            if error_msg.contains("no such column") {
                // Check each column
                let test_columns = vec![
                    "team_kind",
                    "parent_team_id",
                    "academy_team_id",
                    "academy_metadata",
                    "weekly_scrim_opponent_ids",
                    "scrim_loss_streak",
                    "scrim_weekly_played",
                    "scrim_weekly_wins",
                    "scrim_weekly_losses",
                    "scrim_slot_results",
                    "financial_ledger",
                    "sponsorship",
                    "facilities",
                ];
                for col in test_columns {
                    if conn
                        .query_row(
                            &format!("SELECT {} FROM teams LIMIT 1", col),
                            [],
                            |_| Ok(()),
                        )
                        .is_err()
                    {
                        log::error!("[team_repo] MISSING COLUMN: {}", col);
                    }
                }
            }
            return Err(format!("Failed to prepare teams query: {}", e));
        }
    };
    log::info!("[team_repo] load_all_teams: query prepared successfully");

    let rows = stmt
        .query_map([], row_to_team)
        .map_err(|e| format!("Failed to query teams: {}", e))?;

    log::info!("[team_repo] load_all_teams: iterating rows...");
    let mut teams = Vec::new();
    for (idx, row) in rows.enumerate() {
        match row {
            Ok(team) => {
                log::info!(
                    "[team_repo] load_all_teams: loaded team {} ({})",
                    team.name,
                    team.id
                );
                teams.push(team);
            }
            Err(e) => {
                log::error!(
                    "[team_repo] load_all_teams: failed to read team row {}: {}",
                    idx,
                    e
                );
                return Err(format!("Failed to read team row {}: {}", idx, e));
            }
        }
    }
    log::info!(
        "[team_repo] load_all_teams: done, {} teams loaded",
        teams.len()
    );
    Ok(teams)
}

/// Load a single team by id.
pub fn load_team(conn: &Connection, id: &str) -> Result<Option<Team>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, short_name, country, city, arena_name, arena_capacity,
                    finance, manager_id, reputation, wage_budget, transfer_budget,
                    season_income, season_expenses, formation, play_style,
                    training_focus, training_intensity, training_schedule,
                    founded_year, colors_primary, colors_secondary,
                    starting_xi_ids, team_roles, form, history, training_groups, weekly_scrim_opponent_ids, scrim_loss_streak, scrim_weekly_played, scrim_weekly_wins, scrim_weekly_losses, scrim_slot_results, financial_ledger, sponsorship, facilities,
                    team_kind, parent_team_id, academy_team_id, academy_metadata
             FROM teams WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare team query: {}", e))?;

    let mut rows = stmt
        .query_map(params![id], row_to_team)
        .map_err(|e| format!("Failed to query team: {}", e))?;

    match rows.next() {
        Some(Ok(team)) => Ok(Some(team)),
        Some(Err(e)) => Err(format!("Failed to read team row: {}", e)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;
    use domain::team::{Facilities, Sponsorship, SponsorshipBonusCriterion, TeamSeasonRecord};

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    fn sample_team(id: &str, name: &str) -> Team {
        let mut team = Team::new(
            id.to_string(),
            name.to_string(),
            "TST".to_string(),
            "GB".to_string(),
            "London".to_string(),
            "Test Arena".to_string(),
            50000,
        );
        team.play_style = PlayStyle::Possession;
        team.finance = 5_000_000;
        team.wage_budget = 200_000;
        team.transfer_budget = 500_000;
        team
    }

    #[test]
    fn test_upsert_and_load_team() {
        let db = test_db();
        let team = sample_team("team-001", "London FC");

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.id, "team-001");
        assert_eq!(loaded.name, "London FC");
        assert_eq!(loaded.short_name, "TST");
        assert_eq!(loaded.play_style, PlayStyle::Possession);
        assert_eq!(loaded.finance, 5_000_000);
        assert_eq!(loaded.arena_capacity, 50000);
    }

    #[test]
    fn test_load_team_not_found() {
        let db = test_db();
        let loaded = load_team(db.conn(), "nonexistent").unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn test_upsert_teams_batch() {
        let db = test_db();
        let teams = vec![
            sample_team("team-001", "London FC"),
            sample_team("team-002", "Manchester City"),
            sample_team("team-003", "Liverpool Athletic"),
        ];

        upsert_teams(db.conn(), &teams).unwrap();
        let all = load_all_teams(db.conn()).unwrap();
        assert_eq!(all.len(), 3);
    }

    #[test]
    fn test_team_colors_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Red Team");
        team.colors = TeamColors {
            primary: "#ff0000".to_string(),
            secondary: "#00ff00".to_string(),
        };

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.colors.primary, "#ff0000");
        assert_eq!(loaded.colors.secondary, "#00ff00");
    }

    #[test]
    fn test_team_training_settings_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Training FC");
        team.training_focus = TrainingFocus::IndividualCoaching;
        team.training_intensity = TrainingIntensity::High;
        team.training_schedule = TrainingSchedule::Intense;

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.training_focus, TrainingFocus::IndividualCoaching);
        assert_eq!(loaded.training_intensity, TrainingIntensity::High);
        assert_eq!(loaded.training_schedule, TrainingSchedule::Intense);
    }

    #[test]
    fn test_team_history_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "History FC");
        team.history.push(TeamSeasonRecord {
            season: 2025,
            league_position: 3,
            played: 30,
            won: 18,
            drawn: 7,
            lost: 5,
            kills_for: 55,
            kills_against: 30,
        });

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.history.len(), 1);
        assert_eq!(loaded.history[0].season, 2025);
        assert_eq!(loaded.history[0].league_position, 3);
    }

    #[test]
    fn test_team_training_groups_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Groups FC");
        team.training_groups = vec![
            domain::team::TrainingGroup {
                id: "g1".to_string(),
                name: "Review Squad".to_string(),
                focus: TrainingFocus::VODReview,
                player_ids: vec!["p1".to_string(), "p2".to_string()],
            },
            domain::team::TrainingGroup {
                id: "g2".to_string(),
                name: "Carry Lab".to_string(),
                focus: TrainingFocus::ChampionPoolPractice,
                player_ids: vec!["p3".to_string()],
            },
        ];

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.training_groups.len(), 2);
        assert_eq!(loaded.training_groups[0].name, "Review Squad");
        assert_eq!(loaded.training_groups[0].focus, TrainingFocus::VODReview);
        assert_eq!(loaded.training_groups[0].player_ids.len(), 2);
        assert_eq!(loaded.training_groups[1].name, "Carry Lab");
        assert_eq!(
            loaded.training_groups[1].focus,
            TrainingFocus::ChampionPoolPractice
        );
    }

    #[test]
    fn test_team_starting_xi_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "XI FC");
        team.starting_xi_ids = vec!["p1".to_string(), "p2".to_string(), "p3".to_string()];

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.starting_xi_ids.len(), 3);
        assert_eq!(loaded.starting_xi_ids[0], "p1");
    }

    #[test]
    fn test_team_team_roles_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Roles FC");
        team.team_roles = domain::team::TeamRoles {
            captain: Some("p1".to_string()),
            shotcaller: Some("p2".to_string()),
        };

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.team_roles.captain.as_deref(), Some("p1"));
        assert_eq!(loaded.team_roles.shotcaller.as_deref(), Some("p2"));
    }

    #[test]
    fn test_team_sponsorship_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Sponsor FC");
        team.sponsorship = Some(Sponsorship {
            sponsor_name: "Acme Corp".to_string(),
            base_value: 100_000,
            remaining_weeks: 12,
            bonus_criteria: vec![SponsorshipBonusCriterion::UnbeatenRun {
                required_matches: 3,
                bonus_amount: 25_000,
            }],
        });

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        let sponsorship = loaded
            .sponsorship
            .expect("sponsorship should roundtrip through DB");
        assert_eq!(sponsorship.sponsor_name, "Acme Corp");
        assert_eq!(sponsorship.base_value, 100_000);
        assert_eq!(sponsorship.remaining_weeks, 12);
        assert!(matches!(
            sponsorship.bonus_criteria.as_slice(),
            [SponsorshipBonusCriterion::UnbeatenRun {
                required_matches: 3,
                bonus_amount: 25_000,
            }]
        ));
    }

    #[test]
    fn test_team_facilities_roundtrip() {
        let db = test_db();
        let mut team = sample_team("team-001", "Facilities FC");
        team.facilities = Facilities {
            training: 2,
            medical: 3,
            scouting: 4,
            ..Facilities::default()
        };

        upsert_team(db.conn(), &team).unwrap();
        let loaded = load_team(db.conn(), "team-001").unwrap().unwrap();

        assert_eq!(loaded.facilities.training, 2);
        assert_eq!(loaded.facilities.medical, 3);
        assert_eq!(loaded.facilities.scouting, 4);
    }
}
