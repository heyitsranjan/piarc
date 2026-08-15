use std::process::Command;

#[cfg(not(target_os = "macos"))]
use anyhow::bail;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionKind {
    Automation,
    Accessibility,
    ScreenRecording,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionState {
    Granted,
    Denied,
    ManagedBySystem,
    #[cfg(not(target_os = "macos"))]
    Unsupported,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachinePermission {
    pub kind: PermissionKind,
    pub state: PermissionState,
    pub title: &'static str,
    pub detail: &'static str,
}

pub fn list() -> Vec<MachinePermission> {
    vec![
        MachinePermission {
            kind: PermissionKind::Automation,
            state: PermissionState::ManagedBySystem,
            title: "Automation",
            detail: "Requested per application when an approved terminal action controls it.",
        },
        MachinePermission {
            kind: PermissionKind::Accessibility,
            state: accessibility_state(),
            title: "Accessibility",
            detail: "Required only for reading or controlling another application's interface.",
        },
        MachinePermission {
            kind: PermissionKind::ScreenRecording,
            state: screen_recording_state(),
            title: "Screen Recording",
            detail: "Required only when an approved action needs to inspect screen pixels.",
        },
    ]
}

pub fn open_settings(kind: PermissionKind) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        let pane = match kind {
            PermissionKind::Automation => "Privacy_Automation",
            PermissionKind::Accessibility => "Privacy_Accessibility",
            PermissionKind::ScreenRecording => "Privacy_ScreenCapture",
        };
        let url = format!("x-apple.systempreferences:com.apple.preference.security?{pane}");
        Command::new("/usr/bin/open")
            .arg(url)
            .status()
            .context("open Privacy & Security settings")
            .and_then(|status| {
                anyhow::ensure!(status.success(), "System Settings could not be opened");
                Ok(())
            })
    }

    #[cfg(not(target_os = "macos"))]
    bail!("machine permissions are supported on macOS only")
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
}

fn state_from_authorization(granted: bool) -> PermissionState {
    if granted {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    }
}

fn accessibility_state() -> PermissionState {
    #[cfg(target_os = "macos")]
    unsafe {
        state_from_authorization(AXIsProcessTrusted())
    }

    #[cfg(not(target_os = "macos"))]
    PermissionState::Unsupported
}

fn screen_recording_state() -> PermissionState {
    #[cfg(target_os = "macos")]
    unsafe {
        state_from_authorization(CGPreflightScreenCaptureAccess())
    }

    #[cfg(not(target_os = "macos"))]
    PermissionState::Unsupported
}

#[cfg(test)]
mod tests {
    use super::{list, state_from_authorization, PermissionKind, PermissionState};

    #[test]
    fn exposes_each_supported_permission_once() {
        let permissions = list();
        assert_eq!(permissions.len(), 3);
        assert!(permissions
            .iter()
            .any(|item| matches!(item.kind, PermissionKind::Automation)));
        assert!(permissions
            .iter()
            .any(|item| matches!(item.kind, PermissionKind::Accessibility)));
        assert!(permissions
            .iter()
            .any(|item| matches!(item.kind, PermissionKind::ScreenRecording)));
    }

    #[test]
    fn denied_and_revoked_access_remain_not_granted() {
        assert_eq!(
            state_from_authorization(false),
            PermissionState::Denied,
            "a denied request must not be reported as granted"
        );

        let initially_granted = state_from_authorization(true);
        let after_revocation = state_from_authorization(false);
        assert_eq!(initially_granted, PermissionState::Granted);
        assert_eq!(after_revocation, PermissionState::Denied);
    }
}
