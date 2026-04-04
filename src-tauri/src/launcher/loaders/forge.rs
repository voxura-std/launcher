use crate::launcher::download::get_game_dir;
use crate::launcher::java::find_java;
use reqwest::Client;
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Emitter};

const FORGE_MAVEN: &str = "https://maven.minecraftforge.net/net/minecraftforge/forge";

pub async fn install_forge(
    app: &AppHandle,
    mc_version: &str,
    loader_version: &str,
) -> Result<(), String> {
    let game_dir = get_game_dir(app);
    let client = Client::new();

    let full_version = maven_full_version(mc_version, loader_version);

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": format!("Téléchargement de l'installateur Forge {full_version}…"),
            "current": 0, "total": 5, "percent": 0
        }),
    );

    let installer_url = format!("{FORGE_MAVEN}/{full_version}/forge-{full_version}-installer.jar");

    let resp = client
        .get(&installer_url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Forge : {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Installateur Forge introuvable (HTTP {}). \
             Vérifie que la version {full_version} existe sur le Maven Forge.",
            resp.status().as_u16()
        ));
    }

    let installer_bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Lecture installateur Forge : {e}"))?;

    let temp_dir = game_dir.join("temp");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Création dossier temp : {e}"))?;

    let installer_path = temp_dir.join(format!("forge-{full_version}-installer.jar"));
    tokio::fs::write(&installer_path, &installer_bytes)
        .await
        .map_err(|e| format!("Écriture installateur Forge : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Extraction du profil Forge depuis le JAR…",
            "current": 1, "total": 5, "percent": 20
        }),
    );

    let version_json = extract_from_jar(&installer_path, "version.json")?;
    let profile: serde_json::Value = serde_json::from_str(&version_json)
        .map_err(|e| format!("version.json Forge invalide : {e}"))?;

    let forge_version_id = profile["id"]
        .as_str()
        .ok_or("Champ 'id' manquant dans version.json du JAR Forge")?
        .to_string();

    let version_dir = game_dir.join("versions").join(&forge_version_id);
    tokio::fs::create_dir_all(&version_dir)
        .await
        .map_err(|e| format!("Création dossier version Forge : {e}"))?;
    tokio::fs::write(
        version_dir.join(format!("{forge_version_id}.json")),
        &version_json,
    )
    .await
    .map_err(|e| format!("Écriture version.json Forge : {e}"))?;

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Téléchargement des librairies Forge…",
            "current": 2, "total": 5, "percent": 40
        }),
    );

    download_forge_libraries(&client, &profile, &game_dir).await?;

    if let Ok(install_json) = extract_from_jar(&installer_path, "install_profile.json") {
        if let Ok(ip) = serde_json::from_str::<serde_json::Value>(&install_json) {
            let _ = download_forge_libraries(&client, &ip, &game_dir).await;
        }
    }

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Exécution de l'installateur Forge (peut prendre quelques minutes)…",
            "current": 3, "total": 5, "percent": 60
        }),
    );

    run_forge_installer(app, &installer_path, &game_dir).await?;

    let _ = tokio::fs::remove_file(&installer_path).await;

    let marker = version_dir.join(".voxura_installed");
    tokio::fs::write(&marker, b"ok").await.ok();

    let _ = app.emit(
        "launcher://progress",
        serde_json::json!({
            "step": "Forge installé !",
            "current": 5, "total": 5, "percent": 100
        }),
    );

    Ok(())
}

pub fn is_forge_installed(game_dir: &Path, mc_version: &str, loader_version: &str) -> bool {
    let version_id = forge_version_id_from_parts(mc_version, loader_version);
    if forge_json_or_marker_exists(game_dir, &version_id) {
        return true;
    }

    if let Some(found) = scan_forge_version_id(game_dir, mc_version) {
        return forge_json_or_marker_exists(game_dir, &found);
    }

    false
}

fn forge_json_or_marker_exists(game_dir: &Path, version_id: &str) -> bool {
    let dir = game_dir.join("versions").join(version_id);
    if dir.join(".voxura_installed").exists() {
        return true;
    }
    dir.join(format!("{version_id}.json")).exists()
}

pub fn get_forge_version_id(game_dir: &Path, mc_version: &str, loader_version: &str) -> String {
    let candidate = forge_version_id_from_parts(mc_version, loader_version);
    let json_path = game_dir
        .join("versions")
        .join(&candidate)
        .join(format!("{candidate}.json"));
    if json_path.exists() {
        return candidate;
    }

    if let Some(found) = scan_forge_version_id(game_dir, mc_version) {
        let found_json = game_dir
            .join("versions")
            .join(&found)
            .join(format!("{found}.json"));
        if found_json.exists() {
            return found;
        }
    }

    candidate
}

pub fn maven_full_version(mc_version: &str, loader_version: &str) -> String {
    let prefix = format!("{mc_version}-");
    if loader_version.starts_with(&prefix) {
        loader_version.to_string()
    } else {
        format!("{mc_version}-{loader_version}")
    }
}

fn forge_version_id_from_parts(mc_version: &str, loader_version: &str) -> String {
    let prefix = format!("{mc_version}-");
    let forge_only = if loader_version.starts_with(&prefix) {
        &loader_version[prefix.len()..]
    } else {
        loader_version
    };
    format!("{mc_version}-forge-{forge_only}")
}

fn scan_forge_version_id(game_dir: &Path, mc_version: &str) -> Option<String> {
    let versions_dir = game_dir.join("versions");
    let entries = std::fs::read_dir(versions_dir).ok()?;
    let prefix = format!("{mc_version}-forge-");

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) {
            return Some(name);
        }
    }
    None
}

fn extract_from_jar(jar_path: &Path, entry_name: &str) -> Result<String, String> {
    let file = std::fs::File::open(jar_path).map_err(|e| format!("Ouverture JAR : {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("JAR invalide (zip) : {e}"))?;
    let mut entry = archive
        .by_name(entry_name)
        .map_err(|_| format!("'{entry_name}' introuvable dans le JAR Forge"))?;
    let mut content = String::new();
    entry
        .read_to_string(&mut content)
        .map_err(|e| format!("Lecture '{entry_name}' : {e}"))?;
    Ok(content)
}

async fn run_forge_installer(
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
        .ok_or("Java 17+ requis pour installer Forge. Va dans les paramètres pour l'installer.")?;

    let output = tokio::process::Command::new(&java_path)
        .args([
            "-jar",
            &installer_path.to_string_lossy().to_string(),
            "--installClient",
            &game_dir.to_string_lossy().to_string(),
        ])
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer l'installateur Forge : {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        eprintln!("[Forge installer STDERR]\n{stderr}");
        eprintln!("[Forge installer STDOUT]\n{stdout}");
        return Err(format!(
            "L'installateur Forge a échoué (code {}).\n\
             Stderr: {}",
            output.status.code().unwrap_or(-1),
            &stderr.chars().take(300).collect::<String>()
        ));
    }
    Ok(())
}

async fn download_forge_libraries(
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
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Création dossier lib Forge : {e}"))?;
            }

            let bytes = client
                .get(url)
                .send()
                .await
                .map_err(|e| format!("Téléchargement lib Forge : {e}"))?
                .bytes()
                .await
                .map_err(|e| format!("Lecture lib Forge : {e}"))?;

            tokio::fs::write(&dest, &bytes)
                .await
                .map_err(|e| format!("Écriture lib Forge : {e}"))?;
        }
    }

    Ok(())
}
