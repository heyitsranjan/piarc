use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomModelApi {
    OpenaiCompletions,
    OpenaiResponses,
    AnthropicMessages,
}

impl CustomModelApi {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OpenaiCompletions => "openai-completions",
            Self::OpenaiResponses => "openai-responses",
            Self::AnthropicMessages => "anthropic-messages",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomModelDraft {
    pub name: String,
    pub provider_name: String,
    pub base_url: String,
    pub api_key: String,
    pub model_id: String,
    pub api: CustomModelApi,
    pub reasoning: bool,
    pub image_input: bool,
    pub context_window: u64,
    pub max_tokens: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomModel {
    pub provider_id: String,
    pub provider_name: String,
    pub name: String,
    pub model_id: String,
    pub base_url: String,
    pub api: CustomModelApi,
    pub reasoning: bool,
    pub image_input: bool,
    pub context_window: u64,
    pub max_tokens: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionReport {
    pub success: bool,
    pub message: String,
}
