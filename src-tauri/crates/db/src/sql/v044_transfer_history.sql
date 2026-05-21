CREATE TABLE IF NOT EXISTS transfer_history (
    id TEXT PRIMARY KEY CHECK (id = 'singleton'),
    entries_json TEXT NOT NULL DEFAULT '[]'
);
