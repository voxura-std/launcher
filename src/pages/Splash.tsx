import { useEffect, useState } from 'react'

import { invoke } from '@tauri-apps/api/core'

export default function Splash() {
  const [status, setStatus] = useState('Recherche de mise à jour...')

  useEffect(() => {
    async function initSplash() {
      // Small artificial delay to show the "Recherche"
      await new Promise(r => setTimeout(r, 1000))
      
      try {
        const updateResult = await invoke<{ status: string, version?: string }>('check_updates')
        
        if (updateResult.status === 'offline') {
          setStatus('Mode Hors-Ligne. Démarrage...')
          await new Promise(r => setTimeout(r, 1000))
          await invoke('show_main_window', { offline: true })
        } else if (updateResult.status === 'update_available') {
          setStatus('Mise à jour requise. Téléchargement...')
          await invoke('download_and_install_update')
          // If it successfully unzipped and batched, the app will kill itself anyway
        } else {
          setStatus('A jour. Démarrage...')
          await new Promise(r => setTimeout(r, 1000))
          await invoke('show_main_window', { offline: false })
        }
      } catch (err: any) {
        setStatus(`Erreur: ${err}`)
        await new Promise(r => setTimeout(r, 2000))
        await invoke('show_main_window', { offline: true })
      }
    }
    
    // We only want this once. But React StrictMode runs this twice, 
    // so we handle it gracefully. We can just execute it.
    initSplash()
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-color, #0f172a)',
      color: 'var(--text-main, white)',
      fontFamily: 'inherit'
    }}>
        <div style={{
           width: 100, height: 100, borderRadius: 20, 
           background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           marginBottom: 40, boxShadow: '0 8px 30px rgba(59,130,246,0.3)'
        }}>
           <span style={{ color: '#fff', fontWeight: 900, fontSize: 36 }}>VX</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{status}</h2>
    </div>
  )
}
