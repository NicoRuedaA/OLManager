use crate::domain::social::{
    SocialAccount, SocialAuthorType, SocialPost, SocialPostCategory, SocialSentiment,
    SocialTemplate,
};
use rusqlite::{Connection, params};

pub fn upsert_social_post(conn: &Connection, post: &SocialPost) -> Result<(), String> {
    let tags_json = serde_json::to_string(&post.tags).map_err(|e| format!("JSON error: {}", e))?;
    let team_ids_json =
        serde_json::to_string(&post.team_ids).map_err(|e| format!("JSON error: {}", e))?;
    let player_ids_json =
        serde_json::to_string(&post.player_ids).map_err(|e| format!("JSON error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO social_posts
         (id, date, author_name, author_handle, author_type, body, likes, reposts, replies,
          sentiment, category, tags, team_ids, player_ids, fixture_id, media_url, read)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            post.id,
            post.date,
            post.author_name,
            post.author_handle,
            format!("{:?}", post.author_type),
            post.body,
            post.likes,
            post.reposts,
            post.replies,
            format!("{:?}", post.sentiment),
            format!("{:?}", post.category),
            tags_json,
            team_ids_json,
            player_ids_json,
            post.fixture_id,
            post.media_url,
            post.read as i32,
        ],
    )
    .map_err(|e| format!("Failed to upsert social post: {}", e))?;

    Ok(())
}

pub fn upsert_social_posts(conn: &Connection, posts: &[SocialPost]) -> Result<(), String> {
    for post in posts {
        upsert_social_post(conn, post)?;
    }
    Ok(())
}

pub fn load_all_social_posts(conn: &Connection) -> Result<Vec<SocialPost>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, date, author_name, author_handle, author_type, body, likes, reposts,
             replies, sentiment, category, tags, team_ids, player_ids, fixture_id, media_url, read
             FROM social_posts ORDER BY date DESC, id DESC",
        )
        .map_err(|e| format!("Failed to prepare social posts query: {}", e))?;

    let rows = stmt
        .query_map([], row_to_social_post)
        .map_err(|e| format!("Failed to query social posts: {}", e))?;

    let mut posts = Vec::new();
    for row in rows {
        posts.push(row.map_err(|e| format!("Failed to read social post: {}", e))?);
    }
    Ok(posts)
}

fn row_to_social_post(row: &rusqlite::Row) -> rusqlite::Result<SocialPost> {
    let author_type: String = row.get(4)?;
    let sentiment: String = row.get(9)?;
    let category: String = row.get(10)?;
    let tags_json: String = row.get(11)?;
    let team_ids_json: String = row.get(12)?;
    let player_ids_json: String = row.get(13)?;
    let read_int: i32 = row.get(16)?;

    Ok(SocialPost {
        id: row.get(0)?,
        date: row.get(1)?,
        author_name: row.get(2)?,
        author_handle: row.get(3)?,
        author_type: parse_author_type(&author_type),
        body: row.get(5)?,
        likes: row.get(6)?,
        reposts: row.get(7)?,
        replies: row.get(8)?,
        sentiment: parse_sentiment(&sentiment),
        category: parse_category(&category),
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        team_ids: serde_json::from_str(&team_ids_json).unwrap_or_default(),
        player_ids: serde_json::from_str(&player_ids_json).unwrap_or_default(),
        fixture_id: row.get(14)?,
        media_url: row.get(15)?,
        read: read_int != 0,
    })
}

pub fn upsert_social_accounts(conn: &Connection, accounts: &[SocialAccount]) -> Result<(), String> {
    for account in accounts {
        let favorite_team_ids = serde_json::to_string(&account.favorite_team_ids)
            .map_err(|e| format!("JSON error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO social_accounts
             (id, language, display_name, handle, author_type, profile_image_url, favorite_team_ids, active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                account.id,
                account.language,
                account.display_name,
                account.handle,
                format!("{:?}", account.author_type),
                account.profile_image_url,
                favorite_team_ids,
                account.active as i32,
            ],
        )
        .map_err(|e| format!("Failed to upsert social account: {}", e))?;
    }
    Ok(())
}

pub fn load_social_accounts(conn: &Connection) -> Result<Vec<SocialAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, language, display_name, handle, author_type, profile_image_url, favorite_team_ids, active
             FROM social_accounts ORDER BY id",
        )
        .map_err(|e| format!("Failed to prepare social accounts query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let favorite_team_ids_json: String = row.get(6)?;
            let author_type: String = row.get(4)?;
            let active: i32 = row.get(7)?;
            Ok(SocialAccount {
                id: row.get(0)?,
                language: row.get(1)?,
                display_name: row.get(2)?,
                handle: row.get(3)?,
                author_type: parse_author_type(&author_type),
                profile_image_url: row.get(5)?,
                favorite_team_ids: serde_json::from_str(&favorite_team_ids_json)
                    .unwrap_or_default(),
                active: active != 0,
            })
        })
        .map_err(|e| format!("Failed to query social accounts: {}", e))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("Failed to read social account: {}", e))?);
    }
    Ok(items)
}

pub fn upsert_social_templates(
    conn: &Connection,
    templates: &[SocialTemplate],
) -> Result<(), String> {
    for template in templates {
        let variants_json =
            serde_json::to_string(&template.variants).map_err(|e| format!("JSON error: {}", e))?;
        let tags_json =
            serde_json::to_string(&template.tags).map_err(|e| format!("JSON error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO social_templates
             (id, language, slot, author_id, conditions_json, variants, tags, weight, active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                template.id,
                template.language,
                template.slot,
                template.author_id,
                template.conditions_json,
                variants_json,
                tags_json,
                template.weight,
                template.active as i32,
            ],
        )
        .map_err(|e| format!("Failed to upsert social template: {}", e))?;
    }
    Ok(())
}

pub fn load_social_templates(conn: &Connection) -> Result<Vec<SocialTemplate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, language, slot, author_id, conditions_json, variants, tags, weight, active
             FROM social_templates ORDER BY id",
        )
        .map_err(|e| format!("Failed to prepare social templates query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let variants_json: String = row.get(5)?;
            let tags_json: String = row.get(6)?;
            let active: i32 = row.get(8)?;
            Ok(SocialTemplate {
                id: row.get(0)?,
                language: row.get(1)?,
                slot: row.get(2)?,
                author_id: row.get(3)?,
                conditions_json: row.get(4)?,
                variants: serde_json::from_str(&variants_json).unwrap_or_default(),
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                weight: row.get(7)?,
                active: active != 0,
            })
        })
        .map_err(|e| format!("Failed to query social templates: {}", e))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("Failed to read social template: {}", e))?);
    }
    Ok(items)
}

fn parse_author_type(value: &str) -> SocialAuthorType {
    match value {
        "Team" => SocialAuthorType::Team,
        "Player" => SocialAuthorType::Player,
        "Analyst" => SocialAuthorType::Analyst,
        "Journalist" => SocialAuthorType::Journalist,
        "MemeAccount" => SocialAuthorType::MemeAccount,
        "Manager" => SocialAuthorType::Manager,
        _ => SocialAuthorType::Fan,
    }
}

fn parse_sentiment(value: &str) -> SocialSentiment {
    match value {
        "Hype" => SocialSentiment::Hype,
        "Worried" => SocialSentiment::Worried,
        "Angry" => SocialSentiment::Angry,
        "Meltdown" => SocialSentiment::Meltdown,
        "Copium" => SocialSentiment::Copium,
        _ => SocialSentiment::Calm,
    }
}

fn parse_category(value: &str) -> SocialPostCategory {
    match value {
        "MatchResult" => SocialPostCategory::MatchResult,
        "Banter" => SocialPostCategory::Banter,
        "PlayerReaction" => SocialPostCategory::PlayerReaction,
        "MediaTake" => SocialPostCategory::MediaTake,
        "Meme" => SocialPostCategory::Meme,
        "ManagerPost" => SocialPostCategory::ManagerPost,
        _ => SocialPostCategory::FanOpinion,
    }
}

