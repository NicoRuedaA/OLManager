-- V35: Rename stadium_name to arena_name for LoL terminology
-- This handles old saves that still have stadium_name
ALTER TABLE teams ADD COLUMN arena_name TEXT;
UPDATE teams SET arena_name = COALESCE(stadium_name, 'Unknown Arena') WHERE arena_name IS NULL;