mod auth;

use auth::{microsoft, offline, types::*};
use serde_json::json;
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_store::StoreExt;

pub struct AccountsState(pub Mutex<Vec<Account>>);


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

    if store
        .get("active_account")
        .and_then(|v| v.as_str().map(|s| s == account_id))
        .unwrap_or(false)
    {
        store.delete("active_account");
    }

    store.save().map_err(|e| format!("Erreur sauvegarde : {e}"))?;
    state.0.lock().unwrap().retain(|a| a.id != account_id);

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AccountsState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            login_microsoft,
            login_offline,
            load_accounts,
            get_active_account,
            set_active_account,
            logout_account,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de Tauri");
}