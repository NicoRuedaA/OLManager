-- V35: Rename stadium_name to stadium_name for LoL terminology
-- This handles old saves that still have stadium_name
ALTER TABLE teams ADD COLUMN stadium_name TEXT;
UPDATE teams SET stadium_name = COALESCE(stadium_name, 'Unknown Arena') WHERE stadium_name IS NULL;