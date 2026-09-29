use crate::api::Result;
use theseus::prelude::*;

pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("server")
        .invoke_handler(tauri::generate_handler![
            server_list,
            server_get,
            server_create,
            server_retry_install,
            server_rename,
            server_remove,
            server_start,
            server_stop,
            server_send_command,
            server_is_running,
            server_get_log_buffer,
            server_list_running,
        ])
        .build()
}

#[tauri::command]
pub async fn server_list() -> Result<Vec<Server>> {
    Ok(server::list().await?)
}

#[tauri::command]
pub async fn server_get(id: String) -> Result<Option<Server>> {
    Ok(server::get(id).await?)
}

#[tauri::command]
pub async fn server_create(
    name: String,
    icon_path: Option<String>,
    loader: String,
    loader_version: Option<String>,
    game_version: String,
) -> Result<Server> {
    Ok(server::create(
        name,
        icon_path,
        loader,
        loader_version,
        game_version,
    )
    .await?)
}

#[tauri::command]
pub async fn server_retry_install(id: String) -> Result<()> {
    Ok(server::retry_install(id).await?)
}

#[tauri::command]
pub async fn server_rename(id: String, name: String) -> Result<()> {
    Ok(server::rename(id, name).await?)
}

#[tauri::command]
pub async fn server_remove(id: String) -> Result<()> {
    Ok(server::remove(id).await?)
}

#[tauri::command]
pub async fn server_start(id: String) -> Result<ProcessMetadata> {
    Ok(server::start(id).await?)
}

#[tauri::command]
pub async fn server_stop(id: String) -> Result<()> {
    Ok(server::stop(id).await?)
}

#[tauri::command]
pub async fn server_send_command(id: String, command: String) -> Result<()> {
    Ok(server::send_command(id, command).await?)
}

#[tauri::command]
pub async fn server_is_running(id: String) -> Result<bool> {
    Ok(server::is_running(id).await?)
}

#[tauri::command]
pub async fn server_get_log_buffer(id: String) -> Result<Vec<String>> {
    Ok(server::get_log_buffer(id).await?)
}

#[tauri::command]
pub async fn server_list_running() -> Result<Vec<String>> {
    Ok(server::list_running().await?)
}
