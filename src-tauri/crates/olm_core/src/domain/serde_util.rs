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

/// Deserialize an integer field that may arrive as a float or `null`.
///
/// Exported data sometimes stores money fields like `wage`/`market_value` as
/// floats (`41.4`); strict `u32`/`u64` parsing rejects them and drops the whole
/// record. This rounds floats and treats `null`/missing as `0`.
pub fn lenient_u32<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<f64>::deserialize(deserializer)?;
    Ok(value
        .map(|n| n.round().clamp(0.0, u32::MAX as f64) as u32)
        .unwrap_or(0))
}

/// Like [`lenient_u32`] but for `u64` fields (e.g. `market_value`).
pub fn lenient_u64<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<f64>::deserialize(deserializer)?;
    Ok(value
        .map(|n| n.round().clamp(0.0, u64::MAX as f64) as u64)
        .unwrap_or(0))
}
