use olm_core::domain::social::{SocialAccount, SocialPost, SocialTemplate};
use olm_core::game::Game;
use olm_core::state::StateManager;
use tauri::State;

#[tauri::command]
pub fn get_social_feed(state: State<'_, StateManager>) -> Result<Vec<SocialPost>, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    olm_core::social::ensure_social_registry_defaults(&mut game);
    state.set_game(game.clone());
    let mut posts = game.social_posts;
    posts.sort_by(|left, right| right.date.cmp(&left.date).then(right.id.cmp(&left.id)));
    Ok(posts)
}

#[tauri::command]
pub fn create_manager_social_post(
    state: State<'_, StateManager>,
    text: String,
) -> Result<Game, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    olm_core::social::ensure_social_registry_defaults(&mut game);

    olm_core::social::publish_manager_post(&mut game, &text)?;
    state.set_game(game.clone());
    Ok(game)
}

#[tauri::command]
pub fn get_social_accounts(state: State<'_, StateManager>) -> Result<Vec<SocialAccount>, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    olm_core::social::ensure_social_registry_defaults(&mut game);
    state.set_game(game.clone());
    Ok(game.social_accounts)
}

#[tauri::command]
pub fn save_social_accounts(
    state: State<'_, StateManager>,
    accounts: Vec<SocialAccount>,
) -> Result<Game, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    game.social_accounts = accounts;
    state.set_game(game.clone());
    Ok(game)
}

#[tauri::command]
pub fn get_social_templates(state: State<'_, StateManager>) -> Result<Vec<SocialTemplate>, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    olm_core::social::ensure_social_registry_defaults(&mut game);
    state.set_game(game.clone());
    Ok(game.social_templates)
}

#[tauri::command]
pub fn save_social_templates(
    state: State<'_, StateManager>,
    templates: Vec<SocialTemplate>,
) -> Result<Game, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    game.social_templates = templates;
    state.set_game(game.clone());
    Ok(game)
}

#[tauri::command]
pub fn relocalize_social_feed(
    state: State<'_, StateManager>,
    language: String,
) -> Result<Game, String> {
    let mut game = state
        .get_game(|game| game.clone())
        .ok_or("No active game session".to_string())?;
    olm_core::social::relocalize_social_posts(&mut game, &language);
    state.set_game(game.clone());
    Ok(game)
}


