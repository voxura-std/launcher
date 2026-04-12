import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

let globalOffline = false
let listeners: ((status: boolean) => void)[] = []

export function useOffline() {
  const [offline, setOffline] = useState(globalOffline)

  useEffect(() => {
    listeners.push(setOffline)
    return () => {
      listeners = listeners.filter(l => l !== setOffline)
    }
  }, [])

  return offline
}

if (typeof window !== 'undefined') {
  listen<boolean>('launcher://offline-status', (event) => {
    globalOffline = event.payload
    listeners.forEach(l => l(globalOffline))
  })
}
