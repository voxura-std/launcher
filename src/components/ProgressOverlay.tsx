export interface Progress {
  step: string
  current: number
  total: number
  percent: number
}

export default function ProgressOverlay({ progress }: { progress: Progress | null }) {
  if (!progress) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.70)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 440, padding: '28px 30px',
        background: 'rgba(15, 30, 22,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          Installation en cours…
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          {progress.step}
        </p>
        <div style={{
          height: 8, background: 'rgba(255,255,255,0.08)',
          borderRadius: 99, overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            height: '100%',
            width: `${progress.percent}%`,
            background: 'var(--primary-grad)',
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {progress.current} / {progress.total}
          </span>
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
            {Math.round(progress.percent)}%
          </span>
        </div>
      </div>
    </div>
  )
}
