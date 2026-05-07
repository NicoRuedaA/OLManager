-- V52: Multi-competition schema
-- JSON blob storage for Competition domain model.
-- Single table stores entire Competition serialized as JSON,
-- mirroring the game_meta.game_data pattern for simplicity.

CREATE TABLE IF NOT EXISTS competitions (
    id          TEXT PRIMARY KEY,
    data_json   TEXT NOT NULL DEFAULT '{}'
);
