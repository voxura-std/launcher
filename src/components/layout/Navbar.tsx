import { NavLink } from 'react-router-dom'
import { Zap, Layers, User, Search, Settings, Pickaxe } from 'lucide-react'

const navItems = [
  { to: '/',          icon: Zap,      label: 'Lancer'     },
  { to: '/instances', icon: Layers,   label: 'Instances'  },
  { to: '/accounts',  icon: User,     label: 'Comptes'    },
  { to: '/search',    icon: Search,   label: 'Recherche'  },
  { to: '/settings',  icon: Settings, label: 'Paramètres' },
]

export default function Navbar() {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '8px 12px',
    }}>

      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:10, flexShrink:0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(59,130,246,0.45)',
        }}>
          <Pickaxe size={15} color="#fff" strokeWidth={2.2} />
        </div>
        <span style={{
          fontWeight: 800, fontSize: 12.5, letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.90)',
        }}>
          VOXURA
        </span>
      </div>

      {/* Séparateur */}
      <div style={{
        width: 1, height: 16, flexShrink: 0,
        background: 'rgba(255,255,255,0.12)', marginRight: 8,
      }}/>

      {/* Onglets */}
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 9,
          fontSize: 13, fontWeight: isActive ? 600 : 500,
          textDecoration: 'none', cursor: 'pointer',
          whiteSpace: 'nowrap', transition: 'all 0.15s',
          background:  isActive ? '#3b82f6' : 'transparent',
          color:       isActive ? '#fff' : 'rgba(255,255,255,0.55)',
          boxShadow:   isActive ? '0 2px 10px rgba(59,130,246,0.40)' : 'none',
        })}>
          <Icon size={14} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}