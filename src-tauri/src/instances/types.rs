use serde::{Deserialize, Serialize};

/// Une instance de jeu complète
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id:          String,   // UUID unique
    pub name:        String,   // Nom affiché
    pub mc_version:  String,   // ex: "1.21.4"
    pub loader:      Loader,   // Vanilla, Fabric, Forge...
    pub loader_version: Option<String>, // Version du mod loader
    pub created_at:  u64,      // Timestamp Unix
    pub last_played: Option<u64>,
    pub play_time:   u64,      // Secondes jouées
    pub java_args:   Option<String>, // Args JVM custom
    pub ram_mb:      u32,      // RAM allouée en Mo
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
            Loader::Vanilla  => write!(f, "Vanilla"),
            Loader::Fabric   => write!(f, "Fabric"),
            Loader::Forge    => write!(f, "Forge"),
            Loader::NeoForge => write!(f, "NeoForge"),
            Loader::Quilt    => write!(f, "Quilt"),
        }
    }
}

/// Version Minecraft de l'API Mojang (simplifiée)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McVersion {
    pub id:           String,       // ex: "1.21.4"
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

/// Version d'un mod loader (Fabric, Forge, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable:  bool,
}

// ─── Réponses API Mojang ──────────────────────────────

#[derive(Deserialize)]
pub struct MojangVersionManifest {
    pub versions: Vec<MojangVersion>,
}

#[derive(Deserialize)]
pub struct MojangVersion {
    pub id:            String,
    #[serde(rename = "type")]
    pub version_type:  String,
    #[serde(rename = "releaseTime")]
    pub release_time:  String,
}

// ─── Réponses API Fabric ──────────────────────────────

#[derive(Deserialize)]
pub struct FabricLoaderVersion {
    pub loader: FabricLoader,
}

#[derive(Deserialize)]
pub struct FabricLoader {
    pub version: String,
    pub stable:  bool,
}

// ─── Réponses API Forge / NeoForge ───────────────────

#[derive(Deserialize)]
pub struct ForgeVersion {
    pub version: String,
    pub recommended: Option<bool>,
}