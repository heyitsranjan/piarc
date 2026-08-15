use crate::{
    models::{ConnectionReport, CustomModel, CustomModelDraft},
    services::custom_models,
};

#[tauri::command]
pub async fn test_custom_model(draft: CustomModelDraft) -> Result<ConnectionReport, String> {
    custom_models::test(&draft)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_custom_model(draft: CustomModelDraft) -> Result<CustomModel, String> {
    custom_models::save(&draft).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_custom_models() -> Result<Vec<CustomModel>, String> {
    custom_models::list().map_err(|error| error.to_string())
}
