import { NavLink } from 'react-router-dom'
import { Zap, Layers, User, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

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
        <img src="/logo_menu.png" alt="Voxura Logo" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'contain' }} />
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
        <NavLink key={to} to={to} end={to === '/'} style={{ position: 'relative', outline: 'none', textDecoration: 'none' }}>
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="navbar-slider"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--primary-grad)',
                    borderRadius: 9,
                    boxShadow: '0 2px 10px rgba(74, 222, 128, 0.40)',
                    zIndex: 0
                  }}
                />
              )}
              <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 9,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                color: isActive ? '#022c22' : 'rgba(255,255,255,0.55)',
              }}>
                <Icon size={14} strokeWidth={2.2} />
                <span>{label}</span>
              </div>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}