"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Service } from '@/types';
import MuralDecorations from '@/components/layout/MuralDecorations';
import { CategoryAccordion } from '@/components/bookings/ServiceCard';
import BookingCalendar from '@/components/bookings/BookingCalendar';
import ClientForm from '@/components/bookings/ClientForm';
import BookingSummary from '@/components/bookings/BookingSummary';
import { buildClientBookingRequestMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { chihuahuaToUTC } from '@/lib/timezone';

const CATEGORY_ORDER = ['Manicura y Pedicura', 'Uñas', 'Maquillaje y Peinado', 'Cejas', 'Extras'];

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]); 
  const [bookingDate, setBookingDate] = useState<{date: Date, time: string} | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);

  useEffect(() => {
    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => {
        setServices(data);
        setLoading(false);
      })
      .catch((error) => console.error("Error:", error));
  }, []);

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
    setBookingDate(null); 
    setShowClientForm(false);
  };

    const handleFinalBooking = async (clientName: string, clientPhone: string, websiteUrl?: string) => {
    if (selectedServices.length === 0 || !bookingDate) return;
    setIsSubmitting(true);

    const [hours, minutes] = bookingDate.time.split(':').map(Number);
    // The slot is a Chihuahua wall-clock time. Building it in the browser's own
    // zone would shift it for anyone whose phone is set elsewhere (Juárez
    // observes DST, Chihuahua city does not).
    const finalDate = chihuahuaToUTC(
      bookingDate.date.getFullYear(),
      bookingDate.date.getMonth() + 1,
      bookingDate.date.getDate(),
      hours,
      minutes
    );

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServices.map(s => s.id),
          date: finalDate.toISOString(),
          clientName,
          clientPhone,
          website_url: websiteUrl || "" 
        })
      });

      if (response.ok) {
        setBookingSuccess(true);
      } else {
        const data = await response.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "No se pudo agendar. Inténtalo de nuevo.");
      }
    } catch (error) {
      console.error(error);
      alert("No hay conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };
  if (bookingSuccess && bookingDate) {
    const dateStr = bookingDate.date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const salonPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

    const message = buildClientBookingRequestMessage({
      dateLabel: dateStr,
      timeLabel: bookingDate.time,
      serviceNames: selectedServices.map(s => s.name),
      durationMinutes: totalDuration,
    });

    const whatsappUrl = buildWhatsAppUrl(salonPhone, message);

    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
  
        <MuralDecorations />
      
        <div className="z-10 bg-white/90 backdrop-blur-sm p-8 rounded-2xl border-2 border-salon-black shadow-folk max-w-sm animate-in fade-in zoom-in">
      
            <div className="w-20 h-20 bg-salon-blush rounded-full flex items-center justify-center mb-4 mx-auto border-2 border-salon-black">
              <svg className="w-10 h-10 text-salon-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            
            <h1 className="font-title text-2xl font-black text-salon-black mb-2 uppercase tracking-wider">¡Cita Apartada!</h1>
            <p className="text-salon-gray mb-6 text-xs font-bold uppercase tracking-widest leading-relaxed">
              Para finalizar, es necesario enviar el mensaje de confirmación.
            </p>

            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#20bd5a] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>CONFIRMAR EN WHATSAPP</span>
            </a>
            
            <button onClick={() => window.location.reload()} className="text-[10px] uppercase tracking-wider text-salon-gray underline mt-6 block mx-auto font-bold hover:text-salon-black">
              Volver al inicio
            </button>
        </div>
      </main>
    );
  }

  const step = !selectedServices.length ? 1 : !bookingDate ? 2 : 3;

  // MongoDB no garantiza el orden de los documentos: sin esto las categorías
  // cambiaban de lugar entre visitas. Las conocidas van en este orden y
  // cualquier categoría nueva se agrega al final, en orden alfabético.
  const orderedCategories = Array.from(new Set(services.map(s => s.category ?? 'General'))).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return a.localeCompare(b, 'es');
  });

  const continueToForm = () => {
    setShowClientForm(true);
    setTimeout(() => document.getElementById('tus-datos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  return (
    <main className="relative min-h-[100dvh]">
      <MuralDecorations />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-8 pb-10 sm:px-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:px-10 lg:pt-16">
        {/* ── Marca + resumen (columna izquierda en escritorio) ─────────── */}
        <aside className="lg:sticky lg:top-12 lg:self-start">
          <header className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="relative mb-2 h-32 w-32 drop-shadow-sm lg:h-40 lg:w-40 lg:-ml-3">
              <Image src="/logo-tangible.png" alt="Tangible" fill sizes="160px" className="object-contain" priority />
            </div>
            <h1 className="font-title text-3xl font-black uppercase tracking-[0.3em] text-salon-brown lg:text-5xl lg:tracking-[0.25em]">
              Tangible
            </h1>
            <div className="mt-2 flex items-center gap-3 opacity-80">
              <span className="h-[2px] w-6 rounded-full bg-salon-terracotta lg:hidden" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-salon-terracotta lg:text-xs">Nails &amp; Art Studio</p>
              <span className="h-[2px] w-6 rounded-full bg-salon-terracotta" />
            </div>
            <p className="mt-6 hidden max-w-sm text-[15px] leading-relaxed text-salon-brown/80 lg:block">
              Uñas, maquillaje y arte hechos a mano. Elige tus servicios, aparta tu espacio y
              confirma por WhatsApp.
            </p>
            <ul className="mt-5 hidden flex-wrap gap-2 lg:flex">
              {['Reserva en 3 pasos', 'Confirmación por WhatsApp', 'Depósito de $150'].map((t) => (
                <li key={t} className="rounded-full border border-salon-brown/10 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-salon-brown/80">
                  {t}
                </li>
              ))}
            </ul>
          </header>

          <div className="mt-8 hidden lg:block">
            <BookingSummary
              services={selectedServices}
              bookingDate={bookingDate}
              onRemove={toggleService}
              onContinue={continueToForm}
              continueDisabled={!bookingDate}
              formOpen={showClientForm}
            />
          </div>
        </aside>

        {/* ── Pasos de la reserva ───────────────────────────────────────── */}
        <div className="mt-8 lg:mt-0">
          <ol className="mb-6 flex items-center gap-2" aria-label="Pasos">
            {['Servicios', 'Fecha', 'Tus datos'].map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? 'step' : undefined}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors ${
                      done ? 'bg-salon-olive text-white' : current ? 'bg-salon-brown text-white' : 'bg-white text-salon-gray border border-salon-gray/30'
                    }`}
                  >
                    {done ? '✓' : n}
                  </span>
                  <span className={`truncate text-[11px] font-black uppercase tracking-wider ${current ? 'text-salon-brown' : 'text-salon-gray'}`}>
                    {label}
                  </span>
                  {n < 3 && <span className="hidden h-px flex-1 bg-salon-brown/10 sm:block" />}
                </li>
              );
            })}
          </ol>

          <section className={`${showClientForm ? 'opacity-50 pointer-events-none' : ''}`} aria-labelledby="paso-servicios">
            <h2 id="paso-servicios" className="mb-3 px-1 text-xs font-black uppercase tracking-[0.15em] text-salon-olive">
              1. Elige tu arte
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-[60px] rounded-2xl border-2 border-salon-gray/10 bg-white animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {orderedCategories.map(category => (
                  <CategoryAccordion
                    key={category}
                    category={category}
                    services={services.filter(s => (s.category ?? 'General') === category)}
                    selectedServices={selectedServices}
                    onSelect={toggleService}
                  />
                ))}
              </div>
            )}
          </section>

          {selectedServices.length > 0 && (
            <section className={`mt-10 ${showClientForm ? 'opacity-50 pointer-events-none' : 'animate-in fade-in'}`} aria-labelledby="paso-fecha">
              <div className="rounded-3xl border-2 border-salon-olive/20 bg-white/90 p-5 shadow-sm backdrop-blur-md sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="paso-fecha" className="text-xs font-black uppercase tracking-[0.15em] text-salon-olive">
                    2. Tu espacio
                  </h2>
                  <span className="rounded-full bg-salon-blush/25 px-3 py-1 text-[11px] font-black text-salon-brown">
                    {totalDuration} min
                  </span>
                </div>

                <BookingCalendar
                  onDateTimeSelect={(d, t) => { setBookingDate({ date: d, time: t }); setShowClientForm(false); }}
                  totalDuration={totalDuration}
                />
              </div>
            </section>
          )}

          {selectedServices.length > 0 && bookingDate && showClientForm && (
            <section id="tus-datos" className="mt-8 scroll-mt-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="overflow-hidden rounded-3xl border-2 border-salon-brown bg-white shadow-folk">
                <ClientForm
                  onSubmit={handleFinalBooking}
                  isSubmitting={isSubmitting}
                  onGoBack={() => {
                    setShowClientForm(false);
                    setBookingDate(null);
                  }}
                />
              </div>
            </section>
          )}

          <footer className="py-8 text-center lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-salon-gray/60">
              © Tangible Nails &amp; Art Studio
            </p>
          </footer>

          {/* Espacio para que la barra inferior (celular) no tape el final. */}
          <div className="h-28 lg:hidden" aria-hidden="true" />
        </div>
      </div>

      {/* ── Barra inferior (celular / tablet) ───────────────────────────── */}
      {selectedServices.length > 0 && !showClientForm && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden bg-gradient-to-t from-salon-bg via-salon-bg/90 to-transparent">
          <button
            disabled={!bookingDate}
            onClick={continueToForm}
            className={`mx-auto flex w-full max-w-md items-center justify-between rounded-2xl border-2 px-5 py-3.5 shadow-folk transition-all duration-300 ${
              bookingDate
                ? 'border-salon-olive bg-salon-olive text-white active:scale-[0.98]'
                : 'cursor-not-allowed border-salon-gray/20 bg-white text-salon-gray'
            }`}
          >
            <span className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">
                {selectedServices.length} {selectedServices.length === 1 ? 'servicio' : 'servicios'} · {totalDuration} min
              </span>
              <span className="text-xl font-black tabular-nums">${totalPrice}</span>
            </span>
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
              {bookingDate ? 'Continuar' : 'Elige fecha y hora'}
              {bookingDate && (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </span>
          </button>
        </div>
      )}
    </main>
  );
}
