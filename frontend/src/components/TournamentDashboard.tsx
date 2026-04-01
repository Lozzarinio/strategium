export default function TournamentDashboard() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-white mb-4">TournamentDashboard</h1>
      <p className="text-muted">
        Captain view — shows tournament overview, session code, opponent team management
        (collapsible list, add/edit/delete), and the list of rounds with their assigned
        opponent teams. Captain can assign opponent teams to rounds and navigate to round
        detail from here.
      </p>
    </div>
  )
}
