use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use super::download::get_game_dir;
use super::java::find_java;
use super::types::{Arguments, VersionManifest};
use crate::auth::types::Account;
use crate::instances::types::Instance;

pub type RunningProcesses = Arc<Mutex<HashMap<String, u32>>>;

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct GameResolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct GlobalSettings {
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub launcher_behavior: String,
    pub game_resolution: Option<GameResolution>,
    pub ram_min: Option<u32>,
    pub ram_max: Option<u32>,
    pub custom_java_path: Option<String>,
}

pub async fn launch_instance(
    app: &AppHandle,
    instance: &Instance,
    account: &Account,
    mc_token: &str,
    running: &RunningProcesses,
) -> Result<(), String> {
    let game_dir = get_game_dir(app);
    let mc_version = &instance.mc_version;

    let version_id = get_version_id(instance, mc_version, &game_dir);
    let manifest = load_resolved_manifest(&game_dir, &version_id, mc_version).await?;

    let mut settings = GlobalSettings {
        theme: "dark".to_string(),
        launcher_behavior: "keep_open".to_string(),
        game_resolution: None,
        ram_min: Some(1024),
        ram_max: Some(4096),
        custom_java_path: None,
    };

    if let Ok(data_dir) = app.path().app_data_dir() {
        let settings_path = data_dir.join("settings.json");
        if let Ok(content) = std::fs::read_to_string(&settings_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(global) = parsed.get("global_settings") {
                    if let Ok(parsed_settings) =
                        serde_json::from_value::<GlobalSettings>(global.clone())
                    {
                        settings = parsed_settings;
                    }
                }
            }
        }
    }

    let required_java = manifest
        .java_version
        .as_ref()
        .map(|j| j.major_version)
        .unwrap_or(21);

    let java_path = if let Some(custom) = &settings.custom_java_path {
        PathBuf::from(custom.replace("\"", ""))
    } else if let Some((path, _)) = find_java(required_java) {
        path
    } else {
        super::java::install_java(app, required_java).await
            .map_err(|e| format!(
                "Java {required_java} est requis pour cette version de Minecraft mais l'installation automatique a échoué : {e}\n\
                 Installe Java {required_java} manuellement depuis adoptium.net puis relance."
            ))?
    };

    let instance_dir = game_dir.join("instances").join(&instance.folder_name);
    tokio::fs::create_dir_all(&instance_dir).await.ok();

    let natives_dir = game_dir.join("versions").join(&version_id).join("natives");
    tokio::fs::create_dir_all(&natives_dir).await.ok();

    let classpath = build_classpath(&game_dir, &version_id, &manifest)?;

    let ram = if instance.ram_mb >= 512 {
        instance.ram_mb as u32
    } else {
        settings.ram_max.unwrap_or(4096)
    };
    let ram_min = settings.ram_min.unwrap_or(1024).min(ram);
    let sep = if cfg!(windows) { ";" } else { ":" };

    let replacements: std::collections::HashMap<&str, String> = [
        (
            "${natives_directory}",
            natives_dir.to_string_lossy().to_string(),
        ),
        ("${launcher_name}", "VoxuraLauncher".to_string()),
        ("${launcher_version}", "1.1.5".to_string()),
        ("${classpath}", classpath.clone()),
        ("${classpath_separator}", sep.to_string()),
        (
            "${library_directory}",
            game_dir.join("libraries").to_string_lossy().to_string(),
        ),
        ("${version_name}", version_id.clone()),
        ("${java_net_preferIPv6Addresses}", "system".to_string()),
        ("${java_home}", java_path.to_string_lossy().to_string()),
        (
            "${resolution_width}",
            settings
                .game_resolution
                .as_ref()
                .map(|r| r.width.to_string())
                .unwrap_or("854".to_string()),
        ),
        (
            "${resolution_height}",
            settings
                .game_resolution
                .as_ref()
                .map(|r| r.height.to_string())
                .unwrap_or("480".to_string()),
        ),
    ]
    .into_iter()
    .collect();

    let mut args: Vec<String> = vec![
        "-XX:+IgnoreUnrecognizedVMOptions".to_string(),
        "-XX:+UseG1GC".to_string(),
        "-XX:+ParallelRefProcEnabled".to_string(),
        "-XX:MaxGCPauseMillis=200".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+DisableExplicitGC".to_string(),
        "-XX:G1HeapRegionSize=8M".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:InitiatingHeapOccupancyPercent=15".to_string(),
    ];

    let manifest_jvm_raw = extract_jvm_args(&manifest, &replacements);
    let manifest_jvm: Vec<String> = manifest_jvm_raw
        .into_iter()
        .filter(|a| !a.starts_with("-Xmx") && !a.starts_with("-Xms"))
        .collect();

    let has_cp_from_manifest = manifest_jvm
        .iter()
        .any(|a| a == "-cp" || a == "--class-path" || a == "-classpath");

    args.extend(manifest_jvm);

    if !has_cp_from_manifest {
        args.push(format!("-Djava.library.path={}", natives_dir.display()));
        args.push("-cp".to_string());
        args.push(classpath);
    }

    if let Some(custom) = &instance.java_args {
        args.extend(custom.split_whitespace().map(|s| s.to_string()));
    }

    args.push(format!("-Xmx{}m", ram));
    args.push(format!("-Xms{}m", ram_min));

    args.push(manifest.main_class.clone());

    let asset_index_id = manifest
        .asset_index
        .as_ref()
        .map(|a| a.id.clone())
        .unwrap_or_else(|| mc_version.clone());

    args.extend(build_game_args(
        &manifest,
        account,
        mc_token,
        &version_id,
        &asset_index_id,
        &instance_dir,
        &game_dir,
        &settings,
    ));

    args.push("--width".to_string());
    args.push(
        settings
            .game_resolution
            .as_ref()
            .map(|r| r.width.to_string())
            .unwrap_or("854".to_string()),
    );
    args.push("--height".to_string());
    args.push(
        settings
            .game_resolution
            .as_ref()
            .map(|r| r.height.to_string())
            .unwrap_or("480".to_string()),
    );

    let mut cmd = tokio::process::Command::new(&java_path);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.args(&args)
        .current_dir(&instance_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if settings.launcher_behavior == "close_game" {
        cmd.kill_on_drop(true);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Impossible de lancer Java : {e}"))?;

    let pid = child.id().unwrap_or(0);
    let instance_id = instance.id.clone();

    running.lock().unwrap().insert(instance_id.clone(), pid);

    let _ = app.emit(
        "launcher://game-started",
        serde_json::json!({
            "instance_id": instance_id,
            "pid": pid,
        }),
    );

    if settings.launcher_behavior == "close" {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    let app_clone = app.clone();
    let running_clone = running.clone();
    let id_clone = instance_id.clone();

    let start_time = std::time::Instant::now();

    let stdout = child.stdout.take().expect("Failed to open stdout");
    let stderr = child.stderr.take().expect("Failed to open stderr");

    let id_stdout = id_clone.clone();
    let app_stdout = app_clone.clone();
    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_stdout.emit(
                "launcher://game-log",
                serde_json::json!({
                    "instance_id": id_stdout,
                    "log_type": "stdout",
                    "line": line
                }),
            );
        }
    });

    let id_stderr = id_clone.clone();
    let app_stderr = app_clone.clone();
    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_stderr.emit(
                "launcher://game-log",
                serde_json::json!({
                    "instance_id": id_stderr,
                    "log_type": "stderr",
                    "line": line
                }),
            );
        }
    });

    let settings_clone = settings.clone();
    tokio::spawn(async move {
        match child.wait().await {
            Ok(status) => {
                running_clone.lock().unwrap().remove(&id_clone);
                let exit_code = status.code().unwrap_or(-1);

                let elapsed = start_time.elapsed().as_secs();
                let now = crate::instances::manager::unix_now();

                use tauri::Manager;
                use tauri_plugin_store::StoreExt;

                if let Err(e) = (|| -> Result<(), String> {
                    let store = app_clone
                        .store("instances.json")
                        .map_err(|e| e.to_string())?;
                    let state = app_clone.state::<crate::InstancesState>();
                    let mut list = state.0.lock().unwrap();
                    if let Some(inst) = list.iter_mut().find(|i| i.id == id_clone) {
                        inst.play_time += elapsed;
                        inst.last_played = Some(now);
                        store.set(format!("instance:{}", id_clone), serde_json::json!(inst));
                        store.save().map_err(|e| e.to_string())?;
                    }
                    Ok(())
                })() {
                    eprintln!("Erreur màj temps de jeu : {}", e);
                }

                if settings_clone.launcher_behavior == "close" {
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }

                let _ = app_clone.emit(
                    "launcher://game-stopped",
                    serde_json::json!({
                        "instance_id": id_clone,
                        "exit_code":   exit_code,
                    }),
                );
            }
            Err(e) => {
                running_clone.lock().unwrap().remove(&id_clone);

                if settings_clone.launcher_behavior == "close" {
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }

                let _ = app_clone.emit(
                    "launcher://game-error",
                    serde_json::json!({
                        "instance_id": id_clone,
                        "error":       e.to_string(),
                    }),
                );
            }
        }
    });

    Ok(())
}

pub fn kill_instance(instance_id: &str, running: &RunningProcesses) -> Result<(), String> {
    let pid = {
        let map = running.lock().unwrap();
        *map.get(instance_id).ok_or("Instance non lancée")?
    };

    #[cfg(target_os = "windows")]
    std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .status()
        .map_err(|e| format!("Kill échoué : {e}"))?;

    #[cfg(not(target_os = "windows"))]
    std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
        .map_err(|e| format!("Kill échoué : {e}"))?;

    running.lock().unwrap().remove(instance_id);
    Ok(())
}

fn get_version_id(instance: &Instance, mc_version: &str, game_dir: &PathBuf) -> String {
    match &instance.loader {
        crate::instances::types::Loader::Vanilla => mc_version.to_string(),

        crate::instances::types::Loader::Fabric => {
            if let Some(lv) = &instance.loader_version {
                format!("fabric-loader-{lv}-{mc_version}")
            } else {
                scan_installed_version_id(game_dir, "fabric-loader-", mc_version)
                    .unwrap_or_else(|| mc_version.to_string())
            }
        }

        crate::instances::types::Loader::NeoForge => {
            if let Some(lv) = &instance.loader_version {
                super::loaders::neoforge::get_neoforge_version_id(lv)
            } else {
                scan_installed_version_id(game_dir, "neoforge-", mc_version)
                    .unwrap_or_else(|| mc_version.to_string())
            }
        }

        crate::instances::types::Loader::Forge => {
            if let Some(lv) = &instance.loader_version {
                super::loaders::forge::get_forge_version_id(game_dir, mc_version, lv)
            } else {
                super::loaders::forge::get_forge_version_id(game_dir, mc_version, "")
            }
        }

        crate::instances::types::Loader::Quilt => {
            if let Some(lv) = &instance.loader_version {
                format!("quilt-loader-{lv}-{mc_version}")
            } else {
                scan_installed_version_id(game_dir, "quilt-loader-", mc_version)
                    .unwrap_or_else(|| mc_version.to_string())
            }
        }
    }
}

fn scan_installed_version_id(game_dir: &PathBuf, prefix: &str, mc_version: &str) -> Option<String> {
    let versions_dir = game_dir.join("versions");
    let entries = std::fs::read_dir(versions_dir).ok()?;
    let suffix = format!("-{mc_version}");

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(prefix) && name.ends_with(&suffix) {
            let json = game_dir
                .join("versions")
                .join(&name)
                .join(format!("{name}.json"));
            if json.exists() {
                return Some(name);
            }
        }
    }
    None
}

pub async fn load_resolved_manifest(
    game_dir: &PathBuf,
    version_id: &str,
    mc_version: &str,
) -> Result<VersionManifest, String> {
    let manifest_path = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{version_id}.json"));

    let text = tokio::fs::read_to_string(&manifest_path).await
        .map_err(|_| format!("Version {version_id} non installée. Lance d'abord Minecraft {mc_version} en vanilla pour télécharger les fichiers de base."))?;

    let mut manifest: VersionManifest =
        serde_json::from_str(&text).map_err(|e| format!("Manifest {version_id} invalide : {e}"))?;

    if let Some(ref parent_id) = manifest.inherits_from.clone() {
        let parent_path = game_dir
            .join("versions")
            .join(parent_id)
            .join(format!("{parent_id}.json"));

        if !parent_path.exists() {
            return Err(format!(
                "Version parente '{parent_id}' non installée. Lance d'abord une instance vanilla {mc_version} pour la télécharger."
            ));
        }

        let parent_text = tokio::fs::read_to_string(&parent_path)
            .await
            .map_err(|e| format!("Lecture manifest parent {parent_id} : {e}"))?;
        let parent: VersionManifest = serde_json::from_str(&parent_text)
            .map_err(|e| format!("Manifest parent {parent_id} invalide : {e}"))?;

        let mut merged_libs = parent.libraries.clone();
        merged_libs.extend(manifest.libraries.clone());
        manifest.libraries = merged_libs;

        let parent_jvm = parent
            .arguments
            .as_ref()
            .and_then(|a| a.jvm.clone())
            .unwrap_or_default();
        let child_jvm = manifest
            .arguments
            .as_ref()
            .and_then(|a| a.jvm.clone())
            .unwrap_or_default();
        let merged_jvm: Vec<serde_json::Value> = parent_jvm.into_iter().chain(child_jvm).collect();

        let parent_game = parent
            .arguments
            .as_ref()
            .and_then(|a| a.game.clone())
            .unwrap_or_default();
        let child_game = manifest
            .arguments
            .as_ref()
            .and_then(|a| a.game.clone())
            .unwrap_or_default();
        let merged_game: Vec<serde_json::Value> =
            parent_game.into_iter().chain(child_game).collect();

        manifest.arguments = Some(Arguments {
            jvm: if merged_jvm.is_empty() {
                None
            } else {
                Some(merged_jvm)
            },
            game: if merged_game.is_empty() {
                None
            } else {
                Some(merged_game)
            },
        });

        if manifest.minecraft_arguments.is_none() {
            manifest.minecraft_arguments = parent.minecraft_arguments;
        }

        if manifest.asset_index.is_none() {
            manifest.asset_index = parent.asset_index;
        }
        if manifest.java_version.is_none() {
            manifest.java_version = parent.java_version;
        }
    }

    Ok(manifest)
}

fn extract_jvm_args(
    manifest: &VersionManifest,
    replacements: &HashMap<&str, String>,
) -> Vec<String> {
    let current_os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let jvm_array = match manifest.arguments.as_ref().and_then(|a| a.jvm.as_ref()) {
        Some(arr) => arr,
        None => {
            return vec![format!(
                "-Djava.library.path={}",
                replacements
                    .get("${natives_directory}")
                    .map(|s| s.as_str())
                    .unwrap_or("")
            )]
        }
    };

    let mut result = Vec::new();

    for arg in jvm_array {
        if let Some(s) = arg.as_str() {
            result.push(apply_replacements(s, replacements));
        } else if let Some(obj) = arg.as_object() {
            if check_rules(obj.get("rules"), current_os) {
                let value = obj.get("value");
                match value {
                    Some(v) if v.is_string() => {
                        result.push(apply_replacements(v.as_str().unwrap(), replacements));
                    }
                    Some(v) if v.is_array() => {
                        for item in v.as_array().unwrap() {
                            if let Some(s) = item.as_str() {
                                result.push(apply_replacements(s, replacements));
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    result
}

fn check_rules(rules: Option<&serde_json::Value>, current_os: &str) -> bool {
    let rules = match rules {
        Some(r) => r,
        None => return true,
    };
    let arr = match rules.as_array() {
        Some(a) if !a.is_empty() => a,
        _ => return true,
    };

    let mut allowed = false;

    for rule in arr {
        let action = rule["action"].as_str().unwrap_or("allow");

        let os_ok = if let Some(os) = rule.get("os") {
            let name_ok = os
                .get("name")
                .and_then(|n| n.as_str())
                .map(|n| n == current_os)
                .unwrap_or(true);
            let arch_ok = os
                .get("arch")
                .and_then(|a| a.as_str())
                .map(|a| a == "x86" || a == "x64" || a == "arm64")
                .unwrap_or(true);
            name_ok && arch_ok
        } else {
            true
        };

        let features_ok = if rule.get("features").is_some() {
            false
        } else {
            true
        };

        if os_ok && features_ok {
            allowed = action == "allow";
        }
    }

    allowed
}

fn apply_replacements(s: &str, replacements: &HashMap<&str, String>) -> String {
    let mut result = s.to_string();
    for (placeholder, value) in replacements {
        result = result.replace(placeholder, value);
    }
    result
}

fn build_game_args(
    manifest: &VersionManifest,
    account: &Account,
    mc_token: &str,
    version_id: &str,
    asset_index_id: &str,
    instance_dir: &Path,
    game_dir: &Path,
    settings: &GlobalSettings,
) -> Vec<String> {
    let user_type = match account.kind {
        crate::auth::types::AccountKind::Microsoft => "msa",
        crate::auth::types::AccountKind::Offline => "legacy",
    };

    let replacements: std::collections::HashMap<&str, String> = [
        ("${auth_player_name}", account.username.clone()),
        ("${version_name}", version_id.to_string()),
        (
            "${game_directory}",
            instance_dir.to_string_lossy().to_string(),
        ),
        (
            "${assets_root}",
            game_dir.join("assets").to_string_lossy().to_string(),
        ),
        ("${assets_index_name}", asset_index_id.to_string()),
        ("${auth_uuid}", account.id.clone()),
        ("${auth_access_token}", mc_token.to_string()),
        ("${user_type}", user_type.to_string()),
        ("${version_type}", "release".to_string()),
        (
            "${resolution_width}",
            settings
                .game_resolution
                .as_ref()
                .map(|r| r.width.to_string())
                .unwrap_or("854".to_string()),
        ),
        (
            "${resolution_height}",
            settings
                .game_resolution
                .as_ref()
                .map(|r| r.height.to_string())
                .unwrap_or("480".to_string()),
        ),
        ("${clientid}", "".to_string()),
        ("${auth_xuid}", "".to_string()),
    ]
    .into_iter()
    .collect();

    let current_os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };
    let mut args = Vec::new();

    if let Some(arguments) = &manifest.arguments {
        if let Some(game) = &arguments.game {
            for arg in game {
                if let Some(s) = arg.as_str() {
                    args.push(apply_replacements(s, &replacements));
                } else if let Some(obj) = arg.as_object() {
                    if check_rules(obj.get("rules"), current_os) {
                        if let Some(value) = obj.get("value") {
                            match value {
                                v if v.is_string() => {
                                    args.push(apply_replacements(
                                        v.as_str().unwrap(),
                                        &replacements,
                                    ));
                                }
                                v if v.is_array() => {
                                    for item in v.as_array().unwrap() {
                                        if let Some(s) = item.as_str() {
                                            args.push(apply_replacements(s, &replacements));
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    } else if let Some(mc_args) = &manifest.minecraft_arguments {
        for part in mc_args.split_whitespace() {
            args.push(apply_replacements(part, &replacements));
        }
    }

    args
}

fn build_classpath(
    game_dir: &PathBuf,
    version_id: &str,
    manifest: &VersionManifest,
) -> Result<String, String> {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let libs_dir = game_dir.join("libraries");
    let current_os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let mut paths: Vec<String> = Vec::new();
    let mut seen_packages: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    for lib in &manifest.libraries {
        if let Some(rules) = &lib.rules {
            let allowed = rules.iter().fold(false, |_acc, rule| {
                let os_ok = rule
                    .os
                    .as_ref()
                    .and_then(|o| o.name.as_deref())
                    .map(|n| n == current_os)
                    .unwrap_or(true);
                if os_ok {
                    rule.action == "allow"
                } else {
                    false
                }
            });
            let is_disallowed = rules.iter().any(|r| {
                let os_ok =
                    r.os.as_ref()
                        .and_then(|o| o.name.as_deref())
                        .map(|n| n != current_os)
                        .unwrap_or(false);
                !os_ok && r.action == "disallow"
            });
            if is_disallowed && !allowed {
                continue;
            }
        }

        let coords: Vec<&str> = lib.name.split(':').collect();
        let package_key = if coords.len() == 4 {
            format!("{}:{}:{}", coords[0], coords[1], coords[3])
        } else if coords.len() >= 2 {
            format!("{}:{}", coords[0], coords[1])
        } else {
            lib.name.clone()
        };

        if seen_packages.contains(&package_key) {
            continue;
        }

        let mut lib_path = None;

        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                if !artifact.path.is_empty() {
                    lib_path = Some(libs_dir.join(&artifact.path));
                }
            }
        }

        if lib_path.is_none() {
            if let Some(path) = super::loaders::fabric::maven_name_to_path(&lib.name) {
                lib_path = Some(libs_dir.join(&path));
            }
        }

        if let Some(p) = lib_path {
            let p_str = p.to_string_lossy().to_string();
            if !seen_paths.contains(&p_str) {
                seen_packages.insert(package_key);
                seen_paths.insert(p_str.clone());
                if p.exists() {
                    paths.push(p_str);
                }
            }
        }
    }

    let is_forge_based = version_id.starts_with("neoforge-") || version_id.contains("-forge-");

    if !is_forge_based {
        let client_jar = game_dir
            .join("versions")
            .join(version_id)
            .join(format!("{version_id}.jar"));

        if client_jar.exists() {
            let key = client_jar.to_string_lossy().to_string();
            if !seen_paths.contains(&key) {
                seen_paths.insert(key.clone());
                paths.push(key);
            }
        } else if let Some(ref parent_id) = manifest.inherits_from {
            let vanilla_jar = game_dir
                .join("versions")
                .join(parent_id)
                .join(format!("{parent_id}.jar"));
            if vanilla_jar.exists() {
                let key = vanilla_jar.to_string_lossy().to_string();
                if !seen_paths.contains(&key) {
                    seen_paths.insert(key.clone());
                    paths.push(key);
                }
            }
        }
    }

    if paths.is_empty() {
        return Err(format!(
            "Classpath vide pour {version_id}. Les librairies ne sont pas téléchargées."
        ));
    }

    Ok(paths.join(sep))
}
