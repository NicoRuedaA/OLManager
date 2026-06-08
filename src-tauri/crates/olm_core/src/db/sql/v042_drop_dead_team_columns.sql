-- ═══════════════════════════════════════════════════════════════════════════
-- V42: Eliminar columnas muertas de teams
--
-- Tres columnas confirmadas como muertas:
--
--   football_nation   — añadida en v014. v039 limpió players/managers/staff
--                       pero olvidó teams. El struct Team no tiene este campo,
--                       team_repo.rs no la lee ni escribe.
--
--   match_roles       — añadida en v006. Reemplazada conceptualmente por
--                       team_roles en v041. El upsert nunca la actualiza,
--                       el SELECT nunca la lee.
--
--   nationality_code  — añadida a teams en v030. El struct domain::team::Team
--                       no tiene este campo. team_repo.rs no la lee ni escribe.
--                       (players/managers/staff sí la usan; solo teams es vestigio)
--
-- Todas las columnas activas en team_repo.rs se conservan sin cambios.
-- Las posiciones posicionales de row.get(N) quedan intactas y validadas.
--
-- SQLite no soporta DROP COLUMN para versiones anteriores a 3.35, por lo que
-- se reconstruye la tabla con el patrón estándar CREATE/INSERT/DROP/RENAME.
--
-- El runner de Rust ejecuta estos counts para validar la migración:
--   SELECT COUNT(*) FROM teams;   -- before (runner verifica)
--   SELECT COUNT(*) FROM teams;   -- after  (runner verifica)
-- Si antes ≠ después, hay un bug en el INSERT y el save está corrupto.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE teams_new (
    id                          TEXT    PRIMARY KEY,
    name                        TEXT    NOT NULL,
    short_name                  TEXT    NOT NULL,
    country                     TEXT    NOT NULL,
    city                        TEXT    NOT NULL,
    stadium_name                  TEXT    NOT NULL,
    stadium_capacity              INTEGER NOT NULL DEFAULT 0,
    finance                     INTEGER NOT NULL DEFAULT 1000000,
    manager_id                  TEXT,
    reputation                  INTEGER NOT NULL DEFAULT 500,
    wage_budget                 INTEGER NOT NULL DEFAULT 0,
    transfer_budget             INTEGER NOT NULL DEFAULT 0,
    season_income               INTEGER NOT NULL DEFAULT 0,
    season_expenses             INTEGER NOT NULL DEFAULT 0,
    formation                   TEXT    NOT NULL DEFAULT '',
    play_style                  TEXT    NOT NULL DEFAULT 'Balanced',
    training_focus              TEXT    NOT NULL DEFAULT 'Physical',
    training_intensity          TEXT    NOT NULL DEFAULT 'Medium',
    training_schedule           TEXT    NOT NULL DEFAULT 'Balanced',
    founded_year                INTEGER NOT NULL DEFAULT 1900,
    colors_primary              TEXT    NOT NULL DEFAULT '#10b981',
    colors_secondary            TEXT    NOT NULL DEFAULT '#ffffff',
    starting_xi_ids             TEXT    NOT NULL DEFAULT '[]',
    team_roles                  TEXT    NOT NULL DEFAULT '{"captain":null,"shotcaller":null}',
    form                        TEXT    NOT NULL DEFAULT '[]',
    history                     TEXT    NOT NULL DEFAULT '[]',
    training_groups             TEXT    NOT NULL DEFAULT '[]',
    weekly_scrim_opponent_ids   TEXT    NOT NULL DEFAULT '[]',
    scrim_loss_streak           INTEGER NOT NULL DEFAULT 0,
    scrim_weekly_played         INTEGER NOT NULL DEFAULT 0,
    scrim_weekly_wins           INTEGER NOT NULL DEFAULT 0,
    scrim_weekly_losses         INTEGER NOT NULL DEFAULT 0,
    scrim_slot_results          TEXT    NOT NULL DEFAULT '[]',
    financial_ledger            TEXT    NOT NULL DEFAULT '[]',
    sponsorship                 TEXT    NOT NULL DEFAULT 'null',
    facilities                  TEXT    NOT NULL DEFAULT '{"training":1,"medical":1,"scouting":1}',
    team_kind                   TEXT    NOT NULL DEFAULT 'Main',
    parent_team_id              TEXT,
    academy_team_id             TEXT,
    academy_metadata            TEXT
);

INSERT INTO teams_new SELECT
    id, name, short_name, country, city,
    stadium_name, stadium_capacity,
    finance, manager_id, reputation,
    wage_budget, transfer_budget, season_income, season_expenses,
    formation, play_style,
    training_focus, training_intensity, training_schedule,
    founded_year, colors_primary, colors_secondary,
    starting_xi_ids, team_roles,
    form, history, training_groups,
    weekly_scrim_opponent_ids, scrim_loss_streak,
    scrim_weekly_played, scrim_weekly_wins, scrim_weekly_losses,
    scrim_slot_results,
    financial_ledger, sponsorship, facilities,
    team_kind, parent_team_id, academy_team_id, academy_metadata
FROM teams;

DROP TABLE teams;
ALTER TABLE teams_new RENAME TO teams;

CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_kind  ON teams(team_kind);
