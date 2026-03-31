import { useState, useEffect } from 'react'
import {
  Plus, RefreshCw, SlidersHorizontal, LayoutGrid,
  List, Layers, FolderPlus, Trash2, Play, Square,
  ChevronDown, ChevronLeft, ChevronRight, X, Check,
  Loader2, AlertCircle, Package
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useInstances, type Instance, type McVersion, type LoaderVersion } from '../hooks/useInstances'


type LoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'

interface Progress {
  step: string
  current: number
  total: number
  percent: number
}

const LOADERS: { id: LoaderType; label: string; color: string }[] = [
  { id: 'vanilla',  label: 'Vanilla',  color: '#418d54' },
  { id: 'fabric',   label: 'Fabric',   color: '#e9e2b8' },
  { id: 'forge',    label: 'Forge',    color: '#2b297a' },
  { id: 'neoforge', label: 'NeoForge', color: '#e86c1f' },
  { id: 'quilt',    label: 'Quilt',    color: '#a058d3' },
]

const LOADER_COLOR: Record<LoaderType, string> = {
  vanilla:  '#6b7280',
  fabric:   '#b5c3d4',
  forge:    '#e8a44a',
  neoforge: '#e86c1f',
  quilt:    '#9f5ece',
}


function ProgressOverlay({ progress }: { progress: Progress | null }) {
  if (!progress) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.70)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 440, padding: '28px 30px',
        background: 'rgba(15,25,50,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          Installation en cours…
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          {progress.step}
        </p>
        <div style={{
          height: 8, background: 'rgba(255,255,255,0.08)',
          borderRadius: 99, overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            height: '100%',
            width: `${progress.percent}%`,
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {progress.current} / {progress.total}
          </span>
          <span style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>
            {Math.round(progress.percent)}%
          </span>
        </div>
      </div>
    </div>
  )
}


function CreateInstanceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, mcVersion: string, loader: LoaderType, loaderVersion: string | null) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [selectedVersion, setSelectedVersion]           = useState<McVersion | null>(null)
  const [selectedLoader, setSelectedLoader]             = useState<LoaderType>('vanilla')
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string | null>(null)
  const [mcVersions, setMcVersions]                     = useState<McVersion[]>([])
  const [loaderVersions, setLoaderVersions]             = useState<LoaderVersion[]>([])
  const [loadingVersions, setLoadingVersions]           = useState(false)
  const [loadingLoader, setLoadingLoader]               = useState(false)
  const [error, setError]                               = useState<string | null>(null)
  const [creating, setCreating]                         = useState(false)
  const [showSnapshots, setShowSnapshots]               = useState(false)
  const [versionFilter, setVersionFilter]               = useState('')

  useEffect(() => {
    setLoadingVersions(true)
    invoke<McVersion[]>('fetch_mc_versions')
      .then(v => setMcVersions(v))
      .catch(e => setError(String(e)))
      .finally(() => setLoadingVersions(false))
  }, [])

  const loadLoaderVersions = async (loader: LoaderType, mcVersion: string) => {
    if (loader === 'vanilla') { setLoaderVersions([]); return }
    setLoadingLoader(true)
    try {
      let versions: LoaderVersion[] = []
      if (loader === 'fabric')   versions = await invoke('fetch_fabric_versions')
      if (loader === 'neoforge') versions = await invoke('fetch_neoforge_versions')
      if (loader === 'forge')    versions = await invoke('fetch_forge_versions', { mcVersion })
      if (loader === 'quilt')    versions = await invoke('fetch_fabric_versions')
      setLoaderVersions(versions)
      setSelectedLoaderVersion(versions[0]?.version ?? null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingLoader(false)
    }
  }

  const handleNext = async () => {
    if (step === 0 && !selectedVersion) { setError('Sélectionne une version.'); return }
    if (step === 1) await loadLoaderVersions(selectedLoader, selectedVersion!.id)
    setError(null)
    setStep(s => s + 1)
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError("Entre un nom pour l'instance."); return }
    setCreating(true)
    try {
      await onCreate(
        name.trim(),
        selectedVersion!.id,
        selectedLoader,
        selectedLoader === 'vanilla' ? null : selectedLoaderVersion,
      )
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const filteredVersions = mcVersions.filter(v => {
    if (!showSnapshots && v.version_type !== 'release') return false
    if (versionFilter && !v.id.includes(versionFilter)) return false
    return true
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 560, maxHeight: '85vh',
        background: 'rgba(15,25,50,0.96)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        overflow: 'hidden',
      }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Créer une instance
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              {step === 0 ? 'Étape 1 — Version du jeu'
                : step === 1 ? 'Étape 2 — Mod loader'
                : 'Étape 3 — Paramètres de base'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: i === step ? 20 : 8, height: 8, borderRadius: 99,
                background: i === step ? 'var(--primary)'
                  : i < step ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.25s',
              }} />
            ))}
            <button onClick={onClose} style={{
              marginLeft: 10, background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-faint)', padding: 4,
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 13px', borderRadius: 9, marginBottom: 14,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5', fontSize: 12.5,
            }}>
              <AlertCircle size={14} /><span>{error}</span>
            </div>
          )}

          {step === 0 && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  placeholder="Filtrer les versions…"
                  value={versionFilter}
                  onChange={e => setVersionFilter(e.target.value)}
                  style={{ flex: 1, padding: '7px 11px', fontSize: 12.5 }}
                />
                <button onClick={() => setShowSnapshots(s => !s)} style={{
                  padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 500,
                  border: `1px solid ${showSnapshots ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.10)'}`,
                  background: showSnapshots ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                  color: showSnapshots ? '#60a5fa' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}>
                  Snapshots
                </button>
              </div>

              {loadingVersions ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10 }}>
                  <Loader2 size={16} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement des versions…</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 340, overflowY: 'auto' }}>
                  {filteredVersions.map(v => (
                    <button key={v.id} onClick={() => { setSelectedVersion(v); setError(null) }} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 12px', borderRadius: 10,
                      border: `1px solid ${selectedVersion?.id === v.id ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.07)'}`,
                      background: selectedVersion?.id === v.id ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                      transition: 'all 0.12s', textAlign: 'left', width: '100%',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: v.version_type === 'release' ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Package size={14}
                          color={v.version_type === 'release' ? '#4ade80' : '#fbbf24'}
                          strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                          {v.id}
                        </span>
                        <span style={{
                          marginLeft: 8, fontSize: 11,
                          color: v.version_type === 'release' ? '#4ade80' : '#fbbf24',
                        }}>
                          {v.version_type === 'release' ? 'Stable' : v.version_type}
                        </span>
                      </div>
                      {selectedVersion?.id === v.id && <Check size={14} color="#60a5fa" />}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Version sélectionnée : <strong style={{ color: 'var(--text-main)' }}>{selectedVersion?.id}</strong>
              </p>
              {LOADERS.map(loader => (
                <button key={loader.id} onClick={() => { setSelectedLoader(loader.id); setError(null) }} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 16px', borderRadius: 12,
                  border: `1px solid ${selectedLoader === loader.id ? `${loader.color}55` : 'rgba(255,255,255,0.08)'}`,
                  background: selectedLoader === loader.id ? `${loader.color}18` : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                  transition: 'all 0.15s', textAlign: 'left', width: '100%',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${loader.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: loader.color, fontFamily: 'monospace',
                  }}>
                    {loader.label[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{loader.label}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
                      {loader.id === 'vanilla'}
                      {loader.id === 'fabric'}
                      {loader.id === 'forge'}
                      {loader.id === 'neoforge'}
                      {loader.id === 'quilt'}
                    </p>
                  </div>
                  {selectedLoader === loader.id && <Check size={15} color={loader.color} />}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: '12px 14px', borderRadius: 11,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', gap: 16,
              }}>
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Version</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>{selectedVersion?.id}</p>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Loader</p>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: LOADER_COLOR[selectedLoader] }}>
                    {LOADERS.find(l => l.id === selectedLoader)?.label}
                  </p>
                </div>
              </div>

              <div>
                <label style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  display: 'block', marginBottom: 7,
                }}>
                  Nom de l'instance
                </label>
                <input
                  className="input"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder={`${selectedVersion?.id} ${LOADERS.find(l => l.id === selectedLoader)?.label}`}
                  maxLength={64}
                  autoFocus
                />
              </div>

              {selectedLoader !== 'vanilla' && loaderVersions.length > 0 && (
                <div>
                  <label style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    display: 'block', marginBottom: 7,
                  }}>
                    Version de {LOADERS.find(l => l.id === selectedLoader)?.label}
                  </label>
                  {loadingLoader ? (
                    <Loader2 size={14} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <select
                        value={selectedLoaderVersion ?? ''}
                        onChange={e => setSelectedLoaderVersion(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 32px 8px 12px',
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10, color: 'var(--text-main)',
                          fontSize: 13, fontFamily: 'inherit',
                          appearance: 'none', outline: 'none', cursor: 'pointer',
                        }}
                      >
                        {loaderVersions.map(v => (
                          <option key={v.version} value={v.version} style={{ background: '#1e2a4a' }}>
                            {v.version}{v.stable ? '' : ' (unstable)'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} color="var(--text-faint)" style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)', pointerEvents: 'none',
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <button onClick={() => step === 0 ? onClose() : setStep(s => s - 1)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
          }}>
            {step === 0 ? <X size={14} /> : <ChevronLeft size={14} />}
            {step === 0 ? 'Annuler' : 'Retour'}
          </button>

          {step < 2 ? (
            <button onClick={handleNext} disabled={step === 0 && !selectedVersion}
                    className="btn-primary" style={{ padding: '8px 20px' }}>
              Suivant <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={creating || !name.trim()}
                    className="btn-primary" style={{ padding: '8px 20px' }}>
              {creating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {creating ? 'Création…' : "Créer l'instance"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


function InstanceCard({ instance, onDelete, onLaunch, onStop, launching, isRunning }: {
  instance: Instance
  onDelete: () => void
  onLaunch: (id: string) => void
  onStop: (id: string) => void
  launching: boolean
  isRunning: boolean
}) {
  const [showStopConfirm, setShowStopConfirm]     = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const loaderColor = LOADER_COLOR[instance.loader]
  const loaderLabel = LOADERS.find(l => l.id === instance.loader)?.label ?? instance.loader

  return (
    <>
      {showStopConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.70)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 380, padding: '24px 26px',
            background: 'rgba(15,25,50,0.97)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 16,
            boxShadow: '0 24px 60px rgba(0,0,0,0.60)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <AlertCircle size={24} color="#f87171" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
              Forcer l'arrêt de l'instance ?
            </p>
            <p style={{
              fontSize: 12, color: '#f87171', marginBottom: 22,
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.20)',
              lineHeight: 1.5,
            }}>
              ⚠️ Les données non sauvegardées seront perdues. Assure-toi d'avoir sauvegardé ta partie.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowStopConfirm(false)} style={{
                flex: 1, padding: '9px', borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}>
                Annuler
              </button>
              <button onClick={() => { onStop(instance.id); setShowStopConfirm(false) }} style={{
                flex: 1, padding: '9px', borderRadius: 10,
                background: 'rgba(239,68,68,0.80)',
                border: '1px solid rgba(239,68,68,0.50)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Square size={13} fill="currentColor" strokeWidth={0} />
                Forcer l'arrêt
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.70)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 400, padding: '24px 26px',
            background: 'rgba(15,25,50,0.97)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 16,
            boxShadow: '0 24px 60px rgba(0,0,0,0.60)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Trash2 size={22} color="#f87171" />
            </div>

            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
              Supprimer "{instance.name}" ?
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              Cette action est irréversible. Le dossier de l'instance et tout son contenu
              (mondes, mods, configs) seront définitivement supprimés.
            </p>

            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: `${loaderColor}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: loaderColor, fontFamily: 'monospace',
              }}>
                {instance.name[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  {instance.name}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  {instance.mc_version} · {loaderLabel}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                flex: 1, padding: '9px', borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}>
                Annuler
              </button>
              <button onClick={() => { onDelete(); setShowDeleteConfirm(false) }} style={{
                flex: 1, padding: '9px', borderRadius: 10,
                background: 'rgba(239,68,68,0.75)',
                border: '1px solid rgba(239,68,68,0.40)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Trash2 size={13} />
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 14px', borderRadius: 12,
        background: isRunning ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isRunning ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.15s',
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: `${loaderColor}18`,
            border: `1px solid ${loaderColor}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: loaderColor, fontFamily: 'monospace',
          }}>
            {instance.name[0].toUpperCase()}
          </div>
          {isRunning && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid rgba(15,25,50,0.97)',
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {instance.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 11.5, color: 'var(--text-faint)',
              background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 5,
            }}>
              {instance.mc_version}
            </span>
            <span style={{ fontSize: 11.5, color: loaderColor, fontWeight: 600 }}>
              {loaderLabel}
            </span>
            {isRunning && (
              <span style={{
                fontSize: 11, color: '#4ade80', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#22c55e',
                  animation: 'pulse 2s infinite',
                }} />
                En cours
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRunning ? (
            <button onClick={() => setShowStopConfirm(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.25)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.55)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'
            }}
            >
              <Square size={12} fill="currentColor" strokeWidth={0} />
              Stop
            </button>
          ) : (
            <button className="btn-primary"
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9 }}
              onClick={() => onLaunch(instance.id)}
              disabled={launching}
            >
              {launching
                ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={12} fill="currentColor" strokeWidth={0} />
              }
              {launching ? 'Lancement…' : 'Lancer'}
            </button>
          )}

          <button
            onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true) }}
            disabled={isRunning}
            style={{
              padding: '7px', borderRadius: 9,
              background: 'transparent', border: '1px solid transparent',
              color: isRunning ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.45)',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              outline: 'none', display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!isRunning) {
                e.currentTarget.style.background = 'rgba(239,68,68,0.10)'
                e.currentTarget.style.color = 'rgba(239,68,68,0.80)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = isRunning ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.45)'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  )
}


export default function Instances() {
  const { instances, runningIds, createInstance, deleteInstance, stopInstance, reload } = useInstances()
  const [showModal, setShowModal] = useState(false)
  const [progress, setProgress]   = useState<Progress | null>(null)
  const [launching, setLaunching] = useState<string | null>(null)

  useEffect(() => {
    const unlisten = listen<Progress>('launcher://progress', ({ payload }) => {
      setProgress(payload)
      if (payload.percent >= 100) {
        setTimeout(() => setProgress(null), 1500)
      }
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  const handleCreate = async (
    name: string,
    mcVersion: string,
    loader: LoaderType,
    loaderVersion: string | null,
  ) => {
    await createInstance(name, mcVersion, loader, loaderVersion)
  }

  const handleLaunch = async (instanceId: string) => {
    setLaunching(instanceId)
    try {
      await invoke('launch_instance_cmd', { instanceId })
    } catch (e) {
      alert(String(e))
    } finally {
      setLaunching(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {showModal && (
        <CreateInstanceModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
      <ProgressOverlay progress={progress} />

      <aside style={{
        width: 185, flexShrink: 0,
        borderRadius: 12, margin: '10px 0 10px 10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        padding: '8px 6px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 11px', width: '100%', textAlign: 'left',
          borderRadius: 9, border: '1px solid rgba(59,130,246,0.25)',
          background: 'rgba(59,130,246,0.18)',
          color: '#93c5fd', fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
        }}>
          <LayoutGrid size={13} strokeWidth={2.2} />
          Toutes les instances
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12 }}>
          <FolderPlus size={13} strokeWidth={2} />
          Ajouter un groupe
        </button>
      </aside>

      <div style={{
        flex: 1, minWidth: 0, margin: '10px 10px 10px 8px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
            Toutes les instances
            {instances.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, color: 'var(--text-faint)',
                background: 'rgba(255,255,255,0.08)',
                padding: '1px 7px', borderRadius: 5,
              }}>
                {instances.length}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="btn-ghost" style={{ padding: '5px 7px' }} onClick={reload}>
              <RefreshCw size={13} strokeWidth={2} />
            </button>
            <button className="btn-ghost" style={{ padding: '5px 7px' }}>
              <SlidersHorizontal size={13} strokeWidth={2} />
            </button>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.10)', margin: '0 6px' }} />
            <button
              className="btn-primary"
              style={{ padding: '5px 13px', fontSize: 12, borderRadius: 9 }}
              onClick={() => setShowModal(true)}
            >
              <Plus size={12} /> Ajouter et importer
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {instances.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: 15,
                background: 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Layers size={22} color="rgba(255,255,255,0.20)" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.30)' }}>
                Aucune instance
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>
                Clique sur "Ajouter et importer" pour commencer
              </p>
              <button
                className="btn-primary"
                style={{ marginTop: 6, padding: '8px 20px', fontSize: 13 }}
                onClick={() => setShowModal(true)}
              >
                <Plus size={14} /> Créer une instance
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {instances.map(instance => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  onDelete={() => deleteInstance(instance.id)}
                  onLaunch={handleLaunch}
                  onStop={stopInstance}
                  launching={launching === instance.id}
                  isRunning={runningIds.has(instance.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}