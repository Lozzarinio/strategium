import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#e94560',
        success: '#2ecc71',
        warning: '#f39c12',
        danger: '#e74c3c',
        muted: '#a8b2d1',
        surface: '#16213e',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config

