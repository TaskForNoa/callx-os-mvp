/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Angloville brand colors
        av: {
          blue: '#1197db',
          'blue-dark': '#0f8dc5',
          'blue-light': '#b4dbff',
          'blue-bg': '#f5f9fc',
          navy: '#292967',
          orange: '#fb8e28',
          yellow: '#FFD93D',
          cream: '#f7f5e7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
