import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-widest text-accent mb-4">
          STRATEGIUM
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          Warhammer 40K team tournament pairing optimizer
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-lg">
        <Link
          to="/captain"
          className="group flex flex-col items-start bg-black/30 border border-white/10
            hover:border-accent/50 hover:bg-accent/5 rounded-2xl p-7 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806
                   3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438
                   3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806
                   3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138
                   3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946
                   3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1 group-hover:text-accent transition-colors">
            I'm a Captain
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Create tournaments, manage opponents, run the optimizer, and guide your team through pairings.
          </p>
          <span className="mt-5 text-accent text-sm font-medium">Get started →</span>
        </Link>

        <Link
          to="/session/join"
          className="group flex flex-col items-start bg-black/30 border border-white/10
            hover:border-white/25 hover:bg-white/5 rounded-2xl p-7 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                   M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                   m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1 group-hover:text-white transition-colors">
            I'm a Player
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Join your team's session with a code and submit your matchup predictions.
          </p>
          <span className="mt-5 text-muted text-sm font-medium group-hover:text-white transition-colors">
            Join session →
          </span>
        </Link>
      </div>
    </div>
  )
}
