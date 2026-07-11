use super::types::{Account, AccountKind};
use uuid::Uuid;

pub fn create_offline_account(username: &str) -> Result<Account, String> {
    let username = username.trim();

    if username.is_empty() {
        return Err("Le pseudo ne peut pas être vide.".to_string());
    }
    if username.len() < 3 || username.len() > 16 {
        return Err("Le pseudo doit faire entre 3 et 16 caractères.".to_string());
    }
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Seuls les lettres, chiffres et _ sont autorisés.".to_string());
    }

    let id = Uuid::new_v3(
        &Uuid::NAMESPACE_DNS,
        format!("OfflinePlayer:{username}").as_bytes(),
    )
    .to_string()
    .replace('-', "");

    Ok(Account {
        id,
        username: username.to_string(),
        kind: AccountKind::Offline,
        email: None,
    })
}
