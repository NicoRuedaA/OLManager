use domain::social::SocialTemplate;
use domain::team::Team;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum MatchTemplateSlot {
    TeamBanter,
    FanOpinion,
    AnalystTake,
    PlayerReaction,
}

pub struct MatchTemplateContext<'a> {
    pub winner: &'a Team,
    pub loser: &'a Team,
    pub score: &'a str,
    pub seed: &'a str,
    pub stomp: bool,
    pub winner_objectives: u16,
    pub player_name: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct SelectedMatchTemplate {
    pub text: String,
    pub author_id: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct MatchTemplatePack {
    templates: Vec<MatchTextTemplate>,
}

#[derive(Debug, Deserialize)]
struct MatchTextTemplate {
    id: String,
    slot: MatchTemplateSlot,
    #[serde(default = "default_weight")]
    weight: u32,
    #[serde(default)]
    author_id: Option<String>,
    #[serde(default)]
    conditions: MatchTemplateConditions,
    variants: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Clone)]
struct RuntimeTemplate {
    id: String,
    slot: MatchTemplateSlot,
    language: String,
    weight: u32,
    author_id: Option<String>,
    conditions: MatchTemplateConditions,
    variants: Vec<String>,
    tags: Vec<String>,
    active: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
struct MatchTemplateConditions {
    #[serde(default)]
    requires_stomp: Option<bool>,
    #[serde(default)]
    winner_team_slug: Option<String>,
    #[serde(default)]
    requires_player_name: Option<bool>,
}

fn default_weight() -> u32 {
    1
}

static TEMPLATES: OnceLock<MatchTemplatePack> = OnceLock::new();

fn normalized_slug(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn deterministic_index(seed: &str, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    seed.bytes().fold(0usize, |acc, byte| {
        acc.wrapping_mul(31).wrapping_add(byte as usize)
    }) % len
}

fn templates_pack() -> &'static MatchTemplatePack {
    TEMPLATES.get_or_init(|| {
        serde_json::from_str(include_str!("social_match_templates.json"))
            .expect("social_match_templates.json must be valid")
    })
}

fn condition_matches(template: &MatchTextTemplate, context: &MatchTemplateContext<'_>) -> bool {
    if let Some(required_stomp) = template.conditions.requires_stomp {
        if context.stomp != required_stomp {
            return false;
        }
    }

    if let Some(required_slug) = template.conditions.winner_team_slug.as_ref() {
        let winner_slug = normalized_slug(&context.winner.name);
        let winner_short_slug = normalized_slug(&context.winner.short_name);
        let needle = normalized_slug(required_slug);
        if !winner_slug.contains(&needle) && !winner_short_slug.contains(&needle) {
            return false;
        }
    }

    if let Some(requires_player_name) = template.conditions.requires_player_name {
        if requires_player_name && context.player_name.is_none() {
            return false;
        }
    }

    !template.variants.is_empty()
}

fn runtime_condition_matches(
    template: &RuntimeTemplate,
    context: &MatchTemplateContext<'_>,
) -> bool {
    if let Some(required_stomp) = template.conditions.requires_stomp {
        if context.stomp != required_stomp {
            return false;
        }
    }

    if let Some(required_slug) = template.conditions.winner_team_slug.as_ref() {
        let winner_slug = normalized_slug(&context.winner.name);
        let winner_short_slug = normalized_slug(&context.winner.short_name);
        let needle = normalized_slug(required_slug);
        if !winner_slug.contains(&needle) && !winner_short_slug.contains(&needle) {
            return false;
        }
    }

    if let Some(requires_player_name) = template.conditions.requires_player_name {
        if requires_player_name && context.player_name.is_none() {
            return false;
        }
    }

    template.active && !template.variants.is_empty()
}

fn render_text(template: &MatchTextTemplate, context: &MatchTemplateContext<'_>) -> String {
    let variant = template.variants[deterministic_index(
        &format!("{}-{}", context.seed, template.id),
        template.variants.len(),
    )]
    .clone();

    variant
        .replace("{score}", context.score)
        .replace("{winner_name}", &context.winner.name)
        .replace("{winner_short_name}", &context.winner.short_name)
        .replace("{loser_name}", &context.loser.name)
        .replace("{loser_short_name}", &context.loser.short_name)
        .replace(
            "{winner_objectives}",
            &context.winner_objectives.to_string(),
        )
        .replace("{player_name}", context.player_name.unwrap_or("El pibe"))
}

pub fn select_match_template(
    slot: MatchTemplateSlot,
    context: &MatchTemplateContext<'_>,
) -> SelectedMatchTemplate {
    let candidates: Vec<&MatchTextTemplate> = templates_pack()
        .templates
        .iter()
        .filter(|template| template.slot == slot)
        .filter(|template| condition_matches(template, context))
        .collect();

    if candidates.is_empty() {
        return SelectedMatchTemplate {
            text: String::new(),
            author_id: None,
            tags: vec![],
        };
    }

    let total_weight = candidates
        .iter()
        .map(|template| template.weight.max(1))
        .sum::<u32>();
    let mut needle = deterministic_index(
        &format!("{}-slot-{:?}", context.seed, slot),
        total_weight as usize,
    ) as u32;

    for template in candidates {
        let weight = template.weight.max(1);
        if needle < weight {
            return SelectedMatchTemplate {
                text: render_text(template, context),
                author_id: template.author_id.clone(),
                tags: template.tags.clone(),
            };
        }
        needle = needle.saturating_sub(weight);
    }

    SelectedMatchTemplate {
        text: String::new(),
        author_id: None,
        tags: vec![],
    }
}

fn parse_slot(value: &str) -> Option<MatchTemplateSlot> {
    match value {
        "TeamBanter" => Some(MatchTemplateSlot::TeamBanter),
        "FanOpinion" => Some(MatchTemplateSlot::FanOpinion),
        "AnalystTake" => Some(MatchTemplateSlot::AnalystTake),
        "PlayerReaction" => Some(MatchTemplateSlot::PlayerReaction),
        _ => None,
    }
}

fn runtime_templates_from_overrides(overrides: &[SocialTemplate]) -> Vec<RuntimeTemplate> {
    overrides
        .iter()
        .filter_map(|item| {
            let slot = parse_slot(&item.slot)?;
            let conditions = serde_json::from_str::<MatchTemplateConditions>(&item.conditions_json)
                .unwrap_or_default();
            Some(RuntimeTemplate {
                id: item.id.clone(),
                slot,
                language: item.language.clone(),
                weight: item.weight,
                author_id: item.author_id.clone(),
                conditions,
                variants: item.variants.clone(),
                tags: item.tags.clone(),
                active: item.active,
            })
        })
        .collect()
}

pub fn select_match_template_for_language(
    overrides: &[SocialTemplate],
    language: &str,
    slot: MatchTemplateSlot,
    context: &MatchTemplateContext<'_>,
) -> SelectedMatchTemplate {
    let runtime_templates = runtime_templates_from_overrides(overrides);
    let candidates: Vec<&RuntimeTemplate> = runtime_templates
        .iter()
        .filter(|template| template.slot == slot)
        .filter(|template| {
            template.language.eq_ignore_ascii_case("all")
                || template.language.eq_ignore_ascii_case(language)
        })
        .filter(|template| runtime_condition_matches(template, context))
        .collect();

    if candidates.is_empty() {
        return select_match_template(slot, context);
    }

    let total_weight = candidates
        .iter()
        .map(|template| template.weight.max(1))
        .sum::<u32>();
    let mut needle = deterministic_index(
        &format!("{}-slot-{:?}", context.seed, slot),
        total_weight as usize,
    ) as u32;

    for template in candidates {
        let weight = template.weight.max(1);
        if needle < weight {
            let base = MatchTextTemplate {
                id: template.id.clone(),
                slot: template.slot,
                weight: template.weight,
                author_id: template.author_id.clone(),
                conditions: MatchTemplateConditions::default(),
                variants: template.variants.clone(),
                tags: template.tags.clone(),
            };
            return SelectedMatchTemplate {
                text: render_text(&base, context),
                author_id: template.author_id.clone(),
                tags: template.tags.clone(),
            };
        }
        needle = needle.saturating_sub(weight);
    }

    select_match_template(slot, context)
}

pub fn default_social_templates() -> Vec<SocialTemplate> {
    templates_pack()
        .templates
        .iter()
        .map(|template| SocialTemplate {
            id: template.id.clone(),
            language: "all".to_string(),
            slot: format!("{:?}", template.slot),
            author_id: template.author_id.clone(),
            conditions_json: serde_json::to_string(&template.conditions)
                .unwrap_or_else(|_| "{}".to_string()),
            variants: template.variants.clone(),
            tags: template.tags.clone(),
            weight: template.weight,
            active: true,
        })
        .collect()
}
