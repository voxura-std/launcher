import { useEffect, useState } from 'react'

import { invoke } from '@tauri-apps/api/core'

export default function Splash() {
  const [status, setStatus] = useState('Recherche de mise à jour...')

  useEffect(() => {
    async function initSplash() {
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
        } else {
          setStatus('Démarrage...')
          await new Promise(r => setTimeout(r, 1000))
          await invoke('show_main_window', { offline: false })
        }
      } catch (err: any) {
        setStatus(`Erreur: ${err}`)
        await new Promise(r => setTimeout(r, 2000))
        await invoke('show_main_window', { offline: true })
      }
    }

    initSplash()
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-color, #0f1e16f5)',
      color: 'var(--text-main, white)',
      fontFamily: 'inherit'
    }}>
        <img src="/logo.png" alt="Voxura Logo" style={{
           width: 100, height: 100, borderRadius: 20, objectFit: 'contain',
           marginBottom: 40
        }} />
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{status}</h2>
    </div>
  )
}
