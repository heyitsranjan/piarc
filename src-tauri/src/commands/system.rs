use crate::services::omp::{self, OmpStatus};
use crate::services::permissions::{self, MachinePermission, PermissionKind};

#[tauri::command]
pub fn get_omp_status() -> OmpStatus {
    omp::status()
}

#[tauri::command]
pub fn get_machine_permissions() -> Vec<MachinePermission> {
    permissions::list()
}

#[tauri::command]
pub fn open_permission_settings(kind: PermissionKind) -> Result<(), String> {
    permissions::open_settings(kind).map_err(|error| error.to_string())
}
