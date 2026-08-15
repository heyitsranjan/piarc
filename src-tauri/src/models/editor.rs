use serde::Serialize;

/// A supported editor detected on this machine.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledEditor {
    pub id: String,
    pub name: String,
}
