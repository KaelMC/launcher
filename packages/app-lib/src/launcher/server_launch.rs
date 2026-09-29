//! Launches and stops locally-hosted Minecraft servers.
use crate::api::jre::auto_install_java;
use crate::state::{ProcessMetadata, Server, State};
use tokio::process::Command;

const DEFAULT_MEMORY_MB: u32 = 2048;
const GRACEFUL_STOP_TIMEOUT_SECS: u64 = 30;

async fn write_default_server_properties(
    server_dir: &std::path::Path,
) -> crate::Result<()> {
    let path = server_dir.join("server.properties");
    if path.exists() {
        return Ok(());
    }

    tokio::fs::write(
        &path,
        "# Minecraft server properties\n\
		motd=A Minecraft Server\n\
		server-port=25565\n\
		online-mode=true\n\
		max-players=20\n\
		gamemode=survival\n\
		difficulty=easy\n\
		level-name=world\n",
    )
    .await?;

    Ok(())
}

async fn write_eula(server_dir: &std::path::Path) -> crate::Result<()> {
    let path = server_dir.join("eula.txt");
    tokio::fs::write(
        &path,
        "# By starting this server, you accept the Mojang EULA at\n\
		# https://www.minecraft.net/en-us/eula\n\
		eula=true\n",
    )
    .await?;

    Ok(())
}

/// Accepts the EULA and launches a server's process. The caller is
/// responsible for having obtained the user's agreement to Mojang's EULA
/// before calling this (surfaced once in the frontend on first Start).
pub async fn start_server(server: &Server) -> crate::Result<ProcessMetadata> {
    let state = State::get().await?;

    let Some(jar_path) = &server.jar_path else {
        return Err(crate::ErrorKind::OtherError(
            "Server has not finished downloading yet".to_string(),
        )
        .into());
    };

    if state
        .server_process_manager
        .find_by_server_id(&server.id)
        .is_some()
    {
        return Err(crate::ErrorKind::OtherError(
            "Server is already running".to_string(),
        )
        .into());
    }

    let server_dir = server.directory(&state.directories);
    write_eula(&server_dir).await?;
    write_default_server_properties(&server_dir).await?;
    Server::set_eula_accepted(&server.id, &state.pool).await?;

    let java_path = auto_install_java(21).await?;

    let mut command = Command::new(java_path);
    command
        .arg(format!("-Xmx{DEFAULT_MEMORY_MB}M"))
        .arg("-jar")
        .arg(jar_path)
        .arg("nogui")
        .current_dir(&server_dir);

    let logs_folder = state.directories.server_logs_dir(&server.id);

    let metadata = state
        .server_process_manager
        .insert_new_process(
            &server.id,
            &server_dir.to_string_lossy(),
            &server.name,
            command,
            logs_folder,
        )
        .await?;

    Server::touch_last_played(&server.id, &state.pool).await?;

    Ok(metadata)
}

/// Gracefully stops a running server (writes `stop` to its console, then
/// force-kills it if it hasn't exited after a timeout).
pub async fn stop_server(server_id: &str) -> crate::Result<()> {
    let state = State::get().await?;
    let Some(uuid) = state.server_process_manager.find_by_server_id(server_id)
    else {
        return Ok(());
    };

    state
        .server_process_manager
        .stop_gracefully(uuid, GRACEFUL_STOP_TIMEOUT_SECS)
        .await
}

/// Sends a console command to a running server, e.g. `say hello` or `list`.
pub async fn send_server_command(
    server_id: &str,
    command: &str,
) -> crate::Result<()> {
    let state = State::get().await?;
    let Some(uuid) = state.server_process_manager.find_by_server_id(server_id)
    else {
        return Err(crate::ErrorKind::OtherError(
            "Server is not running".to_string(),
        )
        .into());
    };

    state.server_process_manager.write_stdin(uuid, command).await
}

pub async fn is_server_running(server_id: &str) -> crate::Result<bool> {
    let state = State::get().await?;
    Ok(state
        .server_process_manager
        .find_by_server_id(server_id)
        .is_some())
}

/// Returns the ids of every currently-running locally-hosted server.
pub async fn list_running_server_ids() -> crate::Result<Vec<String>> {
    let state = State::get().await?;
    Ok(state
        .server_process_manager
        .get_all()
        .into_iter()
        .map(|metadata| metadata.instance_id)
        .collect())
}
