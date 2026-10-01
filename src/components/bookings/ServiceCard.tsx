"use client";

import { useState } from "react";
import { Service } from "@/types";

interface ServiceCardProps {
  service: Service;
  onSelect: (service: Service) => void;
  isSelected: boolean;
}

/**
 * Un servicio elegible. Es un <button> con aria-pressed (no un div con onClick)
 * para que funcione con teclado y lectores de pantalla, y muestra una palomita
 * clara: en el celular no hay hover que indique qué ya está elegido.
 */
export function ServiceCardItem({ service, onSelect, isSelected }: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      aria-pressed={isSelected}
      className={`group flex h-full w-full items-start gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all active:scale-[0.99] ${
        isSelected
          ? "border-salon-lavender shadow-folk-purple"
          : "border-salon-olive/25 shadow-sm hover:border-salon-olive/60 hover:shadow-md"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isSelected ? "border-salon-lavender bg-salon-lavender text-white" : "border-salon-gray/30 bg-white"
        }`}
      >
        {isSelected && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2.5 6.5 5 9l4.5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block font-black uppercase leading-tight tracking-wide text-[15px] ${isSelected ? "text-salon-lavender" : "text-salon-brown"}`}>
          {service.name}
        </span>
        {service.description && (
          <span className="mt-1 block text-xs font-medium leading-relaxed text-salon-gray">{service.description}</span>
        )}
        <span className="mt-2 inline-block rounded-md bg-salon-honey/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-salon-brown">
          {service.duration} min
        </span>
      </span>

      <span className="shrink-0 text-lg font-black text-salon-brown tabular-nums">${service.price}</span>
    </button>
  );
}

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  'Uñas':                { border: 'border-salon-lavender',   bg: 'bg-salon-lavender/10',   text: 'text-salon-lavender',   dot: 'bg-salon-lavender' },
  'Extras':              { border: 'border-salon-honey',      bg: 'bg-salon-honey/15',      text: 'text-salon-brown',      dot: 'bg-salon-honey' },
  'Manicura y Pedicura': { border: 'border-salon-terracotta', bg: 'bg-salon-terracotta/10', text: 'text-salon-terracotta', dot: 'bg-salon-terracotta' },
  'Maquillaje y Peinado':{ border: 'border-salon-olive',      bg: 'bg-salon-olive/10',      text: 'text-salon-olive',      dot: 'bg-salon-olive' },
  'Cejas':               { border: 'border-salon-brown',      bg: 'bg-salon-brown/10',      text: 'text-salon-brown',      dot: 'bg-salon-brown' },
  'General':             { border: 'border-salon-gray/30',    bg: 'bg-salon-bg',            text: 'text-salon-gray',       dot: 'bg-salon-gray' },
};

interface CategoryAccordionProps {
  category: string;
  services: Service[];
  selectedServices: Service[];
  onSelect: (service: Service) => void;
}

export function CategoryAccordion({ category, services, selectedServices, onSelect }: CategoryAccordionProps) {
  const [open, setOpen] = useState(false);
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['General'];
  const selectedCount = services.filter(s => selectedServices.some(sel => sel.id === s.id)).length;
  const panelId = `categoria-${category.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className={`overflow-hidden rounded-2xl border-2 ${colors.border} bg-white shadow-folk transition-all duration-300`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between px-5 py-4 transition-colors ${open ? colors.bg : 'bg-white'}`}
      >
        <span className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${colors.dot}`} aria-hidden="true" />
          <span className={`text-sm font-black uppercase tracking-wider ${colors.text}`}>{category}</span>
          <span className="text-[10px] font-bold text-salon-gray">({services.length})</span>
        </span>
        <span className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="rounded-full bg-salon-lavender px-2 py-0.5 text-[10px] font-black text-white">
              {selectedCount} {selectedCount === 1 ? 'elegido' : 'elegidos'}
            </span>
          )}
          <svg
            className={`h-4 w-4 text-salon-gray transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div id={panelId} className="grid gap-3 bg-salon-bg/30 p-3 sm:grid-cols-2">
          {services.map((service) => (
            <ServiceCardItem
              key={service.id}
              service={service}
              onSelect={onSelect}
              isSelected={selectedServices.some(s => s.id === service.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ServiceCard({ service, onSelect, isSelected }: ServiceCardProps) {
  return <ServiceCardItem service={service} onSelect={onSelect} isSelected={isSelected} />;
}
