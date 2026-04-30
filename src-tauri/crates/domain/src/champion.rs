use serde::{Deserialize, Serialize};

/// Represents a League of Legends champion stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Champion {
    pub id: i64,
    pub name: String,
    pub champion_key: String,
    pub roles_json: String,
    pub counterpicks_json: Option<String>,
    pub synergies_json: Option<String>,
    pub image_tile_url: Option<String>,
    pub image_splash_url: Option<String>,
}

/// Input for creating a new champion (without id, which is auto-generated).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewChampion {
    pub name: String,
    pub champion_key: String,
    pub roles_json: String,
    pub counterpicks_json: Option<String>,
    pub synergies_json: Option<String>,
    pub image_tile_url: Option<String>,
    pub image_splash_url: Option<String>,
}
