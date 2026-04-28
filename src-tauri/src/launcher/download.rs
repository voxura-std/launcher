use reqwest::Client;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

use super::types::*;

pub fn get_game_dir(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join("game")
}

pub async fn install_version(app: &AppHandle, version_id: &str) -> Result<InstallResult, String> {
    let client = Client::new();
    let game_dir = get_game_dir(app);

    tokio::fs::create_dir_all(&game_dir)
        .await
        .map_err(|e| format!("Impossible de créer le répertoire de jeu : {e}"))?;

    emit_progress(app, "Récupération du manifest de version…", 0, 1, 0.0);

    let version_url = get_version_url(&client, version_id).await?;

    let manifest_path = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{version_id}.json"));

    let manifest_text = download_text(&client, &version_url).await?;
    write_file(&manifest_path, manifest_text.as_bytes()).await?;

    let manifest: VersionManifest = serde_json::from_str(&manifest_text)
        .map_err(|e| format!("Manifest de version invalide : {e}"))?;

    emit_progress(app, "Téléchargement du client Minecraft…", 0, 1, 5.0);
    download_client(&client, &manifest, version_id, &game_dir).await?;

    emit_progress(app, "Téléchargement des librairies…", 0, 1, 20.0);
    download_libraries(&client, app, &manifest, &game_dir).await?;

    emit_progress(app, "Téléchargement des assets…", 0, 1, 60.0);
    download_assets(&client, app, &manifest, &game_dir).await?;

    emit_progress(app, "Installation terminée !", 1, 1, 100.0);

    Ok(InstallResult {
        success: true,
        version_id: version_id.to_string(),
        game_dir: game_dir.to_string_lossy().to_string(),
    })
}

pub fn is_version_installed(app: &AppHandle, version_id: &str) -> bool {
    let game_dir = get_game_dir(app);

    let jar = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{version_id}.jar"));

    let manifest = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{version_id}.json"));

    jar.exists() && manifest.exists()
}

async fn get_version_url(client: &Client, version_id: &str) -> Result<String, String> {
    let text = download_text(
        client,
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    )
    .await?;

    let manifest: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Manifest global invalide : {e}"))?;

    manifest["versions"]
        .as_array()
        .ok_or("Format manifest invalide")?
        .iter()
        .find(|v| v["id"].as_str() == Some(version_id))
        .and_then(|v| v["url"].as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Version {version_id} introuvable dans le manifest"))
}

async fn download_client(
    client: &Client,
    manifest: &VersionManifest,
    version_id: &str,
    game_dir: &Path,
) -> Result<(), String> {
    let jar_path = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{version_id}.jar"));

    let client_download = manifest
        .downloads
        .as_ref()
        .ok_or("Champ 'downloads' absent du manifest de version")?;

    if file_exists_and_valid(&jar_path, &client_download.client.sha1).await {
        return Ok(());
    }

    download_file(client, &client_download.client.url, &jar_path).await
}

async fn download_libraries(
    client: &Client,
    app: &AppHandle,
    manifest: &VersionManifest,
    game_dir: &Path,
) -> Result<(), String> {
    let libs_dir = game_dir.join("libraries");
    let current_os = get_current_os();

    let compatible_libs: Vec<&Library> = manifest
        .libraries
        .iter()
        .filter(|lib| is_library_compatible(lib, &current_os))
        .collect();

    let total = compatible_libs.len() as u64;

    for (i, lib) in compatible_libs.iter().enumerate() {
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let lib_path = libs_dir.join(&artifact.path);

                if !file_exists_and_valid(&lib_path, &artifact.sha1).await {
                    download_file(client, &artifact.url, &lib_path).await?;
                }

                emit_progress(
                    app,
                    &format!("Librairies ({}/{total})", i + 1),
                    i as u64 + 1,
                    total,
                    20.0 + (i as f64 / total as f64) * 40.0,
                );
            }
        }
    }

    Ok(())
}

async fn download_assets(
    client: &Client,
    app: &AppHandle,
    manifest: &VersionManifest,
    game_dir: &Path,
) -> Result<(), String> {
    let assets_dir = game_dir.join("assets");
    let indexes_dir = assets_dir.join("indexes");
    let objects_dir = assets_dir.join("objects");

    let asset_index = manifest
        .asset_index
        .as_ref()
        .ok_or("Champ 'assetIndex' absent du manifest de version")?;

    let index_path = indexes_dir.join(format!("{}.json", asset_index.id));
    if !index_path.exists() {
        let index_text = download_text(client, &asset_index.url).await?;
        write_file(&index_path, index_text.as_bytes()).await?;
    }

    let index_text = tokio::fs::read_to_string(&index_path)
        .await
        .map_err(|e| format!("Lecture index assets : {e}"))?;

    let asset_index: AssetIndexFile =
        serde_json::from_str(&index_text).map_err(|e| format!("Index assets invalide : {e}"))?;

    let total = asset_index.objects.len() as u64;
    let mut downloaded = 0u64;

    for (_name, asset) in &asset_index.objects {
        let hash_prefix = &asset.hash[..2];
        let asset_path = objects_dir.join(hash_prefix).join(&asset.hash);

        if !file_exists_and_valid(&asset_path, &asset.hash).await {
            let url = format!(
                "https://resources.download.minecraft.net/{hash_prefix}/{}",
                asset.hash
            );
            download_file(client, &url, &asset_path).await?;
        }

        downloaded += 1;

        if downloaded % 50 == 0 || downloaded == total {
            emit_progress(
                app,
                &format!("Assets ({downloaded}/{total})"),
                downloaded,
                total,
                60.0 + (downloaded as f64 / total as f64) * 39.0,
            );
        }
    }

    Ok(())
}

fn emit_progress(app: &AppHandle, step: &str, current: u64, total: u64, percent: f64) {
    let _ = app.emit(
        "launcher://progress",
        DownloadProgress {
            step: step.to_string(),
            current,
            total,
            percent,
        },
    );
}

async fn download_text(client: &Client, url: &str) -> Result<String, String> {
    client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau ({url}) : {e}"))?
        .text()
        .await
        .map_err(|e| format!("Lecture réponse : {e}"))
}

pub async fn download_file(client: &Client, url: &str, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Création dossier : {e}"))?;
    }

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Téléchargement ({url}) : {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Lecture bytes : {e}"))?;

    let mut file = tokio::fs::File::create(path)
        .await
        .map_err(|e| format!("Création fichier : {e}"))?;

    file.write_all(&bytes)
        .await
        .map_err(|e| format!("Écriture fichier : {e}"))
}

async fn write_file(path: &Path, data: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Création dossier : {e}"))?;
    }
    tokio::fs::write(path, data)
        .await
        .map_err(|e| format!("Écriture : {e}"))
}

async fn file_exists_and_valid(path: &Path, expected_sha1: &str) -> bool {
    if !path.exists() {
        return false;
    }

    if let Ok(bytes) = tokio::fs::read(path).await {
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let hash = format!("{:x}", hasher.finalize());
        return hash == expected_sha1;
    }

    false
}

fn is_library_compatible(lib: &Library, current_os: &str) -> bool {
    let Some(rules) = &lib.rules else { return true };

    let mut allowed = false;

    for rule in rules {
        let os_matches = rule
            .os
            .as_ref()
            .and_then(|o| o.name.as_ref())
            .map(|name| name == current_os)
            .unwrap_or(true);

        if os_matches {
            allowed = rule.action == "allow";
        }
    }

    allowed
}

fn get_current_os() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "osx".to_string()
    } else {
        "linux".to_string()
    }
}

pub async fn cleanup_unused_assets(
    app: &AppHandle,
    remaining_instances: &[crate::instances::types::Instance],
) -> Result<(), String> {
    let game_dir = get_game_dir(app);

    let mut used_versions: std::collections::HashSet<String> = std::collections::HashSet::new();

    for inst in remaining_instances {
        used_versions.insert(inst.mc_version.clone());

        if let Some(lv) = &inst.loader_version {
            let loader_id = match &inst.loader {
                crate::instances::types::Loader::Fabric => {
                    Some(format!("fabric-loader-{lv}-{}", inst.mc_version))
                }
                crate::instances::types::Loader::NeoForge => Some(format!("neoforge-{lv}")),
                crate::instances::types::Loader::Forge => {
                    Some(format!("forge-{}-{lv}", inst.mc_version))
                }
                crate::instances::types::Loader::Quilt => {
                    Some(format!("quilt-loader-{lv}-{}", inst.mc_version))
                }
                _ => None,
            };
            if let Some(id) = loader_id {
                used_versions.insert(id);
            }
        }
    }

    let mut needed_indexes: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut needed_hashes: std::collections::HashSet<String> = std::collections::HashSet::new();

    for version_id in &used_versions {
        let manifest_path = game_dir
            .join("versions")
            .join(version_id)
            .join(format!("{version_id}.json"));

        if let Ok(text) = tokio::fs::read_to_string(&manifest_path).await {
            if let Ok(manifest) = serde_json::from_str::<VersionManifest>(&text) {
                if let Some(ai) = &manifest.asset_index {
                    needed_indexes.insert(ai.id.clone());

                    let index_path = game_dir
                        .join("assets")
                        .join("indexes")
                        .join(format!("{}.json", ai.id));

                    if let Ok(index_text) = tokio::fs::read_to_string(&index_path).await {
                        if let Ok(index) = serde_json::from_str::<AssetIndexFile>(&index_text) {
                            for asset in index.objects.values() {
                                needed_hashes.insert(asset.hash.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    let versions_dir = game_dir.join("versions");
    if versions_dir.exists() {
        if let Ok(mut entries) = tokio::fs::read_dir(&versions_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let name = entry.file_name().to_string_lossy().to_string();
                if !used_versions.contains(&name) {
                    let _ = tokio::fs::remove_dir_all(entry.path()).await;
                }
            }
        }
    }

    let indexes_dir = game_dir.join("assets").join("indexes");
    if indexes_dir.exists() {
        if let Ok(mut entries) = tokio::fs::read_dir(&indexes_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let filename = entry.file_name().to_string_lossy().to_string();
                let index_id = filename.trim_end_matches(".json").to_string();
                if !needed_indexes.contains(&index_id) {
                    let _ = tokio::fs::remove_file(entry.path()).await;
                }
            }
        }
    }

    let objects_dir = game_dir.join("assets").join("objects");
    if objects_dir.exists() {
        if let Ok(mut prefix_entries) = tokio::fs::read_dir(&objects_dir).await {
            while let Ok(Some(prefix_entry)) = prefix_entries.next_entry().await {
                if !prefix_entry
                    .file_type()
                    .await
                    .map(|t| t.is_dir())
                    .unwrap_or(false)
                {
                    continue;
                }
                if let Ok(mut hash_entries) = tokio::fs::read_dir(prefix_entry.path()).await {
                    while let Ok(Some(hash_entry)) = hash_entries.next_entry().await {
                        let hash = hash_entry.file_name().to_string_lossy().to_string();
                        if !needed_hashes.contains(&hash) {
                            let _ = tokio::fs::remove_file(hash_entry.path()).await;
                        }
                    }
                }
                let _ = tokio::fs::remove_dir(prefix_entry.path()).await;
            }
        }
    }

    Ok(())
}
