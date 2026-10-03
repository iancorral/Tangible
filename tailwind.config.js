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
        // al amarillo neón (salon-yellow) y al miel, que se retiraron a pedido
        // de la dueña.
        'salon-blush': '#F3C6D3',
        // Mostaza apagada SOLO para el estado "Pendiente" (pagos, puntos del
        // calendario, avisos). La dueña quiere que pendiente se lea amarillo,
        // pero suave; no usar como acento general. 700 cumple contraste AA
        // sobre 50.
        'salon-mustard': {
          50: '#FBF4DE',
          100: '#F6EAC6',
          200: '#EAD9A3',
          400: '#D9B456',
          700: '#7D5E14',
        },
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