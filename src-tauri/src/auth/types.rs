use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub kind: AccountKind,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Microsoft,
    Offline,
    Voxura,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoxuraTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoxuraMeResponse {
    pub user: VoxuraUser,
    #[serde(rename = "voxuraUuid")]
    pub voxura_uuid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoxuraUser {
    pub id: String,
    pub email: String,
    pub username: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub mc_token: Option<String>,
    pub expires_at: u64,
}

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
    pub id: String,
    pub name: String,
}
