CREATE TABLE IF NOT EXISTS champion_progression_state (
    id TEXT PRIMARY KEY CHECK (id = 'singleton'),
    champion_masteries_json TEXT NOT NULL,
    champion_patch_json TEXT NOT NULL
);
