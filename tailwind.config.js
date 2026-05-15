/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#10b981", // Emerald green accent
        background: "#ffffff",
        foreground: "#0f172a", // Slate 900
        muted: "#f1f5f9", // Slate 100
        border: "#e2e8f0" // Slate 200
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
