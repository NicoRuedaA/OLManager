use serde::{Deserialize, Deserializer, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

fn deserialize_null_to_empty<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(|opt| opt.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct Staff {
    pub id: String,
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default, deserialize_with = "deserialize_null_to_empty")]
    pub date_of_birth: String,
    #[serde(default)]
    pub nationality: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    #[serde(default)]
    pub profile_image_url: Option<String>,
    pub role: StaffRole,

    // Attributes 0-100
    #[serde(default)]
    pub attributes: StaffAttributes,
    pub team_id: Option<String>,

    // Contract & finances
    #[serde(default)]
    pub wage: u32,
    #[serde(default)]
    pub contract_end: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum StaffRole {
    #[serde(alias = "Assistant")]
    AssistantManager,
    #[serde(alias = "HeadCoach", alias = "Analyst", alias = "Performance Coach")]
    Coach,
    Scout,
    Physio,
    Owner,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct StaffAttributes {
    pub coaching: u8,
    pub judging_ability: u8,
    pub judging_potential: u8,
    pub physiotherapy: u8,
}

impl Staff {
    pub fn new(
        id: String,
        first_name: String,
        last_name: String,
        date_of_birth: String,
        role: StaffRole,
        attributes: StaffAttributes,
    ) -> Self {
        Self {
            id,
            first_name,
            last_name,
            date_of_birth,
            nationality: String::new(),
            birth_country: None,
            profile_image_url: None,
            role,
            attributes,
            team_id: None,
            wage: 0,
            contract_end: None,
        }
    }
}
