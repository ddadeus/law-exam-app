/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f3f9',
          100: '#d9e0ef',
          200: '#b3c2df',
          600: '#2a4a7f',
          700: '#1e3a5f',
          800: '#152c4a',
          900: '#0d1e33',
        },
        gold: {
          300: '#e8d08a',
          400: '#d4b05a',
          500: '#c9a042',
          600: '#a8832a',
        },
      },
    },
  },
  plugins: [],
}
