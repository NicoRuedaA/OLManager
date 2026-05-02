use ts_rs::export;

// Re-export domain types so ts_rs::export! can see them
use domain::player::{Player, PlayerSeasonStats};

fn main() {
    export! {
        Player -> "bindings/Player.ts",
        PlayerSeasonStats -> "bindings/PlayerSeasonStats.ts",
    }

    println!("TypeScript bindings generated. Import from src/bindings/");
}
