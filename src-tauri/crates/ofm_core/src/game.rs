use crate::champions::{ChampionMasteryEntry, ChampionPatchState};
use crate::clock::GameClock;
use domain::league::League;
use domain::manager::Manager;
use domain::message::InboxMessage;
use domain::news::NewsArticle;
use domain::player::Player;
use domain::season::SeasonContext;
use domain::social::{SocialAccount, SocialPost, SocialTemplate};
use domain::staff::Staff;
use domain::team::Team;
use domain::transfer_history::TransferHistory;
#[cfg(feature = "typescript")]
use ts_rs::TS;

use crate::generator::definitions::ScheduleConfig;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum DayPhase {
    #[default]
    Morning,
    ScrimBlock,
    ReviewBlock,
    TrainingBlock,
    Evening,
}

impl DayPhase {
    pub fn as_id(&self) -> &'static str {
        match self {
            Self::Morning => "Morning",
            Self::ScrimBlock => "ScrimBlock",
            Self::ReviewBlock => "ReviewBlock",
            Self::TrainingBlock => "TrainingBlock",
            Self::Evening => "Evening",
        }
    }

    pub fn from_id(value: &str) -> Self {
        match value {
            "ScrimBlock" => Self::ScrimBlock,
            "ReviewBlock" => Self::ReviewBlock,
            "TrainingBlock" => Self::TrainingBlock,
            "Evening" => Self::Evening,
            _ => Self::Morning,
        }
    }

    pub fn next(&self) -> Self {
        match self {
            Self::Morning => Self::ScrimBlock,
            Self::ScrimBlock => Self::ReviewBlock,
            Self::ReviewBlock => Self::TrainingBlock,
            Self::TrainingBlock => Self::Evening,
            Self::Evening => Self::Evening,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum ObjectiveType {
    LeaguePosition,
    Wins,
    GoalsScored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct BoardObjective {
    pub id: String,
    pub description: String,
    pub target: u32,
    pub objective_type: ObjectiveType,
    pub met: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ScoutingAssignment {
    pub id: String,
    pub scout_id: String,
    pub player_id: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct Game {
    pub clock: GameClock,
    #[serde(default)]
    pub day_phase: DayPhase,
    pub manager: Manager,
    pub teams: Vec<Team>,
    pub players: Vec<Player>,
    pub staff: Vec<Staff>,
    pub messages: Vec<InboxMessage>,
    #[serde(default)]
    pub news: Vec<NewsArticle>,
    #[serde(default)]
    pub social_posts: Vec<SocialPost>,
    #[serde(default)]
    pub social_accounts: Vec<SocialAccount>,
    #[serde(default)]
    pub social_templates: Vec<SocialTemplate>,
    /// Multi-league storage. The first element is the player's active league.
    #[serde(default)]
    pub leagues: Vec<League>,
    /// The competition_id of the player's active league.
    #[serde(default)]
    pub user_competition_id: Option<String>,
    #[serde(default)]
    pub scouting_assignments: Vec<ScoutingAssignment>,
    #[serde(default)]
    pub board_objectives: Vec<BoardObjective>,
    #[serde(default)]
    pub season_context: SeasonContext,
    #[serde(default)]
    pub days_since_last_job_offer: Option<u32>,
    #[serde(default)]
    pub champion_masteries: Vec<ChampionMasteryEntry>,
    #[serde(default)]
    pub champion_patch: ChampionPatchState,
    #[serde(default)]
    pub competition_configs: HashMap<String, ScheduleConfig>,
    #[serde(default)]
    pub transfer_history: TransferHistory,
}

// Custom Deserialize for backward compatibility with old saves that have `league` field.
impl<'de> Deserialize<'de> for Game {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct GameLegacy {
            pub clock: GameClock,
            #[serde(default)]
            pub day_phase: DayPhase,
            pub manager: Manager,
            pub teams: Vec<Team>,
            pub players: Vec<Player>,
            pub staff: Vec<Staff>,
            pub messages: Vec<InboxMessage>,
            #[serde(default)]
            pub news: Vec<NewsArticle>,
            #[serde(default)]
            pub social_posts: Vec<SocialPost>,
            #[serde(default)]
            pub social_accounts: Vec<SocialAccount>,
            #[serde(default)]
            pub social_templates: Vec<SocialTemplate>,
            #[serde(default)]
            pub leagues: Vec<League>,
            /// Legacy field — read from old saves, merged into `leagues`.
            #[serde(default)]
            pub league: Option<League>,
            #[serde(default)]
            pub scouting_assignments: Vec<ScoutingAssignment>,
            #[serde(default)]
            pub board_objectives: Vec<BoardObjective>,
            #[serde(default)]
            pub season_context: SeasonContext,
            #[serde(default)]
            pub days_since_last_job_offer: Option<u32>,
            #[serde(default)]
            pub champion_masteries: Vec<ChampionMasteryEntry>,
            #[serde(default)]
            pub champion_patch: ChampionPatchState,
            #[serde(default)]
            pub competition_configs: HashMap<String, ScheduleConfig>,
            #[serde(default)]
            pub user_competition_id: Option<String>,
            #[serde(default)]
            pub transfer_history: TransferHistory,
        }

        let legacy = GameLegacy::deserialize(deserializer)?;
        let mut leagues = legacy.leagues;
        if leagues.is_empty() {
            if let Some(legacy_league) = legacy.league {
                leagues.push(legacy_league);
            }
        }

        Ok(Game {
            clock: legacy.clock,
            day_phase: legacy.day_phase,
            manager: legacy.manager,
            teams: legacy.teams,
            players: legacy.players,
            staff: legacy.staff,
            messages: legacy.messages,
            news: legacy.news,
            social_posts: legacy.social_posts,
            social_accounts: legacy.social_accounts,
            social_templates: legacy.social_templates,
            leagues,
            user_competition_id: legacy.user_competition_id,
            scouting_assignments: legacy.scouting_assignments,
            board_objectives: legacy.board_objectives,
            season_context: legacy.season_context,
            days_since_last_job_offer: legacy.days_since_last_job_offer,
            champion_masteries: legacy.champion_masteries,
            champion_patch: legacy.champion_patch,
            competition_configs: legacy.competition_configs,
            transfer_history: legacy.transfer_history,
        })
    }
}

impl Game {
    pub fn new(
        clock: GameClock,
        manager: Manager,
        teams: Vec<Team>,
        players: Vec<Player>,
        staff: Vec<Staff>,
        messages: Vec<InboxMessage>,
    ) -> Self {
        let mut game = Self {
            clock,
            day_phase: DayPhase::Morning,
            manager,
            teams,
            players,
            staff,
            messages,
            news: vec![],
            social_posts: vec![],
            social_accounts: vec![],
            social_templates: vec![],
            leagues: vec![],
            user_competition_id: None,
            scouting_assignments: vec![],
            board_objectives: vec![],
            season_context: SeasonContext::default(),
            days_since_last_job_offer: None,
            champion_masteries: vec![],
            champion_patch: ChampionPatchState::default(),
            competition_configs: HashMap::new(),
            transfer_history: TransferHistory::default(),
        };
        crate::identity_upgrade::upgrade_game_football_identities(&mut game);
        crate::season_context::refresh_game_context(&mut game);
        game
    }

    /// Returns a reference to the player's active league, identified by
    /// `user_competition_id`. Falls back to `leagues.first()` if not set.
    pub fn active_league(&self) -> Option<&League> {
        self.user_competition_id
            .as_ref()
            .and_then(|cid| self.leagues.iter().find(|l| l.competition_id.as_deref() == Some(cid)))
            .or_else(|| self.leagues.first())
    }

    /// Returns a mutable reference to the player's active league.
    pub fn active_league_mut(&mut self) -> Option<&mut League> {
        let cid = self.user_competition_id.clone();
        if let Some(ref cid) = cid {
            if let Some(pos) = self.leagues.iter().position(|l| l.competition_id.as_deref() == Some(cid)) {
                return self.leagues.get_mut(pos);
            }
        }
        self.leagues.first_mut()
    }

    /// Returns the index of the player's active league.
    pub fn active_league_index(&self) -> usize {
        self.user_competition_id
            .as_ref()
            .and_then(|cid| self.leagues.iter().position(|l| l.competition_id.as_deref() == Some(cid)))
            .unwrap_or(0)
    }
}
