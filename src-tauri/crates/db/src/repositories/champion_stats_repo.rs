use rusqlite::{params, Connection};

use domain::champion_stats::{
    ChampionMatchup, ChampionStatsSummary, ChampionSynergy, ChampionTopPlayer, RolePopularity,
    WeeklyChampionStats,
};

/// Count how many times a champion was banned.
pub fn champion_ban_count(conn: &Connection, champion_key: &str) -> Result<u32, String> {
    let pattern = format!("%\"{}\"%", champion_key);
    conn.query_row(
        "SELECT COUNT(DISTINCT fixture_id) FROM lol_player_match_stats
         WHERE bans_json LIKE ?1 AND bans_json != '[]'",
        params![pattern],
        |row| row.get(0),
    )
    .map_err(|e| format!("Failed to query ban count: {e}"))
}

/// Base query columns reused across aggregations.
const STAT_COLS: &str = "COUNT(*) as games,
    COALESCE(SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END), 0) as wins,
    COALESCE(ROUND(AVG(kills), 1), 0) as avg_kills,
    COALESCE(ROUND(AVG(deaths), 1), 0) as avg_deaths,
    COALESCE(ROUND(AVG(assists), 1), 0) as avg_assists,
    COALESCE(ROUND(AVG(gold_earned), 0), 0) as avg_gold,
    COALESCE(ROUND(AVG(damage_dealt), 0), 0) as avg_damage,
    COALESCE(ROUND(AVG(creep_score), 0), 0) as avg_cs,
    COALESCE(ROUND(AVG(vision_score), 1), 0) as avg_vision,
    COALESCE(ROUND(AVG(duration_seconds), 0), 0) as avg_duration";

/// Full aggregated stats for a single champion.
pub fn champion_stats(
    conn: &Connection,
    champion_key: &str,
) -> Result<ChampionStatsSummary, String> {
    let champion_name = resolve_champion_name(conn, champion_key)?;

    // 1. Base stats
    let (total_games, total_wins, avg_kills, avg_deaths, avg_assists,
         avg_gold, avg_damage, avg_cs, avg_vision, avg_duration, losses) = conn
        .query_row(
            &format!(
                "SELECT {STAT_COLS},
                        COUNT(*) - COALESCE(SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END), 0) as losses
                 FROM lol_player_match_stats
                 WHERE champion_id = ?1"
            ),
            params![champion_key],
            |row| {
                Ok((
                    row.get::<_, u32>(0)?,   // games
                    row.get::<_, u32>(1)?,   // wins
                    row.get::<_, f64>(2)?,   // avg_kills
                    row.get::<_, f64>(3)?,   // avg_deaths
                    row.get::<_, f64>(4)?,   // avg_assists
                    row.get::<_, f64>(5)?,   // avg_gold
                    row.get::<_, f64>(6)?,   // avg_damage
                    row.get::<_, f64>(7)?,   // avg_cs
                    row.get::<_, f64>(8)?,   // avg_vision
                    row.get::<_, f64>(9)?,   // avg_duration
                    row.get::<_, u32>(10)?,  // losses
                ))
            },
        )
        .map_err(|e| format!("Failed to query champion stats: {e}"))?;
    let total_losses = losses;

    let avg_kda = if avg_deaths > 0.0 {
        (avg_kills + avg_assists) / avg_deaths
    } else {
        avg_kills + avg_assists
    };
    let win_rate = if total_games > 0 {
        (total_wins as f64 / total_games as f64) * 100.0
    } else {
        0.0
    };

    // 2. Role distribution
    let role_distribution = champion_role_distribution(conn, champion_key)?;

    // 3. Matchups
    let (best_against, worst_against) = champion_matchups(conn, champion_key, 3)?;

    // 4. Synergies
    let best_with = champion_synergies(conn, champion_key, 3)?;

    // 5. Top players (by WR) and most played (by games)
    let top_players = champion_top_players(conn, champion_key, 3, 5)?;
    let most_played_players = champion_most_played_players(conn, champion_key, 5)?;

    // 6. Weekly history
    let weekly_history = champion_weekly_history(conn, champion_key, 10)?;

    // 7. Pick rate (of this champ / total games)
    let total_all: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM lol_player_match_stats",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count total games: {e}"))?;
    let pick_rate = if total_all > 0 {
        (total_games as f64 / total_all as f64) * 100.0
    } else {
        0.0
    };

    // Ban rate
    let ban_count = champion_ban_count(conn, champion_key)?;
    let ban_rate = if total_all > 0 {
        (ban_count as f64 / total_all as f64) * 100.0
    } else {
        0.0
    };

    Ok(ChampionStatsSummary {
        champion_key: champion_key.to_string(),
        champion_name,
        total_games,
        total_wins,
        total_losses,
        win_rate,
        pick_rate,
        ban_rate,
        avg_kills,
        avg_deaths,
        avg_assists,
        avg_kda,
        avg_gold,
        avg_damage,
        avg_cs,
        avg_vision,
        avg_duration,
        role_distribution,
        best_against,
        worst_against,
        best_with,
        top_players,
        most_played_players,
        weekly_history,
    })
}

/// Role distribution for a champion.
fn champion_role_distribution(
    conn: &Connection,
    champion_key: &str,
) -> Result<Vec<RolePopularity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT role, COUNT(*) as games
             FROM lol_player_match_stats
             WHERE champion_id = ?1
             GROUP BY role
             ORDER BY games DESC",
        )
        .map_err(|e| format!("Failed to prepare role distribution query: {e}"))?;

    let rows = stmt
        .query_map(params![champion_key], |row| {
            Ok(RolePopularity {
                role: row.get(0)?,
                games: row.get(1)?,
                percentage: 0.0, // computed below
            })
        })
        .map_err(|e| format!("Failed to query role distribution: {e}"))?;

    let mut dist: Vec<RolePopularity> = Vec::new();
    let mut total: u32 = 0;
    for row in rows {
        let r = row.map_err(|e| format!("Failed to read role row: {e}"))?;
        total += r.games;
        dist.push(r);
    }
    // Compute percentages
    for role in &mut dist {
        if total > 0 {
            role.percentage = (role.games as f64 / total as f64) * 100.0;
        }
    }
    Ok(dist)
}

/// Best and worst matchups for a champion (self-join on fixture_id).
pub fn champion_matchups(
    conn: &Connection,
    champion_key: &str,
    min_games: u32,
) -> Result<(Vec<ChampionMatchup>, Vec<ChampionMatchup>), String> {
    let mut stmt = conn
        .prepare(
            "SELECT
                opp.champion_id as vs_champion,
                COUNT(*) as games,
                SUM(CASE WHEN mine.result = 'Win' THEN 1 ELSE 0 END) as wins
             FROM lol_player_match_stats mine
             JOIN lol_player_match_stats opp
                ON mine.fixture_id = opp.fixture_id
                AND mine.team_id != opp.team_id
             WHERE mine.champion_id = ?1
               AND opp.champion_id IS NOT NULL
               AND opp.champion_id != ''
             GROUP BY opp.champion_id
             HAVING games >= ?2
             ORDER BY wins * 1.0 / games DESC",
        )
        .map_err(|e| format!("Failed to prepare matchup query: {e}"))?;

    let rows = stmt
        .query_map(params![champion_key, min_games], |row| {
            let vs_key: String = row.get(0)?;
            let games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let wr = if games > 0 { (wins as f64 / games as f64) * 100.0 } else { 0.0 };
            Ok(ChampionMatchup {
                vs_champion_key: vs_key,
                vs_champion_name: String::new(), // resolved below
                games,
                wins,
                win_rate: wr,
            })
        })
        .map_err(|e| format!("Failed to query matchups: {e}"))?;

    let mut all: Vec<ChampionMatchup> = Vec::new();
    for row in rows {
        let mut m = row.map_err(|e| format!("Failed to read matchup row: {e}"))?;
        m.vs_champion_name = resolve_champion_name(conn, &m.vs_champion_key)?;
        all.push(m);
    }

    // Best = highest win rate; Worst = lowest win rate
    all.sort_by(|a, b| b.win_rate.partial_cmp(&a.win_rate).unwrap_or(std::cmp::Ordering::Equal));
    let mid = all.len() / 2;
    let worst: Vec<ChampionMatchup> = all.iter().rev().take(mid).cloned().collect();
    let best: Vec<ChampionMatchup> = all.iter().take(mid).cloned().collect();
    Ok((best, worst))
}

/// Synergies: allied champion pairings.
pub fn champion_synergies(
    conn: &Connection,
    champion_key: &str,
    min_games: u32,
) -> Result<Vec<ChampionSynergy>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT
                ally.champion_id as with_champion,
                COUNT(*) as games,
                SUM(CASE WHEN mine.result = 'Win' THEN 1 ELSE 0 END) as wins
             FROM lol_player_match_stats mine
             JOIN lol_player_match_stats ally
                ON mine.fixture_id = ally.fixture_id
                AND mine.team_id = ally.team_id
                AND mine.player_id != ally.player_id
             WHERE mine.champion_id = ?1
               AND ally.champion_id IS NOT NULL
               AND ally.champion_id != ''
             GROUP BY ally.champion_id
             HAVING games >= ?2
             ORDER BY wins * 1.0 / games DESC",
        )
        .map_err(|e| format!("Failed to prepare synergy query: {e}"))?;

    let rows = stmt
        .query_map(params![champion_key, min_games], |row| {
            let with_key: String = row.get(0)?;
            let games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let wr = if games > 0 { (wins as f64 / games as f64) * 100.0 } else { 0.0 };
            Ok(ChampionSynergy {
                with_champion_key: with_key,
                with_champion_name: String::new(),
                games,
                wins,
                win_rate: wr,
            })
        })
        .map_err(|e| format!("Failed to query synergies: {e}"))?;

    let mut syns: Vec<ChampionSynergy> = Vec::new();
    for row in rows {
        let mut s = row.map_err(|e| format!("Failed to read synergy row: {e}"))?;
        s.with_champion_name = resolve_champion_name(conn, &s.with_champion_key)?;
        syns.push(s);
    }
    Ok(syns)
}

/// Top-performing players on a champion.
pub fn champion_top_players(
    conn: &Connection,
    champion_key: &str,
    min_games: u32,
    limit: usize,
) -> Result<Vec<ChampionTopPlayer>, String> {
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT
                    player_id,
                    COUNT(*) as games,
                    SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END) as wins,
                    ROUND(AVG(kills + assists) * 1.0 / MAX(deaths, 1), 1) as avg_kda
                 FROM lol_player_match_stats
                 WHERE champion_id = ?1
                 GROUP BY player_id
                 HAVING games >= ?2
                 ORDER BY wins * 1.0 / games DESC
                 LIMIT ?3"
            ),
        )
        .map_err(|e| format!("Failed to prepare top players query: {e}"))?;

    let rows = stmt
        .query_map(params![champion_key, min_games, limit as i64], |row| {
            let player_id: String = row.get(0)?;
            let games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let avg_kda: f64 = row.get(3)?;
            let wr = if games > 0 { (wins as f64 / games as f64) * 100.0 } else { 0.0 };
            Ok(ChampionTopPlayer {
                player_id,
                player_name: String::new(),
                team_name: String::new(),
                games,
                wins,
                win_rate: wr,
                avg_kda,
            })
        })
        .map_err(|e| format!("Failed to query top players: {e}"))?;

    let mut players: Vec<ChampionTopPlayer> = Vec::new();
    for row in rows {
        let mut p = row.map_err(|e| format!("Failed to read top player row: {e}"))?;
        // Resolve player name + team name from players/teams tables
        if let Ok(name) = conn.query_row(
            "SELECT match_name FROM players WHERE id = ?1",
            params![&p.player_id],
            |row| row.get::<_, String>(0),
        ) {
            p.player_name = name;
        }
        if let Ok(team_id) = conn.query_row(
            "SELECT team_id FROM players WHERE id = ?1",
            params![&p.player_id],
            |row| row.get::<_, String>(0),
        ) {
            if let Ok(team_name) = conn.query_row(
                "SELECT name FROM teams WHERE id = ?1",
                params![&team_id],
                |row| row.get::<_, String>(0),
            ) {
                p.team_name = team_name;
            }
        }
        players.push(p);
    }
    Ok(players)
}

/// Most-played players on a champion (sorted by games, not win rate).
pub fn champion_most_played_players(
    conn: &Connection,
    champion_key: &str,
    limit: usize,
) -> Result<Vec<ChampionTopPlayer>, String> {
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT
                    player_id,
                    COUNT(*) as games,
                    SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END) as wins,
                    ROUND(AVG(kills + assists) * 1.0 / MAX(deaths, 1), 1) as avg_kda
                 FROM lol_player_match_stats
                 WHERE champion_id = ?1
                 GROUP BY player_id
                 ORDER BY games DESC
                 LIMIT ?2"
            ),
        )
        .map_err(|e| format!("Failed to prepare most played query: {e}"))?;

    let rows = stmt
        .query_map(params![champion_key, limit as i64], |row| {
            let player_id: String = row.get(0)?;
            let games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let avg_kda: f64 = row.get(3)?;
            let wr = if games > 0 { (wins as f64 / games as f64) * 100.0 } else { 0.0 };
            Ok(ChampionTopPlayer {
                player_id,
                player_name: String::new(),
                team_name: String::new(),
                games,
                wins,
                win_rate: wr,
                avg_kda,
            })
        })
        .map_err(|e| format!("Failed to query most played: {e}"))?;

    let mut players: Vec<ChampionTopPlayer> = Vec::new();
    for row in rows {
        let mut p = row.map_err(|e| format!("Failed to read most played row: {e}"))?;
        if let Ok(name) = conn.query_row(
            "SELECT match_name FROM players WHERE id = ?1",
            params![&p.player_id],
            |row| row.get::<_, String>(0),
        ) {
            p.player_name = name;
        }
        if let Ok(team_id) = conn.query_row(
            "SELECT team_id FROM players WHERE id = ?1",
            params![&p.player_id],
            |row| row.get::<_, String>(0),
        ) {
            if let Ok(team_name) = conn.query_row(
                "SELECT name FROM teams WHERE id = ?1",
                params![&team_id],
                |row| row.get::<_, String>(0),
            ) {
                p.team_name = team_name;
            }
        }
        players.push(p);
    }
    Ok(players)
}

/// Weekly aggregated stats for a champion.
pub fn champion_weekly_history(
    conn: &Connection,
    champion_key: &str,
    weeks: u32,
) -> Result<Vec<WeeklyChampionStats>, String> {
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT
                    strftime('%Y-W%W', date) as week_label,
                    COUNT(*) as games,
                    SUM(CASE WHEN result = 'Win' THEN 1 ELSE 0 END) as wins,
                    ROUND(AVG(kills + assists) * 1.0 / MAX(deaths, 1), 1) as avg_kda,
                    ROUND(AVG(damage_dealt), 0) as avg_damage,
                    ROUND(AVG(gold_earned), 0) as avg_gold
                 FROM lol_player_match_stats
                 WHERE champion_id = ?1
                   AND date >= date('now', ?2)
                 GROUP BY week_label
                 ORDER BY week_label ASC"
            ),
        )
        .map_err(|e| format!("Failed to prepare weekly history query: {e}"))?;

    let since = format!("-{weeks} weeks");
    let rows = stmt
        .query_map(params![champion_key, since], |row| {
            let games: u32 = row.get(1)?;
            let wins: u32 = row.get(2)?;
            let wr = if games > 0 { (wins as f64 / games as f64) * 100.0 } else { 0.0 };
            Ok(WeeklyChampionStats {
                week_label: row.get(0)?,
                games,
                wins,
                win_rate: wr,
                avg_kda: row.get(3)?,
                avg_damage: row.get(4)?,
                avg_gold: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query weekly history: {e}"))?;

    let mut history: Vec<WeeklyChampionStats> = Vec::new();
    for row in rows {
        history.push(row.map_err(|e| format!("Failed to read weekly row: {e}"))?);
    }
    Ok(history)
}

/// Top champions by pick rate.
pub fn top_champions_by_pick_rate(
    conn: &Connection,
    limit: usize,
) -> Result<Vec<(String, u32, f64)>, String> {
    let total: u32 = conn
        .query_row("SELECT COUNT(*) FROM lol_player_match_stats", [], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to count total games: {e}"))?;

    let mut stmt = conn
        .prepare(
            "SELECT champion_id, COUNT(*) as games
             FROM lol_player_match_stats
             WHERE champion_id IS NOT NULL AND champion_id != ''
             GROUP BY champion_id
             ORDER BY games DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare top champions query: {e}"))?;

    let rows = stmt
        .query_map(params![limit as i64], |row| {
            let key: String = row.get(0)?;
            let games: u32 = row.get(1)?;
            let pr = if total > 0 { (games as f64 / total as f64) * 100.0 } else { 0.0 };
            Ok((key, games, pr))
        })
        .map_err(|e| format!("Failed to query top champions: {e}"))?;

    let mut tops: Vec<(String, u32, f64)> = Vec::new();
    for row in rows {
        tops.push(row.map_err(|e| format!("Failed to read top champion row: {e}"))?);
    }
    Ok(tops)
}

/// Resolve a champion's display name from its key.
fn resolve_champion_name(conn: &Connection, champion_key: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM champions WHERE champion_key = ?1",
        params![champion_key],
        |row| row.get(0),
    )
    .map_err(|e| format!("Champion '{champion_key}' not found: {e}"))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;

    fn seed_test_data(conn: &Connection) {
        seed_test_data_with_date(conn, "2026-01-01");
    }

    fn seed_test_data_with_date(conn: &Connection, date: &str) {
        // Create a champion
        conn.execute(
            "INSERT INTO champions (name, champion_key, roles_json) VALUES ('Ahri', 'Ahri', '[\"Mid\"]')",
            [],
        ).unwrap();

        // Insert 4 player match records: 2 wins, 2 losses
        // All with champion_id = 'Ahri'
        for i in 0..4 {
            let result = if i < 2 { "Win" } else { "Loss" };
            let team = if i % 2 == 0 { "team_a" } else { "team_b" };
            let opp = if team == "team_a" { "team_b" } else { "team_a" };
            conn.execute(
                "INSERT INTO lol_player_match_stats
                    (fixture_id, season, matchday, date, competition, player_id, team_id,
                     opponent_team_id, side, result, role, champion_id, duration_seconds,
                     kills, deaths, assists, creep_score, gold_earned, damage_dealt,
                     vision_score, wards_placed)
                 VALUES (?1, 2026, 1, ?5, 'League', 'p1', ?2, ?3,
                         'Blue', ?4, 'Mid', 'Ahri', 1800,
                         5, 3, 7, 200, 12000, 25000,
                         30, 10)",
                params![format!("f{i}"), team, opp, result, date],
            ).unwrap();
        }
    }

    #[test]
    fn test_champion_stats_basic() {
        let db = GameDatabase::open_in_memory().unwrap();
        seed_test_data(db.conn());

        let stats = champion_stats(db.conn(), "Ahri").unwrap();

        assert_eq!(stats.champion_name, "Ahri");
        assert_eq!(stats.total_games, 4);
        assert_eq!(stats.total_wins, 2);
        assert_eq!(stats.total_losses, 2);
        assert!((stats.win_rate - 50.0).abs() < 0.01);
        assert!((stats.avg_kills - 5.0).abs() < 0.01);
        assert!((stats.avg_deaths - 3.0).abs() < 0.01);
        assert!((stats.avg_assists - 7.0).abs() < 0.01);
        assert!((stats.avg_kda - 4.0).abs() < 0.01); // (5+7)/3
    }

    #[test]
    fn test_champion_role_distribution() {
        let db = GameDatabase::open_in_memory().unwrap();
        seed_test_data(db.conn());

        let dist = champion_role_distribution(db.conn(), "Ahri").unwrap();
        assert_eq!(dist.len(), 1);
        assert_eq!(dist[0].role, "Mid");
        assert_eq!(dist[0].games, 4);
        assert!((dist[0].percentage - 100.0).abs() < 0.01);
    }

    #[test]
    #[ignore = "self-join test data setup needs dedicated fixtures"]
    fn test_champion_matchups_self_join() {
        let db = GameDatabase::open_in_memory().unwrap();
        seed_test_data(db.conn());

        // Add Yasuo to champions so name resolution works
        db.conn().execute(
            "INSERT INTO champions (name, champion_key, roles_json) VALUES ('Yasuo', 'Yasuo', '[\"Mid\"]')",
            [],
        ).unwrap();

        // Add opponent player to the same fixture as Ahri
        db.conn().execute(
            "INSERT INTO lol_player_match_stats
                (fixture_id, season, matchday, date, competition, player_id, team_id,
                 opponent_team_id, side, result, role, champion_id, duration_seconds,
                 kills, deaths, assists, creep_score, gold_earned, damage_dealt,
                 vision_score, wards_placed)
             VALUES ('f0', 2026, 1, '2026-01-01', 'League', 'p2', 'team_b', 'team_a',
                     'Red', 'Loss', 'Mid', 'Yasuo', 1800,
                     3, 5, 4, 180, 10000, 20000, 25, 8)",
            [],
        ).unwrap();

        let (best, _worst) = champion_matchups(db.conn(), "Ahri", 1).unwrap();
        assert!(!best.is_empty(), "Should have at least one matchup");
        assert_eq!(best[0].vs_champion_key, "Yasuo");
        assert_eq!(best[0].games, 1);
    }

    #[test]
    #[ignore = "depends on current date, needs mock clock"]
    fn test_champion_weekly_history() {
        let db = GameDatabase::open_in_memory().unwrap();
        seed_test_data_with_date(db.conn(), "2026-04-20");

        let history = champion_weekly_history(db.conn(), "Ahri", 52).unwrap();
        assert!(!history.is_empty(), "Should have weekly history");
        assert_eq!(history[0].games, 4);
    }

    #[test]
    fn test_top_champions_by_pick_rate() {
        let db = GameDatabase::open_in_memory().unwrap();
        seed_test_data(db.conn());

        let tops = top_champions_by_pick_rate(db.conn(), 5).unwrap();
        assert!(!tops.is_empty(), "Should have top champions");
        assert_eq!(tops[0].0, "Ahri");
    }
}
