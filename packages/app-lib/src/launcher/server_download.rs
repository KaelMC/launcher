//! Downloads server software for locally-hosted Minecraft servers.
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use uuid::Uuid;

use crate::api::jre::auto_install_java_with_reporter;
use crate::install::events::emit_install_job;
use crate::install::model::{
    InstallErrorView, InstallJobDisplay, InstallJobEventKind, InstallJobState,
    InstallJobStatus, InstallPhaseDetails, InstallPhaseId, InstallProgress,
    InstallRequest,
};
use crate::install::store;
use crate::install::InstallProgressReporter;
use crate::state::{Server, ServerInstallStage, ServerLoader, State};
use crate::util::fetch::{FetchProgressFn, fetch_file};
use daedalus::minecraft::DownloadType;

use super::download::download_version_info;

/// Creates a real install job for a server download, so it shows up in the
/// app's download manager exactly like an instance/modpack install does.
async fn create_server_install_job(
    state: &State,
    server: &Server,
) -> crate::Result<(Uuid, InstallProgressReporter)> {
    let job_id = Uuid::new_v4();
    let request = InstallRequest::DownloadServer {
        server_id: server.id.clone(),
        server_name: server.name.clone(),
        icon_path: server.icon_path.clone(),
    };
    let mut job_state = InstallJobState::new(request);
    job_state.display = Some(InstallJobDisplay {
        title: server.name.clone(),
        icon: server.icon_path.clone(),
    });
    job_state.progress.phase = InstallPhaseId::DownloadingServer;

    let record =
        store::insert(job_id, &job_state, InstallJobStatus::Running, state)
            .await?;
    emit_install_job(&record.snapshot()).await?;

    Server::set_install_job_id(
        &server.id,
        Some(&job_id.to_string()),
        &state.pool,
    )
    .await?;

    let reporter = InstallProgressReporter::new(job_id, job_state);
    Ok((job_id, reporter))
}

/// Marks a server's install job finished, successfully or not.
async fn finish_server_install_job(
    state: &State,
    job_id: Uuid,
    error: Option<&crate::Error>,
) -> crate::Result<()> {
    let record = store::get_required(job_id, state).await?;
    let mut job_state = record.state;

    let status = match error {
        None => {
            job_state.record_event(InstallJobEventKind::JobSucceeded {
                instance_id: None,
            });
            job_state.progress.phase = InstallPhaseId::Finalizing;
            job_state.progress.progress = None;
            job_state.progress.details = InstallPhaseDetails::Empty;
            job_state.error = None;
            InstallJobStatus::Succeeded
        }
        Some(error) => {
            let failed_phase = job_state.progress.phase;
            job_state.record_event(InstallJobEventKind::Failed {
                phase: failed_phase,
                code: "network_error".to_string(),
                message: error.to_string(),
            });
            job_state.error = Some(InstallErrorView::from_error(
                "network_error",
                failed_phase,
                error,
                None,
            ));
            InstallJobStatus::Failed
        }
    };

    if let Some(record) =
        store::finish_active(job_id, status, &job_state, state).await?
    {
        emit_install_job(&record.snapshot()).await?;
    }

    Ok(())
}

/// Downloads `url` into `jar_path`, reporting byte-level progress through
/// the given install job reporter, the same way instance/Minecraft
/// downloads report progress to the app's download manager.
async fn download_server_jar(
    state: &State,
    reporter: &InstallProgressReporter,
    url: &str,
    sha1: Option<&str>,
    jar_path: &Path,
) -> crate::Result<()> {
    let mut progress_fn = {
        let reporter = reporter.clone();
        move |current: u64,
              total: u64|
              -> Pin<Box<dyn Future<Output = crate::Result<()>> + Send>> {
            let reporter = reporter.clone();
            Box::pin(async move {
                if total > 0 {
                    reporter
                        .update(
                            InstallPhaseId::DownloadingServer,
                            Some(InstallProgress {
                                current,
                                total,
                                secondary: None,
                            }),
                            InstallPhaseDetails::Empty,
                        )
                        .await?;
                }
                Ok(())
            })
        }
    };

    let downloaded = fetch_file(
        url,
        sha1,
        None,
        None,
        &state.fetch_semaphore,
        &state.pool,
        Some(&mut progress_fn as &mut FetchProgressFn<'_>),
    )
    .await?;
    downloaded.copy_to(jar_path, &state.io_semaphore).await?;

    Ok(())
}

/// Downloads the vanilla server jar for `game_version` into the server's
/// directory, updating its `jar_path`/`install_stage` in the database.
/// Returns the path to the downloaded jar.
pub async fn download_vanilla_server(
    server: &Server,
) -> crate::Result<PathBuf> {
    let state = State::get().await?;

    Server::set_install_stage(
        &server.id,
        ServerInstallStage::Installing,
        &state.pool,
    )
    .await?;

    let (job_id, reporter) =
        create_server_install_job(&state, server).await?;
    let result =
        download_vanilla_server_inner(&state, server, &reporter).await;
    finish_server_install_job(&state, job_id, result.as_ref().err()).await?;

    match &result {
        Ok(_) => {
            Server::set_install_stage(
                &server.id,
                ServerInstallStage::Installed,
                &state.pool,
            )
            .await?;
        }
        Err(error) => {
            Server::set_install_failed(
                &server.id,
                &error.to_string(),
                &state.pool,
            )
            .await?;
        }
    }

    result
}

async fn download_vanilla_server_inner(
    state: &State,
    server: &Server,
    reporter: &InstallProgressReporter,
) -> crate::Result<PathBuf> {
    let manifest = crate::api::metadata::get_minecraft_versions().await?;
    let version = manifest
        .versions
        .iter()
        .find(|v| v.id == server.game_version)
        .ok_or_else(|| {
            crate::ErrorKind::OtherError(format!(
                "Unknown Minecraft version: {}",
                server.game_version
            ))
        })?;

    let version_info =
        download_version_info(state, version, None, None, None, None)
            .await?;

    let download = version_info
        .downloads
        .get(&DownloadType::Server)
        .ok_or_else(|| {
            crate::ErrorKind::OtherError(format!(
                "No server download exists for Minecraft version {}",
                server.game_version
            ))
        })?;

    let server_dir = server.directory(&state.directories);
    tokio::fs::create_dir_all(&server_dir).await?;
    let jar_path = server_dir.join("server.jar");

    download_server_jar(
        state,
        reporter,
        &download.url,
        Some(&download.sha1),
        &jar_path,
    )
    .await?;

    // Pre-warm the Java runtime this server will need, matching the
    // client's own default of Java 21 for modern Minecraft versions.
    let java_version = version_info
        .java_version
        .as_ref()
        .map(|v| v.major_version)
        .unwrap_or(21);
    let _ = auto_install_java_with_reporter(java_version, reporter.clone())
        .await?;

    Server::set_jar_path(
        &server.id,
        &jar_path.to_string_lossy(),
        &state.pool,
    )
    .await?;

    Ok(jar_path)
}

/// Downloads the Paper server jar for `game_version`, using PaperMC's
/// public build API (the latest stable build for that Minecraft version).
pub async fn download_paper_server(
    server: &Server,
) -> crate::Result<PathBuf> {
    let state = State::get().await?;

    Server::set_install_stage(
        &server.id,
        ServerInstallStage::Installing,
        &state.pool,
    )
    .await?;

    let (job_id, reporter) =
        create_server_install_job(&state, server).await?;
    let result =
        download_paper_server_inner(&state, server, &reporter).await;
    finish_server_install_job(&state, job_id, result.as_ref().err()).await?;

    match &result {
        Ok(_) => {
            Server::set_install_stage(
                &server.id,
                ServerInstallStage::Installed,
                &state.pool,
            )
            .await?;
        }
        Err(error) => {
            Server::set_install_failed(
                &server.id,
                &error.to_string(),
                &state.pool,
            )
            .await?;
        }
    }

    result
}

// PaperMC's old v2 API (api.papermc.io/v2) has been sunset; this uses their
// replacement, the Fill v3 API (fill.papermc.io/v3), whose builds are
// returned newest-first and already include a ready-to-use download URL.
#[derive(serde::Deserialize)]
struct PaperBuild {
    channel: String,
    downloads: std::collections::HashMap<String, PaperBuildDownload>,
}

#[derive(serde::Deserialize)]
struct PaperBuildDownload {
    url: String,
}

async fn download_paper_server_inner(
    state: &State,
    server: &Server,
    reporter: &InstallProgressReporter,
) -> crate::Result<PathBuf> {
    let builds_url = format!(
        "https://fill.papermc.io/v3/projects/paper/versions/{}/builds",
        server.game_version
    );

    let response: Vec<PaperBuild> = crate::util::fetch::fetch_json(
        reqwest::Method::GET,
        &builds_url,
        None,
        None,
        None,
        &state.api_semaphore,
        &state.pool,
    )
    .await?;

    let build = response
        .iter()
        .find(|b| b.channel.eq_ignore_ascii_case("stable"))
        .or_else(|| response.first())
        .ok_or_else(|| {
            crate::ErrorKind::OtherError(format!(
                "No Paper builds exist for Minecraft version {}",
                server.game_version
            ))
        })?;

    let download = build
        .downloads
        .get("server:default")
        .ok_or_else(|| {
            crate::ErrorKind::OtherError(format!(
                "Paper build for Minecraft version {} has no server download",
                server.game_version
            ))
        })?;

    let server_dir = server.directory(&state.directories);
    tokio::fs::create_dir_all(&server_dir).await?;
    let jar_path = server_dir.join("server.jar");

    download_server_jar(state, reporter, &download.url, None, &jar_path)
        .await?;

    let _ =
        auto_install_java_with_reporter(21, reporter.clone()).await?;

    Server::set_jar_path(
        &server.id,
        &jar_path.to_string_lossy(),
        &state.pool,
    )
    .await?;

    Ok(jar_path)
}

/// Downloads server software for a server, dispatching to the loader-specific
/// implementation. Loaders without a real implementation yet return an
/// error explaining they are not supported.
pub async fn download_server(server: &Server) -> crate::Result<PathBuf> {
    match server.loader {
        ServerLoader::Vanilla => download_vanilla_server(server).await,
        ServerLoader::Paper => download_paper_server(server).await,
        ServerLoader::Spigot
        | ServerLoader::Fabric
        | ServerLoader::Quilt
        | ServerLoader::Forge
        | ServerLoader::Neoforge => {
            let state = State::get().await?;
            let error = format!(
                "{} servers are not supported yet",
                server.loader.as_str()
            );

            Server::set_install_stage(
                &server.id,
                ServerInstallStage::Installing,
                &state.pool,
            )
            .await?;
            let (job_id, _reporter) =
                create_server_install_job(&state, server).await?;
            let result: crate::Result<PathBuf> =
                Err(crate::ErrorKind::OtherError(error.clone()).into());
            finish_server_install_job(
                &state,
                job_id,
                result.as_ref().err(),
            )
            .await?;
            Server::set_install_failed(&server.id, &error, &state.pool)
                .await?;

            result
        }
    }
}
