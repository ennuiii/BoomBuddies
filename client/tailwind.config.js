/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Space Grotesk', 'Poppins', 'sans-serif'],
        'serif': ['Space Grotesk', 'Poppins', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'slate': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // TODO: Add your game's custom colors here
        'primary': {
          400: '#e94560',
          500: '#d63d56',
          600: '#b8334a',
        },
        'secondary': {
          400: '#00d9ff',
          500: '#00c4e8',
          600: '#00a8c8',
        },
      },
    },
  },
  plugins: [],
}
