import { Link, useParams } from 'react-router-dom'
import { useWizardState } from '../../hooks/useWizardState'
import {
  MOCK_OPTIMIZATION_RESULT,
  YOUR_PLAYERS,
  OPP_PLAYERS,
  MOCK_PREDICTIONS,
} from '../../mocks/optimizationResult'
import ProgressStepper from './ProgressStepper'
import Step1 from './Step1'
import Step2 from './Step2'
import Step3 from './Step3'
import Step4 from './Step4'
import Step5 from './Step5'
import Step6 from './Step6'
import Step7 from './Step7'
import Step8 from './Step8'

export default function PairingWizard() {
  const { id, roundId } = useParams()

  const wizard = useWizardState(
    MOCK_OPTIMIZATION_RESULT,
    YOUR_PLAYERS,
    OPP_PLAYERS,
    MOCK_PREDICTIONS,
    roundId ?? '1',
  )

  const { state, runningTotal, allRecordedPairings, goToStep, resetWizard } = wizard
  const step = state.currentStep

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* ── BREADCRUMB ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to={`/tournament/${id}`} className="hover:text-white transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <Link
          to={`/tournament/${id}/round/${roundId}`}
          className="hover:text-white transition-colors"
        >
          Round {roundId}
        </Link>
        <span>/</span>
        <span className="text-white">Pairing Wizard</span>
      </div>

      {/* ── STICKY HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pairing Wizard</h1>
          <p className="text-sm text-muted mt-0.5">Round {roundId}</p>
        </div>

        {/* Running total + reset */}
        <div className="flex items-center gap-3">
          {allRecordedPairings.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted/60">Running Total</p>
              <p className="text-lg font-bold font-mono text-white">{runningTotal} pts</p>
            </div>
          )}
          <button
            onClick={() => {
              if (confirm('Reset wizard? All pairing choices will be cleared.')) {
                resetWizard()
              }
            }}
            className="text-xs text-muted/40 hover:text-danger border border-white/5 hover:border-danger/30
              rounded-lg px-3 py-2 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── PROGRESS STEPPER ──────────────────────────────────────────────── */}
      <ProgressStepper currentStep={step} onGoToStep={goToStep} />

      {/* ── STEP CONTENT ──────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-2xl border border-white/10 p-6">
        {step === 1 && (
          <Step1 wizard={wizard} yourPlayers={YOUR_PLAYERS} />
        )}
        {step === 2 && (
          <Step2 wizard={wizard} oppPlayers={OPP_PLAYERS} />
        )}
        {step === 3 && (
          <Step3 wizard={wizard} yourPlayers={YOUR_PLAYERS} />
        )}
        {step === 4 && (
          <Step4 wizard={wizard} oppPlayers={OPP_PLAYERS} />
        )}
        {step === 5 && (
          <Step5 wizard={wizard} />
        )}
        {step === 6 && (
          <Step6 wizard={wizard} />
        )}
        {step === 7 && (
          <Step7 wizard={wizard} />
        )}
        {step === 8 && (
          <Step8 wizard={wizard} optimizationResult={MOCK_OPTIMIZATION_RESULT} />
        )}
      </div>

    </div>
  )
}
