use crate::champions::{ChampionMasteryEntry, ChampionPatchState};
use crate::clock::GameClock;
use domain::league::League;
use domain::manager::Manager;
use domain::message::InboxMessage;
use domain::news::NewsArticle;
use domain::player::Player;
use domain::season::SeasonContext;
use domain::staff::Staff;
use domain::team::Team;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObjectiveType {
    LeaguePosition,
    Wins,
    GoalsScored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardObjective {
    pub id: String,
    pub description: String,
    pub target: u32,
    pub objective_type: ObjectiveType,
    pub met: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoutingAssignment {
    pub id: String,
    pub scout_id: String,
    pub player_id: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub clock: GameClock,
    pub manager: Manager,
    pub teams: Vec<Team>,
    pub players: Vec<Player>,
    pub staff: Vec<Staff>,
    pub messages: Vec<InboxMessage>,
    #[serde(default)]
    pub news: Vec<NewsArticle>,
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

    // ========== Multiplayer Support (Phase 1) ==========
    /// Second player's manager (None in single-player mode)
    #[serde(default)]
    pub player2_manager: Option<Manager>,

    /// Multiplayer mode: offline, hotseat, or online
    #[serde(default)]
    pub multiplayer_mode: MultiplayerMode,

    /// Which player's turn it is (1 or 2) - primarily for hotseat
    #[serde(default = "default_current_player")]
    pub current_player: u8,

    /// Day readiness flags (reset after each day advance)
    #[serde(default)]
    pub player1_day_ready: bool,
    #[serde(default)]
    pub player2_day_ready: bool,

    /// Room code for online mode (None in offline/hotseat)
    #[serde(default)]
    pub room_code: Option<String>,
}

fn default_current_player() -> u8 {
    1
}

/// Multiplayer game mode
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub enum MultiplayerMode {
    #[default]
    Offline,
    Hotseat,
    Online,
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
            manager,
            teams,
            players,
            staff,
            messages,
            news: vec![],
            league: None,
            academy_league: None,
            scouting_assignments: vec![],
            board_objectives: vec![],
            season_context: SeasonContext::default(),
            days_since_last_job_offer: None,
            champion_masteries: vec![],
            champion_patch: ChampionPatchState::default(),
            // Multiplayer fields (default to offline/single-player)
            player2_manager: None,
            multiplayer_mode: MultiplayerMode::Offline,
            current_player: 1,
            player1_day_ready: false,
            player2_day_ready: false,
            room_code: None,
        };
        crate::football_identity::upgrade_game_football_identities(&mut game);
        crate::season_context::refresh_game_context(&mut game);
        game
    }

    // ========== Multiplayer Helper Methods ==========

    /// Get manager for a given player number
    pub fn manager_for_player(&self, player_num: u8) -> Option<&Manager> {
        match player_num {
            1 => Some(&self.manager),
            2 => self.player2_manager.as_ref(),
            _ => None,
        }
    }

    /// Get mutable manager for a given player number
    pub fn manager_for_player_mut(&mut self, player_num: u8) -> Option<&mut Manager> {
        match player_num {
            1 => Some(&mut self.manager),
            2 => self.player2_manager.as_mut(),
            _ => None,
        }
    }

    /// Get manager by team_id (find which player owns this team)
    pub fn manager_for_team(&self, team_id: &str) -> Option<&Manager> {
        if self.manager.team_id.as_deref() == Some(team_id) {
            return Some(&self.manager);
        }
        if let Some(p2) = &self.player2_manager {
            if p2.team_id.as_deref() == Some(team_id) {
                return Some(p2);
            }
        }
        None
    }

    /// Get team_id for a given player
    pub fn team_id_for_player(&self, player_num: u8) -> Option<String> {
        self.manager_for_player(player_num)
            .and_then(|m| m.team_id.clone())
    }

    /// Check if both players are ready to advance day
    pub fn can_advance_day(&self) -> bool {
        match self.multiplayer_mode {
            MultiplayerMode::Offline => true, // Single player: always ready
            MultiplayerMode::Hotseat | MultiplayerMode::Online => {
                self.player1_day_ready && self.player2_day_ready
            }
        }
    }

    /// Mark player as ready and return whether day can advance
    pub fn mark_player_ready(&mut self, player_num: u8) -> bool {
        match player_num {
            1 => self.player1_day_ready = true,
            2 => self.player2_day_ready = true,
            _ => return false,
        }
        self.can_advance_day()
    }

    /// Reset readiness after day advance
    pub fn reset_day_readiness(&mut self) {
        self.player1_day_ready = false;
        self.player2_day_ready = false;
    }

    /// Switch current player (for hotseat mode)
    pub fn switch_current_player(&mut self) {
        self.current_player = if self.current_player == 1 { 2 } else { 1 };
    }

    /// Check if a team belongs to a human player (vs AI)
    pub fn is_human_team(&self, team_id: &str) -> bool {
        self.manager.team_id.as_deref() == Some(team_id)
            || self
                .player2_manager
                .as_ref()
                .map(|m| m.team_id.as_deref() == Some(team_id))
                .unwrap_or(false)
    }

    /// Get all human team IDs
    pub fn human_team_ids(&self) -> Vec<String> {
        let mut ids = Vec::new();
        if let Some(id) = &self.manager.team_id {
            ids.push(id.clone());
        }
        if let Some(id) = self
            .player2_manager
            .as_ref()
            .and_then(|m| m.team_id.clone())
        {
            ids.push(id);
        }
        ids
    }

    /// Check if game has multiplayer enabled
    pub fn is_multiplayer(&self) -> bool {
        self.multiplayer_mode != MultiplayerMode::Offline
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use chrono::Utc;
    use domain::manager::Manager;

    fn create_sample_game() -> Game {
        let start = Utc::now();
        let clock = GameClock::new(start);
        let mut manager = Manager::new(
            "Test".to_string(),
            "Manager".to_string(),
            "TM".to_string(),
            "ARG".to_string(),
            "2000-01-01".to_string(),
        );
        manager.id = "mgr-1".to_string();

        Game::new(clock, manager, vec![], vec![], vec![], vec![])
    }

    #[test]
    fn test_single_player_game_serialization() {
        let game = create_sample_game();
        let json = serde_json::to_string(&game).expect("Should serialize");
        let loaded: Game = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(loaded.manager.id, game.manager.id);
        assert!(loaded.player2_manager.is_none());
        assert_eq!(loaded.multiplayer_mode, MultiplayerMode::Offline);
        assert_eq!(loaded.current_player, 1);
    }

    #[test]
    fn test_multiplayer_game_serialization() {
        let mut game = create_sample_game();
        game.multiplayer_mode = MultiplayerMode::Hotseat;

        // Add a second manager
        let mut p2_manager = Manager::new(
            "Player".to_string(),
            "Two".to_string(),
            "P2".to_string(),
            "ESP".to_string(),
            "2000-02-02".to_string(),
        );
        p2_manager.id = "mgr-2".to_string();
        p2_manager.team_id = Some("team-2".to_string());
        game.player2_manager = Some(p2_manager);
        game.current_player = 2;

        let json = serde_json::to_string(&game).expect("Should serialize");
        let loaded: Game = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(loaded.manager.id, game.manager.id);
        assert!(loaded.player2_manager.is_some());
        assert_eq!(loaded.multiplayer_mode, MultiplayerMode::Hotseat);
        assert_eq!(loaded.current_player, 2);
    }

    #[test]
    fn test_can_advance_day() {
        // Single player: siempre puede avanzar
        let mut game = create_sample_game();
        game.player1_day_ready = true;
        assert!(game.can_advance_day());

        // Hotseat: ambos deben estar ready
        game.multiplayer_mode = MultiplayerMode::Hotseat;
        game.player1_day_ready = true;
        game.player2_day_ready = false;
        assert!(!game.can_advance_day());

        game.player2_day_ready = true;
        assert!(game.can_advance_day());
    }

    #[test]
    fn test_mark_player_ready() {
        let mut game = create_sample_game();
        game.multiplayer_mode = MultiplayerMode::Hotseat;

        // Player 1 ready
        assert!(!game.mark_player_ready(1));
        assert!(game.player1_day_ready);
        assert!(!game.player2_day_ready);

        // Player 2 ready - now can advance
        assert!(game.mark_player_ready(2));
        assert!(game.player1_day_ready);
        assert!(game.player2_day_ready);
    }

    #[test]
    fn test_manager_for_player() {
        let mut game = create_sample_game();

        // Player 1 always exists
        assert!(game.manager_for_player(1).is_some());

        // Player 2 doesn't exist yet
        assert!(game.manager_for_player(2).is_none());

        // Add player 2
        let mut p2_manager = Manager::new(
            "Player".to_string(),
            "Two".to_string(),
            "P2".to_string(),
            "ESP".to_string(),
            "2000-02-02".to_string(),
        );
        p2_manager.id = "mgr-2".to_string();
        p2_manager.team_id = Some("team-2".to_string());
        game.player2_manager = Some(p2_manager);

        // Now both exist
        assert!(game.manager_for_player(1).is_some());
        assert!(game.manager_for_player(2).is_some());
        assert!(game.manager_for_player(3).is_none());
    }

    #[test]
    fn test_manager_for_team() {
        let mut game = create_sample_game();

        // Set team_id for player 1
        game.manager.team_id = Some("team-1".to_string());

        // Should find player 1's manager
        assert!(game.manager_for_team("team-1").is_some());
        assert!(game.manager_for_team("team-2").is_none());

        // Add player 2 with different team
        let mut p2_manager = Manager::new(
            "Player".to_string(),
            "Two".to_string(),
            "P2".to_string(),
            "ESP".to_string(),
            "2000-02-02".to_string(),
        );
        p2_manager.id = "mgr-2".to_string();
        p2_manager.team_id = Some("team-2".to_string());
        game.player2_manager = Some(p2_manager);

        // Should find both
        assert!(game.manager_for_team("team-1").is_some());
        assert!(game.manager_for_team("team-2").is_some());
    }

    #[test]
    fn test_is_human_team() {
        let mut game = create_sample_game();
        game.manager.team_id = Some("team-1".to_string());

        assert!(game.is_human_team("team-1"));
        assert!(!game.is_human_team("team-2"));

        // Add player 2
        let mut p2_manager = Manager::new(
            "Player".to_string(),
            "Two".to_string(),
            "P2".to_string(),
            "ESP".to_string(),
            "2000-02-02".to_string(),
        );
        p2_manager.id = "mgr-2".to_string();
        p2_manager.team_id = Some("team-2".to_string());
        game.player2_manager = Some(p2_manager);

        assert!(game.is_human_team("team-1"));
        assert!(game.is_human_team("team-2"));
        assert!(!game.is_human_team("team-3"));
    }
}
