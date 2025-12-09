/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kaleido-blue': '#1E3A8A',
        'kaleido-light': '#3B82F6',
      },
    },
  },
  plugins: [],
}
