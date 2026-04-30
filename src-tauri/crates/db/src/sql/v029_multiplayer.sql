-- V29: Add multiplayer support fields to game_meta table.
-- Enables 2-player hotseat and online modes.

-- Add player2_manager_id for second player's manager
ALTER TABLE game_meta ADD COLUMN player2_manager_id TEXT;

-- Add multiplayer_mode (offline, hotseat, online)
ALTER TABLE game_meta ADD COLUMN multiplayer_mode TEXT DEFAULT 'offline';

-- Add room_code for online mode
ALTER TABLE game_meta ADD COLUMN room_code TEXT;

-- Note: player1_day_ready and player2_day_ready are runtime-only flags,
-- not persisted to database (reset after each day advancement)
