use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::launcher::download::get_game_dir;
use crate::InstancesState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonFile {
    pub filename: String,
    pub disabled: bool,
    pub size: u64,
    pub hash: String,
}

fn get_addon_dir(
    app: &AppHandle,
    instance_id: &str,
    addon_type: &str,
    state: &State<'_, InstancesState>,
) -> Result<PathBuf, String> {
    let instance = state
        .0
        .lock()
        .unwrap()
        .iter()
        .find(|i| i.id == instance_id)
        .cloned()
        .ok_or_else(|| "Instance introuvable".to_string())?;

    let folder_name = match addon_type {
        "mods" => "mods",
        "resourcepacks" => "resourcepacks",
        "shaders" => "shaderpacks",
        _ => return Err("Type d'addon non supporté".to_string()),
    };

    let dir = get_game_dir(app)
        .join("instances")
        .join(&instance.folder_name)
        .join(folder_name);

    Ok(dir)
}

#[tauri::command]
pub async fn get_installed_addons(
    instance_id: String,
    addon_type: String,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<Vec<AddonFile>, String> {
    let dir = get_addon_dir(&app, &instance_id, &addon_type, &state)?;

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut addons = Vec::new();
    let mut entries = fs::read_dir(&dir)
        .await
        .map_err(|e| format!("Erreur lecture dossier: {}", e))?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if path.is_file() {
            let filename = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let disabled = filename.ends_with(".disabled");

            let is_valid = filename.ends_with(".jar")
                || filename.ends_with(".jar.disabled")
                || filename.ends_with(".zip")
                || filename.ends_with(".zip.disabled");

            if !is_valid {
                continue;
            }

            let meta = entry.metadata().await.map_err(|e| e.to_string())?;

            let hash = if let Ok(bytes) = fs::read(&path).await {
                let mut hasher = Sha1::new();
                hasher.update(&bytes);
                hex::encode(hasher.finalize())
            } else {
                String::new()
            };

            addons.push(AddonFile {
                filename,
                disabled,
                size: meta.len(),
                hash,
            });
        }
    }

    Ok(addons)
}

#[tauri::command]
pub async fn toggle_addon(
    instance_id: String,
    addon_type: String,
    filename: String,
    enable: bool,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let dir = get_addon_dir(&app, &instance_id, &addon_type, &state)?;
    let file_path = dir.join(&filename);

    if !file_path.exists() {
        return Err("Fichier introuvable".to_string());
    }

    let is_disabled = filename.ends_with(".disabled");

    if enable && is_disabled {
        let new_name = filename.trim_end_matches(".disabled");
        fs::rename(&file_path, dir.join(new_name))
            .await
            .map_err(|e| e.to_string())?;
    } else if !enable && !is_disabled {
        let new_name = format!("{}.disabled", filename);
        fs::rename(&file_path, dir.join(new_name))
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_addon(
    instance_id: String,
    addon_type: String,
    filename: String,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let dir = get_addon_dir(&app, &instance_id, &addon_type, &state)?;
    let file_path = dir.join(&filename);

    if file_path.exists() {
        fs::remove_file(&file_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn download_addon(
    instance_id: String,
    addon_type: String,
    url: String,
    filename: String,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let dir = get_addon_dir(&app, &instance_id, &addon_type, &state)?;

    if !dir.exists() {
        fs::create_dir_all(&dir)
            .await
            .map_err(|e| format!("Impossible de créer le dossier: {}", e))?;
    }

    let file_path = dir.join(&filename);

    let client = reqwest::Client::new();
    let mut response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Erreur HTTP: {}", response.status()));
    }

    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}
