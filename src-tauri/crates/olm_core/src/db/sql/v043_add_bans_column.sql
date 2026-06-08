-- V43: Add bans_json column to lol_player_match_stats for ban rate tracking
-- Stores a JSON array of banned champion keys per match fixture.
-- Each player row in the same fixture gets the same bans list.
ALTER TABLE lol_player_match_stats ADD COLUMN bans_json TEXT NOT NULL DEFAULT '[]';
