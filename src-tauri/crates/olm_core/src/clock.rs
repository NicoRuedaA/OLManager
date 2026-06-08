use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct GameClock {
    #[cfg_attr(feature = "typescript", ts(type = "string"))]
    pub current_date: DateTime<Utc>,
    #[cfg_attr(feature = "typescript", ts(type = "string"))]
    pub start_date: DateTime<Utc>,
}

impl GameClock {
    pub fn new(start_date: DateTime<Utc>) -> Self {
        Self {
            current_date: start_date,
            start_date,
        }
    }

    pub fn advance_days(&mut self, days: i64) {
        self.current_date += Duration::days(days);
    }

    pub fn get_date(&self) -> DateTime<Utc> {
        self.current_date
    }
}
