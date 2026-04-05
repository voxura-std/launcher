use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter};
use std::env;
use tokio::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct UpdateCheck {
    status: String,
    version: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Asset {
    name: String,
    browser_download_url: String,
}

#[derive(Deserialize, Debug)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

static GLOBAL_UPDATE_URL: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

#[tauri::command]
pub async fn check_updates(app: AppHandle) -> Result<UpdateCheck, String> {
    let client = reqwest::Client::builder()
        .user_agent("VoxuraLauncher Updater")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://codeberg.org/api/v1/repos/Voxura/voxura-launcher/releases/latest")
        .send()
        .await;

    let res = match res {
        Ok(r) => r,
        Err(_) => return Ok(UpdateCheck { status: "offline".into(), version: None }),
    };

    if !res.status().is_success() {
        return Ok(UpdateCheck { status: "offline".into(), version: None });
    }

    let release: Release = res.json().await.map_err(|e| e.to_string())?;
    
    // Compare versions (very simple string comparison or leave it for later)
    let current_version = app.package_info().version.to_string();
    let release_version = release.tag_name.trim_start_matches('v').to_string();

    if release_version == current_version {
        return Ok(UpdateCheck { status: "up_to_date".into(), version: Some(release_version) });
    }

    // Determine platform asset
    let target_ext = if cfg!(windows) {
        ".exe"
    } else if cfg!(target_os = "macos") {
        ".dmg"
    } else {
        ".AppImage"
    };

    // Or MSI, etc. We just find the first that matches the OS extension
    let asset = release.assets.into_iter().find(|a| a.name.ends_with(target_ext));

    if let Some(asset) = asset {
        *GLOBAL_UPDATE_URL.lock().unwrap() = Some(asset.browser_download_url);
        Ok(UpdateCheck { status: "update_available".into(), version: Some(release_version) })
    } else {
        Ok(UpdateCheck { status: "up_to_date".into(), version: Some(release_version) })
    }
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    let download_url = {
        GLOBAL_UPDATE_URL.lock().unwrap().clone().ok_or("Aucune mise à jour URL trouvée")?
    };

    let temp_dir = env::temp_dir();
    
    // We assume the filename based on URL or just a generic name
    let ext = if cfg!(windows) { ".exe" } else if cfg!(target_os = "macos") { ".dmg" } else { ".AppImage" };
    let temp_file = temp_dir.join(format!("voxura_update{}", ext));

    let client = reqwest::Client::new();
    let mut response = client.get(&download_url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("Erreur lors du téléchargement".into());
    }

    use tokio::io::AsyncWriteExt;
    let mut file = fs::File::create(&temp_file).await.map_err(|e| e.to_string())?;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    // Now execute it
    if cfg!(windows) {
        std::process::Command::new(&temp_file)
            .spawn()
            .map_err(|e| format!("Impossible de démarrer l'installeur : {e}"))?;
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(&temp_file)
            .spawn()
            .map_err(|e| format!("Impossible de démarrer l'installeur : {e}"))?;
    } else {
        // Linux AppImage usually needs chmod +x
        let _ = std::process::Command::new("chmod")
            .args(["+x", temp_file.to_str().unwrap()])
            .output();

        std::process::Command::new(&temp_file)
            .spawn()
            .map_err(|e| format!("Impossible de démarrer l'installeur : {e}"))?;
    }

    // Terminate current launcher
    std::process::exit(0);
}

#[tauri::command]
pub fn show_main_window(offline: bool, app: AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        // Emit offline event
        let _ = main.emit("launcher://offline-status", offline);
    }
}
