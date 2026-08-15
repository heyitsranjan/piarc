//! OMP input-completion metadata exposed to the frontend.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpCommand {
    pub name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub description: Option<String>,
    pub source: Option<String>,
    pub input: Option<OmpCommandInput>,
    #[serde(default)]
    pub subcommands: Vec<OmpSubcommand>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OmpCommandInput {
    pub hint: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OmpSubcommand {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpPathSuggestion {
    pub path: String,
    pub is_directory: bool,
}
