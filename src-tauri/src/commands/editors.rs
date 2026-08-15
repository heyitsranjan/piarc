use std::path::Path;

use crate::models::InstalledEditor;
use crate::services::editors;

/// Return supported editors installed in /Applications or ~/Applications.
#[tauri::command]
pub fn list_installed_editors() -> Vec<InstalledEditor> {
    editors::list_installed()
}

/// Open a project folder in one installed editor from the supported allowlist.
#[tauri::command]
pub fn open_folder_in_editor(editor_id: String, path: String) -> Result<(), String> {
    editors::open_folder(&editor_id, Path::new(&path)).map_err(|error| error.to_string())
}
