import { useState } from 'react'
import { Monitor, Cpu, Settings as SettingsIcon, Info, Heart, ExternalLink, RefreshCw, ChevronDown } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'

export default function Settings() {
  const { settings, updateSettings, ready } = useSettings()
  const [behaviorOpen, setBehaviorOpen] = useState(false)

  const behaviorLabels: Record<string, string> = {
    'keep_open': 'Garder le launcher ouvert',
    'close': 'Fermer le launcher au démarrage',
    'close_game': 'Fermer le jeu si launcher fermé'
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Chargement des paramètres...
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '24px 34px', boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
         <SettingsIcon size={24} /> Paramètres
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 680 }}>
        
        <section>
           <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={18} color="var(--primary)" /> Général
           </h2>

           <div className="card" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Comportement au démarrage</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Que doit faire le launcher quand le jeu démarre ?</p>
                 </div>
                 <div style={{ position: 'relative' }}>
                    <div 
                       onClick={() => setBehaviorOpen(!behaviorOpen)}
                       style={{ 
                          width: 220, padding: '8px 12px', background: 'rgba(255,255,255,0.07)', 
                          border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       }}
                    >
                       <span style={{ fontSize: 13, color: 'var(--text-main)' }}>
                          {behaviorLabels[settings.launcher_behavior] || 'Garder le launcher ouvert'}
                       </span>
                       <ChevronDown size={14} style={{ transform: behaviorOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                    </div>
                    {behaviorOpen && (
                       <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
                          background: '#1e293b', border: '1px solid var(--border)', borderRadius: 10,
                          overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                       }}>
                          {Object.entries(behaviorLabels).map(([key, label]) => (
                             <div 
                                key={key}
                                onClick={() => { updateSettings({ launcher_behavior: key as any }); setBehaviorOpen(false) }}
                                style={{
                                   padding: '8px 12px', fontSize: 13, color: settings.launcher_behavior === key ? 'var(--primary)' : 'var(--text-main)',
                                   cursor: 'pointer', background: settings.launcher_behavior === key ? 'rgba(74,222,128,0.1)' : 'transparent'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                onMouseLeave={e => (e.currentTarget.style.background = settings.launcher_behavior === key ? 'rgba(74,222,128,0.1)' : 'transparent')}
                             >
                                {label}
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>

              <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Résolution du jeu</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Définir la taille de base de la fenêtre Minecraft</p>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" className="input" value={settings.game_resolution.width} style={{ width: 80, textAlign: 'center' }}
                           onChange={(e) => updateSettings({ game_resolution: { ...settings.game_resolution, width: Number(e.target.value) } })} />
                    <span style={{ color: 'var(--text-faint)' }}>x</span>
                    <input type="number" className="input" value={settings.game_resolution.height} style={{ width: 80, textAlign: 'center' }}
                           onChange={(e) => updateSettings({ game_resolution: { ...settings.game_resolution, height: Number(e.target.value) } })} />
                 </div>
              </div>

           </div>
        </section>

        <section>
           <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} color="var(--primary)" /> Java
           </h2>

           <div className="card" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                 <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>RAM Allouée (Globale)</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Définir un espace mémoire par défaut (Min et Max) pour l'ensemble des instances</p>
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                       <span style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4, display: 'block' }}>Mémoire initiale (Min)</span>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="range" className="input" min={512} max={16384} step={256} 
                                 value={settings.ram_min} style={{ flex: 1, margin: 0, padding: 0 }}
                                 onChange={e => updateSettings({ ram_min: Number(e.target.value) })} />
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 60 }}>{settings.ram_min} Mo</span>
                       </div>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                       <span style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4, display: 'block' }}>Mémoire maximale (Max)</span>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="range" className="input" min={512} max={16384} step={256} 
                                 value={settings.ram_max} style={{ flex: 1, margin: 0, padding: 0 }}
                                 onChange={e => updateSettings({ ram_max: Number(e.target.value) })} />
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 60 }}>{settings.ram_max} Mo</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                 <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Chemin de l'exécutable Java</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Si laissé vide, le launcher téléchargera automatiquement la bonne version requise.</p>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input className="input" type="text" placeholder="Ex: C:\Program Files\Java\jdk-21\bin\javaw.exe"
                           style={{ flex: 1 }}
                           value={settings.custom_java_path || ''}
                           onChange={e => updateSettings({ custom_java_path: e.target.value || null })} />
                 </div>
              </div>

           </div>
        </section>

        <section>
           <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={18} color="var(--primary)" /> À propos
           </h2>

           <div className="card" style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img src="/logo.png" alt="Voxura Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain' }} />
                    <div>
                       <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>Voxura Launcher</h3>
                       <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Par Voxura Studios</p>
                    </div>
                 </div>
                 <a href="https://ko-fi.com/voxurastd" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ background: '#f87171', boxShadow: '0 2px 10px rgba(248,113,113,0.3)', gap: 8 }}>
                       <Heart size={14} fill="currentColor" strokeWidth={0} /> Nous soutenir
                    </button>
                 </a>
              </div>

              <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Version actuelle</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>v1.2.1</p>
                 </div>
                 <button 
                    className="btn-ghost" 
                    style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.05)' }}
                    onClick={async () => {
                       try {
                          const { invoke } = await import('@tauri-apps/api/core')
                          const { message, ask } = await import('@tauri-apps/plugin-dialog')
                          
                          const updateResult = await invoke<{ status: string, version?: string }>('check_updates')
                          if (updateResult.status === 'offline') {
                             await message('Impossible de vérifier les mises à jour en mode hors-ligne.', { kind: 'error' })
                          } else if (updateResult.status === 'update_available') {
                             const yes = await ask(`La version ${updateResult.version} est disponible. Voulez-vous télécharger et installer ?`, { title: 'Mise à jour disponible' })
                             if (yes) {
                                await invoke('download_and_install_update')
                             }
                          } else {
                             await message('Le launcher est déjà à jour !', { kind: 'info' })
                          }
                       } catch (e: any) {
                          alert(e)
                       }
                    }}
                 >
                    <RefreshCw size={14} /> Rechercher des mises à jour
                 </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Signaler un problème</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Un bug ou une idée ? Dites-le nous !</p>
                 </div>
                 <a href="https://codeberg.org/Voxura/voxura-launcher/issues" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-ghost" style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.05)' }}>
                       <ExternalLink size={14} /> Ouvrir un ticket
                    </button>
                 </a>
              </div>

              <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                 Informations Légales
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>Accéder au code source du launcher</p>
                    <a href="https://codeberg.org/Voxura/voxura-launcher" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                       Repository <ExternalLink size={12} />
                    </a>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                       <p style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>Licence open source</p>
                       <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Ce projet est sous licence GNU General Public License v3.0</p>
                    </div>
                    <a href="https://codeberg.org/Voxura/voxura-launcher/src/branch/main/LICENSE" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                       Voir la licence <ExternalLink size={12} />
                    </a>
                 </div>
              </div>

           </div>
        </section>

      </div>
    </div>
  )
}