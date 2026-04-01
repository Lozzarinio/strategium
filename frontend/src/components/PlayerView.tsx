export default function PlayerView() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-white mb-4">PlayerView</h1>
      <p className="text-muted">
        Session join flow — player enters 6-character session code, selects their name from
        the roster dropdown, picks a round (must have an opponent assigned), and enters their
        5 prediction scores (0–20, integers or half-points) against each opponent. Can also
        view teammates' submitted predictions in read-only mode.
      </p>
    </div>
  )
}
