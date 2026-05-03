-- V41: Add team_roles column (replaces match_roles)
-- match_roles is kept as a legacy column (SQLite can't easily DROP COLUMN)
ALTER TABLE teams ADD COLUMN team_roles TEXT NOT NULL DEFAULT '{"captain":null,"shotcaller":null}';
