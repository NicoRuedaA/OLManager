-- V36: Rename stadium_capacity to stadium_capacity for LoL terminology
ALTER TABLE teams ADD COLUMN stadium_capacity INTEGER;
UPDATE teams SET stadium_capacity = COALESCE(stadium_capacity, 0) WHERE stadium_capacity IS NULL;