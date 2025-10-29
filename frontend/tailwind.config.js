/**** Tailwind config with dark-purple theme ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx}",
    "./src/context/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        pm: {
          bg: "#0b0010",
          dark: "#1a001f",
          mid: "#2a0040",
          purple: "#3b0066",
          accent: "#f7d046"
        }
      },
      fontFamily: {
        poppins: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "pm-gradient": "linear-gradient(135deg, #1a001f 0%, #3b0066 60%, #f7d046 120%)"
      }
    }
  },
  plugins: []
};
