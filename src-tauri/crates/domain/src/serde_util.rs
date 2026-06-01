//! Small serde helpers shared across domain types.

use serde::{Deserialize, Deserializer};

/// Deserialize a value that may be `null` into its `Default`.
///
/// Exported data sometimes carries `null` for fields the engine models as a
/// plain (non-optional) value — e.g. `date_of_birth: null` or
/// `colors.secondary: null`. With `#[serde(default)]` alone serde still errors
/// on an explicit `null`; this accepts it and falls back to the default.
pub fn null_to_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    Ok(Option::<T>::deserialize(deserializer)?.unwrap_or_default())
}
