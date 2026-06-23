import { Routes, Route, Link, useLocation } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import CaptainDashboard from './components/CaptainDashboard'
import TournamentCreate from './components/TournamentCreate'
import TournamentDashboard from './components/TournamentDashboard'
import RoundDetail from './components/RoundDetail'
import PlayerView from './components/PlayerView'
import PairingWizard from './components/PairingWizard'
import WakeUpBanner from './components/WakeUpBanner'

function CaptainNav() {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/captain" className="text-xl font-bold tracking-widest text-accent">
          STRATEGIUM
        </Link>
        <nav>
          <Link
            to="/captain/create"
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-accent/40
              text-accent hover:bg-accent/10 transition-colors"
          >
            + Create Tournament
          </Link>
        </nav>
      </div>
    </header>
  )
}

function PlayerNav() {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-widest text-accent">
          STRATEGIUM
        </Link>
        <nav>
          <Link
            to="/session/join"
            className="text-sm text-muted hover:text-white transition-colors"
          >
            Join Session →
          </Link>
        </nav>
      </div>
    </header>
  )
}

function NavBar() {
  const { pathname } = useLocation()
  if (pathname === '/') return null
  if (pathname.startsWith('/session')) return <PlayerNav />
  return <CaptainNav />
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <WakeUpBanner />
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/captain" element={<CaptainDashboard />} />
          <Route path="/captain/create" element={<TournamentCreate />} />
          <Route path="/tournament/:id" element={<TournamentDashboard />} />
          <Route path="/tournament/:id/round/:roundId" element={<RoundDetail />} />
          <Route path="/tournament/:id/round/:roundId/wizard" element={<PairingWizard />} />
          <Route path="/session/join" element={<PlayerView />} />
        </Routes>
      </main>
    </div>
  )
}
