use domain::league::Fixture;
use domain::social::{SocialAuthorType, SocialPost, SocialPostCategory, SocialSentiment};
use domain::team::Team;
use engine::report::{MatchReport, PlayerMatchStats};

use crate::game::Game;
use crate::social_registry::{default_social_accounts, social_author};
use crate::social_templates::{
    MatchTemplateContext, MatchTemplateSlot, SelectedMatchTemplate, default_social_templates,
    select_match_template_for_language,
};

fn social_handle(name: &str) -> String {
    let handle: String = name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase();
    format!(
        "@{}",
        if handle.is_empty() {
            "olmsocial"
        } else {
            &handle
        }
    )
}

fn variant_index(seed: &str, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    seed.bytes().fold(0usize, |acc, byte| {
        acc.wrapping_mul(31).wrapping_add(byte as usize)
    }) % len
}

fn engagement(base: u32, team_reputation: u32, spicy: bool, seed: &str) -> (u32, u32, u32) {
    let reputation_boost = team_reputation.saturating_mul(3);
    let spice_boost = if spicy { base / 4 + 35 } else { 0 };
    let noise = variant_index(seed, 35) as u32;
    let likes = base
        .saturating_add(reputation_boost)
        .saturating_add(spice_boost)
        .saturating_add(noise);
    (likes, likes / 12, likes / 24)
}

fn team_by_id<'a>(game: &'a Game, team_id: &str) -> Option<&'a Team> {
    game.teams.iter().find(|team| team.id == team_id)
}

fn top_player_for_team<'a>(
    game: &'a Game,
    report: &'a MatchReport,
    team_id: &str,
) -> Option<(&'a domain::player::Player, &'a PlayerMatchStats)> {
    game.players
        .iter()
        .filter(|player| player.team_id.as_deref() == Some(team_id))
        .filter_map(|player| {
            report
                .player_stats
                .get(&player.id)
                .map(|stats| (player, stats))
        })
        .max_by_key(|(_, stats)| {
            stats.kills as i32 * 3 + stats.assists as i32 * 2 - stats.deaths as i32
        })
}

pub fn generate_match_social_posts(game: &mut Game, fixture_index: usize, report: &MatchReport) {
    ensure_social_registry_defaults(game);

    let Some(league) = game.league.as_ref() else {
        return;
    };
    let Some(fixture) = league.fixtures.get(fixture_index).cloned() else {
        return;
    };
    if game
        .social_posts
        .iter()
        .any(|post| post.fixture_id.as_deref() == Some(&fixture.id))
    {
        return;
    }

    let Some((winner_id, loser_id, winner_wins, loser_wins)) = winner_loser(&fixture, report)
    else {
        return;
    };
    let Some(winner) = team_by_id(game, winner_id).cloned() else {
        return;
    };
    let Some(loser) = team_by_id(game, loser_id).cloned() else {
        return;
    };

    let score = format!("{}-{}", winner_wins, loser_wins);
    let stomp = winner_wins.saturating_sub(loser_wins) >= 2
        || kill_difference_for_winner(&fixture, report) >= 10;
    let date = game.clock.current_date.format("%Y-%m-%d").to_string();
    let seed = format!("{}-{}-{}", fixture.id, winner.id, score);
    let winner_objectives = if report.home_wins > report.away_wins {
        report.home_stats.objectives
    } else {
        report.away_stats.objectives
    };
    let context = MatchTemplateContext {
        winner: &winner,
        loser: &loser,
        score: &score,
        seed: &seed,
        stomp,
        winner_objectives,
        player_name: None,
    };

    let language = manager_language(&game.manager.nationality);
    let team_template: SelectedMatchTemplate = select_match_template_for_language(
        &game.social_templates,
        language,
        MatchTemplateSlot::TeamBanter,
        &context,
    );
    let (likes, reposts, replies) = engagement(120, winner.reputation, true, &seed);
    let team_post = SocialPost::new(
        format!("social_{}_team", fixture.id),
        date.clone(),
        winner.name.clone(),
        social_handle(&winner.name),
        SocialAuthorType::Team,
        team_template.text,
        SocialPostCategory::Banter,
        SocialSentiment::Hype,
    )
    .with_engagement(likes, reposts, replies)
    .with_tags(if team_template.tags.is_empty() {
        vec!["match".to_string(), "banter".to_string()]
    } else {
        team_template.tags
    })
    .with_teams(vec![winner.id.clone(), loser.id.clone()])
    .with_fixture(fixture.id.clone());

    let fan_template: SelectedMatchTemplate = select_match_template_for_language(
        &game.social_templates,
        language,
        MatchTemplateSlot::FanOpinion,
        &context,
    );
    let fan_profile = fan_template
        .author_id
        .as_deref()
        .and_then(social_author)
        .or_else(|| social_author("fan_random_lec"));
    let (likes, reposts, replies) = engagement(
        if stomp { 55 } else { 35 },
        winner.reputation / 2,
        stomp,
        &seed,
    );
    let fan_post = SocialPost::new(
        format!("social_{}_fan", fixture.id),
        date.clone(),
        fan_profile
            .as_ref()
            .map(|profile| profile.display_name.to_string())
            .unwrap_or_else(|| "LEC Enjoyer".to_string()),
        fan_profile
            .as_ref()
            .map(|profile| profile.handle.to_string())
            .unwrap_or_else(|| "@randomLECEnjoyer".to_string()),
        fan_profile
            .as_ref()
            .map(|profile| profile.author_type.clone())
            .unwrap_or(SocialAuthorType::Fan),
        fan_template.text,
        SocialPostCategory::FanOpinion,
        if stomp {
            SocialSentiment::Meltdown
        } else {
            SocialSentiment::Hype
        },
    )
    .with_engagement(likes, reposts, replies)
    .with_tags(if fan_template.tags.is_empty() {
        vec!["fan".to_string(), "match".to_string()]
    } else {
        fan_template.tags
    })
    .with_teams(vec![winner.id.clone(), loser.id.clone()])
    .with_fixture(fixture.id.clone());

    let analyst_template: SelectedMatchTemplate = select_match_template_for_language(
        &game.social_templates,
        language,
        MatchTemplateSlot::AnalystTake,
        &context,
    );
    let analyst_profile = analyst_template
        .author_id
        .as_deref()
        .and_then(social_author)
        .or_else(|| social_author("analyst_manu"));
    let (likes, reposts, replies) = engagement(45, winner.reputation / 2, false, &seed);
    let analyst_post = SocialPost::new(
        format!("social_{}_analyst", fixture.id),
        date.clone(),
        analyst_profile
            .as_ref()
            .map(|profile| profile.display_name.to_string())
            .unwrap_or_else(|| "Manu 𓃵𓃶".to_string()),
        analyst_profile
            .as_ref()
            .map(|profile| profile.handle.to_string())
            .unwrap_or_else(|| "@Cabramaravilla".to_string()),
        analyst_profile
            .as_ref()
            .map(|profile| profile.author_type.clone())
            .unwrap_or(SocialAuthorType::Analyst),
        analyst_template.text,
        SocialPostCategory::MediaTake,
        SocialSentiment::Calm,
    )
    .with_engagement(likes, reposts, replies)
    .with_tags(if analyst_template.tags.is_empty() {
        vec!["analysis".to_string(), "match".to_string()]
    } else {
        analyst_template.tags
    })
    .with_teams(vec![winner.id.clone(), loser.id.clone()])
    .with_fixture(fixture.id.clone());

    game.social_posts
        .extend([team_post, fan_post, analyst_post]);

    if let Some((player_id, player_name)) = top_player_for_team(game, report, &winner.id)
        .map(|(player, _stats)| (player.id.clone(), player.match_name.clone()))
    {
        let (likes, reposts, replies) = engagement(105, winner.reputation, false, &seed);
        let player_context = MatchTemplateContext {
            winner: &winner,
            loser: &loser,
            score: &score,
            seed: &seed,
            stomp,
            winner_objectives,
            player_name: Some(&player_name),
        };
        let player_template = select_match_template_for_language(
            &game.social_templates,
            language,
            MatchTemplateSlot::PlayerReaction,
            &player_context,
        );
        let player_post = SocialPost::new(
            format!("social_{}_player_{}", fixture.id, player_id),
            date,
            player_name.clone(),
            social_handle(&player_name),
            SocialAuthorType::Player,
            player_template.text,
            SocialPostCategory::PlayerReaction,
            SocialSentiment::Hype,
        )
        .with_engagement(likes, reposts, replies)
        .with_tags(if player_template.tags.is_empty() {
            vec!["player".to_string(), "gg".to_string()]
        } else {
            player_template.tags
        })
        .with_teams(vec![winner.id.clone()])
        .with_players(vec![player_id])
        .with_fixture(fixture.id);
        game.social_posts.push(player_post);
    }
}

fn winner_loser<'a>(
    fixture: &'a Fixture,
    report: &MatchReport,
) -> Option<(&'a str, &'a str, u8, u8)> {
    if report.home_wins > report.away_wins {
        Some((
            &fixture.home_team_id,
            &fixture.away_team_id,
            report.home_wins,
            report.away_wins,
        ))
    } else if report.away_wins > report.home_wins {
        Some((
            &fixture.away_team_id,
            &fixture.home_team_id,
            report.away_wins,
            report.home_wins,
        ))
    } else {
        None
    }
}

fn kill_difference_for_winner(fixture: &Fixture, report: &MatchReport) -> u16 {
    let home_won = report.home_wins > report.away_wins;
    let winner_kills = if home_won {
        report.home_stats.kills
    } else {
        report.away_stats.kills
    };
    let loser_kills = if fixture.home_team_id == fixture.away_team_id {
        0
    } else if home_won {
        report.away_stats.kills
    } else {
        report.home_stats.kills
    };
    winner_kills.saturating_sub(loser_kills)
}

pub fn publish_manager_post(game: &mut Game, raw_text: &str) -> Result<SocialPost, String> {
    ensure_social_registry_defaults(game);

    let text = raw_text.trim();
    if text.is_empty() {
        return Err("Post cannot be empty".to_string());
    }
    if text.chars().count() > 280 {
        return Err("Post exceeds 280 characters".to_string());
    }

    let date = game.clock.current_date.format("%Y-%m-%d").to_string();
    let manager_name = game.manager.display_name();
    let manager_handle = social_handle(&manager_name);
    let id = format!("social_manager_{}_{}", date, game.social_posts.len() + 1);
    let seed = format!("{}-{}", id, game.manager.id);
    let (likes, reposts, replies) = engagement(25, game.manager.reputation / 2, false, &seed);

    let post = SocialPost::new(
        id,
        date,
        manager_name,
        manager_handle,
        SocialAuthorType::Manager,
        text.to_string(),
        SocialPostCategory::ManagerPost,
        SocialSentiment::Calm,
    )
    .with_engagement(likes, reposts, replies)
    .with_tags(vec!["manager".to_string(), "post".to_string()]);

    game.social_posts.push(post.clone());
    Ok(post)
}

pub fn ensure_social_registry_defaults(game: &mut Game) {
    if game.social_accounts.is_empty() {
        game.social_accounts = default_social_accounts();
    }
    if game.social_templates.is_empty() {
        game.social_templates = default_social_templates();
    }
}

fn manager_language(nationality: &str) -> &str {
    let value = nationality.to_lowercase();
    if value.contains("spain") || value.contains("espa") || value == "es" {
        return "es";
    }
    if value.contains("france") || value == "fr" {
        return "fr";
    }
    if value.contains("germany") || value == "de" {
        return "de";
    }
    "all"
}
