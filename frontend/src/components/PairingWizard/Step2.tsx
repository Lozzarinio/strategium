import type { WizardHook } from '../../hooks/useWizardState'

interface Props {
  wizard: WizardHook
  oppPlayers: string[]
}

export default function Step2({ wizard, oppPlayers }: Props) {
  const { state, setR1OppDefender } = wizard

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Step 2 — Record Opponent's Defender</h2>
        <p className="text-sm text-muted">
          The opponent has revealed their defender. Tap their player to continue.
        </p>
      </div>

      <div className="bg-black/20 rounded-xl border border-white/10 p-4">
        <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Your Defender</p>
        <p className="text-lg font-bold text-white">{state.r1Defender}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-white">Which player did the opponent name as their defender?</p>
        {oppPlayers.map(player => (
          <button
            key={player}
            onClick={() => setR1OppDefender(player)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border
              transition-all text-left
              ${state.r1OppDefender === player
                ? 'bg-accent/20 border-accent text-white'
                : 'bg-black/20 border-white/10 text-muted hover:border-white/30 hover:text-white'
              }`}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 shrink-0
                ${state.r1OppDefender === player ? 'border-accent bg-accent' : 'border-white/20'}`}
            />
            <span className="font-medium">{player}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted/60">
        Selecting a player will automatically advance to Step 3.
      </p>
    </div>
  )
}
