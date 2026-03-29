use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use reqwest::Client;
use super::types::*;

const CLIENT_ID:    &str = "00000000402b5328";
const REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
const AUTH_URL:     &str = "https://login.live.com/oauth20_authorize.srf";
const TOKEN_URL:    &str = "https://login.live.com/oauth20_token.srf";

pub async fn login_with_webview(
    app: tauri::AppHandle,
) -> Result<(Account, StoredTokens), String> {

    let auth_url_str = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code\
         &scope=service::user.auth.xboxlive.com::MBI_SSL\
         &prompt=select_account",
        AUTH_URL, CLIENT_ID, REDIRECT_URI
    );

    let auth_url: url::Url = auth_url_str.parse()
        .map_err(|e| format!("URL invalide : {e}"))?;

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    let tx_nav   = Arc::new(Mutex::new(Some(tx)));
    let tx_close = tx_nav.clone();

    let auth_window = tauri::WebviewWindowBuilder::new(
        &app,
        "microsoft-auth",
        tauri::WebviewUrl::External(auth_url),
    )
    .title("Connexion Microsoft")
    .inner_size(480.0, 680.0)
    .resizable(false)
    .center()
    .on_navigation(move |url: &url::Url| {
        if url.as_str().starts_with(REDIRECT_URI) {
            let result = url
                .query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.to_string())
                .ok_or_else(|| {
                    url.query_pairs()
                        .find(|(k, _)| k == "error_description")
                        .map(|(_, v): (_, std::borrow::Cow<str>)| v.to_string())
                        .unwrap_or_else(|| "Code OAuth introuvable".to_string())
                });

            if let Some(sender) = tx_nav.lock().unwrap().take() {
                let _ = sender.send(result);
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Impossible de créer la fenêtre : {e}"))?;

    auth_window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(sender) = tx_close.lock().unwrap().take() {
                let _ = sender.send(Err("Connexion annulée.".to_string()));
            }
        }
    });

    let auth_code = rx.await
        .map_err(|_| "Erreur interne du canal".to_string())??;

    let _ = auth_window.close();

    let client = Client::new();
    let ms_tokens            = exchange_code(&client, &auth_code).await?;
    let (xbl_token, uhs)     = authenticate_xbox(&client, &ms_tokens.0).await?;
    let xsts_token           = authenticate_xsts(&client, &xbl_token).await?;
    let mc_token             = authenticate_minecraft(&client, &xsts_token, &uhs).await?;
    let profile              = fetch_minecraft_profile(&client, &mc_token).await?;

    let account = Account {
        id:       profile.id,
        username: profile.name,
        kind:     AccountKind::Microsoft,
    };

    let stored = StoredTokens {
        access_token:  ms_tokens.0,
        refresh_token: ms_tokens.1,
        expires_at:    unix_now() + 86400,
    };

    Ok((account, stored))
}


async fn exchange_code(
    client: &Client,
    code: &str,
) -> Result<(String, Option<String>), String> {

    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id",    CLIENT_ID),
            ("code",         code),
            ("grant_type",   "authorization_code"),
            ("redirect_uri", REDIRECT_URI),
        ])
        .send().await
        .map_err(|e| format!("Erreur réseau token MS : {e}"))?;

    let status = resp.status().as_u16();
    let text   = resp.text().await
        .map_err(|e| format!("Lecture token MS : {e}"))?;

    if status != 200 {
        return Err(format!("Token MS HTTP {status} : {text}"));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Token MS invalide ({e}) : {text}"))?;

    let access_token = json["access_token"]
        .as_str()
        .ok_or_else(|| format!("access_token absent : {text}"))?
        .to_string();

    let refresh_token = json["refresh_token"]
        .as_str()
        .map(|s| s.to_string());

    Ok((access_token, refresh_token))
}

async fn authenticate_xbox(
    client: &Client,
    ms_token: &str,
) -> Result<(String, String), String> {

    let resp = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName":   "user.auth.xboxlive.com",
                "RpsTicket": ms_token.to_string()
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType":    "JWT"
        }))
        .send().await
        .map_err(|e| format!("Erreur réseau Xbox : {e}"))?;

    let status = resp.status().as_u16();
    let text   = resp.text().await
        .map_err(|e| format!("Lecture Xbox : {e}"))?;

    if status != 200 {
        return Err(format!("Xbox HTTP {status} — body : '{text}'"));
    }

    if text.is_empty() {
        return Err(format!("Xbox a retourné une réponse vide (HTTP {status})"));
    }

    let resp: XblResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse Xbox invalide ({e}) : {text}"))?;

    let uhs = resp.display_claims.xui
        .first()
        .ok_or("UHS manquant")?
        .uhs.clone();

    Ok((resp.token, uhs))
}

async fn authenticate_xsts(
    client: &Client,
    xbl_token: &str,
) -> Result<String, String> {
    let resp = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId":  "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType":    "JWT"
        }))
        .send().await
        .map_err(|e| format!("Erreur XSTS : {e}"))?;

    let status = resp.status().as_u16();
    let text   = resp.text().await
        .map_err(|e| format!("Lecture XSTS : {e}"))?;

    if status == 401 {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
            return Err(match json["XErr"].as_u64() {
                Some(2148916233) => "Pas de profil Xbox. Connecte-toi sur xbox.com d'abord.".to_string(),
                Some(2148916235) => "Xbox Live n'est pas disponible dans ton pays.".to_string(),
                Some(2148916238) => "Compte enfant — ajoute-le à une famille Microsoft.".to_string(),
                _                => format!("Erreur XSTS 401 : {text}"),
            });
        }
    }

    if status != 200 {
        return Err(format!("XSTS HTTP {status} : {text}"));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse XSTS invalide ({e}) : {text}"))?;

    json["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Token XSTS absent : {text}"))
}

async fn authenticate_minecraft(
    client: &Client,
    xsts_token: &str,
    uhs: &str,
) -> Result<String, String> {
    let text = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={uhs};{xsts_token}")
        }))
        .send().await
        .map_err(|e| format!("Erreur auth Minecraft : {e}"))?
        .text().await
        .map_err(|e| format!("Lecture Minecraft : {e}"))?;

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse Minecraft invalide ({e}) : {text}"))?;

    json["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("access_token absent : {text}"))
}

async fn fetch_minecraft_profile(
    client: &Client,
    mc_token: &str,
) -> Result<McProfileResponse, String> {
    let resp = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send().await
        .map_err(|e| format!("Erreur profil : {e}"))?;

    let status = resp.status().as_u16();
    let text   = resp.text().await
        .map_err(|e| format!("Lecture profil : {e}"))?;

    match status {
        200 => serde_json::from_str::<McProfileResponse>(&text)
                   .map_err(|e| format!("Profil invalide ({e}) : {text}")),
        404 => Err("Ce compte ne possède pas Minecraft Java Edition.".to_string()),
        _   => Err(format!("Profil HTTP {status} : {text}")),
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}