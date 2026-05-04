/// Derive a birth country code from a nationality string.
/// Returns None for GB/British (ambiguous — could be England, Scotland, etc.).
pub fn derive_birth_country_code(value: &str) -> Option<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "eng" | "england" | "english" => Some("ENG".to_string()),
        "sco" | "scotland" | "scottish" => Some("SCO".to_string()),
        "wal" | "wales" | "welsh" => Some("WAL".to_string()),
        "nir" | "northern ireland" | "northern irish" => Some("NIR".to_string()),
        "ie" | "ireland" | "irish" | "republic of ireland" => Some("IE".to_string()),
        "gb" | "british" | "uk" | "united kingdom" | "great britain" => None,
        other => {
            if other.len() <= 3 {
                Some(other.to_ascii_uppercase())
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_known_nationalities() {
        assert_eq!(derive_birth_country_code("English"), Some("ENG".to_string()));
        assert_eq!(derive_birth_country_code("Scotland"), Some("SCO".to_string()));
        assert_eq!(derive_birth_country_code("Welsh"), Some("WAL".to_string()));
        assert_eq!(derive_birth_country_code("Northern Irish"), Some("NIR".to_string()));
        assert_eq!(derive_birth_country_code("Irish"), Some("IE".to_string()));
    }

    #[test]
    fn british_returns_none() {
        assert_eq!(derive_birth_country_code("British"), None);
        assert_eq!(derive_birth_country_code("GB"), None);
        assert_eq!(derive_birth_country_code("English"), Some("ENG".to_string()));
    }
}
