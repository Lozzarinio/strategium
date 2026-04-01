export default function PairingWizard() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-white mb-4">PairingWizard</h1>
      <p className="text-muted">
        Core 8-step wizard used by the captain during the physical pairing process at the
        tournament table. Runs entirely in the frontend — no server calls between steps.
        The pre-computed decision tree (from the optimizer) is stored in React state +
        localStorage. Steps: select defender → record opponent defender → select attackers →
        record Round 1 pairings → Round 2 defender → record Round 2 opponent defender →
        record Round 2 pairings → automatic 5th pairing + save. Shows optimizer
        recommendations, predicted scores, and adapts when the captain deviates.
      </p>
    </div>
  )
}
