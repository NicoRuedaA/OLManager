-- V57: Add was_released flag to players (tracks contract termination)
-- Released players are excluded from end-of-season free agent re-assignment.
ALTER TABLE players ADD COLUMN was_released INTEGER NOT NULL DEFAULT 0;
