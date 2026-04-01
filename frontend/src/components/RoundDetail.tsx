export default function RoundDetail() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-white mb-4">RoundDetail</h1>
      <p className="text-muted">
        Shows the assembled 5×5 prediction matrix for a round, prediction submission status
        (which players have submitted), a "Run Optimizer" button (enabled when all 5 players
        have submitted), optimization results summary once computed, and a "Start Pairing
        Wizard" button. Captain can also edit any player's predictions from here.
      </p>
    </div>
  )
}
