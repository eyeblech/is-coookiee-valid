/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      colors: {
        acid: '#CCFF00',
        coral: '#FF5E5B',
        cyan: '#00F0FF',
        amber: '#FFB800',
        obsidian: '#090A0F',
        panel: '#12141D',
        paper: '#F4F0EA',
      },
    },
  },
  plugins: [],
};
