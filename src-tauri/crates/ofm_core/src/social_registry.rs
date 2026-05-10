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
        // Community fan accounts provided for LEC teams
        // Fnatic
        SocialAccount {
            id: "fan_fnc_catxalote".to_string(),
            language: "all".to_string(),
            display_name: "CATXALOTE".to_string(),
            handle: "@CATXALOTE_".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2017380010730958848/I1Gb1auf_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-fnatic".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_fnc_jordi_lmk".to_string(),
            language: "all".to_string(),
            display_name: "Jordi LMK".to_string(),
            handle: "@DefNotJordi".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1962971737420681217/qYol_jIG_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-fnatic".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_fnc_shiro".to_string(),
            language: "all".to_string(),
            display_name: "Shiro".to_string(),
            handle: "@shirolamperouge".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2015213064635756544/EpDpDNAe_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-fnatic".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_lec_bouzys".to_string(),
            language: "all".to_string(),
            display_name: "X Bouzys".to_string(),
            handle: "@Bouzyslol".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2051038688486846464/D_qsL79v_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-fnatic".to_string()],
            active: true,
        },
        // G2
        SocialAccount {
            id: "fan_g2_dvd".to_string(),
            language: "all".to_string(),
            display_name: "DvD💿".to_string(),
            handle: "@ElDvD_".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1927128075919048705/Mq6ojmid_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-g2-esports".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_g2_demons".to_string(),
            language: "all".to_string(),
            display_name: "Demons".to_string(),
            handle: "@DemonsGxd".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1984574321311039488/jGvTtwVt_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-g2-esports".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_g2_lawliet".to_string(),
            language: "all".to_string(),
            display_name: "Lawliet".to_string(),
            handle: "@Lawliet_108".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2033616345951309828/HlCslRCV_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-g2-esports".to_string()],
            active: true,
        },
        // Team Heretics
        SocialAccount {
            id: "fan_th_fezzysucks".to_string(),
            language: "all".to_string(),
            display_name: "fezzysucks".to_string(),
            handle: "@fezzysucks".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2038725180067872769/Yj903mHv_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-heretics-lec".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_th_serranito".to_string(),
            language: "all".to_string(),
            display_name: "serranito 𒉭".to_string(),
            handle: "@serraanitoo_".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2039032258238246912/GnpsabQ0_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-heretics-lec".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_th_xtittan".to_string(),
            language: "all".to_string(),
            display_name: "xTittan".to_string(),
            handle: "@xTittan_".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2025602667918098432/zEp_mH85_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-heretics-lec".to_string()],
            active: true,
        },
        // KOI (mapped to MAD Lions team id in this data model)
        SocialAccount {
            id: "fan_koi_mrparrot".to_string(),
            language: "all".to_string(),
            display_name: "KOI MrParrot 🍓".to_string(),
            handle: "@MrParrot23".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1951905715049660416/tMjeJKe2_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-mad-lions".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_koi_vivi".to_string(),
            language: "all".to_string(),
            display_name: "Vivi 🌷🍓".to_string(),
            handle: "@_itsviivi".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2023016120228450304/2yUnq-9R_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-mad-lions".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_koi_alo".to_string(),
            language: "all".to_string(),
            display_name: "A L O".to_string(),
            handle: "@Alex_ATM7".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2020143406228369408/FWUQ2R-m_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-mad-lions".to_string()],
            active: true,
        },
        // Vitality
        SocialAccount {
            id: "fan_vit_arv".to_string(),
            language: "all".to_string(),
            display_name: "🍋ARV🍋".to_string(),
            handle: "@arv_gs".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1953119555577876482/hEUYzh4P_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-vitality".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_vit_rocket".to_string(),
            language: "all".to_string(),
            display_name: "Rocket".to_string(),
            handle: "@VIT_Rocket".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1724000262468063232/6QilZYA4_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-vitality".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_vit_ezo".to_string(),
            language: "all".to_string(),
            display_name: "Ezo".to_string(),
            handle: "@ezolebosss".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1993799046167715842/M3-f9hhy_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-team-vitality".to_string()],
            active: true,
        },
        // Karmine Corp
        SocialAccount {
            id: "fan_kc_luna".to_string(),
            language: "all".to_string(),
            display_name: "KC Luna🌙".to_string(),
            handle: "@busiolover".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2008977895725637632/DkELBco__400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-karmine-corp".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_kc_kharasu".to_string(),
            language: "all".to_string(),
            display_name: "Kharasu".to_string(),
            handle: "@Kharasu17".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1977454762011328512/DoAAL6zj_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-karmine-corp".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_kc_vico".to_string(),
            language: "all".to_string(),
            display_name: "𝘒𝘊𝘉𝘚 𝘝𝘪𝘤𝘰 🪐".to_string(),
            handle: "@Vicotrew".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1964748221370023936/lLPV-Cpb_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-karmine-corp".to_string()],
            active: true,
        },
        // Natus Vincere
        SocialAccount {
            id: "fan_navi_dropick".to_string(),
            language: "all".to_string(),
            display_name: "NAVI Dropick".to_string(),
            handle: "@Dropick5".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1973784041376665605/-QE-_RWl_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-natus-vincere".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_navi_fanpage".to_string(),
            language: "all".to_string(),
            display_name: "NaviFanpage".to_string(),
            handle: "@fanpagenavi".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1979119609937534977/40NFOnvc_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-natus-vincere".to_string()],
            active: true,
        },
        // Shifters
        SocialAccount {
            id: "fan_shf_mrityu".to_string(),
            language: "all".to_string(),
            display_name: "SHFT Mrityu".to_string(),
            handle: "@SHFT_Mrityu".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2040141559115436032/1NmjJJGg_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-shifters".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_shf_purplxxd".to_string(),
            language: "all".to_string(),
            display_name: "?Purplxxd?".to_string(),
            handle: "@Purplxxd".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2032309514394091523/1MfSoMDD_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-shifters".to_string()],
            active: true,
        },
        // SK Gaming
        SocialAccount {
            id: "fan_sk_coriolis".to_string(),
            language: "all".to_string(),
            display_name: "SK Coriolis".to_string(),
            handle: "@Cori0lis".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2043793635905298432/5gEMeO1a_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-sk-gaming".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_sk_estafadores".to_string(),
            language: "all".to_string(),
            display_name: "SK_Estafadores".to_string(),
            handle: "@SK_Estafadores".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2051740831426498560/-O3k77UX_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-sk-gaming".to_string()],
            active: true,
        },
        // GiantX
        SocialAccount {
            id: "fan_gx_warrin".to_string(),
            language: "all".to_string(),
            display_name: "Mr. Warrin".to_string(),
            handle: "@MisterWarrin".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/2014461924163854337/JvH9XaWh_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-giantx-lec".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_gx_cmunii".to_string(),
            language: "all".to_string(),
            display_name: "GX CMunii".to_string(),
            handle: "@CMuniifeo".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1952296908539539456/fuggQ3VS_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-giantx-lec".to_string()],
            active: true,
        },
        SocialAccount {
            id: "fan_gx_fexix".to_string(),
            language: "all".to_string(),
            display_name: "GXlover Fexix".to_string(),
            handle: "@Ffexix".to_string(),
            author_type: SocialAuthorType::Fan,
            profile_image_url: Some(
                "https://pbs.twimg.com/profile_images/1966129545704034304/STyr7Aki_400x400.jpg"
                    .to_string(),
            ),
            favorite_team_ids: vec!["lec-giantx-lec".to_string()],
            active: true,
        },
    ]
}
