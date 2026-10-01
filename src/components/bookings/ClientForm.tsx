"use client";

import { useState, useEffect } from 'react';

interface ClientFormProps {
  onSubmit: (name: string, phone: string, websiteUrl?: string) => void;
  isSubmitting: boolean;
  onGoBack?: () => void;
}

export default function ClientForm({ onSubmit, isSubmitting, onGoBack }: ClientFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tangible_client");
      if (!raw) return;

      const parsed = JSON.parse(raw);

      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.savedAt > ninetyDays) {
        localStorage.removeItem("tangible_client");
        return;
      }

      const safeName = parsed.name?.replace(/[^\p{L}\p{M}\s.'\-]/gu, "").trim();
      const safePhone = parsed.phone?.replace(/[^0-9+]/g, "").trim();

      if (safeName && safePhone) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setName(safeName);
        setPhone(safePhone);
        setIsReturningUser(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      localStorage.removeItem("tangible_client");
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      localStorage.setItem(
        "tangible_client",
        JSON.stringify({ name, phone, savedAt: Date.now() })
      );
    } catch {
    }
    onSubmit(name, phone, websiteUrl);
  };

  const handleReset = () => {
    localStorage.removeItem("tangible_client");
    setName("");
    setPhone("");
    setIsReturningUser(false);
  };

  return (
    <div className="mt-4 p-6 bg-white/50 backdrop-blur-sm">
      <h3 className="font-bold text-salon-olive text-xs uppercase tracking-[0.2em] mb-6 text-center">
        3. Tus Datos
      </h3>
      
      {isReturningUser ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-salon-yellow rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-salon-brown shadow-folk">
            <svg className="w-8 h-8 text-salon-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h4 className="text-lg font-black text-salon-brown mb-1">Hola de nuevo, {name.split(' ')[0]}</h4>
          <p className="text-xs text-salon-gray mb-6 font-medium">
            Usaremos el número <span className="font-bold text-salon-terracotta">...{phone.slice(-4)}</span>
          </p>
          <div className="bg-salon-yellow/20 border border-salon-yellow/50 rounded-xl px-4 py-3 mb-2">
            <p className="text-[10px] text-salon-gray leading-relaxed text-center">
              Se requiere depósito de{" "}
              <span className="font-black text-salon-terracotta">$150 MXN</span>{" "}
              al confirmar por WhatsApp. Los precios mostrados son base, el costo final puede variar según la complejidad del diseño.
            </p>
          </div>
          
          <button
          onClick={() => handleSubmit()} 
          disabled={isSubmitting}
          className="w-full bg-salon-olive text-salon-white py-4 px-6 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-folk mb-4 transform active:scale-[0.98] transition-all border-2 border-salon-olive hover:bg-salon-olive/90"
        >
            {isSubmitting ? 'AGENDANDO...' : 'CONFIRMAR CITA'}
        </button>
          <button 
            onClick={handleReset}
            className="text-[10px] uppercase tracking-wider text-salon-gray underline hover:text-salon-olive font-bold"
          >
            No soy yo / Cambiar número
          </button>
          <button 
            onClick={() => {
              onGoBack?.();
            }}
            className="text-[10px] uppercase tracking-wider text-salon-olive underline hover:text-salon-brown font-bold mt-2 block mx-auto"
          >
            Cambiar servicios o fecha
          </button>

        </div>
      ) : (
 
        <form onSubmit={handleSubmit} className="space-y-5">

          <input 
            type="text" 
            name="website_url" 
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="hidden" 
            autoComplete="off"
            tabIndex={-1} 
          />

          <div>
            <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
              Nombre completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. María Pérez"
              className="w-full bg-white border-2 border-salon-gray/30 px-4 py-3 text-salon-brown focus:border-salon-lavender focus:ring-0 outline-none transition-all hand-drawn placeholder:text-salon-gray/40 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
              Teléfono (WhatsApp)
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 664 123 4567"
              className="w-full bg-white border-2 border-salon-gray/30 px-4 py-3 text-salon-brown focus:border-salon-lavender focus:ring-0 outline-none transition-all hand-drawn placeholder:text-salon-gray/40 font-medium"
            />
          </div>


          <div className="bg-salon-yellow/20 border border-salon-yellow/50 rounded-xl px-4 py-3 mb-2">
            <p className="text-[10px] text-salon-gray leading-relaxed text-center">
              Se requiere depósito de{" "}
              <span className="font-black text-salon-terracotta">$150 MXN</span>{" "}
              al confirmar por WhatsApp. Los precios mostrados son base, el costo final puede variar según la complejidad del diseño.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-salon-olive text-salon-white py-4 px-6 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-folk mb-4 transform active:scale-[0.98] transition-all border-2 border-salon-olive hover:bg-salon-olive/90"
            >
              {isSubmitting ? 'AGENDANDO...' : 'CONFIRMAR RESERVA'}
            </button>
            <p className="text-[10px] text-salon-gray mt-3 text-center opacity-60">
              * Datos protegidos. Solo para contacto.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}