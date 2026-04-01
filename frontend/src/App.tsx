import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { TournamentProvider } from './store/TournamentContext'
import HomePage from './components/HomePage'
import TournamentCreate from './components/TournamentCreate'
import TournamentDashboard from './components/TournamentDashboard'
import RoundDetail from './components/RoundDetail'
import PlayerView from './components/PlayerView'
import PairingWizard from './components/PairingWizard'

function NavBar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors hover:text-accent ${isActive ? 'text-accent' : 'text-muted'}`

  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-widest text-accent">
          STRATEGIUM
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/tournament/create" className={linkClass}>New Tournament</NavLink>
          <NavLink to="/session/join" className={linkClass}>Join Session</NavLink>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <TournamentProvider>
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournament/create" element={<TournamentCreate />} />
          <Route path="/tournament/:id" element={<TournamentDashboard />} />
          <Route path="/tournament/:id/round/:roundId" element={<RoundDetail />} />
          <Route path="/session/join" element={<PlayerView />} />
          <Route path="/tournament/:id/round/:roundId/wizard" element={<PairingWizard />} />
        </Routes>
      </main>
    </div>
    </TournamentProvider>
  )
}
