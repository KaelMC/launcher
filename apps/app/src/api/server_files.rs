use crate::api::Result;
use theseus::prelude::*;

pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("server-files")
        .invoke_handler(tauri::generate_handler![
            server_file_list,
            server_file_read,
            server_file_write,
            server_file_create_directory,
            server_file_rename,
            server_file_delete,
        ])
        .build()
}

#[tauri::command]
pub async fn server_file_list(
    server_id: &str,
    path: &str,
) -> Result<Vec<server_files::ServerFileItem>> {
    Ok(server_files::list_server_files(server_id, path).await?)
}

#[tauri::command]
pub async fn server_file_read(server_id: &str, path: &str) -> Result<Vec<u8>> {
    Ok(server_files::read_server_file(server_id, path).await?)
}

#[tauri::command]
pub async fn server_file_write(
    server_id: &str,
    path: &str,
    bytes: Vec<u8>,
    create_only: bool,
) -> Result<()> {
    Ok(server_files::write_server_file(
        server_id,
        path,
        &bytes,
        create_only,
    )
    .await?)
}

#[tauri::command]
pub async fn server_file_create_directory(
    server_id: &str,
    path: &str,
) -> Result<()> {
    Ok(server_files::create_server_directory(server_id, path).await?)
}

#[tauri::command]
pub async fn server_file_rename(
    server_id: &str,
    source: &str,
    destination: &str,
) -> Result<()> {
    Ok(
        server_files::rename_server_file(server_id, source, destination)
            .await?,
    )
}

#[tauri::command]
pub async fn server_file_delete(
    server_id: &str,
    path: &str,
    recursive: bool,
) -> Result<()> {
    Ok(server_files::delete_server_file(server_id, path, recursive).await?)
}
