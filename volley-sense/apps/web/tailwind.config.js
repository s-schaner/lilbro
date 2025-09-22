/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          500: "#2563EB"
        },
        court: "#0F172A",
        accent: "#C084FC"
      }
    }
  },
  plugins: []
};
