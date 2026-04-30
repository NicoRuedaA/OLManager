use super::{action, format_money, params};
use crate::narrative::{NarrativeSelector, load_default_content_pack};
use domain::message::*;
use rand::RngExt;

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

pub(super) fn sponsor_offer_message(
    msg_id: &str,
    team_name: &str,
    sponsor: &str,
    amount: u64,
    date: &str,
) -> InboxMessage {
    InboxMessage::new(
        msg_id.to_string(),
        format!("Sponsorship Offer — {}", sponsor),
        format!(
            "Good news, boss! {} has expressed interest in becoming a sponsor of {}.\n\n\
            They're offering a weekly payment of €{} over the next 12 weeks in exchange for advertising space at the training ground.\n\n\
            This seems like a reasonable deal, but it's your call.",
            sponsor, team_name, format_money(amount)
        ),
        "Commercial Director".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Finance)
    .with_priority(MessagePriority::Normal)
    .with_sender_role("Commercial Director")
    .with_action(action(
        "respond", "Respond", "be.msg.event.respond",
        ActionType::ChooseOption {
            options: vec![
                ActionOption {
                    id: "accept".to_string(),
                    label: "Accept the deal".to_string(),
                    description: format!("Receive €{} in sponsorship income.", format_money(amount)),
                    label_key: Some("be.msg.sponsor.options.accept.label".to_string()),
                    description_key: Some("be.msg.sponsor.options.accept.description".to_string()),
                },
                ActionOption {
                    id: "decline".to_string(),
                    label: "Decline politely".to_string(),
                    description: "Turn down the offer. No financial impact.".to_string(),
                    label_key: Some("be.msg.sponsor.options.decline.label".to_string()),
                    description_key: Some("be.msg.sponsor.options.decline.description".to_string()),
                },
            ],
        },
    ))
    .with_i18n(
        "be.msg.sponsor.subject",
        "be.msg.sponsor.body",
        params(&[("sponsor", sponsor), ("team", team_name), ("amount", &format_money(amount))]),
    )
    .with_sender_i18n("be.sender.commercialDirector", "be.role.commercialDirector")
}

pub(super) fn training_injury_message(
    msg_id: &str,
    player_id: &str,
    player_name: &str,
    injury_name: &str,
    days: u32,
    date: &str,
) -> InboxMessage {
    let mut rng = rand::rng();
    let variations = [
        format!(
            "Bad news from the training ground. {} has picked up a {} during today's session.\n\n\
            The medical team estimates {} days on the sidelines. We'll monitor the recovery closely.",
            player_name,
            injury_name.to_lowercase(),
            days
        ),
        format!(
            "Unfortunately, {} went down in training today with a {}.\n\n\
            Initial assessment: out for approximately {} days. We'll keep you updated on their progress.",
            player_name,
            injury_name.to_lowercase(),
            days
        ),
    ];
    let idx = rng.random_range(0..variations.len());

    InboxMessage::new(
        msg_id.to_string(),
        format!("Injury — {} ({})", player_name, injury_name),
        variations[idx].clone(),
        "Head Physio".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Injury)
    .with_priority(MessagePriority::High)
    .with_sender_role("Head Physio")
    .with_action(action(
        "ack",
        "Understood",
        "be.msg.event.ack",
        ActionType::Acknowledge,
    ))
    .with_context(MessageContext {
        player_id: Some(player_id.to_string()),
        ..Default::default()
    })
    .with_i18n(
        "be.msg.trainingInjury.subject",
        &format!("be.msg.trainingInjury.body{}", idx),
        params(&[
            ("player", player_name),
            ("injury", injury_name),
            ("days", &days.to_string()),
        ]),
    )
    .with_sender_i18n("be.sender.headPhysio", "be.role.headPhysio")
}

pub(super) fn media_story_message(
    msg_id: &str,
    team_name: &str,
    player_id: &str,
    player_name: &str,
    is_positive: bool,
    date: &str,
) -> InboxMessage {
    if let Some(message) = build_media_story_from_narrative(
        msg_id,
        team_name,
        player_id,
        player_name,
        is_positive,
        date,
    ) {
        return message;
    }

    let mut rng = rand::rng();
    let variant = rng.random_range(0..2usize);

    let (subject, body, subject_key) = if is_positive {
        match variant {
            0 => (
                format!(
                    "Esportmaníacos praises {} — the desk is unanimous",
                    player_name
                ),
                format!(
                    "The Esportmaníacos panel spent a good chunk of today's stream on {} at {}.\n\n\
                    \"Nothing to criticize this week. The guy is absolutely dominating.\" \
                    The positive coverage should give confidence a boost in the locker room.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.positive.subject0",
            ),
            _ => (
                format!(
                    "Esportmaníacos: {} is carrying {} this split",
                    player_name, team_name
                ),
                format!(
                    "The Esportmaníacos tertulianos rarely agree on anything, but {} got a full pass today: \
                    \"Consistent, solid, no dips in form. One of the best players in the league right now. \
                    {} should do everything to keep him.\"\n\n\
                    Good for morale — and for the market value.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.positive.subject1",
            ),
        }
    } else {
        match variant {
            0 => (
                format!(
                    "Esportmaníacos goes after {} — panel shows no mercy",
                    player_name
                ),
                format!(
                    "The Esportmaníacos panel did not hold back today on {}: \
                    \"The guy has completely disappeared. What happened to him this split? \
                    {} can't keep relying on a player performing like this.\"\n\n\
                    This kind of coverage tends to hit morale hard. Worth having a word with the player.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.negative.subject0",
            ),
            _ => (
                format!(
                    "Esportmaníacos questions {}'s consistency at {}",
                    player_name, team_name
                ),
                format!(
                    "Today's Esportmaníacos tertulianos session turned into a full breakdown of {}'s recent form. \
                    The verdict: \"Inconsistent. No regularity. Some days at top level, others completely invisible. \
                    {} deserves better output from a player in that role.\"\n\n\
                    Keep an eye on the player's morale.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.negative.subject1",
            ),
        }
    };

    let body_key = if is_positive {
        format!("be.msg.esportmaniacos.positive.body{}", variant)
    } else {
        format!("be.msg.esportmaniacos.negative.body{}", variant)
    };

    InboxMessage::new(
        msg_id.to_string(),
        subject,
        body,
        "Esportmaníacos".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Media)
    .with_priority(if is_positive {
        MessagePriority::Low
    } else {
        MessagePriority::Normal
    })
    .with_sender_role("Panel")
    .with_action(action(
        "ack",
        "Noted",
        "be.msg.event.ack",
        ActionType::Acknowledge,
    ))
    .with_context(MessageContext {
        player_id: Some(player_id.to_string()),
        ..Default::default()
    })
    .with_i18n(
        subject_key,
        &body_key,
        params(&[("player", player_name), ("team", team_name)]),
    )
    .with_sender_i18n("be.sender.esportmaniacos", "be.role.esportmaniacos")
}

pub fn build_media_story_from_narrative(
    msg_id: &str,
    team_name: &str,
    player_id: &str,
    player_name: &str,
    is_positive: bool,
    date: &str,
) -> Option<InboxMessage> {
    let pack = load_default_content_pack().ok()?;
    let selector = NarrativeSelector::new(&pack);
    let tags = if is_positive {
        vec!["media", "positive"]
    } else {
        vec!["media", "pressure"]
    };
    let tones = if is_positive {
        vec!["professional", "analytical", "community"]
    } else {
        vec!["spicy", "pressure"]
    };
    let template = selector.select_event(Some("default"), &tags, &tones)?;

    let mut rng = rand::rng();
    let variant = rng.random_range(0..2usize);

    let (subject, body, subject_key, priority) = if is_positive {
        match variant {
            0 => (
                format!(
                    "Esportmaníacos praises {} — the desk is unanimous",
                    player_name
                ),
                format!(
                    "The Esportmaníacos panel spent a good chunk of today's stream on {} at {}.\n\n\
                    \"Nothing to criticize this week. The guy is absolutely dominating.\" \
                    The positive coverage should give confidence a boost in the locker room.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.positive.subject0",
                MessagePriority::Low,
            ),
            _ => (
                format!(
                    "Esportmaníacos: {} is carrying {} this split",
                    player_name, team_name
                ),
                format!(
                    "The Esportmaníacos tertulianos rarely agree on anything, but {} got a full pass today: \
                    \"Consistent, solid, no dips in form. One of the best players in the league right now. \
                    {} should do everything to keep him.\"\n\n\
                    Good for morale — and for the market value.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.positive.subject1",
                MessagePriority::Low,
            ),
        }
    } else {
        match variant {
            0 => (
                format!(
                    "Esportmaníacos goes after {} — panel shows no mercy",
                    player_name
                ),
                format!(
                    "The Esportmaníacos panel did not hold back today on {}: \
                    \"The guy has completely disappeared. What happened to him this split? \
                    {} can't keep relying on a player performing like this.\"\n\n\
                    This kind of coverage tends to hit morale hard. Worth having a word with the player.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.negative.subject0",
                MessagePriority::Normal,
            ),
            _ => (
                format!(
                    "Esportmaníacos questions {}'s consistency at {}",
                    player_name, team_name
                ),
                format!(
                    "Today's Esportmaníacos tertulianos session turned into a full breakdown of {}'s recent form. \
                    The verdict: \"Inconsistent. No regularity. Some days at top level, others completely invisible. \
                    {} deserves better output from a player in that role.\"\n\n\
                    Keep an eye on the player's morale.",
                    player_name, team_name
                ),
                "be.msg.esportmaniacos.negative.subject1",
                MessagePriority::Normal,
            ),
        }
    };

    let body_key = if is_positive {
        format!("be.msg.esportmaniacos.positive.body{}", variant)
    } else {
        format!("be.msg.esportmaniacos.negative.body{}", variant)
    };

    Some(
        InboxMessage::new(
            msg_id.to_string(),
            subject,
            body,
            "Esportmaníacos".to_string(),
            date.to_string(),
        )
        .with_category(MessageCategory::Media)
        .with_priority(priority)
        .with_sender_role("Panel")
        .with_action(action(
            "ack",
            "Noted",
            "be.msg.event.ack",
            ActionType::Acknowledge,
        ))
        .with_context(MessageContext {
            player_id: Some(player_id.to_string()),
            ..Default::default()
        })
        .with_i18n(
            subject_key,
            &body_key,
            params(&[
                ("player", player_name),
                ("team", team_name),
                ("effectId", &template.effect_id),
            ]),
        )
        .with_sender_i18n("be.sender.esportmaniacos", "be.role.esportmaniacos"),
    )
}

pub(super) fn international_callup_message(
    msg_id: &str,
    player_name: &str,
    nationality: &str,
    date: &str,
) -> InboxMessage {
    InboxMessage::new(
        msg_id.to_string(),
        format!("International Call-Up — {}", player_name),
        format!(
            "{} has been called up to the {} national team for an upcoming international window.\n\n\
            This is a great honor for the player and reflects well on the club. \
            They'll be in good spirits when they return, though keep an eye on their fatigue levels.",
            player_name, nationality
        ),
        "International Liaison".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::LeagueInfo)
    .with_priority(MessagePriority::Normal)
    .with_sender_role("International Liaison")
    .with_action(action("ack", "Acknowledged", "be.msg.event.ack", ActionType::Acknowledge))
    .with_i18n(
        "be.msg.intlCallup.subject",
        "be.msg.intlCallup.body",
        params(&[("player", player_name), ("nationality", nationality)]),
    )
    .with_sender_i18n("be.sender.intlLiaison", "be.role.intlLiaison")
}

pub(super) fn allio_podcast_message(
    msg_id: &str,
    team_name: &str,
    player_id: Option<&str>,
    player_name: Option<&str>,
    date: &str,
) -> InboxMessage {
    let mut rng = rand::rng();
    let variant = rng.random_range(0..4usize);
    let pname = player_name.unwrap_or("one of your players");

    let (subject, body, subject_key, body_key) = match variant {
        0 => (
            format!("Al Lío Podcast — Transfer rumour: {} being tracked", pname),
            format!(
                "Eros dropped a transfer hint on today's Al Lío episode: \
                \"I'm hearing things about {}. Multiple teams have been asking questions. \
                Nothing confirmed yet, but the mercato around {} is heating up.\"\n\n\
                Keep this in mind when planning your squad for next split.",
                pname, team_name
            ),
            "be.msg.allio.subject0",
            "be.msg.allio.body0",
        ),
        1 => (
            format!("Al Lío Podcast — Eros hints at incoming deal for {}", team_name),
            format!(
                "Eros has been dropping hints on the latest Al Lío episode: \
                \"I've been told there are conversations happening around {}. Something is being cooked. \
                I can't give names yet but stay tuned — this mercato is far from over.\"\n\n\
                Could be noise, could be real. Worth watching.",
                team_name
            ),
            "be.msg.allio.subject1",
            "be.msg.allio.body1",
        ),
        2 => (
            "Al Lío Podcast — League format leak, Eros breaks it down".to_string(),
            "Today's Al Lío episode went off-script when Eros revealed a potential leak: \
            \"I've been told the league is planning changes to the split format. Not confirmed, \
            but my sources are usually reliable. This could shake up how teams build their rosters.\"\n\n\
            If true, this could affect your long-term planning.".to_string(),
            "be.msg.allio.subject2",
            "be.msg.allio.body2",
        ),
        _ => (
            "Al Lío Podcast — Big move incoming, league shaken up".to_string(),
            "Eros went live on Al Lío with what he called a \"bombazo\": \
            \"There's a significant player movement about to happen in the league that nobody is talking about yet. \
            I'll just say this — some teams are going to have to rethink their rosters completely.\"\n\n\
            Stay alert — the market is moving.".to_string(),
            "be.msg.allio.subject3",
            "be.msg.allio.body3",
        ),
    };

    let mut msg = InboxMessage::new(
        msg_id.to_string(),
        subject,
        body,
        "Al Lío Podcast".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Media)
    .with_priority(MessagePriority::Normal)
    .with_sender_role("Eros")
    .with_action(action(
        "ack",
        "Noted",
        "be.msg.event.ack",
        ActionType::Acknowledge,
    ))
    .with_i18n(
        subject_key,
        body_key,
        params(&[("player", pname), ("team", team_name)]),
    )
    .with_sender_i18n("be.sender.allioPodcast", "be.role.allioPodcast");

    if variant < 2 {
        if let Some(pid) = player_id {
            msg = msg.with_context(MessageContext {
                player_id: Some(pid.to_string()),
                ..Default::default()
            });
        }
    }

    msg
}

pub(super) fn yuste_stream_message(msg_id: &str, is_positive: bool, date: &str) -> InboxMessage {
    let mut rng = rand::rng();
    let variant = rng.random_range(0..2usize);

    let (subject, body, subject_key, body_key) = if is_positive {
        match variant {
            0 => (
                "el_yuste — even Yuste admits: viewership is up this week".to_string(),
                "Yuste surprised his stream with a rare positive take: \
                \"I'll be honest — the numbers are up this week and I'm not going to pretend otherwise. \
                When the matches are good, the audience comes. Simple.\"\n\n\
                A positive moment for the whole scene.".to_string(),
                "be.msg.yuste.up.subject0",
                "be.msg.yuste.up.body0",
            ),
            _ => (
                "el_yuste — this week's matches actually got Yuste excited".to_string(),
                "Not something you hear every day: Yuste was enthusiastic on his morning stream. \
                \"This week delivered. Real matches, proper stakes, viewers who stayed till the end. \
                This is what the league can be when it tries.\"\n\n\
                Good week to be in esports.".to_string(),
                "be.msg.yuste.up.subject1",
                "be.msg.yuste.up.body1",
            ),
        }
    } else {
        match variant {
            0 => (
                "el_yuste — league viewers are tanking and nobody cares".to_string(),
                "Antonio Yuste opened his morning stream with a full rant: \
                \"The numbers don't lie. Viewership is going down week after week and the league keeps \
                doing the same things expecting different results. C'est fini if nothing changes.\"\n\n\
                Just background noise — but when Yuste talks, the community listens.".to_string(),
                "be.msg.yuste.down.subject0",
                "be.msg.yuste.down.body0",
            ),
            _ => (
                "el_yuste — the league product is broken, according to Yuste".to_string(),
                "Yuste spent a solid thirty minutes analysing the league's declining engagement on his morning stream: \
                \"I've been saying this for months. The product isn't good enough. \
                The format bores people, the scheduling kills momentum. The data is clear.\"\n\n\
                Harsh, but Yuste's audience takes it seriously.".to_string(),
                "be.msg.yuste.down.subject1",
                "be.msg.yuste.down.body1",
            ),
        }
    };

    InboxMessage::new(
        msg_id.to_string(),
        subject,
        body,
        "el_yuste".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Media)
    .with_priority(MessagePriority::Low)
    .with_sender_role("el_yuste")
    .with_action(action(
        "ack",
        "Noted",
        "be.msg.event.ack",
        ActionType::Acknowledge,
    ))
    .with_i18n(subject_key, body_key, params(&[]))
    .with_sender_i18n("be.sender.elYuste", "be.role.elYuste")
}

pub(super) fn community_event_message(msg_id: &str, team_name: &str, date: &str) -> InboxMessage {
    let mut rng = rand::rng();
    let events = [
        (
            "Community Open Day",
            format!(
                "{} hosted a community open day at the training ground today.\n\n\
                Fans got to meet the players and watch a training session. \
                The atmosphere was fantastic and it's done wonders for team spirit.",
                team_name
            ),
        ),
        (
            "Youth Coaching Session",
            format!(
                "Several first-team players from {} volunteered for a youth coaching session at a local school.\n\n\
                Great PR for the club, and the players seem energized by the experience.",
                team_name
            ),
        ),
        (
            "Charity Match Announcement",
            format!(
                "The club has organized a charity initiative in partnership with a local foundation.\n\n\
                {} continues to build strong ties with the community. The board is pleased with the positive image.",
                team_name
            ),
        ),
    ];
    let idx = rng.random_range(0..events.len());
    let (subject, body) = &events[idx];

    InboxMessage::new(
        msg_id.to_string(),
        subject.to_string(),
        body.clone(),
        "Community Manager".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::System)
    .with_priority(MessagePriority::Low)
    .with_sender_role("Community Manager")
    .with_action(action(
        "ack",
        "Great",
        "be.msg.event.ack",
        ActionType::Acknowledge,
    ))
    .with_i18n(
        &format!("be.msg.community.subject{}", idx),
        &format!("be.msg.community.body{}", idx),
        params(&[("team", team_name)]),
    )
    .with_sender_i18n("be.sender.communityManager", "be.role.communityManager")
}
