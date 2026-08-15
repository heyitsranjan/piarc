//! Serializable Git working-tree models exposed to the frontend.

use serde::Serialize;

/// One staged or unstaged working-tree change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub staged: bool,
    pub untracked: bool,
}

/// Current repository identity and changed files.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChangesSnapshot {
    pub root: String,
    pub branch: String,
    pub files: Vec<GitFileChange>,
}
