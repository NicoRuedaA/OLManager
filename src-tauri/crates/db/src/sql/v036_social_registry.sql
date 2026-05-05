CREATE TABLE IF NOT EXISTS social_accounts (
    id                  TEXT PRIMARY KEY,
    language            TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    handle              TEXT NOT NULL,
    author_type         TEXT NOT NULL,
    profile_image_url   TEXT,
    favorite_team_ids   TEXT NOT NULL DEFAULT '[]',
    active              INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS social_templates (
    id                  TEXT PRIMARY KEY,
    language            TEXT NOT NULL,
    slot                TEXT NOT NULL,
    author_id           TEXT,
    conditions_json     TEXT NOT NULL DEFAULT '{}',
    variants            TEXT NOT NULL DEFAULT '[]',
    tags                TEXT NOT NULL DEFAULT '[]',
    weight              INTEGER NOT NULL DEFAULT 1,
    active              INTEGER NOT NULL DEFAULT 1
);
