import { useState, useEffect } from 'react'
import { load } from '@tauri-apps/plugin-store'

export interface Settings {
  theme: 'dark' | 'light'
  launcher_behavior: 'close' | 'keep_open' | 'close_game'
  game_resolution: { width: number; height: number }
  ram_min: number
  ram_max: number
  custom_java_path: string | null
}

const defaultSettings: Settings = {
  theme: 'dark',
  launcher_behavior: 'keep_open',
  game_resolution: { width: 854, height: 480 },
  ram_min: 1024,
  ram_max: 4096,
  custom_java_path: null,
}

let globalStore: any = null

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function initStore() {
      if (!globalStore) {
        globalStore = await load('settings.json')
      }
      const data = await globalStore.get('global_settings')
      if (data) {
        setSettings({ ...defaultSettings, ...(data as any) })
      } else {
        await globalStore.set('global_settings', defaultSettings)
        await globalStore.save()
        setSettings(defaultSettings)
      }
      setReady(true)
    }
    initStore()
  }, [])

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    if (globalStore) {
      await globalStore.set('global_settings', updated)
      await globalStore.save()
    }
  }

  useEffect(() => {
    if (settings.theme === 'light') {
      document.body.classList.add('theme-light')
    } else {
      document.body.classList.remove('theme-light')
    }
  }, [settings.theme])

  return { settings, updateSettings, ready }
}
