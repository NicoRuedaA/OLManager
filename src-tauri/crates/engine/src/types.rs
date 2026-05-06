use serde::{Deserialize, Serialize};

// Re-export LolRole from live_match module for use in this crate
pub use crate::live_match::LolRole;

// ---------------------------------------------------------------------------
// PlayStyle — mirrors domain::team::PlayStyle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayStyle {
    Balanced,
    Attacking,
    Defensive,
    Possession,
    Counter,
    HighPress,
}

// ---------------------------------------------------------------------------
// PlayerData — a snapshot of a player for engine consumption
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerData {
    pub id: String,
    pub name: String,
    /// Player's LoL role (Top, Jungle, Mid, Adc, Support)
    pub role: LolRole,
    pub condition: u8, // 0-100
    /// Long-term physical shape (0-100). Multiplies stamina depletion rate in-match.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    // Physical
    pub pace: u8,
    #[serde(alias = "stamina")]
    pub mental_resilience: u8,
    pub strength: u8,
    #[serde(default = "default_engine_attr", alias = "agility")]
    pub champion_pool: u8,

    // Technical
    pub passing: u8,
    #[serde(alias = "shooting")]
    pub laning: u8,
    pub tackling: u8,
    #[serde(alias = "dribbling")]
    pub mechanics: u8,
    pub defending: u8,

    // Mental
    pub positioning: u8,
    #[serde(alias = "vision")]
    pub macro_play: u8,
    #[serde(alias = "decisions")]
    pub consistency: u8,
    #[serde(default = "default_engine_attr", alias = "composure")]
    pub discipline: u8,
    #[serde(default = "default_engine_attr")]
    pub aggression: u8,
    #[serde(default = "default_engine_attr", alias = "teamwork")]
    pub teamfighting: u8,
    #[serde(default = "default_engine_attr", alias = "leadership")]
    pub shotcalling: u8,

    // Goalkeeper
    #[serde(default = "default_engine_attr")]
    pub handling: u8,
    #[serde(default = "default_engine_attr")]
    pub reflexes: u8,
    #[serde(default = "default_engine_attr")]
    pub aerial: u8,

    // Traits (string names matching domain::player::PlayerTrait variants)
    #[serde(default)]
    pub traits: Vec<String>,
}

fn default_engine_attr() -> u8 {
    50
}

fn default_fitness() -> u8 {
    75
}

impl PlayerData {
    /// Overall rating (simple mean of 9 visible LoL stats, matching calculate_lol_ovr).
    pub fn overall(&self) -> f64 {
        (self.mechanics as f64
            + self.laning as f64
            + self.teamfighting as f64
            + self.macro_play as f64
            + self.consistency as f64
            + self.shotcalling as f64
            + self.champion_pool as f64
            + self.discipline as f64
            + self.mental_resilience as f64)
            / 9.0
    }

    /// Effective rating accounting for current condition (0-100).
    pub fn effective_overall(&self) -> f64 {
        self.overall() * (self.condition as f64 / 100.0)
    }
}

// ---------------------------------------------------------------------------
// TeamData — everything the engine needs to know about one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamData {
    pub id: String,
    pub name: String,
    pub formation: String,
    pub play_style: PlayStyle,
    pub players: Vec<PlayerData>,
}

impl TeamData {
    /// Count players by role.
    pub fn count_role(&self, role: LolRole) -> usize {
        self.players.iter().filter(|p| p.role == role).count()
    }

    /// Average of a specific attribute among players in the given role.
    pub fn role_attr_avg(&self, role: LolRole, attr_fn: fn(&PlayerData) -> u8) -> f64 {
        let players: Vec<_> = self.players.iter().filter(|p| p.role == role).collect();
        if players.is_empty() {
            return 40.0; // fallback
        }
        players.iter().map(|p| attr_fn(p) as f64).sum::<f64>() / players.len() as f64
    }

    /// Composite defense rating (from Top + Support).
    pub fn defense_rating(&self) -> f64 {
        let top_avg = self.role_attr_avg(LolRole::Top, |p| {
            ((p.defending as u16 + p.tackling as u16 + p.positioning as u16 + p.strength as u16)
                / 4) as u8
        });
        let support_avg = self.role_attr_avg(LolRole::Support, |p| {
            ((p.macro_play as u16 + p.positioning as u16 + p.teamfighting as u16) / 3) as u8
        });
        top_avg * 0.7 + support_avg * 0.3
    }

    /// Composite mid/jungle rating.
    pub fn midfield_rating(&self) -> f64 {
        let mid_avg = self.role_attr_avg(LolRole::Mid, |p| {
            ((p.passing as u16 + p.macro_play as u16 + p.consistency as u16 + p.mental_resilience as u16) / 4) as u8
        });
        let jg_avg = self.role_attr_avg(LolRole::Jungle, |p| {
            ((p.consistency as u16 + p.macro_play as u16 + p.positioning as u16) / 3) as u8
        });
        mid_avg * 0.6 + jg_avg * 0.4
    }

    /// Composite attack rating (from ADC + Mid).
    pub fn attack_rating(&self) -> f64 {
        let adc_avg = self.role_attr_avg(LolRole::Adc, |p| {
            ((p.laning as u16 + p.mechanics as u16 + p.pace as u16 + p.positioning as u16) / 4)
                as u8
        });
        let mid_contrib = self.role_attr_avg(LolRole::Mid, |p| {
            ((p.laning as u16 + p.passing as u16 + p.macro_play as u16) / 3) as u8
        });
        adc_avg * 0.75 + mid_contrib * 0.25
    }

    /// Support contribution rating (Vision + Teamwork).
    pub fn support_rating(&self) -> f64 {
        self.role_attr_avg(LolRole::Support, |p| {
            ((p.macro_play as u16 + p.positioning as u16 + p.teamfighting as u16 + p.passing as u16) / 4)
                as u8
        })
    }
}

// ---------------------------------------------------------------------------
// MatchConfig — tuneable simulation parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchConfig {
    /// Multiplier applied to the home team's ratings (e.g. 1.08 = 8% boost).
    pub home_advantage: f64,
    /// Base probability that a shot from the box is on target (0.0–1.0).
    pub shot_accuracy_base: f64,
    /// Per-minute fatigue factor applied to condition.
    pub fatigue_per_minute: f64,
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            home_advantage: 1.03,
            shot_accuracy_base: 0.45,
            fatigue_per_minute: 0.20,
        }
    }
}

// ---------------------------------------------------------------------------
// Side — which side of the match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    Home,
    Away,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::Home => Side::Away,
            Side::Away => Side::Home,
        }
    }
}

// ---------------------------------------------------------------------------
// Zone — regions of the pitch from the perspective of the match (not a team)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Zone {
    HomeBox,
    HomeDefense,
    Midfield,
    AwayDefense,
    AwayBox,
}

impl Zone {
    /// The attacking zone for a given side (where they score).
    pub fn attacking_box(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayBox,
            Side::Away => Zone::HomeBox,
        }
    }

    /// The attacking third for a given side.
    pub fn attacking_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayDefense,
            Side::Away => Zone::HomeDefense,
        }
    }

    /// The defensive third for a given side.
    pub fn defensive_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::HomeDefense,
            Side::Away => Zone::AwayDefense,
        }
    }

    /// Advance the ball one zone towards the given side's goal.
    pub fn advance_towards(self, attacking_side: Side) -> Zone {
        match attacking_side {
            Side::Home => match self {
                Zone::HomeBox => Zone::HomeDefense,
                Zone::HomeDefense => Zone::Midfield,
                Zone::Midfield => Zone::AwayDefense,
                Zone::AwayDefense => Zone::AwayBox,
                Zone::AwayBox => Zone::AwayBox,
            },
            Side::Away => match self {
                Zone::AwayBox => Zone::AwayDefense,
                Zone::AwayDefense => Zone::Midfield,
                Zone::Midfield => Zone::HomeDefense,
                Zone::HomeDefense => Zone::HomeBox,
                Zone::HomeBox => Zone::HomeBox,
            },
        }
    }

    /// Is this zone the attacking box for the given side?
    pub fn is_box_for(self, attacking_side: Side) -> bool {
        self == Zone::attacking_box(attacking_side)
    }
}
