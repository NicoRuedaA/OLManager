-- V37: Rename legacy football stats tables to _deprecated_ prefix.
-- These tables (player_match_stats, team_match_stats) were superseded
-- by lol_player_match_stats and lol_team_match_stats in V21.
-- Keep them as _deprecated_ for one migration cycle to allow rollback.
ALTER TABLE player_match_stats RENAME TO _deprecated_player_match_stats;
ALTER TABLE team_match_stats RENAME TO _deprecated_team_match_stats;