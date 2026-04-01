import { createContext, useContext, useState, ReactNode } from 'react'

export interface Player {
  name: string
  faction: string
  email: string
}

export interface MockTournament {
  id: number
  name: string
  num_rounds: number
  team_name: string
  players: Player[]
  session_code: string
}

interface TournamentContextType {
  tournaments: MockTournament[]
  addTournament: (data: Omit<MockTournament, 'id'>) => MockTournament
  getTournament: (id: number) => MockTournament | undefined
}

const TournamentContext = createContext<TournamentContextType | null>(null)

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<MockTournament[]>([])

  function addTournament(data: Omit<MockTournament, 'id'>): MockTournament {
    const tournament: MockTournament = { ...data, id: Date.now() }
    setTournaments(prev => [...prev, tournament])
    return tournament
  }

  function getTournament(id: number) {
    return tournaments.find(t => t.id === id)
  }

  return (
    <TournamentContext.Provider value={{ tournaments, addTournament, getTournament }}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournaments() {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournaments must be used within TournamentProvider')
  return ctx
}
