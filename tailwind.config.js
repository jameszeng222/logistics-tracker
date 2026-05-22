/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'sans-serif'],
      },
      colors: {
        accent: '#3B82F6',
        'accent-light': '#EFF6FF',
        'accent-hover': '#2563EB',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.35s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 4px rgba(59,130,246,0.2)' },
          '50%': { boxShadow: '0 0 12px rgba(59,130,246,0.4)' },
        },
      },
    },
  },
  plugins: [],
};
