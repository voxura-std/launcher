import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout    from './components/layout/Layout'
import Launch    from './pages/Launch'
import Instances from './pages/Instances'
import Accounts  from './pages/Accounts'
import Search    from './pages/Search'
import Settings  from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index      element={<Launch />}    />
          <Route path="instances" element={<Instances />} />
          <Route path="accounts"  element={<Accounts />}  />
          <Route path="search"    element={<Search />}    />
          <Route path="settings"  element={<Settings />}  />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}