-- V39: Remove football_nation column from players, managers, and staff tables.
-- SQLite does not support DROP COLUMN, so we recreate each table.
-- Assumes nationality_code, competitive_region, profile_image_url, and avatar_path
-- columns already exist (added by earlier migrations/hooks).
-- Preserves all existing data and indexes.

-- ── Players ──────────────────────────────────────────────

CREATE TABLE players_new (
    id                  TEXT PRIMARY KEY,
    match_name          TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    position            TEXT NOT NULL,
    attributes          TEXT NOT NULL,
    condition           INTEGER NOT NULL DEFAULT 100,
    morale              INTEGER NOT NULL DEFAULT 100,
    injury              TEXT,
    team_id             TEXT,
    traits              TEXT NOT NULL DEFAULT '[]',
    contract_end        TEXT,
    wage                INTEGER NOT NULL DEFAULT 0,
    market_value        INTEGER NOT NULL DEFAULT 0,
    stats               TEXT NOT NULL DEFAULT '{}',
    career              TEXT NOT NULL DEFAULT '[]',
    transfer_listed     INTEGER NOT NULL DEFAULT 0,
    loan_listed         INTEGER NOT NULL DEFAULT 0,
    transfer_offers     TEXT NOT NULL DEFAULT '[]',
    alternate_positions TEXT NOT NULL DEFAULT '[]',
    natural_position    TEXT NOT NULL DEFAULT 'Unknown',
    training_focus      TEXT,
    morale_core         TEXT NOT NULL DEFAULT '{}',
    footedness          TEXT NOT NULL DEFAULT 'Right',
    weak_foot           INTEGER NOT NULL DEFAULT 1,
    fitness             INTEGER NOT NULL DEFAULT 75,
    birth_country       TEXT,
    nationality_code    TEXT NOT NULL DEFAULT '',
    competitive_region  TEXT,
    potential_base      INTEGER NOT NULL DEFAULT 50,
    potential_revealed  INTEGER,
    potential_research_started_on TEXT,
    potential_research_eta_days   INTEGER,
    profile_image_url   TEXT
);

INSERT INTO players_new SELECT
    id, match_name, full_name, date_of_birth, nationality, position,
    attributes, condition, morale, injury, team_id, traits,
    contract_end, wage, market_value, stats, career,
    transfer_listed, loan_listed, transfer_offers,
    alternate_positions, natural_position, training_focus, morale_core,
    footedness, weak_foot, fitness, birth_country,
    COALESCE(nationality_code, ''), competitive_region,
    COALESCE(potential_base, 50), potential_revealed,
    potential_research_started_on, potential_research_eta_days,
    profile_image_url
FROM players;

DROP TABLE players;
ALTER TABLE players_new RENAME TO players;

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_nationality ON players(nationality);
CREATE INDEX IF NOT EXISTS idx_players_nationality_code ON players(nationality_code);

-- ── Managers ─────────────────────────────────────────────

CREATE TABLE managers_new (
    id              TEXT PRIMARY KEY,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   TEXT NOT NULL,
    nationality     TEXT NOT NULL,
    reputation      INTEGER NOT NULL DEFAULT 500,
    satisfaction    INTEGER NOT NULL DEFAULT 100,
    fan_approval    INTEGER NOT NULL DEFAULT 50,
    team_id         TEXT,
    career_stats    TEXT NOT NULL DEFAULT '{}',
    career_history  TEXT NOT NULL DEFAULT '[]',
    warning_stage   INTEGER NOT NULL DEFAULT 0,
    nickname        TEXT NOT NULL DEFAULT '',
    avatar_path     TEXT,
    birth_country   TEXT,
    nationality_code TEXT NOT NULL DEFAULT '',
    competitive_region TEXT
);

INSERT INTO managers_new SELECT
    id, first_name, last_name, date_of_birth, nationality,
    reputation, satisfaction, fan_approval, team_id,
    career_stats, career_history, warning_stage,
    nickname, avatar_path, birth_country,
    COALESCE(nationality_code, ''), competitive_region
FROM managers;

DROP TABLE managers;
ALTER TABLE managers_new RENAME TO managers;

-- ── Staff ────────────────────────────────────────────────

CREATE TABLE staff_new (
    id                  TEXT PRIMARY KEY,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    role                TEXT NOT NULL,
    attributes          TEXT NOT NULL,
    team_id             TEXT,
    specialization      TEXT,
    wage                INTEGER NOT NULL DEFAULT 0,
    contract_end        TEXT,
    birth_country       TEXT,
    nationality_code    TEXT NOT NULL DEFAULT '',
    competitive_region  TEXT,
    profile_image_url   TEXT
);

INSERT INTO staff_new SELECT
    id, first_name, last_name, date_of_birth, nationality,
    role, attributes, team_id, specialization,
    wage, contract_end, birth_country,
    COALESCE(nationality_code, ''), competitive_region,
    profile_image_url
FROM staff;

DROP TABLE staff;
ALTER TABLE staff_new RENAME TO staff;

-- Staff indexes
CREATE INDEX IF NOT EXISTS idx_staff_team_id ON staff(team_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);