import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Search, Download, Trash2, Power, Puzzle, Image, Palette,
  Loader2, CheckCircle2, AlertCircle
} from 'lucide-react'
import type { Instance } from '../hooks/useInstances'

type AddonType = 'mods' | 'resourcepacks' | 'shaders'

interface AddonFile {
  filename: string
  disabled: boolean
  size: number
  hash: string
}

interface ModrinthProject {
  id: string
  slug: string
  title: string
  description: string
  icon_url: string
}

interface InstalledAddon extends AddonFile {
  modrinthData?: ModrinthProject
}

interface ModrinthHit {
  project_id: string
  title: string
  description: string
  icon_url: string
  author: string
  downloads: number
}

interface ModVersion {
  id: string
  project_id: string
  version_number: string
  files: { url: string, filename: string, primary: boolean }[]
  dependencies: { project_id?: string, dependency_type: string }[]
}

export default function ModsManager({ instance, type, isRunning, offline }: { instance: Instance, type: AddonType, isRunning?: boolean, offline?: boolean }) {
  const [activeTab, setActiveTab] = useState<'installed' | 'explore'>('installed')

  const [installed, setInstalled] = useState<InstalledAddon[]>([])
  const [loadingInstalled, setLoadingInstalled] = useState(true)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ModrinthHit[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)

  const [tasks, setTasks] = useState<Record<string, 'loading' | 'success' | 'error'>>({})

  const [pendingInstall, setPendingInstall] = useState<{
    project: ModrinthHit,
    versionsToInstall: ModVersion[],
    projectDetails: ModrinthProject[]
  } | null>(null)
  const [installing, setInstalling] = useState(false)

  const [fileToDelete, setFileToDelete] = useState<{ filename: string, modrinthName?: string } | null>(null)

  const typeLabel = type === 'mods' ? 'Mods' : type === 'resourcepacks' ? 'Resource Packs' : 'Shaders'
  const iconProps = { size: 16 }
  const TypeIcon = type === 'mods' ? <Puzzle {...iconProps} /> : type === 'resourcepacks' ? <Image {...iconProps} /> : <Palette {...iconProps} />

  const preventInstall = isRunning && type === 'mods'
  const preventManage = isRunning

  useEffect(() => {
    fetchInstalled()
  }, [instance.id, type])

  const fetchInstalled = async () => {
    setLoadingInstalled(true)
    try {
      const items = await invoke<AddonFile[]>('get_installed_addons', {
        instanceId: instance.id,
        addonType: type
      })

      const itemsWithMeta: InstalledAddon[] = [...items]
      const hashes = items.map(i => i.hash).filter(h => h && h.length > 0)
      
      if (hashes.length > 0) {
        try {
          const res = await fetch('https://api.modrinth.com/v2/version_files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes, algorithm: 'sha1' })
          })
          if (res.ok) {
            const hashToVersionInfo = await res.json()
            const projectIds = new Set<string>()
            for (const key in hashToVersionInfo) {
               projectIds.add(hashToVersionInfo[key].project_id)
            }

            if (projectIds.size > 0) {
               const pRes = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(Array.from(projectIds)))}`)
               if (pRes.ok) {
                  const projects: ModrinthProject[] = await pRes.json()
                  const idToProject = new Map(projects.map(p => [p.id, p]))

                  for (let i = 0; i < itemsWithMeta.length; i++) {
                     const itemHash = itemsWithMeta[i].hash
                     if (hashToVersionInfo[itemHash]) {
                        itemsWithMeta[i].modrinthData = idToProject.get(hashToVersionInfo[itemHash].project_id)
                     }
                  }
               }
            }
          }
        } catch (e) {
          console.warn("Unable to fetch Modrinth metadata", e)
        }
      }

      itemsWithMeta.sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        const nameA = a.modrinthData?.title || a.filename
        const nameB = b.modrinthData?.title || b.filename
        return nameA.localeCompare(nameB)
      })
      setInstalled(itemsWithMeta)
    } catch (e) {
      console.error('Erreur lecture addons:', e)
    }
    setLoadingInstalled(false)
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoadingSearch(true)

    const projectTypeMap = {
      'mods': 'mod',
      'resourcepacks': 'resourcepack',
      'shaders': 'shader'
    }

    const facets = [
      [`project_type:${projectTypeMap[type]}`],
      [`versions:${instance.mc_version}`]
    ]

    if (type === 'mods' && instance.loader !== 'vanilla') {
        facets.push([`categories:${instance.loader}`])
    }

    try {
      const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20`)
      const data = await res.json()
      setHits(data.hits || [])
    } catch (e) {
      console.error('Erreur API Modrinth', e)
    }
    setLoadingSearch(false)
  }

  useEffect(() => {
    if (activeTab === 'explore' && hits.length === 0) {
      handleSearch()
    }
  }, [activeTab])

  const toggleAddon = async (file: AddonFile) => {
    if (preventManage) return
    try {
      await invoke('toggle_addon', {
        instanceId: instance.id,
        addonType: type,
        filename: file.filename,
        enable: file.disabled
      })
      fetchInstalled()
    } catch (e) {
      alert("Erreur: " + e)
    }
  }

  const promptDeleteAddon = (filename: string, modrinthName?: string) => {
    if (preventManage) return
    setFileToDelete({ filename, modrinthName })
  }

  const confirmDeleteAddon = async () => {
    if (!fileToDelete) return
    try {
      await invoke('delete_addon', {
        instanceId: instance.id,
        addonType: type,
        filename: fileToDelete.filename
      })
      setFileToDelete(null)
      fetchInstalled()
    } catch (e) {
      alert("Erreur: " + e)
    }
  }

  const fetchDependencyTree = async (projectId: string, loaderParam: string, depsMap = new Map<string, ModVersion>(), installedSet: Set<string>): Promise<Map<string, ModVersion>> => {
      if (depsMap.has(projectId) || installedSet.has(projectId)) return depsMap;

      const url = `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=["${instance.mc_version}"]${type === 'mods' ? `&loaders=${loaderParam}` : ''}`
      const res = await fetch(url)
      const versions = await res.json()
      
      if (!versions || versions.length === 0) {
         throw new Error(`Aucune version compatible pour le projet ID ${projectId}.`)
      }

      const version = versions[0]
      depsMap.set(projectId, version)

      const requiredDeps = version.dependencies?.filter((d: any) => d.dependency_type === 'required') || []
      for (const dep of requiredDeps) {
        if (dep.project_id && !depsMap.has(dep.project_id) && !installedSet.has(dep.project_id)) {
           const depLoaderParam = type === 'mods' ? `["${instance.loader}"]` : `[]`
           await fetchDependencyTree(dep.project_id, depLoaderParam, depsMap, installedSet)
        }
      }
      return depsMap;
  }

  const initiateInstall = async (project: ModrinthHit) => {
    if (preventInstall) return
    setTasks(prev => ({ ...prev, [project.project_id]: 'loading' }))
    
    try {
      const installedSet = new Set<string>()
      installed.forEach(i => {
        if (i.modrinthData) installedSet.add(i.modrinthData.id)
      })

      const loaderParam = type === 'mods' && instance.loader !== 'vanilla' ? `["${instance.loader}"]` : `[]`
      const depsMap = await fetchDependencyTree(project.project_id, loaderParam, new Map(), installedSet)

      const allVersions = Array.from(depsMap.values())

      const pRes = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(Array.from(depsMap.keys())))}`)
      const projectDetails: ModrinthProject[] = await pRes.json()

      if (allVersions.length > 1) {
          setPendingInstall({
             project,
             versionsToInstall: allVersions,
             projectDetails
          })
          setTasks(prev => {
             const copy = { ...prev }
             delete copy[project.project_id]
             return copy
          })
      } else {
          await executeInstall(allVersions)
          setTasks(prev => ({ ...prev, [project.project_id]: 'success' }))
      }

    } catch (e) {
      console.error(e)
      setTasks(prev => ({ ...prev, [project.project_id]: 'error' }))
      alert(`Impossible de préparer ${project.title}: ` + e)
    }
  }

  const confirmDependencies = async () => {
    if (!pendingInstall) return
    const { project, versionsToInstall } = pendingInstall
    
    setTasks(prev => ({ ...prev, [project.project_id]: 'loading' }))
    setInstalling(true)
    
    try {
      await executeInstall(versionsToInstall)
      setTasks(prev => ({ ...prev, [project.project_id]: 'success' }))
      setPendingInstall(null)
    } catch(e) {
      alert(`Erreur d'installation: ` + e)
      setTasks(prev => ({ ...prev, [project.project_id]: 'error' }))
    } finally {
      setInstalling(false)
    }
  }

  const executeInstall = async (versions: ModVersion[]) => {
      for (const version of versions) {
         const file = version.files.find((f: any) => f.primary) || version.files[0]
         if (!file) throw new Error(`Fichier introuvable pour la version ${version.id}`)

         await invoke('download_addon', {
           instanceId: instance.id,
           addonType: type,
           url: file.url,
           filename: file.filename
         })
      }
      fetchInstalled()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {fileToDelete && (
         <div style={{
            position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
         }}>
            <div style={{
               background: 'rgba(15, 30, 22,0.97)', border: '1px solid rgba(239,68,68,0.25)',
               padding: 24, borderRadius: 16, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
            }}>
               <div style={{
                  width: 46, height: 46, borderRadius: 13, background: 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14
               }}>
                  <AlertCircle size={22} color="#f87171" />
               </div>
               <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                  Supprimer "{fileToDelete.modrinthName || fileToDelete.filename}" ?
               </p>
               <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                  Ce fichier sera définitivement supprimé du dossier de l'instance.
               </p>

               <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setFileToDelete(null)} style={{
                     flex: 1, padding: 9, borderRadius: 10, background: 'rgba(255,255,255,0.07)',
                     border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)', cursor: 'pointer',
                     fontWeight: 500, fontSize: 13
                  }}>Annuler</button>
                  <button onClick={confirmDeleteAddon} style={{
                     flex: 1, padding: 9, borderRadius: 10, background: 'rgba(239,68,68,0.80)',
                     border: 'none', color: '#fff', cursor: 'pointer',
                     fontWeight: 600, fontSize: 13
                  }}>Supprimer</button>
               </div>
            </div>
         </div>
      )}

      {pendingInstall && (
         <div style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
         }}>
            <div style={{
               background: 'rgba(15, 30, 22,0.97)', border: '1px solid rgba(255,255,255,0.1)',
               padding: 24, borderRadius: 16, width: 440, boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
               <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)', marginBottom: 8 }}>
                  Dépendances Requises
               </h3>
               <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  <strong>{pendingInstall.project.title}</strong> nécessite l'installation des dépendances suivantes pour fonctionner correctement :
               </p>
               
               <div style={{
                  background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.05)', maxHeight: 200, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20
               }}>
                  {pendingInstall.versionsToInstall.map(v => {
                      const proj = pendingInstall.projectDetails.find(p => p.id === v.project_id)
                      return (
                         <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {proj?.icon_url ? 
                               <img src={proj.icon_url} style={{ width: 24, height: 24, borderRadius: 6 }} /> :
                               <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.1)' }} />
                            }
                            <div>
                               <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{proj?.title || v.project_id}</p>
                               <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>{v.version_number}</p>
                            </div>
                         </div>
                      )
                  })}
               </div>

               <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => {
                     setPendingInstall(null)
                     setTasks(prev => {
                        const copy = { ...prev }
                        delete copy[pendingInstall.project.project_id]
                        return copy
                     })
                  }} style={{
                     flex: 1, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                     border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer'
                  }} disabled={installing}>
                     Annuler
                  </button>
                  <button onClick={confirmDependencies} style={{
                     flex: 1, padding: 10, borderRadius: 8, background: 'var(--primary)',
                     border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }} disabled={installing}>
                     {installing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
                     Tout Télécharger
                  </button>
               </div>
            </div>
         </div>
      )}

      <div style={{
        display: 'flex', gap: 10, padding: '18px 18px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0
      }}>
        <button onClick={() => setActiveTab('installed')} style={{
          padding: '8px 16px', borderBottom: activeTab === 'installed' ? '2px solid #4ade80' : '2px solid transparent',
          background: 'transparent', color: activeTab === 'installed' ? '#fff' : 'var(--text-faint)', 
          fontWeight: 600, fontSize: 13, borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {TypeIcon}
          Installés
          <span style={{ 
            background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 10, 
            fontSize: 11, marginLeft: 4 
          }}>{installed.length}</span>
        </button>

        {!offline && (
          <button onClick={() => setActiveTab('explore')} style={{
            padding: '8px 16px', borderBottom: activeTab === 'explore' ? '2px solid #4ade80' : '2px solid transparent',
            background: 'transparent', color: activeTab === 'explore' ? '#fff' : 'var(--text-faint)', 
            fontWeight: 600, fontSize: 13, borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Search size={16} />
            Télécharger des {typeLabel}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18, boxSizing: 'border-box' }}>

        {activeTab === 'installed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            
            {preventManage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '10px 14px', borderRadius: 10, color: '#fca5a5', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10
              }}>
                <AlertCircle size={16} />
                Gestion désactivée pendant que le jeu est lancé.
              </div>
            )}

            {loadingInstalled ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>Chargement...</div>
            ) : installed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ color: 'var(--text-muted)' }}>Aucun(e) {typeLabel} installé(e).</p>
                <button onClick={() => setActiveTab('explore')} className="btn-primary" style={{ marginTop: 12 }}>
                  <Search size={14} /> Chercher des {typeLabel}
                </button>
              </div>
            ) : (
              installed.map(file => (
                <div key={file.filename} style={{
                  display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                  opacity: file.disabled ? 0.5 : 1, transition: 'all 0.2s', gap: 14
                }}>
                  {file.modrinthData?.icon_url ? (
                     <img src={file.modrinthData.icon_url} style={{ width: 36, height: 36, borderRadius: 8, opacity: file.disabled ? 0.6 : 1 }} />
                  ) : (
                     <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {TypeIcon}
                     </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', 
                        textDecoration: file.disabled ? 'line-through' : 'none' }}>
                      {file.modrinthData?.title || file.filename.replace('.disabled', '')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'flex', gap: 8 }}>
                      {file.modrinthData?.title && <span>Fichier: {file.filename.replace('.disabled', '')}</span>}
                      <span>V/ {(file.size / 1024 / 1024).toFixed(2)} Mo</span>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: preventManage ? 0.4 : 1, pointerEvents: preventManage ? 'none' : 'auto' }}>
                    <button onClick={() => toggleAddon(file)} style={{
                      padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: file.disabled ? 'rgba(255,255,255,0.08)' : 'rgba(52, 211, 153, 0.15)',
                      border: '1px solid', borderColor: file.disabled ? 'rgba(255,255,255,0.1)' : 'rgba(52, 211, 153, 0.3)',
                      color: file.disabled ? 'var(--text-muted)' : '#34d399',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      <Power size={13} />
                      {file.disabled ? 'Activer' : 'Désactiver'}
                    </button>
                    
                    <button onClick={() => promptDeleteAddon(file.filename, file.modrinthData?.title)} style={{
                      padding: 6, borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171'
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'explore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {preventInstall && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '10px 14px', borderRadius: 10, color: '#fca5a5', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertCircle size={16} />
                L'installation de nouveaux Mods est impossible pendant que le jeu est lancé !
              </div>
            )}

            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, opacity: preventInstall ? 0.5 : 1, pointerEvents: preventInstall ? 'none' : 'auto' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 12px'
              }}>
                <Search size={16} color="var(--text-faint)" />
                <input 
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={`Rechercher des ${typeLabel} sur Modrinth...`}
                  autoFocus
                  style={{
                    flex: 1, background: 'transparent', border: 'none', padding: '12px 10px',
                    color: '#fff', fontSize: 14, outline: 'none'
                  }}
                />
              </div>
              <button className="btn-primary" type="submit" disabled={loadingSearch} style={{ padding: '0 20px' }}>
                {loadingSearch ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Chercher'}
              </button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, opacity: preventInstall ? 0.5 : 1 }}>
              {hits.map(hit => (
                <div key={hit.project_id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 12, padding: 14, display: 'flex', gap: 12
                }}>
                  {hit.icon_url ? (
                    <img src={hit.icon_url} alt="" style={{ width: 48, height: 48, borderRadius: 10 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {TypeIcon}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', 
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hit.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#4ade80', marginBottom: 6 }}>
                      par {hit.author}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-faint)', 
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', 
                                overflow: 'hidden', lineHeight: 1.4, flex: 1 }}>
                      {hit.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {(hit.downloads / 1000000).toFixed(1)}M dls
                      </span>
                      <div style={{ flex: 1 }} />
                      
                      {tasks[hit.project_id] === 'success' ? (
                        <button style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: 'none',
                          display: 'flex', alignItems: 'center', gap: 4
                        }} disabled>
                          <CheckCircle2 size={14} /> Installé
                        </button>
                      ) : (
                        <button onClick={() => initiateInstall(hit)} disabled={tasks[hit.project_id] === 'loading' || preventInstall} style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: preventInstall ? 'not-allowed' : 'pointer',
                          background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', border: 'none',
                          display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.1s'
                        }}>
                          {tasks[hit.project_id] === 'loading'
                            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Download size={14} />
                          }
                          Installer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!loadingSearch && hits.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                Aucun résultat trouvé sur Modrinth.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
