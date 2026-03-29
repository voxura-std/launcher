import { useState } from 'react'
import {
  Plus, RefreshCw, SlidersHorizontal, LayoutGrid,
  List, Layers, FolderPlus, Trash2, Play,
  ChevronDown, ChevronLeft, ChevronRight, X, Check,
  Loader2, AlertCircle, Package
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useInstances, type Instance, type McVersion, type LoaderVersion } from '../hooks/useInstances'

// ─── Types locaux ─────────────────────────────────────

type LoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'

const LOADERS: { id: LoaderType; label: string; color: string }[] = [
  { id: 'vanilla',  label: 'Vanilla',  color: '#6b7280' },
  { id: 'fabric',   label: 'Fabric',   color: '#b5c3d4' },
  { id: 'forge',    label: 'Forge',    color: '#e8a44a' },
  { id: 'neoforge', label: 'NeoForge', color: '#e86c1f' },
  { id: 'quilt',    label: 'Quilt',    color: '#9f5ece' },
]

const LOADER_COLOR: Record<LoaderType, string> = {
  vanilla:  '#6b7280',
  fabric:   '#b5c3d4',
  forge:    '#e8a44a',
  neoforge: '#e86c1f',
  quilt:    '#9f5ece',
}

// ─── Composant modal création ─────────────────────────

function CreateInstanceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, mcVersion: string, loader: LoaderType, loaderVersion: string | null) => Promise<void>
}) {
  // Étapes : 0 = version MC, 1 = loader, 2 = paramètres de base
  const [step, setStep] = useState(0)

  const [name, setName]                   = useState('')
  const [selectedVersion, setSelectedVersion] = useState<McVersion | null>(null)
  const [selectedLoader, setSelectedLoader]   = useState<LoaderType>('vanilla')
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string | null>(null)

  const [mcVersions, setMcVersions]       = useState<McVersion[]>([])
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([])

  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingLoader, setLoadingLoader]     = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [creating, setCreating]               = useState(false)

  // Filtres
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [versionFilter, setVersionFilter] = useState('')

  // Charge les versions MC au montage
  useState(() => {
    setLoadingVersions(true)
    invoke<McVersion[]>('fetch_mc_versions')
      .then(v => setMcVersions(v))
      .catch(e => setError(String(e)))
      .finally(() => setLoadingVersions(false))
  })

  // Charge les versions du loader sélectionné
  const loadLoaderVersions = async (loader: LoaderType, mcVersion: string) => {
    if (loader === 'vanilla') { setLoaderVersions([]); return }
    setLoadingLoader(true)
    try {
      let versions: LoaderVersion[] = []
      if (loader === 'fabric')   versions = await invoke('fetch_fabric_versions')
      if (loader === 'neoforge') versions = await invoke('fetch_neoforge_versions')
      if (loader === 'forge')    versions = await invoke('fetch_forge_versions', { mcVersion })
      if (loader === 'quilt')    versions = await invoke('fetch_fabric_versions') // API similaire
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
    if (step === 1) {
      await loadLoaderVersions(selectedLoader, selectedVersion!.id)
    }
    setError(null)
    setStep(s => s + 1)
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError('Entre un nom pour l\'instance.'); return }
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
    // Overlay
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Modal */}
      <div style={{
        width: 560, maxHeight: '85vh',
        background: 'rgba(15,25,50,0.96)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        overflow: 'hidden',
      }}>

        {/* Header */}
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

          {/* Indicateur d'étapes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: i === step ? 20 : 8, height: 8,
                borderRadius: 99,
                background: i === step
                  ? 'var(--primary)'
                  : i < step ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.25s',
              }} />
            ))}
            <button onClick={onClose} style={{
              marginLeft: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-faint)', padding: 4,
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 13px', borderRadius: 9, marginBottom: 14,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5', fontSize: 12.5,
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Étape 0 : version MC ── */}
          {step === 0 && (
            <>
              {/* Filtres */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  placeholder="Filtrer les versions…"
                  value={versionFilter}
                  onChange={e => setVersionFilter(e.target.value)}
                  style={{ flex: 1, padding: '7px 11px', fontSize: 12.5 }}
                />
                <button
                  onClick={() => setShowSnapshots(s => !s)}
                  style={{
                    padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 500,
                    border: `1px solid ${showSnapshots ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.10)'}`,
                    background: showSnapshots ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                    color: showSnapshots ? '#60a5fa' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}
                >
                  Snapshots
                </button>
              </div>

              {/* Liste des versions */}
              {loadingVersions ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10 }}>
                  <Loader2 size={16} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement des versions…</span>
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  maxHeight: 340, overflowY: 'auto',
                }}>
                  {filteredVersions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVersion(v); setError(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '9px 12px', borderRadius: 10,
                        border: `1px solid ${selectedVersion?.id === v.id ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.07)'}`,
                        background: selectedVersion?.id === v.id ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                        transition: 'all 0.12s', textAlign: 'left', width: '100%',
                      }}
                    >
                      {/* Icône type */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: v.version_type === 'release'
                          ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.12)',
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
                          textTransform: 'capitalize',
                        }}>
                          {v.version_type === 'release' ? 'Stable' : v.version_type}
                        </span>
                      </div>

                      {selectedVersion?.id === v.id && (
                        <Check size={14} color="#60a5fa" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Étape 1 : loader ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Version sélectionnée : <strong style={{ color: 'var(--text-main)' }}>{selectedVersion?.id}</strong>
              </p>

              {LOADERS.map(loader => (
                <button
                  key={loader.id}
                  onClick={() => { setSelectedLoader(loader.id); setError(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px', borderRadius: 12,
                    border: `1px solid ${selectedLoader === loader.id
                      ? `${loader.color}55` : 'rgba(255,255,255,0.08)'}`,
                    background: selectedLoader === loader.id
                      ? `${loader.color}18` : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                    transition: 'all 0.15s', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${loader.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: loader.color,
                    fontFamily: 'monospace',
                  }}>
                    {loader.label[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                      {loader.label}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
                      {loader.id === 'vanilla'  && 'Aucun mod loader — Minecraft pur'}
                      {loader.id === 'fabric'   && 'Léger et performant — recommandé'}
                      {loader.id === 'forge'    && 'Le plus de mods disponibles'}
                      {loader.id === 'neoforge' && 'Fork moderne de Forge'}
                      {loader.id === 'quilt'    && 'Fork de Fabric avec plus de fonctionnalités'}
                    </p>
                  </div>
                  {selectedLoader === loader.id && (
                    <Check size={15} color={loader.color} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Étape 2 : paramètres ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Résumé */}
              <div style={{
                padding: '12px 14px', borderRadius: 11,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', gap: 16,
              }}>
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Version
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                    {selectedVersion?.id}
                  </p>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Loader
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2,
                               color: LOADER_COLOR[selectedLoader] }}>
                    {LOADERS.find(l => l.id === selectedLoader)?.label}
                  </p>
                </div>
                {selectedLoader !== 'vanilla' && selectedLoaderVersion && (
                  <>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <div>
                      <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Version loader
                      </p>
                      {loadingLoader ? (
                        <Loader2 size={12} color="#60a5fa"
                          style={{ animation: 'spin 1s linear infinite', marginTop: 4 }} />
                      ) : (
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                          {selectedLoaderVersion}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Nom de l'instance */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>
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

              {/* Version loader (si applicable) */}
              {selectedLoader !== 'vanilla' && loaderVersions.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                                  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>
                    Version de {LOADERS.find(l => l.id === selectedLoader)?.label}
                  </label>
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
                        <option key={v.version} value={v.version}
                                style={{ background: '#1e2a4a' }}>
                          {v.version}{v.stable ? '' : ' (unstable)'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} color="var(--text-faint)"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
            }}
          >
            {step === 0 ? <X size={14} /> : <ChevronLeft size={14} />}
            {step === 0 ? 'Annuler' : 'Retour'}
          </button>

          {step < 2 ? (
            <button
              onClick={handleNext}
              disabled={step === 0 && !selectedVersion}
              className="btn-primary"
              style={{ padding: '8px 20px' }}
            >
              Suivant
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="btn-primary"
              style={{ padding: '8px 20px' }}
            >
              {creating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {creating ? 'Création…' : 'Créer l\'instance'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Composant carte d'instance ───────────────────────

function InstanceCard({
  instance,
  onDelete,
}: {
  instance: Instance
  onDelete: () => void
}) {
  const loaderColor = LOADER_COLOR[instance.loader]
  const loaderLabel = LOADERS.find(l => l.id === instance.loader)?.label ?? instance.loader

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
    }}
    >
      {/* Icône */}
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: `${loaderColor}18`,
        border: `1px solid ${loaderColor}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: loaderColor, fontFamily: 'monospace',
      }}>
        {instance.name[0].toUpperCase()}
      </div>

      {/* Infos */}
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
            background: 'rgba(255,255,255,0.06)',
            padding: '1px 7px', borderRadius: 5,
          }}>
            {instance.mc_version}
          </span>
          <span style={{ fontSize: 11.5, color: loaderColor, fontWeight: 600 }}>
            {loaderLabel}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9 }}>
          <Play size={12} fill="currentColor" strokeWidth={0} />
          Lancer
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            padding: '7px', borderRadius: 9,
            background: 'transparent', border: '1px solid transparent',
            color: 'rgba(239,68,68,0.45)', cursor: 'pointer', outline: 'none',
            display: 'flex', alignItems: 'center', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.10)'
            e.currentTarget.style.color = 'rgba(239,68,68,0.80)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(239,68,68,0.45)'
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────

export default function Instances() {
  const { instances, createInstance, deleteInstance, reload } = useInstances()
  const [showModal, setShowModal] = useState(false)

  const handleCreate = async (
    name: string,
    mcVersion: string,
    loader: LoaderType,
    loaderVersion: string | null,
  ) => {
    await createInstance(name, mcVersion, loader, loaderVersion)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {showModal && (
        <CreateInstanceModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 185, flexShrink: 0,
        borderRadius: 12, margin: '10px 0 10px 10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        padding: '8px 6px',
        display: 'flex', flexDirection: 'column', gap: 2,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
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

        <button className="btn-ghost" style={{
          width: '100%', justifyContent: 'flex-start', fontSize: 12,
        }}>
          <FolderPlus size={13} strokeWidth={2} />
          Ajouter un groupe
        </button>
      </aside>

      {/* Contenu principal */}
      <div style={{
        flex: 1, minWidth: 0, margin: '10px 10px 10px 8px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
            Toutes les instances
            {instances.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-faint)',
                             background: 'rgba(255,255,255,0.08)',
                             padding: '1px 7px', borderRadius: 5 }}>
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

        {/* Liste ou état vide */}
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}