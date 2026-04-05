use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub folder_name: String,
    pub mc_version: String,
    pub loader: Loader,
    pub loader_version: Option<String>,
    pub created_at: u64,
    pub last_played: Option<u64>,
    pub play_time: u64,
    pub java_args: Option<String>,
    pub ram_mb: u32,
    pub icon_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Loader {
    Vanilla,
    Fabric,
    Forge,
    NeoForge,
    Quilt,
}

impl std::fmt::Display for Loader {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Loader::Vanilla => write!(f, "Vanilla"),
            Loader::Fabric => write!(f, "Fabric"),
            Loader::Forge => write!(f, "Forge"),
            Loader::NeoForge => write!(f, "NeoForge"),
            Loader::Quilt => write!(f, "Quilt"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McVersion {
    pub id: String,
    pub version_type: McVersionType,
    pub release_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum McVersionType {
    Release,
    Snapshot,
    #[serde(rename = "old_beta")]
    OldBeta,
    #[serde(rename = "old_alpha")]
    OldAlpha,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

#[derive(Deserialize)]
pub struct MojangVersionManifest {
    pub versions: Vec<MojangVersion>,
}

#[derive(Deserialize)]
pub struct MojangVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Deserialize)]
pub struct FabricLoaderVersion {
    pub version: String,
    pub stable: bool,
}

#[derive(Deserialize)]
pub struct ForgeVersion {
    pub version: String,
    pub recommended: Option<bool>,
}
