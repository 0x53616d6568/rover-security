/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: "#B6D9C6",
        forest: "#183D31",
        forest2: "#285747",
        deep: "#10251E",
        ink: "#080D0B",
        "text-primary": "#F4F7F3",
        "text-secondary": "#AABBB1",
      },
    },
  },
  plugins: [],
};