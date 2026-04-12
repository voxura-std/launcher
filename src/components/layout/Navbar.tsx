import { NavLink } from 'react-router-dom'
import { Zap, Layers, User, Settings } from 'lucide-react'

const navItems = [
  { to: '/',          icon: Zap,      label: 'Lancer'     },
  { to: '/instances', icon: Layers,   label: 'Instances'  },
  { to: '/accounts',  icon: User,     label: 'Comptes'    },
  { to: '/settings',  icon: Settings, label: 'Paramètres' },
]

export default function Navbar() {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '8px 12px',
    }}>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:10, flexShrink:0 }}>
        <img src="/logo.png" alt="Voxura Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
        <span style={{
          fontWeight: 800, fontSize: 12.5, letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.90)',
        }}>
          VOXURA
        </span>
      </div>

      <div style={{
        width: 1, height: 16, flexShrink: 0,
        background: 'rgba(255,255,255,0.12)', marginRight: 8,
      }}/>

      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 9,
          fontSize: 13, fontWeight: isActive ? 600 : 500,
          textDecoration: 'none', cursor: 'pointer',
          whiteSpace: 'nowrap', transition: 'all 0.15s',
          background:  isActive ? 'var(--primary-grad)' : 'transparent',
          color:       isActive ? '#022c22' : 'rgba(255,255,255,0.55)',
          boxShadow:   isActive ? '0 2px 10px rgba(74, 222, 128, 0.40)' : 'none',
        })}>
          <Icon size={14} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}