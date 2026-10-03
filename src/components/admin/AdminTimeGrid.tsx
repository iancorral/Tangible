"use client";

export type DayOverviewAppointment = {
  startMinutes: number;
  endMinutes: number;
  clientName: string;
  startLabel: string;
  endLabel: string;
};

interface Props {
  selectedTime: string;
  onSelect: (time: string) => void;
  dayAppointments: DayOverviewAppointment[];
  durationMinutes: number;
}

const START = 6 * 60;  
const END = 22 * 60;  

function label(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export default function AdminTimeGrid({ selectedTime, onSelect, dayAppointments, durationMinutes }: Props) {
  const slots: string[] = [];
  for (let m = START; m < END; m += 30) slots.push(label(m));

  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map((t) => {
        const [h, m] = t.split(":").map(Number);
        const start = h * 60 + m;
        const end = start + durationMinutes;
        const conflict = dayAppointments.find((a) => start < a.endMinutes && end > a.startMinutes);
        const selected = selectedTime === t;

        return (
          <button
            key={t}
            type="button"
            onClick={() => onSelect(t)}
            title={conflict ? `Se cruza con ${conflict.clientName} (${conflict.startLabel}-${conflict.endLabel})` : undefined}
            className={`py-2.5 text-sm font-bold rounded-xl border-2 transition-all relative ${
              selected
                ? "bg-salon-lavender text-white border-salon-lavender"
                : conflict
                ? "bg-salon-terracotta/5 text-salon-terracotta border-salon-terracotta/25 hover:border-salon-terracotta"
                : "bg-white text-salon-brown border-salon-gray/20 hover:border-salon-olive"
            }`}
          >
            {t}
            {conflict && !selected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-salon-terracotta rounded-full border border-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}