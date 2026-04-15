const STEP_LABELS = [
  'Your Defender',
  'Opp Defender',
  'Your Attackers',
  'R1 Pairings',
  'R2 Defender',
  'Opp R2 Defender',
  'R2 Pairings',
  'Summary',
]

interface Props {
  currentStep: number
  onGoToStep: (step: number) => void
}

export default function ProgressStepper({ currentStep, onGoToStep }: Props) {
  return (
    <div className="mb-8">
      {/* Mobile: compact progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs text-muted mb-2">
          <span>Step {currentStep} of {STEP_LABELS.length}</span>
          <span className="text-white font-medium">{STEP_LABELS[currentStep - 1]}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className="bg-accent rounded-full h-1.5 transition-all duration-300"
            style={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: full step indicators */}
      <div className="hidden sm:flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1
          const completed = step < currentStep
          const active = step === currentStep
          const isLast = step === STEP_LABELS.length

          return (
            <div key={step} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => completed && onGoToStep(step)}
                disabled={!completed}
                className="flex flex-col items-center gap-1 group shrink-0 disabled:cursor-default"
                title={completed ? `Go back to step ${step}` : undefined}
              >
                {/* Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${completed ? 'bg-success text-black cursor-pointer group-hover:brightness-110' : ''}
                    ${active ? 'bg-accent text-white ring-2 ring-accent/40 ring-offset-2 ring-offset-black/40' : ''}
                    ${!completed && !active ? 'bg-white/10 text-muted/60' : ''}
                  `}
                >
                  {completed ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] leading-tight text-center max-w-[60px] transition-colors
                    ${active ? 'text-white font-medium' : completed ? 'text-success/80' : 'text-muted/50'}
                  `}
                >
                  {label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-4 rounded transition-all
                    ${completed ? 'bg-success/60' : 'bg-white/10'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
