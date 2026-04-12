import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  const location = useLocation()
  const isLaunchPage = location.pathname === '/'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'transparent',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
      padding: '16px', boxSizing: 'border-box',
      gap: 8,
    }}>

      <div style={{
        width: '100%', maxWidth: 920, flexShrink: 0,
        borderRadius: 14, overflow: 'hidden',
        background: 'rgba(15, 23, 30, 0.75)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06)',
        zIndex: 2,
      }}>
        <Navbar />
      </div>

      <div style={{
        width: '100%', maxWidth: 920,
        flex: 1, minHeight: 0,
        borderRadius: isLaunchPage ? 0 : 14, overflow: 'hidden',
        background: isLaunchPage ? 'transparent' : 'rgba(15, 23, 30, 0.65)',
        backdropFilter: isLaunchPage ? 'none' : 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: isLaunchPage ? 'none' : 'blur(24px) saturate(1.4)',
        border: isLaunchPage ? 'none' : '1px solid rgba(255,255,255,0.10)',
        boxShadow: isLaunchPage ? 'none' : '0 4px 24px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06)',
        zIndex: 1,
      }}>
        <Outlet />
      </div>

    </div>
  )
}