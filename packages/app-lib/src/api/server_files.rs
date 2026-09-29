//! File management for locally-hosted servers' own directories. This
//! mirrors `api::instance::files` (see that module for the richer,
//! managed-content-aware version used by instances) but is deliberately
//! simpler: a server's directory has no managed content or bindings to
//! reason about, just plain files.
use crate::State;
use crate::state::content_store::{input, validate_relative};
use crate::state::Server;
use serde::Serialize;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tokio::fs;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerFileItem {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub path: String,
    pub modified: u64,
    pub created: u64,
    pub size: Option<u64>,
    pub count: Option<usize>,
}

fn normalized(path: &str) -> &str {
    path.trim_start_matches('/')
}

async fn resolve(
    state: &State,
    server_id: &str,
    path: &str,
) -> crate::Result<PathBuf> {
    let path = normalized(path);
    let server = Server::get(server_id, &state.pool)
        .await?
        .ok_or_else(|| input("Unknown server"))?;
    let base = server.directory(&state.directories);

    if path.is_empty() {
        return Ok(base);
    }

    validate_relative(path)?;
    let destination = base.join(path);

    if let Ok(metadata) = fs::symlink_metadata(&destination).await
        && metadata.file_type().is_symlink()
    {
        return Err(input("Files cannot access a symbolic link or its target"));
    }

    Ok(destination)
}

pub async fn list_server_files(
    server_id: &str,
    path: &str,
) -> crate::Result<Vec<ServerFileItem>> {
    let state = State::get().await?;
    let directory = resolve(&state, server_id, path).await?;
    fs::create_dir_all(&directory).await?;
    let mut entries = fs::read_dir(&directory).await?;
    let mut output = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        let name = entry.file_name().to_string_lossy().into_owned();
        let relative = if normalized(path).is_empty() {
            name.clone()
        } else {
            format!("{}/{name}", normalized(path))
        };
        let file_type = entry.file_type().await?;
        let metadata = fs::metadata(entry.path()).await.ok();
        let count = if file_type.is_dir() && !file_type.is_symlink() {
            let mut children = fs::read_dir(entry.path()).await?;
            let mut count = 0;
            while children.next_entry().await?.is_some() {
                count += 1;
            }
            Some(count)
        } else {
            None
        };

        output.push(ServerFileItem {
            name,
            path: relative,
            kind: if file_type.is_dir() {
                "directory"
            } else if file_type.is_symlink() {
                "symlink"
            } else {
                "file"
            }
            .to_string(),
            modified: metadata
                .as_ref()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |time| time.as_secs()),
            created: metadata
                .as_ref()
                .and_then(|metadata| metadata.created().ok())
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |time| time.as_secs()),
            size: metadata
                .as_ref()
                .filter(|metadata| metadata.is_file())
                .map(|metadata| metadata.len()),
            count,
        });
    }

    Ok(output)
}

pub async fn read_server_file(
    server_id: &str,
    path: &str,
) -> crate::Result<Vec<u8>> {
    let state = State::get().await?;
    let destination = resolve(&state, server_id, path).await?;
    Ok(fs::read(destination).await?)
}

pub async fn write_server_file(
    server_id: &str,
    path: &str,
    bytes: &[u8],
    create_only: bool,
) -> crate::Result<()> {
    let state = State::get().await?;
    let destination = resolve(&state, server_id, path).await?;
    if create_only && fs::symlink_metadata(&destination).await.is_ok() {
        return Err(input("A file already exists at this path"));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| input("Invalid file destination"))?;
    fs::create_dir_all(parent).await?;
    fs::write(&destination, bytes).await?;
    Ok(())
}

pub async fn create_server_directory(
    server_id: &str,
    path: &str,
) -> crate::Result<()> {
    let state = State::get().await?;
    let destination = resolve(&state, server_id, path).await?;
    fs::create_dir_all(&destination).await?;
    Ok(())
}

pub async fn rename_server_file(
    server_id: &str,
    source: &str,
    destination: &str,
) -> crate::Result<()> {
    let state = State::get().await?;
    let source = resolve(&state, server_id, source).await?;
    let destination = resolve(&state, server_id, destination).await?;
    if fs::symlink_metadata(&destination).await.is_ok() {
        return Err(input("The destination already exists"));
    }
    fs::rename(source, destination).await?;
    Ok(())
}

pub async fn delete_server_file(
    server_id: &str,
    path: &str,
    recursive: bool,
) -> crate::Result<()> {
    let state = State::get().await?;
    let destination = resolve(&state, server_id, path).await?;
    if fs::symlink_metadata(&destination).await?.is_dir() {
        if recursive {
            fs::remove_dir_all(&destination).await?;
        } else {
            fs::remove_dir(&destination).await?;
        }
    } else {
        fs::remove_file(&destination).await?;
    }
    Ok(())
}
