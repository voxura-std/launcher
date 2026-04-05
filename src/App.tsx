import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

import Layout         from './components/layout/Layout'
import Launch         from './pages/Launch'
import Instances      from './pages/Instances'
import InstanceDetail from './pages/InstanceDetail'
import Accounts       from './pages/Accounts'
import Settings       from './pages/Settings'
import Splash         from './pages/Splash'

export default function App() {
  const [isSplash, setIsSplash] = useState(false)

  useEffect(() => {
    if (getCurrentWindow().label === 'splashscreen') {
      setIsSplash(true)
    }
  }, [])

  if (isSplash) {
    return <Splash />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index                        element={<Launch />}         />
          <Route path="instances"             element={<Instances />}      />
          <Route path="instances/:id"         element={<InstanceDetail />} />
          <Route path="accounts"              element={<Accounts />}       />
          <Route path="settings"              element={<Settings />}       />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}