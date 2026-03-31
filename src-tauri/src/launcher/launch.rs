use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use super::download::get_game_dir;
use super::java::{find_java, install_java};
use super::types::VersionManifest;
use crate::instances::types::Instance;
use crate::auth::types::Account;

pub type RunningProcesses = Arc<Mutex<HashMap<String, u32>>>;

pub async fn launch_instance(
    app: &AppHandle,
    instance: &Instance,
    account: &Account,
    running: &RunningProcesses,
) -> Result<(), String> {
    let game_dir   = get_game_dir(app);
    let version_id = &instance.mc_version;

    let manifest_path = game_dir
        .join("versions").join(version_id)
        .join(format!("{version_id}.json"));

    let manifest_text = tokio::fs::read_to_string(&manifest_path).await
        .map_err(|_| format!(
            "Version {version_id} non installée. Lance l'installation d'abord."
        ))?;

    let manifest: VersionManifest = serde_json::from_str(&manifest_text)
        .map_err(|e| format!("Manifest corrompu : {e}"))?;

    let required_java = manifest.java_version
        .as_ref().map(|j| j.major_version).unwrap_or(17);

    let java_path = match find_java(required_java) {
        Some((path, _)) => path,
        None => {
            let _ = app.emit("launcher://status", serde_json::json!({
                "instance_id": instance.id,
                "status": "installing_java",
                "message": format!("Java {required_java} non trouvé — installation automatique…")
            }));
            install_java(app, required_java).await?
        }
    };

    let classpath = build_classpath(&game_dir, version_id, &manifest)?;

    let instance_dir = game_dir.join("instances").join(&instance.folder_name);
    tokio::fs::create_dir_all(&instance_dir).await
        .map_err(|e| format!("Création dossier instance : {e}"))?;

    let natives_dir = game_dir.join("versions").join(version_id).join("natives");
    tokio::fs::create_dir_all(&natives_dir).await.ok();

    let ram = instance.ram_mb;
    let mut args: Vec<String> = vec![
        format!("-Xmx{ram}m"),
        format!("-Xms{}m", (ram / 2).max(512)),
        format!("-Djava.library.path={}", natives_dir.display()),
        "-XX:+UseG1GC".to_string(),
        "-XX:+ParallelRefProcEnabled".to_string(),
        "-XX:MaxGCPauseMillis=200".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+DisableExplicitGC".to_string(),
        "-XX:G1HeapRegionSize=8M".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:InitiatingHeapOccupancyPercent=15".to_string(),
        "-XX:G1MixedGCLiveThresholdPercent=90".to_string(),
    ];

    if let Some(custom) = &instance.java_args {
        args.extend(custom.split_whitespace().map(|s| s.to_string()));
    }

    args.push("-cp".to_string());
    args.push(classpath);
    args.push(manifest.main_class.clone());
    args.extend(build_game_args(&manifest, account, version_id, &instance_dir, &game_dir));

    let mut cmd = tokio::process::Command::new(&java_path);
    cmd.args(&args)
       .current_dir(&instance_dir)
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("Impossible de lancer Java : {e}"))?;

    let pid = child.id().unwrap_or(0);
    let instance_id = instance.id.clone();

    running.lock().unwrap().insert(instance_id.clone(), pid);

    let _ = app.emit("launcher://game-started", serde_json::json!({
        "instance_id": instance_id,
        "pid": pid,
    }));

    let app_clone    = app.clone();
    let running_clone = running.clone();
    let id_clone     = instance_id.clone();

    tokio::spawn(async move {
        match child.wait_with_output().await {
            Ok(output) => {
                running_clone.lock().unwrap().remove(&id_clone);
                let _ = app_clone.emit("launcher://game-stopped", serde_json::json!({
                    "instance_id": id_clone,
                    "exit_code": output.status.code(),
                }));
            }
            Err(e) => {
                running_clone.lock().unwrap().remove(&id_clone);
                let _ = app_clone.emit("launcher://game-error", serde_json::json!({
                    "instance_id": id_clone,
                    "error": e.to_string(),
                }));
            }
        }
    });

    Ok(())
}

pub fn kill_instance(
    instance_id: &str,
    running: &RunningProcesses,
) -> Result<(), String> {
    let pid = {
        let map = running.lock().unwrap();
        *map.get(instance_id).ok_or("Instance non lancée")?
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status()
            .map_err(|e| format!("Impossible de tuer le processus : {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status()
            .map_err(|e| format!("Impossible de tuer le processus : {e}"))?;
    }

    running.lock().unwrap().remove(instance_id);
    Ok(())
}


fn build_classpath(
    game_dir: &Path,
    version_id: &str,
    manifest: &VersionManifest,
) -> Result<String, String> {
    let libs_dir   = game_dir.join("libraries");
    let sep        = if cfg!(windows) { ";" } else { ":" };
    let current_os = if cfg!(windows) { "windows" }
                     else if cfg!(target_os = "macos") { "osx" }
                     else { "linux" };

    let mut paths = Vec::new();

    for lib in &manifest.libraries {
        if let Some(rules) = &lib.rules {
            let allowed = rules.iter().any(|r| {
                let os_ok = r.os.as_ref()
                    .and_then(|o| o.name.as_ref())
                    .map(|n| n == current_os)
                    .unwrap_or(true);
                os_ok && r.action == "allow"
            });
            if !allowed { continue; }
        }

        if let Some(dl) = &lib.downloads {
            if let Some(artifact) = &dl.artifact {
                let p = libs_dir.join(&artifact.path);
                if p.exists() { paths.push(p.to_string_lossy().to_string()); }
            }
        }
    }

    let client_jar = game_dir
        .join("versions").join(version_id)
        .join(format!("{version_id}.jar"));
    if client_jar.exists() {
        paths.push(client_jar.to_string_lossy().to_string());
    }

    Ok(paths.join(sep))
}

fn build_game_args(
    manifest: &VersionManifest,
    account: &Account,
    version_id: &str,
    instance_dir: &Path,
    game_dir: &Path,
) -> Vec<String> {
    let assets_dir  = game_dir.join("assets");
    let asset_index = &manifest.asset_index.id;

    let replace = |s: &str| -> String {
        s.replace("${auth_player_name}",  &account.username)
         .replace("${version_name}",      version_id)
         .replace("${game_directory}",    &instance_dir.to_string_lossy())
         .replace("${assets_root}",       &assets_dir.to_string_lossy())
         .replace("${assets_index_name}", asset_index)
         .replace("${auth_uuid}",         &account.id)
         .replace("${auth_access_token}", "offline")
         .replace("${user_type}",         "msa")
         .replace("${version_type}",      "release")
         .replace("${user_properties}",   "{}")
    };

    let mut args = Vec::new();

    if let Some(arguments) = &manifest.arguments {
        if let Some(game) = &arguments.game {
            for a in game {
                if let Some(s) = a.as_str() { args.push(replace(s)); }
            }
        }
    } else if let Some(mc_args) = &manifest.minecraft_arguments {
        for part in mc_args.split_whitespace() { args.push(replace(part)); }
    }

    args
}