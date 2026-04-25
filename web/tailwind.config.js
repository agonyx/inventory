/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'scan-line': {
          '0%, 100%': { top: '0%' },
          '50%': { top: 'calc(100% - 2px)' },
        },
        'corner-pulse': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(0.95)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
      },
      animation: {
        'scan-line': 'scan-line 2.5s ease-in-out infinite',
        'corner-pulse-tl': 'corner-pulse 2s ease-in-out 0s infinite',
        'corner-pulse-tr': 'corner-pulse 2s ease-in-out 0.15s infinite',
        'corner-pulse-br': 'corner-pulse 2s ease-in-out 0.3s infinite',
        'corner-pulse-bl': 'corner-pulse 2s ease-in-out 0.45s infinite',
      },
    },
  },
  plugins: [],
};
