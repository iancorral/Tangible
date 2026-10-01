"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Service } from '@/types';
import MuralDecorations from '@/components/layout/MuralDecorations';
import { CategoryAccordion } from '@/components/bookings/ServiceCard';
import BookingCalendar from '@/components/bookings/BookingCalendar';
import ClientForm from '@/components/bookings/ClientForm';
import { buildClientBookingRequestMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { chihuahuaToUTC } from '@/lib/timezone';

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
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
  
        <MuralDecorations />
      
        <div className="z-10 bg-white/90 backdrop-blur-sm p-8 rounded-2xl border-2 border-salon-black shadow-folk max-w-sm animate-in fade-in zoom-in">
      
            <div className="w-20 h-20 bg-salon-yellow rounded-full flex items-center justify-center mb-4 mx-auto border-2 border-salon-black">
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

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-md mx-auto relative">
  
        <MuralDecorations />

        <header className="mb-8 text-center mt-6 fade-in flex flex-col items-center relative z-10">
          <div className="w-36 h-36 relative mb-2 filter drop-shadow-sm hover:rotate-2 transition-transform duration-500">
            <Image 
              src="/logo-tangible.png" 
              alt="Tangible Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          
          <h1 className="font-title text-3xl font-black text-salon-brown tracking-[0.3em] uppercase mb-2">
            TANGIBLE
          </h1>
      
          <div className="flex items-center gap-3 opacity-70">
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full"></div>
            <p className="text-salon-terracotta text-[10px] uppercase tracking-[0.2em] font-bold">
              Nails & Art Studio
            </p>
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full"></div>
          </div>
        </header>

        <section className={`relative z-10 ${showClientForm ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-xs font-black text-salon-olive uppercase tracking-[0.1em] bg-white/80 px-3 py-2 rounded-xl backdrop-blur-sm border border-salon-olive/20">
              1. Elige tu arte
            </h2>
            {selectedServices.length > 0 && (
              <span className="text-xs font-black text-white bg-salon-lavender px-3 py-1 rounded-full shadow-sm animate-pulse border-2 border-white">
                {selectedServices.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 animate-pulse text-salon-gray font-medium">Cargando menú...</div>
          ) : (
            <div className="space-y-3">
              {Array.from(new Set(services.map(s => s.category ?? 'General'))).map(category => (
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
          <section className={`mt-10 relative z-10 ${showClientForm ? 'opacity-50 pointer-events-none' : 'animate-in fade-in'}`}>
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border-2 border-salon-olive/30 shadow-folk">
                <h2 className="text-xs font-black text-salon-olive uppercase tracking-[0.1em] mb-5">
                  2. Tu espacio
                </h2>
                
                <div className="flex items-center justify-between mb-6 bg-salon-yellow/20 p-4 rounded-2xl border border-salon-yellow hand-drawn">
                  <span className="text-xs text-salon-brown font-bold uppercase tracking-wider">Duración total:</span>
                  <span className="font-black text-xl text-salon-brown">{totalDuration} min</span>
                </div>
                
                <BookingCalendar 
                  onDateTimeSelect={(d, t) => { setBookingDate({date: d, time: t}); setShowClientForm(false); }} 
                  totalDuration={totalDuration} 
                />
            </div>
          </section>
        )}

        {selectedServices.length > 0 && bookingDate && showClientForm && (
           <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 relative z-20">
             <div className="bg-white shadow-folk border-2 border-salon-brown overflow-hidden rounded-2xl">
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
        <footer className="text-center py-6 mt-4">
          <p className="text-[10px] text-salon-gray/50 uppercase tracking-widest font-bold">
            © Tangible Nails & Art Studio
          </p>
        </footer>

        <div className="h-48 w-full"></div>

        {selectedServices.length > 0 && !showClientForm && (
          <div className="fixed bottom-4 left-0 w-full z-50 px-4">
            <div className="max-w-md mx-auto">
              <button 
                disabled={!bookingDate}
                onClick={() => {
                   setShowClientForm(true);
                   setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
                }}
                className={`
                  w-full py-4 px-6 flex justify-between items-center transition-all duration-300 shadow-folk border-2 border-salon-olive rounded-2xl
                  ${bookingDate 
                    ? 'bg-salon-olive text-salon-white hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-white text-salon-gray border-salon-gray/30 cursor-not-allowed opacity-90'
                  }
                `}
              >
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-widest mb-1 font-bold">
                    {bookingDate ? 'CONTINUAR' : 'ELIGE HORA'}
                  </span>
                  <span className="font-black text-xl">${totalPrice}</span>
                </div>
                {bookingDate && (
                  <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
    </main>
  );
}