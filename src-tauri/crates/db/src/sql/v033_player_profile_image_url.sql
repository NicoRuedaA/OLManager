-- V33: Add profile_image_url column to players table
-- Old saves don't have this column, causing load_all_players to fail
-- Add it with NULL default for backwards compatibility

ALTER TABLE players ADD COLUMN profile_image_url TEXT;