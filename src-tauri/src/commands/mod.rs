pub mod academy;
pub mod bug_report;
pub mod club;
pub mod competitions;
pub mod contracts;
pub mod game;
pub mod import;
pub mod jobs;
pub mod live_match;
pub mod sim_live;
pub mod messages;
pub mod round_summary;
pub mod season;
pub mod settings;
pub mod social;
pub mod squad;
pub mod staff;
pub mod stats;
pub mod time;
pub mod transfers;
pub mod world;

pub use academy::*;
pub use bug_report::*;
pub use club::*;
pub use competitions::*;
pub use contracts::*;
pub use game::*;
pub use import::*;
pub use jobs::*;
pub use live_match::*;
pub use sim_live::*;
pub use messages::*;
pub use season::*;
pub use settings::*;
pub use social::*;
pub use squad::*;
pub use staff::*;
pub use stats::*;
pub use time::*;
pub use transfers::*;
pub use world::*;

#[tauri::command]
pub fn debug_log(message: String) {
    println!("[JS DEBUG] {}", message);
}

