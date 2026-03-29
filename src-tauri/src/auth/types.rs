use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id:       String,
    pub username: String,
    pub kind:     AccountKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Microsoft,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token:  String,
    pub refresh_token: Option<String>,
    pub expires_at:    u64,
}

// ─── Réponses API internes ────────────────────────────

#[derive(Deserialize)]
pub struct XblResponse {
    #[serde(rename = "Token")]
    pub token: String,
    #[serde(rename = "DisplayClaims")]
    pub display_claims: XblClaims,
}

#[derive(Deserialize)]
pub struct XblClaims {
    pub xui: Vec<XblXui>,
}

#[derive(Deserialize)]
pub struct XblXui {
    pub uhs: String,
}

#[derive(Deserialize)]
pub struct McProfileResponse {
    pub id:   String,
    pub name: String,
}