import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PASS_COOKIE, readDevicePass } from "@/lib/rewards-access";
import { getRewardProgram, getStampBalance } from "@/lib/rewards.server";
import EnrollForm from "@/components/rewards/EnrollForm";
import StampCard from "@/components/rewards/StampCard";
import { formatChihuahuaDate } from "@/lib/timezone";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi tarjeta · Tangible",
  description: "Tus sellos y recompensas en Tangible Nails & Art Studio.",
  // A personal loyalty card has no business in a search index.
  robots: { index: false, follow: false },
};

// Reads a cookie and a live balance, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Shown on a phone that may be handed around or left on a counter, so the card
 * says who it belongs to without spelling her out: "Ana G.", never the full name.
 */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest[0]?.[0];
  return initial ? `${first} ${initial}.` : first;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-salon-bg px-6 py-10">
      <div className="max-w-sm mx-auto">
        <header className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 relative mb-2">
            <Image
              src="/logo-tangible.png"
              alt=""
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-title text-2xl font-black text-salon-brown tracking-[0.3em] uppercase">
            Tangible
          </h1>
          <div className="flex items-center gap-3 opacity-70 mt-1">
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
            <p className="text-salon-terracotta text-[10px] uppercase tracking-[0.2em] font-bold">
              Nails &amp; Art Studio
            </p>
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function RewardsPage() {
  const program = await getRewardProgram();

  if (!program.isActive) {
    return (
      <Shell>
        <div className="bg-white border-2 border-salon-olive/20 rounded-3xl p-8 text-center">
          <p className="text-sm font-black text-salon-brown uppercase tracking-wide mb-2">
            Muy pronto
          </p>
          <p className="text-xs text-salon-gray leading-relaxed">
            Estamos preparando el programa de recompensas. Pregunta en el estudio.
          </p>
        </div>
      </Shell>
    );
  }

  // Identity comes only from the signed cookie. There is no query parameter and
  // no id in the URL, so there is nothing to change to see somebody else's card.
  const store = await cookies();
  const customerId = readDevicePass(store.get(PASS_COOKIE)?.value);

  if (!customerId) {
    return (
      <Shell>
        <div className="bg-white border-2 border-salon-olive/20 rounded-3xl p-6 mb-5 hand-drawn">
          <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest text-center mb-5">
            Tu tarjeta de sellos
          </p>
          <div className="opacity-35 mb-5">
            <StampCard stamps={0} required={program.stampsRequired} track={false} />
          </div>
          <p className="text-xs text-salon-gray text-center leading-relaxed">
            Activa tu tarjeta con el código que te damos al terminar tu cita.
          </p>
        </div>

        <EnrollForm />

        <p className="text-[10px] text-salon-gray/80 text-center leading-relaxed mt-4">
          Solo la primera vez. Después tu tarjeta se abre sola en este teléfono.
        </p>
      </Shell>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, joinedAt: true },
  });

  // The pass outlived its customer — a merged or deleted record. Send her back
  // to enrollment rather than showing an error she cannot act on.
  if (!customer) {
    return (
      <Shell>
        <div className="bg-white border-2 border-salon-olive/20 rounded-3xl p-6 mb-5">
          <p className="text-xs text-salon-gray text-center leading-relaxed">
            No encontramos tu tarjeta. Pide un código nuevo en el estudio para
            activarla otra vez.
          </p>
        </div>
        <EnrollForm />
      </Shell>
    );
  }

  const stamps = await getStampBalance(customerId);
  const required = program.stampsRequired;
  const complete = stamps >= required;
  const remaining = Math.max(required - stamps, 0);

  const lastRedemption = await prisma.redemption.findFirst({
    where: { customerId },
    orderBy: { redeemedAt: "desc" },
    select: { rewardLabel: true, redeemedAt: true },
  });

  return (
    <Shell>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-lg font-black text-salon-brown">
          Hola, {shortName(customer.name)}
        </p>
        {customer.joinedAt && (
          <p className="text-[10px] text-salon-gray font-bold shrink-0">
            desde {MONTHS[customer.joinedAt.getMonth()]} {customer.joinedAt.getFullYear()}
          </p>
        )}
      </div>

      <section
        className={`rounded-3xl p-6 mb-5 hand-drawn border-2 ${
          complete
            ? "bg-gradient-to-b from-[#FDF0F4] to-white border-salon-pink/50"
            : "bg-white border-salon-olive/20"
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest">
            Tus sellos
          </p>
          <p className="text-xs font-black text-salon-brown tabular-nums">
            {Math.min(stamps, required)}{" "}
            <span className="text-salon-gray font-normal">/ {required}</span>
          </p>
        </div>

        <StampCard stamps={stamps} required={required} />

        {complete ? (
          <div className="text-center mt-5">
            <p className="font-title text-2xl font-black text-salon-brown uppercase tracking-[0.1em] leading-tight mb-2">
              Recompensa
              <br />
              lista
            </p>
            <p className="text-sm font-black text-salon-brown mb-1">
              {program.rewardLabel}
            </p>
            <p className="text-[11px] text-salon-gray leading-relaxed">
              Muestra esta pantalla en el estudio y te la aplicamos al cobrar.
            </p>
          </div>
        ) : (
          <>
            <div className="h-1.5 rounded-full bg-salon-olive/15 overflow-hidden mt-5 mb-3">
              <div
                className="h-full rounded-full bg-salon-olive transition-all"
                style={{ width: `${(stamps / required) * 100}%` }}
              />
            </div>
            <p className="text-center text-xs text-salon-brown leading-relaxed">
              {remaining === 1 ? (
                <>
                  Falta <strong>1 visita</strong> para tu recompensa
                </>
              ) : (
                <>
                  Faltan <strong>{remaining} visitas</strong> para tu recompensa
                </>
              )}
            </p>
          </>
        )}
      </section>

      {!complete && (
        <section className="bg-white border-2 border-salon-lavender/35 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest">
              Tu recompensa
            </p>
            <span className="text-[9px] font-black text-salon-lavender bg-salon-lavender/10 px-2 py-1 rounded-full uppercase tracking-wider shrink-0">
              Al llegar a {required}
            </span>
          </div>
          <p className="text-sm font-black text-salon-brown leading-snug">
            {program.rewardLabel}
          </p>
          {program.termsNote && (
            <p className="text-[11px] text-salon-gray mt-1.5 leading-relaxed">
              {program.termsNote}
            </p>
          )}
        </section>
      )}

      {lastRedemption && (
        <section className="bg-salon-olive/5 border-2 border-salon-olive/30 rounded-2xl px-5 py-4 mb-5">
          <p className="text-[10px] font-black text-salon-olive uppercase tracking-widest mb-1">
            Última recompensa
          </p>
          <p className="text-xs text-salon-brown font-bold">{lastRedemption.rewardLabel}</p>
          <p className="text-[10px] text-salon-gray mt-0.5">
            {formatChihuahuaDate(lastRedemption.redeemedAt)}
          </p>
        </section>
      )}

      <Link
        href="/"
        className="block w-full py-4 bg-salon-olive text-white text-center font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-folk"
      >
        Agendar mi cita
      </Link>

      <p className="text-[10px] text-salon-gray/80 text-center leading-relaxed mt-4">
        Tu sello se agrega al terminar cada cita.
      </p>
    </Shell>
  );
}
