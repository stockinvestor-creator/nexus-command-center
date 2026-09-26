/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: { DEFAULT: '#05060a', 900: '#07080d', 800: '#0b0d14', 700: '#10131c', 600: '#161a26' },
        neon: {
          cyan: '#22d3ee',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          magenta: '#e879f9',
          green: '#34d399',
          red: '#f43f5e',
          amber: '#fbbf24',
        },
        bull: '#22c55e',
        bear: '#f43f5e',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 0 24px -4px rgba(34,211,238,0.35)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.3), 0 0 24px -4px rgba(139,92,246,0.4)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        orbit: { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite',
        marquee: 'marquee 60s linear infinite',
        'gradient-x': 'gradient-x 12s ease infinite',
        shimmer: 'shimmer 1.6s infinite',
        orbit: 'orbit 40s linear infinite',
      },
    },
  },
  plugins: [],
};
