"use client";

/**
 * Fondo "mural" de Tangible: manchas orgánicas, enredadera, olas y el sol.
 * Sin amarillos: la mancha y el centro del sol son durazno. El movimiento se
 * apaga con "Reducir movimiento" (globals.css).
 */

export default function MuralDecorations() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden font-sans" aria-hidden="true">
      <svg className="absolute -top-[10%] -right-[10%] w-[70%] h-[70%] opacity-40 float-ambient" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#D6705A" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-5.2C93.5,8.9,82.2,22.1,71.6,33.8C61,45.5,51.1,55.7,39.8,63.2C28.5,70.7,15.8,75.5,1.9,72.2C-12,68.9,-27.1,57.5,-39.8,47.1C-52.5,36.7,-62.8,27.3,-70.6,15.3C-78.4,3.3,-83.7,-11.3,-79.8,-24.4C-75.9,-37.5,-62.8,-49.1,-49.3,-56.6C-35.8,-64.1,-21.9,-67.5,-7.6,-66.1C6.7,-64.7,28.8,-71,44.7,-76.4Z" transform="translate(100 100)" />
      </svg>

      <svg className="absolute -bottom-[10%] -left-[10%] w-[80%] h-[80%] opacity-30 float-ambient" style={{ animationDelay: "-5s" }} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#E38CCD" d="M41.4,-70.2C54.6,-63.7,66.9,-55.8,75.6,-45.3C84.3,-34.8,89.4,-21.7,86.8,-9.6C84.2,2.5,73.9,13.6,64.7,24.3C55.5,35,47.4,45.3,37.6,53.9C27.8,62.5,16.3,69.4,3.2,74.9C-9.9,80.4,-24.6,84.5,-37.3,80.4C-50,76.3,-60.7,64,-69.3,50.7C-77.9,37.4,-84.4,23.1,-84.1,9.1C-83.8,-4.9,-76.7,-18.6,-67.2,-30.3C-57.7,-42,-45.8,-51.7,-33.4,-58.6C-21,-65.5,-8.1,-69.6,4.1,-76.7C16.3,-83.8,28.2,-86.7,41.4,-70.2Z" transform="translate(100 100)" />
      </svg>

      {/* Antes era amarilla; ahora durazno-rosa, entre la terracota y el rosa. */}
      <svg className="absolute top-[20%] left-[10%] w-[40%] h-[40%] opacity-30 float-ambient" style={{ animationDelay: "-10s" }} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#F2B8A8" d="M44.3,-51.3C56.6,-42.6,65.3,-28.5,68.4,-13.4C71.5,1.7,69,17.9,60.6,31.7C52.2,45.5,37.9,56.9,22.2,62.6C6.5,68.3,-10.6,68.3,-26.8,62.3C-43,56.3,-58.3,44.3,-64.7,29.1C-71.1,13.9,-68.6,-4.5,-60.8,-20.3C-53,-36.1,-39.9,-49.3,-25.9,-57C-11.9,-64.7,2.9,-66.9,15.8,-63.3C28.7,-59.7,32,-59.9,44.3,-51.3Z" transform="translate(100 100)" />
      </svg>

      <div className="absolute bottom-0 left-0 w-full z-10">
        <svg viewBox="0 0 1440 320" className="w-full h-auto opacity-30 block">
          <path fill="#8F9E58" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 w-full z-0">
        <svg viewBox="0 0 1440 320" className="w-full h-auto opacity-20 block">
          <path fill="#D6705A" d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,122.7C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      {/* Enredadera */}
      <svg className="absolute top-20 left-0 w-32 h-64 text-salon-olive opacity-60" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M-10 0 Q 40 50, 10 100 T -10 200" />
        <path d="M10 50 Q 30 40, 40 60 Q 20 70, 10 50" fill="#8F9E58" stroke="none" />
        <path d="M0 150 Q 20 140, 30 160 Q 10 170, 0 150" fill="#8F9E58" stroke="none" />
        <circle cx="15" cy="150" r="4" fill="#E38CCD" stroke="none" />
      </svg>

      {/* Sol: el dibujo original, con el centro durazno en lugar de amarillo. */}
      <svg className="absolute top-10 right-10 w-40 h-40 opacity-50 float-ambient" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="12" fill="#F2B8A8" />
        <path d="M50 20 L 50 10 M 50 80 L 50 90 M 20 50 L 10 50 M 80 50 L 90 50" stroke="#D6705A" strokeWidth="2" />
        <path d="M71 29 L 78 22 M 29 71 L 22 78 M 29 29 L 22 22 M 71 71 L 78 78" stroke="#D6705A" strokeWidth="2" />
        <circle cx="50" cy="50" r="20" fill="none" stroke="#D6705A" strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}
