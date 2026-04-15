import type { WizardHook } from '../../hooks/useWizardState'

interface Props {
  wizard: WizardHook
}

export default function Step6({ wizard }: Props) {
  const { state, r2OppPlayers, setR2OppDefender } = wizard

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 6 — Record Opponent's R2 Defender</h2>
        <p className="text-sm text-muted">
          The opponent has revealed their Round 2 defender from their remaining players.
        </p>
      </div>

      <div className="bg-black/20 rounded-xl border border-white/10 p-4">
        <p className="text-xs text-muted/60 uppercase tracking-wide mb-0.5">Your R2 Defender</p>
        <p className="text-lg font-bold text-white">{state.r2Defender}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-white">Opponent's Round 2 pool ({r2OppPlayers.length} players)</p>
        {r2OppPlayers.map(player => (
          <button
            key={player}
            onClick={() => setR2OppDefender(player)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border
              transition-all text-left
              ${state.r2OppDefender === player
                ? 'bg-accent/20 border-accent text-white'
                : 'bg-black/20 border-white/10 text-muted hover:border-white/30 hover:text-white'
              }`}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 shrink-0
                ${state.r2OppDefender === player ? 'border-accent bg-accent' : 'border-white/20'}`}
            />
            <span className="font-medium">{player}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted/60">
        Selecting a player will automatically advance to Step 7.
      </p>
    </div>
  )
}
