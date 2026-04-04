use crate::launcher::download::get_game_dir;
use reqwest::Client;
use std::path::Path;
use tauri::{AppHandle, Emitter};

const FABRIC_META: &str = "https://meta.fabricmc.net/v2/versions/loader";

pub async fn install_fabric(
    app: &AppHandle,
    mc_version: &str,
    loader_version: &str,
) -> Result<(), String> {
    let game_dir = get_game_dir(app);
    let client = Client::new();

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": format!("Installation de Fabric {loader_version}…"),
            "current": 0, "total": 3, "percent": 0
        }),
    );

    let profile_url = format!("{FABRIC_META}/{mc_version}/{loader_version}/profile/json");

    let profile_text = client
        .get(&profile_url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Fabric : {e}"))?
        .text()
        .await
        .map_err(|e| format!("Lecture profil Fabric : {e}"))?;

    let profile: serde_json::Value =
        serde_json::from_str(&profile_text).map_err(|e| format!("Profil Fabric invalide : {e}"))?;

    let fabric_version_id = profile["id"]
        .as_str()
        .ok_or("ID version Fabric manquant")?
        .to_string();

    let version_dir = game_dir.join("versions").join(&fabric_version_id);
    tokio::fs::create_dir_all(&version_dir)
        .await
        .map_err(|e| format!("Création dossier Fabric : {e}"))?;

    let profile_path = version_dir.join(format!("{fabric_version_id}.json"));
    tokio::fs::write(&profile_path, &profile_text)
        .await
        .map_err(|e| format!("Écriture profil Fabric : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Téléchargement des librairies Fabric…",
            "current": 1, "total": 3, "percent": 40
        }),
    );

    download_fabric_libraries(&client, &profile, &game_dir).await?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Fabric installé !",
            "current": 3, "total": 3, "percent": 100
        }),
    );

    Ok(())
}

pub async fn get_fabric_version_id(
    mc_version: &str,
    loader_version: &str,
) -> Result<String, String> {
    let url = format!("{FABRIC_META}/{loader_version}/{mc_version}/profile/json");
    let client = Client::new();

    let text = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erreur Fabric : {e}"))?
        .text()
        .await
        .map_err(|e| format!("Lecture Fabric : {e}"))?;

    let profile: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Profil Fabric invalide : {e}"))?;

    profile["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("ID Fabric manquant".to_string())
}

pub fn is_fabric_installed(game_dir: &Path, mc_version: &str, loader_version: &str) -> bool {
    let pattern = format!("fabric-loader-{loader_version}-{mc_version}");
    let version_dir = game_dir.join("versions").join(&pattern);

    if !version_dir.join(format!("{pattern}.json")).exists() {
        return false;
    }

    let fabric_jar = game_dir.join("libraries").join(format!(
        "net/fabricmc/fabric-loader/{loader_version}/fabric-loader-{loader_version}.jar"
    ));
    fabric_jar.exists()
}

async fn download_fabric_libraries(
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
            .unwrap_or("https://repo1.maven.org/maven2/");

        if let Some(path) = maven_name_to_path(name) {
            let dest = libs_dir.join(&path);

            if dest.exists() {
                continue;
            }

            let download_url = format!("{url}{path}");

            if let Some(parent) = dest.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Création dossier lib : {e}"))?;
            }

            let bytes = client
                .get(&download_url)
                .send()
                .await
                .map_err(|e| format!("Téléchargement lib Fabric ({name}) : {e}"))?
                .bytes()
                .await
                .map_err(|e| format!("Lecture lib : {e}"))?;

            tokio::fs::write(&dest, &bytes)
                .await
                .map_err(|e| format!("Écriture lib : {e}"))?;
        }
    }

    Ok(())
}

pub fn maven_name_to_path(name: &str) -> Option<String> {
    let parts: Vec<&str> = name.splitn(3, ':').collect();
    if parts.len() < 3 {
        return None;
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    Some(format!(
        "{group}/{artifact}/{version}/{artifact}-{version}.jar"
    ))
}
