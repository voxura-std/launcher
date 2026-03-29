import { Plus, RefreshCw, SlidersHorizontal, LayoutGrid, List, Layers, FolderPlus } from 'lucide-react'

export default function Instances() {
  return (
    <div style={{
      display:'flex', height:'100%',
      padding: 10, boxSizing:'border-box', gap: 10,
    }}>

      <aside style={{
        width: 175, flexShrink: 0,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        padding: '8px 6px',
        display: 'flex', flexDirection: 'column', gap: 2,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}>
        <button style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'8px 11px', width:'100%', textAlign:'left',
          borderRadius:9,
          background:'rgba(59,130,246,0.18)',
          border:'1px solid rgba(59,130,246,0.25)',
          color:'#93c5fd', fontSize:12.5, fontWeight:600,
          cursor:'pointer', outline:'none', fontFamily:'inherit',
        }}>
          <LayoutGrid size={13} strokeWidth={2.2}/>
          Toutes les instances
        </button>

        <div style={{ flex:1 }}/>

        <button style={{
          display:'flex', alignItems:'center', gap:7,
          padding:'7px 11px', width:'100%',
          background:'transparent', border:'1px solid transparent',
          borderRadius:9, color:'var(--text-faint)',
          fontSize:12, fontWeight:500, cursor:'pointer', outline:'none',
          fontFamily:'inherit', transition:'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='var(--text-muted)' }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-faint)' }}
        >
          <FolderPlus size={13} strokeWidth={2}/>
          Ajouter un groupe
        </button>
      </aside>

      <div style={{
        flex:1, minWidth:0,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        display:'flex', flexDirection:'column',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      }}>

        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,0.08)',
          background:'rgba(255,255,255,0.03)',
        }}>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-main)' }}>
            Toutes les instances
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            {([RefreshCw, SlidersHorizontal, LayoutGrid, List] as const).map((Icon, i) => (
              <button key={i} className="btn-ghost" style={{ padding:'5px 7px' }}>
                <Icon size={13} strokeWidth={2}/>
              </button>
            ))}
            <div style={{ width:1, height:14, background:'rgba(255,255,255,0.10)', margin:'0 6px' }}/>
            <button className="btn-primary" style={{ padding:'5px 13px', fontSize:12, borderRadius:9 }}>
              <Plus size={12}/> Ajouter et importer
            </button>
          </div>
        </div>

        <div style={{
          flex:1, display:'flex', alignItems:'center',
          justifyContent:'center', flexDirection:'column', gap:10,
        }}>
          <div style={{
            width:52, height:52, borderRadius:15,
            background:'rgba(255,255,255,0.07)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Layers size={22} color="rgba(255,255,255,0.20)" strokeWidth={1.5}/>
          </div>
          <p style={{ fontSize:13.5, fontWeight:500, color:'rgba(255,255,255,0.30)' }}>
            Aucune instance
          </p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.18)', marginTop:-6 }}>
            Clique sur "Ajouter et importer" pour commencer
          </p>
        </div>
      </div>
    </div>
  )
}