/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 uses this preset
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#F8F9FC',
        surface: '#FFFFFF',
        primary: '#1E1E1E',
        secondary: '#8E8E93',
        'card-blue': '#4AC3FF',
        'card-yellow': '#FFD465',
        'card-orange': '#FF8E6E',
        'card-green': '#C0F67F',
        'card-purple': '#D8C8FE',
        'card-dark': '#1C1C1E',
      },
    },
  },
  plugins: [],
}