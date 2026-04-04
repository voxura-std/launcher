use super::fabric::maven_name_to_path;
use crate::launcher::download::get_game_dir;
use reqwest::Client;
use std::path::Path;
use tauri::{AppHandle, Emitter};

const QUILT_META: &str = "https://meta.quiltmc.org/v3/versions/loader";

pub async fn install_quilt(
    app: &AppHandle,
    mc_version: &str,
    loader_version: &str,
) -> Result<(), String> {
    let game_dir = get_game_dir(app);
    let client = Client::new();

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": format!("Installation de Quilt {loader_version}…"),
            "current": 0, "total": 3, "percent": 0
        }),
    );

    let profile_url = format!("{QUILT_META}/{loader_version}/{mc_version}/profile/json");

    let profile_text = client
        .get(&profile_url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Quilt : {e}"))?
        .text()
        .await
        .map_err(|e| format!("Lecture profil Quilt : {e}"))?;

    let profile: serde_json::Value = serde_json::from_str(&profile_text)
        .map_err(|e| format!("Profil Quilt invalide ({e}) : {profile_text}"))?;

    let quilt_version_id = profile["id"]
        .as_str()
        .ok_or("ID version Quilt manquant")?
        .to_string();

    let version_dir = game_dir.join("versions").join(&quilt_version_id);
    tokio::fs::create_dir_all(&version_dir)
        .await
        .map_err(|e| format!("Création dossier Quilt : {e}"))?;

    let profile_path = version_dir.join(format!("{quilt_version_id}.json"));
    tokio::fs::write(&profile_path, &profile_text)
        .await
        .map_err(|e| format!("Écriture profil Quilt : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Téléchargement des librairies Quilt…",
            "current": 1, "total": 3, "percent": 40
        }),
    );

    download_quilt_libraries(&client, &profile, &game_dir).await?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Quilt installé !",
            "current": 3, "total": 3, "percent": 100
        }),
    );

    Ok(())
}

pub async fn get_quilt_version_id(
    mc_version: &str,
    loader_version: &str,
) -> Result<String, String> {
    let url = format!("{QUILT_META}/{loader_version}/{mc_version}/profile/json");
    let client = Client::new();

    let text = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erreur Quilt : {e}"))?
        .text()
        .await
        .map_err(|e| format!("Lecture Quilt : {e}"))?;

    let profile: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Profil Quilt invalide : {e}"))?;

    profile["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("ID Quilt manquant".to_string())
}

pub fn is_quilt_installed(game_dir: &Path, mc_version: &str, loader_version: &str) -> bool {
    let pattern = format!("quilt-loader-{loader_version}-{mc_version}");
    let version_dir = game_dir.join("versions").join(&pattern);

    if !version_dir.join(format!("{pattern}.json")).exists() {
        return false;
    }

    let quilt_jar = game_dir.join("libraries").join(format!(
        "org/quiltmc/quilt-loader/{loader_version}/quilt-loader-{loader_version}.jar"
    ));
    quilt_jar.exists()
}

async fn download_quilt_libraries(
    client: &Client,
    profile: &serde_json::Value,
    game_dir: &Path,
) -> Result<(), String> {
    let libs = match profile["libraries"].as_array() {
        Some(l) => l,
        None => return Ok(()),
    };

    let libs_dir = game_dir.join("libraries");

    for lib in libs {
        let name = lib["name"].as_str().unwrap_or("");
        let url = lib["url"]
            .as_str()
            .unwrap_or("https://maven.quiltmc.org/repository/release/");

        if let Some(path) = maven_name_to_path(name) {
            let dest = libs_dir.join(&path);
            if dest.exists() {
                continue;
            }

            if let Some(parent) = dest.parent() {
                tokio::fs::create_dir_all(parent).await.ok();
            }

            let download_url = format!("{url}{path}");
            if let Ok(resp) = client.get(&download_url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    tokio::fs::write(&dest, &bytes).await.ok();
                }
            }
        }
    }

    Ok(())
}
