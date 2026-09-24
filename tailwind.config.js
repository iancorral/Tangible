/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    'float-ambient',
  ],
  theme: {
    extend: {
      fontFamily: {

        sans: [
          '"Century Gothic"',
          'CenturyGothic',
          'Questrial',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        title: [
          '"Boston Angel"',
          '"Century Gothic"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        'salon-bg': '#FAF7F2',
        'salon-brown': '#2C1F0E',      
        'salon-black': '#1a1a1a',      
        'salon-lavender': '#D4609C',   
        'salon-yellow': '#F9E040',
        // Dorado terroso para Premios/Clientas: mantiene la idea de "recompensa"
        // sin el neón de salon-yellow, y convive con terracota y olivo.
        'salon-honey': '#D8A657',
        'salon-olive': '#6B7135',     
        'salon-terracotta': '#C4522A', 
        'salon-gray': '#7A746C',       
        'salon-pink' : '#C4789A',
        'salon-white' : '#FFFFFF'
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
}