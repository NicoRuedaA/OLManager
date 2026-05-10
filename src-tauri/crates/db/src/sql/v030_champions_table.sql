CREATE TABLE IF NOT EXISTS champions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    champion_key TEXT NOT NULL,
    roles_json TEXT NOT NULL,
    counterpicks_json TEXT,
    synergies_json TEXT,
    image_tile_url TEXT,
    image_splash_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_champions_key ON champions(champion_key);
CREATE INDEX IF NOT EXISTS idx_champions_name ON champions(name);