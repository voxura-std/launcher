import { ChevronRight, Globe, Coffee, Wifi, Palette, Info } from 'lucide-react'
import { useState } from 'react'

const sections = [
  { icon: Globe,   label: 'Général',   desc: 'Langue, thème, répertoire de données', color: '#3b82f6' },
  { icon: Coffee,  label: 'Java',      desc: 'Version Java par défaut, mémoire',     color: '#f59e0b' },
  { icon: Wifi,    label: 'Réseau',    desc: 'Proxy, téléchargements',               color: '#10b981' },
  { icon: Palette, label: 'Apparence', desc: "Thème, police, fond d'écran",          color: '#8b5cf6' },
  { icon: Info,    label: 'À propos',  desc: 'Version, licences, Voxura Studios',    color: '#64748b' },
]

export default function Settings() {
  const [hovered, setHovered] = useState<string|null>(null)
  return (
    <div style={{ padding:'22px 24px', height:'100%', overflowY:'auto', boxSizing:'border-box' }}>
      <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-main)', marginBottom:14 }}>Paramètres</h2>

      <div style={{ display:'flex', flexDirection:'column', gap:3, maxWidth:460 }}>
        {sections.map(({ icon: Icon, label, desc, color }) => (
          <button key={label}
            onMouseEnter={() => setHovered(label)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'11px 13px', borderRadius:12, outline:'none', fontFamily:'inherit',
              border:`1px solid ${hovered===label ? 'rgba(255,255,255,0.10)' : 'transparent'}`,
              background: hovered===label ? 'rgba(255,255,255,0.07)' : 'transparent',
              cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.15s',
            }}>
            <div style={{
              width:34, height:34, borderRadius:10, flexShrink:0,
              background:`${color}22`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Icon size={16} color={color} strokeWidth={2}/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--text-main)' }}>{label}</p>
              <p style={{ fontSize:11.5, color:'var(--text-faint)', marginTop:2 }}>{desc}</p>
            </div>
            <ChevronRight size={14} color="rgba(255,255,255,0.20)"
              style={{ transform: hovered===label ? 'translateX(2px)' : 'none', transition:'transform 0.15s' }}/>
          </button>
        ))}
      </div>
    </div>
  )
}