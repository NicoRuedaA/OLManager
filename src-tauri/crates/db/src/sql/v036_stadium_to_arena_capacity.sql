-- V36: Rename stadium_capacity to arena_capacity for LoL terminology
ALTER TABLE teams ADD COLUMN arena_capacity INTEGER;
UPDATE teams SET arena_capacity = COALESCE(stadium_capacity, 0) WHERE arena_capacity IS NULL;