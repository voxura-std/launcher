import { useState } from 'react'
import { ShieldCheck, Monitor, LogOut, Check, Loader2, AlertCircle, X, KeyRound } from 'lucide-react'
import { useAccounts, type Account } from '../hooks/useAccounts'

export default function Accounts() {
  const {
    accounts, activeAccount, loading, error,
    loginMicrosoft, loginOffline, loginVoxura, logout, selectAccount,
  } = useAccounts()

  const [view, setView]               = useState<'main' | 'offline'>('main')
  const [offlineUsername, setUsername] = useState('')
  const [offlineError, setOfflineError] = useState('')
  const hasMicrosoft = accounts.some(account => account.kind === 'microsoft')

  const handleOfflineLogin = async () => {
    if (!offlineUsername.trim()) { setOfflineError('Entre un pseudo.'); return }
    setOfflineError('')
    try {
      await loginOffline(offlineUsername.trim())
      setView('main')
      setUsername('')
    } catch (e) { setOfflineError(e as string) }
  }

  return (
    <div style={{
      padding: '20px 22px', height: '100%', overflowY: 'auto',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20,
    }}>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', marginBottom: 3 }}>
          Comptes
        </h1>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#fca5a5', fontSize: 12.5,
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {view === 'main' && (
        <>
          {accounts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
              }}>
                Comptes connectés
              </p>
              {accounts.map(account => (
                <AccountRow
                  key={account.id}
                  account={account}
                  isActive={activeAccount?.id === account.id}
                  hasMicrosoft={hasMicrosoft}
                  onSelect={() => selectAccount(account)}
                  onLogout={() => logout(account.id)}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={loginVoxura} disabled={loading} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '22px 20px', width: 170, borderRadius: 13,
              border: '1.5px dashed rgba(250,204,21,0.40)',
              background: loading ? 'rgba(250,204,21,0.03)' : 'rgba(250,204,21,0.08)',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', outline: 'none', transition: 'all 0.18s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(250,204,21,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {loading
                  ? <Loader2 size={20} color="#facc15" style={{ animation: 'spin 1s linear infinite' }} />
                  : <KeyRound size={20} color="#facc15" strokeWidth={1.8} />
                }
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  {loading ? 'Connexion en cours...' : 'Compte Voxura'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
                  Accès projets Voxura
                </p>
              </div>
            </button>

            <button onClick={loginMicrosoft} disabled={loading} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '22px 20px', width: 170, borderRadius: 13,
              border: '1.5px dashed rgba(74,222,128,0.35)',
              background: loading ? 'rgba(74,222,128,0.03)' : 'rgba(74,222,128,0.07)',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', outline: 'none', transition: 'all 0.18s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(74,222,128,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {loading
                  ? <Loader2 size={20} color="#4ade80" style={{ animation: 'spin 1s linear infinite' }} />
                  : <ShieldCheck size={20} color="#4ade80" strokeWidth={1.8} />
                }
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  {loading ? 'Connexion en cours…' : 'Compte Microsoft'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
                  {loading ? 'Fenêtre ouverte' : 'Minecraft officiel'}
                </p>
              </div>
            </button>

            <button onClick={() => setView('offline')} disabled={loading} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '22px 20px', width: 170, borderRadius: 13,
              border: '1.5px dashed rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer', fontFamily: 'inherit', outline: 'none', transition: 'all 0.18s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Monitor size={20} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Mode hors-ligne</p>
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>Compte cracké</p>
              </div>
            </button>
          </div>
        </>
      )}

      {view === 'offline' && (
        <div style={{
          padding: '20px', borderRadius: 14, maxWidth: 320,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>Mode hors-ligne</p>
            <button onClick={() => { setView('main'); setOfflineError(''); setUsername('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Entre un pseudo entre 3 et 16 caractères (lettres, chiffres, _)
          </p>

          <input
            className="input"
            value={offlineUsername}
            onChange={e => { setUsername(e.target.value); setOfflineError('') }}
            onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
            placeholder="MonPseudo"
            maxLength={16}
            autoFocus
            style={{ marginBottom: offlineError ? 8 : 14 }}
          />

          {offlineError && (
            <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} />{offlineError}
            </p>
          )}

          <button className="btn-primary" onClick={handleOfflineLogin} disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Continuer
          </button>
        </div>
      )}
    </div>
  )
}

function AccountRow({ account, isActive, hasMicrosoft, onSelect, onLogout }: {
  account: Account; isActive: boolean; hasMicrosoft: boolean; onSelect: () => void; onLogout: () => void
}) {
  const isVoxuraPass = account.kind === 'voxura'
  const isOfflineBlocked = account.kind === 'offline' && hasMicrosoft
  const canSelect = !isActive && !isVoxuraPass && !isOfflineBlocked

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11,
      background: isActive ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${isActive ? 'rgba(74,222,128,0.28)' : 'rgba(255,255,255,0.09)'}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isActive ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
        color: isActive ? '#4ade80' : 'rgba(255,255,255,0.45)',
      }}>
        {account.username[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.username}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
          {account.kind === 'microsoft' ? 'Microsoft' : account.kind === 'voxura' ? 'Voxura' : 'Hors-ligne'}
        </p>
      </div>
      {canSelect && (
        <button onClick={onSelect} style={{
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
        }}>Sélectionner</button>
      )}
      {isVoxuraPass && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#facc15', fontWeight: 500 }}>
          <KeyRound size={13} /> Passe Voxura
        </div>
      )}
      {isOfflineBlocked && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 500 }}>
          Priorité Microsoft
        </div>
      )}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4ade80', fontWeight: 500 }}>
          <Check size={13} /> Actif
        </div>
      )}
      <button onClick={onLogout} style={{
        padding: '6px', borderRadius: 8, background: 'transparent', border: '1px solid transparent',
        color: 'rgba(239,68,68,0.50)', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.color = 'rgba(239,68,68,0.80)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.50)' }}
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
