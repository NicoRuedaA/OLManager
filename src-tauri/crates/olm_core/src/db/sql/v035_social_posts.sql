CREATE TABLE IF NOT EXISTS social_posts (
    id              TEXT PRIMARY KEY,
    date            TEXT NOT NULL,
    author_name     TEXT NOT NULL,
    author_handle   TEXT NOT NULL,
    author_type     TEXT NOT NULL,
    body            TEXT NOT NULL,
    likes           INTEGER NOT NULL DEFAULT 0,
    reposts         INTEGER NOT NULL DEFAULT 0,
    replies         INTEGER NOT NULL DEFAULT 0,
    sentiment       TEXT NOT NULL,
    category        TEXT NOT NULL,
    tags            TEXT NOT NULL DEFAULT '[]',
    team_ids        TEXT NOT NULL DEFAULT '[]',
    player_ids      TEXT NOT NULL DEFAULT '[]',
    fixture_id      TEXT,
    read            INTEGER NOT NULL DEFAULT 0
);
