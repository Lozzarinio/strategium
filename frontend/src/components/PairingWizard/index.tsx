import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWizardState } from '../../hooks/useWizardState'
import { useHasCaptainAccess } from '../../hooks/useCaptainAccess'
import type { OptimizationResult } from '../../types/optimization'
import ProgressStepper from './ProgressStepper'
import Step1 from './Step1'
import Step2 from './Step2'
import Step3 from './Step3'
import Step4 from './Step4'
import Step5 from './Step5'
import Step6 from './Step6'
import Step7 from './Step7'
import Step8 from './Step8'

// ── Optimizer context shape (stored in localStorage by RoundDetail) ───────────

interface OptimizerContext {
  optimizationResult: OptimizationResult
  roundNumber: number
  yourPlayers: string[]
  oppPlayers: string[]
  predictions: Record<string, Record<string, number> | null>
}

function loadOptimizerContext(roundId: string): OptimizerContext | null {
  try {
    const raw = localStorage.getItem(`strategium-optimizer-${roundId}`)
    if (!raw) return null
    return JSON.parse(raw) as OptimizerContext
  } catch {
    return null
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PairingWizard() {
  const { id, roundId } = useParams<{ id: string; roundId: string }>()
  const navigate = useNavigate()
  const hasAccess = useHasCaptainAccess(id)

  useEffect(() => {
    if (!hasAccess) {
      navigate('/captain', {
        state: { message: 'Please enter your session code and tournament PIN to access this tournament.' },
        replace: true,
      })
    }
  }, [hasAccess, navigate])

  const ctx = useMemo(
    () => (roundId ? loadOptimizerContext(roundId) : null),
    [roundId],
  )

  if (!hasAccess) return null

  // ── No optimizer context ──────────────────────────────────────────────────

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-black/30 rounded-2xl p-8 border border-white/10">
          <p className="text-muted text-sm mb-2">Optimizer results not found.</p>
          <p className="text-muted/60 text-xs mb-6">
            You need to run the optimizer before starting the wizard.
          </p>
          <Link
            to={`/tournament/${id}/round/${roundId}`}
            className="inline-block px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            ← Go to Round Detail
          </Link>
        </div>
      </div>
    )
  }

  const { optimizationResult, roundNumber, yourPlayers, oppPlayers, predictions } = ctx

  // Normalise predictions: null rows → empty objects
  const normPredictions: Record<string, Record<string, number>> = {}
  yourPlayers.forEach(p => {
    normPredictions[p] = predictions[p] ?? {}
  })

  return (
    <WizardInner
      id={id!}
      roundId={roundId!}
      roundNumber={roundNumber}
      optimizationResult={optimizationResult}
      yourPlayers={yourPlayers}
      oppPlayers={oppPlayers}
      predictions={normPredictions}
    />
  )
}

// ── Inner component (receives real data) ──────────────────────────────────────

interface WizardInnerProps {
  id: string
  roundId: string
  roundNumber: number
  optimizationResult: OptimizationResult
  yourPlayers: string[]
  oppPlayers: string[]
  predictions: Record<string, Record<string, number>>
}

function WizardInner({
  id, roundId, roundNumber, optimizationResult, yourPlayers, oppPlayers, predictions,
}: WizardInnerProps) {
  const wizard = useWizardState(
    optimizationResult,
    yourPlayers,
    oppPlayers,
    predictions,
    roundId,
  )

  const { state, runningTotal, allRecordedPairings, goToStep, resetWizard } = wizard
  const step = state.currentStep

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* ── BREADCRUMB ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to={`/tournament/${id}`} className="hover:text-white transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <Link
          to={`/tournament/${id}/round/${roundId}`}
          className="hover:text-white transition-colors"
        >
          Round {roundNumber}
        </Link>
        <span>/</span>
        <span className="text-white">Pairing Wizard</span>
      </div>

      {/* ── STICKY HEADER ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pairing Wizard</h1>
          <p className="text-sm text-muted mt-0.5">Round {roundNumber}</p>
        </div>

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

      {/* ── PROGRESS STEPPER ────────────────────────────────────────────────── */}
      <ProgressStepper currentStep={step} onGoToStep={goToStep} />

      {/* ── STEP CONTENT ────────────────────────────────────────────────────── */}
      <div className="bg-black/30 rounded-2xl border border-white/10 p-6">
        {step === 1 && <Step1 wizard={wizard} yourPlayers={yourPlayers} />}
        {step === 2 && <Step2 wizard={wizard} oppPlayers={oppPlayers} />}
        {step === 3 && <Step3 wizard={wizard} yourPlayers={yourPlayers} />}
        {step === 4 && <Step4 wizard={wizard} yourPlayers={yourPlayers} oppPlayers={oppPlayers} />}
        {step === 5 && <Step5 wizard={wizard} />}
        {step === 6 && <Step6 wizard={wizard} />}
        {step === 7 && <Step7 wizard={wizard} />}
        {step === 8 && (
          <Step8 wizard={wizard} optimizationResult={optimizationResult} roundId={roundId} />
        )}
      </div>

    </div>
  )
}
