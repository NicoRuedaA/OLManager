use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(feature = "typescript")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum MessageCategory {
    Welcome,
    LeagueInfo,
    MatchPreview,
    MatchResult,
    Transfer,
    BoardDirective,
    PlayerMorale,
    Injury,
    Training,
    Finance,
    Contract,
    ScoutReport,
    Media,
    System,
    JobOffer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum MessagePriority {
    Low,
    Normal,
    High,
    Urgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct MessageAction {
    pub id: String,
    pub label: String,
    pub action_type: ActionType,
    pub resolved: bool,
    /// Optional i18n key for the action label (frontend resolves via t())
    #[serde(default)]
    pub label_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum ActionType {
    Acknowledge,
    NavigateTo { route: String },
    ChooseOption { options: Vec<ActionOption> },
    Dismiss,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ActionOption {
    pub id: String,
    pub label: String,
    pub description: String,
    #[serde(default)]
    pub label_key: Option<String>,
    #[serde(default)]
    pub description_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct InboxMessage {
    pub id: String,
    pub subject: String,
    pub body: String,
    pub sender: String,
    pub sender_role: String,
    pub date: String,
    pub read: bool,
    pub category: MessageCategory,
    pub priority: MessagePriority,
    pub actions: Vec<MessageAction>,
    /// Optional references to entities relevant to this message
    pub context: MessageContext,
    /// Optional i18n key for the subject (frontend resolves via t())
    #[serde(default)]
    pub subject_key: Option<String>,
    /// Optional i18n key for the body (frontend resolves via t())
    #[serde(default)]
    pub body_key: Option<String>,
    /// Optional i18n key for the sender name (frontend resolves via t())
    #[serde(default)]
    pub sender_key: Option<String>,
    /// Optional i18n key for the sender role (frontend resolves via t())
    #[serde(default)]
    pub sender_role_key: Option<String>,
    /// Interpolation parameters for the i18n keys (shared by subject/body/sender)
    #[serde(default)]
    pub i18n_params: HashMap<String, String>,
    /// Optional icon identifier for the sender (rendered in UI, e.g. "board", "coach", "scout")
    #[serde(default)]
    pub sender_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct MessageContext {
    pub team_id: Option<String>,
    pub player_id: Option<String>,
    pub fixture_id: Option<String>,
    pub match_result: Option<ContextMatchResult>,
    #[serde(default)]
    pub scout_report: Option<ScoutReportData>,
    #[serde(default)]
    pub delegated_renewal_report: Option<DelegatedRenewalReportData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct DelegatedRenewalReportData {
    pub success_count: u32,
    pub failure_count: u32,
    pub stalled_count: u32,
    pub cases: Vec<DelegatedRenewalCaseData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct DelegatedRenewalCaseData {
    pub player_id: String,
    pub player_name: String,
    pub status: String,
    #[serde(default)]
    pub agreed_wage: Option<u32>,
    #[serde(default)]
    pub agreed_years: Option<u32>,
    #[serde(default)]
    pub note_key: Option<String>,
    #[serde(default)]
    pub note_params: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ScoutReportData {
    pub player_id: String,
    pub player_name: String,
    pub position: String,
    pub nationality: String,
    pub dob: String,
    pub team_name: Option<String>,
    /// Fuzzed attributes — None means not discovered by this scout
    pub pace: Option<u8>,
    pub shooting: Option<u8>,
    pub passing: Option<u8>,
    pub dribbling: Option<u8>,
    pub defending: Option<u8>,
    pub physical: Option<u8>,
    #[serde(default)]
    pub mechanics: Option<u8>,
    #[serde(default)]
    pub laning: Option<u8>,
    #[serde(default)]
    pub teamfighting: Option<u8>,
    #[serde(default, rename = "macro")]
    pub macro_: Option<u8>,
    #[serde(default)]
    pub champion_pool: Option<u8>,
    #[serde(default)]
    pub discipline: Option<u8>,
    pub condition: Option<u8>,
    pub morale: Option<u8>,
    /// Approximate overall rating (fuzzed average)
    pub avg_rating: Option<u32>,
    /// i18n key for overall rating description
    pub rating_key: String,
    /// i18n key for potential assessment
    pub potential_key: String,
    /// i18n key for report confidence level
    pub confidence_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ContextMatchResult {
    pub home_team_id: String,
    pub away_team_id: String,
    pub home_goals: u8,
    pub away_goals: u8,
}

impl InboxMessage {
    pub fn new(id: String, subject: String, body: String, sender: String, date: String) -> Self {
        Self {
            id,
            subject,
            body,
            sender,
            sender_role: String::new(),
            date,
            read: false,
            category: MessageCategory::System,
            priority: MessagePriority::Normal,
            actions: vec![],
            context: MessageContext::default(),
            subject_key: None,
            body_key: None,
            sender_key: None,
            sender_role_key: None,
            i18n_params: HashMap::new(),
            sender_icon: None,
        }
    }

    pub fn with_category(mut self, category: MessageCategory) -> Self {
        self.category = category;
        self
    }

    pub fn with_priority(mut self, priority: MessagePriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_sender_role(mut self, role: &str) -> Self {
        self.sender_role = role.to_string();
        self
    }

    pub fn with_action(mut self, action: MessageAction) -> Self {
        self.actions.push(action);
        self
    }

    pub fn with_context(mut self, context: MessageContext) -> Self {
        self.context = context;
        self
    }

    pub fn with_i18n(
        mut self,
        subject_key: &str,
        body_key: &str,
        params: HashMap<String, String>,
    ) -> Self {
        self.subject_key = Some(subject_key.to_string());
        self.body_key = Some(body_key.to_string());
        self.i18n_params = params;
        self
    }

    pub fn with_sender_i18n(mut self, sender_key: &str, role_key: &str) -> Self {
        self.sender_key = Some(sender_key.to_string());
        self.sender_role_key = Some(role_key.to_string());
        self
    }

    pub fn with_sender_icon(mut self, icon: &str) -> Self {
        self.sender_icon = Some(icon.to_string());
        self
    }
}
