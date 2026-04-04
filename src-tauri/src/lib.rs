mod auth;
mod instances;
mod launcher;

use auth::{microsoft, offline, types::*};
use instances::{
    manager,
    types::{Instance, Loader, LoaderVersion, McVersion},
};
use launcher::{
    download, java,
    launch::{self, RunningProcesses},
};
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use tauri_plugin_store::StoreExt;

pub struct AccountsState(pub Mutex<Vec<Account>>);
pub struct InstancesState(pub Mutex<Vec<Instance>>);
pub struct RunningState(pub RunningProcesses);

#[tauri::command]
async fn login_microsoft(
    app: tauri::AppHandle,
    state: State<'_, AccountsState>,
) -> Result<Account, String> {
    let (account, tokens) = microsoft::login_with_webview(app.clone()).await?;

    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("account:{}", account.id), json!(account));
    store.set(format!("tokens:{}", account.id), json!(tokens));
    store.set("active_account", json!(account.id));
    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    let mut accounts = state.0.lock().unwrap();
    accounts.retain(|a| a.id != account.id);
    accounts.push(account.clone());
    Ok(account)
}

#[tauri::command]
async fn login_offline(
    username: String,
    app: tauri::AppHandle,
    state: State<'_, AccountsState>,
) -> Result<Account, String> {
    let account = offline::create_offline_account(&username)?;

    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("account:{}", account.id), json!(account));
    store.set("active_account", json!(account.id));
    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    let mut accounts = state.0.lock().unwrap();
    accounts.retain(|a| a.id != account.id);
    accounts.push(account.clone());
    Ok(account)
}

#[tauri::command]
async fn load_accounts(
    app: tauri::AppHandle,
    state: State<'_, AccountsState>,
) -> Result<Vec<Account>, String> {
    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let mut loaded = Vec::new();
    for key in store.keys() {
        if key.starts_with("account:") {
            if let Some(val) = store.get(&key) {
                if let Ok(a) = serde_json::from_value::<Account>(val) {
                    loaded.push(a);
                }
            }
        }
    }

    *state.0.lock().unwrap() = loaded.clone();
    Ok(loaded)
}

#[tauri::command]
async fn get_active_account(app: tauri::AppHandle) -> Result<Option<Account>, String> {
    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let active_id = match store.get("active_account") {
        Some(v) => v.as_str().unwrap_or("").to_string(),
        None => return Ok(None),
    };

    Ok(store
        .get(format!("account:{active_id}"))
        .and_then(|v| serde_json::from_value(v).ok()))
}

#[tauri::command]
async fn set_active_account(account_id: String, app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set("active_account", json!(account_id));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))
}

#[tauri::command]
async fn logout_account(
    account_id: String,
    app: tauri::AppHandle,
    state: State<'_, AccountsState>,
) -> Result<(), String> {
    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    store.delete(format!("account:{account_id}"));
    store.delete(format!("tokens:{account_id}"));

    if store
        .get("active_account")
        .and_then(|v| v.as_str().map(|s| s == account_id))
        .unwrap_or(false)
    {
        store.delete("active_account");
    }

    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;
    state.0.lock().unwrap().retain(|a| a.id != account_id);
    Ok(())
}

#[tauri::command]
async fn fetch_mc_versions() -> Result<Vec<McVersion>, String> {
    manager::fetch_mc_versions().await
}

#[tauri::command]
async fn fetch_fabric_versions() -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_fabric_versions().await
}

#[tauri::command]
async fn fetch_neoforge_versions(mc_version: String) -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_neoforge_versions(&mc_version).await
}

#[tauri::command]
async fn fetch_forge_versions(mc_version: String) -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_forge_versions(&mc_version).await
}

#[tauri::command]
async fn fetch_quilt_versions() -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_quilt_versions().await
}

#[tauri::command]
async fn create_instance(
    name: String,
    mc_version: String,
    loader: Loader,
    loader_version: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<Instance, String> {
    let instance = manager::create_instance(name, mc_version, loader, loader_version)?;

    let store = app
        .store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("instance:{}", instance.id), json!(instance));
    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    state.0.lock().unwrap().push(instance.clone());
    Ok(instance)
}

#[tauri::command]
async fn load_instances(
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<Vec<Instance>, String> {
    let store = app
        .store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let mut loaded = Vec::new();
    for key in store.keys() {
        if key.starts_with("instance:") {
            if let Some(val) = store.get(&key) {
                if let Ok(i) = serde_json::from_value::<Instance>(val) {
                    loaded.push(i);
                }
            }
        }
    }

    loaded.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    *state.0.lock().unwrap() = loaded.clone();
    Ok(loaded)
}

#[tauri::command]
async fn delete_instance(
    instance_id: String,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
    running_state: State<'_, RunningState>,
) -> Result<(), String> {
    if running_state.0.lock().unwrap().contains_key(&instance_id) {
        return Err("Impossible de supprimer une instance en cours d'exécution.".to_string());
    }

    let store = app
        .store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let folder_name: Option<String> = store
        .get(format!("instance:{instance_id}"))
        .and_then(|v| serde_json::from_value::<Instance>(v).ok())
        .map(|i| i.folder_name);

    if let Some(folder) = folder_name {
        let instance_dir = download::get_game_dir(&app).join("instances").join(&folder);
        if instance_dir.exists() {
            tokio::fs::remove_dir_all(&instance_dir)
                .await
                .map_err(|e| format!("Impossible de supprimer le dossier : {e}"))?;
        }
    }

    store.delete(format!("instance:{instance_id}"));
    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    state.0.lock().unwrap().retain(|i| i.id != instance_id);

    let remaining = state.0.lock().unwrap().clone();
    if let Err(e) = download::cleanup_unused_assets(&app, &remaining).await {
        eprintln!("Avertissement nettoyage assets : {e}");
    }

    Ok(())
}

#[tauri::command]
async fn update_instance(
    instance: Instance,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let store = app
        .store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("instance:{}", instance.id), json!(instance));
    store
        .save()
        .map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    let mut list = state.0.lock().unwrap();
    if let Some(pos) = list.iter().position(|i| i.id == instance.id) {
        list[pos] = instance;
    }
    Ok(())
}

#[tauri::command]
async fn install_version(
    version_id: String,
    app: tauri::AppHandle,
) -> Result<launcher::types::InstallResult, String> {
    download::install_version(&app, &version_id).await
}

#[tauri::command]
async fn launch_instance_cmd(
    instance_id: String,
    app: tauri::AppHandle,
    instances_state: State<'_, InstancesState>,
    running_state: State<'_, RunningState>,
) -> Result<(), String> {
    let instance = {
        let list = instances_state.0.lock().unwrap();
        list.iter()
            .find(|i| i.id == instance_id)
            .cloned()
            .ok_or("Instance introuvable")?
    };

    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let active_id = store
        .get("active_account")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("Aucun compte sélectionné. Va dans l'onglet Comptes.")?;

    let account: Account = store
        .get(format!("account:{active_id}"))
        .and_then(|v| serde_json::from_value(v).ok())
        .ok_or("Compte introuvable")?;

    let mc_token = store
        .get(format!("tokens:{active_id}"))
        .and_then(|v| serde_json::from_value::<crate::auth::types::StoredTokens>(v).ok())
        .and_then(|t| t.mc_token)
        .unwrap_or_else(|| "0".to_string());

    if !download::is_version_installed(&app, &instance.mc_version) {
        download::install_version(&app, &instance.mc_version).await?;
    }

    let game_dir = download::get_game_dir(&app);
    match &instance.loader {
        instances::types::Loader::Fabric => {
            if let Some(lv) = &instance.loader_version {
                if !launcher::loaders::fabric::is_fabric_installed(
                    &game_dir,
                    &instance.mc_version,
                    lv,
                ) {
                    launcher::loaders::fabric::install_fabric(&app, &instance.mc_version, lv)
                        .await?;
                }
            } else {
                let versions_dir = game_dir.join("versions");
                let mc_ver = &instance.mc_version;
                let fabric_found = std::fs::read_dir(&versions_dir)
                    .ok()
                    .and_then(|entries| {
                        let suffix = format!("-{mc_ver}");
                        entries
                            .flatten()
                            .find(|e| {
                                let n = e.file_name().to_string_lossy().to_string();
                                n.starts_with("fabric-loader-") && n.ends_with(&suffix)
                            })
                            .map(|_| true)
                    })
                    .unwrap_or(false);

                if !fabric_found {
                    return Err(
                        "Cette instance Fabric n'a pas de version de loader configurée.\n\
                         Supprime cette instance et recrée-la en sélectionnant Fabric et une version de loader."
                        .to_string()
                    );
                }
            }
        }
        instances::types::Loader::NeoForge => {
            if let Some(lv) = &instance.loader_version {
                if !launcher::loaders::neoforge::is_neoforge_installed(&game_dir, lv) {
                    launcher::loaders::neoforge::install_neoforge(&app, &instance.mc_version, lv)
                        .await?;
                }
            }
        }
        instances::types::Loader::Forge => {
            if let Some(lv) = &instance.loader_version {
                if !launcher::loaders::forge::is_forge_installed(
                    &game_dir,
                    &instance.mc_version,
                    lv,
                ) {
                    launcher::loaders::forge::install_forge(&app, &instance.mc_version, lv).await?;
                }
            }
        }
        instances::types::Loader::Quilt => {
            if let Some(lv) = &instance.loader_version {
                if !launcher::loaders::quilt::is_quilt_installed(
                    &game_dir,
                    &instance.mc_version,
                    lv,
                ) {
                    launcher::loaders::quilt::install_quilt(&app, &instance.mc_version, lv).await?;
                }
            }
        }
        _ => {}
    }

    launch::launch_instance(&app, &instance, &account, &mc_token, &running_state.0).await
}

#[tauri::command]
fn stop_instance(
    instance_id: String,
    running_state: State<'_, RunningState>,
) -> Result<(), String> {
    launch::kill_instance(&instance_id, &running_state.0)
}

#[tauri::command]
fn get_running_instances(running_state: State<'_, RunningState>) -> Vec<String> {
    running_state.0.lock().unwrap().keys().cloned().collect()
}

#[tauri::command]
async fn check_java(required_version: u32) -> java::JavaInfo {
    java::get_java_info(required_version)
}

#[tauri::command]
async fn install_java_cmd(major_version: u32, app: tauri::AppHandle) -> Result<String, String> {
    let path = java::install_java(&app, major_version).await?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AccountsState(Mutex::new(Vec::new())))
        .manage(InstancesState(Mutex::new(Vec::new())))
        .manage(RunningState(Arc::new(Mutex::new(
            std::collections::HashMap::new(),
        ))))
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                if let Ok(store) = handle.store("accounts.json") {
                    let mut accounts = Vec::new();
                    for key in store.keys() {
                        if key.starts_with("account:") {
                            if let Some(val) = store.get(&key) {
                                if let Ok(a) = serde_json::from_value::<Account>(val) {
                                    accounts.push(a);
                                }
                            }
                        }
                    }
                    let state = handle.state::<AccountsState>();
                    *state.0.lock().unwrap() = accounts;
                }

                if let Ok(store) = handle.store("instances.json") {
                    let mut instances = Vec::new();
                    for key in store.keys() {
                        if key.starts_with("instance:") {
                            if let Some(val) = store.get(&key) {
                                if let Ok(i) = serde_json::from_value::<Instance>(val) {
                                    instances.push(i);
                                }
                            }
                        }
                    }
                    instances.sort_by(|a, b| b.created_at.cmp(&a.created_at));
                    let state = handle.state::<InstancesState>();
                    *state.0.lock().unwrap() = instances;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login_microsoft,
            login_offline,
            load_accounts,
            get_active_account,
            set_active_account,
            logout_account,
            fetch_mc_versions,
            fetch_fabric_versions,
            fetch_neoforge_versions,
            fetch_forge_versions,
            fetch_quilt_versions,
            create_instance,
            load_instances,
            delete_instance,
            update_instance,
            install_version,
            launch_instance_cmd,
            stop_instance,
            get_running_instances,
            check_java,
            install_java_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de Tauri");
}
