import { useState, useEffect } from 'react'
import { Play, Square, ChevronDown, UserCircle, Layers, Check, AlertCircle } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useInstances } from '../hooks/useInstances'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { motion, AnimatePresence } from 'framer-motion'
import ProgressOverlay, { type Progress } from '../components/ProgressOverlay'

export default function Launch() {
  const { activeAccount } = useAccounts()
  const { instances, runningIds, stopInstance } = useInstances()

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [showInstanceMenu, setShowInstanceMenu] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      const sorted = [...instances].sort((a, b) => (b.last_played || 0) - (a.last_played || 0))
      setSelectedInstanceId(sorted[0].id)
    } else if (instances.length > 0 && selectedInstanceId) {
       if (!instances.find(i => i.id === selectedInstanceId)) {
          setSelectedInstanceId(instances[0].id)
       }
    }
  }, [instances, selectedInstanceId])

  const selectedInstance = instances.find(i => i.id === selectedInstanceId)
  const isSelectedRunning = selectedInstanceId ? runningIds.has(selectedInstanceId) : false

  const handleLaunch = async () => {
    if (!selectedInstanceId || !activeAccount) return
    setLaunching(true)
    try {
      await invoke('launch_instance_cmd', { instanceId: selectedInstanceId })
    } catch (e) {
      alert(String(e))
      setLaunching(false)
    }
  }

  useEffect(() => {
    let unlistenStarted: () => void
    let unlistenProgress: () => void

    listen('launcher://game-started', (e: any) => {
      if (e.payload.instance_id === selectedInstanceId) {
         setLaunching(false)
      }
    }).then(f => unlistenStarted = f)

    listen<Progress>('launcher://progress', (e) => {
      setProgress(e.payload)
      if (e.payload.percent >= 100) {
        setTimeout(() => setProgress(null), 1000)
      }
    }).then(f => unlistenProgress = f)

    return () => {
      if (unlistenStarted) unlistenStarted()
      if (unlistenProgress) unlistenProgress()
    }
  }, [selectedInstanceId])

  return (
    <div style={{
      width:'100%', height:'100%',
      display:'flex', flexDirection:'column',
      padding: 10, boxSizing: 'border-box',
    }}>

      <ProgressOverlay progress={progress} />

      <AnimatePresence>
        {showStopConfirm && selectedInstance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.70)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                width: 380, padding: '24px 26px',
                background: 'rgba(15, 30, 22,0.97)',
                border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: 16,
                boxShadow: '0 24px 60px rgba(0,0,0,0.60)',
              }}
            >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <AlertCircle size={24} color="#f87171" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
              Forcer l'arrêt de l'instance "{selectedInstance.name}" ?
            </p>
            <p style={{
              fontSize: 12, color: '#f87171', marginBottom: 22,
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.20)',
              lineHeight: 1.5,
            }}>
              ⚠️ Les données non sauvegardées seront perdues. Assure-toi d'avoir sauvegardé.
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
              <button onClick={() => { stopInstance(selectedInstance.id); setShowStopConfirm(false) }} style={{
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1 }} onClick={() => setShowInstanceMenu(false)} />

      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
      }}>

        <div style={{
          display:'flex', alignItems:'center', gap:9,
          padding:'7px 13px', minWidth:160,
          background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:10,
        }}>
          <UserCircle size={17} color="var(--text-faint)" strokeWidth={1.8}/>
          <div style={{ flex:1, textAlign:'left' }}>
            <div style={{ fontSize:9.5, color:'var(--text-faint)', fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.07em' }}>Joueur</div>
            <div style={{ fontSize:12.5, color:'var(--text-main)', fontWeight:600, marginTop:1 }}>
              {activeAccount ? activeAccount.username : 'Non connecté'}
            </div>
            {activeAccount && (
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                 {activeAccount.kind === 'offline' ? 'Hors-ligne' : 'Microsoft'}
              </div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <button style={{
            display:'flex', alignItems:'center', gap:9,
            width: '100%', padding:'7px 13px',
            background: showInstanceMenu ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.10)',
            borderRadius:10, cursor:'pointer', outline:'none',
            fontFamily:'inherit', transition:'background 0.15s',
          }}
          onClick={(e) => { e.stopPropagation(); setShowInstanceMenu(!showInstanceMenu) }}
          onMouseEnter={e => { if (!showInstanceMenu) e.currentTarget.style.background='rgba(255,255,255,0.12)' }}
          onMouseLeave={e => { if (!showInstanceMenu) e.currentTarget.style.background='rgba(255,255,255,0.07)' }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{
                width:26, height:26, borderRadius:7, flexShrink:0,
                background:'rgba(255,255,255,0.10)',
                display:'flex', alignItems:'center', justifyContent:'center',
                overflow: 'hidden'
              }}>
                {selectedInstance?.icon_path ? (
                   <img src={convertFileSrc(selectedInstance.icon_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <Layers size={12} color="var(--text-faint)"/>
                )}
              </div>
              {isSelectedRunning && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid rgba(15, 30, 22,0.97)',
                  animation: 'pulse 2s infinite',
                }} />
              )}
            </div>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:9.5, color:'var(--text-faint)', fontWeight:600,
                            textTransform:'uppercase', letterSpacing:'0.07em' }}>Instance</div>
              <div style={{ fontSize:12.5, color:'var(--text-main)', fontWeight:600, marginTop:1 }}>
                {selectedInstance ? selectedInstance.name : 'Aucune sélectionnée'}
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-faint)" style={{ transform: showInstanceMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
          </button>

          {showInstanceMenu && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
              background: '#121212',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 100, maxHeight: 250, overflowY: 'auto'
            }}>
              {instances.length === 0 ? (
                 <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Aucune instance disponible</div>
              ) : (
                 <>
                   {instances.filter(i => !i.is_voxura).length > 0 && (
                     <>
                       <div style={{ padding: '5px 10px 4px', fontSize: 10, fontWeight: 700, color: 'rgb(74, 222, 128)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                         Mes instances
                       </div>
                       {instances.filter(i => !i.is_voxura).map(inst => (
                         <div key={inst.id} onClick={() => { setSelectedInstanceId(inst.id); setShowInstanceMenu(false) }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                                borderRadius: 8, cursor: 'pointer',
                                background: selectedInstanceId === inst.id ? 'rgba(74,222,128,0.15)' : 'transparent'
                              }}
                              onMouseEnter={e => { if (selectedInstanceId !== inst.id) e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                              onMouseLeave={e => { if (selectedInstanceId !== inst.id) e.currentTarget.style.background='transparent' }}
                         >
                           <div style={{ position: 'relative' }}>
                             <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {inst.icon_path ? (
                                   <img src={convertFileSrc(inst.icon_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                   <Layers size={11} color="var(--text-muted)"/>
                                )}
                             </div>
                             {runningIds.has(inst.id) && (
                               <div style={{
                                 position: 'absolute', bottom: -1, right: -1,
                                 width: 7, height: 7, borderRadius: '50%',
                                 background: '#22c55e',
                                 border: '2px solid #121212',
                               }} />
                             )}
                           </div>
                           <div style={{ flex: 1, fontSize: 12.5, color: selectedInstanceId === inst.id ? '#4ade80' : 'var(--text-main)', fontWeight: 500 }}>
                              {inst.name}
                           </div>
                           {selectedInstanceId === inst.id && <Check size={14} color="#4ade80" />}
                         </div>
                       ))}
                     </>
                   )}


                   {instances.filter(i => i.is_voxura).length > 0 && (
                     <>
                       {instances.filter(i => !i.is_voxura).length > 0 && (
                         <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />
                       )}
                       <div style={{ padding: '5px 10px 4px', fontSize: 10, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                         Instances Voxura
                       </div>
                       {instances.filter(i => i.is_voxura).map(inst => (
                         <div key={inst.id} onClick={() => { setSelectedInstanceId(inst.id); setShowInstanceMenu(false) }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                                borderRadius: 8, cursor: 'pointer',
                                background: selectedInstanceId === inst.id ? 'rgba(168,85,247,0.15)' : 'transparent'
                              }}
                              onMouseEnter={e => { if (selectedInstanceId !== inst.id) e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                              onMouseLeave={e => { if (selectedInstanceId !== inst.id) e.currentTarget.style.background='transparent' }}
                         >
                           <div style={{ position: 'relative' }}>
                             <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {inst.icon_path ? (
                                   <img src={convertFileSrc(inst.icon_path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                   <Layers size={11} color="#c084fc"/>
                                )}
                             </div>
                             {runningIds.has(inst.id) && (
                               <div style={{
                                 position: 'absolute', bottom: -1, right: -1,
                                 width: 7, height: 7, borderRadius: '50%',
                                 background: '#22c55e',
                                 border: '2px solid #121212',
                               }} />
                             )}
                           </div>
                           <div style={{ flex: 1, fontSize: 12.5, color: selectedInstanceId === inst.id ? '#c084fc' : 'var(--text-main)', fontWeight: 500 }}>
                              {inst.name}
                           </div>
                           {selectedInstanceId === inst.id && <Check size={14} color="#c084fc" />}
                         </div>
                       ))}
                     </>
                   )}
                 </>
              )}
            </div>
          )}
        </div>

        <div style={{ flex:1 }}/>

        {isSelectedRunning ? (
           <button 
             onClick={() => setShowStopConfirm(true)}
             style={{ 
               display: 'flex', alignItems: 'center', gap: 6,
               padding:'9px 24px', fontSize:13.5, borderRadius:10, fontWeight: 600,
               background: 'rgba(239,68,68,0.15)',
               border: '1px solid rgba(239,68,68,0.35)',
               color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
             }}
             onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)' }}
             onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
           >
             <Square size={14} fill="currentColor" strokeWidth={0}/>
             Stop
           </button>
        ) : (
           <button 
             className="btn-primary" 
             disabled={!selectedInstanceId || !activeAccount || launching}
             onClick={handleLaunch}
             style={{ padding:'9px 24px', fontSize:13.5, borderRadius:10, opacity: (!selectedInstanceId || !activeAccount) ? 0.5 : 1 }}>
             <Play size={14} fill="currentColor" strokeWidth={0}/>
             {launching ? 'Lancement...' : 'Lancer le jeu'}
           </button>
        )}
      </div>
    </div>
  )
}