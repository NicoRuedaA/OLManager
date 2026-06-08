-- ═══════════════════════════════════════════════════════════════════════════
-- V55: Drop injury column from players table
--
-- The injury mechanic is a football (OpenFootManager) remnant. LoL esports
-- has no injuries. The field has already been removed from the domain model
-- and frontend types. This migration drops the column from the DB.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE players DROP COLUMN injury;
