import { useState, useEffect } from 'react'
import { onWakeUpChange } from '../api/client'

export default function WakeUpBanner() {
  const [waking, setWaking] = useState(false)

  useEffect(() => onWakeUpChange(setWaking), [])

  if (!waking) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center gap-3
      bg-[#0d1117]/95 border-b border-white/10 backdrop-blur-sm px-4 py-3">
      <svg
        className="w-4 h-4 shrink-0 animate-spin text-accent"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-sm text-white/90">
        Server is waking up — this can take up to 30 seconds…
      </p>
    </div>
  )
}
