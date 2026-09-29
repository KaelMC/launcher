//! Theseus locally-hosted server management interface
use crate::launcher::server_download::download_server;
use crate::launcher::server_launch::{
    is_server_running, list_running_server_ids, send_server_command,
    start_server, stop_server,
};
use crate::state::{ProcessMetadata, Server, ServerLoader, State};
use uuid::Uuid;

#[tracing::instrument]
pub async fn list() -> crate::Result<Vec<Server>> {
    let state = State::get().await?;
    Server::list(&state.pool).await
}

#[tracing::instrument]
pub async fn get(id: String) -> crate::Result<Option<Server>> {
    let state = State::get().await?;
    Server::get(&id, &state.pool).await
}

#[tracing::instrument]
#[allow(clippy::too_many_arguments)]
pub async fn create(
    name: String,
    icon_path: Option<String>,
    loader: String,
    loader_version: Option<String>,
    game_version: String,
) -> crate::Result<Server> {
    let state = State::get().await?;
    let loader = ServerLoader::from_str(&loader)?;
    let id = Uuid::new_v4().to_string();

    let server = Server::create(
        &id,
        &name,
        icon_path.as_deref(),
        loader,
        loader_version.as_deref(),
        &game_version,
        &state.pool,
    )
    .await?;

    spawn_download(server.id.clone());

    Ok(server)
}

/// Retries downloading a server that previously failed to install.
#[tracing::instrument]
pub async fn retry_install(id: String) -> crate::Result<()> {
    spawn_download(id);
    Ok(())
}

fn spawn_download(server_id: String) {
    tokio::spawn(async move {
        if let Ok(Some(server)) =
            Server::get(&server_id, &State::get().await?.pool).await
        {
            if let Err(error) = download_server(&server).await {
                tracing::error!(
                    "Failed to download server {}: {error}",
                    server.id
                );
            }
        }
        crate::Result::<()>::Ok(())
    });
}

#[tracing::instrument]
pub async fn rename(id: String, name: String) -> crate::Result<()> {
    let state = State::get().await?;
    Server::rename(&id, &name, &state.pool).await
}

#[tracing::instrument]
pub async fn remove(id: String) -> crate::Result<()> {
    let state = State::get().await?;

    let _ = stop_server(&id).await;

    if let Some(server) = Server::get(&id, &state.pool).await? {
        let dir = server.directory(&state.directories);
        if dir.exists() {
            tokio::fs::remove_dir_all(&dir).await?;
        }
    }

    Server::remove(&id, &state.pool).await
}

#[tracing::instrument]
pub async fn start(id: String) -> crate::Result<ProcessMetadata> {
    let state = State::get().await?;
    let server = Server::get(&id, &state.pool).await?.ok_or_else(|| {
        crate::ErrorKind::OtherError(format!("Unknown server: {id}"))
    })?;

    start_server(&server).await
}

#[tracing::instrument]
pub async fn stop(id: String) -> crate::Result<()> {
    stop_server(&id).await
}

#[tracing::instrument]
pub async fn send_command(id: String, command: String) -> crate::Result<()> {
    send_server_command(&id, &command).await
}

#[tracing::instrument]
pub async fn is_running(id: String) -> crate::Result<bool> {
    is_server_running(&id).await
}

#[tracing::instrument]
pub async fn get_log_buffer(id: String) -> crate::Result<Vec<String>> {
    Ok(crate::state::get_log_buffer(&id))
}

#[tracing::instrument]
pub async fn list_running() -> crate::Result<Vec<String>> {
    list_running_server_ids().await
}
