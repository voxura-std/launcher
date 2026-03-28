import { Play, ChevronDown, UserCircle, Layers } from 'lucide-react'

export default function Launch() {
  return (
    <div style={{
      width:'100%', height:'100%',
      display:'flex', flexDirection:'column',
      padding: 10, boxSizing: 'border-box',
      gap: 10,
    }}>

      {/* Zone centrale transparente */}
      <div style={{ flex: 1 }} />

      {/* ── Barre d'action : bloc détaché avec ses propres coins arrondis ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
      }}>

        {/* Joueur */}
        <button style={{
          display:'flex', alignItems:'center', gap:9,
          padding:'7px 13px', minWidth:160,
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.10)',
          borderRadius:10, cursor:'pointer', outline:'none',
          fontFamily:'inherit', transition:'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
        >
          <UserCircle size={17} color="var(--text-faint)" strokeWidth={1.8}/>
          <div style={{ flex:1, textAlign:'left' }}>
            <div style={{ fontSize:9.5, color:'var(--text-faint)', fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.07em' }}>Joueur</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)', fontWeight:500, marginTop:1 }}>
              Non connecté
            </div>
          </div>
          <ChevronDown size={12} color="var(--text-faint)"/>
        </button>

        {/* Instance */}
        <button style={{
          display:'flex', alignItems:'center', gap:9,
          padding:'7px 13px', flex:1, maxWidth:250,
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.10)',
          borderRadius:10, cursor:'pointer', outline:'none',
          fontFamily:'inherit', transition:'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
        >
          <div style={{
            width:26, height:26, borderRadius:7, flexShrink:0,
            background:'rgba(255,255,255,0.10)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Layers size={12} color="var(--text-faint)"/>
          </div>
          <div style={{ flex:1, textAlign:'left' }}>
            <div style={{ fontSize:9.5, color:'var(--text-faint)', fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.07em' }}>Instance</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)', fontWeight:500, marginTop:1 }}>
              Aucune sélectionnée
            </div>
          </div>
          <ChevronDown size={12} color="var(--text-faint)"/>
        </button>

        <div style={{ flex:1 }}/>

        <button className="btn-primary" style={{ padding:'9px 24px', fontSize:13.5, borderRadius:10 }}>
          <Play size={14} fill="currentColor" strokeWidth={0}/>
          Lancer le jeu
        </button>
      </div>
    </div>
  )
}