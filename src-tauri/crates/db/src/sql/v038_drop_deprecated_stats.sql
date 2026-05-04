-- V38: Drop deprecated legacy football stats tables.
-- These tables were renamed in V37. After confirming nothing breaks,
-- they can be safely removed.
DROP TABLE IF EXISTS _deprecated_player_match_stats;
DROP TABLE IF EXISTS _deprecated_team_match_stats;