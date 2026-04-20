use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub step: String,
    pub current: u64,
    pub total: u64,
    pub percent: f64,
}

#[derive(Deserialize, Clone)]
pub struct VersionManifest {
    pub downloads: Option<VersionDownloads>,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<AssetIndex>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<Arguments>,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct JavaVersion {
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Deserialize, Clone)]
pub struct VersionDownloads {
    pub client: Download,
}

#[derive(Deserialize, Clone)]
pub struct Download {
    pub url: String,
    pub sha1: String,
}

#[derive(Deserialize, Clone)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
}

#[derive(Deserialize, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<LibraryArtifact>,
}

#[derive(Deserialize, Clone)]
pub struct LibraryArtifact {
    pub url: String,
    pub path: String,
    pub sha1: String,
}

#[derive(Deserialize, Clone)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
}

#[derive(Deserialize, Clone)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct AssetIndex {
    pub id: String,
    pub url: String,
}

#[derive(Deserialize)]
pub struct AssetIndexFile {
    pub objects: std::collections::HashMap<String, Asset>,
}

#[derive(Deserialize)]
pub struct Asset {
    pub hash: String,
}

#[derive(Deserialize, Clone)]
pub struct Arguments {
    pub game: Option<Vec<serde_json::Value>>,
    pub jvm: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub version_id: String,
    pub game_dir: String,
}
