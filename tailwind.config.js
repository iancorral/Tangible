/** @type {import('tailwindcss').Config} */
module.exports = {
  // En iPhone un "hover" se queda pegado después de tocar (tarjetas que siguen
  // agrandadas). Con esto, hover:* solo aplica en dispositivos con mouse.
  future: { hoverOnlyWhenSupported: true },
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
        // Rosa polvo, tomado de las mejillas de la ilustración del logo. Es el
        // acento sobre botones café y el tinte de las zonas destacadas. Sustituye
        // a los amarillos (salon-yellow / salon-honey), que se retiraron a
        // propósito: no los vuelvas a agregar sin hablarlo con la dueña.
        'salon-blush': '#F3C6D3',
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