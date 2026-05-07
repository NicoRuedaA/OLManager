use serde::{Deserialize, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

// Re-export both LolRole and Position for backward compatibility
pub use crate::stats::{LolRole, Position};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct Player {
    pub id: String,
    pub match_name: String,
    pub full_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    #[serde(default)]
    pub profile_image_url: Option<String>,

    /// Player's current role in the team (set by formation)
    pub position: LolRole,

    /// The player's natural/preferred role (never changed by formation logic)
    #[serde(default)]
    pub natural_position: LolRole,

    /// Alternate roles this player can also play (with reduced effectiveness)
    #[serde(default)]
    pub alternate_positions: Vec<LolRole>,

    /// Deprecated: LoL roles are lane-agnostic, footedness no longer affects ratings
    #[serde(default)]
    pub footedness: Footedness,

    #[serde(default = "default_weak_foot")]
    pub weak_foot: u8,

    // Core attributes 0-100
    pub attributes: PlayerAttributes,

    // Dynamic match/season values
    pub condition: u8, // 0-100 (short-term energy; depletes during matches, recovers daily)
    pub morale: u8,    // 0-100
    /// Long-term physical shape (0–100). Determines how fast condition depletes and
    /// recovers, and modulates injury risk. Changes slowly over weeks.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    pub injury: Option<Injury>,
    pub team_id: Option<String>,

    // Traits / flairs derived from attributes
    #[serde(default)]
    pub traits: Vec<PlayerTrait>,

    // Contract & value
    pub contract_end: Option<String>,
    pub wage: u32, // weekly wage
    pub market_value: u64,

    // Season stats
    pub stats: PlayerSeasonStats,

    // Career history
    pub career: Vec<CareerEntry>,

    // Individual training focus override (takes priority over group and team default)
    #[serde(default)]
    pub training_focus: Option<crate::team::TrainingFocus>,

    // Transfer status
    #[serde(default)]
    pub transfer_listed: bool,
    #[serde(default)]
    pub loan_listed: bool,
    #[serde(default)]
    pub transfer_offers: Vec<TransferOffer>,
    #[serde(default)]
    pub morale_core: PlayerMoraleCore,
    #[serde(default = "default_potential_base")]
    pub potential_base: u8,
    #[serde(default)]
    pub potential_revealed: Option<u8>,
    #[serde(default)]
    pub potential_research_started_on: Option<String>,
    #[serde(default)]
    pub potential_research_eta_days: Option<u8>,
    #[serde(default)]
    pub champion_training_target: Option<String>,
    #[serde(default)]
    pub champion_training_targets: Vec<String>,
}

/// Footedness is deprecated - LoL roles are lane-agnostic
/// Kept for backward compatibility with legacy save files
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum Footedness {
    Left,
    #[default]
    Right,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct PlayerAttributes {
    // Physical
    pub pace: u8,
    #[serde(alias = "stamina")]
    pub mental_resilience: u8,
    pub strength: u8,
    #[serde(default = "default_attr", alias = "agility")]
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
    #[serde(default = "default_attr", alias = "composure")]
    pub discipline: u8,
    #[serde(default = "default_attr")]
    pub aggression: u8,
    #[serde(default = "default_attr", alias = "teamwork")]
    pub teamfighting: u8,
    #[serde(default = "default_attr", alias = "leadership")]
    pub shotcalling: u8,

    // Goalkeeper
    #[serde(default = "default_attr")]
    pub handling: u8,
    #[serde(default = "default_attr")]
    pub reflexes: u8,
    #[serde(default = "default_attr")]
    pub aerial: u8,
}

fn default_attr() -> u8 {
    50
}

fn default_weak_foot() -> u8 {
    2
}

fn default_fitness() -> u8 {
    75
}

fn default_potential_base() -> u8 {
    99
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct Injury {
    pub name: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum PlayerIssueCategory {
    Contract,
    PlayingTime,
    Morale,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct PlayerIssue {
    pub category: PlayerIssueCategory,
    pub severity: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct RecentTreatmentMemory {
    pub action_key: String,
    pub times_recently_used: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum PlayerPromiseKind {
    PlayingTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum RenewalSessionStatus {
    #[default]
    Idle,
    Open,
    Agreed,
    Blocked,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum RenewalSessionOutcome {
    #[default]
    None,
    AcceptedByManager,
    AcceptedByAssistant,
    RejectedByPlayer,
    BlockedByManager,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct ContractRenewalState {
    pub status: RenewalSessionStatus,
    pub manager_blocked_until: Option<String>,
    pub last_attempt_date: Option<String>,
    pub last_assistant_attempt_date: Option<String>,
    pub last_outcome: Option<RenewalSessionOutcome>,
    pub conversation_round: u8,
}

impl Default for ContractRenewalState {
    fn default() -> Self {
        Self {
            status: RenewalSessionStatus::Idle,
            manager_blocked_until: None,
            last_attempt_date: None,
            last_assistant_attempt_date: None,
            last_outcome: None,
            conversation_round: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct PlayerPromise {
    pub kind: PlayerPromiseKind,
    pub matches_remaining: u8,
}

impl Default for PlayerPromise {
    fn default() -> Self {
        Self {
            kind: PlayerPromiseKind::PlayingTime,
            matches_remaining: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct PlayerMoraleCore {
    pub manager_trust: u8,
    pub unresolved_issue: Option<PlayerIssue>,
    pub recent_treatment: Option<RecentTreatmentMemory>,
    pub pending_promise: Option<PlayerPromise>,
    pub talk_cooldown_until: Option<String>,
    pub renewal_state: Option<ContractRenewalState>,
}

impl Default for PlayerMoraleCore {
    fn default() -> Self {
        Self {
            manager_trust: 50,
            unresolved_issue: None,
            recent_treatment: None,
            pending_promise: None,
            talk_cooldown_until: None,
            renewal_state: None,
        }
    }
}

fn default_transfer_offer_status() -> TransferOfferStatus {
    TransferOfferStatus::Pending
}

fn default_transfer_offer_date() -> String {
    String::new()
}

fn default_transfer_offer_round() -> u8 {
    0
}

fn default_transfer_offer_destination_team_id() -> Option<String> {
    None
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct PlayerSeasonStats {
    pub appearances: u32,
    pub kills: u32,
    pub assists: u32,
    pub clean_sheets: u32,
    pub avg_rating: f32,
    pub minutes_played: u32,
    pub shots: u32,
    pub shots_on_target: u32,
    pub passes_completed: u32,
    pub passes_attempted: u32,
    pub tackles_won: u32,
    pub interceptions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct CareerEntry {
    pub season: u32,
    pub team_id: String,
    pub team_name: String,
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct TransferOffer {
    pub id: String,
    pub from_team_id: String,
    #[serde(default = "default_transfer_offer_destination_team_id")]
    pub destination_team_id: Option<String>,
    pub fee: u64,
    pub wage_offered: u32,
    #[serde(default)]
    pub last_manager_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_round")]
    pub negotiation_round: u8,
    #[serde(default)]
    pub suggested_counter_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_status")]
    pub status: TransferOfferStatus,
    #[serde(default = "default_transfer_offer_date")]
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum TransferOfferStatus {
    Pending,
    Accepted,
    Rejected,
    Withdrawn,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum PlayerTrait {
    // Mechanics
    #[serde(alias = "Speedster")]
    LightningQuick, // mechanics >= 85
    #[serde(alias = "Tank")]
    Immovable, // durability >= 85 && stamina >= 75
    #[serde(alias = "Agile")]
    NimbleFingers, // mechanics >= 85
    #[serde(alias = "Tireless")]
    MarathonMan, // stamina >= 90
    // Game Knowledge
    #[serde(alias = "Playmaker")]
    GameManager, // game_knowledge >= 80 && macro_play >= 80
    #[serde(alias = "Sharpshooter")]
    Lethal, // laning >= 85
    #[serde(alias = "Dribbler")]
    KiteMaster, // mechanics >= 85
    #[serde(alias = "BallWinner")]
    Interceptor, // teamfight >= 80 && aggression >= 70
    #[serde(alias = "Rock")]
    Sentinel, // laning >= 85 && macro_play >= 75
    // Mental
    #[serde(alias = "Leader")]
    ShotCaller, // shotcalling >= 85 && teamfight >= 75
    #[serde(alias = "CoolHead")]
    IceCold, // consistency >= 85 && decisions >= 80
    #[serde(alias = "Visionary")]
    Visionary, // macro_play >= 85
    #[serde(alias = "HotHead")]
    Intimidator, // aggression >= 85 && discipline < 50
    #[serde(alias = "TeamPlayer")]
    TeamPlayer, // teamfight >= 85
    // Special
    #[serde(alias = "CompleteForward")]
    HyperCarry, // laning >= 75 && mechanics >= 75 && consistency >= 70
    #[serde(alias = "Engine")]
    Workhorse, // stamina >= 85 && consistency >= 70 && teamfight >= 75
    #[serde(alias = "SetPieceSpecialist")]
    MacroSpecialist, // game_knowledge >= 80 && laning >= 75 && macro_play >= 75
}

/// Derive traits purely from a player's attributes (role-independent).
pub fn compute_traits(attrs: &PlayerAttributes, _role: &LolRole) -> Vec<PlayerTrait> {
    let mut traits = Vec::new();

    // Mechanics
    if attrs.pace >= 85 {
        traits.push(PlayerTrait::LightningQuick);
    }
    if attrs.strength >= 85 && attrs.mental_resilience >= 75 {
        traits.push(PlayerTrait::Immovable);
    }
    if attrs.champion_pool >= 85 {
        traits.push(PlayerTrait::NimbleFingers);
    }
    if attrs.mental_resilience >= 90 {
        traits.push(PlayerTrait::MarathonMan);
    }

    // Game Knowledge
    if attrs.passing >= 80 && attrs.macro_play >= 80 {
        traits.push(PlayerTrait::GameManager);
    }
    if attrs.laning >= 85 {
        traits.push(PlayerTrait::Lethal);
    }
    if attrs.mechanics >= 85 {
        traits.push(PlayerTrait::KiteMaster);
    }
    if attrs.tackling >= 80 && attrs.aggression >= 70 {
        traits.push(PlayerTrait::Interceptor);
    }
    if attrs.defending >= 85 && attrs.positioning >= 75 {
        traits.push(PlayerTrait::Sentinel);
    }

    // Mental
    if attrs.shotcalling >= 85 && attrs.teamfighting >= 75 {
        traits.push(PlayerTrait::ShotCaller);
    }
    if attrs.discipline >= 85 && attrs.consistency >= 80 {
        traits.push(PlayerTrait::IceCold);
    }
    if attrs.macro_play >= 85 {
        traits.push(PlayerTrait::Visionary);
    }
    if attrs.aggression >= 85 && attrs.discipline < 50 {
        traits.push(PlayerTrait::Intimidator);
    }
    if attrs.teamfighting >= 85 {
        traits.push(PlayerTrait::TeamPlayer);
    }

    // Special — purely attribute-based
    if attrs.laning >= 75 && attrs.mechanics >= 75 && attrs.pace >= 70 && attrs.strength >= 70 {
        traits.push(PlayerTrait::HyperCarry);
    }
    if attrs.mental_resilience >= 85 && attrs.pace >= 70 && attrs.teamfighting >= 75 {
        traits.push(PlayerTrait::Workhorse);
    }
    if attrs.passing >= 80 && attrs.laning >= 75 && attrs.macro_play >= 75 {
        traits.push(PlayerTrait::MacroSpecialist);
    }

    traits
}

impl Player {
    pub fn new<R: Into<LolRole>>(
        id: String,
        match_name: String,
        full_name: String,
        date_of_birth: String,
        nationality: String,
        role: R,
        attributes: PlayerAttributes,
    ) -> Self {
        let role: LolRole = role.into();
        let traits = compute_traits(&attributes, &role);
        let birth_country = crate::identity::derive_birth_country_code(&nationality);
        Self {
            id,
            match_name,
            full_name,
            date_of_birth,
            nationality,
            birth_country,
            profile_image_url: None,
            natural_position: role,
            position: role,
            alternate_positions: Vec::new(),
            footedness: Footedness::default(),
            weak_foot: default_weak_foot(),
            attributes,
            condition: 100,
            morale: 100,
            fitness: 75,
            injury: None,
            team_id: None,
            traits,
            contract_end: None,
            wage: 0,
            market_value: 0,
            stats: PlayerSeasonStats::default(),
            career: Vec::new(),
            training_focus: None,
            transfer_listed: false,
            loan_listed: false,
            transfer_offers: Vec::new(),
            morale_core: PlayerMoraleCore::default(),
            potential_base: default_potential_base(),
            potential_revealed: None,
            potential_research_started_on: None,
            potential_research_eta_days: None,
            champion_training_target: None,
            champion_training_targets: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_attributes() -> PlayerAttributes {
        PlayerAttributes {
            pace: 70,
            mental_resilience: 72,
            strength: 65,
            champion_pool: 68,
            passing: 74,
            laning: 61,
            tackling: 58,
            mechanics: 69,
            defending: 56,
            positioning: 67,
            macro_play: 73,
            consistency: 71,
            discipline: 66,
            aggression: 54,
            teamfighting: 76,
            shotcalling: 49,
            handling: 20,
            reflexes: 24,
            aerial: 44,
        }
    }

    #[test]
    fn player_new_defaults_footedness_and_weak_foot() {
        let player = Player::new(
            "p-001".to_string(),
            "J. Smith".to_string(),
            "John Smith".to_string(),
            "2000-01-15".to_string(),
            "GB".to_string(),
            LolRole::Mid,
            sample_attributes(),
        );

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
    }

    #[test]
    fn legacy_football_position_deserializes_to_lol_role() {
        // Test that legacy Position strings are correctly mapped to LolRole
        // "Midfielder" (legacy) -> LolRole::Jungle (as per spec)
        let player: Player = serde_json::from_value(serde_json::json!({
            "id": "p-legacy",
            "match_name": "J. Legacy",
            "full_name": "John Legacy",
            "date_of_birth": "2000-01-15",
            "nationality": "GB",
            "position": "Midfielder",
            "natural_position": "Midfielder",
            "alternate_positions": [],
            "attributes": sample_attributes(),
            "condition": 100,
            "morale": 100,
            "injury": null,
            "team_id": null,
            "traits": [],
            "contract_end": null,
            "wage": 0,
            "market_value": 0,
            "stats": {},
            "career": [],
            "transfer_listed": false,
            "loan_listed": false,
            "transfer_offers": [],
            "morale_core": {}
        }))
        .expect("legacy player json should deserialize");

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
        // "Midfielder" should map to LolRole::Jungle per the spec
        assert_eq!(player.natural_position, LolRole::Jungle);
        assert_eq!(player.potential_base, 99);
        assert_eq!(player.potential_revealed, None);
    }

    #[test]
    fn new_lol_role_string_deserializes_directly() {
        // Test that new LolRole strings deserialize correctly
        let player: Player = serde_json::from_value(serde_json::json!({
            "id": "p-new",
            "match_name": "J. New",
            "full_name": "John New",
            "date_of_birth": "2000-01-15",
            "nationality": "GB",
            "position": "Top",
            "natural_position": "Top",
            "alternate_positions": ["Jungle", "Mid"],
            "attributes": sample_attributes(),
            "condition": 100,
            "morale": 100,
            "injury": null,
            "team_id": null,
            "traits": [],
            "contract_end": null,
            "wage": 0,
            "market_value": 0,
            "stats": {},
            "career": [],
            "transfer_listed": false,
            "loan_listed": false,
            "transfer_offers": [],
            "morale_core": {}
        }))
        .expect("new player json should deserialize");

        assert_eq!(player.position, LolRole::Top);
        assert_eq!(player.natural_position, LolRole::Top);
        assert_eq!(
            player.alternate_positions,
            vec![LolRole::Jungle, LolRole::Mid]
        );
    }
}
