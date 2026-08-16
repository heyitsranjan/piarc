use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::InstalledEditor;

struct EditorDefinition {
    id: &'static str,
    name: &'static str,
    app_bundle: &'static str,
}

const EDITORS: &[EditorDefinition] = &[
    EditorDefinition {
        id: "vscode",
        name: "Visual Studio Code",
        app_bundle: "Visual Studio Code.app",
    },
    EditorDefinition {
        id: "cursor",
        name: "Cursor",
        app_bundle: "Cursor.app",
    },
    EditorDefinition {
        id: "zed",
        name: "Zed",
        app_bundle: "Zed.app",
    },
    EditorDefinition {
        id: "windsurf",
        name: "Windsurf",
        app_bundle: "Windsurf.app",
    },
    EditorDefinition {
        id: "vscodium",
        name: "VSCodium",
        app_bundle: "VSCodium.app",
    },
    EditorDefinition {
        id: "sublime-text",
        name: "Sublime Text",
        app_bundle: "Sublime Text.app",
    },
    EditorDefinition {
        id: "nova",
        name: "Nova",
        app_bundle: "Nova.app",
    },
    EditorDefinition {
        id: "fleet",
        name: "Fleet",
        app_bundle: "Fleet.app",
    },
    EditorDefinition {
        id: "intellij-idea",
        name: "IntelliJ IDEA",
        app_bundle: "IntelliJ IDEA.app",
    },
    EditorDefinition {
        id: "webstorm",
        name: "WebStorm",
        app_bundle: "WebStorm.app",
    },
    EditorDefinition {
        id: "pycharm",
        name: "PyCharm",
        app_bundle: "PyCharm.app",
    },
    EditorDefinition {
        id: "android-studio",
        name: "Android Studio",
        app_bundle: "Android Studio.app",
    },
    EditorDefinition {
        id: "xcode",
        name: "Xcode",
        app_bundle: "Xcode.app",
    },
];

fn application_roots() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications")];
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Applications"));
    }
    roots
}

fn find_editor(id: &str) -> Option<(&'static EditorDefinition, PathBuf)> {
    let editor = EDITORS.iter().find(|editor| editor.id == id)?;
    let path = application_roots()
        .into_iter()
        .map(|root| root.join(editor.app_bundle))
        .find(|path| path.is_dir())?;
    Some((editor, path))
}

pub fn list_installed() -> Vec<InstalledEditor> {
    let roots = application_roots();
    EDITORS
        .iter()
        .filter(|editor| {
            roots
                .iter()
                .any(|root| root.join(editor.app_bundle).is_dir())
        })
        .map(|editor| InstalledEditor {
            id: editor.id.to_string(),
            name: editor.name.to_string(),
        })
        .collect()
}

pub fn open_folder(editor_id: &str, folder: &Path) -> anyhow::Result<()> {
    anyhow::ensure!(folder.is_dir(), "project folder does not exist");
    let (_, editor_path) =
        find_editor(editor_id).ok_or_else(|| anyhow::anyhow!("editor is not installed"))?;
    Command::new("/usr/bin/open")
        .arg("-a")
        .arg(editor_path)
        .arg(folder)
        .spawn()?;
    Ok(())
}

pub fn open_in_finder(folder: &Path) -> anyhow::Result<()> {
    anyhow::ensure!(folder.is_dir(), "project folder does not exist");
    Command::new("/usr/bin/open").arg(folder).spawn()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_editor_is_rejected() {
        let error = open_folder("not-an-editor", Path::new("/")).unwrap_err();
        assert_eq!(error.to_string(), "editor is not installed");
    }

    #[test]
    fn finder_rejects_missing_folder() {
        let error = open_in_finder(Path::new("/ompx-folder-that-does-not-exist")).unwrap_err();
        assert_eq!(error.to_string(), "project folder does not exist");
    }
}
