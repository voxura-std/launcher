import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(140deg, #0f172a 0%, #1a3a6b 55%, #0a1f3d 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
      padding: '16px', boxSizing: 'border-box',
      gap: 8,
    }}>

      {/* Orbes décoratifs */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{
          position:'absolute', width:700, height:700, borderRadius:'50%',
          top:-250, left:-200,
          background:'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 65%)',
        }}/>
        <div style={{
          position:'absolute', width:500, height:500, borderRadius:'50%',
          bottom:-150, right:-100,
          background:'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
        }}/>
      </div>

      {/* ── Navbar : bloc flottant indépendant ── */}
      <div style={{
        width: '100%', maxWidth: 920, flexShrink: 0,
        borderRadius: 14, overflow: 'hidden',
        background: 'rgba(15, 23, 50, 0.75)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06)',
        zIndex: 2,
      }}>
        <Navbar />
      </div>

      {/* ── Contenu : bloc flottant indépendant ── */}
      <div style={{
        width: '100%', maxWidth: 920,
        flex: 1, minHeight: 0,
        borderRadius: 14, overflow: 'hidden',
        background: 'rgba(15, 23, 50, 0.65)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06)',
        zIndex: 1,
      }}>
        <Outlet />
      </div>

    </div>
  )
}