/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1e3a5f",
        accent:  "#e74c3c",
        success: "#2ecc71",
        warning: "#f39c12",
      }
    },
  },
  plugins: [],
}