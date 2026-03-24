/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        "primary-dark": "#1e40af",
        "primary-light": "#3B82F6",
        surface: "#F5F7FA",
        card: "#FFFFFF",
        "dark-bg": "#0F172A",
        "dark-card": "#1E293B",
      },
    },
  },
  plugins: [],
};
