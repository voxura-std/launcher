import { invoke } from '@tauri-apps/api/core'
import { useState, useEffect, useCallback } from 'react'

export interface Account {
  id: string
  username: string
  kind: 'microsoft' | 'offline'
}

export function useAccounts() {
  const [accounts, setAccounts]           = useState<Account[]>([])
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const [accs, active] = await Promise.all([
        invoke<Account[]>('load_accounts'),
        invoke<Account | null>('get_active_account'),
      ])
      setAccounts(accs)
      setActiveAccount(active)
    } catch (e) {
      console.error('Erreur chargement comptes:', e)
    }
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const loginMicrosoft = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const account = await invoke<Account>('login_microsoft')
      setAccounts(prev => [...prev.filter(a => a.id !== account.id), account])
      setActiveAccount(account)
      return account
    } catch (e) {
      setError(e as string)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const loginOffline = useCallback(async (username: string) => {
    setLoading(true)
    setError(null)
    try {
      const account = await invoke<Account>('login_offline', { username })
      setAccounts(prev => [...prev.filter(a => a.id !== account.id), account])
      setActiveAccount(account)
      return account
    } catch (e) {
      setError(e as string)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async (accountId: string) => {
    try {
      await invoke('logout_account', { accountId })
      setAccounts(prev => prev.filter(a => a.id !== accountId))
      setActiveAccount(prev => prev?.id === accountId ? null : prev)
    } catch (e) { setError(e as string) }
  }, [])

  const selectAccount = useCallback(async (account: Account) => {
    try {
      await invoke('set_active_account', { accountId: account.id })
      setActiveAccount(account)
    } catch (e) { setError(e as string) }
  }, [])

  return {
    accounts, activeAccount, loading, error,
    loginMicrosoft, loginOffline, logout, selectAccount,
    reload: loadAccounts,
  }
}