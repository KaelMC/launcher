//! Locally-hosted Minecraft servers: a small, parallel system to the
//! `instances`/`profiles` system. Servers have a fundamentally different
//! runtime (no client auth/assets/natives, a `java -jar server.jar nogui`
//! launch command, EULA + `server.properties`, a graceful `stop` console
//! command) so they are modeled and persisted separately rather than as a
//! variant of an instance.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ServerLoader {
    Vanilla,
    Paper,
    Spigot,
    Fabric,
    Quilt,
    Forge,
    Neoforge,
}

impl ServerLoader {
    pub fn as_str(&self) -> &'static str {
        match *self {
            Self::Vanilla => "vanilla",
            Self::Paper => "paper",
            Self::Spigot => "spigot",
            Self::Fabric => "fabric",
            Self::Quilt => "quilt",
            Self::Forge => "forge",
            Self::Neoforge => "neoforge",
        }
    }

    pub fn from_str(val: &str) -> crate::Result<Self> {
        Ok(match val {
            "vanilla" => Self::Vanilla,
            "paper" => Self::Paper,
            "spigot" => Self::Spigot,
            "fabric" => Self::Fabric,
            "quilt" => Self::Quilt,
            "forge" => Self::Forge,
            "neoforge" => Self::Neoforge,
            _ => {
                return Err(crate::ErrorKind::OtherError(format!(
                    "Unknown server loader: {val}"
                ))
                .into());
            }
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ServerInstallStage {
    NotInstalled,
    Installing,
    Installed,
    Failed,
}

impl ServerInstallStage {
    pub fn as_str(&self) -> &'static str {
        match *self {
            Self::NotInstalled => "not_installed",
            Self::Installing => "installing",
            Self::Installed => "installed",
            Self::Failed => "failed",
        }
    }

    pub fn from_str(val: &str) -> Self {
        match val {
            "installing" => Self::Installing,
            "installed" => Self::Installed,
            "failed" => Self::Failed,
            _ => Self::NotInstalled,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Server {
    pub id: String,
    pub name: String,
    pub icon_path: Option<String>,

    pub loader: ServerLoader,
    pub loader_version: Option<String>,
    pub game_version: String,

    pub jar_path: Option<String>,
    pub install_stage: ServerInstallStage,
    pub install_error: Option<String>,
    pub install_job_id: Option<String>,
    pub eula_accepted: bool,

    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub last_played: Option<DateTime<Utc>>,
}

struct ServerRow {
    id: String,
    name: String,
    icon_path: Option<String>,
    loader: String,
    loader_version: Option<String>,
    game_version: String,
    jar_path: Option<String>,
    install_stage: String,
    install_error: Option<String>,
    install_job_id: Option<String>,
    eula_accepted: i64,
    created: i64,
    modified: i64,
    last_played: Option<i64>,
}

impl ServerRow {
    fn into_server(self) -> crate::Result<Server> {
        Ok(Server {
            id: self.id,
            name: self.name,
            icon_path: self.icon_path,
            loader: ServerLoader::from_str(&self.loader)?,
            loader_version: self.loader_version,
            game_version: self.game_version,
            jar_path: self.jar_path,
            install_stage: ServerInstallStage::from_str(&self.install_stage),
            install_error: self.install_error,
            install_job_id: self.install_job_id,
            eula_accepted: self.eula_accepted != 0,
            created: DateTime::from_timestamp(self.created, 0)
                .unwrap_or_default(),
            modified: DateTime::from_timestamp(self.modified, 0)
                .unwrap_or_default(),
            last_played: self
                .last_played
                .and_then(|value| DateTime::from_timestamp(value, 0)),
        })
    }
}

impl Server {
    pub fn directory(
        &self,
        directories: &crate::state::DirectoryInfo,
    ) -> std::path::PathBuf {
        directories.server_dir(&self.id)
    }

    pub async fn get(
        id: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<Option<Server>> {
        let row = sqlx::query_as!(
            ServerRow,
            "
			SELECT id, name, icon_path, loader, loader_version, game_version,
				jar_path, install_stage, install_error, install_job_id,
				eula_accepted, created, modified, last_played
			FROM servers
			WHERE id = ?
			",
            id,
        )
        .fetch_optional(pool)
        .await?;

        row.map(ServerRow::into_server).transpose()
    }

    pub async fn list(pool: &sqlx::SqlitePool) -> crate::Result<Vec<Server>> {
        let rows = sqlx::query_as!(
            ServerRow,
            "
			SELECT id, name, icon_path, loader, loader_version, game_version,
				jar_path, install_stage, install_error, install_job_id,
				eula_accepted, created, modified, last_played
			FROM servers
			ORDER BY modified DESC
			",
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(ServerRow::into_server).collect()
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        id: &str,
        name: &str,
        icon_path: Option<&str>,
        loader: ServerLoader,
        loader_version: Option<&str>,
        game_version: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<Server> {
        let now = Utc::now().timestamp();
        let loader_str = loader.as_str();
        let install_stage = ServerInstallStage::NotInstalled.as_str();

        sqlx::query!(
            "
			INSERT INTO servers
				(id, name, icon_path, loader, loader_version, game_version,
				 install_stage, created, modified)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			",
            id,
            name,
            icon_path,
            loader_str,
            loader_version,
            game_version,
            install_stage,
            now,
            now,
        )
        .execute(pool)
        .await?;

        Server::get(id, pool).await?.ok_or_else(|| {
            crate::ErrorKind::OtherError(
                "Failed to read back newly created server".to_string(),
            )
            .into()
        })
    }

    pub async fn remove(
        id: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        sqlx::query!("DELETE FROM servers WHERE id = ?", id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn rename(
        id: &str,
        name: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        let now = Utc::now().timestamp();
        sqlx::query!(
            "UPDATE servers SET name = ?, modified = ? WHERE id = ?",
            name,
            now,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn set_install_stage(
        id: &str,
        install_stage: ServerInstallStage,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        let now = Utc::now().timestamp();
        let install_stage = install_stage.as_str();
        sqlx::query!(
            "UPDATE servers SET install_stage = ?, install_error = NULL, modified = ? WHERE id = ?",
            install_stage,
            now,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn set_install_failed(
        id: &str,
        error: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        let now = Utc::now().timestamp();
        let install_stage = ServerInstallStage::Failed.as_str();
        sqlx::query!(
            "UPDATE servers SET install_stage = ?, install_error = ?, modified = ? WHERE id = ?",
            install_stage,
            error,
            now,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn set_install_job_id(
        id: &str,
        job_id: Option<&str>,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        sqlx::query!(
            "UPDATE servers SET install_job_id = ? WHERE id = ?",
            job_id,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn set_jar_path(
        id: &str,
        jar_path: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        let now = Utc::now().timestamp();
        sqlx::query!(
            "UPDATE servers SET jar_path = ?, modified = ? WHERE id = ?",
            jar_path,
            now,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn set_eula_accepted(
        id: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        sqlx::query!(
            "UPDATE servers SET eula_accepted = 1 WHERE id = ?",
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn touch_last_played(
        id: &str,
        pool: &sqlx::SqlitePool,
    ) -> crate::Result<()> {
        let now = Utc::now().timestamp();
        sqlx::query!(
            "UPDATE servers SET last_played = ?, modified = ? WHERE id = ?",
            now,
            now,
            id,
        )
        .execute(pool)
        .await?;

        Ok(())
    }
}
