-- V52: Multi-competition schema support
--
-- Creates competitions and seasons tables, adds competition_id to
-- existing fixtures/standings tables for multi-competition routing.
--
-- All new columns are NOT NULL with empty string default for backward
-- compat with existing saves. The migration hook backfills the
-- competition_id from the legacy league table after this SQL runs.

-- Competitions table: one row per competition/league
CREATE TABLE IF NOT EXISTS competitions (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    full_name       TEXT,
    region          TEXT NOT NULL DEFAULT '',
    country         TEXT,
    tier            INTEGER NOT NULL DEFAULT 1,
    logo            TEXT,
    teams_file      TEXT NOT NULL DEFAULT '',
    players_file    TEXT NOT NULL DEFAULT '',
    schedule_config TEXT,                     -- JSON: ScheduleConfig
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seasons table: historical season tracking per competition
CREATE TABLE IF NOT EXISTS seasons (
    id              TEXT PRIMARY KEY,
    competition_id  TEXT NOT NULL DEFAULT '',
    season_number   INTEGER NOT NULL,
    phase           TEXT NOT NULL DEFAULT 'Regular',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add competition_id to fixtures for multi-competition routing
-- NOT NULL DEFAULT '' is backfilled by the migration hook from league.id
ALTER TABLE fixtures ADD COLUMN competition_id TEXT NOT NULL DEFAULT '';

-- Add competition_id to standings for multi-competition lookup
ALTER TABLE standings ADD COLUMN competition_id TEXT NOT NULL DEFAULT '';

-- Indexes for competition-based lookups
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_id ON fixtures(competition_id);
CREATE INDEX IF NOT EXISTS idx_standings_competition_id ON standings(competition_id);
CREATE INDEX IF NOT EXISTS idx_seasons_competition_id ON seasons(competition_id);
