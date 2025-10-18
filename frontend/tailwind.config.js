/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        pm: {
          primary: '#120024',
          accent: '#6C2BD9',
          highlight: '#FFD500'
        }
      }
    }
  },
  plugins: []
}
