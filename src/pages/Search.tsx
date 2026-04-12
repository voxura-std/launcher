import { Search as SearchIcon, Package, Image, Blocks } from 'lucide-react'
import { useState } from 'react'

const categories = [
  { icon: Blocks,  label: 'Mods'           },
  { icon: Package, label: 'Modpacks'        },
  { icon: Image,   label: 'Resource packs'  },
]

export default function Search() {
  const [source,   setSource]   = useState<'modrinth'|'curseforge'>('modrinth')
  const [category, setCategory] = useState('Mods')

  return (
    <div style={{ padding:'20px 22px', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', boxSizing:'border-box' }}>
      <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-main)', marginBottom:14 }}>Recherche</h2>

      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
        <div style={{ position:'relative', flex:1, maxWidth:400 }}>
          <SearchIcon size={14} color="var(--text-faint)" style={{
            position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none',
          }}/>
          <input className="input" style={{ paddingLeft:34, borderRadius:10 }}
                 placeholder="Rechercher des mods, modpacks…"/>
        </div>

        <div style={{ display:'flex', gap:3, padding:'3px', background:'rgba(255,255,255,0.06)', borderRadius:10 }}>
          {(['modrinth','curseforge'] as const).map(s => (
            <button key={s} onClick={() => setSource(s)} style={{
              padding:'5px 14px', borderRadius:8, border:'none', cursor:'pointer',
              outline:'none', fontSize:12.5, fontWeight:500, fontFamily:'inherit',
              transition:'all 0.15s',
              background: source===s ? 'rgba(74,222,128,0.80)' : 'transparent',
              color:       source===s ? '#fff' : 'var(--text-muted)',
              boxShadow:   source===s ? '0 2px 8px rgba(74,222,128,0.30)' : 'none',
            }}>
              {s==='modrinth' ? 'Modrinth' : 'CurseForge'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {categories.map(({ icon: Icon, label }) => (
          <button key={label} onClick={() => setCategory(label)} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'5px 13px', borderRadius:8, outline:'none', fontFamily:'inherit',
            border:`1px solid ${category===label ? 'rgba(74,222,128,0.40)' : 'rgba(255,255,255,0.10)'}`,
            background: category===label ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
            color: category===label ? '#4ade80' : 'var(--text-muted)',
            fontSize:12.5, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
          }}>
            <Icon size={13} strokeWidth={2}/>{label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p style={{ fontSize:13, color:'var(--text-faint)' }}>Lance une recherche pour voir les résultats</p>
      </div>
    </div>
  )
}