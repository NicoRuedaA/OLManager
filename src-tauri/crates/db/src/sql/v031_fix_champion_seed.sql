-- V31: Fix champion seed data (re-seed champions table)
-- This is idempotent - safe to run on existing databases
DELETE FROM champions;
-- Re-insert will happen via game_database.rs ensure_champions()