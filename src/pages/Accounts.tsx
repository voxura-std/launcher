import { ShieldCheck, Monitor } from 'lucide-react'

const options = [
  { icon: ShieldCheck, label: 'Compte Microsoft',  sub: 'Minecraft officiel',  accent: true  },
  { icon: Monitor,     label: 'Mode hors-ligne',   sub: 'Pseudo personnalisé', accent: false },
]

export default function Accounts() {
  return (
    <div style={{ padding:'22px 24px', height:'100%', overflow:'hidden', boxSizing:'border-box' }}>
      <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-main)', marginBottom:4 }}>
        Comptes
      </h2>
      <p style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:22 }}>
        Connecte-toi avec Microsoft ou joue hors-ligne
      </p>

      <div style={{ display:'flex', gap:12 }}>
        {options.map(({ icon: Icon, label, sub, accent }) => (
          <button key={label} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:14,
            padding:'26px 22px', width:165, borderRadius:14, outline:'none',
            border:`1.5px dashed ${accent ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.12)'}`,
            background: accent ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.05)',
            cursor:'pointer', fontFamily:'inherit',
            transition:'all 0.18s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = accent ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.09)'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = accent ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.05)'
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = 'none'
          }}
          >
            <div style={{
              width:48, height:48, borderRadius:14,
              background: accent ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Icon size={21} color={accent ? '#60a5fa' : 'rgba(255,255,255,0.35)'} strokeWidth={1.8}/>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--text-main)' }}>{label}</p>
              <p style={{ fontSize:11, color:'var(--text-faint)', marginTop:3 }}>{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}