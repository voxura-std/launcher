use std::time::{SystemTime, UNIX_EPOCH};
use reqwest::Client;
use uuid::Uuid;

use super::types::*;


const MOJANG_MANIFEST: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_VERSIONS: &str =
    "https://meta.fabricmc.net/v2/versions/loader";
const NEOFORGE_VERSIONS: &str =
    "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

pub async fn fetch_mc_versions() -> Result<Vec<McVersion>, String> {
    let client = Client::new();

    let text = client
        .get(MOJANG_MANIFEST)
        .send().await
        .map_err(|e| format!("Erreur réseau Mojang : {e}"))?
        .text().await
        .map_err(|e| format!("Lecture Mojang : {e}"))?;

    let manifest: MojangVersionManifest = serde_json::from_str(&text)
        .map_err(|e| format!("Manifest Mojang invalide : {e}"))?;

    let versions = manifest.versions
        .into_iter()
        .map(|v| McVersion {
            id: v.id,
            version_type: match v.version_type.as_str() {
                "release"   => McVersionType::Release,
                "snapshot"  => McVersionType::Snapshot,
                "old_beta"  => McVersionType::OldBeta,
                "old_alpha" => McVersionType::OldAlpha,
                _           => McVersionType::Release,
            },
            release_time: v.release_time,
        })
        .collect();

    Ok(versions)
}


pub async fn fetch_fabric_versions() -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();

    let text = client
        .get(FABRIC_VERSIONS)
        .send().await
        .map_err(|e| format!("Erreur réseau Fabric : {e}"))?
        .text().await
        .map_err(|e| format!("Lecture Fabric : {e}"))?;

    let raw: Vec<FabricLoaderVersion> = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse Fabric invalide : {e}"))?;

    Ok(raw.into_iter().map(|v| LoaderVersion {
        version: v.loader.version,
        stable:  v.loader.stable,
    }).collect())
}


pub async fn fetch_neoforge_versions() -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();

    let text = client
        .get(NEOFORGE_VERSIONS)
        .send().await
        .map_err(|e| format!("Erreur réseau NeoForge : {e}"))?
        .text().await
        .map_err(|e| format!("Lecture NeoForge : {e}"))?;

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse NeoForge invalide : {e}"))?;

    let versions = json["versions"]
        .as_array()
        .ok_or("Format NeoForge inattendu")?
        .iter()
        .filter_map(|v| v.as_str())
        .filter(|v| !v.contains("-beta") && !v.contains("-rc"))
        .map(|v| LoaderVersion {
            version: v.to_string(),
            stable:  true,
        })
        .rev()
        .collect();

    Ok(versions)
}


pub async fn fetch_forge_versions(mc_version: &str) -> Result<Vec<LoaderVersion>, String> {
    let client = Client::new();
    let url = format!(
        "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
    );

    let text = client
        .get(&url)
        .send().await
        .map_err(|e| format!("Erreur réseau Forge : {e}"))?
        .text().await
        .map_err(|e| format!("Lecture Forge : {e}"))?;

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Réponse Forge invalide : {e}"))?;

    let promos = json["promos"].as_object()
        .ok_or("Format Forge inattendu")?;

    let mut versions = Vec::new();

    for suffix in &["recommended", "latest"] {
        let key = format!("{mc_version}-{suffix}");
        if let Some(v) = promos.get(&key).and_then(|v| v.as_str()) {
            versions.push(LoaderVersion {
                version: format!("{mc_version}-{v}"),
                stable:  *suffix == "recommended",
            });
        }
    }

    Ok(versions)
}

pub fn create_instance(
    name: String,
    mc_version: String,
    loader: Loader,
    loader_version: Option<String>,
) -> Result<Instance, String> {
    if name.trim().is_empty() {
        return Err("Le nom de l'instance ne peut pas être vide.".to_string());
    }
    if name.len() > 64 {
        return Err("Le nom est trop long (max 64 caractères).".to_string());
    }

    let folder_name = name
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            ' ' => '_',
            c => c,
        })
        .collect::<String>();

    let id = Uuid::new_v4().to_string();
    let folder_name = format!("{folder_name}_{}", &id[..8]);

    Ok(Instance {
        id,
        name: name.trim().to_string(),
        folder_name,
        mc_version,
        loader,
        loader_version,
        created_at:  unix_now(),
        last_played: None,
        play_time:   0,
        java_args:   None,
        ram_mb:      2048,
    })
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}