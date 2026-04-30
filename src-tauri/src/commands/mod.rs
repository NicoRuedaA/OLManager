pub mod academy;
pub mod backup_save;  // NEW: Backup Save Manager
pub mod club;
pub mod contracts;
pub mod game;
pub mod jobs;
pub mod live_match;
pub mod lol_sim_v2;
pub mod messages;
pub mod multiplayer;  // Multiplayer commands
pub mod round_summary;
pub mod season;
pub mod settings;
pub mod squad;
pub mod staff;
pub mod stats;
pub mod state_sync;  // State Sync Manager
pub mod time;
pub mod transfers;
pub mod world;

pub use academy::*;
pub use backup_save::*;  // NEW
pub use club::*;
pub use contracts::*;
pub use game::*;
pub use jobs::*;
pub use live_match::*;
pub use lol_sim_v2::*;
pub use messages::*;
pub use multiplayer::*;
pub use round_summary::*;
pub use season::*;
pub use settings::*;
pub use squad::*;
pub use staff::*;
pub use stats::*;
pub use state_sync::*;
pub use time::*;
pub use transfers::*;
pub use world::*;
