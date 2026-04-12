import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Play, Square, Trash2, Settings,
  Puzzle, Image, Palette, Save, AlertCircle,
  Loader2, FolderOpen, Clock,
  Cpu, MemoryStick, Info, Terminal
} from 'lucide-react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useInstances } from '../hooks/useInstances'
import { useOffline } from '../hooks/useOffline'
import ModsManager from '../components/ModsManager'

type Tab = 'overview' | 'mods' | 'resourcepacks' | 'shaders' | 'settings' | 'logs'
const LOADER_COLOR: Record<string, string> = {
  vanilla:  '#6b7280',
  fabric:   '#b5c3d4',
  forge:    '#e8a44a',
  neoforge: '#e86c1f',
  quilt:    '#9f5ece',
}


export default function InstanceDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { instances, updateInstance, deleteInstance, runningIds, stopInstance } = useInstances()
  const offline = useOffline()

  const instance  = instances.find(i => i.id === id)
  const isRunning = id ? runningIds.has(id) : false
  const [tab, setTab]           = useState<Tab>('overview')
  const [launching, setLaunching] = useState(false)
  
  const TABS: { id: Tab; icon: any; label: string }[] = [
    { id: 'overview',      icon: Info,       label: 'Vue d\'ensemble' },
    ...(instance?.loader !== 'vanilla' ? [{ id: 'mods' as Tab, icon: Puzzle, label: 'Mods' }] : []),
    { id: 'resourcepacks', icon: Image,      label: 'Resource Packs'  },
    ...(instance?.loader !== 'vanilla' ? [{ id: 'shaders' as Tab, icon: Palette, label: 'Shaders' }] : []),
    { id: 'settings',      icon: Settings,   label: 'Paramètres'      },
    { id: 'logs',          icon: Terminal,   label: 'Logs'            },
  ]

  const [error, setError]       = useState<string | null>(null)
  const [saved, setSaved]       = useState(false)
  const [showStopConfirm, setShowStopConfirm]     = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [editName, setEditName]       = useState('')
  const [editRam, setEditRam]         = useState(2048)
  const [editJavaArgs, setEditJavaArgs] = useState('')

  const [logs, setLogs] = useState<{ type: string, line: string }[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (instance) {
      setEditName(instance.name)
      setEditRam(instance.ram_mb)
      setEditJavaArgs(instance.java_args ?? '')
    }
  }, [instance])

  useEffect(() => {
    let unlisten: () => void
    listen('launcher://game-log', (event: any) => {
        console.log("LOG EVENT:", event)
        if (event.payload.instance_id === id) {
            setLogs(prev => {
                const newLogs = [...prev, { type: event.payload.log_type, line: event.payload.line }]
                if (newLogs.length > 500) newLogs.shift()
                return newLogs
            })
        }
    }).then(f => unlisten = f)

    return () => {
        if (unlisten) unlisten()
    }
  }, [id])

  useEffect(() => {
      if (tab === 'logs' && logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
  }, [logs, tab])

  const handleLaunch = async () => {
    if (!id) return
    setLaunching(true)
    setError(null)
    try {
      await invoke('launch_instance_cmd', { instanceId: id })
    } catch (e) {
      setError(String(e))
    } finally {
      setLaunching(false)
    }
  }

  const handleSave = async () => {
    if (!instance) return
    try {
      await updateInstance({
        ...instance,
        name:      editName.trim() || instance.name,
        ram_mb:    editRam,
        java_args: editJavaArgs.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await deleteInstance(id)
      navigate('/instances')
    } catch (e) {
      setError(String(e))
    }
  }

  if (!instance) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 12,
      }}>
        <p style={{ fontSize: 14, color: 'var(--text-faint)' }}>Instance introuvable</p>
        <button className="btn-primary" onClick={() => navigate('/instances')}>
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    )
  }

  const loaderColor = LOADER_COLOR[instance.loader] ?? '#6b7280'
  const loaderLabel = instance.loader.charAt(0).toUpperCase() + instance.loader.slice(1)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {showStopConfirm && (
        <ConfirmModal
          title="Forcer l'arrêt ?"
          message="Le processus Java sera terminé immédiatement."
          warning="⚠️ Les données non sauvegardées seront perdues."
          confirmLabel="Forcer l'arrêt"
          confirmColor="rgba(239,68,68,0.80)"
          onCancel={() => setShowStopConfirm(false)}
          onConfirm={() => { stopInstance(instance.id); setShowStopConfirm(false) }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title={`Supprimer "${instance.name}" ?`}
          message="Le dossier de l'instance et tout son contenu seront définitivement supprimés."
          warning="⚠️ Cette action est irréversible."
          confirmLabel="Supprimer définitivement"
          confirmColor="rgba(239,68,68,0.75)"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <button onClick={() => navigate('/instances')} className="btn-ghost"
                style={{ padding: '6px 8px' }}>
          <ArrowLeft size={16} />
        </button>

        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${loaderColor}18`,
          border: `1px solid ${loaderColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: loaderColor, fontFamily: 'monospace',
          position: 'relative', overflow: 'hidden'
        }}>
          {instance.icon_path ? (
              <img src={convertFileSrc(instance.icon_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
              <span>{instance.name.charAt(0).toUpperCase()}</span>
          )}
          {isRunning && (
            <div style={{
              position: 'absolute', bottom: -3, right: -3,
              width: 12, height: 12, borderRadius: '50%',
              background: '#22c55e', border: '2px solid rgba(15, 30, 22,0.97)',
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
            {instance.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 11, color: 'var(--text-faint)',
              background: 'rgba(255,255,255,0.07)',
              padding: '1px 8px', borderRadius: 5,
            }}>
              {instance.mc_version}
            </span>
            <span style={{ fontSize: 11.5, color: loaderColor, fontWeight: 600 }}>
              {loaderLabel}
            </span>
            {instance.loader_version && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {instance.loader_version}
              </span>
            )}
            {isRunning && (
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600,
                             display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                               background: '#22c55e', animation: 'pulse 2s infinite' }} />
                En cours
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isRunning ? (
            <button onClick={() => setShowStopConfirm(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
            }}>
              <Square size={13} fill="currentColor" strokeWidth={0} /> Stop
            </button>
          ) : (
            <button className="btn-primary"
              style={{ padding: '8px 18px', fontSize: 13 }}
              onClick={handleLaunch} disabled={launching}
            >
              {launching
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={14} fill="currentColor" strokeWidth={0} />
              }
              {launching ? 'Lancement…' : 'Lancer'}
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(239,68,68,0.55)', cursor: 'pointer', outline: 'none',
              display: 'flex', alignItems: 'center',
            }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          margin: '10px 18px 0',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', borderRadius: 9,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#fca5a5', fontSize: 12.5, flexShrink: 0,
        }}>
          <AlertCircle size={14} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 2,
          }}>✕</button>
        </div>
      )}

      <div style={{
        display: 'flex', gap: 2, padding: '10px 18px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {TABS.map(({ id: tabId, icon: Icon, label }) => (
          <button key={tabId} onClick={() => setTab(tabId)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: '9px 9px 0 0',
            border: 'none', outline: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
            transition: 'all 0.15s',
            background: tab === tabId ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === tabId ? 'var(--text-main)' : 'var(--text-faint)',
            borderBottom: tab === tabId ? '2px solid var(--primary)' : '2px solid transparent',
          }}>
            <Icon size={13} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>

        {tab === 'overview' && (
          <div style={{ padding: '18px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 600 }}>

              <StatCard icon={<Cpu size={16} color="#4ade80" />} label="Version Minecraft"
                        value={instance.mc_version} />
              <StatCard icon={<Puzzle size={16} color={loaderColor} />} label="Mod Loader"
                        value={`${loaderLabel}${instance.loader_version ? ` ${instance.loader_version}` : ''}`} />
              <StatCard icon={<MemoryStick size={16} color="#a78bfa" />} label="RAM allouée"
                        value={`${instance.ram_mb} Mo`} />
              <StatCard icon={<Clock size={16} color="#34d399" />} label="Temps de jeu"
                        value={formatPlayTime(instance.play_time)} />
              <StatCard icon={<FolderOpen size={16} color="#fbbf24" />} label="Dossier"
                        value={instance.folder_name} mono />
              <StatCard icon={<Clock size={16} color="var(--text-faint)" />} label="Créée le"
                        value={new Date(instance.created_at * 1000).toLocaleDateString('fr-FR')} />
            </div>
          </div>
        )}

        {tab === 'mods' && instance.loader !== 'vanilla' && (
          <ModsManager instance={instance!} type="mods" offline={offline} isRunning={isRunning} />
        )}

        {tab === 'resourcepacks' && (
          <ModsManager instance={instance!} type="resourcepacks" offline={offline} isRunning={isRunning} />
        )}

        {tab === 'shaders' && instance.loader !== 'vanilla' && (
          <ModsManager instance={instance!} type="shaders" offline={offline} isRunning={isRunning} />
        )}

        {tab === 'settings' && (
          <div style={{ padding: '18px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 600 }}>

              <SettingSection label="Nom de l'instance">
                <input type="text" className="input-text"
                       value={editName} onChange={e => setEditName(e.target.value)}
                       placeholder="Nom de l'instance" maxLength={64} />
              </SettingSection>

              <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
                Apparence
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {instance.icon_path ? (
                     <img src={convertFileSrc(instance.icon_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                     <Image size={24} color="var(--text-muted)" />
                  )}
                </div>
                <div>
                   <button onClick={async () => {
                      try {
                         const newPath = await invoke<string>('select_custom_icon', { instanceId: instance.id })
                         updateInstance({ ...instance, icon_path: newPath })
                      } catch(e) {
                         console.error(e)
                      }
                   }} style={{
                      padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500
                   }}>
                      Changer l'icône
                   </button>
                   <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-faint)' }}>Formats: PNG, JPG, WEBP</p>
                </div>
              </div>
            </div>

              <SettingSection label="RAM allouée"
                              hint={`${editRam} Mo — recommandé : 2048–4096 Mo`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range" min={512} max={16384} step={256}
                    value={editRam}
                    onChange={e => setEditRam(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary)' }}
                  />
                  <div style={{
                    minWidth: 70, padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
                    textAlign: 'center',
                  }}>
                    {editRam} Mo
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[1024, 2048, 4096, 8192].map(v => (
                    <button key={v} onClick={() => setEditRam(v)} style={{
                      padding: '4px 12px', borderRadius: 7, fontSize: 12,
                      border: `1px solid ${editRam === v ? 'rgba(74,222,128,0.40)' : 'rgba(255,255,255,0.10)'}`,
                      background: editRam === v ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                      color: editRam === v ? '#4ade80' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                    }}>
                      {v >= 1024 ? `${v / 1024}G` : `${v}M`}
                    </button>
                  ))}
                </div>
              </SettingSection>

              <SettingSection label="Arguments JVM"
                              hint="Arguments supplémentaires passés à Java (avancé)">
                <input className="input" value={editJavaArgs}
                       onChange={e => setEditJavaArgs(e.target.value)}
                       placeholder="-XX:+UseZGC -Dfml.readTimeout=180" />
              </SettingSection>

              <button className="btn-primary"
                onClick={handleSave}
                style={{ alignSelf: 'flex-start', padding: '9px 22px' }}
              >
                {saved
                  ? <><span>✓</span> Sauvegardé !</>
                  : <><Save size={14} /> Sauvegarder</>
                }
              </button>
            </div>
          </div>
        )}

        {tab === 'logs' && (
           <div style={{ height: '100%', background: '#0a0a0a', padding: '14px 18px', overflowY: 'auto', boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.5 }}>
              {logs.length === 0 ? (
                 <div style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>En attente de logs...</div>
              ) : (
                 logs.map((log, i) => {
                    let color = '#d4d4d8';
                    if (log.type === 'stderr' || log.line.includes('ERROR') || log.line.includes('FATAL') || log.line.includes('Exception')) color = '#fca5a5';
                    else if (log.line.includes('WARN')) color = '#fcd34d';
                    else if (log.line.includes('INFO')) color = '#6ee7b7';

                    return (
                       <div key={i} style={{ color, wordBreak: 'break-all', marginBottom: 2 }}>{log.line}</div>
                    )
                 })
              )}
              <div ref={logsEndRef} />
           </div>
        )}
      </div>
    </div>
  )
}


function StatCard({ icon, label, value, mono = false }: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
                       textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)',
        fontFamily: mono ? 'monospace' : 'inherit',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </p>
    </div>
  )
}

function SettingSection({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        display: 'block', marginBottom: hint ? 4 : 8,
      }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 8 }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  )
}


function ConfirmModal({ title, message, warning, confirmLabel, confirmColor, onCancel, onConfirm }: {
  title: string; message: string; warning: string
  confirmLabel: string; confirmColor: string
  onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.70)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 380, padding: '24px 26px',
        background: 'rgba(15, 30, 22,0.97)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.60)',
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13,
          background: 'rgba(239,68,68,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <AlertCircle size={22} color="#f87171" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
          {title}
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
          {message}
        </p>
        <p style={{
          fontSize: 12, color: '#f87171', marginBottom: 20,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
          lineHeight: 1.5,
        }}>
          {warning}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit', outline: 'none',
          }}>Annuler</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer',
            background: confirmColor, border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', outline: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function formatPlayTime(seconds: number): string {
  if (seconds < 60) return 'Jamais joué'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h}h ${m}min`
}