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

#[tauri::command]
pub fn update_custom_model(
    original_provider_id: String,
    original_model_id: String,
    draft: CustomModelDraft,
) -> Result<CustomModel, String> {
    custom_models::update(&original_provider_id, &original_model_id, &draft)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_custom_model(provider_id: String, model_id: String) -> Result<(), String> {
    custom_models::delete(&provider_id, &model_id).map_err(|error| error.to_string())
}
