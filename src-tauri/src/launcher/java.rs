use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct JavaInfo {
    pub path: String,
    pub version: u32,
    pub found: bool,
}

pub fn find_java(required_version: u32) -> Option<(PathBuf, u32)> {
    let candidates = get_java_candidates();

    let mut best: Option<(PathBuf, u32)> = None;

    for path in &candidates {
        if let Some(version) = get_java_version(path) {
            if version >= required_version {
                if best.is_none() || version < best.as_ref().unwrap().1 {
                    best = Some((path.clone(), version));
                }
            }
        }
    }

    best
}

pub fn get_java_info(required_version: u32) -> JavaInfo {
    match find_java(required_version) {
        Some((path, version)) => JavaInfo {
            path: path.to_string_lossy().to_string(),
            version,
            found: true,
        },
        None => JavaInfo {
            path: String::new(),
            version: 0,
            found: false,
        },
    }
}

fn get_java_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![];

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let bin = java_bin_path(&PathBuf::from(java_home));
        if bin.exists() {
            candidates.push(bin);
        }
    }

    if let Some(launcher_javas) = get_launcher_java_dir() {
        if let Ok(entries) = std::fs::read_dir(&launcher_javas) {
            for entry in entries.flatten() {
                let bin = java_bin_path(&entry.path());
                if bin.exists() {
                    candidates.push(bin);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let bases = [
            "C:\\Program Files\\Eclipse Adoptium",
            "C:\\Program Files\\Microsoft",
            "C:\\Program Files\\Java",
            "C:\\Program Files\\Eclipse Foundation",
            "C:\\Program Files (x86)\\Java",
        ];
        for base in &bases {
            if let Ok(entries) = std::fs::read_dir(base) {
                for entry in entries.flatten() {
                    let bin = entry.path().join("bin").join("java.exe");
                    if bin.exists() {
                        candidates.push(bin);
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let paths = [
            "/usr/bin/java",
            "/usr/local/bin/java",
            "/opt/homebrew/bin/java",
        ];
        for p in &paths {
            let pb = PathBuf::from(p);
            if pb.exists() {
                candidates.push(pb);
            }
        }
        if let Ok(entries) = std::fs::read_dir("/usr/lib/jvm") {
            for entry in entries.flatten() {
                let bin = entry.path().join("bin").join("java");
                if bin.exists() {
                    candidates.push(bin);
                }
            }
        }
    }

    candidates
}

fn java_bin_path(base: &Path) -> PathBuf {
    if cfg!(windows) {
        base.join("bin").join("java.exe")
    } else {
        base.join("bin").join("java")
    }
}

pub fn get_java_version(java_path: &Path) -> Option<u32> {
    let mut cmd = Command::new(java_path);
    cmd.arg("-version");
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    let output = cmd.output().ok()?;

    let text = String::from_utf8_lossy(&output.stderr);
    let line = text.lines().next()?;
    let version_str = line.split('"').nth(1)?;

    if version_str.starts_with("1.") {
        version_str.split('.').nth(1)?.parse().ok()
    } else {
        version_str.split('.').next()?.parse().ok()
    }
}

pub fn get_launcher_java_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").ok()?;
        Some(PathBuf::from(appdata).join("voxura-launcher").join("java"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(PathBuf::from(home).join("Library/Application Support/voxura-launcher/java"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(PathBuf::from(home).join(".local/share/voxura-launcher/java"))
    }
}

pub async fn install_java(_app: &AppHandle, major_version: u32) -> Result<PathBuf, String> {
    let java_dir =
        get_launcher_java_dir().ok_or("Impossible de déterminer le répertoire d'installation")?;

    let install_dir = java_dir.join(format!("jdk-{major_version}"));

    let bin = java_bin_path(&install_dir);
    if bin.exists() {
        if let Some(v) = get_java_version(&bin) {
            if v >= major_version {
                return Ok(bin);
            }
        }
    }

    tokio::fs::create_dir_all(&install_dir)
        .await
        .map_err(|e| format!("Impossible de créer le dossier Java : {e}"))?;

    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x64"
    };

    let image_type = "jre";

    let api_url = format!(
        "https://api.adoptium.net/v3/assets/latest/{major_version}/hotspot\
         ?architecture={arch}&image_type={image_type}&os={os}&vendor=eclipse"
    );

    let client = reqwest::Client::new();
    let meta: serde_json::Value = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("Erreur API Adoptium : {e}"))?
        .json()
        .await
        .map_err(|e| format!("Réponse Adoptium invalide : {e}"))?;

    let download_url = meta[0]["binary"]["package"]["link"]
        .as_str()
        .ok_or("URL de téléchargement introuvable dans la réponse Adoptium")?
        .to_string();

    let filename = meta[0]["binary"]["package"]["name"]
        .as_str()
        .unwrap_or("java.archive")
        .to_string();

    let bytes = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Erreur téléchargement Java : {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Lecture archive Java : {e}"))?;

    let archive_path = install_dir.join(&filename);
    tokio::fs::write(&archive_path, &bytes)
        .await
        .map_err(|e| format!("Écriture archive : {e}"))?;

    extract_java_archive(&archive_path, &install_dir)?;

    let _ = tokio::fs::remove_file(&archive_path).await;

    let java_bin =
        find_java_binary_in_dir(&install_dir).ok_or("Binaire java introuvable après extraction")?;

    Ok(java_bin)
}

fn extract_java_archive(archive: &Path, dest: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let file = std::fs::File::open(archive).map_err(|e| format!("Ouverture archive : {e}"))?;
        let mut zip =
            zip::ZipArchive::new(file).map_err(|e| format!("Archive ZIP invalide : {e}"))?;
        zip.extract(dest)
            .map_err(|e| format!("Extraction ZIP : {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("tar")
            .args([
                "-xzf",
                &archive.to_string_lossy(),
                "-C",
                &dest.to_string_lossy(),
            ])
            .status()
            .map_err(|e| format!("Extraction tar : {e}"))?;

        if !status.success() {
            return Err("Extraction tar échouée".to_string());
        }

        if let Some(bin) = find_java_binary_in_dir(dest) {
            let _ = Command::new("chmod")
                .args(["+x", &bin.to_string_lossy()])
                .status();
        }
    }

    Ok(())
}

fn find_java_binary_in_dir(dir: &Path) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_type().ok()?.is_dir() {
                let candidate = java_bin_path(&entry.path());
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}
