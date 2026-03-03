/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a0f',
          panel: 'rgba(10, 10, 20, 0.85)',
          cyan: '#00f5ff',
          orange: '#ff6b00',
          red: '#ff2d55',
          green: '#00ff88',
          yellow: '#ffd700',
          border: 'rgba(0, 245, 255, 0.25)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        cyan: '0 0 20px rgba(0, 245, 255, 0.3)',
        'cyan-lg': '0 0 40px rgba(0, 245, 255, 0.4)',
        orange: '0 0 20px rgba(255, 107, 0, 0.4)',
        red: '0 0 20px rgba(255, 45, 85, 0.5)',
        green: '0 0 20px rgba(0, 255, 136, 0.4)',
      },
      backdropBlur: {
        cyber: '12px',
      },
      animation: {
        'pulse-cyan': 'pulseCyan 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        blink: 'blink 1s step-end infinite',
      },
      keyframes: {
        pulseCyan: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 245, 255, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 245, 255, 0.6)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
      },
    },
  },
  plugins: [],
}
