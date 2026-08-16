use crate::services::omp::{self, OmpStatus};
use crate::services::permissions::{self, MachinePermission, PermissionKind};

#[tauri::command]
pub fn get_omp_status() -> OmpStatus {
    omp::status()
}

#[tauri::command]
pub async fn check_omp_update() -> Result<omp::OmpUpdate, String> {
    tauri::async_runtime::spawn_blocking(omp::check_update)
        .await
        .map_err(|error| format!("OMP update check failed: {error}"))?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn install_omp_update() -> Result<OmpStatus, String> {
    tauri::async_runtime::spawn_blocking(omp::install_update)
        .await
        .map_err(|error| format!("OMP update failed: {error}"))?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_machine_permissions() -> Vec<MachinePermission> {
    permissions::list()
}

#[tauri::command]
pub fn open_permission_settings(kind: PermissionKind) -> Result<(), String> {
    permissions::open_settings(kind).map_err(|error| error.to_string())
}
