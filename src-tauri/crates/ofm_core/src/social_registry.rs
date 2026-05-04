use domain::social::{SocialAccount, SocialAuthorType};

#[derive(Debug, Clone)]
pub struct SocialAuthorProfile {
    pub id: &'static str,
    pub display_name: &'static str,
    pub handle: &'static str,
    pub author_type: SocialAuthorType,
}

pub const SOCIAL_AUTHORS: &[SocialAuthorProfile] = &[
    SocialAuthorProfile {
        id: "fan_random_lec",
        display_name: "LEC Enjoyer",
        handle: "@randomLECEnjoyer",
        author_type: SocialAuthorType::Fan,
    },
    SocialAuthorProfile {
        id: "analyst_manu",
        display_name: "Manu 𓃵𓃶",
        handle: "@Cabramaravilla",
        author_type: SocialAuthorType::Analyst,
    },
    SocialAuthorProfile {
        id: "media_newswire",
        display_name: "Rift Newswire",
        handle: "@RiftNewswire",
        author_type: SocialAuthorType::Journalist,
    },
    SocialAuthorProfile {
        id: "meme_lolchaos",
        display_name: "SoloQ Chaos",
        handle: "@SoloQChaos",
        author_type: SocialAuthorType::MemeAccount,
    },
];

pub fn social_author(id: &str) -> Option<SocialAuthorProfile> {
    SOCIAL_AUTHORS
        .iter()
        .find(|profile| profile.id == id)
        .cloned()
}

pub fn default_social_accounts() -> Vec<SocialAccount> {
    vec![
        SocialAccount {
            id: "fan_random_lec".to_string(),
            language: "all".to_string(),
            display_name: "LEC Enjoyer".to_string(),
            handle: "@randomLECEnjoyer".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: None,
            favorite_team_ids: vec![],
            active: true,
        },
        SocialAccount {
            id: "analyst_manu".to_string(),
            language: "es".to_string(),
            display_name: "Manu 𓃵𓃶".to_string(),
            handle: "@Cabramaravilla".to_string(),
            author_type: SocialAuthorType::Analyst,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1822062871280316416/mMjRmAqk_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec![],
            active: true,
        },
        SocialAccount {
            id: "media_newswire".to_string(),
            language: "all".to_string(),
            display_name: "Rift Newswire".to_string(),
            handle: "@RiftNewswire".to_string(),
            author_type: SocialAuthorType::Journalist,
            profile_image_url: None,
            favorite_team_ids: vec![],
            active: true,
        },
        SocialAccount {
            id: "meme_lolchaos".to_string(),
            language: "all".to_string(),
            display_name: "SoloQ Chaos".to_string(),
            handle: "@SoloQChaos".to_string(),
            author_type: SocialAuthorType::MemeAccount,
            profile_image_url: None,
            favorite_team_ids: vec![],
            active: true,
        },
    ]
}
