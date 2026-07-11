use super::types::{Account, AccountKind, VoxuraMeResponse, VoxuraTokens};
use base64::Engine;
use reqwest::Client;
use serde::Deserialize;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const BASE_URL: &str = "https://voxura-studios.fr";

#[derive(Deserialize)]
struct TokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "expiresIn")]
    expires_in: u64,
}

#[derive(Deserialize)]
struct RefreshResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "expiresIn")]
    expires_in: u64,
}

#[derive(Deserialize)]
struct MinecraftSessionResponse {
    #[serde(rename = "sessionToken")]
    session_token: String,
}

pub async fn login() -> Result<(Account, VoxuraTokens), String> {
    let verifier = random_url_token(48);
    let challenge = pkce_challenge(&verifier);
    let state = random_url_token(24);

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Impossible d'ouvrir le callback local : {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Callback local invalide : {e}"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let auth_url = format!(
        "{BASE_URL}/auth/launcher?launcher=1&redirect_uri={}&code_challenge={}&state={}",
        urlencoding(&redirect_uri),
        urlencoding(&challenge),
        urlencoding(&state),
    );

    open::that(auth_url).map_err(|e| format!("Impossible d'ouvrir le navigateur : {e}"))?;

    let (code, returned_state) = tokio::task::spawn_blocking(move || wait_for_callback(listener))
        .await
        .map_err(|e| format!("Callback local interrompu : {e}"))??;

    if returned_state != state {
        return Err("État OAuth Voxura invalide.".to_string());
    }

    let client = Client::new();
    let token_response = client
        .post(format!("{BASE_URL}/api/oauth/token"))
        .json(&serde_json::json!({
            "code": code,
            "codeVerifier": verifier,
            "redirectUri": redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Voxura : {e}"))?;

    if !token_response.status().is_success() {
        let status = token_response.status();
        let body = token_response.text().await.unwrap_or_default();
        return Err(format!("Connexion Voxura refusée ({status}) : {body}"));
    }

    let token: TokenResponse = token_response
        .json()
        .await
        .map_err(|e| format!("Réponse token Voxura invalide : {e}"))?;

    let me = fetch_me(&client, &token.access_token).await?;
    let account = Account {
        id: me.voxura_uuid,
        username: me.user.username,
        kind: AccountKind::Voxura,
        email: Some(me.user.email),
    };
    let tokens = VoxuraTokens {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: unix_now() + token.expires_in,
    };

    Ok((account, tokens))
}

pub async fn ensure_valid_token(
    app: &tauri::AppHandle,
    account_id: &str,
) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;

    let store = app
        .store("accounts.json")
        .map_err(|e| format!("Store inaccessible : {e}"))?;
    let value = store
        .get(format!("voxura_tokens:{account_id}"))
        .ok_or("Session Voxura introuvable. Connecte ton compte Voxura.")?;
    let mut tokens: VoxuraTokens = serde_json::from_value(value)
        .map_err(|_| "Session Voxura invalide. Reconnecte ton compte Voxura.")?;

    if unix_now() + 120 < tokens.expires_at {
        return Ok(tokens.access_token);
    }

    let client = Client::new();
    let response = client
        .post(format!("{BASE_URL}/api/oauth/refresh"))
        .json(&serde_json::json!({ "refreshToken": tokens.refresh_token }))
        .send()
        .await
        .map_err(|e| format!("Refresh Voxura impossible : {e}"))?;

    if !response.status().is_success() {
        return Err("Session Voxura expirée. Reconnecte ton compte Voxura.".to_string());
    }

    let refreshed: RefreshResponse = response
        .json()
        .await
        .map_err(|e| format!("Réponse refresh Voxura invalide : {e}"))?;
    let access_token = refreshed.access_token.clone();
    tokens.access_token = refreshed.access_token;
    tokens.refresh_token = refreshed.refresh_token;
    tokens.expires_at = unix_now() + refreshed.expires_in;
    store.set(
        format!("voxura_tokens:{account_id}"),
        serde_json::json!(tokens),
    );
    let _ = store.save();

    Ok(access_token)
}

pub async fn create_minecraft_session(
    access_token: &str,
    player_name: &str,
    player_uuid: &str,
    identity_source: &str,
) -> Result<String, String> {
    let client = Client::new();
    let response = client
        .post(format!("{BASE_URL}/api/minecraft/session"))
        .bearer_auth(access_token)
        .json(&serde_json::json!({
            "playerName": player_name,
            "playerUuid": player_uuid,
            "identitySource": identity_source,
        }))
        .send()
        .await
        .map_err(|e| format!("Création session Minecraft Voxura impossible : {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Session Minecraft Voxura refusée ({status}) : {body}"
        ));
    }

    let session: MinecraftSessionResponse = response
        .json()
        .await
        .map_err(|e| format!("Réponse session Minecraft Voxura invalide : {e}"))?;
    Ok(session.session_token)
}

async fn fetch_me(client: &Client, access_token: &str) -> Result<VoxuraMeResponse, String> {
    let response = client
        .get(format!("{BASE_URL}/api/launcher/me"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Profil Voxura impossible : {e}"))?;

    if !response.status().is_success() {
        return Err("Impossible de lire le profil Voxura.".to_string());
    }

    response
        .json()
        .await
        .map_err(|e| format!("Profil Voxura invalide : {e}"))
}

fn wait_for_callback(listener: TcpListener) -> Result<(String, String), String> {
    let (mut stream, _) = listener
        .accept()
        .map_err(|e| format!("Callback local non reçu : {e}"))?;
    let mut buffer = [0u8; 4096];
    let len = stream
        .read(&mut buffer)
        .map_err(|e| format!("Lecture callback impossible : {e}"))?;
    let request = String::from_utf8_lossy(&buffer[..len]);
    let first_line = request.lines().next().ok_or("Callback HTTP vide")?;
    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or("Callback HTTP invalide")?;
    let url = url::Url::parse(&format!("http://127.0.0.1{path}"))
        .map_err(|e| format!("Callback URL invalide : {e}"))?;
    let code = url
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.to_string())
        .ok_or("Code Voxura manquant")?;
    let state = url
        .query_pairs()
        .find(|(key, _)| key == "state")
        .map(|(_, value)| value.to_string())
        .ok_or("State Voxura manquant")?;

    let body = "<html><body style=\"font-family:sans-serif;background:#07110d;color:white;display:grid;place-items:center;height:100vh\"><p>Connexion Voxura terminée. Tu peux revenir au launcher.</p></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    Ok((code, state))
}

fn random_url_token(bytes: usize) -> String {
    let mut token = String::new();
    while token.len() < bytes {
        token.push_str(&Uuid::new_v4().to_string().replace('-', ""));
    }
    token.truncate(bytes);
    token
}

fn pkce_challenge(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
