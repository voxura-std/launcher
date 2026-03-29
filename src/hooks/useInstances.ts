import { invoke } from '@tauri-apps/api/core'
import { useState, useEffect, useCallback } from 'react'

export interface Instance {
  id: string
  name: string
  mc_version: string
  loader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'
  loader_version: string | null
  created_at: number
  last_played: number | null
  play_time: number
  java_args: string | null
  ram_mb: number
}

export interface McVersion {
  id: string
  version_type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  release_time: string
}

export interface LoaderVersion {
  version: string
  stable: boolean
}

export function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const loadInstances = useCallback(async () => {
    try {
      const list = await invoke<Instance[]>('load_instances')
      setInstances(list)
    } catch (e) {
      console.error('Erreur chargement instances:', e)
    }
  }, [])

  useEffect(() => { loadInstances() }, [loadInstances])

  const createInstance = useCallback(async (
    name: string,
    mcVersion: string,
    loader: Instance['loader'],
    loaderVersion: string | null,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const instance = await invoke<Instance>('create_instance', {
        name,
        mcVersion,
        loader,
        loaderVersion,
      })
      setInstances(prev => [instance, ...prev])
      return instance
    } catch (e) {
      setError(e as string)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteInstance = useCallback(async (id: string) => {
    try {
      await invoke('delete_instance', { instanceId: id })
      setInstances(prev => prev.filter(i => i.id !== id))
    } catch (e) {
      setError(e as string)
    }
  }, [])

  const updateInstance = useCallback(async (instance: Instance) => {
    try {
      await invoke('update_instance', { instance })
      setInstances(prev => prev.map(i => i.id === instance.id ? instance : i))
    } catch (e) {
      setError(e as string)
    }
  }, [])

  return {
    instances, loading, error,
    createInstance, deleteInstance, updateInstance,
    reload: loadInstances,
  }
}