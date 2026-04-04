use super::fabric::maven_name_to_path;
use crate::launcher::download::get_game_dir;
use crate::launcher::java::find_java;
use reqwest::Client;
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Emitter};

const NEOFORGE_MAVEN: &str = "https://maven.neoforged.net/releases/net/neoforged/neoforge";

pub async fn install_neoforge(
    app: &AppHandle,
    _mc_version: &str,
    loader_version: &str,
) -> Result<(), String> {
    let game_dir = get_game_dir(app);
    let client = Client::new();

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": format!("Téléchargement de l'installateur NeoForge {loader_version}…"),
            "current": 0, "total": 4, "percent": 0
        }),
    );

    let installer_url =
        format!("{NEOFORGE_MAVEN}/{loader_version}/neoforge-{loader_version}-installer.jar");

    let resp = client
        .get(&installer_url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau NeoForge : {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Installateur NeoForge introuvable (HTTP {}). \
             Vérifie que la version {loader_version} existe.",
            resp.status().as_u16()
        ));
    }

    let installer_bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Lecture installateur NeoForge : {e}"))?;

    let temp_dir = game_dir.join("temp");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Création dossier temp : {e}"))?;

    let installer_path = temp_dir.join(format!("neoforge-{loader_version}-installer.jar"));
    tokio::fs::write(&installer_path, &installer_bytes)
        .await
        .map_err(|e| format!("Écriture installateur NeoForge : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Extraction du profil NeoForge depuis le JAR…",
            "current": 1, "total": 4, "percent": 25
        }),
    );

    let version_json = extract_from_jar(&installer_path, "version.json")?;
    let profile: serde_json::Value = serde_json::from_str(&version_json)
        .map_err(|e| format!("version.json NeoForge invalide : {e}"))?;

    let neoforge_version_id = profile["id"]
        .as_str()
        .ok_or("Champ 'id' manquant dans version.json du JAR NeoForge")?
        .to_string();

    let version_dir = game_dir.join("versions").join(&neoforge_version_id);
    tokio::fs::create_dir_all(&version_dir)
        .await
        .map_err(|e| format!("Création dossier version NeoForge : {e}"))?;
    tokio::fs::write(
        version_dir.join(format!("{neoforge_version_id}.json")),
        &version_json,
    )
    .await
    .map_err(|e| format!("Écriture version.json NeoForge : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Téléchargement des librairies NeoForge…",
            "current": 2, "total": 4, "percent": 50
        }),
    );

    download_neoforge_libraries(&client, &profile, &game_dir).await?;

    if let Ok(install_json) = extract_from_jar(&installer_path, "install_profile.json") {
        if let Ok(ip) = serde_json::from_str::<serde_json::Value>(&install_json) {
            let _ = download_neoforge_libraries(&client, &ip, &game_dir).await;
        }
    }

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Exécution de l'installateur NeoForge (peut prendre quelques minutes)…",
            "current": 3, "total": 4, "percent": 75
        }),
    );

    run_neoforge_installer(app, &installer_path, &game_dir).await?;

    let _ = tokio::fs::remove_file(&installer_path).await;

    let neoforge_version_id = get_neoforge_version_id(loader_version);
    let marker = game_dir
        .join("versions")
        .join(&neoforge_version_id)
        .join(".voxura_installed");
    tokio::fs::write(&marker, b"ok").await.ok();

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "NeoForge installé !",
            "current": 4, "total": 4, "percent": 100
        }),
    );

    Ok(())
}

pub fn is_neoforge_installed(game_dir: &Path, loader_version: &str) -> bool {
    let version_id = format!("neoforge-{loader_version}");
    let version_dir = game_dir.join("versions").join(&version_id);

    if !version_dir.join(format!("{version_id}.json")).exists() {
        return false;
    }

    if version_dir.join(".voxura_installed").exists() {
        return true;
    }

    if let Ok(content) = std::fs::read_to_string(version_dir.join(format!("{version_id}.json"))) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(libs) = json["libraries"].as_array() {
                for lib in libs {
                    if let Some(artifact) = lib["downloads"]["artifact"].as_object() {
                        if let Some(path) = artifact["path"].as_str() {
                            let jar = game_dir.join("libraries").join(path);
                            if jar.exists() {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }

    false
}

pub fn get_neoforge_version_id(loader_version: &str) -> String {
    format!("neoforge-{loader_version}")
}

fn extract_from_jar(jar_path: &Path, entry_name: &str) -> Result<String, String> {
    let file = std::fs::File::open(jar_path).map_err(|e| format!("Ouverture JAR : {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("JAR invalide (zip) : {e}"))?;
    let mut entry = archive
        .by_name(entry_name)
        .map_err(|_| format!("'{entry_name}' introuvable dans le JAR NeoForge"))?;
    let mut content = String::new();
    entry
        .read_to_string(&mut content)
        .map_err(|e| format!("Lecture '{entry_name}' : {e}"))?;
    Ok(content)
}

async fn run_neoforge_installer(
    _app: &AppHandle,
    installer_path: &Path,
    game_dir: &Path,
) -> Result<(), String> {
    let profiles_path = game_dir.join("launcher_profiles.json");
    let fake = serde_json::json!({
        "profiles": {
            "VoxuraLauncher": {
                "name": "VoxuraLauncher",
                "type": "custom",
                "lastVersionId": "release"
            }
        },
        "selectedProfile": "VoxuraLauncher",
        "clientToken": "00000000-0000-0000-0000-000000000000",
        "authenticationDatabase": {},
        "launcherVersion": { "name": "2.2.2476", "format": 21 }
    });
    tokio::fs::write(&profiles_path, fake.to_string())
        .await
        .map_err(|e| format!("Création launcher_profiles.json : {e}"))?;

    let java_path = find_java(21)
        .or_else(|| find_java(17))
        .map(|(p, _)| p)
        .ok_or("Java 17+ requis pour installer NeoForge.")?;

    let output = tokio::process::Command::new(&java_path)
        .args([
            "-jar",
            &installer_path.to_string_lossy().to_string(),
            "--installClient",
            &game_dir.to_string_lossy().to_string(),
        ])
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer l'installateur NeoForge : {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        eprintln!("[NeoForge installer STDERR]\n{stderr}");
        eprintln!("[NeoForge installer STDOUT]\n{stdout}");
        return Err(format!(
            "L'installateur NeoForge a échoué (code {}).\nConsulte les logs pour plus de détails.",
            output.status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}

async fn download_neoforge_libraries(
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
        if let Some(artifact) = lib["downloads"]["artifact"].as_object() {
            let url = artifact["url"].as_str().unwrap_or("");
            let path = artifact["path"].as_str().unwrap_or("");
            if url.is_empty() || path.is_empty() {
                continue;
            }

            let dest = libs_dir.join(path);
            if dest.exists() {
                continue;
            }

            if let Some(parent) = dest.parent() {
                tokio::fs::create_dir_all(parent).await.ok();
            }
            if let Ok(resp) = client.get(url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    tokio::fs::write(&dest, &bytes).await.ok();
                }
            }
        } else if let Some(name) = lib["name"].as_str() {
            let url = lib["url"]
                .as_str()
                .unwrap_or("https://maven.neoforged.net/releases/");
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
    }
    Ok(())
}
