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
#[cfg(feature = "typescript")]
use ts_rs::TS;

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub league: Option<League>,
    #[serde(default)]
    pub academy_league: Option<League>,
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
            league: None,
            academy_league: None,
            scouting_assignments: vec![],
            board_objectives: vec![],
            season_context: SeasonContext::default(),
            days_since_last_job_offer: None,
            champion_masteries: vec![],
            champion_patch: ChampionPatchState::default(),
        };
        crate::identity_upgrade::upgrade_game_football_identities(&mut game);
        crate::season_context::refresh_game_context(&mut game);
        game
    }
}
