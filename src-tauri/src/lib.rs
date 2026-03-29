mod auth;
mod instances;

use auth::{microsoft, offline, types::*};
use instances::{manager, types::{Instance, Loader, McVersion, LoaderVersion}};
use serde_json::json;
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_store::StoreExt;

// ─── État global ──────────────────────────────────────

pub struct AccountsState(pub Mutex<Vec<Account>>);
pub struct InstancesState(pub Mutex<Vec<Instance>>);

// ─── Commandes instances ──────────────────────────────

#[tauri::command]
async fn fetch_mc_versions() -> Result<Vec<McVersion>, String> {
    manager::fetch_mc_versions().await
}

#[tauri::command]
async fn fetch_fabric_versions() -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_fabric_versions().await
}

#[tauri::command]
async fn fetch_neoforge_versions() -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_neoforge_versions().await
}

#[tauri::command]
async fn fetch_forge_versions(mc_version: String) -> Result<Vec<LoaderVersion>, String> {
    manager::fetch_forge_versions(&mc_version).await
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

    // Sauvegarder dans le store
    let store = app.store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("instance:{}", instance.id), json!(instance));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    // Ajouter en mémoire
    state.0.lock().unwrap().push(instance.clone());

    Ok(instance)
}

#[tauri::command]
async fn load_instances(
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<Vec<Instance>, String> {
    let store = app.store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let mut loaded = Vec::new();
    for key in store.keys() {
        if key.starts_with("instance:") {
            if let Some(val) = store.get(&key) {
                if let Ok(instance) = serde_json::from_value::<Instance>(val) {
                    loaded.push(instance);
                }
            }
        }
    }

    // Trier par date de création (plus récent en premier)
    loaded.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    *state.0.lock().unwrap() = loaded.clone();

    Ok(loaded)
}

#[tauri::command]
async fn delete_instance(
    instance_id: String,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let store = app.store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    store.delete(format!("instance:{instance_id}"));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    state.0.lock().unwrap().retain(|i| i.id != instance_id);
    Ok(())
}

#[tauri::command]
async fn update_instance(
    instance: Instance,
    app: tauri::AppHandle,
    state: State<'_, InstancesState>,
) -> Result<(), String> {
    let store = app.store("instances.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    store.set(format!("instance:{}", instance.id), json!(instance));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;

    let mut instances = state.0.lock().unwrap();
    if let Some(pos) = instances.iter().position(|i| i.id == instance.id) {
        instances[pos] = instance;
    }

    Ok(())
}

// ─── Commandes auth (inchangées) ─────────────────────

#[tauri::command]
async fn login_microsoft(
    app: tauri::AppHandle,
    state: State<'_, AccountsState>,
) -> Result<Account, String> {
    let (account, tokens) = microsoft::login_with_webview(app.clone()).await?;

    let store = app.store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("account:{}", account.id), json!(account));
    store.set(format!("tokens:{}", account.id),  json!(tokens));
    store.set("active_account", json!(account.id));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;

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

    let store = app.store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    store.set(format!("account:{}", account.id), json!(account));
    store.set("active_account", json!(account.id));
    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;

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
    let store = app.store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let mut loaded = Vec::new();
    for key in store.keys() {
        if key.starts_with("account:") {
            if let Some(val) = store.get(&key) {
                if let Ok(account) = serde_json::from_value::<Account>(val) {
                    loaded.push(account);
                }
            }
        }
    }

    *state.0.lock().unwrap() = loaded.clone();
    Ok(loaded)
}

#[tauri::command]
async fn get_active_account(app: tauri::AppHandle) -> Result<Option<Account>, String> {
    let store = app.store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    let active_id = match store.get("active_account") {
        Some(v) => v.as_str().unwrap_or("").to_string(),
        None    => return Ok(None),
    };

    Ok(store
        .get(format!("account:{active_id}"))
        .and_then(|v| serde_json::from_value(v).ok()))
}

#[tauri::command]
async fn set_active_account(
    account_id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app.store("accounts.json")
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
    let store = app.store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;

    store.delete(format!("account:{account_id}"));
    store.delete(format!("tokens:{account_id}"));

    if store.get("active_account")
        .and_then(|v| v.as_str().map(|s| s == account_id))
        .unwrap_or(false)
    {
        store.delete("active_account");
    }

    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;
    state.0.lock().unwrap().retain(|a| a.id != account_id);
    Ok(())
}

// ─── Point d'entrée ───────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AccountsState(Mutex::new(Vec::new())))
        .manage(InstancesState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            // Auth
            login_microsoft,
            login_offline,
            load_accounts,
            get_active_account,
            set_active_account,
            logout_account,
            // Instances
            fetch_mc_versions,
            fetch_fabric_versions,
            fetch_neoforge_versions,
            fetch_forge_versions,
            create_instance,
            load_instances,
            delete_instance,
            update_instance,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de Tauri");
}